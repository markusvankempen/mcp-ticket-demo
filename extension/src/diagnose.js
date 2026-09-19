const { discover, httpBase, settings, podmanHttpUrl, serverDir } = require("./config");
const podman = require("./podman");
const fs = require("fs");
const path = require("path");

function parseHttpBody(text) {
  const raw = String(text || "").trim();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { /* SSE or mixed */ }
  const dataLine = raw.split(/\r?\n/).find((l) => l.startsWith("data:"));
  if (dataLine) {
    try { return JSON.parse(dataLine.slice(5).trim()); } catch { /* ignore */ }
  }
  const brace = raw.split(/\r?\n/).find((l) => l.startsWith("{"));
  if (brace) {
    try { return JSON.parse(brace); } catch { /* ignore */ }
  }
  return { raw: raw.slice(0, 400) };
}

async function fetchJson(url, options = {}) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      ...options,
      headers: { Accept: "application/json, text/event-stream", ...(options.headers || {}) },
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, ms: Date.now() - started, body: parseHttpBody(text) };
  } catch (error) {
    return { ok: false, status: 0, ms: Date.now() - started, error: error.message };
  }
}

async function toolsList(base) {
  return fetchJson(`${base}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });
}

function parseToolNames(result) {
  const body = result.body;
  if (!body) return [];
  if (typeof body === "string") {
    const match = body.match(/"name":"([^"]+)"/g) || [];
    return match.map((m) => m.slice(8, -1));
  }
  const tools = body.result?.tools || body.tools || [];
  return tools.map((t) => t.name).filter(Boolean);
}

async function searchCall(base) {
  return fetchJson(`${base}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "search_tickets", arguments: { status: "open", limit: 3 } },
    }),
  });
}

async function npmVersionCheck() {
  const pkgFile = path.join(serverDir(), "package.json");
  let localVersion = null;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));
    localVersion = pkg.version || null;
  } catch {
    // file not found or unreadable — handled below
  }

  if (!localVersion) {
    return {
      name: "npm version (mcp-ticket-demo)",
      ok: false,
      detail: "Cannot read local server/package.json version.",
      next: "Make sure the server folder is present (run 'Install bundled server' or clone the repo).",
    };
  }

  const npm = await fetchJson("https://registry.npmjs.org/mcp-ticket-demo/latest");
  if (!npm.ok || typeof npm.body !== "object" || !npm.body.version) {
    return {
      name: "npm version (mcp-ticket-demo)",
      ok: true, // network is optional — don't fail the whole run
      detail: `Local ${localVersion} · npmjs check failed (${npm.error || npm.status})`,
    };
  }

  const latestVersion = npm.body.version;
  const isUpToDate = localVersion === latestVersion || semverGte(localVersion, latestVersion);
  return {
    name: "npm version (mcp-ticket-demo)",
    ok: isUpToDate,
    detail: isUpToDate
      ? `Local ${localVersion} is up to date (npm latest: ${latestVersion})`
      : `Local ${localVersion} · npm latest: ${latestVersion} — newer version available`,
    next: isUpToDate
      ? undefined
      : `Run 'npm install -g mcp-ticket-demo@latest' or pull the latest code from https://github.com/markusvankempen/mcp-ticket-demo and re-run 'cd server && npm install'.`,
  };
}

/** Simple semver ≥ comparison (no pre-release needed here). */
function semverGte(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return true;
}

