import { TOOL_CATALOG } from "./create-server.js";

const AUTH_MODE_COPY = {
  off: ["Open", "No credential needed. Every tool is callable by anyone who can reach the server."],
  write: ["Writes protected", "Read tools stay open. Write and PII tools need a key or a login with the right scope."],
  all: ["Locked", "Every tool call needs a credential. Discovery still works, so a client can see the tools and learn what to ask for."],
};

const css = `
:root { --ink:#10252a; --muted:#557176; --paper:#f3f7f1; --cream:#fbfcf8; --green:#0d7a63; --green-dark:#075346; --lime:#c7e86b; --coral:#f07f61; --line:#cddbd3; --accent:#0d7a63; }
* { box-sizing: border-box; }
body { margin:0; font: 15px/1.45 Manrope, -apple-system, Segoe UI, sans-serif; background: var(--paper); color: var(--ink); }
.header { position: sticky; top: 0; z-index: 20; background: rgba(251,252,248,.94); border-bottom: 1px solid var(--line); backdrop-filter: blur(8px); }
.header-main { max-width: 1080px; margin: 0 auto; padding: 12px 22px 0; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.header h1 { font: 600 15px/1.2 ui-monospace, Menlo, monospace; color: var(--green); margin: 0; }
.header h1 span { color: var(--muted); font-weight: 400; }
.live { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font: 11px ui-monospace, Menlo, monospace; color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: 4px 10px; }
.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--coral); }
.dot.on { background: var(--green); box-shadow: 0 0 6px var(--green); }
.tabs { max-width: 1080px; margin: 0 auto; padding: 0 22px; display: flex; gap: 4px; }
.tab { display: inline-block; padding: 10px 14px; color: var(--muted); text-decoration: none; font-size: 13px; border-bottom: 2px solid transparent; margin-bottom: -1px; }
.tab:hover { color: var(--ink); }
.tab.active { color: var(--green); border-bottom-color: var(--green); font-weight: 600; }
.main { max-width: 1080px; margin: 0 auto; padding: 22px 22px 80px; }
.eyebrow { color: var(--green); font: 500 12px ui-monospace, Menlo, monospace; letter-spacing: .08em; text-transform: uppercase; }
h2 { font-size: 34px; letter-spacing: -.04em; line-height: 1.05; margin: 8px 0 14px; }
h2 span { color: var(--green); }
h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 22px 0 8px; }
.muted { color: var(--muted); }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin: 16px 0; }
.stat { background: var(--cream); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
.stat strong { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-bottom: 4px; }
.stat b { font: 600 18px ui-monospace, Menlo, monospace; }
.tag { display: inline-block; background: var(--lime); color: var(--green-dark); border-radius: 999px; padding: 3px 10px; font: 500 11px ui-monospace, Menlo, monospace; }
.tag.coral { background: var(--coral); color: #fff; }
table { width: 100%; border-collapse: collapse; background: var(--cream); border-radius: 12px; overflow: hidden; }
th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: top; font-size: 13px; }
th { background: var(--green-dark); color: #fff; }
a { color: var(--green); }
button, input { font: inherit; }
input { width: 100%; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
button { background: var(--green); color: #fff; border: 0; border-radius: 8px; padding: 9px 14px; cursor: pointer; }
button.secondary { background: var(--cream); color: var(--ink); border: 1px solid var(--line); }
.row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin: 14px 0; }
pre { background: var(--green-dark); color: #dff5d9; padding: 14px; border-radius: 12px; overflow: auto; font: 12px/1.5 ui-monospace, Menlo, monospace; }
.checklist { list-style: none; padding: 0; display: grid; gap: 6px; }
.checklist li { padding: 8px 10px 8px 28px; background: var(--cream); border: 1px solid var(--line); border-radius: 8px; position: relative; }
.checklist li::before { content: "✓"; position: absolute; left: 10px; color: var(--green); font-weight: 700; }
.checklist li.fail::before { content: "✗"; color: var(--coral); }
.note { font-size: 12px; color: var(--muted); margin-top: 28px; }
.warn { color: #9a3b22; }
.panel { background: var(--cream); border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; margin: 12px 0; }
.panel h4 { margin: 0 0 4px; font-size: 15px; }
.panel p { margin: 4px 0 12px; font-size: 13px; color: var(--muted); }
.grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; align-items: start; }
.modes { display: grid; gap: 8px; margin-bottom: 12px; }
.mode { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: #fff; cursor: pointer; }
.mode.on { border-color: var(--green); box-shadow: inset 3px 0 0 var(--green); }
.mode input { width: auto; margin: 3px 0 0; }
.mode b { display: block; font-size: 13px; }
.mode span { font-size: 12px; color: var(--muted); }
.field { display: grid; gap: 4px; font-size: 12px; color: var(--muted); }
.field-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; }
.field-row .field { flex: 1 1 140px; }
.scopes { display: flex; gap: 12px; flex-wrap: wrap; font-size: 13px; color: var(--ink); margin: 8px 0 12px; }
.scopes label { display: inline-flex; gap: 5px; align-items: center; }
.scopes input { width: auto; }
.secret { background: var(--green-dark); color: #dff5d9; border-radius: 10px; padding: 12px 14px; margin: 10px 0; }
.secret .value { display: block; font: 14px/1.5 ui-monospace, Menlo, monospace; word-break: break-all; margin: 8px 0; color: var(--lime); }
.secret .hint { display: block; font-size: 12px; opacity: .85; }
.secret code { font-family: ui-monospace, Menlo, monospace; color: var(--lime); }
.tag.grey { background: var(--line); color: var(--muted); }
`;

