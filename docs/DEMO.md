# mcp-ticket-demo — End-to-End Demo Guide

This document walks through every key feature of the MCP server using live `curl` commands against a locally running HTTP server. Every output block is real — captured against `mcp-ticket-demo@1.7.1`.

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
  "version": "1.7.1",
  "transport": "http",
  "tools": 10,
  "hostname": "127.0.0.1:8787",
  "port": 8787,
  "security": {
    "authMode": "off",
    "writeToolsLocked": false,
    "allToolsLocked": false,
    "activeKeyCount": 0,
    "rateLimit": { "enabled": true, "limit": 60, "windowMs": 60000 }
  },
  "endpoints": {
    "health": "/health",
    "test": "/test",
    "admin": "/admin",
    "tools": "/tools",
    "sse": "/sse",
    "mcp": "/mcp"
  },
  "cwd": "/path/to/server"
}
```

> **Lesson:** `/health` tells you the process is alive and how many tools are registered.
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
    { "name": "search_tickets",    "ok": true, "detail": "1 open ticket(s)" },
    { "name": "get_ticket TCK-1001","ok": true, "detail": "TCK-1001" },
    { "name": "list_schemas",       "ok": true, "detail": "tickets, customers, assets" },
    { "name": "run_query tickets",  "ok": true, "detail": "1 row(s)" }
  ],
  "at": "2026-09-19T17:31:36.650Z"
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
  "server": { "name": "mcp-ticket-demo", "version": "1.7.1", "tool_count": 10 },
  "you": {
    "principal": "anonymous",
    "authenticated": false,
    "scopes": [],
    "effective_scopes": []
  },
  "auth": {
    "mode": "off",
    "meaning": "no credential needed",
    "active_api_keys": 0
  },
  "rate_limit": { "enabled": true, "limit": 60, "remaining": 59 },
  "tools": [
    { "name": "describe_server", "required_scope": "read",  "available": true },
    { "name": "search_tickets",  "required_scope": "read",  "available": true },
    { "name": "create_ticket",   "required_scope": "write", "available": true },
    { "name": "add_comment",     "required_scope": "write", "available": true },
    { "name": "close_ticket",    "required_scope": "write", "available": true },
    { "name": "get_ticket",      "required_scope": "read",  "available": true },
    { "name": "list_schemas",    "required_scope": "read",  "available": true },
    { "name": "get_schema",      "required_scope": "read",  "available": true },
    { "name": "run_query",       "required_scope": "read",  "available": true },
    { "name": "lookup_customer", "required_scope": "pii",   "available": true }
  ],
  "next": "Auth is off — every enabled tool is callable."
}
```

> **Lesson:** `describe_server` is always open — even when auth mode is `all`.
> A client that cannot ask "what do you need from me?" can only guess.
> Call it first, and again after any denial.

---

## Demo 4 — Search tickets

```bash
curl -s -X POST "http://127.0.0.1:8787/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_tickets","arguments":{"status":"open","limit":5}}}'
```

**Output:**

```json
{
  "ok": true,
  "count": 1,
  "tickets": [
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
  ]
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
  "next": "Comment added on TCK-1004. Call get_ticket to reread the thread, or close_ticket if this resolves it."
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

## Demo 8 — Schema discovery (one query tool beats seven)

Instead of `query_tickets`, `query_by_status`, `query_open_tickets`, `query_assets`... the server exposes **three tools** that compose.

### Step 1 — Discover available schemas

```bash
curl -s -X POST "http://127.0.0.1:8787/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"list_schemas","arguments":{}}}'
```

**Output:**

```json
{
  "ok": true,
  "schemas": [
    { "name": "tickets",   "description": "Support tickets. Use run_query with schema=tickets — do not invent query_tickets / query_with_filter tools." },
    { "name": "customers", "description": "Customer directory. Email is the join key to tickets.requester_email." },
    { "name": "assets",    "description": "Demo assets. Same query tool as tickets — this is the 'one query tool plus schema discovery' lesson." }
  ],
  "next": "Call get_schema with one name from this list, then run_query. Do not invent a query_* tool."
}
```

### Step 2 — Get the shape of a schema

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
    "fields": ["id", "subject", "status", "requester_email", "attribution", "created_at"],
    "filterable": ["status", "requester_email", "attribution"]
  },
  "next": "Call run_query with schema=tickets. Only filter with keys from filterable: status, requester_email, attribution."
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

> **Lesson:** Three tools (`list_schemas → get_schema → run_query`) replace seven near-identical `query_*` tools. The model discovers the data shape at runtime — no hallucinated tool names.

---

## Demo 9 — PII gating on `lookup_customer`

Without a `pii`-scoped credential, phone numbers are redacted.

```bash
curl -s -X POST "http://127.0.0.1:8787/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":10,"method":"tools/call","params":{"name":"lookup_customer","arguments":{"email":"ada@example.com"}}}'
```

**Output — phone is `REDACTED`:**

```json
{
  "ok": true,
  "customer": {
    "email": "ada@example.com",
    "name": "Ada Example",
    "plan": "enterprise",
    "region": "ca-tor",
    "phone": "REDACTED"
  },
  "note": "Phone is REDACTED. Present an API key with the pii scope (create one on /admin → API keys) and call lookup_customer again to see the full record.",
  "next": "If the human needs the phone number, obtain a pii-scoped API key and retry once. Do not guess the number."
}
```

> **Lesson:** Scope-gated field visibility. Same tool, same endpoint — different scopes expose different fields. Issue a `pii`-scoped key on `/admin → API keys` and the phone appears.

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
| `pii` | `read` | Unredacted phone on `lookup_customer` |
| `admin` | `read + write + pii` | Key management, mode changes, gate toggles |

Issue keys on `/admin → API Keys`. Revoke them from the same page.

---

## Complete tool reference

| Tool | Scope | Lesson |
|---|---|---|
| `describe_server` | open (always) | Call first — tells you auth mode, your scopes, what every tool needs |
| `search_tickets` | `read` | Intent-named, not an HTTP wrapper |
| `get_ticket` | `read` | Fetch one known `TCK-` id |
| `create_ticket` | `write` | **Always pass `requester_email`** or the scar happens |
| `add_comment` | `write` | Pass `author` or the comment is owned by the service account |
| `close_ticket` | `write` | Idempotent — safe to call twice |
| `list_schemas` | `read` | Step 1 of schema discovery |
| `get_schema` | `read` | Step 2 — fields and filterable keys |
| `run_query` | `read` | The one query tool — no `query_tickets` exists |
| `lookup_customer` | `pii` | Phone stays `REDACTED` without the `pii` scope |

---

## Further reading

| Doc | What's in it |
|---|---|
| [docs/LOCAL.md](LOCAL.md) | Full local stdio + HTTP walkthrough |
| [docs/REMOTE.md](REMOTE.md) | Code Engine deploy + 0-tools-discovered repro |
| [docs/ADMIN-AND-SECURITY.md](ADMIN-AND-SECURITY.md) | Auth modes, API keys, tool gates in detail |
| [docs/EXTENSION.md](EXTENSION.md) | VS Code / Bob / Cursor / Windsurf extension guide |
| [server/README.md](../server/README.md) | Full curl reference for every endpoint |

---

**Author:** Markus van Kempen ·
[markus.van.kempen@gmail.com](mailto:markus.van.kempen@gmail.com) ·
[markusvankempen.github.io](https://markusvankempen.github.io/) ·
[Talk slides](https://markusvankempen.github.io/linuxfoundation-mcp-dev-summit/#1)

*Personal open-source demo. Not an IBM product.*
