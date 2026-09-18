import { TOOL_CATALOG } from "./create-server.js";

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
      <h1>mcp-ticket-demo <span>dashboard</span></h1>
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
  const raw = code.replace(/'/g, "\\'").replace(/\n/g, "\\n");
  return `<div class="curl-block"><pre>${escaped}</pre><button class="copy-btn" onclick="copyText('${raw}',this)">copy</button></div>`;
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
      <p class="muted">A 200 means the process is running — not that a tool call will succeed. Open <a href="/test">Test</a> for that. ${helpToggle("health-info", "Understanding /health", "Returns process state, cwd, auth mode, and rate limit status. Designed for uptime probes.", { text: "Docs", url: "/help#local" })}</p>
      ${stats([
        ["status", info.ok ? "alive" : "down", info.ok ? "ok" : "warn"],
        ["transport", info.transport],
        ["tools", info.tools],
        ["auth mode", info.security.authMode, authCls],
        ["api keys", info.security.activeKeyCount],
        ["rate limit", info.security.rateLimit?.enabled ? `${info.security.rateLimit.limit}/${Math.round(info.security.rateLimit.windowMs / 1000)}s` : "off"],
        ["tenant", info.security.tenantRequired ? "required" : "not set"],
        ["cwd", info.cwd],
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

  const curlCmds = [
    [`# Liveness\ncurl -s '${base}/health?format=json' | jq .`],
    [`# Smoke test\ncurl -s '${base}/test?format=json' | jq .`],
    [`# List tools\ncurl -s -X POST '${base}/mcp' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | jq .`],
    [`# Search tickets\ncurl -s -X POST '${base}/mcp' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_tickets","arguments":{"status":"open","limit":5}}}' | jq .`],
    [`# Create ticket (with owner)\ncurl -s -X POST '${base}/mcp' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"create_ticket","arguments":{"subject":"Test","body":"From curl.","requester_email":"markus.van.kempen@gmail.com"}}}' | jq .`],
    [`# Create ticket WITHOUT email → service-account scar\ncurl -s -X POST '${base}/mcp' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"create_ticket","arguments":{"subject":"Scar demo","body":"No email — bot owns it."}}}' | jq .`],
    [`# Get ticket\ncurl -s -X POST '${base}/mcp' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"get_ticket","arguments":{"ticket_id":"TCK-1001"}}}' | jq .`],
    [`# Authenticated call (replace KEY)\ncurl -s -X POST '${base}/mcp' \\\n  -H 'Content-Type: application/json' \\\n  -H 'Authorization: Bearer mcpk_YOUR_KEY' \\\n  -d '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"lookup_customer","arguments":{"email":"ada@example.com"}}}' | jq .`],
  ].map(([c]) => curlBlock(c)).join("");

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
        <p class="muted">Happy-path pipeline against the in-memory store. ${helpToggle("test-info", "Alive vs Working", "Health checks confirm the process is up, but /test actually executes real tool queries to prove end-to-end functionality.", { text: "Docs", url: "/help#smoke" })}</p>
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
      <p class="muted">Default: <code>demo</code> / <code>demo</code>. Override with <code>ADMIN_USER</code> and <code>ADMIN_PASSWORD</code> env vars.</p>
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

  return `<div class="panel">
    <h4>Auth mode ${helpToggle("admin-auth", "Auth modes", "<b>off</b>: open.<br><b>write</b>: read tools open; write/PII need scopes.<br><b>all</b>: every call needs credentials.", { text: "Security docs", url: "/help#security" })}</h4>
    <p>Controls which tool scopes require a credential.</p>
    <form method="post" action="/admin/security">
      <div class="modes">${modes}</div>
      <button type="submit">Apply mode</button>
    </form>
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
    return `<tr>
      <td class="mono">${escapeHtml(name)}</td>
      <td>${statusTag} ${gateBtn}</td>
      <td>${authTag} ${authBtn}</td>
    </tr>`;
  }).join("") || "<tr><td colspan=3 class='muted'>No tools registered.</td></tr>";
  return `<div>
    <p class="muted" style="margin-bottom:10px">
      <strong>Disable</strong> removes a tool entirely (503 for any caller).<br>
      <strong>Lock</strong> forces that tool to require a credential, even when the global auth mode is <em>off</em>.
      Locked tools respect the tool's natural scope (<code>read</code>, <code>write</code>, or <code>pii</code>).
    </p>
    <div class="tbl-wrap"><table><thead><tr><th>Tool</th><th>Availability</th><th>Auth override</th></tr></thead><tbody>${rows}</tbody></table></div>
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
  </div>`;
}

function usersPanel(security) {
  const rows = (security.users || []).map((u) =>
    `<tr><td class="mono">${escapeHtml(u.username)}</td><td>${u.scopes.map((s) => `<span class="tag grey">${escapeHtml(s)}</span>`).join(" ")}</td></tr>`
  ).join("") || "<tr><td colspan=2 class='muted'>No extra users. Set <code>MCP_USERS</code> env var.</td></tr>";
  return `<div>
    <p class="muted">Users come from the <code>MCP_USERS</code> environment variable — <code>"alice:secret:read,write"</code>. The admin login is always present with <code>admin</code> scope.</p>
    <div class="tbl-wrap"><table><thead><tr><th>Username</th><th>Scopes</th></tr></thead><tbody>${rows}</tbody></table></div>
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
    </tr>`
  ).join("") || "<tr><td colspan=5 class='muted'>No tickets yet.</td></tr>";

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
        <h3>Recent tickets</h3>
        ${searchRow("ticketSearch", "ticketTable", "Filter tickets…")}
        <div class="tbl-wrap"><table id="ticketTable"><thead><tr><th>Id</th><th>Subject</th><th>Requester</th><th>Attribution</th><th>Status</th></tr></thead>
        <tbody>${ticketRows}</tbody></table></div>
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
  const rows = TOOL_CATALOG.map(([name, scope, purpose]) =>
    `<tr>
      <td class="mono">${escapeHtml(name)}</td>
      <td style="font-size:13px">${escapeHtml(purpose)}</td>
      <td><span class="tag${scope === "read" ? " grey" : scope === "pii" ? " amber" : " coral"}">${escapeHtml(scope)}</span></td>
      <td>${needsCredential(scope) ? '<span class="tag coral">credential required</span>' : '<span class="tag grey">open</span>'}</td>
    </tr>`
  ).join("");
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
      <div class="tbl-wrap"><table id="toolTable"><thead><tr><th>Tool</th><th>When to use</th><th>Scope</th><th>Right now</th></tr></thead><tbody>${rows}</tbody></table></div>
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

export function helpPage() {
  return chrome({
    title: "docs · mcp-ticket-demo",
    tab: "/help",
    liveOn: true,
    liveLabel: "documentation",
    body: `
      <div class="eyebrow">Documentation</div>
      <h2>Guides &amp; Reference.<br><span>How everything fits together.</span></h2>

      ${pageTabs("help", [
        ["help-start", "Quick start"],
        ["help-security", "Security"],
        ["help-pages", "Pages"],
        ["help-tools", "Tools"],
      ])}

      <div id="help-start" class="pane active" data-group="help">
        <div class="panel" id="local">
          <h4>1. Two transports</h4>
          <p>stdio for IDEs (VS Code, Cursor, Bob, Windsurf) — no port. HTTP for browsers, diagnostics, and cloud.</p>
          <pre>cd server && npm install
# HTTP (browser pages + /mcp endpoint)
MCP_MODE=http PORT=8787 node src/index.js
# stdio (what the IDE spawns)
MCP_MODE=stdio node src/index.js</pre>
        </div>
        <div class="panel">
          <h4>2. Register with an IDE</h4>
          <p>Use the LF MCP Demo extension: click <strong>Register server with all IDEs</strong> — it writes the correct config to VS Code, Cursor, Bob, and Windsurf at once, then tells you which files changed. Reload the window after.</p>
          <p>Or add manually to <code>.vscode/mcp.json</code>:</p>
          <pre>{
  "servers": {
    "mcp-ticket-demo": {
      "type": "stdio",
      "command": "node",
      "args": ["src/index.js"],
      "cwd": "/path/to/mcp-ticket-demo/server",
      "env": { "MCP_MODE": "stdio" }
    }
  }
}</pre>
        </div>
      </div>

      <div id="help-security" class="pane" data-group="help">
        <div class="panel">
          <h4>Auth modes</h4>
          <ul class="checklist">
            <li><strong>off</strong> — all tools open, no credential needed. Default for local exploration.</li>
            <li><strong>write</strong> — read tools open; <code>create_ticket</code>, <code>add_comment</code>, <code>lookup_customer</code> need a credential.</li>
            <li><strong>all</strong> — every tool call requires a credential. Discovery remains open.</li>
          </ul>
          <p class="muted">Change the mode on <a href="/admin#adm-security">Admin → Security</a>.</p>
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
          <h4>Per-tool gates</h4>
          <p>Each tool can be disabled individually on <a href="/admin#adm-gates">Admin → Tool Gates</a> without changing the global auth mode. Disabled tools return HTTP 503 immediately.</p>
        </div>
      </div>

      <div id="help-pages" class="pane" data-group="help">
        <div class="panel" id="smoke">
          <h4>Pages and access</h4>
          <ul class="checklist">
            <li><strong>/health</strong> — public. Process alive? cwd? auth mode? rate limit config.</li>
            <li><strong>/test</strong> — public. Runs a create + search smoke test against the store. Also has curl command examples.</li>
            <li><strong>/tools</strong> — public. Full tool inventory with current scope enforcement state.</li>
            <li><strong>/admin</strong> 🔒 — requires login. Auth mode, keys, tool gates, lab, data, users.</li>
            <li><strong>/log</strong> 🔒 — requires login. Tool counters, error log (searchable, expandable), call trace, audit trail.</li>
            <li><strong>/mcp</strong> — Streamable HTTP MCP transport (JSON-RPC 2.0).</li>
            <li><strong>/sse</strong> — Legacy SSE transport (Cursor mcp-proxy).</li>
          </ul>
        </div>
      </div>

      <div id="help-tools" class="pane" data-group="help">
        <div class="panel" id="tools">
          <h4>9 purpose-built tools</h4>
          <p>No <code>request(path, method)</code>. Each tool name is a verb + noun that says when to use it.</p>
          <ul class="checklist">
            <li><code>describe_server</code> — call first, and after any denial. Reports auth mode, your scopes, rate budget.</li>
            <li><code>search_tickets</code> — find tickets by status, email, or keyword.</li>
            <li><code>get_ticket</code> — fetch one ticket by id including comments.</li>
            <li><code>create_ticket</code> — always pass <code>requester_email</code> or the service account owns it.</li>
            <li><code>add_comment</code> — comment on a known ticket id.</li>
            <li><code>list_schemas</code> — discover queryable schemas before calling run_query.</li>
            <li><code>get_schema</code> — fields and filters for one schema.</li>
            <li><code>run_query</code> — the one query tool. Pass schema from list_schemas.</li>
            <li><code>lookup_customer</code> — phone is PII; redacted without the <code>pii</code> scope.</li>
          </ul>
        </div>
      </div>
    `,
  });
}