function chrome({ title, tab, liveOn, liveLabel, body }) {
  const tabs = [
    ["/health", "Health"],
    ["/test", "Test"],
    ["/admin", "Admin"],
    ["/tools", "Tools"],
  ].map(([href, label]) =>
    `<a class="tab${tab === href ? " active" : ""}" href="${href}">${label}</a>`
  ).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>${css}</style>
</head>
<body>
  <header class="header">
    <div class="header-main">
      <h1>mcp-ticket-demo <span>activity dashboard</span></h1>
      <span class="live"><span class="dot${liveOn ? " on" : ""}"></span>${escapeHtml(liveLabel || "http")}</span>
    </div>
    <nav class="tabs">${tabs}</nav>
  </header>
  <main class="main">${body}
    <p class="note">/health /test /admin /tools are my convention, not part of the MCP spec. Same tools over stdio and HTTP. Layout borrowed from the Code Engine MCP activity dashboard.</p>
  </main>
</body>
</html>`;
}

function stats(rows) {
  return `<div class="stats">${rows.map(([k, v]) =>
    `<div class="stat"><strong>${k}</strong><b>${escapeHtml(String(v))}</b></div>`
  ).join("")}</div>`;
}

export function healthPage(info) {
  return chrome({
    title: "health · mcp-ticket-demo",
    tab: "/health",
    liveOn: info.ok,
    liveLabel: info.ok ? "alive" : "down",
    body: `
      <div class="eyebrow">Alive?</div>
      <h2>Is it up?<br><span>${info.ok ? "Yes." : "No."}</span></h2>
      <p class="muted">A 200 here means the process is running. It does not mean a tool is done. Open <a href="/test">Test</a> for that.</p>
      ${stats([
        ["status", info.ok ? "alive" : "down"],
        ["transport", info.transport],
        ["tools", info.tools],
        ["cwd", info.cwd],
        ["auth mode", info.security.authMode],
        ["api keys", info.security.activeKeyCount],
        ["rate limit", info.security.rateLimit?.enabled ? `${info.security.rateLimit.limit}/${Math.round(info.security.rateLimit.windowMs / 1000)}s` : "off"],
        ["tenant", info.security.tenantRequired ? "required" : "not set"],
      ])}
      <h3>Raw</h3>
      <pre>${escapeHtml(JSON.stringify(info, null, 2))}</pre>
    `,
  });
}

export function testPage(result) {
  const items = result.steps.map((s) =>
    `<li class="${s.ok ? "" : "fail"}"><strong>${escapeHtml(s.name)}</strong> — ${escapeHtml(s.detail)}</li>`
  ).join("");
  return chrome({
    title: "test · mcp-ticket-demo",
    tab: "/test",
    liveOn: result.ok,
    liveLabel: result.ok ? "smoke pass" : "smoke fail",
    body: `
      <div class="eyebrow">Works?</div>
      <h2>Does it really work?<br><span>${result.ok ? "Yes." : "Something failed."}</span></h2>
      <p class="muted">Happy-path pipeline against the in-memory store. Creates a ticket <em>with</em> requester_email, then finds it — same idea as the Code Engine deploy checklist.</p>
      <ul class="checklist">${items}</ul>
      <h3>Raw</h3>
      <pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre>
    `,
  });
}

export function adminLoginPage(error) {
  return chrome({
    title: "admin · mcp-ticket-demo",
    tab: "/admin",
    liveOn: false,
    liveLabel: "signed out",
    body: `
      <div class="eyebrow">Operable?</div>
      <h2>Admin.<br><span>Username and password.</span></h2>
      <p class="muted">Default local login is <code>demo</code> / <code>demo</code>, overridden by <code>ADMIN_USER</code> and <code>ADMIN_PASSWORD</code>. In a deployment those live in the app env, not on your laptop.</p>
      ${error ? `<p class="warn">${escapeHtml(error)}</p>` : ""}
      <form method="post" action="/admin/login" style="max-width:360px">
        <p><label>Username<br><input name="username" autocomplete="username"></label></p>
        <p><label>Password<br><input name="password" type="password" autocomplete="current-password"></label></p>
        <button type="submit">Sign in</button>
      </form>
    `,
  });
}

function authModePanel(security) {
  const modes = (security.authModes || ["off", "write", "all"]).map((mode) => {
    const [title, detail] = AUTH_MODE_COPY[mode] || [mode, ""];
    const on = security.authMode === mode;
    return `<label class="mode${on ? " on" : ""}">
      <input type="radio" name="authMode" value="${mode}"${on ? " checked" : ""}>
      <span><b>${escapeHtml(title)}</b><span><code>${mode}</code> — ${escapeHtml(detail)}</span></span>
    </label>`;
  }).join("");

  return `<div class="panel">
    <h4>Tool security</h4>
    <p>Who is allowed to call a tool is not in the MCP spec — every server invents it. This one has three modes.</p>
    <form method="post" action="/admin/security">
      <div class="modes">${modes}</div>
      <button type="submit">Apply mode</button>
    </form>
  </div>`;
}

function rateLimitPanel(security) {
  const rate = security.rateLimit || {};
  return `<div class="panel">
    <h4>Rate limit</h4>
    <p>Counted per caller — one bucket per API key, per user, and one shared bucket for anonymous calls. A refused call returns the seconds to wait so a model stops retrying.</p>
    <form method="post" action="/admin/rate-limit">
      <div class="field-row">
        <label class="field">Calls<input name="limit" type="number" min="1" value="${Number(rate.limit) || 60}"></label>
        <label class="field">Per (seconds)<input name="windowSeconds" type="number" min="1" value="${Math.round((Number(rate.windowMs) || 60000) / 1000)}"></label>
        <label class="field" style="flex:0 0 auto">Enabled<br><input type="checkbox" name="enabled" value="1"${rate.enabled ? " checked" : ""} style="width:auto"></label>
        <button type="submit">Save limit</button>
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
      ? `<form method="post" action="/admin/keys/revoke" style="display:inline"><input type="hidden" name="id" value="${escapeHtml(key.id)}"><button class="secondary" type="submit">Revoke</button></form>`
      : '<span class="muted">—</span>';
    return `<tr>
      <td><code>${escapeHtml(key.prefix)}…</code><br><span class="muted">${escapeHtml(key.label)}</span></td>
      <td>${key.scopes.map((s) => `<span class="tag grey">${escapeHtml(s)}</span>`).join(" ")}</td>
      <td>${status}${key.expiresAt ? `<br><span class="muted">expires ${escapeHtml(key.expiresAt.slice(0, 10))}</span>` : ""}</td>
      <td>${key.calls}<br><span class="muted">${key.lastUsedAt ? escapeHtml(key.lastUsedAt.slice(11, 19)) : "never used"}</span></td>
      <td>${revoke}</td>
    </tr>`;
  }).join("");

  const secret = issuedKey
    ? `<div class="secret"><strong>Copy this now — the server only kept its hash.</strong>
        <span class="value">${escapeHtml(issuedKey.key)}</span>
        <span class="hint">Over HTTP send it as <code>Authorization: Bearer &lt;key&gt;</code>. Over stdio set <code>MCP_API_KEY</code> in the server env.</span>
      </div>`
    : "";

  return `<div class="panel">
    <h4>API keys</h4>
    <p>A key is shown once and stored as a SHA-256 hash. Scopes decide which tools it can call: <code>read</code>, <code>write</code>, <code>pii</code>, <code>admin</code>. <code>write</code> implies <code>read</code>; <code>admin</code> implies all of them.</p>
    ${secret}
    <form method="post" action="/admin/keys">
      <div class="field-row">
        <label class="field">Label<input name="label" placeholder="cursor on my laptop"></label>
        <label class="field" style="flex:0 0 130px">Expires in days<input name="expiresInDays" type="number" min="0" placeholder="0 = never"></label>
      </div>
      <div class="scopes">
        ${(security.scopes || []).map((scope) => `<label><input type="checkbox" name="scopes" value="${scope}"${scope === "read" ? " checked" : ""}>${scope}</label>`).join("")}
      </div>
      <button type="submit">Create API key</button>
    </form>
    <h3>Issued keys</h3>
    <table><thead><tr><th>Key</th><th>Scopes</th><th>Status</th><th>Calls</th><th></th></tr></thead>
    <tbody>${rows || '<tr><td colspan=5 class=muted>No keys yet. Create one above.</td></tr>'}</tbody></table>
  </div>`;
}

