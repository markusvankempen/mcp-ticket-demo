import { TOOL_CATALOG } from "./create-server.js";
import { VERSION } from "./version.js";

const AUTH_MODE_COPY = {
  off: ["Open", "No credential needed. Every tool is callable by anyone who can reach the server."],
  write: ["Writes protected", "Read tools stay open. Write and PII tools need a key or a login with the right scope."],
  all: ["Locked", "Every tool call needs a credential. Discovery still works, so a client can see the tools and learn what to ask for."],
};

// ── Shared CSS ────────────────────────────────────────────────────────────────

const css = `
:root {
  --ink:#10252a; --muted:#557176; --paper:#f3f7f1; --cream:#fbfcf8;
  --green:#0d7a63; --green-dark:#075346; --lime:#c7e86b; --coral:#f07f61;
  --line:#cddbd3; --accent:#0d7a63; --amber:#e8990a;
}
* { box-sizing: border-box; }
body { margin:0; font: 15px/1.45 Manrope, -apple-system, Segoe UI, sans-serif; background: var(--paper); color: var(--ink); }

/* ── top nav ── */
.header { position: sticky; top: 0; z-index: 20; background: rgba(251,252,248,.96); border-bottom: 1px solid var(--line); backdrop-filter: blur(8px); }
.header-main { max-width: 1100px; margin: 0 auto; padding: 10px 20px 0; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.header h1 { font: 600 14px/1.2 ui-monospace, Menlo, monospace; color: var(--green); margin: 0; }
.header h1 span { color: var(--muted); font-weight: 400; }
.live { margin-left: auto; display: inline-flex; align-items: center; gap: 5px; font: 10px ui-monospace, Menlo, monospace; color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: 3px 9px; }
.version { font: 11px ui-monospace, Menlo, monospace; color: var(--muted); font-weight: normal; margin-left: 6px; }
.dot { width: 6px; height: 6px; border-radius: 50%; background: var(--coral); flex-shrink:0; }
.dot.on { background: var(--green); box-shadow: 0 0 5px var(--green); }
.nav-tabs { max-width: 1100px; margin: 0 auto; padding: 0 20px; display: flex; gap: 2px; overflow-x: auto; }
.nav-tabs::-webkit-scrollbar { display:none; }
.nav-tab { display: inline-flex; align-items: center; gap: 4px; padding: 8px 12px; color: var(--muted); text-decoration: none; font-size: 13px; border-bottom: 2px solid transparent; margin-bottom: -1px; white-space: nowrap; }
.nav-tab:hover { color: var(--ink); }
.nav-tab.active { color: var(--green); border-bottom-color: var(--green); font-weight: 600; }
.nav-tab .lock { font-size: 10px; opacity:.6; }

/* ── layout ── */
.main { max-width: 1100px; margin: 0 auto; padding: 20px 20px 80px; }
.eyebrow { color: var(--green); font: 500 11px ui-monospace, Menlo, monospace; letter-spacing: .08em; text-transform: uppercase; }
h2 { font-size: 30px; letter-spacing: -.04em; line-height: 1.05; margin: 6px 0 12px; }
h2 span { color: var(--green); }
h3 { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 20px 0 8px; }
.muted { color: var(--muted); }
p.muted { font-size: 13px; margin: 0 0 14px; }

/* ── stats ── */
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; margin: 14px 0; }
.stat { background: var(--cream); border: 1px solid var(--line); border-radius: 10px; padding: 10px 13px; }
.stat strong { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-bottom: 3px; }
.stat b { font: 600 17px ui-monospace, Menlo, monospace; }
.stat.warn b { color: var(--coral); }
.stat.ok b { color: var(--green); }

/* ── tags ── */
.tag { display: inline-block; background: var(--lime); color: var(--green-dark); border-radius: 999px; padding: 2px 9px; font: 500 11px ui-monospace, Menlo, monospace; }
.tag.coral { background: #fde8e2; color: #c0431a; border: 1px solid #f5c4b5; }
.tag.grey { background: var(--line); color: var(--muted); }
.tag.amber { background: #fef3cd; color: #7a5000; border: 1px solid #f0d080; }

/* ── tables ── */
.tbl-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid var(--line); margin: 8px 0; }
table { width: 100%; border-collapse: collapse; background: var(--cream); min-width: 400px; }
th, td { text-align: left; padding: 9px 11px; border-bottom: 1px solid var(--line); vertical-align: top; font-size: 13px; }
th { background: var(--green-dark); color: #fff; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; font-weight: 600; }
tr:last-child td { border-bottom: 0; }
tr.err-row td { background: #fff5f3; }
tr.err-row td:first-child { border-left: 3px solid var(--coral); }
td.mono { font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
td.ts { color: var(--muted); font-size: 11px; white-space: nowrap; font-family: ui-monospace, Menlo, monospace; }

/* ── in-page tabs ── */
.page-tabs { display: flex; gap: 0; border-bottom: 2px solid var(--line); margin: 0 0 18px; }
.page-tab { background: none; border: 0; padding: 9px 16px; font: inherit; font-size: 13px; color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; }
.page-tab:hover { color: var(--ink); }
.page-tab.active { color: var(--green); border-bottom-color: var(--green); font-weight: 600; }
.pane { display: none; }
.pane.active { display: block; }

/* ── search ── */
.search-row { display: flex; gap: 8px; margin-bottom: 10px; align-items: center; flex-wrap: wrap; }
.search-input { flex: 1 1 220px; padding: 8px 11px; border: 1px solid var(--line); border-radius: 8px; background: #fff; font: inherit; font-size: 13px; }
.search-input:focus { outline: none; border-color: var(--green); }
.search-count { font-size: 12px; color: var(--muted); white-space: nowrap; }
.no-results { padding: 14px 12px; color: var(--muted); font-size: 13px; font-style: italic; }

/* ── panels ── */
a { color: var(--green); }
button, input, select { font: inherit; }
input[type=text], input[type=number], input[type=password] { width: 100%; padding: 9px 11px; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
select { width: 100%; padding: 9px 11px; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
button { background: var(--green); color: #fff; border: 0; border-radius: 8px; padding: 8px 14px; cursor: pointer; font-size: 13px; }
button:hover { background: var(--green-dark); }
button.secondary { background: var(--cream); color: var(--ink); border: 1px solid var(--line); }
button.secondary:hover { border-color: var(--green); }
button.danger { background: #fff0ed; color: #c0431a; border: 1px solid #f5c4b5; }
.row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin: 12px 0; }
pre { background: var(--green-dark); color: #dff5d9; padding: 14px; border-radius: 10px; overflow: auto; font: 12px/1.5 ui-monospace, Menlo, monospace; margin: 8px 0; }
.checklist { list-style: none; padding: 0; display: grid; gap: 5px; }
.checklist li { padding: 8px 10px 8px 28px; background: var(--cream); border: 1px solid var(--line); border-radius: 7px; position: relative; font-size: 13px; }
.checklist li::before { content: "✓"; position: absolute; left: 10px; color: var(--green); font-weight: 700; }
.checklist li.fail { border-color: #f5c4b5; background: #fff5f3; }
.checklist li.fail::before { content: "✗"; color: var(--coral); }
.note { font-size: 12px; color: var(--muted); margin-top: 20px; }
.warn { color: #9a3b22; }
.panel { background: var(--cream); border: 1px solid var(--line); border-radius: 12px; padding: 14px 17px; margin: 10px 0; }
.panel-warning { border-color: #d97706; background: #fffbeb; }
.panel h4 { margin: 0 0 4px; font-size: 14px; }
.panel p { margin: 4px 0 10px; font-size: 13px; color: var(--muted); }
.grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; align-items: start; }
.modes { display: grid; gap: 7px; margin-bottom: 10px; }
.mode { display: flex; gap: 10px; align-items: flex-start; padding: 9px 11px; border: 1px solid var(--line); border-radius: 9px; background: #fff; cursor: pointer; }
.mode.on { border-color: var(--green); box-shadow: inset 3px 0 0 var(--green); }
.mode input[type=radio] { width: auto; margin: 3px 0 0; }
.mode b { display: block; font-size: 13px; }
.mode span { font-size: 12px; color: var(--muted); }
.field { display: grid; gap: 3px; font-size: 12px; color: var(--muted); }
.field-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-end; }
.field-row .field { flex: 1 1 130px; }
.scopes { display: flex; gap: 10px; flex-wrap: wrap; font-size: 13px; color: var(--ink); margin: 7px 0 10px; }
.scopes label { display: inline-flex; gap: 5px; align-items: center; }
.scopes input[type=checkbox] { width: auto; }
.secret { background: var(--green-dark); color: #dff5d9; border-radius: 9px; padding: 11px 13px; margin: 8px 0; }
.secret .value { display: block; font: 13px/1.5 ui-monospace, Menlo, monospace; word-break: break-all; margin: 7px 0; color: var(--lime); }
.secret .hint { display: block; font-size: 11px; opacity: .85; }
.secret code { font-family: ui-monospace, Menlo, monospace; color: var(--lime); }
.help-icon { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; font-size: 10px; font-weight: bold; border-radius: 50%; background: var(--line); color: var(--green-dark); text-decoration: none; margin-left: 4px; vertical-align: middle; }
.help-icon:hover { background: var(--green); color: #fff; }
.help-drawer { background: #eaf3ec; border: 1px solid var(--line); border-radius: 7px; padding: 9px 13px; margin: 8px 0 14px; font-size: 12px; display: none; line-height: 1.5; }
.help-drawer.open { display: block; }
.help-drawer strong { color: var(--green-dark); }
.footer-links { margin-top: 28px; padding-top: 14px; border-top: 1px solid var(--line); font-size: 12px; color: var(--muted); display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }

/* ── detail expand row ── */
.detail-row { display: none; }
.detail-row.open { display: table-row; }
.detail-cell { background: #fff5f3; padding: 10px 14px !important; }
.detail-cell pre { margin: 0; background: #2a0a06; color: #ffcfc5; font-size: 11px; border-radius: 6px; padding: 10px; max-height: 200px; }
.expand-btn { background: none; border: none; color: var(--coral); cursor: pointer; font-size: 11px; padding: 0; }
.expand-btn:hover { text-decoration: underline; }

/* ── curl block on test page ── */
.curl-block { position: relative; margin: 6px 0; }
.curl-block .copy-btn { position: absolute; top: 8px; right: 8px; background: rgba(13,122,99,.8); color: #fff; border: 0; border-radius: 5px; padding: 3px 8px; font-size: 11px; cursor: pointer; }
.curl-block .copy-btn:hover { background: var(--green); }
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

function helpToggle(id, summary, details, link) {
  return `<a class="help-icon" href="#help-${id}" onclick="document.getElementById('help-${id}').classList.toggle('open'); return false;" title="Help">?</a>
  <div id="help-${id}" class="help-drawer">
    <strong>${escapeHtml(summary)}</strong>
    <p>${details}</p>
    ${link ? `<a href="${link.url}" target="_blank" rel="noopener" style="font-size:12px;font-weight:500">${escapeHtml(link.text)} &rarr;</a>` : ""}
  </div>`;
}

/** Inline JS to drive in-page tabs. Injected once per page. */
const TAB_JS = `
<script>
function showPane(group, id) {
  document.querySelectorAll('[data-group="' + group + '"].pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('[data-group="' + group + '"].page-tab').forEach(t => t.classList.remove('active'));
  const p = document.getElementById(id);
  if (p) p.classList.add('active');
  const t = document.querySelector('[data-group="' + group + '"][data-target="' + id + '"]');
  if (t) t.classList.add('active');
}
function filterTable(inputId, tableId, countId) {
  const q = document.getElementById(inputId).value.toLowerCase();
  const tbody = document.querySelector('#' + tableId + ' tbody');
  if (!tbody) return;
  let shown = 0;
  tbody.querySelectorAll('tr:not(.detail-row)').forEach(row => {
    const match = row.textContent.toLowerCase().includes(q);
    row.style.display = match ? '' : 'none';
    if (match) shown++;
    // keep detail row synced
    const next = row.nextElementSibling;
    if (next && next.classList.contains('detail-row')) {
      next.style.display = match ? (next.classList.contains('open') ? '' : 'none') : 'none';
    }
  });
  const el = document.getElementById(countId);
  if (el) el.textContent = q ? shown + ' match' + (shown === 1 ? '' : 'es') : '';
}
function toggleDetail(btn, rowId) {
  const row = document.getElementById(rowId);
  if (!row) return;
  const open = row.classList.toggle('open');
  btn.textContent = open ? '▲ collapse' : '▼ detail';
}
function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'copied!';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  });
}
function copyFromData(btn) {
  copyText(btn.dataset.copy, btn);
}
// restore active tab from hash on load
window.addEventListener('DOMContentLoaded', () => {
  const h = location.hash.slice(1);
  if (h) {
    const t = document.querySelector('[data-target="' + h + '"]');
    if (t) { const g = t.dataset.group; if (g) showPane(g, h); }
  }
});
</script>`;

// ── Chrome (page shell) ───────────────────────────────────────────────────────

function chrome({ title, tab, liveOn, liveLabel, body, locked = false }) {
  const navTabs = [
    ["/health", "Health", false],
    ["/test", "Test", false],
    ["/admin", "Admin", true],
    ["/tools", "Tools", false],
    ["/log", "Log", true],
    ["/help", "Docs", false],
  ].map(([href, label, isLocked]) =>
    `<a class="nav-tab${tab === href ? " active" : ""}" href="${href}">${label}${isLocked ? ' <span class="lock">🔒</span>' : ""}</a>`
  ).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>${css}</style>
</head>
<body>
  <header class="header">
    <div class="header-main">
      <h1>mcp-ticket-demo <span>dashboard</span> <span class="version">v${VERSION}</span></h1>
      <span class="live"><span class="dot${liveOn ? " on" : ""}"></span>${escapeHtml(liveLabel || "http")}</span>
    </div>
    <nav class="nav-tabs">${navTabs}</nav>
  </header>
  <main class="main">${body}
    <div class="footer-links">
      <span><strong>MCP Demo</strong> · Markus van Kempen</span>
      <a href="https://markusvankempen.github.io/" target="_blank" rel="noopener">Website</a>
      <a href="https://events.linuxfoundation.org/mcp-dev-summit-toronto/program/schedule/?id=1282401" target="_blank" rel="noopener">Linux Foundation Talk</a>
      <a href="/help">Docs</a>
      <a href="mailto:markus.van.kempen@gmail.com">Contact</a>
    </div>
  </main>
  ${TAB_JS}
</body>
</html>`;
}