async function runDiagnostics() {
  const info = discover();
  const base = httpBase();
  const steps = [];

  steps.push({
    name: "Workspace",
    ok: Boolean(info.workspace),
    detail: info.workspace || "Open the MCP-SummitToronto folder first.",
    next: info.workspace ? undefined : "File → Open Folder on this repo.",
  });

  steps.push({
    name: "Server package",
    ok: info.serverEntryExists,
    detail: info.serverEntry,
    next: info.serverEntryExists ? undefined : "The server lives at server/src/index.js. Open the mcp-ticket-demo repo root, or re-clone the repo.",
  });

  steps.push({
    name: "Server dependencies",
    ok: info.serverDependenciesInstalled,
    detail: info.serverDependenciesInstalled ? "node_modules installed in server/" : "Missing server/node_modules",
    next: info.serverDependenciesInstalled ? undefined : "Run 'cd server && npm install' to install server dependencies (@modelcontextprotocol/sdk, express, zod).",
  });

  steps.push({
    name: "Native stdio (node, no Docker)",
    ok: info.vscode.hasServer || info.cursor.hasServer || info.bob.hasServer || info.windsurf.hasServer,
    detail: `.vscode ${info.vscode.hasServer ? "yes" : "no"} · .cursor ${info.cursor.hasServer ? "yes" : "no"} · .bob ${info.bob.hasServer ? "yes" : "no"} · .windsurf ${info.windsurf.hasServer ? "yes" : "no"}`,
    next: (info.vscode.hasServer || info.cursor.hasServer || info.bob.hasServer || info.windsurf.hasServer) ? undefined : "Run Connect native stdio. That writes mcp-ticket-demo as a Node child process into client MCP configs.",
  });

  steps.push({
    name: "Client MCP config (.mcp.json)",
    ok: info.bob.exists || info.vscode.exists || info.cursor.exists || info.windsurf.exists,
    detail: [
      info.bob.exists ? info.bob.file : null,
      info.vscode.exists ? info.vscode.file : null,
      info.cursor.exists ? info.cursor.file : null,
      info.windsurf.exists ? info.windsurf.file : null,
    ].filter(Boolean).join(" · ") || "Not written yet",
    next: (info.bob.exists || info.vscode.exists || info.cursor.exists || info.windsurf.exists) ? undefined : "Run Connect native stdio to generate client MCP config files.",
  });

  const needPodman = settings().probeTarget === "podman";
  const hasPodman = info.vscode.hasPodman || info.cursor.hasPodman || info.bob.hasPodman || info.windsurf.hasPodman;
  steps.push({
    name: "Podman MCP config",
    ok: hasPodman || !needPodman,
    detail: `.vscode ${info.vscode.hasPodman ? "yes" : "no"} · .cursor ${info.cursor.hasPodman ? "yes" : "no"} · .bob ${info.bob.hasPodman ? "yes" : "no"} · .windsurf ${info.windsurf.hasPodman ? "yes" : "no"}`,
    next: hasPodman || !needPodman ? undefined : "Connect Podman stdio or Connect Podman HTTP after the image is built.",
  });

  const runtime = await podman.status();
  steps.push({
    name: "Local Podman",
    ok: runtime.ok || !needPodman,
    detail: runtime.ok ? `${runtime.version} · ${runtime.detail}` : (runtime.detail || runtime.error),
    next: runtime.ok || !needPodman ? undefined : runtime.next,
  });

  if (runtime.ok) {
    steps.push({
      name: "Podman container",
      ok: runtime.running || !needPodman,
      detail: `${runtime.container} · ${runtime.status} · host port ${runtime.port} → ${podmanHttpUrl()}`,
      next: runtime.running || !needPodman ? undefined : "Run Start local Podman. Same image as Code Engine; /health is on the mapped port.",
    });
  }

  const health = await fetchJson(`${base}/health?format=json`);
  steps.push({
    name: "GET /health",
    ok: health.ok,
    detail: health.ok ? `${base} · ${health.status} · ${health.ms}ms · cwd=${health.body?.cwd || "?"}` : (health.error || `${base} → ${health.status}`),
    next: health.ok ? undefined : `Start the local HTTP server (${settings().localHttpUrl}) via 'Start native HTTP' or 'cd server && npm run http', or set summitMcp.remoteUrl to the Code Engine URL. Ensure 'cd server && npm install' was run.`,
    raw: health.body,
  });

  const test = await fetchJson(`${base}/test?format=json`);
  steps.push({
    name: "GET /test",
    ok: Boolean(test.ok && test.body?.ok),
    detail: test.ok ? `${(test.body?.steps || []).filter((s) => s.ok).length} steps passed` : (test.error || String(test.status)),
    next: test.ok ? undefined : "/health can be green while /test fails. Alive is not the same as works.",
    raw: test.body,
  });

  const listed = await toolsList(base);
  const names = parseToolNames(listed);
  steps.push({
    name: "tools/list",
    ok: names.length > 0,
    detail: names.length ? `${names.length} tools: ${names.join(", ")}` : "0 tools discovered",
    next: names.length ? undefined : "Empty tools/list is the silent failure from the talk. Check cwd, MCP_MODE=http, and that you did not hand a laptop path to a container.",
    raw: listed.body,
  });

  const call = await searchCall(base);
  const callText = typeof call.body === "string" ? call.body : JSON.stringify(call.body || {});
  steps.push({
    name: "search_tickets",
    ok: call.ok && /TCK-/.test(callText),
    detail: call.ok ? "Real call, real ticket ids" : (call.error || "call failed"),
    next: call.ok ? undefined : "If tools/list worked but the call failed, read the tool error — it is phrased as a next action.",
  });

  const npmStep = await npmVersionCheck();
  steps.push(npmStep);

  return { ok: steps.every((s) => s.ok), base, settings: settings(), steps, discovered: info };
}

