# mcp-ticket-demo

[![npm version](https://img.shields.io/npm/v/mcp-ticket-demo.svg?style=for-the-badge)](https://www.npmjs.com/package/mcp-ticket-demo)
[![npm downloads](https://img.shields.io/npm/dm/mcp-ticket-demo.svg?style=for-the-badge)](https://www.npmjs.com/package/mcp-ticket-demo)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Protocol-5A29E4?style=for-the-badge)](https://modelcontextprotocol.io/)
[![IBM Cloud](https://img.shields.io/badge/IBM-Cloud_Code_Engine-052FAD?style=for-the-badge&logo=ibm&logoColor=white)](https://www.ibm.com/products/code-engine)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](https://github.com/markusvankempen/mcp-ticket-demo/blob/main/LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-mcp--ticket--demo-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/markusvankempen/mcp-ticket-demo)
[![Linux Foundation](https://img.shields.io/badge/Linux_Foundation-MCP_Dev_Summit_Toronto-003366?style=for-the-badge)](https://events.linuxfoundation.org/mcp-dev-summit-toronto/program/schedule/?id=1282401)

A **fully-featured MCP server** that exposes a realistic support-ticketing system over the
Model Context Protocol — 10 tools, schema discovery, three auth modes, API key management,
per-tool gates, rate limiting, PII gating, and a live `/admin` + `/log` dashboard.

Runs as a local stdio child process, a local HTTP server, a Podman container, or a shared
Code Engine endpoint. Every pattern in the server is a reproducible lesson from the talk
**["MCP as a Platform"](https://markusvankempen.github.io/linuxfoundation-mcp-dev-summit/#1)**
at [MCP Dev Summit Toronto 2026](https://events.linuxfoundation.org/mcp-dev-summit-toronto/program/schedule/?id=1282401).

```
npm install -g mcp-ticket-demo
npx mcp-ticket-demo
```

---

## Two transports, one server

```
MCP_MODE=stdio  node src/index.js     ← child process, no port, no URL
MCP_MODE=http   node src/index.js     ← Express: /mcp /sse /health /test /admin /log
```

---

## 10 tools

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
│                  │           │ run_query. Replaces query_* proliferation. │
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

### Resources and prompts

```
resources/list     ticket://TCK-… · tickets://open · schema://tickets|customers|assets
resources/read     same auth as get_ticket / search_tickets / get_schema
                   A denied read is a JSON-RPC error — not a pin-able fake ticket

prompts/list       search-open-tickets · attribution-scar · schema-discovery
                   close-ticket-flow · diagnose-server
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

## Quick start

### stdio (what an IDE spawns)

```bash
npx mcp-ticket-demo
# or
MCP_MODE=stdio npx mcp-ticket-demo
```

Add to your IDE's `mcp.json`:

```json
{
  "mcpServers": {
    "mcp-ticket-demo": {
      "command": "npx",
      "args": ["mcp-ticket-demo"]
    }
  }
}
```

### HTTP

```bash
MCP_MODE=http npx mcp-ticket-demo
# Listening on http://127.0.0.1:8787
```

| Endpoint        | Purpose                                         |
|----------------|-------------------------------------------------|
| `POST /mcp`    | Streamable HTTP MCP transport (JSON-RPC 2.0)    |
| `GET  /sse`    | Legacy SSE MCP transport                        |
| `GET  /health` | Liveness — version, tool count. `cwd` only on localhost |
| `GET  /test`   | Read-only smoke. `/test?write=1` needs admin (create + close) |
| `GET  /admin`  | Auth mode, API keys, tool gates, lab, audit log |
| `GET  /log`    | Live tool counters, call trace, error log       |
| `GET  /tools`  | Tool inventory page                             |
| `GET  /help`   | Guides and architecture reference               |

---

## curl reference

All examples assume the server is running on `http://127.0.0.1:8787`.
Replace the host with your Code Engine URL for remote testing.

### Health and smoke test

```bash
# Liveness check
curl -s http://127.0.0.1:8787/health?format=json | jq .

# Public read-only smoke (search / get / schemas / query — no writes)
curl -s http://127.0.0.1:8787/test?format=json | jq .
```

### MCP tool calls over HTTP (JSON-RPC 2.0)

```bash
BASE=http://127.0.0.1:8787

# Discover the server — always call this first
curl -s -X POST $BASE/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"describe_server","arguments":{}}}' \
  | jq .

# List all tools
curl -s -X POST $BASE/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  | jq .

# Search open tickets
curl -s -X POST $BASE/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_tickets","arguments":{"status":"open","limit":5}}}' \
  | jq .

# Create a ticket WITH requester_email (correct)
curl -s -X POST $BASE/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"create_ticket","arguments":{"subject":"Test from curl","body":"Sent via terminal.","requester_email":"markus.van.kempen@gmail.com"}}}' \
  | jq .

# Create a ticket WITHOUT requester_email — produces the attribution scar (201 but bot owns it)
curl -s -X POST $BASE/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"create_ticket","arguments":{"subject":"Scar demo","body":"No email — service account will own this."}}}' \
  | jq .

# Get one ticket by id
curl -s -X POST $BASE/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"get_ticket","arguments":{"ticket_id":"TCK-1001"}}}' \
  | jq .

# Add a comment
curl -s -X POST $BASE/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"add_comment","arguments":{"ticket_id":"TCK-1001","body":"Confirmed from the terminal.","author":"markus.van.kempen@gmail.com"}}}' \
  | jq .

# Schema discovery + run_query
curl -s -X POST $BASE/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":8,"method":"tools/call","params":{"name":"list_schemas","arguments":{}}}' \
  | jq .

curl -s -X POST $BASE/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":9,"method":"tools/call","params":{"name":"run_query","arguments":{"schema":"tickets","filter":{"status":"open"},"limit":5}}}' \
  | jq .

# lookup_customer — phone is REDACTED without pii scope
curl -s -X POST $BASE/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":10,"method":"tools/call","params":{"name":"lookup_customer","arguments":{"email":"ada@example.com"}}}' \
  | jq .

# Resources — list instances, then read one
curl -s -X POST $BASE/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":13,"method":"resources/list","params":{}}' \
  | jq .

curl -s -X POST $BASE/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":14,"method":"resources/read","params":{"uri":"ticket://TCK-1001"}}' \
  | jq .

# Prompts
curl -s -X POST $BASE/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":15,"method":"prompts/list","params":{}}' \
  | jq .
```

### Authenticated calls (auth mode write or all)

```bash
KEY=mcpk_your_api_key_here

# Pass key in Authorization header
curl -s -X POST $BASE/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{"jsonrpc":"2.0","id":11,"method":"tools/call","params":{"name":"create_ticket","arguments":{"subject":"Authenticated ticket","body":"Sent with an API key.","requester_email":"markus.van.kempen@gmail.com"}}}' \
  | jq .

# Pass key as x-api-key header (alternative)
curl -s -X POST $BASE/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "x-api-key: $KEY" \
  -d '{"jsonrpc":"2.0","id":12,"method":"tools/call","params":{"name":"search_tickets","arguments":{"status":"all"}}}' \
  | jq .
```

### Admin API (requires session or JSON)

```bash
# Health as JSON
curl -s "http://127.0.0.1:8787/health?format=json" | jq .

# Test as JSON (exit code 0 = all steps passed, 1 = failure)
curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8787/test?format=json"

# Generate test data (10 tickets) — needs admin session cookie
# Use browser /admin for the UI flow, or:
curl -s -X POST http://127.0.0.1:8787/admin/generate-data \
  -b "mcp_admin=<your-session-id>" \
  -d "count=10"

# Generate traffic (5 rounds of mixed calls)
curl -s -X POST http://127.0.0.1:8787/admin/generate-traffic \
  -b "mcp_admin=<your-session-id>" \
  -H "Accept: application/json" \
  -d "rounds=5" | jq .
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
```

Accepted credentials:

```
HTTP  →  Authorization: Bearer <api key>
         Authorization: Basic base64(user:pass)
         x-api-key: <api key>

stdio →  MCP_API_KEY=<key>  in server process env
         MCP_USERNAME + MCP_PASSWORD  in server process env
```

Issue API keys on `/admin → API Keys`. Switch mode from `/admin → Auth Mode`.

### Per-tool gates

Each tool can be individually disabled from `/admin → Tool gates` without changing the global
auth mode. A disabled tool returns a `503` with a clear message to the caller instead of
silently failing. Re-enable it from the same panel. Saving a gate or auth-mode change
broadcasts `notifications/tools/list_changed` to connected SSE and Streamable HTTP sessions.

---

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `MCP_MODE` | `stdio` | `stdio` or `http` |
| `PORT` | `8080` | HTTP port |
| `AUTH_MODE` | `off` | `off` / `write` / `all` |
| `HOST` | `127.0.0.1` | `0.0.0.0` inside a container (set automatically) |
| `ADMIN_USER` / `ADMIN_PASSWORD` | `demo` / `demo` | `/admin` login. Default disabled on a public bind until `ADMIN_PASSWORD` is set |
| `CORS_ORIGINS` | unset | Extra `Origin` values allowed on `/mcp`. Localhost and same-host always allowed |
| `API_KEY` / `API_KEY_SCOPES` | unset | Register one key at boot |
| `MCP_USERS` | unset | `"alice:secret:read,write"` — extra logins |
| `MCP_API_KEY` | unset | stdio: credential this process presents |
| `MCP_USERNAME` / `MCP_PASSWORD` | unset | stdio: Basic auth credential |
| `RATE_LIMIT` / `RATE_LIMIT_WINDOW_MS` | `60` / `60000` | Calls per window per caller |
| `RATE_LIMIT_ENABLED` | `1` | Set `0` to disable rate limiting |
| `TENANT_ID` | unset | If set, writes also require `x-tenant-id` header |

---

## Admin pages

| Page | What it does |
|---|---|
| `/admin` | Auth mode, rate limit, API keys, tool gates, lab panel, users, recent tickets, audit trail |
| `/log` | Tool call counters · admin audit trail · full call trace (audit mode) · error log |
| `/tools` | Tool inventory with current scope enforcement |
| `/test` | Read-only smoke as JSON at `/test?format=json`. Writes: `/test?write=1` after admin sign-in |
| `/health` | Process liveness (JSON at `/health?format=json`). `cwd` only on localhost |

### Lab panel (generate data & traffic)

The `/admin` page has a **Lab** section that lets you fill the store and produce log entries
without needing an LLM:

- **Generate data** — seeds up to 40 realistic tickets with mixed statuses, emails, and
  comments. 20% intentionally omit `requester_email` to produce the service-account scar.
- **Generate traffic** — runs N rounds of scripted tool calls covering every log category:
  happy reads, successful writes, bad ticket IDs (error log), invalid credentials (denied
  counter), valid queries, and unknown-schema queries (error log). Enable audit mode on
  `/admin` first to capture the full call trace on `/log`.

---

## What this teaches

```
Lesson 1 — Tool naming is the interface
  search_tickets · get_ticket · create_ticket — each name says
  the action and the noun. Compare to the first draft:
  query_tickets_by_status / query_tickets_by_requester / query_open_tickets.
  Technically correct. Model picked wrong every other call.

Lesson 2 — The silent tool-count failure
  tools/list returns 0 tools with no error when the server starts
  but the cwd is wrong or MCP_MODE is missing. Nothing fails.
  Nothing warns. The tool list is just empty.

Lesson 3 — Attribution scar
  create_ticket without requester_email returns HTTP 201.
  The API call "succeeded". But the service account owns the
  ticket and every reply goes to the bot, not the customer.
  A tool isn't done when the API call succeeds — it's done
  when the next thing that happens is right.

Lesson 4 — Schema discovery over tool proliferation
  list_schemas → get_schema → run_query replaces a pile of
  query_tickets / query_assets / query_with_filter tools.
  The model discovers the shape; the server exposes one tool.

Lesson 5 — The protocol doesn't say who is allowed to call it
  MCP describes tools. It doesn't describe permission. This server
  invents its own: off / write / all auth modes, scoped API keys,
  and refusals that name the required scope and where to get one
  so the model asks instead of looping.

Lesson 6 — Laptop paths don't survive a container boundary
  Native stdio uses an absolute local cwd. Podman and Code
  Engine use the image. The path that worked on your laptop
  is meaningless in the container. And four IDE config files
  (.vscode/ .cursor/ .bob/ .windsurf/) all drift independently
  once a URL changes.
```

---

## VS Code / Bob / Cursor / Windsurf extension

The companion **LF MCP Demo** extension is the control plane for this server — sidebar,
step-by-step diagnostics, end-to-end CRUD test, send-to-chat prompts, and one-click
commands that write IDE config without hand-editing `mcp.json`.

Install from the marketplace:
[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=markusvankempen.lf-mcp-summit-demo) ·
[Open VSX](https://open-vsx.org/extension/markusvankempen/lf-mcp-summit-demo)

Key extension features:

- **Register with all IDEs** — one button writes the server into `.vscode/mcp.json`,
  `.cursor/mcp.json`, `.bob/mcp.json`, and `.windsurf/mcp.json` simultaneously, then shows
  exactly which files were written.
- **MCP Test tab** — runs a full CRUD test (create → get → add_comment → close → search
  with `status=all`) against the HTTP server, scoring the tool payload (not just HTTP 200).
- **Diagnose** — checks workspace, config files, `/health`, `/test`, `tools/list`, and a
  live `search_tickets` call.

---

## Requirements

- Node.js >= 18

## Dependencies

- `@modelcontextprotocol/sdk` — MCP server SDK
- `express` — HTTP transport
- `zod` — schema validation

---

## Author

**Markus van Kempen**

| | |
|---|---|
| 📧 | [markus.van.kempen@gmail.com](mailto:markus.van.kempen@gmail.com) |
| 🌐 | [markusvankempen.github.io](https://markusvankempen.github.io/) |
| 🎤 | [MCP Dev Summit Toronto — Speaking Session](https://events.linuxfoundation.org/mcp-dev-summit-toronto/program/schedule/?id=1282401) |
| 📊 | [Talk slides — MCP as a Platform](https://markusvankempen.github.io/linuxfoundation-mcp-dev-summit/#1) |
| 💻 | [github.com/markusvankempen/mcp-ticket-demo](https://github.com/markusvankempen/mcp-ticket-demo) |

> *No bug too small, no syntax too weird.*

*Personal open-source demo. Not an IBM product.*
