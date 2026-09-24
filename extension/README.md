# LF MCP Demo

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/MarkusvanKempen.lf-mcp-summit-demo?style=for-the-badge&logo=visualstudiocode&label=VS%20Code)](https://marketplace.visualstudio.com/items?itemName=MarkusvanKempen.lf-mcp-summit-demo)
[![Open VSX](https://img.shields.io/open-vsx/v/markusvankempen/lf-mcp-summit-demo?style=for-the-badge&label=Open%20VSX)](https://open-vsx.org/extension/markusvankempen/lf-mcp-summit-demo)
[![npm](https://img.shields.io/npm/v/mcp-ticket-demo?style=for-the-badge&logo=npm&logoColor=white&label=npm)](https://www.npmjs.com/package/mcp-ticket-demo)
[![npm downloads](https://img.shields.io/npm/dm/mcp-ticket-demo?style=for-the-badge&logo=npm&logoColor=white&label=downloads)](https://www.npmjs.com/package/mcp-ticket-demo)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=for-the-badge)](https://github.com/markusvankempen/mcp-ticket-demo/blob/main/LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-mcp--ticket--demo-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/markusvankempen/mcp-ticket-demo)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Protocol-5A29E4?style=for-the-badge)](https://modelcontextprotocol.io/)

A **control plane and test harness** for the [mcp-ticket-demo](https://www.npmjs.com/package/mcp-ticket-demo) MCP server. The extension manages the server lifecycle, writes IDE config, runs a step-by-step diagnostic, scores tool calls end-to-end, and fires canned prompts directly into your LLM chat — all from a sidebar in VS Code, IBM Bob, Cursor, or Windsurf.

The bundled MCP server (`mcp-ticket-demo`) is a **fully functional support-ticketing backend** with 10 real tools, three auth modes, API key management, per-tool gates, rate limiting, and a live `/admin` dashboard. It runs as a local stdio child process, a local HTTP server, a Podman container, or a public HTTPS host (Render or Code Engine). The Setup panel picks which HTTP host Diagnose and CRUD use, and can write that URL into `mcp.json` for chat.

> Companion to [**MCP as a Platform**](https://events.linuxfoundation.org/mcp-dev-summit-toronto/program/schedule/?id=1282401) · MCP Dev Summit Toronto · Oct 2026 — every lesson in the talk is a live, reproducible demo in this repo. · [Talk slides](https://markusvankempen.github.io/linuxfoundation-mcp-dev-summit/#1)

---

## What is included

```
Extension (VS Code / Bob / Cursor / Windsurf)   ← control plane
├── Setup & Diagnostics panel
│     ├── Step-by-step diagnostic (workspace → config → health → tool call)
│     ├── MCP CRUD test  (create → get → comment → close → search)
│     ├── Connection switcher  (stdio / HTTP / Podman / Render / Code Engine)
│     └── Send-to-chat prompts  (fire lesson scenarios into the active LLM)
├── Resources tree  (server status, connection mode, quick links)
└── Status-bar quick menu

MCP Server  (npm: mcp-ticket-demo)              ← what the extension manages
├── 10 tools · 3 resources · 5 prompts
├── Auth  — off / write / all · API key management · per-tool gates
├── stdio transport  — local child process, no port, secrets in env
├── HTTP transport   — POST /mcp  GET /sse  /health  /test  /admin  /tools
└── Podman image     — same Dockerfile as Code Engine deployment
```

![Extension setup panel — connection switcher and server controls](../docs/assets/screenshots/ext-setup.png)

---

## Architecture

```
 ┌─────────────────────────────────────────────────────┐
 │  VS Code / Bob / Cursor / Windsurf                  │
 │                                                     │
 │  ┌──────────────────────┐   ┌─────────────────────┐ │
 │  │  MCP Platform Demo   │   │   LLM Chat Panel    │ │
 │  │  extension           │──▶│  (Copilot / Bob /   │ │
 │  │                      │   │   Cursor / Cascade) │ │
 │  │  sidebar · tree      │   └─────────────────────┘ │
 │  │  diagnose · prompts  │                           │
 │  └──────────┬───────────┘                           │
 └─────────────┼───────────────────────────────────────┘
               │  MCP  (stdio or HTTP)
   ┌───────────▼───────────────────────────────────┐
   │  mcp-ticket-demo  server                      │
   │                                               │
   │  Transport A — stdio                          │
   │    node  src/index.js  (child process)        │
   │    no port · no URL · secrets in env          │
   │                                               │
   │  Transport B — HTTP                           │
   │    POST /mcp  (Streamable HTTP)               │
   │    GET  /sse  (legacy SSE)                    │
   │    GET  /health  /test  /admin  /tools        │
   │                                               │
   │  Transport C — Podman HTTP                    │
   │    same image as Code Engine                  │
   │    podman run -p 8787:8080 mcp-ticket-demo    │
   │                                               │
   │  Transport D — Remote HTTP                     │
   │    Render or Code Engine  (public HTTPS)      │
   │    POST /mcp · GET /sse · GET /health         │
   └───────────────────────────────────────────────┘
```

---

## Quick start

### Option 1 — npm (no repo clone needed)

The MCP server is published at **[npmjs.com/package/mcp-ticket-demo](https://www.npmjs.com/package/mcp-ticket-demo)**.

```bash
npm install -g mcp-ticket-demo   # install globally
# or just run it directly
npx mcp-ticket-demo
```

Then install this extension. Open any folder and run
**MCP Demo: Connect native stdio** from the command palette.

### Option 2 — Clone the repo

```bash
git clone https://github.com/markusvankempen/mcp-ticket-demo
cd mcp-ticket-demo/server && npm install
```

Open the repo root in VS Code / Bob. The extension auto-detects
`server/src/index.js` and all connection commands use it directly.

### Option 3 — Public Render host (no local server)

A live instance is at **[https://mcp-ticket-demo.onrender.com/health](https://mcp-ticket-demo.onrender.com/health)**. That is a **second** ticket store from laptop stdio — empty after a Render sleep/restart.

1. Open the **Setup** tab.
2. **Active target** → `remote HTTP · Render / Code Engine`.
3. **Hosting URL** → `https://mcp-ticket-demo.onrender.com` (no `/health`).
4. Click **Use this URL in mcp.json**.
5. Reload the window so Copilot / Chat sees `mcp-ticket-demo-remote`.
6. For writes: sign in to [`/admin`](https://mcp-ticket-demo.onrender.com/admin) (Render generated `ADMIN_PASSWORD`), issue an API key, paste it in Settings → `summitMcp.apiKey`.

**Diagnose and CRUD** use the host in **Active target** (header: *Probing …*). **Chat** uses whatever is in `mcp.json`. They can point at different processes.

**Deploy your own:** **Deploy on Render** opens the [Blueprint](https://dashboard.render.com/blueprint/new?repo=https%3A%2F%2Fgithub.com%2Fmarkusvankempen%2Fmcp-ticket-demo) for this repo (`render.yaml` = Node in `server/`, not the UBI Docker image). Optional **Render API key** in Settings lets Deploy look up the live URL. The **?** next to the button jumps to that field.

---

## mcp.json examples

The extension writes these automatically via **MCP Demo: Connect native stdio** etc.,
but you can also paste them manually.

### VS Code — `.vscode/mcp.json`

**stdio (npx — no clone needed)**
```json
{
  "servers": {
    "mcp-ticket-demo": {
      "type": "stdio",
      "command": "npx",
      "args": ["mcp-ticket-demo"],
      "env": { "MCP_MODE": "stdio" }
    }
  }
}
```

**stdio (local clone)**
```json
{
  "servers": {
    "mcp-ticket-demo": {
      "type": "stdio",
      "command": "node",
      "args": ["src/index.js"],
      "cwd": "/path/to/mcp-ticket-demo/server",
      "env": { "MCP_MODE": "stdio" }
    }
  }
}
```

**Remote HTTP (Render or Code Engine)**
```json
{
  "servers": {
    "mcp-ticket-demo-remote": {
      "type": "sse",
      "url": "https://mcp-ticket-demo.onrender.com/sse"
    }
  }
}
```

Same shape for Code Engine — swap the host for `https://<app>.codeengine.appdomain.cloud/sse`.

---

### IBM Bob — `.bob/mcp.json`

**stdio (npx)**
```json
{
  "mcpServers": {
    "mcp-ticket-demo": {
      "command": "npx",
      "args": ["mcp-ticket-demo"],
      "env": { "MCP_MODE": "stdio" },
      "alwaysAllow": [
        "describe_server", "search_tickets", "create_ticket",
        "add_comment", "close_ticket", "get_ticket", "list_schemas",
        "get_schema", "run_query", "lookup_customer"
      ],
      "disabled": false
    }
  }
}
```

**Remote HTTP (Render or Code Engine)**
```json
{
  "mcpServers": {
    "mcp-ticket-demo-remote": {
      "type": "streamable-http",
      "url": "https://mcp-ticket-demo.onrender.com/mcp",
      "alwaysAllow": [
        "describe_server", "search_tickets", "create_ticket",
        "add_comment", "close_ticket", "get_ticket", "list_schemas",
        "get_schema", "run_query", "lookup_customer"
      ],
      "disabled": false
    }
  }
}
```

---

### Cursor — `.cursor/mcp.json`

**stdio (npx)**
```json
{
  "mcpServers": {
    "mcp-ticket-demo": {
      "command": "npx",
      "args": ["mcp-ticket-demo"],
      "env": { "MCP_MODE": "stdio" }
    }
  }
}
```

**Remote HTTP (via uvx mcp-proxy shim)**
```json
{
  "mcpServers": {
    "mcp-ticket-demo-remote": {
      "command": "uvx",
      "args": ["mcp-proxy", "https://mcp-ticket-demo.onrender.com/sse"]
    }
  }
}
```

---

### Windsurf — `.windsurf/mcp.json`

**stdio (npx)**
```json
{
  "mcpServers": {
    "mcp-ticket-demo": {
      "command": "npx",
      "args": ["mcp-ticket-demo"],
      "env": { "MCP_MODE": "stdio" }
    }
  }
}
```

**Remote HTTP (Streamable HTTP)**
```json
{
  "mcpServers": {
    "mcp-ticket-demo-remote": {
      "type": "streamable-http",
      "url": "https://mcp-ticket-demo.onrender.com/mcp"
    }
  }
}
```

---

### Cline — `.vscode/settings.json`

```json
{
  "cline.mcpServers": {
    "mcp-ticket-demo": {
      "command": "npx",
      "args": ["mcp-ticket-demo"],
      "env": { "MCP_MODE": "stdio" },
      "alwaysAllow": [
        "describe_server", "search_tickets", "create_ticket",
        "add_comment", "close_ticket", "get_ticket", "list_schemas",
        "get_schema", "run_query", "lookup_customer"
      ],
      "disabled": false
    }
  }
}
```

---

### With API key (auth mode: write or all)

Add to any `env` block for stdio, or add a `headers` block for HTTP:

**stdio**
```json
"env": {
  "MCP_MODE": "stdio",
  "MCP_API_KEY": "your-api-key-from-admin"
}
```

**HTTP (Bob / Windsurf streamable-http)**
```json
"headers": {
  "Authorization": "Bearer your-api-key-from-admin"
}
```

> Issue API keys on `/admin → API Keys`. Set the auth mode on `/admin → Auth Mode`
> or via the `summitMcp.authMode` setting.

---

## Connection modes

```
┌──────────────────────┬───────────────────────────────────────────────────┐
│ Mode                 │ How it works                                      │
├──────────────────────┼───────────────────────────────────────────────────┤
│ Native stdio         │ node src/index.js  spawned as a child process.    │
│                      │ No port. No URL. Credentials go in process env.   │
│                      │ Fastest for local dev.                            │
├──────────────────────┼───────────────────────────────────────────────────┤
│ Native HTTP          │ node src/index.js  runs an Express server on      │
│                      │ 127.0.0.1:8787. Use /health /test /admin /mcp.    │
├──────────────────────┼───────────────────────────────────────────────────┤
│ Podman stdio         │ podman run -i --rm  spawns the container as a     │
│                      │ stdio child. Same MCP_MODE=stdio path.            │
├──────────────────────┼───────────────────────────────────────────────────┤
│ Podman HTTP          │ Container maps port 8787 → 8080.                  │
│                      │ IDE connects to http://127.0.0.1:8787/mcp.        │
├──────────────────────┼───────────────────────────────────────────────────┤
│ Remote HTTP          │ Public HTTPS — Render or Code Engine.             │
│                      │ IDE: /sse (VS Code) or /mcp (Bob / Windsurf).     │
│                      │ Example: https://mcp-ticket-demo.onrender.com     │
│                      │ Diagnose/CRUD use summitMcp.probeTarget + URL.    │
└──────────────────────┴───────────────────────────────────────────────────┘
```

---

## MCP Tools (10 total)

```
┌──────────────────┬───────────┬────────────────────────────────────────────┐
│ Tool             │ Scope     │ Purpose                                    │
├──────────────────┼───────────┼────────────────────────────────────────────┤
│ describe_server  │ read      │ Identity, auth mode, your scopes, rate     │
│                  │           │ limit, and the full tool inventory.        │
│                  │           │ Call this first when anything is denied.   │
├──────────────────┼───────────┼────────────────────────────────────────────┤
│ search_tickets   │ read      │ Find tickets by status / requester /       │
│                  │           │ keyword. Returns empty + hint on no match. │
├──────────────────┼───────────┼────────────────────────────────────────────┤
│ get_ticket       │ read      │ Fetch one ticket by id, with comments      │
│                  │           │ and attribution.                           │
├──────────────────┼───────────┼────────────────────────────────────────────┤
│ create_ticket    │ write     │ Open a ticket. ALWAYS pass requester_email │
│                  │           │ or the service account owns it and every   │
│                  │           │ reply goes to the bot.                     │
├──────────────────┼───────────┼────────────────────────────────────────────┤
│ add_comment      │ write     │ Comment on a known ticket id.              │
├──────────────────┼───────────┼────────────────────────────────────────────┤
│ close_ticket     │ write     │ Resolve a ticket. Optional resolution note │
│                  │           │ becomes the last comment.                  │
├──────────────────┼───────────┼────────────────────────────────────────────┤
│ list_schemas     │ read      │ Discover queryable schemas before calling  │
│                  │           │ run_query. Replaces query_tickets et al.   │
├──────────────────┼───────────┼────────────────────────────────────────────┤
│ get_schema       │ read      │ Fields and filterable keys for one schema. │
├──────────────────┼───────────┼────────────────────────────────────────────┤
│ run_query        │ read      │ The one query tool. Pass schema= from      │
│                  │           │ list_schemas. Do not invent query_tickets. │
├──────────────────┼───────────┼────────────────────────────────────────────┤
│ lookup_customer  │ pii       │ Customer record. Phone is PII — redacted   │
│                  │           │ unless caller holds the pii scope.         │
└──────────────────┴───────────┴────────────────────────────────────────────┘
```

### Queryable schemas

```
tickets    id · subject · status · requester_email · attribution · created_at
           filterable: status · requester_email · attribution

customers  email · name · plan · region
           filterable: email · region

assets     id · name · site · status
           filterable: status · site
```

---

## Auth model

```
┌──────────┬──────────────────────────────────────────────────────────┐
│ Mode     │ Effect                                                   │
├──────────┼──────────────────────────────────────────────────────────┤
│ off      │ All tools callable. No credential needed. Default.       │
├──────────┼──────────────────────────────────────────────────────────┤
│ write    │ read tools open. write + pii tools need a credential.    │
├──────────┼──────────────────────────────────────────────────────────┤
│ all      │ Every tool call requires a credential.                   │
└──────────┴──────────────────────────────────────────────────────────┘

Accepted credentials
  HTTP  →  Authorization: Bearer <api key>
           Authorization: Basic base64(user:pass)
           x-api-key: <api key>

  stdio →  MCP_API_KEY=<key>  in server process env
           MCP_USERNAME + MCP_PASSWORD  in server process env

Issue API keys on  /admin → API Keys.
Switch mode from   /admin → Auth Mode  or summitMcp.authMode setting.
```

---

## Send-to-chat prompts

The sidebar and panel include one-click prompts that fire directly
into the active LLM chat (VS Code Copilot, IBM Bob, Cursor, Windsurf Cascade).
Clipboard fallback is automatic when the chat API is not exposed.

```
1.  Discover the server
    "Call describe_server. Tell me the auth mode, my scopes,
     rate-limit budget, and which tools need a credential."

2.  Search open tickets
    "Search open tickets, then tell me who owns each one."

3.  create_ticket without requester  ← the attribution-scar lesson
    "Create a ticket … do not pass requester_email.
     Then tell me who owns it."

4.  create_ticket with requester
    "Create a ticket for ada@example.com …
     Then search tickets owned by ada@example.com."

5.  add_comment on a ticket
    "Search open tickets, pick one, then add a comment as
     support@example.com explaining what you found."

6.  close_ticket
    "Search open tickets, pick one, then close_ticket with a
     short resolution note. Tell me the new status and resolved_at."

7.  list_schemas → run_query  ← the schema-discovery lesson
    "List schemas, get the tickets schema,
     then run_query on tickets filtered to status=open."

8.  PII gating on lookup_customer
    "Look up the customer record for ada@example.com.
     Is the phone number visible? Explain why or why not."

9.  Auth modes & scopes
    "Call describe_server and tell me the current auth mode,
     which tools are locked, and what scope each write tool requires."

10. 0 tools discovered  ← the silent-failure lesson
    "If tools/list is empty, tell me why — cwd, MCP_MODE,
     native stdio vs Podman vs Code Engine — and what to try."
```

![Chat tab — one-click prompts firing into IBM Bob](../docs/assets/screenshots/ext-chat-listtickets.png)

![Chat tab — AI creates tickets from a freeform prompt](../docs/assets/screenshots/ext-createdata_via_ai.png)

### Chat delivery chain

```
prompt text
    │
    ├─▶ 1. workbench.action.chat.open  { query, submit }   VS Code Copilot
    ├─▶ 2. inlineChat.start            { query }           VS Code inline
    ├─▶ 3. Bob.focus → paste → Bob.acceptInput             IBM Bob
    ├─▶ 4. windsurf.openCascade        { query }           Windsurf
    ├─▶ 5. aichat.newchataction        { query }           Cursor AI Chat
    ├─▶ 6. composer.startComposer      { query }           Cursor Composer
    ├─▶ 7. workbench.action.chat.newChat → paste → submit  Generic fallback
    └─▶ 8. clipboard + info message                        Last resort
```

---

## Diagnostics

Run **MCP Demo: Diagnose** to execute a full health sweep:

```
Step                    What is checked
──────────────────────────────────────────────────────────────────
Workspace               Folder is open
Server package          server/src/index.js exists
Server dependencies     server/node_modules installed
Native stdio config     .vscode / .cursor / .bob / .windsurf written
Client MCP config       At least one mcp.json present
Podman MCP config       Podman entry present (when probe=podman)
Local Podman            podman version, container status
GET /health             HTTP 200, version, tool count (`cwd` on localhost only)
GET /test               Public read-only smoke passed
tools/list              At least 1 tool returned (the silent failure)
search_tickets          Real call returns TCK- ids
```

![Diagnostics tab — all steps passing](../docs/assets/screenshots/ext-diagnostic.png)

**MCP Demo: Run MCP CRUD test** (panel → MCP Test tab) creates a ticket, reads it, comments, closes it, then searches with `status=all`. It scores the tool JSON (`ok`, `ticket.id`, `status`), not HTTP 200.

![MCP Test tab — full CRUD cycle passing](../docs/assets/screenshots/ext-crudtest.png)

---

## Commands

```
LF MCP Demo: Discover mcp.json          Scan workspace for existing configs
LF MCP Demo: Connect native stdio        Write node entry to all client configs
LF MCP Demo: Connect remote HTTP         Prompt for hosting URL, write SSE/HTTP entry
LF MCP Demo: Use hosting URL in mcp.json Write remote URL + probe Diagnose/CRUD there
LF MCP Demo: Deploy on Render            Open Render Blueprint deploy for this repo
LF MCP Demo: Connect Podman stdio        Write podman run -i entry
LF MCP Demo: Connect Podman HTTP         Write podman HTTP entry
LF MCP Demo: Build & start local Podman  podman build + podman run in one step
LF MCP Demo: Stop local Podman           Stop the running container
LF MCP Demo: Start native HTTP server    Open terminal, run MCP_MODE=http
LF MCP Demo: Diagnose                    Full health sweep + panel
LF MCP Demo: Open diagnostics panel      Panel without running diagnostics
LF MCP Demo: Send prompt to chat         Prompt picker → fire into LLM chat
LF MCP Demo: Chat — search open tickets  One-click canned prompt
LF MCP Demo: Save settings               Persist sidebar form values
LF MCP Demo: Open /health                Open in browser
LF MCP Demo: Open /test                  Open in browser
LF MCP Demo: Open /admin                 Open in browser
LF MCP Demo: Open /tools                 Open in browser
LF MCP Demo: Open /help                  Open in browser
LF MCP Demo: Open mcp.json               Show the written config file
LF MCP Demo: Show quick menu             Status-bar shortcut menu
LF MCP Demo: Register server with all IDEs  Write mcp.json for VS Code, Cursor, Bob, Windsurf
LF MCP Demo: Run MCP CRUD test           create → get → comment → close → search (status=all)
LF MCP Demo: Install bundled server      npm install mcp-ticket-demo into global storage
LF MCP Demo: Update server from npm      Check npm for newer version and install it
Refresh                                  Reload the Resources tree
```

---

## Settings

![Settings tab — probe target, URLs, Podman config, API key](../docs/assets/screenshots/ext-settings.png)

```
summitMcp.probeTarget      auto | native-http | podman | remote
                           Which HTTP host Diagnose, CRUD, and /health use.
                           Set on Setup → Active target.

summitMcp.remoteUrl        Public hosting URL, no path
                           (https://mcp-ticket-demo.onrender.com).

summitMcp.renderApiKey     Render account API key. Deploy on Render uses it
                           to find the live mcp-ticket-demo service URL.

summitMcp.localHttpUrl     Local HTTP URL. Default: http://127.0.0.1:8787

summitMcp.podmanImage      Image name. Default: mcp-ticket-demo:local

summitMcp.podmanContainer  Container name. Default: mcp-ticket-demo

summitMcp.podmanPort       Host port mapped to container 8080. Default: 8787

summitMcp.adminUser        /admin username. Default: demo

summitMcp.adminPassword    /admin password. Change before sharing.

summitMcp.demoToken        Legacy bearer token. Prefer an API key.

summitMcp.apiKey           API key issued on /admin → API Keys.
                           Sent as Authorization: Bearer over HTTP;
                           as MCP_API_KEY to stdio / Podman processes.

summitMcp.autoConnectStdio true (default)
                           Write native stdio into mcp.json on activate
                           if missing. Never overwrites HTTP/SSE.

summitMcp.authMode         off | write | all
                           Auth mode the local server boots with.
```

---

## HTTP endpoints (local HTTP, Podman, and Render)

```
GET  /health         Liveness. Version, tool count. `cwd` only on localhost.
GET  /test           Read-only smoke. `/test?write=1` after admin sign-in creates + closes.
GET  /admin          Admin UI — auth mode, API key management, audit log.
GET  /tools          Tool inventory page.
GET  /help           Setup instructions.
POST /mcp            Streamable HTTP MCP transport (JSON-RPC 2.0).
GET  /sse            Legacy SSE MCP transport.
```

---

## Client compatibility

```
┌─────────────────┬────────┬──────────┬────────────┬─────────┐
│                 │ stdio  │ HTTP/SSE │ Streamable │ Podman  │
│                 │        │          │ HTTP       │ stdio   │
├─────────────────┼────────┼──────────┼────────────┼─────────┤
│ VS Code Copilot │  yes   │  SSE     │    yes     │  yes    │
│ IBM Bob         │  yes   │  —       │    yes     │  yes    │
│ Cursor          │  yes   │  uvx     │    —       │  yes    │
│ Windsurf        │  yes   │  —       │    yes     │  yes    │
│ Cline           │  yes   │  SSE     │    yes     │  yes    │
└─────────────────┴────────┴──────────┴────────────┴─────────┘
```

Cursor does not support Streamable HTTP natively — the extension
writes a `uvx mcp-proxy <sse-url>` stdio shim automatically.

---

## MCP server — standalone use

The server is published separately on npm as `mcp-ticket-demo`.

```bash
# stdio (default)
npx mcp-ticket-demo

# HTTP
MCP_MODE=http npx mcp-ticket-demo

# With auth
AUTH_MODE=write MCP_API_KEY=mykey MCP_MODE=http npx mcp-ticket-demo
```

---

## Talk lessons this demo is built around

```
Lesson 1 — The silent tool-count failure
  tools/list returns 0 tools with no error when the server starts
  but the cwd is wrong or MCP_MODE is unset. The diagnostic step
  reproduces this exactly.

Lesson 2 — Attribution scar
  create_ticket without requester_email returns HTTP 201.
  The ticket exists. The API call "succeeded". But the service
  account owns it and every reply goes to the bot, not the customer.
  The create_ticket prompt demonstrates this in one LLM turn.

Lesson 3 — Schema discovery over tool proliferation
  list_schemas → get_schema → run_query replaces a pile of
  query_tickets / query_assets / query_with_filter tools.
  The model discovers the shape; the server exposes one tool.

Lesson 4 — Laptop paths don't survive a container boundary
  Native stdio uses cwd: serverDir() (absolute, local).
  Podman stdio uses the image — no absolute path.
  Code Engine and Render use the image or a public process — no laptop cwd.
  The "mcp.json worked yesterday, 404 today" seed ticket (TCK-1003)
  illustrates the hostname rotation problem on managed platforms.
```

---

**Author:** Markus van Kempen ·
[markus.van.kempen@gmail.com](mailto:markus.van.kempen@gmail.com) ·
[markusvankempen.github.io](https://markusvankempen.github.io/) ·
[MCP Dev Summit Talk](https://events.linuxfoundation.org/mcp-dev-summit-toronto/program/schedule/?id=1282401) ·
[Talk slides](https://markusvankempen.github.io/linuxfoundation-mcp-dev-summit/#1)

*Personal open-source demo. Not an IBM product.*