function usersPanel(security) {
  const rows = (security.users || []).map((user) =>
    `<tr><td><code>${escapeHtml(user.username)}</code></td><td>${user.scopes.map((s) => `<span class="tag grey">${escapeHtml(s)}</span>`).join(" ")}</td></tr>`
  ).join("");
  return `<div class="panel">
    <h4>Logins</h4>
    <p>Users come from the environment, not from this page — a demo server has no user database. Set <code>MCP_USERS="alice:secret:read,write"</code> to add more. Callers present them as HTTP Basic; over stdio as <code>MCP_USERNAME</code> and <code>MCP_PASSWORD</code>.</p>
    <table><thead><tr><th>Username</th><th>Scopes</th></tr></thead><tbody>${rows}</tbody></table>
  </div>`;
}

export function adminPage({ security, store, adminUser, info, issuedKey }) {
  const [modeTitle] = AUTH_MODE_COPY[security.authMode] || ["custom"];
  const open = security.authMode === "off";
  const tickets = store.listTickets({ status: "all", limit: 8 });
  const audit = store.audit();
  const rate = security.rateLimit || {};
  return chrome({
    title: "admin · mcp-ticket-demo",
    tab: "/admin",
    liveOn: open,
    liveLabel: `auth ${security.authMode}`,
    body: `
      <div class="eyebrow">Operable?</div>
      <h2>Operate the server.<br><span>Signed in as ${escapeHtml(adminUser)}.</span></h2>
      <div class="row">
        <span class="tag ${open ? "" : "coral"}">${escapeHtml(modeTitle.toUpperCase())}</span>
        <span class="tag">${escapeHtml(info.transport)}</span>
        <span class="tag grey">${security.activeKeyCount} active key${security.activeKeyCount === 1 ? "" : "s"}</span>
        <span class="tag grey">${rate.enabled ? `${rate.limit}/${Math.round((rate.windowMs || 0) / 1000)}s` : "no rate limit"}</span>
        <form method="post" action="/admin/logout" style="display:inline"><button class="secondary" type="submit">Sign out</button></form>
      </div>
      ${stats([
        ["auth mode", security.authMode],
        ["denied calls", security.deniedCount],
        ["tenant", security.tenantRequired ? "x-tenant-id required" : "not required"],
        ["tools", info.tools],
        ["hostname", info.hostname || "local"],
      ])}
      <div class="grid2">${authModePanel(security)}${rateLimitPanel(security)}</div>
      ${keysPanel(security, issuedKey)}
      ${usersPanel(security)}
      <h3>Recent tickets</h3>
      <table><thead><tr><th>Id</th><th>Subject</th><th>Requester</th><th>Attribution</th></tr></thead>
      <tbody>${tickets.map((t) => `<tr><td>${t.id}</td><td>${escapeHtml(t.subject)}</td><td>${escapeHtml(t.requester_email)}</td><td>${t.attribution === "service_account" ? '<span class="tag coral">service account</span>' : '<span class="tag">customer</span>'}</td></tr>`).join("")}</tbody></table>
      <h3>Audit — every call, allowed or denied</h3>
      <table><thead><tr><th>When</th><th>Tool</th><th>Caller</th><th>Detail</th></tr></thead>
      <tbody>${audit.map((a) => `<tr><td>${escapeHtml(a.at)}</td><td>${escapeHtml(a.tool || "")}</td><td>${escapeHtml(a.principal || "—")}</td><td>${escapeHtml(a.outcome || a.ticket || a.email || "")}</td></tr>`).join("") || "<tr><td colspan=4 class=muted>No calls yet.</td></tr>"}</tbody></table>
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
      <td><code>${name}</code></td>
      <td>${escapeHtml(purpose)}</td>
      <td><span class="tag${scope === "read" ? " grey" : " coral"}">${scope}</span></td>
      <td>${needsCredential(scope) ? '<span class="tag coral">credential required</span>' : '<span class="tag">open</span>'}</td>
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
      <p class="muted">Descriptions say <em>when</em> to use the tool. Each one declares the scope it needs; <a href="/admin">Admin</a> decides whether that scope is enforced. Start with <code>describe_server</code> — it reports the auth mode, your scopes, and your rate-limit budget.</p>
      <table><thead><tr><th>Tool</th><th>When</th><th>Scope</th><th>Right now</th></tr></thead><tbody>${rows}</tbody></table>
    `,
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}