function stats(rows) {
  return `<div class="stats">${rows.map(([k, v, cls = ""]) =>
    `<div class="stat${cls ? " " + cls : ""}"><strong>${escapeHtml(k)}</strong><b>${escapeHtml(String(v))}</b></div>`
  ).join("")}</div>`;
}

function searchRow(inputId, tableId, placeholder = "Filter…") {
  return `<div class="search-row">
    <input class="search-input" id="${inputId}" type="text" placeholder="${escapeHtml(placeholder)}"
      oninput="filterTable('${inputId}','${tableId}','cnt-${inputId}')">
    <span class="search-count" id="cnt-${inputId}"></span>
  </div>`;
}

function pageTabs(group, tabs) {
  const btns = tabs.map(([id, label], i) =>
    `<button class="page-tab${i === 0 ? " active" : ""}" data-group="${group}" data-target="${id}"
      onclick="showPane('${group}','${id}'); location.hash='${id}'">${escapeHtml(label)}</button>`
  ).join("");
  return `<div class="page-tabs">${btns}</div>`;
}

function curlBlock(code) {
  const escaped = escapeHtml(code);
  // Store the raw text in a data attribute to avoid any quoting/escaping issues
  // in onclick. The copyText helper reads it from the element's dataset.
  return `<div class="curl-block"><pre>${escaped}</pre><button class="copy-btn" data-copy="${escapeHtml(code)}" onclick="copyFromData(this)">copy</button></div>`;
}

// ── Pages ─────────────────────────────────────────────────────────────────────

export function healthPage(info) {
  const authCls = info.security.authMode === "off" ? "ok" : "";
  return chrome({
    title: "health · mcp-ticket-demo",
    tab: "/health",
    liveOn: info.ok,
    liveLabel: info.ok ? "alive" : "down",
    body: `
      <div class="eyebrow">Alive?</div>
      <h2>Is it up?<br><span>${info.ok ? "Yes." : "No."}</span></h2>
      <p class="muted">A 200 means the process is running — not that a tool call will succeed. Open <a href="/test">Test</a> for that. ${helpToggle("health-info", "Understanding /health", "Returns process state, auth mode, and rate limit status. cwd is only included on localhost — not on a public host.", { text: "Docs", url: "/help#local" })}</p>
      ${stats([
        ["status", info.ok ? "alive" : "down", info.ok ? "ok" : "warn"],
        ["transport", info.transport],
        ["tools", info.tools],
        ["auth mode", info.security.authMode, authCls],
        ["api keys", info.security.activeKeyCount],
        ["rate limit", info.security.rateLimit?.enabled ? `${info.security.rateLimit.limit}/${Math.round(info.security.rateLimit.windowMs / 1000)}s` : "off"],
        ["tenant", info.security.tenantRequired ? "required" : "not set"],
        ...(info.cwd ? [["cwd", info.cwd]] : []),
      ])}
      <h3>Raw JSON ${helpToggle("health-raw", "JSON Payload", "Matches GET /health?format=json or Accept: application/json.", { text: "/health?format=json", url: "/health?format=json" })}</h3>
      <pre>${escapeHtml(JSON.stringify(info, null, 2))}</pre>
    `,
  });
}

