import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer, TOOL_COUNT } from "./create-server.js";
import { adminLoginPage, adminPage, healthPage, testPage, toolsPage, logPage, helpPage } from "./pages.js";
import { generateData, generateTraffic } from "./traffic.js";

const COOKIE = "mcp_admin";

function cookieOf(req) {
  const header = req.headers.cookie || "";
  const part = header.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${COOKIE}=`));
  return part ? decodeURIComponent(part.slice(COOKIE.length + 1)) : "";
}

function setSession(res, id) {
  res.setHeader("Set-Cookie", `${COOKIE}=${encodeURIComponent(id)}; HttpOnly; SameSite=Lax; Path=/`);
}

function clearSession(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; Max-Age=0; Path=/`);
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

function publicInfo(store, security, req) {
  return {
    ok: true,
    service: "mcp-ticket-demo",
    version: "1.4.0",
    transport: "http",
    tools: TOOL_COUNT,
    cwd: process.cwd(),
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

function runSmoke(store) {
  const steps = [];
  const push = (name, ok, detail) => steps.push({ name, ok, detail });

  try {
    const listed = store.listTickets({ status: "open", limit: 5 });
    push("search_tickets", listed.length > 0, `${listed.length} open ticket(s)`);

    const { ticket, usedServiceAccount } = store.createTicket({
      subject: "Smoke test from /test",
      body: "Created with requester_email so the next thing that happens is right.",
      requester_email: "ada@example.com",
    });
    push("create_ticket with requester_email", ticket && !usedServiceAccount, `${ticket.id} owned by ${ticket.requester_email}`);

    const found = store.getTicket(ticket.id);
    push("get_ticket", Boolean(found), found ? found.id : "missing");

    const schemas = Object.keys(store.schemas);
    push("list_schemas", schemas.length === 3, schemas.join(", "));

    const query = store.runQuery({ schema: "tickets", filter: { status: "open" }, limit: 3 });
    push("run_query tickets", !query.error && query.count >= 1, query.error || `${query.count} row(s)`);
  } catch (error) {
    push("unexpected", false, error.message);
  }

  return { ok: steps.every((s) => s.ok), steps, at: new Date().toISOString() };
}

export async function startHttp({ store, security }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.urlencoded({ extended: true }));
  app.use("/admin", express.json());

  const sseSessions = new Map();
  // A freshly issued key is shown once on the next admin render, then forgotten.
  let pendingKey = null;

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
    const result = runSmoke(store);
    if ((req.headers.accept || "").includes("application/json") || req.query.format === "json") {
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

  app.get("/help", (_req, res) => {
    res.type("html").send(helpPage());
  });

  app.get("/admin", requireAdmin, (req, res) => {
    res.type("html").send(adminPage({
      security: security.snapshot(),
      store,
      adminUser: security.adminUser(),
      info: publicInfo(store, security, req),
      issuedKey: takePendingKey(),
    }));
  });

  app.get("/admin/api/status", requireAdmin, (req, res) => {
    res.json({
      ok: true,
      security: security.snapshot(),
      info: publicInfo(store, security, req),
      tickets: store.listTickets({ status: "all", limit: 10 }),
      audit: store.audit(),
    });
  });

  app.post("/admin/login", (req, res) => {
    const id = security.login(req.body.username, req.body.password);
    if (!id) {
      res.status(401).type("html").send(adminLoginPage("Wrong username or password."));
      return;
    }
    setSession(res, id);
    res.redirect("/admin");
  });

  app.post("/admin/logout", (req, res) => {
    security.logout(cookieOf(req));
    clearSession(res);
    res.redirect("/admin");
  });

  /** Set the auth mode: off | write | all. Also accepts the old writeToolsLocked boolean. */
  app.post("/admin/security", requireAdmin, (req, res) => {
    const mode = body(req, "authMode");
    if (mode) security.setAuthMode(mode);
    else security.setLocked(body(req, "writeToolsLocked") === "1" || req.body?.writeToolsLocked === true);
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

  app.post("/admin/tool-gate", requireAdmin, (req, res) => {
    const toolName = body(req, "tool");
    const enabled = body(req, "enabled") !== "0";
    security.setToolGate(toolName, enabled);
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

  app.post("/admin/keys/revoke", requireAdmin, (req, res) => {
    const ok = security.revokeKey(body(req, "id"));
    if (wantsJson(req)) {
      res.status(ok ? 200 : 404).json({ ok, security: security.snapshot() });
      return;
    }
    res.redirect("/admin");
  });

  // Legacy remote transport — what Cursor mcp-proxy and many enterprise clients still speak.
  app.get("/sse", async (req, res) => {
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
    const sessionId = String(req.query.sessionId || "");
    const session = sseSessions.get(sessionId);
    if (!session) {
      res.status(400).send("Unknown SSE session. Connect GET /sse first.");
      return;
    }
    await session.transport.handlePostMessage(req, res);
  });

  // Current remote transport — one endpoint, can upgrade to SSE.
  app.all("/mcp", express.json(), async (req, res) => {
    const requestHeaders = () => req.headers;
    const server = createMcpServer({ store, security, requestHeaders });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = Number(process.env.PORT || 8080);
  const host = process.env.HOST || "0.0.0.0";

  await new Promise((resolve) => {
    app.listen(port, host, () => {
      const snapshot = security.snapshot();
      console.error(`mcp-ticket-demo http on ${host}:${port}`);
      console.error(`  /health  /test  /admin  /tools  /sse  /mcp`);
      console.error(`  auth mode=${snapshot.authMode}  api keys=${snapshot.activeKeyCount}  rate limit=${snapshot.rateLimit.enabled ? `${snapshot.rateLimit.limit}/${Math.round(snapshot.rateLimit.windowMs / 1000)}s` : "off"}`);
      console.error(`  cwd=${process.cwd()}`);
      resolve();
    });
  });

  return app;
}
