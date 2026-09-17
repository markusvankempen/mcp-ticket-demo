const { discover, httpBase, settings, podmanHttpUrl } = require("./config");
const podman = require("./podman");

async function fetchJson(url, options = {}) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      ...options,
      headers: { Accept: "application/json", ...(options.headers || {}) },
    });
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text.slice(0, 400); }
    return { ok: res.ok, status: res.status, ms: Date.now() - started, body };
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
    next: info.serverEntryExists ? undefined : "The server lives at mcp-ticket-demo/server/src/index.js. You are in the wrong folder, or the demo was not cloned.",
  });

  steps.push({
    name: "Native stdio (node, no Docker)",
    ok: info.vscode.hasServer || info.cursor.hasServer || info.bob.hasServer,
    detail: `VS Code ${info.vscode.hasServer ? "yes" : "no"} · Cursor ${info.cursor.hasServer ? "yes" : "no"} · Bob ${info.bob.hasServer ? "yes" : "no"}`,
    next: (info.vscode.hasServer || info.cursor.hasServer || info.bob.hasServer) ? undefined : "Run Connect native stdio. That writes mcp-ticket-demo as a Node child process.",
  });

  steps.push({
    name: "Discover .bob/mcp.json",
    ok: info.bob.exists,
    detail: info.bob.exists ? info.bob.file : "Not written yet",
    next: info.bob.exists ? undefined : "Run Connect native stdio so IBM Bob gets a project MCP file.",
  });

  const needPodman = settings().probeTarget === "podman";
  const hasPodman = info.vscode.hasPodman || info.cursor.hasPodman || info.bob.hasPodman;
  steps.push({
    name: "Podman MCP config",
    ok: hasPodman || !needPodman,
    detail: `VS Code ${info.vscode.hasPodman ? "yes" : "no"} · Cursor ${info.cursor.hasPodman ? "yes" : "no"} · Bob ${info.bob.hasPodman ? "yes" : "no"}`,
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
    next: health.ok ? undefined : `Start the local HTTP server (port ${settings().localHttpUrl}) or set summitMcp.remoteUrl to the Code Engine URL. A missing file in the cloud reads as 0 tools, not a connection error.`,
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

  return { ok: steps.every((s) => s.ok), base, settings: settings(), steps, discovered: info };
}

module.exports = { runDiagnostics, fetchJson };