export function testPage(result, host = "127.0.0.1:8787") {
  const base = `http://${host}`;
  const items = result.steps.map((s) =>
    `<li class="${s.ok ? "" : "fail"}"><strong>${escapeHtml(s.name)}</strong> — ${escapeHtml(s.detail)}</li>`
  ).join("");

  // helper so each block stays readable
  const mcp = (id, name, args) =>
    `curl -s -X POST '${base}/mcp' \\\n  -H 'Content-Type: application/json' \\\n  -H 'Accept: application/json, text/event-stream' \\\n  -d '{"jsonrpc":"2.0","id":${id},"method":"tools/call","params":{"name":"${name}","arguments":${JSON.stringify(args)}}}' | jq .`;

  const section = (title) => `<h4 style="margin:20px 0 6px;font-size:13px;color:var(--muted);border-bottom:1px solid var(--line);padding-bottom:4px">${title}</h4>`;

  const curlCmds = [
    section("Server endpoints"),
    curlBlock(`# Liveness — is the process alive?\ncurl -s '${base}/health?format=json' | jq .`),
    curlBlock(`# Smoke test — do tools actually work?\ncurl -s '${base}/test?format=json' | jq .`),

    section("Discovery"),
    curlBlock(`# List all tools (MCP protocol)\ncurl -s -X POST '${base}/mcp' \\\n  -H 'Content-Type: application/json' \\\n  -H 'Accept: application/json, text/event-stream' \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | jq .`),
    curlBlock(`# describe_server — auth mode, your scopes, rate limit, every tool\n${mcp(2, "describe_server", {})}`),

    section("Read tools"),
    curlBlock(`# search_tickets — open tickets (default)\n${mcp(3, "search_tickets", { status: "open", limit: 5 })}`),
    curlBlock(`# search_tickets — all statuses\n${mcp(4, "search_tickets", { status: "all", limit: 10 })}`),
    curlBlock(`# search_tickets — by requester email\n${mcp(5, "search_tickets", { requester_email: "ada@example.com", status: "all" })}`),
    curlBlock(`# search_tickets — keyword filter\n${mcp(6, "search_tickets", { query: "hostname", status: "all" })}`),
    curlBlock(`# get_ticket — fetch one ticket by id\n${mcp(7, "get_ticket", { ticket_id: "TCK-1001" })}`),

    section("Write tools"),
    curlBlock(`# create_ticket WITH requester_email (correct)\n${mcp(8, "create_ticket", { subject: "Test from curl", body: "Sent via terminal.", requester_email: "ada@example.com" })}`),
    curlBlock(`# create_ticket WITHOUT requester_email → attribution scar\n# 201 succeeds but service account owns the ticket\n${mcp(9, "create_ticket", { subject: "Scar demo", body: "No email — bot owns it." })}`),
    curlBlock(`# add_comment — comment on a known ticket\n${mcp(10, "add_comment", { ticket_id: "TCK-1001", body: "Confirmed from the terminal.", author: "support@example.com" })}`),
    curlBlock(`# close_ticket — resolve with a resolution note\n${mcp(11, "close_ticket", { ticket_id: "TCK-1001", resolution: "Fixed. Closing.", closed_by: "support@example.com" })}`),

    section("Schema discovery"),
    curlBlock(`# list_schemas — step 1: discover available schemas\n${mcp(12, "list_schemas", {})}`),
    curlBlock(`# get_schema — step 2: fields and filterable keys\n${mcp(13, "get_schema", { name: "tickets" })}`),
    curlBlock(`# run_query — step 3: query with discovered shape\n${mcp(14, "run_query", { schema: "tickets", filter: { status: "open" }, limit: 5 })}`),
    curlBlock(`# run_query — customers schema\n${mcp(15, "run_query", { schema: "customers", limit: 10 })}`),
    curlBlock(`# run_query — assets schema\n${mcp(16, "run_query", { schema: "assets", limit: 10 })}`),

    section("PII-gated tool"),
    curlBlock(`# lookup_customer — phone REDACTED without pii scope\n${mcp(17, "lookup_customer", { email: "ada@example.com" })}`),
    curlBlock(`# lookup_customer — with pii-scoped key (replace KEY)\ncurl -s -X POST '${base}/mcp' \\\n  -H 'Content-Type: application/json' \\\n  -H 'Accept: application/json, text/event-stream' \\\n  -H 'Authorization: Bearer mcpk_YOUR_PII_KEY' \\\n  -d '{"jsonrpc":"2.0","id":18,"method":"tools/call","params":{"name":"lookup_customer","arguments":{"email":"ada@example.com"}}}' | jq .`),

    section("Resources"),
    curlBlock(`# resources/list — enumerate all addressable resources\ncurl -s -X POST '${base}/mcp' \\\n  -H 'Content-Type: application/json' \\\n  -H 'Accept: application/json, text/event-stream' \\\n  -d '{"jsonrpc":"2.0","id":19,"method":"resources/list","params":{}}' | jq .`),
    curlBlock(`# resources/read — read one ticket by URI\ncurl -s -X POST '${base}/mcp' \\\n  -H 'Content-Type: application/json' \\\n  -H 'Accept: application/json, text/event-stream' \\\n  -d '{"jsonrpc":"2.0","id":20,"method":"resources/read","params":{"uri":"ticket://TCK-1001"}}' | jq .`),
    curlBlock(`# resources/read — live open ticket list\ncurl -s -X POST '${base}/mcp' \\\n  -H 'Content-Type: application/json' \\\n  -H 'Accept: application/json, text/event-stream' \\\n  -d '{"jsonrpc":"2.0","id":21,"method":"resources/read","params":{"uri":"tickets://open"}}' | jq .`),
    curlBlock(`# resources/read — schema shape\ncurl -s -X POST '${base}/mcp' \\\n  -H 'Content-Type: application/json' \\\n  -H 'Accept: application/json, text/event-stream' \\\n  -d '{"jsonrpc":"2.0","id":22,"method":"resources/read","params":{"uri":"schema://tickets"}}' | jq .`),

    section("Prompts"),
    curlBlock(`# prompts/list — enumerate MCP prompts\ncurl -s -X POST '${base}/mcp' \\\n  -H 'Content-Type: application/json' \\\n  -H 'Accept: application/json, text/event-stream' \\\n  -d '{"jsonrpc":"2.0","id":23,"method":"prompts/list","params":{}}' | jq .`),
    curlBlock(`# prompts/get — attribution-scar prompt\ncurl -s -X POST '${base}/mcp' \\\n  -H 'Content-Type: application/json' \\\n  -H 'Accept: application/json, text/event-stream' \\\n  -d '{"jsonrpc":"2.0","id":24,"method":"prompts/get","params":{"name":"attribution-scar"}}' | jq .`),

    section("Authenticated calls (auth mode: write or all)"),
    curlBlock(`# Set auth mode to write first:\n# curl -s -b cookie.txt -X POST '${base}/admin/security' \\\n#   -d 'authMode=write'\n\n# create_ticket with API key (replace KEY)\ncurl -s -X POST '${base}/mcp' \\\n  -H 'Content-Type: application/json' \\\n  -H 'Accept: application/json, text/event-stream' \\\n  -H 'Authorization: Bearer mcpk_YOUR_KEY' \\\n  -d '{"jsonrpc":"2.0","id":25,"method":"tools/call","params":{"name":"create_ticket","arguments":{"subject":"Authenticated","body":"Sent with a key.","requester_email":"ada@example.com"}}}' | jq .`),
    curlBlock(`# Denied call — no credential (shows actionable error)\ncurl -s -X POST '${base}/mcp' \\\n  -H 'Content-Type: application/json' \\\n  -H 'Accept: application/json, text/event-stream' \\\n  -d '{"jsonrpc":"2.0","id":26,"method":"tools/call","params":{"name":"create_ticket","arguments":{"subject":"Will fail","body":"No key.","requester_email":"ada@example.com"}}}' | jq .`),

    section("Naive mode demo (Demo 12)"),
    curlBlock(`# 1. Login and get session cookie\ncurl -s -c /tmp/mcp_cookies.txt -X POST '${base}/admin/login' \\\n  -d 'username=demo&password=demo'\n\n# 2. Set auth mode to write\ncurl -s -b /tmp/mcp_cookies.txt -X POST '${base}/admin/security' \\\n  -d 'authMode=write'\n\n# 3. Enable naive mode\ncurl -s -b /tmp/mcp_cookies.txt -X POST '${base}/admin/naive-mode' \\\n  -d 'enabled=1'\n\n# 4. Call create_ticket — observe bare 403\ncurl -s -X POST '${base}/mcp' \\\n  -H 'Content-Type: application/json' \\\n  -H 'Accept: application/json, text/event-stream' \\\n  -d '{"jsonrpc":"2.0","id":27,"method":"tools/call","params":{"name":"create_ticket","arguments":{"subject":"Naive test","body":"Bare 403.","requester_email":"ada@example.com"}}}' | jq .\n\n# 5. Disable naive mode — same call returns actionable error\ncurl -s -b /tmp/mcp_cookies.txt -X POST '${base}/admin/naive-mode' \\\n  -d 'enabled=0'\n\n# 6. Reset auth mode\ncurl -s -b /tmp/mcp_cookies.txt -X POST '${base}/admin/security' \\\n  -d 'authMode=off'`),
  ].join("");

  return chrome({
    title: "test · mcp-ticket-demo",
    tab: "/test",
    liveOn: result.ok,
    liveLabel: result.ok ? "smoke pass" : "smoke fail",
    body: `
      <div class="eyebrow">Works?</div>
      <h2>Does it really work?<br><span>${result.ok ? "Yes." : "Something failed."}</span></h2>
      ${pageTabs("test", [["tab-smoke", "Smoke test"], ["tab-curl", "curl commands"], ["tab-raw", "Raw JSON"]])}
      <div id="tab-smoke" class="pane active" data-group="test">
        <p class="muted">${result.writes ? "Write smoke (admin): create + close plus reads." : "Public read-only smoke against the in-memory store. Writes require <a href=\"/test?write=1\">/test?write=1</a> after signing in at /admin."} ${helpToggle("test-info", "Alive vs Working", "Health checks confirm the process is up. Public /test only reads. Create/close is admin-only so a public URL cannot mutate the store.", { text: "Docs", url: "/help#smoke" })}</p>
        <ul class="checklist">${items}</ul>
      </div>
      <div id="tab-curl" class="pane" data-group="test">
        <p class="muted">Copy and paste into any terminal. Server: <code>${escapeHtml(base)}</code></p>
        ${curlCmds}
      </div>
      <div id="tab-raw" class="pane" data-group="test">
        <p class="muted">Same payload as <a href="/test?format=json">/test?format=json</a>.</p>
        <pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre>
      </div>
    `,
  });
}

export function adminLoginPage(error) {
  return chrome({
    title: "admin · mcp-ticket-demo",
    tab: "/admin",
    liveOn: false,
    liveLabel: "signed out",
    locked: true,
    body: `
      <div class="eyebrow">Operable?</div>
      <h2>Admin.<br><span>Sign in.</span></h2>
      <p class="muted">Laptop default: <code>demo</code> / <code>demo</code>. On a public bind (<code>HOST=0.0.0.0</code>, container, Code Engine) set <code>ADMIN_PASSWORD</code> — the default is disabled. Cookies are <code>HttpOnly</code> and <code>Secure</code> on HTTPS.</p>
      ${error ? `<p class="warn">${escapeHtml(error)}</p>` : ""}
      <form method="post" action="/admin/login" style="max-width:340px">
        <p><label style="font-size:13px;color:var(--muted)">Username<br><input name="username" autocomplete="username"></label></p>
        <p><label style="font-size:13px;color:var(--muted)">Password<br><input name="password" type="password" autocomplete="current-password"></label></p>
        <button type="submit">Sign in</button>
      </form>
    `,
  });
}

// ── Admin sub-panels ──────────────────────────────────────────────────────────

function authModePanel(security) {
  const modes = (security.authModes || ["off", "write", "all"]).map((mode) => {
    const [title, detail] = AUTH_MODE_COPY[mode] || [mode, ""];
    const on = security.authMode === mode;
    return `<label class="mode${on ? " on" : ""}">
      <input type="radio" name="authMode" value="${mode}"${on ? " checked" : ""}>
      <span><b>${escapeHtml(title)}</b><span><code>${mode}</code> — ${escapeHtml(detail)}</span></span>
    </label>`;
  }).join("");

  const auditChecked = security.auditMode ? " checked" : "";
  const naiveChecked = security.naiveMode ? " checked" : "";

  return `<div class="panel">
    <h4>Auth mode ${helpToggle("admin-auth", "Auth modes", "<b>off</b>: open.<br><b>write</b>: read tools open; write/PII need scopes.<br><b>all</b>: every call needs credentials.", { text: "Security docs", url: "/help#security" })}</h4>
    <p>Controls which tool scopes require a credential.</p>
    <form method="post" action="/admin/security">
      <div class="modes">${modes}</div>
      <button type="submit">Apply mode</button>
    </form>
  </div>
  <div class="panel${security.naiveMode ? ' panel-warning' : ''}">
    <h4>🎭 Naive mode ${helpToggle("admin-naive", "Naive mode (demo)", "When <b>on</b>, anonymous denials on write/PII tools return a bare <code>{&quot;error&quot;:&quot;forbidden&quot;,&quot;status&quot;:403}</code> with no scope name and no <code>next</code> hint.<br><br>The model retries in a loop and eventually reports the server is unavailable.<br><br>Turn it <b>off</b> to switch to the hardened path — the model reads the scope, asks for a key, and succeeds.<br><br>Set auth mode to <b>write</b> or <b>all</b> first so denials actually trigger.", { text: "DEMO.md", url: "https://github.com/markusvankempen/mcp-ticket-demo/blob/main/docs/DEMO.md" })}</h4>
    <p>Demo toggle: <strong>on</strong> = bare 403, model loops &nbsp;·&nbsp; <strong>off</strong> = rich error, model asks for a key.</p>
    <form method="post" action="/admin/naive-mode">
      <div class="field-row" style="align-items:center">
        <label style="display:inline-flex;gap:6px;align-items:center;font-size:13px">
          <input type="checkbox" name="enabled" value="1"${naiveChecked} style="width:auto">
          Enable naive mode
        </label>
        <button type="submit"${security.naiveMode ? ' class="danger"' : ''}>Save</button>
      </div>
    </form>
    ${security.naiveMode ? '<p class="note" style="color:#b45309;margin-top:8px">⚠️ Naive mode is ON — write/PII tool denials return a bare 403. Turn this off after the demo.</p>' : ''}
  </div>
  <div class="panel">
    <h4>Audit mode ${helpToggle("admin-audit", "Audit / Call Trace", "When on, every tool call (success, error, denied) is recorded in the call trace on the <a href='/log#log-trace'>Log</a> page. There is a 200-entry ring buffer.", { text: "Log page", url: "/log" })}</h4>
    <p>Captures a full per-call trace visible on the <a href="/log#log-trace">Log → Trace tab</a>. Off by default — enable to debug or demo.</p>
    <form method="post" action="/admin/audit-mode">
      <div class="field-row" style="align-items:center">
        <label style="display:inline-flex;gap:6px;align-items:center;font-size:13px">
          <input type="checkbox" name="enabled" value="1"${auditChecked} style="width:auto">
          Enable call trace
        </label>
        <button type="submit">Save</button>
      </div>
    </form>
  </div>`;
}