async function mcpCall(base, toolName, args, auth) {
  const headers = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
  if (auth) headers.Authorization = `Bearer ${auth}`;
  return fetchJson(`${base}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name: toolName, arguments: args } }),
  });
}

function extractContent(result) {
  const body = result.body;
  if (!body) return "";
  if (typeof body === "string") return body;
  if (body.raw) return String(body.raw);
  const content = body.result?.content || body.content || [];
  if (Array.isArray(content)) return content.map((c) => c.text || "").join("\n");
  return JSON.stringify(body);
}

/** Tool JSON from content[], plus isError / RPC error. HTTP 200 is not success. */
function toolResult(result) {
  const body = result.body;
  if (!result.ok) {
    return { ok: false, error: result.error || `HTTP ${result.status}`, payload: null, text: "" };
  }
  if (!body || typeof body === "string") {
    const text = String(body || "");
    try {
      const payload = JSON.parse(text);
      return { ok: payload?.ok === true, payload, text, error: payload?.error };
    } catch {
      return { ok: false, payload: null, text, error: text.slice(0, 160) };
    }
  }
  if (body.error) {
    const data = body.error.data && typeof body.error.data === "object" ? body.error.data : {};
    return {
      ok: false,
      payload: data,
      text: body.error.message || "",
      error: data.error || body.error.message || "MCP error",
    };
  }
  const text = extractContent(result);
  let payload = null;
  try { payload = JSON.parse(text); } catch { /* not JSON */ }
  const isError = body.result?.isError === true;
  return {
    ok: !isError && payload?.ok === true,
    payload,
    text,
    error: payload?.error || (isError ? "tool returned isError" : undefined),
  };
}

async function runMcpCrud() {
  const base = httpBase();
  const auth = settings().apiKey || undefined;
  const steps = [];

  // 1. search_tickets — read (baseline)
  const list = await mcpCall(base, "search_tickets", { status: "open", limit: 3 }, auth);
  const listed = toolResult(list);
  const listedIds = (listed.text.match(/TCK-\d+/g) || []);
  steps.push({
    name: "search_tickets (read)",
    ok: listed.ok && listedIds.length > 0,
    detail: listed.ok ? `Found tickets: ${listedIds.join(", ") || "none"}` : (listed.error || `HTTP ${list.status}`),
    next: listed.ok ? undefined : `Start the HTTP server first (Start native HTTP). Probe: ${base}`,
  });

  // 2. create_ticket
  const created = toolResult(await mcpCall(base, "create_ticket", {
    subject: "MCP CRUD test ticket",
    body: "Created by the MCP CRUD test in the extension.",
    requester_email: "markus.van.kempen@gmail.com",
  }, auth));
  const ticketId = created.payload?.ticket?.id || (created.text.match(/TCK-\d+/) || [])[0] || null;
  steps.push({
    name: "create_ticket",
    ok: created.ok && Boolean(ticketId),
    detail: ticketId ? `Created ${ticketId}` : (created.error || created.text.slice(0, 120) || "create_ticket failed"),
    next: created.ok ? undefined : "If auth mode is write or all, set summitMcp.apiKey in Settings with a key that has write scope.",
  });

  if (!ticketId) {
    steps.push({ name: "get_ticket", ok: false, detail: "Skipped — create_ticket failed." });
    steps.push({ name: "add_comment", ok: false, detail: "Skipped — create_ticket failed." });
    steps.push({ name: "close_ticket", ok: false, detail: "Skipped — create_ticket failed." });
    steps.push({ name: "search_tickets finds ticket", ok: false, detail: "Skipped — create_ticket failed." });
    return { ok: false, steps, base };
  }

  // 3. get_ticket — read back what we just created
  const got = toolResult(await mcpCall(base, "get_ticket", { ticket_id: ticketId }, auth));
  steps.push({
    name: `get_ticket (${ticketId})`,
    ok: got.ok && got.payload?.ticket?.id === ticketId,
    detail: got.ok ? `Retrieved — subject: ${got.payload?.ticket?.subject || "ok"}` : (got.error || "get_ticket failed"),
  });

  // 4. add_comment
  const commented = toolResult(await mcpCall(base, "add_comment", {
    ticket_id: ticketId,
    body: "MCP CRUD test comment.",
    author: "markus.van.kempen@gmail.com",
  }, auth));
  const commentCount = commented.payload?.ticket?.comments?.length;
  steps.push({
    name: `add_comment (${ticketId})`,
    ok: commented.ok && commented.payload?.ticket?.id === ticketId,
    detail: commented.ok ? `Comment added${commentCount ? ` (${commentCount} on ticket)` : ""}` : (commented.error || "add_comment failed"),
    next: commented.ok ? undefined : "add_comment needs write scope. Check summitMcp.apiKey.",
  });

  // 5. close_ticket — ticket is now solved, so later search must use status=all
  const closed = toolResult(await mcpCall(base, "close_ticket", {
    ticket_id: ticketId,
    resolution: "Resolved by MCP CRUD test.",
    closed_by: "markus.van.kempen@gmail.com",
  }, auth));
  steps.push({
    name: `close_ticket (${ticketId})`,
    ok: closed.ok && closed.payload?.ticket?.status === "solved",
    detail: closed.ok
      ? `Closed — status: ${closed.payload?.ticket?.status}${closed.payload?.alreadyClosed ? " (already closed)" : ""}`
      : (closed.error || "close_ticket failed"),
    next: closed.ok ? undefined : "close_ticket needs write scope. Check summitMcp.apiKey.",
  });

  // 6. find the ticket we created — it is solved, so status=open will miss it
  const search = toolResult(await mcpCall(base, "search_tickets", { status: "all", query: "MCP CRUD test ticket", limit: 25 }, auth));
  const found = Boolean(search.payload?.tickets?.some((t) => t.id === ticketId) || search.text.includes(ticketId));
  steps.push({
    name: `search_tickets finds ${ticketId}`,
    ok: search.ok && found,
    detail: search.ok
      ? (found ? "Found in results (status=all)" : "Not in results")
      : (search.error || "search_tickets failed"),
  });

  return { ok: steps.every((s) => s.ok), steps, base };
}

module.exports = { runDiagnostics, runMcpCrud, fetchJson };
