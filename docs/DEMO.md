# mcp-ticket-demo — End-to-End Demo Guide

This document walks through every key feature of the MCP server using live `curl` commands against a locally running HTTP server at **http://127.0.0.1:8787**. It matches server **3.0.1** (19 tools). Demos 1, 3, 14, 15 and 16 were captured against that build; Demos 2 and 4–12 were captured against `1.7.1`, so version strings inside them may differ from what a current server prints. There are **16 demos** in all: Demo 13 is the one-command setup, Demo 14 is a stopwatch read through the schema, Demo 15 listens to the server's events, and Demo 16 sends the same events to an MQTT broker. Every output block was captured from a running server. The VS Code extension's **MCP Test** tab runs a similar CRUD cycle against the same host — see [EXTENSION.md](EXTENSION.md).

Each section maps to a lesson in the talk **[MCP as a Platform](https://markusvankempen.github.io/linuxfoundation-mcp-dev-summit/#1)**.

---

## Prerequisites

```bash
# Install (global)
npm install -g mcp-ticket-demo

# Or run directly without installing
npx mcp-ticket-demo
```

---

## Step 0 — Start the server in HTTP mode

```bash
MCP_MODE=http npx mcp-ticket-demo
```

Expected output in your terminal:

```
mcp-ticket-demo http on 127.0.0.1:8787
  /health  /test  /admin  /tools  /sse  /mcp
  auth mode=off  api keys=0  rate limit=60/60s
  cwd=/path/to/your/server
```

The server binds to `127.0.0.1:8787` by default. Every demo below uses this address.

> All `curl` commands require both `Accept` headers — the server enforces
> `application/json, text/event-stream` to support both JSON and SSE clients.

---

## Demo 1 — Health check: is it alive?

```bash
curl -s "http://127.0.0.1:8787/health?format=json"
```

**Output:**

```json
{
  "ok": true,
  "service": "mcp-ticket-demo",
  "version": "3.0.1",
  "transport": "http",
  "tools": 19,
  "hostname": "127.0.0.1:8787",
  "port": 8787,
  "security": {
    "authMode": "off",
    "writeToolsLocked": false,
    "allToolsLocked": false,
    "activeKeyCount": 0,
    "rateLimit": { "enabled": true, "limit": 60, "windowMs": 60000 },
    "scopes": ["read", "write", "pii", "admin"]
  },
  "endpoints": {
    "health": "/health",
    "test": "/test",
    "admin": "/admin",
    "tools": "/tools",
    "sse": "/sse",
    "mcp": "/mcp"
  },
  "mcpEntryPoints": {
    "connect": { "streamableHttp": "POST /mcp (initialize first)", "sse": "GET /sse, then POST /messages?sessionId=…" },
    "list_tools": { "method": "tools/list" },
    "first_call": { "method": "tools/call", "tool": "describe_server", "note": "Auth mode, your scopes, rate limit and every tool. Always open." },
    "discover_data": { "method": "tools/call", "tools": ["get_schema", "run_query"] },
    "listen": { "sse": "GET /sse?events=ticket.*,timer.*&topic=…", "streamableHttp": "GET /mcp?events=…  with Mcp-Session-Id", "note": "Events are off until update_settings (admin) turns them on with events.enabled=true." }
  },
  "cwd": "/path/to/server"
}
```

> **Lesson:** `/health` tells you the process is alive and how many tools are registered.
> `endpoints` are URL paths; `mcpEntryPoints` is what to ask once connected (start with `describe_server`).
> `cwd` only appears on localhost — it's suppressed on public deployments.
> **Being alive is not the same as working.**

---

## Demo 2 — Smoke test: does it actually work?

```bash
curl -s "http://127.0.0.1:8787/test?format=json"
```

**Output:**

```json
{
  "ok": true,
  "writes": false,
  "steps": [
    { "name": "tickets (open)",     "ok": true, "detail": "1 open ticket(s)" },
    { "name": "ticket TCK-1001",    "ok": true, "detail": "TCK-1001" },
    { "name": "schemas",            "ok": true, "detail": "tickets, customers, assets, timers, system, settings, events, users, api_keys, trace, errors, counters" },
    { "name": "run_query tickets",  "ok": true, "detail": "1 row(s)" }
  ],
  "at": "2026-10-02T18:58:15.286Z"
}
```

> **Lesson:** `/test` runs every read-only tool in sequence and scores the payloads —
> not just HTTP 200. A green `/health` with a failing `/test` means the process started
> but the tools don't work. **Alive ≠ works.**

---

## Demo 3 — Discover the server

Always call `describe_server` first. It tells you the auth mode, your scopes, rate-limit budget, and what every tool needs.

```bash
curl -s -X POST "http://127.0.0.1:8787/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"describe_server","arguments":{}}}'
```

**Output (key fields):**

```json
{
  "ok": true,
  "server": { "name": "mcp-ticket-demo", "version": "3.0.1", "tool_count": 19 },
  "you": {
    "principal": "anonymous",
    "type": "anonymous",
    "authenticated": false,
    "scopes": [],
    "effective_scopes": []
  },
  "auth": {
    "mode": "off",
    "modes": ["off", "write", "all"],
    "meaning": "no credential needed",
    "active_api_keys": 0,
    "tenant_header_required": false
  },
  "rate_limit": { "enabled": true, "limit": 60, "windowMs": 60000, "used": 1, "remaining": 59 },
  "resources": ["ticket://{id}", "tickets://open", "schema://{name}"],
  "prompts": ["search-open-tickets", "attribution-scar", "schema-discovery", "close-ticket-flow", "diagnose-server"],
  "protocols": { "stdio": true, "streamableHttp": true, "sse": true },
  "tools": "19 entries — name, required_scope, available, purpose (abridged below)",
  "next": "Auth is off — every enabled tool is callable. ..."
}
```

The `tools` list, as `name (required scope)`:

| Scope | Tools |
|---|---|
| `read` | `describe_server`, `get_schema`, `run_query`, `generate_traffic`, `start_timer`, `stop_timer`, `push_timer`, `watch_system` |
| `write` | `create_ticket`, `add_comment`, `close_ticket`, `push_log` |
| `admin` | `update_settings`, `set_mqtt`, `create_user`, `delete_user`, `issue_api_key`, `revoke_api_key`, `import_settings` |

That is 6 ticket-desk tools, 8 operating tools, 3 timer tools, 1 event tool (`push_log`) and `watch_system`: 19 in all. No tool needs the `pii` scope; it unmasks one field of `run_query` (Demo 9). Every operating tool except `generate_traffic` needs an admin credential, even while auth mode is `off`, and so do the `users`, `api_keys`, `trace`, `errors` and `counters` queries. The timer tools are `read` scope (Demo 14). `push_log` is `write`, and choosing which events are announced is `update_settings`, which is `admin` (Demo 15).

> **Lesson:** `describe_server` is always open — even when auth mode is `all`.
> A client that cannot ask "what do you need from me?" can only guess.
> Call it first, and again after any denial.

---

## Demo 4 — Find tickets with `run_query`

```bash
curl -s -X POST "http://127.0.0.1:8787/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"run_query","arguments":{"schema":"tickets","filter":{"status":"open"},"limit":5}}}'
```

**Output:** a list returns the short fields only.

```json
{
  "ok": true,
  "schema": "tickets",
  "count": 1,
  "rows": [
    {
      "id": "TCK-1001",
      "subject": "0 tools discovered after I registered the server",
      "status": "open",
      "requester_email": "ada@example.com",
      "attribution": "customer",
      "created_at": "2026-09-19T17:00:24.843Z"
    }
  ],
  "next": "To read one ticket in full, run this query again with filter {\"id\":\"TCK-1001\"} (or read ticket://TCK-1001). To comment or close, call add_comment or close_ticket. Do not call get_schema to act on the ticket."
}
```

The filter keys are `id`, `status` (`open`, `pending`, `solved`; `all` or no status lists every ticket, newest first), `requester_email`, `attribution` and `query` (a keyword in the subject or body, any case). `limit` goes up to 50, default 10. Filter on `id` to read one ticket with every field, body and comments included:

```bash
curl -s -X POST "http://127.0.0.1:8787/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"run_query","arguments":{"schema":"tickets","filter":{"id":"TCK-1001"}}}}'
```

```json
{
  "ok": true,
  "schema": "tickets",
  "count": 1,
  "rows": [
    {
      "id": "TCK-1001",
      "subject": "0 tools discovered after I registered the server",
      "body": "The orchestrator is in a cloud container. I handed it /Users/me/my-mcp/index.js.",
      "status": "open",
      "requester_email": "ada@example.com",
      "attribution": "customer",
      "comments": [
        {
          "author": "ada@example.com",
          "body": "No error. No warning. Just an empty tool list.",
          "at": "2026-09-19T17:00:24.842Z"
        }
      ],
      "created_at": "2026-09-19T17:00:24.843Z"
    }
  ],
  "next": "Ticket TCK-1001 is owned by ada@example.com. Use add_comment to reply or close_ticket to resolve it."
}
```

> **Note:** The seed ticket TCK-1001 is itself about the `cwd` lesson —
> a cloud container receiving a laptop absolute path, returning 0 tools with no error.

---

## Demo 5 — The attribution scar

This is the single most important lesson: **a 201 does not mean the tool worked correctly.**

### Step A — Create WITHOUT `requester_email` (the scar)

```bash
curl -s -X POST "http://127.0.0.1:8787/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc":"2.0","id":3,"method":"tools/call",
    "params":{"name":"create_ticket","arguments":{
      "subject": "Missing hostname in mcp.json",
      "body": "The remote URL changed after redeploy and the config still has the old one."
    }}
  }'
```

**Output — notice `attribution: service_account` and the warning:**

```json
{
  "ok": true,
  "status": 201,
  "created": true,
  "ticket": {
    "id": "TCK-1005",
    "subject": "Missing hostname in mcp.json",
    "body": "The remote URL changed after redeploy and the config still has the old one.",
    "status": "open",
    "requester_email": "mcp-bot@service.local",
    "attribution": "service_account"
  },
  "warning": "201 Created. The requester is the API service account. The platform will mail every reply to the bot, not the customer.",
  "next": "Call create_ticket again with requester_email set to the real customer so the downstream email thread routes correctly."
}
```

**The API call succeeded. The ticket is broken.** Every reply will go to `mcp-bot@service.local` — the bot. The customer never hears back.

### Step B — Create WITH `requester_email` (correct)

```bash
curl -s -X POST "http://127.0.0.1:8787/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc":"2.0","id":4,"method":"tools/call",
    "params":{"name":"create_ticket","arguments":{
      "subject": "Login fails after password reset",
      "body": "After resetting my password I cannot log in. Getting 401 on every attempt.",
      "requester_email": "ada@example.com"
    }}
  }'
```

**Output — `attribution: customer`, replies route correctly:**

```json
{
  "ok": true,
  "status": 201,
  "created": true,
  "ticket": {
    "id": "TCK-1004",
    "subject": "Login fails after password reset",
    "body": "After resetting my password I cannot log in. Getting 401 on every attempt.",
    "status": "open",
    "requester_email": "ada@example.com",
    "attribution": "customer"
  },
  "next": "Ticket TCK-1004 is owned by ada@example.com. Replies will reach the customer."
}
```

> **Lesson:** A tool isn't done when the API call succeeds.
> It's done when the next thing that happens is right.

---

## Demo 6 — Comment on a ticket

```bash
curl -s -X POST "http://127.0.0.1:8787/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc":"2.0","id":5,"method":"tools/call",
    "params":{"name":"add_comment","arguments":{
      "ticket_id": "TCK-1004",
      "body": "Confirmed — the 401 happens only when the token was issued before the reset. Invalidating old tokens now.",
      "author": "support@example.com"
    }}
  }'
```

**Output:**

```json
{
  "ok": true,
  "ticket": {
    "id": "TCK-1004",
    "status": "open",
    "requester_email": "ada@example.com",
    "attribution": "customer",
    "comments": [
      {
        "author": "support@example.com",
        "body": "Confirmed — the 401 happens only when the token was issued before the reset. Invalidating old tokens now.",
        "at": "2026-09-19T17:32:05.816Z"
      }
    ]
  },
  "next": "Comment added on TCK-1004. Call run_query with schema=tickets and filter id to reread the thread, or close_ticket if this resolves it."
}
```

---

## Demo 7 — Close a ticket

```bash
curl -s -X POST "http://127.0.0.1:8787/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc":"2.0","id":6,"method":"tools/call",
    "params":{"name":"close_ticket","arguments":{
      "ticket_id": "TCK-1004",
      "resolution": "Old tokens invalidated. Customer confirmed login successful.",
      "closed_by": "support@example.com"
    }}
  }'
```

**Output:**

```json
{
  "ok": true,
  "ticket": {
    "id": "TCK-1004",
    "status": "solved",
    "requester_email": "ada@example.com",
    "attribution": "customer",
    "comments": [
      {
        "author": "support@example.com",
        "body": "Confirmed — the 401 happens only when the token was issued before the reset. Invalidating old tokens now.",
        "at": "2026-09-19T17:32:05.816Z"
      },
      {
        "author": "support@example.com",
        "body": "Old tokens invalidated. Customer confirmed login successful.",
        "at": "2026-09-19T17:32:05.833Z"
      }
    ],
    "resolved_at": "2026-09-19T17:32:05.833Z"
  },
  "alreadyClosed": false,
  "next": "Ticket TCK-1004 is now solved. resolved_at: 2026-09-19T17:32:05.833Z."
}
```

> **Note:** `close_ticket` is `idempotentHint: true` — calling it again on an already-solved ticket returns `alreadyClosed: true` without error.

---

## Demo 8 — Schema discovery (one query tool beats a pile)

Instead of `query_tickets`, `query_by_status`, `query_open_tickets`, `query_assets`... the server exposes **two tools** that compose: `get_schema` and `run_query`.

### Step 1 — Discover available names

```bash
curl -s -X POST "http://127.0.0.1:8787/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"get_schema","arguments":{}}}'
```

**Output (abridged: 34 names in all, the 3 `data` shapes, the 12 `query` names and the 19 tools):**

```json
{
  "ok": true,
  "schemas": [
    { "name": "server",    "kind": "data",  "description": "Shape of server identity. Not a tool and not a run_query name. Call describe_server to read it." },
    { "name": "tickets",   "kind": "query", "description": "Query name for run_query. This is how tickets are found and read; there is no search_tickets or get_ticket tool. …" },
    { "name": "customers", "kind": "query", "description": "Query name for run_query. This is how a customer is read; there is no lookup_customer tool. …" },
    { "name": "settings",  "kind": "query", "description": "Query name for run_query. One row: the saved settings. …" },
    { "name": "trace",     "kind": "query", "description": "Query name for run_query. The call trace, newest first … Needs an admin credential, even when auth mode is off." },
    { "name": "describe_server", "kind": "tool", "description": "…" }
  ],
  "next": "Use kind. data: call the tool named in that description … query: only tickets, customers, assets, timers, system, settings, events, users, api_keys, trace, errors or counters may go to run_query. tool: call that tool. Call get_schema with a name to see its arguments or fields; that does not run the tool."
}
```

### Step 2 — Get the shape of a schema

The same tool, now with a `name`.

```bash
curl -s -X POST "http://127.0.0.1:8787/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":8,"method":"tools/call","params":{"name":"get_schema","arguments":{"name":"tickets"}}}'
```

**Output:**

```json
{
  "ok": true,
  "schema": {
    "name": "tickets",
    "fields": ["id", "subject", "status", "requester_email", "attribution", "created_at", "body", "comments", "resolved_at"],
    "defaultFields": ["id", "subject", "status", "requester_email", "attribution", "created_at"],
    "filterable": ["id", "status", "requester_email", "attribution", "query"]
  },
  "next": "run_query may use schema=tickets. Filter keys: id, status, requester_email, attribution, query. There is no search_tickets or get_ticket tool: this query finds tickets (filter query is a keyword, id is one ticket)."
}
```

### Step 3 — Query with the discovered shape

```bash
curl -s -X POST "http://127.0.0.1:8787/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc":"2.0","id":9,"method":"tools/call",
    "params":{"name":"run_query","arguments":{
      "schema": "tickets",
      "filter": {"status": "open"},
      "limit": 5
    }}
  }'
```

**Output:**

```json
{
  "ok": true,
  "schema": "tickets",
  "count": 2,
  "rows": [
    {
      "id": "TCK-1005",
      "subject": "Missing hostname in mcp.json",
      "status": "open",
      "requester_email": "mcp-bot@service.local",
      "attribution": "service_account"
    },
    {
      "id": "TCK-1001",
      "subject": "0 tools discovered after I registered the server",
      "status": "open",
      "requester_email": "ada@example.com",
      "attribution": "customer"
    }
  ]
}
```

> **Lesson:** Two tools (`get_schema → run_query`) replace seven near-identical `query_*` tools, and discovery is one tool, not a list tool plus a get tool. The model discovers the data shape at runtime — no hallucinated tool names.

---

## Demo 9 — PII gating on `run_query` customers

There is no customer tool. `run_query` with `schema=customers` is a `read` call, so a read-only caller, even an anonymous one with auth off, gets the row. Without a `pii`-scoped credential the `phone` field is the text `REDACTED`.

```bash
curl -s -X POST "http://127.0.0.1:8787/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":10,"method":"tools/call","params":{"name":"run_query","arguments":{"schema":"customers","filter":{"email":"ada@example.com"}}}}'
```

**Output — phone is `REDACTED`:**

```json
{
  "ok": true,
  "schema": "customers",
  "count": 1,
  "rows": [
    {
      "email": "ada@example.com",
      "name": "Ada Example",
      "plan": "enterprise",
      "region": "ca-tor",
      "phone": "REDACTED"
    }
  ],
  "next": "Phone is REDACTED. Present an API key with the pii scope (create one on /admin → API keys) and run this query again to see it."
}
```

> **Lesson:** Scope-gated field visibility. Same tool, same endpoint — different scopes expose different fields. The call is never refused; the `phone` field is what is gated. Issue a `pii`-scoped key on `/admin → API keys`, send it as `Authorization: Bearer <key>`, and the phone appears.

---

## Demo 10 — Auth modes: the protocol doesn't say who is allowed to call it

### Step A — Set auth mode to `write` (lock write tools)

Open `/admin` in a browser → Auth Mode → select **write** → Save.

Or via the admin API:

```bash
# Login first
curl -s -c /tmp/mcp_cookies.txt -X POST "http://127.0.0.1:8787/admin/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=demo&password=demo"

# Set mode
curl -s -b /tmp/mcp_cookies.txt -X POST "http://127.0.0.1:8787/admin/security" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "authMode=write"
```

### Step B — Call a write tool without a credential

```bash
curl -s -X POST "http://127.0.0.1:8787/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc":"2.0","id":11,"method":"tools/call",
    "params":{"name":"create_ticket","arguments":{
      "subject": "Auth test",
      "body": "Will this be denied?",
      "requester_email": "ada@example.com"
    }}
  }'
```

**Output — scoped refusal, not a bare 403:**

```json
{
  "ok": false,
  "error": "create_ticket requires authentication because auth mode is \"write\". Send Authorization: Bearer <api key> (create one on /admin → API keys) or HTTP Basic with a username and password. Over stdio set MCP_API_KEY in the server env. Call describe_server if you are unsure which tools need a credential.",
  "status": 401,
  "denied": true,
  "principal": "anonymous",
  "next": "Call describe_server to see the auth mode and the scopes you hold. Present a credential with the scope named in the error, then retry this tool once."
}
```

> **Lesson:** A bare `403` makes the model retry in a loop and eventually tell the user the system is "unavailable." A refusal that names the required scope and where to get a key makes the model **ask** instead of loop.

### Step C — Issue a write-scoped key and retry

```bash
# Issue key via admin (or use /admin UI)
curl -s -b /tmp/mcp_cookies.txt -X POST "http://127.0.0.1:8787/admin/keys" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "label=demo-write-key&scopes=write&expiresInDays=1"
```

Then copy the `mcpk_…` key from `/admin` and use it:

```bash
KEY="mcpk_your_key_here"

curl -s -X POST "http://127.0.0.1:8787/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer $KEY" \
  -d '{
    "jsonrpc":"2.0","id":12,"method":"tools/call",
    "params":{"name":"create_ticket","arguments":{
      "subject": "Authenticated ticket",
      "body": "Created with a write-scoped API key.",
      "requester_email": "ada@example.com"
    }}
  }'
```

**Output — ticket created, attributed correctly:**

```json
{
  "ok": true,
  "status": 201,
  "ticket": {
    "id": "TCK-1007",
    "subject": "Authenticated ticket",
    "requester_email": "ada@example.com",
    "attribution": "customer"
  },
  "next": "Ticket TCK-1007 is owned by ada@example.com. Replies will reach the customer."
}
```

### Reset auth mode to `off`

The `/admin` form is one way. The same change is one tool call, `update_settings` (admin scope, even while auth is `off`). Set `ADMIN_LOGIN` to the admin user name and password joined by a colon (on a laptop both are `demo`):

```bash
curl -s -X POST "http://127.0.0.1:8787/mcp" -u "$ADMIN_LOGIN" \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":13,"method":"tools/call","params":{"name":"update_settings","arguments":{"authMode":"off"}}}'
```

It answers `{ok, settings, changed[], next}`: the whole settings row after the change and the names of the fields that changed. If any part of a patch is refused, nothing changes. Read the current values back with `run_query` and `schema=settings`; with the call trace on (`update_settings` with `audit=true`), `run_query` with `schema=trace`, `errors` or `counters` shows what was called (admin, at most 50 rows per call).

```bash
curl -s -b /tmp/mcp_cookies.txt -X POST "http://127.0.0.1:8787/admin/security" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "authMode=off"
```

---

## Demo 11 — The silent 0-tools failure (cwd lesson)

The most dangerous failure in MCP is **silent**: zero tools with no error, no warning, nothing in a log.

### Reproduce it

Edit your `.vscode/mcp.json` (or `.cursor/mcp.json` etc.) to use a path that doesn't exist:

```json
{
  "servers": {
    "mcp-ticket-demo": {
      "type": "stdio",
      "command": "node",
      "args": ["src/index.js"],
      "cwd": "/tmp/this-does-not-exist"
    }
  }
}
```

Ask the model to search tickets. It reports it has no tools. **No error. No warning.**

### What happened

Node tries to resolve `src/index.js` relative to `/tmp/this-does-not-exist`. The file doesn't exist. Node exits immediately. The MCP client reads an empty response and reports `0 tools discovered`.

### The fix — relative path via npm

```json
{
  "servers": {
    "mcp-ticket-demo": {
      "type": "stdio",
      "command": "npx",
      "args": ["mcp-ticket-demo"]
    }
  }
}
```

`npx` resolves the package location itself — no absolute path, no `cwd` required.

### Or fix it with the extension

Command palette → **LF MCP Demo: Register server with all IDEs**

This writes the correct entry into all four client configs simultaneously:
- `.vscode/mcp.json`
- `.cursor/mcp.json`
- `.bob/mcp.json`
- `.windsurf/mcp.json`

### Diagnose it

Command palette → **LF MCP Demo: Diagnose**

```
✅ Workspace
✅ Server package
✅ Server dependencies
✅ Native stdio config
✅ Client MCP config
✅ GET /health          200 · 10 tools · cwd=/correct/path
✅ GET /test            4 steps passed
❌ tools/list           0 tools discovered
   next: Check cwd, MCP_MODE, and that you did not hand a laptop path to a container.
```

The diagnostic catches the exact step that failed and tells you what to fix.

> **Lesson:** The extension turns "something is broken" into "this step failed, here's why, here's what to try next."

---

## Demo 12 — Naive mode: bare 403 vs rich error (the retry-loop lesson)

This is a **live contrast demo** — same prompt, same model, same server. The only thing that changes is one toggle on `/admin`.

> **Lesson:** A tool isn't done when the API call succeeds. An error message isn't done when it says "no". It's done when the next thing the model does is right.

### Setup

1. Set auth mode → **write** on `/admin → Auth Mode` (so write tool denials actually fire).
2. Leave naive mode **off** for now.

### Step A — Hardened path (naive mode OFF)

Fire the `create_ticket with requester` prompt into your LLM chat:

```
Create a ticket for ada@example.com about a missing hostname.
Then search tickets owned by ada@example.com.
```

**What happens:** The model calls `create_ticket`, gets denied, reads the error:

```json
{
  "ok": false,
  "error": "create_ticket requires authentication because auth mode is \"write\". Send Authorization: Bearer <api key> (create one on /admin → API keys) or HTTP Basic...",
  "status": 401,
  "denied": true,
  "next": "Call describe_server to see the auth mode and the scopes you hold..."
}
```

The model **stops and asks** the user for a credential. One exchange. Done.

### Step B — Enable naive mode

On `/admin → Security → 🎭 Naive mode`, check **Enable naive mode** and click **Save**.

The panel turns amber. A warning banner appears: *"⚠️ Naive mode is ON"*.

### Step C — Same prompt, naive mode ON

Fire the identical prompt again.

**What happens:** The model calls `create_ticket`, gets:

```json
{
  "ok": false,
  "error": "forbidden",
  "status": 403,
  "denied": true,
  "principal": "anonymous"
}
```

No scope name. No `next` field. No hint.

The model **retries** — maybe with a slightly different payload. Gets the same 403. Retries again. After 3–5 attempts it gives up and tells the user: *"The server is unavailable or you don't have permission."*

The user has no idea what permission they need or how to get it.

### Step D — Turn naive mode off

Uncheck **Enable naive mode** on `/admin` and click **Save**. The amber panel disappears.

Fire the prompt once more — the model asks for a key in one turn.

> **The contrast the audience sees:** Same model. Same server. Same prompt. The only difference is whether the error message names the required scope. That one field is the difference between a model that helps and a model that loops.

### curl — reproduce the naive denial directly

```bash
# Ensure auth mode is write
curl -s -b /tmp/mcp_cookies.txt -X POST http://127.0.0.1:8787/admin/security \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "authMode=write"

# Enable naive mode
curl -s -b /tmp/mcp_cookies.txt -X POST http://127.0.0.1:8787/admin/naive-mode \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "enabled=1"

# Call create_ticket with no credential — observe bare 403
curl -s -X POST http://127.0.0.1:8787/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"create_ticket","arguments":{"subject":"Naive test","body":"Will this be denied?","requester_email":"ada@example.com"}}}'

# Disable naive mode — same call now returns the actionable error
curl -s -b /tmp/mcp_cookies.txt -X POST http://127.0.0.1:8787/admin/naive-mode \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "enabled=0"

# Reset auth mode
curl -s -b /tmp/mcp_cookies.txt -X POST http://127.0.0.1:8787/admin/security \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "authMode=off"
```

---

## Auth modes — quick reference

| Mode | What's locked | When to use |
|---|---|---|
| `off` | Nothing — every tool open | Local laptop dev (default) |
| `write` | `create_ticket` `add_comment` `close_ticket` need a credential. Read tools stay open. | Shared server where reads are safe but writes need intent |
| `all` | Every tool except `describe_server` | Public URL where any caller needs a key |

Set via `/admin → Auth Mode` or `AUTH_MODE=write npx mcp-ticket-demo`.

---

## Scope reference

| Scope | Implies | What it unlocks |
|---|---|---|
| `read` | — | All read tools |
| `write` | `read` | Write tools + all read tools |
| `pii` | `read` | Unredacted `phone` in `run_query` with `schema=customers` (no tool needs it) |
| `admin` | `read + write + pii` | `update_settings` (mode, rate limit, gates, locks, scopes, events), users, keys, MQTT, import, and the `users`, `api_keys`, `trace`, `errors` and `counters` queries |

Issue keys on `/admin → API Keys`. Revoke them from the same page.

---

## Demo 13 — Set the whole demo up with one command

Demos 10–12 each change a setting by hand. The command line (and **Admin → Remote config → Demo setup**, and the extension's **Remote config** tab) does all of it, and then proves it worked by acting as each role. Run it against a server you own: it changes the auth mode, rate limit, users and keys.

The server from Step 0 is running. In a second terminal:

```bash
npx mcp-ticket-demo demo apply --user demo --password demo --keys-file demo-keys.json
```

```
  ✓ Connect — http://127.0.0.1:8787/mcp accepted the credential (1 users).
  ✓ create_user demo-reader — scopes read
  ✓ create_user demo-writer — scopes read + write
  ✓ create_user demo-pii — scopes read + pii
  ✓ create_user demo-admin — scopes admin
  ✓ issue_api_key demo read key — issued mcpk_17f939c7…
  …
  ✓ update_settings audit — call trace on
  ✓ generate_traffic — 3 rounds recorded. No tickets or settings changed.
  ✓ update_settings authMode — write: reads stay open, writes need a key or a login
  ✓ update_settings rateLimit — 30 calls per 60 s per caller
  ✓ settings — auth write · 30 calls per 60 s · trace on
15 of 15 passed
```

Without `--yes` it asks first, and without a terminal it refuses instead of guessing. The four key secrets are printed once and saved to `demo-keys.json`, readable by you only. The password for the four demo users is `demo-pass`.

Now test it:

```bash
npx mcp-ticket-demo demo check --user demo --password demo --keys-file demo-keys.json
```

```
  ✓ Auth mode — is write, demo setup sets write
  ✓ Anonymous can read — run_query on tickets works with no credential
  ✓ Anonymous cannot write — refused with 401
  ✓ demo-reader cannot write — refused with 403: demo-reader has scopes [read] but create_ticket requires the "write" scope. …
  ✓ demo-writer can write — created TCK-1004
  ✓ demo-reader cannot see PII — phone is REDACTED
  ✓ demo-pii sees the phone number — phone is visible
  ✓ demo-reader cannot use admin tools — refused with 403
  ✓ demo-admin can use admin tools — run_query users works
  ✓ A wrong password is refused — refused with 401
  ✓ run_query api_keys hides secrets — no key secret is in the list
  ✓ Log hides passwords — the demo password is not in the exported log
  …
29 of 29 passed
```

That is Demo 10 (auth modes), Demo 9 (PII) and the scope table, in one run. The check leaves one solved `Demo check` ticket behind. If a step fails, the command exits `1`, the failing line starts with `✗`, and it says to run `demo apply`.

Put everything back:

```bash
npx mcp-ticket-demo demo remove --user demo --password demo
```

Remove revokes the keys, deletes the demo users, and restores auth `off`, 60 calls per 60 s and the trace off. It sets the rate limit first, so a caller that used up the 30-call budget can still finish the job.

Useful variations: `--skip users,keys,auth,rate,audit,traffic` leaves parts alone, `--json` prints one document for scripts, and `--url https://your-host` points it at a deployed server. The Remote config page and the command line run the same steps, so one can check what the other applied.

---

## Demo 14 — A stopwatch through the schema

Two tools start and stop a timer. There is **no `get_timer`**. You read a timer with `run_query`, the same tool that reads tickets, customers and assets. Actions are tools; reads come from the schema.

Each timer tool is declared once, in `server/src/timer-tools.js`. The catalog row, the MCP registration, what `get_schema` shows and the example on the Tools page are all generated from that one definition.

### Start two timers

```bash
curl -s -X POST "http://127.0.0.1:8787/mcp" -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"start_timer","arguments":{"seconds":2,"label":"demo"}}}'
# and a stopwatch: leave seconds out
#   ... "arguments":{"label":"stopwatch"}
```

**Output (countdown):**

```json
{
  "ok": true,
  "timer": {
    "id": "TMR-1",
    "label": "demo",
    "seconds": 2,
    "state": "running",
    "started_at": "2026-10-02T13:19:20.062Z",
    "ends_at": "2026-10-02T13:19:22.062Z",
    "stopped_at": null,
    "elapsed_ms": 0,
    "remaining_ms": 2000
  },
  "next": "Countdown TMR-1 ends in 2 s. Read it with run_query (schema=timers, filter {\"id\":\"TMR-1\"}). Query again after 2 s; do not poll in a loop."
}
```

The stopwatch comes back as `TMR-2` with `"seconds": null`, `"ends_at": null` and `"remaining_ms": null`.

### Read them through the schema

```bash
... "name":"run_query","arguments":{"schema":"timers","fields":["id","label","state","elapsed_ms","remaining_ms"]}
```

```json
{
  "ok": true,
  "schema": "timers",
  "count": 2,
  "rows": [
    { "id": "TMR-1", "label": "demo",      "state": "running", "elapsed_ms": 113, "remaining_ms": 1887 },
    { "id": "TMR-2", "label": "stopwatch", "state": "running", "elapsed_ms": 59,  "remaining_ms": null }
  ],
  "next": "TMR-1 has 2 s left. Query again after that; do not poll in a loop. Stop a timer with stop_timer."
}
```

Nothing ticks in the background. `state`, `elapsed_ms` and `remaining_ms` are worked out at the moment you ask.

### Stop the stopwatch, wait, read again

```bash
... "name":"stop_timer","arguments":{"timer_id":"TMR-2"}
```

`stop_timer` returns `"state": "stopped"` and `"elapsed_ms": 115`. Calling it again is harmless: `"alreadyOver": true`, and the `next` text says not to retry. Two seconds later:

```json
{
  "rows": [
    { "id": "TMR-1", "state": "finished", "elapsed_ms": 2000, "remaining_ms": 0 },
    { "id": "TMR-2", "state": "stopped",  "elapsed_ms": 115,  "remaining_ms": null }
  ],
  "next": "No timer is running. state is running, finished or stopped; elapsed_ms is the time it ran. Start another with start_timer."
}
```

The countdown ended by itself. No clock was running; `finished` is worked out from the start time.

### The schema describes it

`get_schema` with `name=timers` lists the fields and the filter keys (`id`, `state`, `label`). With `name=start_timer` it shows the arguments, taken from the tool's real input schema:

```json
{
  "name": "start_timer",
  "kind": "tool",
  "inputSchema": { "seconds": "number (optional)", "label": "string (optional)" },
  "outputSchema": { "properties": ["ok", "timer", "next"] }
}
```

An unknown filter key is refused, and the error names the keys you can use:

```json
{
  "ok": false,
  "error": "run_query cannot filter timers by priority. Filter keys for timers: id, state, label.",
  "next": "Use only id, state, label in filter, or drop the filter. get_schema name=timers lists them."
}
```

> **Lesson:** a new capability does not need a new tool for every read. `start_timer` and `stop_timer` change state, so they are tools. Reading is a query, so it goes through `run_query` and the schema, with filters, field projection and one `get_schema` to learn the shape.
> Timers are `read` scope, kept in memory, at most 50, and lost when the server restarts.

From a terminal: `mcp-ticket-demo call start_timer seconds=30 label=demo`, then `mcp-ticket-demo call run_query schema=timers`.

---

## Demo 15 — Listen to the server

Until now every call was a question and an answer. Events turn it round: the server tells a listening client what happened, as it happens. A ticket opened, a timer ticking, a line sent, a setting changed. They are **off by default**, and you choose which kinds the server announces.

The quickest way to see it: open `/admin#adm-events` (or the Events tab of `/clients/browser.html`) and press **Run the demo**. It turns events on, listens, starts a timer and has it report. The timer is set just above the button: **Countdown** or **Clock** (a heartbeat that sends the time as it counts up), how long it **Runs for** (default 30 s, up to 3600) and how often it reports **Every** (default 5 s). Try Countdown, 120 s, every 5 s; then Clock, 60 s, every 10 s. **Push a timer** uses the same settings. **You do not need an admin credential for the timer part**: `push_timer` switches timer events on itself. With the Connection set to `demo` / `demo` (the laptop default admin) the demo also switches on log lines and ticket events. The steps below do the same by hand.

No admin credential and want everything on? Start the server with `ANNOUNCE_EVENTS=on`.

### 1. Turn them on

For timer events only, skip this step: `push_timer` (step 3) switches them on. For log lines, tickets and settings, an admin turns them on:

```bash
curl -s -X POST http://127.0.0.1:8787/mcp -u "$ADMIN_LOGIN" \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"update_settings","arguments":{"events":{"enabled":true,"types":["ticket.*","timer.*","log.line"]}}}}'
```

`update_settings` is admin scope, even while auth mode is `off`. If you see `update_settings requires a credential with the admin scope`, send `-u "$ADMIN_LOGIN"` (on a laptop, user `demo` and password `demo`), or an API key issued with the admin scope on `/admin` → API Keys, or use `ANNOUNCE_EVENTS` when starting the server. The same switch, with a tick for every kind, is in the **Events** tab on `/admin` and in the Events panel on `/clients/browser.html`.

### 2. Listen

A listener holds a session open. A one-shot `curl` POST cannot. Over legacy SSE, with a filter and a topic:

```bash
curl -sN -u "$ADMIN_LOGIN" 'http://127.0.0.1:8787/sse?events=timer.*,log.line&topic=demo'
```

The first message names the endpoint (`/messages?sessionId=…`). POST `initialize` and `notifications/initialized` there, and the stream greets you with what this connection receives:

```json
{"method":"notifications/message","params":{"level":"info","logger":"events","data":{"type":"events.subscribed","serverEnabled":true,"receives":["log.line","timer.started","timer.tick","timer.finished","timer.stopped"],"ignored":[],"topic":"demo","you":"demo","note":"Listening for 5 kinds of event."}},"jsonrpc":"2.0"}
```

Over Streamable HTTP the order is: POST `initialize` to `/mcp`, POST `notifications/initialized` with the `Mcp-Session-Id`, then `GET /mcp?events=timer.*&topic=demo` with the same header. Over stdio, set `MCP_EVENTS=timer.*`.

### 3. Send a line and push a timer

From any other terminal:

```bash
# push_log (write scope)
... "name":"push_log","arguments":{"line":"hello from the desk","topic":"demo"}
# start a 6 s countdown, then have it report every 2 s (read scope)
... "name":"start_timer","arguments":{"seconds":6,"label":"demo"}
... "name":"push_timer","arguments":{"timer_id":"TMR-1","every_seconds":2,"topic":"demo"}
```

The listener prints:

```json
{"method":"notifications/message","params":{"level":"info","logger":"log.line","data":{"id":1,"type":"log.line","at":"2026-10-02T14:50:00.237Z","data":{"line":"hello from the desk"},"topic":"demo"}},"jsonrpc":"2.0"}
{"method":"notifications/message","params":{"level":"info","logger":"timer.started","data":{"id":2,"type":"timer.started","at":"2026-10-02T14:50:00.349Z","data":{"timer_id":"TMR-1","label":"demo","seconds":6},"topic":"demo"}},"jsonrpc":"2.0"}
{"method":"notifications/message","params":{"level":"info","logger":"timer.tick","data":{"id":3,"type":"timer.tick","at":"2026-10-02T14:50:00.453Z","data":{"timer_id":"TMR-1","label":"demo","state":"running","elapsed_ms":104,"remaining_ms":5896,"every_seconds":2},"topic":"demo"}},"jsonrpc":"2.0"}
{"method":"notifications/message","params":{"level":"info","logger":"timer.tick","data":{"id":4,"type":"timer.tick","at":"2026-10-02T14:50:02.455Z","data":{"timer_id":"TMR-1","label":"demo","state":"running","elapsed_ms":2106,"remaining_ms":3894,"every_seconds":2},"topic":"demo"}},"jsonrpc":"2.0"}
{"method":"notifications/message","params":{"level":"info","logger":"timer.finished","data":{"id":6,"type":"timer.finished","at":"2026-10-02T14:50:06.370Z","data":{"timer_id":"TMR-1","label":"demo","state":"finished","elapsed_ms":6000,"remaining_ms":0},"topic":"demo"}},"jsonrpc":"2.0"}
```

(The SSE `event: message` / `data:` framing is left out. Ticks 3 and 4 and the last one are shown; the others look the same.) The event kind is the `logger`, so any MCP client that shows server log messages shows these.

### 4. Check that a subscription works

The Events panel has **Test the subscription**. It opens a stream with a topic of its own, sends one line with `push_log`, and checks that it arrives:

```text
✓ Open the stream (Streamable HTTP): initialize, then the stream, as demo
✓ The server announces events: Receiving: log.line
✓ Send a line with push_log: Delivered to 1 connection
✓ Receive it on the stream: log.line with topic selftest-4l8iio arrived in 10 ms
```

> **Lesson:** a model asks, a server announces, and both are the same protocol. Keep events narrow (the kinds you choose, a topic, a filter), keep them free of personal data (an event carries ids and counts, never ticket text or addresses), and tell the listener at once what it will and will not receive. A listener with no key is anonymous and sees the open kinds only; the admin kinds need the admin scope.

Limits: events live in memory, and a host that scales to zero drops every open stream. The VS Code extension has an **Events** tab that listens live (its host opens the stream for the webview). To send the same events to an MQTT broker, see Demo 16.

### Listen at a level

A client can ask for fewer events with `logging/setLevel`. Ticket and timer events are `info`, settings and key events `notice`, a factory reset `warning`, and a log line has the level its sender gave. After `setLevel warning`, a `push_log` at `info` does not arrive on that connection and one at `error` does, while another connection keeps everything.

```bash
curl -s -X POST localhost:8787/mcp -H "Mcp-Session-Id: $SESSION" -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":9,"method":"logging/setLevel","params":{"level":"warning"}}'
```

---

## Demo 16 — Publish the events to MQTT

The server can also publish every event it announces to an MQTT broker, so Node-RED, Home Assistant or `mosquitto_sub` can follow the desk. It is publish only, uses a small MQTT 3.1.1 client built into the server (no extra npm package), and never publishes the admin kinds (settings, users, keys). This run used a local mosquitto on `localhost:1883`.

**1. Listen on the broker** in one terminal:

```bash
mosquitto_sub -h localhost -t 'mcp-ticket-demo/events/#' -v
```

**2. Start the server with events and the bridge on:**

```bash
ANNOUNCE_EVENTS=on MQTT_URL=mqtt://localhost:1883 MCP_MODE=http PORT=8787 node src/index.js
```

(or set it up later: `set_mqtt` with `enabled=true` and `url`, the **MQTT** section of the Events tab, or `mcp-ticket-demo mqtt --enabled on --broker mqtt://localhost:1883 --test`.)

**3. Do something:** open a ticket, start a timer that reports every second, send a line.

```bash
call() { curl -s -X POST localhost:8787/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$1\",\"arguments\":$2}}"; }
call create_ticket '{"subject":"Printer on fire","body":"Secret body","requester_email":"ada@example.com"}'
call start_timer   '{"seconds":20,"label":"mq"}'
call push_timer    '{"timer_id":"TMR-1","every_seconds":1,"topic":"demo"}'
call push_log      '{"line":"hello broker","level":"warning","topic":"demo"}'
```

What `mosquitto_sub` printed (captured from a running server). The ticket body, the subject and the email are not in the payload:

```text
mcp-ticket-demo/events/ticket.created {"id":3,"type":"ticket.created","at":"2026-10-02T16:38:22.641Z","level":"info","data":{"ticket_id":"TCK-1004","status":"open","attribution":"customer"}}
mcp-ticket-demo/events/timer.started/mq {"id":4,"type":"timer.started","at":"2026-10-02T16:38:22.672Z","level":"info","data":{"timer_id":"TMR-1","label":"mq","seconds":20},"topic":"mq"}
mcp-ticket-demo/events/timer.tick/demo {"id":5,"type":"timer.tick","at":"2026-10-02T16:38:22.701Z","level":"info","data":{"timer_id":"TMR-1","label":"mq","state":"running","elapsed_ms":29,"remaining_ms":19971,"every_seconds":1},"topic":"demo"}
mcp-ticket-demo/events/log.line/demo {"id":6,"type":"log.line","at":"2026-10-02T16:38:22.726Z","level":"warning","data":{"line":"hello broker","level":"warning"},"topic":"demo"}
mcp-ticket-demo/events/timer.tick/demo {"id":7,"type":"timer.tick","at":"2026-10-02T16:38:23.702Z","level":"info","data":{"timer_id":"TMR-1","label":"mq","state":"running","elapsed_ms":1030,"remaining_ms":18970,"every_seconds":1},"topic":"demo"}
```

> **Lesson:** an event is one fact with one shape, so the transport is a choice. The same event reaches an MCP client as a log notification and a plain MQTT subscriber as a topic. The broker cannot tell who may read what, so the bridge publishes only what any listener may see, and keeps the broker password where nothing can read it back.

Limits: publish only (the server does not subscribe), MQTT 3.1.1 over TCP or TLS, QoS 0 or 1, no WebSocket and no client certificates.

---

## Complete tool reference

| Tool | Scope | Lesson |
|---|---|---|
| `describe_server` | open (always) | Call first — tells you auth mode, your scopes, what every tool needs |
| `create_ticket` | `write` | **Always pass `requester_email`** or the scar happens |
| `add_comment` | `write` | Pass `author` or the comment is owned by the service account |
| `close_ticket` | `write` | Idempotent — safe to call twice |
| `get_schema` | `read` | Discovery in one tool: no `name` lists every name with its kind (`data`, `query`, `tool`); a `name` gives its fields and filterable keys, or a tool's arguments |
| `run_query` | `read` | The one read tool for data: `schema=tickets` finds tickets or, with `filter id`, one ticket in full; `schema=customers` reads a customer, phone `REDACTED` without the `pii` scope; `schema=settings` reads the settings row; with admin, `users`, `api_keys`, `trace`, `errors` and `counters`. No `query_tickets`, `search_tickets` or `get_ticket` exists |
| `start_timer` | `read` | Starts a countdown or a stopwatch. There is no `get_timer`; reads go through `run_query` (Demo 14) |
| `stop_timer` | `read` | Idempotent — stopping a timer that is over changes nothing |
| `push_timer` | `read` | Makes a running timer report its time as events (Demo 15) |
| `watch_system` | `read` | Publishes the machine as `system.info` events; read it back with `run_query` `schema=system` |
| `push_log` | `write` | Sends one line to the listeners (Demo 15) |
| `update_settings` | `admin` | One patch changes any setting: auth mode, rate limit, audit, desk sign-in, transports, which events are announced (`events`), gates, locks and scopes. Checked first, all or nothing |
| `set_mqtt` | `admin` | Publishes the events to an MQTT broker (Demo 16) |
| `create_user`, `delete_user`, `issue_api_key`, `revoke_api_key`, `import_settings` | `admin` | Users, keys and restoring a settings row (export is `run_query` with `schema=settings`) |
| `generate_traffic` | `read` | Scripted calls so the log has something in it |

---

## Further reading

| Doc | What's in it |
|---|---|
| [docs/LOCAL.md](LOCAL.md) | Full local stdio + HTTP walkthrough |
| [docs/REMOTE.md](REMOTE.md) | Code Engine deploy + 0-tools-discovered repro |
| [docs/ADMIN-AND-SECURITY.md](ADMIN-AND-SECURITY.md) | Auth modes, API keys, tool gates in detail |
| [docs/EXTENSION.md](EXTENSION.md) | VS Code / Bob / Cursor / Windsurf extension guide, including the Remote config tab |
| [server/README.md](../server/README.md) | Full curl reference for every endpoint |

---

**Author:** Markus van Kempen ·
[markus.van.kempen@gmail.com](mailto:markus.van.kempen@gmail.com) ·
[markusvankempen.github.io](https://markusvankempen.github.io/) ·
[Talk slides](https://markusvankempen.github.io/linuxfoundation-mcp-dev-summit/#1)

*Personal open-source demo.*