function rateLimitPanel(security) {
  const rate = security.rateLimit || {};
  return `<div class="panel">
    <h4>Rate limit ${helpToggle("admin-rate", "Rate Limiting", "One fixed window per caller. Refused calls return seconds-to-wait so agents stop retrying.", { text: "Docs", url: "/help#security" })}</h4>
    <p>Per API key, per user, and one shared anonymous bucket.</p>
    <form method="post" action="/admin/rate-limit">
      <div class="field-row">
        <label class="field">Calls<input type="number" name="limit" min="1" value="${Number(rate.limit) || 60}"></label>
        <label class="field">Per (seconds)<input type="number" name="windowSeconds" min="1" value="${Math.round((Number(rate.windowMs) || 60000) / 1000)}"></label>
        <label class="field" style="flex:0 0 auto">Enabled<br><input type="checkbox" name="enabled" value="1"${rate.enabled ? " checked" : ""} style="width:auto;margin-top:6px"></label>
        <button type="submit">Save</button>
      </div>
    </form>
  </div>`;
}

function keysPanel(security, issuedKey) {
  const keys = security.apiKeys || [];
  const rows = keys.map((key) => {
    const status = key.active
      ? '<span class="tag">active</span>'
      : `<span class="tag coral">${key.revokedAt ? "revoked" : "expired"}</span>`;
    const revoke = key.active
      ? `<form method="post" action="/admin/keys/revoke" style="display:inline"><input type="hidden" name="id" value="${escapeHtml(key.id)}"><button class="secondary" type="submit" style="padding:4px 9px;font-size:12px">Revoke</button></form>`
      : '<span class="muted">—</span>';
    return `<tr>
      <td class="mono">${escapeHtml(key.prefix)}…<br><span class="muted" style="font-size:11px">${escapeHtml(key.label)}</span></td>
      <td>${key.scopes.map((s) => `<span class="tag grey">${escapeHtml(s)}</span>`).join(" ")}</td>
      <td>${status}${key.expiresAt ? `<br><span class="muted" style="font-size:11px">exp ${escapeHtml(key.expiresAt.slice(0, 10))}</span>` : ""}</td>
      <td class="mono">${key.calls}<br><span class="muted" style="font-size:11px">${key.lastUsedAt ? escapeHtml(key.lastUsedAt.slice(11, 19)) : "never"}</span></td>
      <td>${revoke}</td>
    </tr>`;
  }).join("");

  const secret = issuedKey
    ? `<div class="secret"><strong>Copy this now — the server only stores its hash.</strong>
        <span class="value">${escapeHtml(issuedKey.key)}</span>
        <span class="hint">HTTP: <code>Authorization: Bearer &lt;key&gt;</code> · stdio: <code>MCP_API_KEY</code></span>
      </div>`
    : "";

  return `<div>
    ${secret}
    <h3>Issue a new key</h3>
    <form method="post" action="/admin/keys">
      <div class="field-row">
        <label class="field">Label<input name="label" placeholder="my laptop key"></label>
        <label class="field" style="flex:0 0 130px">Expires (days)<input name="expiresInDays" type="number" min="0" placeholder="0 = never"></label>
      </div>
      <div class="scopes">
        ${(security.scopes || []).map((s) => `<label><input type="checkbox" name="scopes" value="${s}"${s === "read" ? " checked" : ""}>${s}</label>`).join("")}
      </div>
      <button type="submit">Create key</button>
    </form>
    <h3>Issued keys</h3>
    ${searchRow("keySearch", "keyTable", "Filter keys…")}
    <div class="tbl-wrap"><table id="keyTable"><thead><tr><th>Key</th><th>Scopes</th><th>Status</th><th>Calls</th><th></th></tr></thead>
    <tbody>${rows || '<tr><td colspan=5 class="muted">No keys yet.</td></tr>'}</tbody></table></div>
  </div>`;
}

function toolGatesPanel(security) {
  const gates = security.toolGates || {};
  const authOverrides = security.toolAuthOverrides || {};
  const defaultArgs = {
    describe_server: {}, search_tickets: { status: "open", limit: 5 },
    create_ticket: { subject: "Test ticket", body: "Sent from admin panel.", requester_email: "ada@example.com" },
    add_comment: { ticket_id: "TCK-1001", body: "A comment.", author: "support@example.com" },
    close_ticket: { ticket_id: "TCK-1001", resolution: "Fixed.", closed_by: "support@example.com" },
    get_ticket: { ticket_id: "TCK-1001" },
    list_schemas: {}, get_schema: { name: "tickets" },
    run_query: { schema: "tickets", filter: { status: "open" }, limit: 5 },
    lookup_customer: { email: "ada@example.com" },
  };
  const rows = Object.entries(gates).map(([name, enabled]) => {
    const locked = authOverrides[name] === true;
    const statusTag = enabled ? '<span class="tag">enabled</span>' : '<span class="tag coral">disabled</span>';
    const authTag = locked
      ? '<span class="tag amber">auth required</span>'
      : '<span class="tag grey">follows mode</span>';
    const gateBtn = enabled
      ? `<form method="post" action="/admin/tool-gate" style="display:inline"><input type="hidden" name="tool" value="${escapeHtml(name)}"><input type="hidden" name="enabled" value="0"><button class="secondary" type="submit" style="padding:4px 9px;font-size:12px">Disable</button></form>`
      : `<form method="post" action="/admin/tool-gate" style="display:inline"><input type="hidden" name="tool" value="${escapeHtml(name)}"><input type="hidden" name="enabled" value="1"><button type="submit" style="padding:4px 9px;font-size:12px">Enable</button></form>`;
    const authBtn = locked
      ? `<form method="post" action="/admin/tool-auth" style="display:inline"><input type="hidden" name="tool" value="${escapeHtml(name)}"><input type="hidden" name="requireAuth" value="0"><button class="secondary" type="submit" style="padding:4px 9px;font-size:12px">Remove lock</button></form>`
      : `<form method="post" action="/admin/tool-auth" style="display:inline"><input type="hidden" name="tool" value="${escapeHtml(name)}"><input type="hidden" name="requireAuth" value="1"><button class="danger" type="submit" style="padding:4px 9px;font-size:12px">Lock</button></form>`;
    const args = JSON.stringify(defaultArgs[name] || {}, null, 2);
    const tryBtn = `<button type="button" class="secondary" style="padding:4px 9px;font-size:12px" data-tool="${escapeHtml(name)}" data-args="${escapeHtml(args)}" onclick="openToolTryFromData(this)">▶ Try</button>`;
    return `<tr>
      <td class="mono">${escapeHtml(name)}</td>
      <td>${statusTag} ${gateBtn}</td>
      <td>${authTag} ${authBtn}</td>
      <td>${tryBtn}</td>
    </tr>`;
  }).join("") || "<tr><td colspan=4 class='muted'>No tools registered.</td></tr>";
  return `<div>
    <p class="muted" style="margin-bottom:10px">
      <strong>Disable</strong> removes a tool entirely (503 for any caller).<br>
      <strong>Lock</strong> forces that tool to require a credential, even when the global auth mode is <em>off</em>.
      Locked tools respect the tool's natural scope (<code>read</code>, <code>write</code>, or <code>pii</code>).
    </p>
    <p class="muted">Saving a gate or auth-mode change broadcasts <code>notifications/tools/list_changed</code> to connected SSE and Streamable HTTP sessions. Clients that opened a session (Cursor, Bob) refresh <code>tools/list</code> without a reload. One-shot <code>POST /mcp</code> calls (curl) have no session — they see the new list on the next request.</p>
    <div class="tbl-wrap"><table><thead><tr><th>Tool</th><th>Availability</th><th>Auth override</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    ${toolTryModal()}
  </div>`;
}

function labPanel() {
  return `<div>
    <p class="muted">Seed realistic tickets or fire scripted traffic to fill the <a href="/log">Log</a> page. Enable audit mode in the Security tab first to capture the full call trace.</p>
    <div class="grid2">
      <div class="panel">
        <h4>Generate data</h4>
        <p>Creates tickets with mixed statuses, emails, and comments. 20% omit <code>requester_email</code> to produce service-account scars.</p>
        <form method="post" action="/admin/generate-data">
          <div class="field-row">
            <label class="field">Tickets<input name="count" type="number" min="1" max="40" value="10"></label>
            <button type="submit">Generate</button>
          </div>
        </form>
      </div>
      <div class="panel">
        <h4>Generate traffic</h4>
        <p>Each round fires 6 calls: reads, writes, bad ticket IDs, invalid credentials, valid queries, and unknown schemas.</p>
        <form method="post" action="/admin/generate-traffic">
          <div class="field-row">
            <label class="field">Rounds<input name="rounds" type="number" min="1" max="20" value="5"></label>
            <button type="submit">Generate</button>
          </div>
        </form>
      </div>
    </div>
    <p class="note">After running, open <a href="/log">Log</a> to see counters, the error log, and the call trace.</p>

    <h3 style="margin-top:24px">Server process</h3>
    <p class="muted" style="font-size:12px;margin-bottom:10px">
      <strong>Restart</strong> re-execs the same Node process with the same env — in-memory tickets are lost and the seed is restored.
      Only works when the server was started with <code>node src/index.js</code> or <code>npx mcp-ticket-demo</code> directly (not inside a container or Code Engine).
      <strong>Stop</strong> exits the process entirely.
    </p>
    <div class="grid2">
      <div class="panel">
        <h4>↺ Restart server</h4>
        <p>Re-execs this process. Redirects to <a href="/health">/health</a> after 3 s. In-memory state is cleared.</p>
        <form method="post" action="/admin/server/restart" onsubmit="return confirm('Restart the server? In-memory tickets will be lost.')">
          <button type="submit">Restart</button>
        </form>
      </div>
      <div class="panel panel-warning">
        <h4>⏹ Stop server</h4>
        <p>Calls <code>process.exit(0)</code>. The process will not restart unless your terminal or process manager relaunches it.</p>
        <form method="post" action="/admin/server/stop" onsubmit="return confirm('Stop the server? It will not restart automatically.')">
          <button class="danger" type="submit">Stop</button>
        </form>
      </div>
    </div>
  </div>`;
}

