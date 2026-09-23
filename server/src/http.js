import express from "express";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer, TOOL_COUNT } from "./create-server.js";
import { adminLoginPage, adminPage, healthPage, testPage, toolsPage, logPage, helpPage } from "./pages.js";
import { generateData, generateTraffic } from "./traffic.js";
import { VERSION } from "./version.js";

const COOKIE = "mcp_admin";

function cookieOf(req) {
  const header = req.headers.cookie || "";
  const part = header.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${COOKIE}=`));
  return part ? decodeURIComponent(part.slice(COOKIE.length + 1)) : "";
}

function isHttps(req) {
  return req.secure === true || String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https";
}

function cookieFlags(req) {
  const parts = ["HttpOnly", "SameSite=Lax", "Path=/"];
  if (isHttps(req)) parts.push("Secure");
  return parts.join("; ");
}

function setSession(res, id, req) {
  res.setHeader("Set-Cookie", `${COOKIE}=${encodeURIComponent(id)}; ${cookieFlags(req)}`);
}

function clearSession(res, req) {
  res.setHeader("Set-Cookie", `${COOKIE}=; Max-Age=0; ${cookieFlags(req)}`);
}

function hostName(req) {
  return String(req.headers.host || "").split(":")[0].toLowerCase().replace(/^\[|\]$/g, "");
}

function isLoopbackHost(host) {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

function isPublicDeploy() {
  return Boolean(process.env.CONTAINER || process.env.CODE_ENGINE_PROJECT || process.env.HOST === "0.0.0.0");
}

/** demo/demo is laptop-only. A public bind must set ADMIN_PASSWORD. */
function defaultAdminDisabled() {
  return isPublicDeploy() && !process.env.ADMIN_PASSWORD;
}

function requestIsLoopback(req) {
  return isLoopbackHost(hostName(req));
}

function extraCorsOrigins() {
  return String(process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
}

function originAllowed(req) {
  const origin = String(req.headers.origin || "");
  if (!origin) return true;
  try {
    const url = new URL(origin);
    if (isLoopbackHost(url.hostname)) return true;
    const host = hostName(req);
    if (host && url.hostname === host) return true;
  } catch {
    return false;
  }
  return extraCorsOrigins().includes(origin);
}

function applyCors(req, res) {
  const origin = String(req.headers.origin || "");
  if (!origin || !originAllowed(req)) return;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, mcp-session-id, mcp-protocol-version, x-api-key");
  res.setHeader("Access-Control-Expose-Headers", "mcp-session-id, mcp-protocol-version");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Vary", "Origin");
}

function isInitializeRequest(body) {
  if (Array.isArray(body)) return body.some((msg) => msg?.method === "initialize");
  return body?.method === "initialize";
}

/** /health is unauthenticated, so it reports posture — never key labels or usernames. */
function publicSecurity(security) {
  const full = security.snapshot();
  return {
    authMode: full.authMode,
    writeToolsLocked: full.writeToolsLocked,
    allToolsLocked: full.allToolsLocked,
    tenantRequired: full.tenantRequired,
    tenantPresent: full.tenantPresent,
    tokenConfigured: full.tokenConfigured,
    activeKeyCount: full.activeKeyCount,
    rateLimit: full.rateLimit,
    scopes: full.scopes,
  };
}

function publicInfo(store, security, req, { includeCwd = false } = {}) {
  const info = {
    ok: true,
    service: "mcp-ticket-demo",
    version: VERSION,
    transport: "http",
    tools: TOOL_COUNT,
    hostname: req?.headers?.host || process.env.HOSTNAME || "local",
    port: Number(process.env.PORT || 8080),
    security: publicSecurity(security),
    endpoints: {
      health: "/health",
      test: "/test",
      admin: "/admin",
      tools: "/tools",
      sse: "/sse",
      mcp: "/mcp",
    },
    note: "/health /test /admin are a convention, not part of the MCP spec.",
  };
  if (includeCwd || requestIsLoopback(req)) info.cwd = process.cwd();
  return info;
}

/** Field the admin forms post; also accepted as JSON from the workbench. */
function body(req, name) {
  const value = req.body?.[name];
  return value === undefined || value === null ? "" : String(value);
}

function checkboxList(req, name) {
  const value = req.body?.[name];
  if (Array.isArray(value)) return value.map(String);
  return String(value || "").split(/[\s,]+/).filter(Boolean);
}

function wantsJson(req) {
  return (req.headers.accept || "").includes("application/json") || req.query?.format === "json";
}

function runSmoke(store, { write = false } = {}) {
  const steps = [];
  const push = (name, ok, detail) => steps.push({ name, ok, detail });

  try {
    const listed = store.listTickets({ status: "open", limit: 5 });
    push("search_tickets", listed.length > 0, `${listed.length} open ticket(s)`);

    const found = store.getTicket("TCK-1001");
    push("get_ticket TCK-1001", Boolean(found), found ? found.id : "missing");

    const schemas = Object.keys(store.schemas);
    push("list_schemas", schemas.length === 3, schemas.join(", "));

    const query = store.runQuery({ schema: "tickets", filter: { status: "open" }, limit: 3 });
    push("run_query tickets", !query.error && query.count >= 1, query.error || `${query.count} row(s)`);

    if (write) {
      const { ticket, usedServiceAccount } = store.createTicket({
        subject: "Smoke test from /test",
        body: "Created with requester_email so the next thing that happens is right.",
        requester_email: "ada@example.com",
      });
      push("create_ticket with requester_email", ticket && !usedServiceAccount, `${ticket.id} owned by ${ticket.requester_email}`);

      const closed = store.closeTicket(ticket.id, { resolution: "Smoke test closed it.", closed_by: "ada@example.com" });
      push("close_ticket", Boolean(closed) && !closed.alreadyClosed && closed.ticket.status === "solved", closed ? closed.ticket.status : "missing");
    }
  } catch (error) {
    push("unexpected", false, error.message);
  }

  return {
    ok: steps.every((s) => s.ok),
    writes: write,
    steps,
    at: new Date().toISOString(),
  };
}

export async function startHttp({ store, security }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.urlencoded({ extended: true }));
  app.use("/admin", express.json());

  const sseSessions = new Map();
  const mcpSessions = new Map();
  // A freshly issued key is shown once on the next admin render, then forgotten.
  let pendingKey = null;

  /**
   * Notify SSE and Streamable HTTP sessions that the tool list changed.
   * Stateless one-shot /mcp POSTs (curl, tests) have no session — they
   * re-list on the next call. Cursor/Bob keep a session and get the notice.
   */
  function broadcastToolListChanged() {
    for (const { server } of sseSessions.values()) {
      try { server.server?.sendToolListChanged(); } catch { /* session may be closing */ }
    }
    for (const { server } of mcpSessions.values()) {
      try { server.server?.sendToolListChanged(); } catch { /* session may be closing */ }
    }
  }

  function takePendingKey() {
    const key = pendingKey;
    pendingKey = null;
    return key;
  }

  function requireAdmin(req, res, next) {
    if (security.validSession(cookieOf(req))) return next();
    if ((req.headers.accept || "").includes("application/json") || req.path.startsWith("/admin/api")) {
      res.status(401).json({ ok: false, error: "Sign in at /admin or send a session cookie." });
      return;
    }
    res.status(401).send(adminLoginPage());
  }

  app.get("/", (_req, res) => res.redirect("/health"));

  app.get("/tools", (req, res) => {
    const info = publicInfo(store, security, req);
    if ((req.headers.accept || "").includes("application/json") || req.query.format === "json") {
      res.json({ ok: true, tools: info.tools, endpoints: info.endpoints });
      return;
    }
    res.type("html").send(toolsPage(info));
  });

  app.get("/health", (req, res) => {
    const info = publicInfo(store, security, req);
    if ((req.headers.accept || "").includes("application/json") || req.query.format === "json") {
      res.json(info);
      return;
    }
    res.type("html").send(healthPage(info));
  });

  app.get("/test", (req, res) => {
    const wantWrite = req.query.write === "1";
    const isAdmin = security.validSession(cookieOf(req));
    if (wantWrite && !isAdmin) {
      if (wantsJson(req)) {
        res.status(401).json({ ok: false, error: "Write smoke requires an admin session. Sign in at /admin, or omit write=1 for the public read-only check." });
        return;
      }
      res.status(401).send(adminLoginPage("Write smoke (/test?write=1) requires admin sign-in."));
      return;
    }
    const result = runSmoke(store, { write: wantWrite && isAdmin });
    if (wantsJson(req)) {
      res.status(result.ok ? 200 : 500).json(result);
      return;
    }
    const host = req.headers.host || `127.0.0.1:${Number(process.env.PORT || 8080)}`;
    res.type("html").send(testPage(result, host));
  });

  app.get("/log", requireAdmin, (req, res) => {
    res.type("html").send(logPage({
      security: security.snapshot(),
      store,
    }));
  });

  app.get("/help", (req, res) => {
    res.type("html").send(helpPage(req.headers.host || `127.0.0.1:${Number(process.env.PORT || 8787)}`));
  });

  app.get("/admin", requireAdmin, (req, res) => {
    res.type("html").send(adminPage({
      security: security.snapshot(),
      store,
      adminUser: security.adminUser(),
      info: publicInfo(store, security, req, { includeCwd: true }),
      issuedKey: takePendingKey(),
    }));
  });

  app.get("/admin/api/status", requireAdmin, (req, res) => {
    res.json({
      ok: true,
      security: security.snapshot(),
      info: publicInfo(store, security, req, { includeCwd: true }),
      tickets: store.listTickets({ status: "all", limit: 10 }),
      audit: store.audit(),
    });
  });

  app.post("/admin/login", (req, res) => {
    if (defaultAdminDisabled()) {
      res.status(403).type("html").send(adminLoginPage("Default demo/demo is disabled on a public host. Set ADMIN_PASSWORD in the environment, then sign in."));
      return;
    }
    const id = security.login(req.body.username, req.body.password);
    if (!id) {
      res.status(401).type("html").send(adminLoginPage("Wrong username or password."));
      return;
    }
    setSession(res, id, req);
    res.redirect("/admin");
  });

  app.post("/admin/logout", (req, res) => {
    security.logout(cookieOf(req));
    clearSession(res, req);
    res.redirect("/admin");
  });

  /** Set the auth mode: off | write | all. Also accepts the old writeToolsLocked boolean. */
  app.post("/admin/security", requireAdmin, (req, res) => {
    const mode = body(req, "authMode");
    if (mode) security.setAuthMode(mode);
    else security.setLocked(body(req, "writeToolsLocked") === "1" || req.body?.writeToolsLocked === true);
    broadcastToolListChanged();
    if (wantsJson(req)) {
      res.json({ ok: true, security: security.snapshot() });
      return;
    }
    res.redirect("/admin");
  });

  app.post("/admin/rate-limit", requireAdmin, (req, res) => {
    security.setRateLimit({
      enabled: body(req, "enabled") === "1" || req.body?.enabled === true,
      limit: Number(body(req, "limit")) || undefined,
      windowMs: (Number(body(req, "windowSeconds")) || 0) * 1000 || undefined,
    });
    if (wantsJson(req)) {
      res.json({ ok: true, security: security.snapshot() });
      return;
    }
    res.redirect("/admin");
  });

  /** Issue an API key. The plaintext is returned exactly once — only its hash is kept. */
  app.post("/admin/keys", requireAdmin, (req, res) => {
    const issued = security.issueKey({
      label: body(req, "label") || "unnamed key",
      scopes: checkboxList(req, "scopes"),
      expiresInDays: Number(body(req, "expiresInDays")) || 0,
      createdBy: security.adminUser(),
    });
    if (wantsJson(req)) {
      res.json({ ok: true, key: issued.key, record: issued.record, note: "Copy the key now — the server only stores its hash." });
      return;
    }
    pendingKey = issued;
    res.redirect("/admin");
  });

  app.post("/admin/audit-mode", requireAdmin, (req, res) => {
    const enabled = body(req, "enabled") === "1" || req.body?.enabled === true;
    security.setAuditMode(enabled);
    if (wantsJson(req)) {
      res.json({ ok: true, security: security.snapshot() });
      return;
    }
    res.redirect("/admin#adm-security");
  });

  app.post("/admin/naive-mode", requireAdmin, (req, res) => {
    const enabled = body(req, "enabled") === "1" || req.body?.enabled === true;
    security.setNaiveMode(enabled);
    if (wantsJson(req)) {
      res.json({ ok: true, security: security.snapshot() });
      return;
    }
    res.redirect("/admin#adm-security");
  });

  app.post("/admin/tool-gate", requireAdmin, (req, res) => {
    const toolName = body(req, "tool");
    const enabled = body(req, "enabled") !== "0";
    security.setToolGate(toolName, enabled);
    broadcastToolListChanged();
    if (wantsJson(req)) {
      res.json({ ok: true, security: security.snapshot() });
      return;
    }
    res.redirect("/admin#adm-gates");
  });

  app.post("/admin/tool-auth", requireAdmin, (req, res) => {
    const toolName = body(req, "tool");
    const requireAuth = body(req, "requireAuth") === "1";
    security.setToolAuth(toolName, requireAuth);
    broadcastToolListChanged();
    if (wantsJson(req)) {
      res.json({ ok: true, security: security.snapshot() });
      return;
    }
    res.redirect("/admin#adm-gates");
  });

  app.post("/admin/generate-data", requireAdmin, async (req, res) => {
    const count = Math.min(40, Math.max(1, Number(body(req, "count")) || 10));
    const result = generateData(store, { count });
    if (wantsJson(req)) {
      res.json(result);
      return;
    }
    res.redirect("/admin");
  });

  app.post("/admin/generate-traffic", requireAdmin, async (req, res) => {
    const rounds = Math.min(20, Math.max(1, Number(body(req, "rounds")) || 5));
    const result = await generateTraffic(store, security, { rounds });
    if (wantsJson(req)) {
      res.json(result);
      return;
    }
    res.redirect("/admin");
  });

  app.post("/admin/tickets/create", requireAdmin, (req, res) => {
    const { subject, body, requester_email } = req.body || {};
    if (!subject || !body) {
      if (wantsJson(req)) return res.status(400).json({ ok: false, error: "subject and body required" });
      return res.redirect("/admin#adm-data");
    }
    const { ticket } = store.createTicket({ subject, body, requester_email: requester_email || undefined });
    if (wantsJson(req)) return res.status(201).json({ ok: true, ticket });
    res.redirect("/admin#adm-data");
  });

  app.post("/admin/tickets/:id/delete", requireAdmin, (req, res) => {
    const ok = store.deleteTicket(req.params.id);
    if (wantsJson(req)) {
      res.status(ok ? 200 : 404).json({ ok });
      return;
    }
    res.redirect("/admin#adm-data");
  });

  app.post("/admin/tickets/:id/edit", requireAdmin, (req, res) => {
    const { subject, requester_email, status } = req.body || {};
    const ticket = store.editTicket(req.params.id, {
      subject: subject || undefined,
      requester_email: requester_email || undefined,
      status: status || undefined,
    });
    if (wantsJson(req)) {
      res.status(ticket ? 200 : 404).json({ ok: Boolean(ticket), ticket });
      return;
    }
    res.redirect("/admin#adm-data");
  });

  app.post("/admin/reset", requireAdmin, (req, res) => {
    store.reset();
    if (wantsJson(req)) {
      res.json({ ok: true, message: "Factory reset complete — seed tickets restored." });
      return;
    }
    res.redirect("/admin#adm-data");
  });

  app.post("/admin/server/stop", requireAdmin, (req, res) => {
    const msg = "Server stopped by admin. Restart it from your terminal: MCP_MODE=http npx mcp-ticket-demo";
    if (wantsJson(req)) {
      res.json({ ok: true, message: msg });
    } else {
      res.type("html").send(`<!doctype html><html><head><meta charset="utf-8"><title>Stopped</title>
        <style>body{font-family:system-ui,sans-serif;padding:40px;background:#f3f7f1;color:#10252a}
        pre{background:#fff;border:1px solid #cddbd3;padding:12px;border-radius:8px;font-size:13px}</style></head>
        <body><h2>Server stopped.</h2>
        <p>Restart from your terminal:</p>
        <pre>MCP_MODE=http npx mcp-ticket-demo</pre>
        <p style="color:#557176;font-size:13px">Or use <code>npm run http</code> if you cloned the repo.</p>
        </body></html>`);
    }
    // Flush the response before exiting
    res.once("finish", () => process.exit(0));
    res.end();
  });

  app.post("/admin/server/restart", requireAdmin, (req, res) => {
    if (wantsJson(req)) {
      res.json({ ok: true, message: "Restarting…" });
    } else {
      res.type("html").send(`<!doctype html><html><head><meta charset="utf-8">
        <meta http-equiv="refresh" content="3;url=/health">
        <title>Restarting…</title>
        <style>body{font-family:system-ui,sans-serif;padding:40px;background:#f3f7f1;color:#10252a}</style></head>
        <body><h2>Restarting…</h2>
        <p>Redirecting to <a href="/health">/health</a> in 3 seconds.</p>
        </body></html>`);
    }
    res.once("finish", () => {
      // Re-exec the same Node.js process with the same args and env.
      // Works when started via: node src/index.js  or  npx mcp-ticket-demo
      const child = spawn(process.execPath, process.argv.slice(1), {
        env: process.env,
        stdio: "inherit",
        detached: true,
      });
      child.unref();
      process.exit(0);
    });
    res.end();
  });

  app.post("/admin/keys/revoke", requireAdmin, (req, res) => {
    const ok = security.revokeKey(body(req, "id"));
    if (wantsJson(req)) {
      res.status(ok ? 200 : 404).json({ ok, security: security.snapshot() });
      return;
    }
    res.redirect("/admin");
  });

  app.post("/admin/users/create", requireAdmin, (req, res) => {
    const { username, password, scopes } = req.body || {};
    const result = security.addUser(username, password, scopes);
    if (wantsJson(req)) return res.status(result.ok ? 201 : 400).json(result);
    res.redirect("/admin#adm-users");
  });

  app.post("/admin/users/:username/delete", requireAdmin, (req, res) => {
    const result = security.deleteUser(req.params.username);
    if (wantsJson(req)) return res.status(result.ok ? 200 : 404).json(result);
    res.redirect("/admin#adm-users");
  });

  // Legacy remote transport — what Cursor mcp-proxy and many enterprise clients still speak.
  app.get("/sse", async (req, res) => {
    applyCors(req, res);
    if (!originAllowed(req)) {
      res.status(403).json({ ok: false, error: "Origin not allowed." });
      return;
    }
    const transport = new SSEServerTransport("/messages", res);
    const requestHeaders = () => req.headers;
    const server = createMcpServer({ store, security, requestHeaders });
    sseSessions.set(transport.sessionId, { transport, server });
    res.on("close", () => {
      sseSessions.delete(transport.sessionId);
    });
    await server.connect(transport);
  });

  app.post("/messages", async (req, res) => {
    applyCors(req, res);
    const sessionId = String(req.query.sessionId || "");
    const session = sseSessions.get(sessionId);
    if (!session) {
      res.status(400).send("Unknown SSE session. Connect GET /sse first.");
      return;
    }
    await session.transport.handlePostMessage(req, res);
  });

  // Current remote transport. Initialize opens a session so tools/list_changed
  // can reach Cursor/Bob. One-shot POSTs (curl, /test tools) stay stateless.
  app.all("/mcp", express.json(), async (req, res) => {
    applyCors(req, res);
    if (req.method === "OPTIONS") {
      if (!originAllowed(req)) {
        res.status(403).end();
        return;
      }
      res.status(204).end();
      return;
    }
    if (!originAllowed(req)) {
      res.status(403).json({ ok: false, error: "Origin not allowed. Set CORS_ORIGINS or call from this host / localhost." });
      return;
    }

    const sessionId = String(req.headers["mcp-session-id"] || "");
    if (sessionId && mcpSessions.has(sessionId)) {
      const session = mcpSessions.get(sessionId);
      session.setHeaders(req.headers);
      await session.transport.handleRequest(req, res, req.body);
      return;
    }

    if (req.method === "POST" && isInitializeRequest(req.body)) {
      let latestHeaders = req.headers;
      const requestHeaders = () => latestHeaders;
      let server;
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          mcpSessions.set(id, {
            transport,
            server,
            setHeaders: (headers) => { latestHeaders = headers; },
          });
        },
        onsessionclosed: (id) => {
          mcpSessions.delete(id);
        },
      });
      server = createMcpServer({ store, security, requestHeaders });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    const requestHeaders = () => req.headers;
    const server = createMcpServer({ store, security, requestHeaders });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = Number(process.env.PORT || 8080);
  // Bind to localhost by default so the laptop demo does not expose to LAN.
  // Set HOST=0.0.0.0 (or it is forced automatically) inside a container.
  const host = process.env.HOST || (process.env.CONTAINER || process.env.CODE_ENGINE_PROJECT ? "0.0.0.0" : "127.0.0.1");

  await new Promise((resolve) => {
    app.listen(port, host, () => {
      const snapshot = security.snapshot();
      console.error(`mcp-ticket-demo http on ${host}:${port}`);
      console.error(`  /health  /test  /admin  /tools  /sse  /mcp`);
      console.error(`  auth mode=${snapshot.authMode}  api keys=${snapshot.activeKeyCount}  rate limit=${snapshot.rateLimit.enabled ? `${snapshot.rateLimit.limit}/${Math.round(snapshot.rateLimit.windowMs / 1000)}s` : "off"}`);
      if (isPublicDeploy()) {
        console.error(`  public bind — /health hides cwd, /test is read-only, CORS Origin is checked`);
        if (defaultAdminDisabled()) {
          console.error(`  admin login disabled until ADMIN_PASSWORD is set (demo/demo is laptop-only)`);
        }
      } else {
        console.error(`  cwd=${process.cwd()}`);
      }
      resolve();
    });
  });

  return app;
}