function toolTryModal() {
  return `
    <div id="toolTryModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:200;align-items:center;justify-content:center">
      <div style="background:#fff;border-radius:12px;padding:24px 28px;width:min(540px,94vw);box-shadow:0 8px 32px rgba(0,0,0,.2);display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <h4 style="margin:0">▶ Try — <span id="tryToolName" style="font-weight:normal;color:var(--muted)"></span></h4>
          <button type="button" class="secondary" style="padding:2px 8px;font-size:13px" onclick="closeToolTry()">✕</button>
        </div>
        <label style="font-size:12px;color:var(--muted);display:block">Arguments (JSON)
          <textarea id="tryToolArgs" rows="6" style="width:100%;margin-top:4px;font-family:monospace;font-size:12px;border:1px solid var(--line);border-radius:6px;padding:8px;box-sizing:border-box;resize:vertical"></textarea>
        </label>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" class="secondary" onclick="closeToolTry()">Cancel</button>
          <button type="button" id="tryRunBtn" onclick="runToolTry()">Run</button>
        </div>
        <div id="tryResult" style="display:none">
          <div style="font-size:12px;color:var(--muted);margin-bottom:4px">Response</div>
          <pre id="tryResultPre" style="background:#f7f8fa;border:1px solid var(--line);border-radius:6px;padding:10px;font-size:12px;overflow:auto;max-height:300px;margin:0"></pre>
        </div>
      </div>
    </div>
    <script>
      var _tryTool = '';
      function openToolTry(name, argsJson) {
        _tryTool = name;
        document.getElementById('tryToolName').textContent = name;
        document.getElementById('tryToolArgs').value = argsJson;
        document.getElementById('tryResult').style.display = 'none';
        document.getElementById('tryResultPre').textContent = '';
        document.getElementById('toolTryModal').style.display = 'flex';
      }
      function openToolTryFromData(btn) {
        openToolTry(btn.dataset.tool, btn.dataset.args);
      }
      function closeToolTry() { document.getElementById('toolTryModal').style.display = 'none'; }
      document.getElementById('toolTryModal').addEventListener('click', function(e){ if(e.target===this) closeToolTry(); });
      async function runToolTry() {
        var btn = document.getElementById('tryRunBtn');
        btn.disabled = true; btn.textContent = '…';
        var args = {};
        try { args = JSON.parse(document.getElementById('tryToolArgs').value || '{}'); } catch(e) { alert('Invalid JSON: ' + e.message); btn.disabled=false; btn.textContent='Run'; return; }
        try {
          var resp = await fetch('/mcp', { method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream'}, body: JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:_tryTool,arguments:args}}) });
          var json = await resp.json();
          var resultDiv = document.getElementById('tryResult');
          document.getElementById('tryResultPre').textContent = JSON.stringify(json, null, 2);
          resultDiv.style.display = 'block';
          var w = window.open('', '_blank');
          if (w) { w.document.write('<html><head><title>' + _tryTool + ' result</title><style>body{font-family:monospace;font-size:13px;padding:20px;background:#f7f8fa;white-space:pre-wrap}</style></head><body>' + JSON.stringify(json, null, 2) + '</body></html>'); w.document.close(); }
        } catch(e) {
          document.getElementById('tryResultPre').textContent = 'Error: ' + e.message;
          document.getElementById('tryResult').style.display = 'block';
        }
        btn.disabled=false; btn.textContent='Run';
      }
    </script>`;
}

function usersPanel(security) {
  const rows = (security.users || []).map((u) =>
    `<tr><td class="mono">${escapeHtml(u.username)}</td><td>${u.scopes.map((s) => `<span class="tag grey">${escapeHtml(s)}</span>`).join(" ")}</td></tr>`
  ).join("") || "<tr><td colspan=2 class='muted'>No extra users. Set <code>MCP_USERS</code> env var.</td></tr>";
  return `<div>
    <p class="muted">Users come from the <code>MCP_USERS</code> environment variable — <code>"alice:secret:read,write"</code>. The admin login is always present with <code>admin</code> scope.</p>
    <div class="tbl-wrap"><table><thead><tr><th>Username</th><th>Scopes</th></tr></thead><tbody>${rows}</tbody></table></div>
    <h3 style="margin-top:24px">Create user session</h3>
    <p class="muted" style="font-size:12px">Create a temporary API key with specific scopes below, or add a persistent user by restarting with the <code>MCP_USERS</code> env var set.</p>
    <div class="panel" style="max-width:440px">
      <h4 style="margin:0 0 12px">Issue API key for a user</h4>
      <form method="post" action="/admin/keys" style="display:flex;flex-direction:column;gap:10px">
        <label class="field" style="display:block">Label / username
          <input name="label" placeholder="e.g. alice" style="width:100%;margin-top:4px">
        </label>
        <label class="field" style="display:block">Scopes (comma-separated)
          <input name="scopes" value="read,write" placeholder="read,write,pii,admin" style="width:100%;margin-top:4px">
        </label>
        <div style="text-align:right"><button type="submit">Create key</button></div>
      </form>
    </div>
    <p class="muted" style="font-size:11px;margin-top:12px">To add a durable username/password user, restart the server with:<br><code>MCP_USERS="alice:secret:read,write" MCP_MODE=http node src/index.js</code></p>
  </div>`;
}

export function adminPage({ security, store, adminUser, info, issuedKey }) {
  const [modeTitle] = AUTH_MODE_COPY[security.authMode] || ["custom"];
  const open = security.authMode === "off";
  const tickets = store.listTickets({ status: "all", limit: 10 });
  const audit = store.audit();
  const rate = security.rateLimit || {};

  const ticketRows = tickets.map((t) =>
    `<tr>
      <td class="mono">${escapeHtml(t.id)}</td>
      <td>${escapeHtml(t.subject)}</td>
      <td>${escapeHtml(t.requester_email)}</td>
      <td>${t.attribution === "service_account" ? '<span class="tag coral">service acct</span>' : '<span class="tag grey">customer</span>'}</td>
      <td><span class="tag${t.status === "open" ? "" : " grey"}">${escapeHtml(t.status)}</span></td>
      <td style="white-space:nowrap">
        <button class="secondary" style="padding:3px 8px;font-size:11px" onclick="openEdit('${escapeHtml(t.id)}','${escapeHtml(t.subject.replace(/'/g,"\\\'"))}','${escapeHtml(t.requester_email)}','${escapeHtml(t.status)}')">Edit</button>
        <form method="post" action="/admin/tickets/${escapeHtml(t.id)}/delete" style="display:inline" onsubmit="return confirm('Delete ${escapeHtml(t.id)}?')">
          <button class="danger" type="submit" style="padding:3px 8px;font-size:11px">Delete</button>
        </form>
      </td>
    </tr>`
  ).join("") || "<tr><td colspan=6 class='muted'>No tickets yet.</td></tr>";

  const auditRows = audit.map((a) =>
    `<tr><td class="ts">${escapeHtml(a.at.slice(11, 19))}</td><td class="mono">${escapeHtml(a.tool || "")}</td><td>${escapeHtml(a.principal || "—")}</td><td>${escapeHtml(a.outcome || a.ticket || a.email || "")}</td></tr>`
  ).join("") || "<tr><td colspan=4 class='muted'>No events yet.</td></tr>";

  return chrome({
    title: "admin · mcp-ticket-demo",
    tab: "/admin",
    liveOn: open,
    liveLabel: `auth ${security.authMode}`,
    locked: true,
    body: `
      <div class="eyebrow">🔒 Admin</div>
      <h2>Operate the server.<br><span>Signed in as ${escapeHtml(adminUser)}.</span></h2>
      <div class="row">
        <span class="tag ${open ? "" : "coral"}">${escapeHtml(modeTitle.toUpperCase())}</span>
        <span class="tag grey">${escapeHtml(info.transport)}</span>
        <span class="tag grey">${security.activeKeyCount} key${security.activeKeyCount === 1 ? "" : "s"}</span>
        <span class="tag grey">${rate.enabled ? `${rate.limit}/${Math.round((rate.windowMs || 0) / 1000)}s` : "no rate limit"}</span>
        <form method="post" action="/admin/logout" style="display:inline;margin-left:auto"><button class="secondary" type="submit">Sign out</button></form>
      </div>
      ${stats([
        ["auth mode", security.authMode, open ? "ok" : "warn"],
        ["denied calls", security.deniedCount, security.deniedCount > 0 ? "warn" : ""],
        ["active keys", security.activeKeyCount],
        ["tools", info.tools],
        ["hostname", info.hostname || "local"],
      ])}

      ${pageTabs("admin", [
        ["adm-security", "Security"],
        ["adm-keys", "API Keys"],
        ["adm-gates", "Tool Gates"],
        ["adm-lab", "Lab"],
        ["adm-data", "Data"],
        ["adm-users", "Users"],
      ])}

      <div id="adm-security" class="pane active" data-group="admin">
        <div class="grid2">${authModePanel(security)}${rateLimitPanel(security)}</div>
      </div>

      <div id="adm-keys" class="pane" data-group="admin">
        ${keysPanel(security, issuedKey)}
      </div>

      <div id="adm-gates" class="pane" data-group="admin">
        ${toolGatesPanel(security)}
      </div>

      <div id="adm-lab" class="pane" data-group="admin">
        ${labPanel()}
      </div>

      <div id="adm-data" class="pane" data-group="admin">

      <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
        <h3 style="margin:0">Tickets</h3>
        <button type="button" style="padding:4px 10px;font-size:12px" onclick="document.getElementById('createTicketModal').style.display='flex'">+ Create ticket</button>
        <form method="post" action="/admin/reset" style="margin-left:auto" onsubmit="return confirm('Factory reset? All tickets will be replaced with the 3 seed tickets and the counter resets to TCK-1004.')">
          <button class="danger" type="submit" style="padding:4px 10px;font-size:12px">🗑 Factory reset</button>
        </form>
      </div>

      <!-- create ticket modal -->
      <div id="createTicketModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:100;align-items:center;justify-content:center">
        <div style="background:#fff;border-radius:12px;padding:24px 28px;width:min(480px,92vw);box-shadow:0 8px 32px rgba(0,0,0,.2)">
          <h4 style="margin:0 0 14px">Create ticket</h4>
          <form method="post" action="/admin/tickets/create">
            <label class="field" style="display:block;margin-bottom:10px">Subject<input name="subject" placeholder="Short description" style="width:100%;margin-top:4px" required></label>
            <label class="field" style="display:block;margin-bottom:10px">Body<textarea name="body" rows="3" placeholder="What happened?" style="width:100%;margin-top:4px;border:1px solid var(--line);border-radius:6px;padding:6px 8px;font-size:13px;resize:vertical" required></textarea></label>
            <label class="field" style="display:block;margin-bottom:16px">Requester email<input name="requester_email" type="email" placeholder="customer@example.com (leave blank for attribution scar demo)" style="width:100%;margin-top:4px"></label>
            <div style="display:flex;gap:8px;justify-content:flex-end">
              <button type="button" class="secondary" onclick="document.getElementById('createTicketModal').style.display='none'">Cancel</button>
              <button type="submit">Create</button>
            </div>
          </form>
        </div>
      </div>
      <script>document.getElementById('createTicketModal').addEventListener('click',function(e){if(e.target===this)this.style.display='none'});</script>
        <p class="muted" style="margin-bottom:8px;font-size:12px">Showing last 10. Use <strong>Edit</strong> to change subject / requester / status. <strong>Delete</strong> removes permanently. Factory reset restores the 3 seed tickets.</p>
        ${searchRow("ticketSearch", "ticketTable", "Filter tickets…")}
        <div class="tbl-wrap"><table id="ticketTable"><thead><tr><th>Id</th><th>Subject</th><th>Requester</th><th>Attribution</th><th>Status</th><th></th></tr></thead>
        <tbody>${ticketRows}</tbody></table></div>

        <!-- edit modal -->
        <div id="editModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:100;align-items:center;justify-content:center">
          <div style="background:#fff;border-radius:12px;padding:24px 28px;width:min(480px,92vw);box-shadow:0 8px 32px rgba(0,0,0,.2)">
            <h4 style="margin:0 0 14px">Edit ticket <span id="editIdLabel" style="font-weight:normal;color:var(--muted)"></span></h4>
            <form method="post" id="editForm" action="">
              <label class="field" style="display:block;margin-bottom:10px">Subject<input name="subject" id="editSubject" style="width:100%;margin-top:4px"></label>
              <label class="field" style="display:block;margin-bottom:10px">Requester email<input name="requester_email" id="editEmail" style="width:100%;margin-top:4px"></label>
              <label class="field" style="display:block;margin-bottom:16px">Status
                <select name="status" id="editStatus" style="width:100%;margin-top:4px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;font-size:13px">
                  <option value="open">open</option>
                  <option value="pending">pending</option>
                  <option value="solved">solved</option>
                </select>
              </label>
              <div style="display:flex;gap:8px;justify-content:flex-end">
                <button type="button" class="secondary" onclick="closeEdit()">Cancel</button>
                <button type="submit">Save changes</button>
              </div>
            </form>
          </div>
        </div>
        <script>
          function openEdit(id, subject, email, status) {
            document.getElementById('editIdLabel').textContent = id;
            document.getElementById('editSubject').value = subject;
            document.getElementById('editEmail').value = email;
            document.getElementById('editStatus').value = status;
            document.getElementById('editForm').action = '/admin/tickets/' + id + '/edit';
            const m = document.getElementById('editModal');
            m.style.display = 'flex';
          }
          function closeEdit() { document.getElementById('editModal').style.display = 'none'; }
          document.getElementById('editModal').addEventListener('click', function(e){ if(e.target===this) closeEdit(); });
        </script>

        <h3>Audit trail</h3>
        ${searchRow("auditSearch", "auditTable", "Filter audit events…")}
        <div class="tbl-wrap"><table id="auditTable"><thead><tr><th>Time</th><th>Event</th><th>Caller</th><th>Detail</th></tr></thead>
        <tbody>${auditRows}</tbody></table></div>
      </div>

      <div id="adm-users" class="pane" data-group="admin">
        ${usersPanel(security)}
      </div>
    `,
  });
}

export function toolsPage(info) {
  const gated = info.security || {};
  const needsCredential = (scope) => {
    if (gated.authMode === "all") return true;
    if (gated.authMode === "write") return scope !== "read";
    return false;
  };
  const defaultArgs = {
    describe_server: {}, search_tickets: { status: "open", limit: 5 },
    create_ticket: { subject: "Test ticket", body: "Sent from /tools.", requester_email: "ada@example.com" },
    add_comment: { ticket_id: "TCK-1001", body: "A comment.", author: "support@example.com" },
    close_ticket: { ticket_id: "TCK-1001", resolution: "Fixed.", closed_by: "support@example.com" },
    get_ticket: { ticket_id: "TCK-1001" },
    list_schemas: {}, get_schema: { name: "tickets" },
    run_query: { schema: "tickets", filter: { status: "open" }, limit: 5 },
    lookup_customer: { email: "ada@example.com" },
  };
  const rows = TOOL_CATALOG.map(([name, scope, purpose]) => {
    const args = JSON.stringify(defaultArgs[name] || {}, null, 2);
    const tryBtn = `<button type="button" class="secondary" style="padding:3px 9px;font-size:12px" data-tool="${escapeHtml(name)}" data-args="${escapeHtml(args)}" onclick="openToolTryFromData(this)">▶ Try</button>`;
    return `<tr>
      <td class="mono">${escapeHtml(name)}</td>
      <td style="font-size:13px">${escapeHtml(purpose)}</td>
      <td><span class="tag${scope === "read" ? " grey" : scope === "pii" ? " amber" : " coral"}">${escapeHtml(scope)}</span></td>
      <td>${needsCredential(scope) ? '<span class="tag coral">credential required</span>' : '<span class="tag grey">open</span>'}</td>
      <td>${tryBtn}</td>
    </tr>`;
  }).join("");
  return chrome({
    title: "tools · mcp-ticket-demo",
    tab: "/tools",
    liveOn: true,
    liveLabel: `${info.tools} tools`,
    body: `
      <div class="eyebrow">What the model sees</div>
      <h2>${TOOL_CATALOG.length} tools.<br><span>No request(path, method).</span></h2>
      <p class="muted">Descriptions say <em>when</em> to use the tool. Auth mode on <a href="/admin">Admin</a> controls whether scopes are enforced. ${helpToggle("tools-info", "Tool calling architecture", "MCP exposes purposeful tools with rich schemas. Scopes are declared per tool; enforcement is a server-level switch.", { text: "Docs", url: "/help#tools" })}</p>
      ${searchRow("toolSearch", "toolTable", "Filter by name, scope, or description…")}
      <div class="tbl-wrap"><table id="toolTable"><thead><tr><th>Tool</th><th>When to use</th><th>Scope</th><th>Right now</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      ${toolTryModal()}
    `,
  });
}

export function logPage({ security, store }) {
  const audit = store.audit();
  const snap = security;
  const callTrace = snap.callTrace || [];
  const errorLog = snap.errorLog || [];
  const counters = snap.toolCounters || {};

  const errorCount = Object.values(counters).reduce((s, c) => s + c.error + c.denied, 0);
  const totalCalls = Object.values(counters).reduce((s, c) => s + c.success + c.error + c.denied, 0);

  // Counters tab
  const counterRows = Object.entries(counters).map(([name, c]) => {
    const total = c.success + c.error + c.denied;
    const errClass = (c.error + c.denied) > 0 ? " err-row" : "";
    return `<tr class="${errClass}">
      <td class="mono">${escapeHtml(name)}</td>
      <td style="color:var(--green)">${c.success}</td>
      <td style="color:${c.error > 0 ? "var(--coral)" : "var(--muted)"}">${c.error}</td>
      <td style="color:${c.denied > 0 ? "var(--amber)" : "var(--muted)"}">${c.denied}</td>
      <td>${total}</td>
    </tr>`;
  }).join("") || "<tr><td colspan=5 class='muted'>No calls recorded. Use the Lab panel to generate traffic.</td></tr>";

  // Error log tab with expandable detail
  const errRows = errorLog.map((e, i) => {
    const rowId = `err-detail-${i}`;
    const detail = escapeHtml(JSON.stringify(e, null, 2));
    return `<tr class="err-row" onclick="toggleDetail(this.querySelector('.expand-btn'), '${rowId}')">
      <td class="ts">${escapeHtml(e.at.slice(11, 19))}</td>
      <td class="mono">${escapeHtml(e.tool || "")}</td>
      <td>${escapeHtml(e.principal || "—")}</td>
      <td>${escapeHtml(String(e.error || "").slice(0, 120))}${(e.error || "").length > 120 ? "…" : ""}
        <button class="expand-btn" onclick="event.stopPropagation();toggleDetail(this,'${rowId}')">▼ detail</button>
      </td>
    </tr>
    <tr id="${rowId}" class="detail-row"><td colspan=4 class="detail-cell"><pre>${detail}</pre></td></tr>`;
  }).join("") || "<tr><td colspan=4 class='muted'>No errors yet. Run traffic with bad IDs to generate some.</td></tr>";

  // Call trace tab
  const traceRows = callTrace.map((a) =>
    `<tr class="${a.type !== "success" ? "err-row" : ""}">
      <td class="ts">${escapeHtml(a.at.slice(11, 19))}</td>
      <td><span class="tag${a.type === "success" ? " grey" : " coral"}">${escapeHtml(a.type || "")}</span></td>
      <td class="mono">${escapeHtml(a.tool || "")}</td>
      <td>${escapeHtml(a.principal || "—")}</td>
    </tr>`
  ).join("") || `<tr><td colspan=4 class='muted'>Audit mode is off — <a href='/admin#adm-security'>enable it in Admin → Security</a> to capture the full call trace.</td></tr>`;

  // Audit trail tab
  const auditRows = audit.map((a) =>
    `<tr><td class="ts">${escapeHtml(a.at.slice(11, 19))}</td><td class="mono">${escapeHtml(a.tool || "")}</td><td>${escapeHtml(a.principal || "—")}</td><td>${escapeHtml(a.outcome || a.ticket || a.email || "")}</td></tr>`
  ).join("") || "<tr><td colspan=4 class='muted'>No admin events yet.</td></tr>";

  return chrome({
    title: "log · mcp-ticket-demo",
    tab: "/log",
    liveOn: errorCount === 0,
    liveLabel: errorCount === 0 ? "no errors" : `${errorCount} error${errorCount === 1 ? "" : "s"}`,
    locked: true,
    body: `
      <div class="eyebrow">🔒 Observability</div>
      <h2>Activity Log.<br><span>Every call, counted and traced.</span></h2>
      ${stats([
        ["total calls", totalCalls],
        ["errors", Object.values(counters).reduce((s, c) => s + c.error, 0), Object.values(counters).some(c => c.error > 0) ? "warn" : ""],
        ["denied", Object.values(counters).reduce((s, c) => s + c.denied, 0), Object.values(counters).some(c => c.denied > 0) ? "warn" : ""],
        ["audit events", audit.length],
        ["trace entries", callTrace.length, callTrace.length === 0 ? "warn" : ""],
      ])}
      <p class="muted" style="margin-top:6px">Refresh the page to update. Enable audit mode in <a href="/admin#adm-security">Admin → Security</a> to populate the call trace.</p>

      ${pageTabs("log", [
        ["log-counters", "Counters"],
        ["log-errors", `Errors${errorLog.length > 0 ? " (" + errorLog.length + ")" : ""}`],
        ["log-trace", `Trace${callTrace.length > 0 ? " (" + callTrace.length + ")" : ""}`],
        ["log-audit", "Audit trail"],
      ])}

      <div id="log-counters" class="pane active" data-group="log">
        <p class="muted">Success / Error / Denied counts per tool since last restart. Red rows have errors or denials.</p>
        ${searchRow("cntSearch", "cntTable", "Filter by tool name…")}
        <div class="tbl-wrap"><table id="cntTable">
          <thead><tr><th>Tool</th><th style="color:#86efac">Success</th><th style="color:#fca5a5">Errors</th><th style="color:#fde68a">Denied</th><th>Total</th></tr></thead>
          <tbody>${counterRows}</tbody>
        </table></div>
      </div>

      <div id="log-errors" class="pane" data-group="log">
        <p class="muted">Bad parameters, missing ticket IDs, validation failures. Click a row to expand full detail. Red rows = recent errors.</p>
        ${searchRow("errSearch", "errTable", "Search tool, caller, or error text…")}
        <div class="tbl-wrap"><table id="errTable">
          <thead><tr><th>Time</th><th>Tool</th><th>Caller</th><th>Error</th></tr></thead>
          <tbody>${errRows}</tbody>
        </table></div>
      </div>

      <div id="log-trace" class="pane" data-group="log">
        <p class="muted">Full per-call trace — requires audit mode. Enable it in <a href="/admin#adm-security">Admin → Security → Rate limit panel</a>.</p>
        ${searchRow("traceSearch", "traceTable", "Filter by tool, type, or caller…")}
        <div class="tbl-wrap"><table id="traceTable">
          <thead><tr><th>Time</th><th>Result</th><th>Tool</th><th>Caller</th></tr></thead>
          <tbody>${traceRows}</tbody>
        </table></div>
      </div>

      <div id="log-audit" class="pane" data-group="log">
        <p class="muted">Admin-level events: logins, mode changes, key issuance and revocations, tool gate toggles.</p>
        ${searchRow("auditSearch2", "auditTable2", "Filter events…")}
        <div class="tbl-wrap"><table id="auditTable2">
          <thead><tr><th>Time</th><th>Event</th><th>Caller</th><th>Detail</th></tr></thead>
          <tbody>${auditRows}</tbody>
        </table></div>
      </div>
    `,
  });
}

export function helpPage(host = "127.0.0.1:8787") {
  const base = `http://${host}`;
  return chrome({
    title: "docs · mcp-ticket-demo",
    tab: "/help",
    liveOn: true,
    liveLabel: "documentation",
    body: `
      <div class="eyebrow">Documentation</div>
      <h2>Guides &amp; Reference.<br><span>How everything fits together.</span></h2>

      ${pageTabs("help", [
        ["help-start",    "Quick start"],
        ["help-demos",    "Demo flow"],
        ["help-security", "Security"],
        ["help-pages",    "Pages"],
        ["help-tools",    "Tools"],
        ["help-lessons",  "Lessons"],
      ])}

      <!-- ── Quick start ──────────────────────────────────────────────── -->
      <div id="help-start" class="pane active" data-group="help">
        <div class="panel" id="local">
          <h4>1. Two transports</h4>
          <p>stdio for IDEs (VS Code, Cursor, Bob, Windsurf) — no port, no URL, no browser. HTTP for the dashboard pages, the <code>/mcp</code> endpoint, and cloud deploys.</p>
          <pre>cd server && npm install
# HTTP — opens /health /test /admin /tools /log /help /mcp
MCP_MODE=http PORT=8787 node src/index.js   # default port
# stdio — what the IDE spawns as a child process
MCP_MODE=stdio node src/index.js</pre>
        </div>
        <div class="panel">
          <h4>2. Register with an IDE</h4>
          <p>Use the <strong>LF MCP Demo</strong> extension → <strong>Register server with all IDEs</strong>. It writes the correct config to VS Code, Cursor, Bob, and Windsurf simultaneously. Reload the window after.</p>
          <p>Or add manually to <code>.vscode/mcp.json</code>:</p>
          <pre>{
  "servers": {
    "mcp-ticket-demo": {
      "type": "stdio",
      "command": "npx",
      "args": ["mcp-ticket-demo"],
      "env": { "MCP_MODE": "stdio" }
    }
  }
}</pre>
          <p class="muted">Use <code>npx</code> — never hardcode an absolute path. An absolute path works on your laptop and silently returns 0 tools inside a container.</p>
        </div>
        <div class="panel">
          <h4>3. Verify</h4>
          <pre># Is it alive?
curl ${base}/health?format=json | jq .ok

# Do tools actually work?
curl ${base}/test?format=json | jq .ok

# First MCP call — discover the server
curl -s -X POST ${base}/mcp \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"describe_server","arguments":{}}}' \\
  | jq .result</pre>
        </div>
      </div>

      <!-- ── Demo flow ───────────────────────────────────────────────── -->
      <div id="help-demos" class="pane" data-group="help">
        <p class="muted" style="margin-bottom:12px">Each demo is a self-contained live exercise. Run them in order or jump to any one. All use the Chat tab in the extension or a direct curl command.</p>

        <div class="panel">
          <h4>Demo 1 — Health check: is it alive?</h4>
          <p>Open <a href="/health">/health</a> — or: <code>curl ${base}/health?format=json</code></p>
          <p class="muted">Lesson: <em>A 200 means the process is running, not that a tool call will succeed.</em></p>
        </div>

        <div class="panel">
          <h4>Demo 2 — Smoke test: does it actually work?</h4>
          <p>Open <a href="/test">/test</a> — or: <code>curl ${base}/test?format=json</code></p>
          <p class="muted">Lesson: <em>/test runs every read-only tool and scores the payloads, not just HTTP 200. Green /health + failing /test means the process started but tools don't work.</em></p>
        </div>

        <div class="panel">
          <h4>Demo 3 — Discover the server</h4>
          <p>Prompt: <em>"Call describe_server. Tell me the auth mode, my scopes, rate-limit budget, and which tools need a credential."</em></p>
          <p class="muted">Lesson: <em>describe_server is always open. A client that can't ask "what do you need from me?" can only guess — and guessing models retry in a loop.</em></p>
        </div>

        <div class="panel">
          <h4>Demo 4 — Search tickets</h4>
          <p>Prompt: <em>"Search open tickets, then tell me who owns each one."</em></p>
          <p class="muted">Lesson: <em>Intent-named tools vs request(path, method). The tool name says when to use it.</em></p>
        </div>

        <div class="panel">
          <h4>Demo 5A — Attribution scar (naive)</h4>
          <p>Prompt: <em>"Create a ticket with subject 'Need the remote URL' and body 'demo' — do not pass requester_email. Then tell me who owns it."</em></p>
          <p class="muted">Lesson: <em>201 is not done. The service account owns the ticket and every reply goes to the bot, not the customer.</em></p>
        </div>

        <div class="panel">
          <h4>Demo 5B — Attribution correct</h4>
          <p>Prompt: <em>"Create a ticket for ada@example.com about a missing hostname. Then search tickets owned by ada@example.com."</em></p>
          <p class="muted">Lesson: <em>A tool isn't done when the API call succeeds — it's done when the next thing that happens is right.</em></p>
        </div>

        <div class="panel">
          <h4>Demo 6 — Comment on a ticket</h4>
          <p>Prompt: <em>"Search open tickets, pick one, then add a comment as support@example.com explaining what you found."</em></p>
        </div>

        <div class="panel">
          <h4>Demo 7 — Close a ticket</h4>
          <p>Prompt: <em>"Search open tickets, pick one, then close_ticket with a short resolution note. Tell me the new status and resolved_at."</em></p>
          <p class="muted">Lesson: <em>close_ticket is idempotent — calling it twice returns alreadyClosed=true without error.</em></p>
        </div>

        <div class="panel">
          <h4>Demo 8 — Schema discovery</h4>
          <p>Prompt: <em>"List schemas, get the tickets schema, then run_query on tickets filtered to status=open."</em></p>
          <p class="muted">Lesson: <em>list_schemas → get_schema → run_query replaces seven near-identical query_* tools. The model discovers the shape; the server exposes one tool.</em></p>
        </div>

        <div class="panel">
          <h4>Demo 9 — PII gating</h4>
          <p>Prompt: <em>"Look up the customer record for ada@example.com. Is the phone number visible? Explain why or why not."</em></p>
          <p class="muted">Lesson: <em>Same tool, same endpoint — different scopes expose different fields.</em></p>
        </div>

        <div class="panel">
          <h4>Demo 10 — Auth modes</h4>
          <p>Set auth mode → <strong>write</strong> on <a href="/admin#adm-security">Admin → Security</a>. Then prompt: <em>"Call describe_server and tell me the current auth mode, which tools are locked, and what scope each write tool requires."</em></p>
          <p class="muted">Lesson: <em>MCP describes tools. It doesn't describe permissions. The server invents its own.</em></p>
        </div>

        <div class="panel">
          <h4>Demo 11 — The silent 0-tools failure</h4>
          <p>Edit your mcp.json to use a bad cwd: <code>"cwd": "/tmp/does-not-exist"</code>. Ask the model to search tickets.</p>
          <p class="muted">Lesson: <em>Node tries to resolve src/index.js relative to a path that doesn't exist. It exits. The MCP client reads an empty response and reports 0 tools — with no error, no warning, nothing in a log.</em></p>
        </div>

        <div class="panel${/* highlight the new demo */ ''}">
          <h4>Demo 12 — Naive mode: bare 403 vs rich error</h4>
          <ol style="margin:6px 0 8px;padding-left:20px;font-size:13px">
            <li>Set auth mode → <strong>write</strong> on <a href="/admin#adm-security">Admin → Security</a>.</li>
            <li>Enable <strong>🎭 Naive mode</strong> on the same page.</li>
            <li>Prompt: <em>"Create a ticket for ada@example.com about a missing hostname."</em> — watch the model retry on a bare 403.</li>
            <li>Turn naive mode <strong>off</strong>. Same prompt — the model reads the scope, asks for a key, succeeds in one turn.</li>
          </ol>
          <p class="muted">Lesson: <em>That one <code>next</code> field is the difference between a model that helps and a model that loops.</em></p>
        </div>
      </div>

      <!-- ── Security ────────────────────────────────────────────────── -->
      <div id="help-security" class="pane" data-group="help">
        <div class="panel">
          <h4>Auth modes</h4>
          <ul class="checklist">
            <li><strong>off</strong> — all tools open, no credential needed. Default for local exploration.</li>
            <li><strong>write</strong> — read tools open; <code>create_ticket</code>, <code>add_comment</code>, <code>close_ticket</code>, <code>lookup_customer</code> need a credential.</li>
            <li><strong>all</strong> — every tool call requires a credential. Discovery (<code>describe_server</code>) always remains open.</li>
          </ul>
          <p class="muted">Change on <a href="/admin#adm-security">Admin → Security</a>. Or boot with <code>AUTH_MODE=write npx mcp-ticket-demo</code>.</p>
        </div>
        <div class="panel">
          <h4>Scopes</h4>
          <ul class="checklist">
            <li><code>read</code> — all read tools.</li>
            <li><code>write</code> — implies read. Unlocks create_ticket, add_comment, close_ticket.</li>
            <li><code>pii</code> — implies read. Unredacts phone on lookup_customer.</li>
            <li><code>admin</code> — implies all. Key management, mode changes, gate toggles.</li>
          </ul>
          <p class="muted">Issue keys with specific scopes on <a href="/admin#adm-keys">Admin → API Keys</a>.</p>
        </div>
        <div class="panel">
          <h4>Passing credentials</h4>
          <pre># HTTP: Authorization header
curl -H 'Authorization: Bearer mcpk_...' ...

# HTTP: x-api-key header (alternative)
curl -H 'x-api-key: mcpk_...' ...

# stdio: environment variable
MCP_API_KEY=mcpk_... node src/index.js</pre>
        </div>
        <div class="panel">
          <h4>Per-tool gates &amp; auth locks</h4>
          <p><strong>Disable</strong> a tool on <a href="/admin#adm-gates">Admin → Tool Gates</a> — any caller gets 503 regardless of auth mode.</p>
          <p><strong>Lock</strong> a tool — forces that tool to require a credential even when global auth mode is <em>off</em>.</p>
          <p>Both changes broadcast <code>notifications/tools/list_changed</code> to connected sessions (Bob, Cursor). One-shot curl calls see the new list on the next request.</p>
        </div>
        <div class="panel">
          <h4>🎭 Naive mode</h4>
          <p>Demo toggle. When on, anonymous denials on write/PII tools return a bare <code>{"error":"forbidden","status":403}</code> with no scope name and no <code>next</code> hint. The model retries in a loop.</p>
          <p>Turn it off and the same denial becomes actionable — the model asks for a key in one turn. See <strong>Demo 12</strong> above.</p>
        </div>
      </div>

      <!-- ── Pages ───────────────────────────────────────────────────── -->
      <div id="help-pages" class="pane" data-group="help">
        <div class="panel">
          <h4>Pages and access</h4>
          <ul class="checklist">
            <li><a href="/health"><strong>/health</strong></a> — public. Process alive? auth mode? tool count? rate limit? <code>cwd</code> only on localhost.</li>
            <li><a href="/test"><strong>/test</strong></a> — public read-only smoke. <code>/test?write=1</code> creates and closes a ticket (requires admin sign-in).</li>
            <li><a href="/tools"><strong>/tools</strong></a> — public. Full tool inventory with current scope enforcement state.</li>
            <li><strong>/admin</strong> 🔒 — requires login (<code>demo</code>/<code>demo</code> on localhost). Auth mode, keys, tool gates, lab, ticket management, users.</li>
            <li><strong>/log</strong> 🔒 — requires login. Tool counters, error log (searchable, expandable), call trace when audit mode is on.</li>
            <li><strong>/mcp</strong> — Streamable HTTP MCP transport (JSON-RPC 2.0).</li>
            <li><strong>/sse</strong> — Legacy SSE MCP transport (Cursor mcp-proxy).</li>
            <li><a href="/help"><strong>/help</strong></a> — this page.</li>
          </ul>
        </div>
        <div class="panel">
          <h4>JSON format</h4>
          <p>Add <code>?format=json</code> to /health and /test for machine-readable output, or set <code>Accept: application/json</code>.</p>
          <pre>curl ${base}/health?format=json | jq .
curl ${base}/test?format=json | jq .ok</pre>
        </div>
      </div>

      <!-- ── Tools ───────────────────────────────────────────────────── -->
      <div id="help-tools" class="pane" data-group="help">
        <div class="panel">
          <h4>10 purpose-built tools — <a href="/tools" style="font-weight:normal;font-size:12px">see /tools for live auth state →</a></h4>
          <p>No <code>request(path, method)</code>. Each name is a verb + noun that says <em>when</em> to use it.</p>
          <ul class="checklist">
            <li><code>describe_server</code> <span class="tag grey" style="font-size:10px">read</span> — call first, and after any denial. Reports auth mode, your scopes, rate budget, and every tool.</li>
            <li><code>search_tickets</code> <span class="tag grey" style="font-size:10px">read</span> — find tickets by status, email, or keyword. Empty = no match, not a broken server.</li>
            <li><code>get_ticket</code> <span class="tag grey" style="font-size:10px">read</span> — fetch one ticket by id including comments and attribution.</li>
            <li><code>create_ticket</code> <span class="tag coral" style="font-size:10px">write</span> — <strong>always pass <code>requester_email</code></strong> or the service account owns it.</li>
            <li><code>add_comment</code> <span class="tag coral" style="font-size:10px">write</span> — comment on a known ticket id. Pass <code>author</code> or the comment is owned by the service account.</li>
            <li><code>close_ticket</code> <span class="tag coral" style="font-size:10px">write</span> — resolve a ticket. Idempotent — calling twice returns <code>alreadyClosed:true</code>.</li>
            <li><code>list_schemas</code> <span class="tag grey" style="font-size:10px">read</span> — step 1 of schema discovery. There is no <code>query_tickets</code> tool.</li>
            <li><code>get_schema</code> <span class="tag grey" style="font-size:10px">read</span> — fields and filterable keys for one schema.</li>
            <li><code>run_query</code> <span class="tag grey" style="font-size:10px">read</span> — the one query tool. Pass schema from list_schemas.</li>
            <li><code>lookup_customer</code> <span class="tag amber" style="font-size:10px">pii</span> — phone stays REDACTED without the <code>pii</code> scope.</li>
          </ul>
        </div>
        <div class="panel">
          <h4>Resources</h4>
          <ul class="checklist">
            <li><code>ticket://{id}</code> — one ticket by id. Same auth as get_ticket.</li>
            <li><code>tickets://open</code> — live open ticket list (top 25). Same auth as search_tickets.</li>
            <li><code>schema://{name}</code> — query schema shape. Same auth as get_schema.</li>
          </ul>
          <p class="muted">Call <code>resources/list</code> to browse — you don't need to know a URI ahead of time.</p>
        </div>
        <div class="panel">
          <h4>MCP Prompts</h4>
          <ul class="checklist">
            <li><code>search-open-tickets</code> — find scars in live data.</li>
            <li><code>attribution-scar</code> — create without requester_email, then explain what broke.</li>
            <li><code>schema-discovery</code> — list_schemas → get_schema → run_query walkthrough.</li>
            <li><code>close-ticket-flow</code> — add_comment then close_ticket in sequence.</li>
            <li><code>diagnose-server</code> — describe_server, auth mode, available tools.</li>
          </ul>
        </div>
      </div>

      <!-- ── Lessons ─────────────────────────────────────────────────── -->
      <div id="help-lessons" class="pane" data-group="help">
        <div class="panel">
          <h4>Lesson 1 — Tool naming is the interface</h4>
          <p><code>search_tickets</code> · <code>get_ticket</code> · <code>create_ticket</code> — each name says the action and the noun. Compare to the first draft: <code>query_tickets_by_status</code> / <code>query_tickets_by_requester</code> / <code>query_open_tickets</code>. Technically correct. Model picked wrong every other call.</p>
        </div>
        <div class="panel">
          <h4>Lesson 2 — The silent 0-tools failure</h4>
          <p><code>tools/list</code> returns 0 tools with no error when the server starts but the <code>cwd</code> is wrong or <code>MCP_MODE</code> is missing. Nothing fails. Nothing warns. The tool list is just empty. Use <code>npx</code> — never an absolute path.</p>
        </div>
        <div class="panel">
          <h4>Lesson 3 — The attribution scar</h4>
          <p><code>create_ticket</code> without <code>requester_email</code> returns HTTP 201. The ticket exists. The API call "succeeded." But the service account owns it and every reply goes to the bot, not the customer. <strong>A tool isn't done when the API call succeeds — it's done when the next thing that happens is right.</strong></p>
        </div>
        <div class="panel">
          <h4>Lesson 4 — Schema discovery over tool proliferation</h4>
          <p><code>list_schemas → get_schema → run_query</code> replaces <code>query_tickets</code> / <code>query_assets</code> / <code>query_with_filter</code> and every near-identical cousin. The model discovers the shape at runtime. The server exposes one tool.</p>
        </div>
        <div class="panel">
          <h4>Lesson 5 — The protocol doesn't say who is allowed to call it</h4>
          <p>MCP describes tools. It doesn't describe permissions. This server invents its own: off / write / all auth modes, scoped API keys, per-tool gates, and refusals that name the required scope and where to get one — so the model asks instead of looping.</p>
        </div>
        <div class="panel">
          <h4>Lesson 6 — Laptop paths don't survive a container boundary</h4>
          <p>Native stdio uses an absolute local <code>cwd</code>. Podman and Code Engine use the image — there is no local filesystem. The path that worked on your laptop is meaningless inside the container.</p>
        </div>
        <div class="panel">
          <h4>Lesson 7 — Error messages are part of the tool contract</h4>
          <p>A bare <code>403 Forbidden</code> makes the model retry in a loop and eventually tell the user the server is "unavailable." A refusal that names the required scope and where to get a key makes the model <em>ask</em> instead. See Demo 12 (Naive mode).</p>
        </div>
      </div>
    `,
  });
}
