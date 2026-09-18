# Lessons Learned: Building a Real-World MCP Server

> Grounded in building [`mcp-ticket-demo`](https://github.com/markusvankempen/mcp-ticket-demo) —
> a full-stack MCP server with 10 tools, three auth modes, per-tool gating, rate limiting,
> and a VS Code / Bob / Cursor / Windsurf control-plane extension.
>
> **Author:** Markus van Kempen · markus.van.kempen@gmail.com
> Presented at [MCP as a Platform — MCP Dev Summit Toronto 2026](https://events.linuxfoundation.org/mcp-dev-summit-toronto/program/schedule/?id=1282401)

---

## Table of Contents

1. [Tool design](#1-tool-design)
2. [Tool descriptions — what you write is what the model does](#2-tool-descriptions--what-you-write-is-what-the-model-does)
3. [The silent zero-tool failure](#3-the-silent-zero-tool-failure)
4. [Attribution scar — success is not correctness](#4-attribution-scar--success-is-not-correctness)
5. [Schema discovery over tool proliferation](#5-schema-discovery-over-tool-proliferation)
6. [Transport and environment](#6-transport-and-environment)
7. [Authentication and authorization](#7-authentication-and-authorization)
8. [Error messages are model instructions](#8-error-messages-are-model-instructions)
9. [Rate limiting](#9-rate-limiting)
10. [Observability](#10-observability)
11. [Discovery must stay open](#11-discovery-must-stay-open)
12. [PII and scope separation](#12-pii-and-scope-separation)
13. [Deployment gotchas](#13-deployment-gotchas)
14. [Testing](#14-testing)
15. [Quick reference checklist](#15-quick-reference-checklist)

---

## 1. Tool design

### Keep tools purposeful, not CRUD

Every REST API reflex says: `GET /tickets`, `POST /tickets`, `PATCH /tickets/:id`.
MCP tools are different. The model reads your tool descriptions and decides when to call them.
Name and describe each tool for **when** it should be used, not what HTTP verb it maps to.

```
❌  get_tickets        — what does it do?
✓   search_tickets     — find tickets by status / requester / keyword
✓   get_ticket         — fetch one ticket including attribution and comments
```

### One tool per distinct intent

Two tools that do the same thing in slightly different ways confuse the model into picking the wrong one.
If the difference is a parameter, use one tool with an optional parameter.

```
❌  query_tickets_by_status
❌  query_tickets_by_requester
❌  query_tickets_with_filter
✓   search_tickets (status?, requester?, keyword?)
```

### Keep the tool count low

The MCP spec has no tool-count limit but models have context limits, and the more tools
you expose the more opportunity for the model to pick the wrong one.
Ten tools covers a complete helpdesk workflow. Resist adding a tool for every edge case.

### Scope each tool explicitly

Declare read / write / pii scope **in the tool name or description** so the model knows
what it is about to do before it calls. Don't hide destructive operations behind read-sounding names.

---

## 2. Tool descriptions — what you write is what the model does

The description field in an MCP tool is the model's only documentation.
Write it as an instruction to the model, not as a note to a human developer.

```
❌  "Creates a ticket."
✓   "Open a support ticket. ALWAYS pass requester_email — if you omit it the service
     account owns the ticket and every reply goes to the bot, not the customer."
```

### Include the common mistake in the description

If callers consistently get something wrong, say so directly in the description.
This is the only place you can catch it before the call happens.

```
✓  run_query — "The one query tool. Pass schema= from list_schemas first.
                Do NOT invent query_tickets / query_assets / query_with_filter."
```

### Tell the model what to do next on failure

Every tool that can fail should return a `next` field alongside the error.
The model reads `next` and acts on it. Without it, the model retries in a loop
or gives up with a generic message.

```json
{
  "ok": false,
  "error": "Ticket TCK-9999 not found.",
  "next": "Call search_tickets with a keyword from the subject to find the correct id."
}
```

---

## 3. The silent zero-tool failure

**The most common issue when registering an MCP server.**

`tools/list` returns an empty array with no error when:
- The server starts in the wrong mode (`MCP_MODE` not set, defaults to something unexpected)
- The `cwd` in `mcp.json` is a laptop path that doesn't exist in a container or CI environment
- `node_modules` is missing — the process starts but crashes before registering tools
- The path in `mcp.json` points to `index.js` but `src/index.js` is the real entry point

```
✓  Always add a describe_server tool that returns server identity, cwd, and tool count.
✓  Add a /health endpoint (HTTP mode) that returns tool count.
✓  Run tools/list as the first step of any diagnostic.
✓  In your mcp.json, use the FULL absolute path or confirm the cwd resolves.
```

```json
// ❌ breaks in containers and other users' machines
{
  "cwd": "/Users/markus/projects/mcp-ticket-demo/server"
}

// ✓ use an env var or let the extension compute it
{
  "cwd": "${workspaceFolder}/server"
}
```

---

## 4. Attribution scar — success is not correctness

`create_ticket` without `requester_email` returns `HTTP 201`. The ticket exists.
The API call "succeeded". But the service account owns it — and every automated reply
goes to the bot address, not the customer.

**The call succeeded. The outcome was wrong.**

This is the hardest class of MCP bug to catch: no error, no warning, silent data corruption.

```
Watch out for:
  - Optional fields that are actually required for correct downstream behaviour
  - Fields the model might omit because the user didn't mention them
  - Defaults that look sensible but have bad operational consequences
```

Fix it at the tool layer, not in post-processing:
```
✓  In the tool description: "ALWAYS pass requester_email."
✓  In the tool handler: set attribution="service_account" when email is missing,
   and return a warning in the response alongside the created ticket id.
✓  In the store: never silently use the service account — make it visible.
```

---

## 5. Schema discovery over tool proliferation

**Before:** one tool per query shape.
```
query_tickets_open, query_tickets_by_email, query_tickets_filtered,
query_assets_by_site, query_assets_by_status, query_customers_by_region …
```

**After:** three tools, infinite queries.
```
list_schemas  →  get_schema  →  run_query
```

The model calls `list_schemas`, sees `["tickets", "customers", "assets"]`, calls
`get_schema("tickets")` to learn the fields and filters, then calls `run_query` with
the right shape. The server exposes one query tool. The model discovers the data model.

```
✓  Prefer a discovery tool + one generic executor over N specific query tools.
✓  Schema descriptions should say what the model should call next.
✓  Explicitly forbid invented tool names in the description:
   "Do NOT invent query_tickets / query_with_filter."
```

---

## 6. Transport and environment

### stdio vs HTTP — they are not interchangeable

| | stdio | HTTP |
|---|---|---|
| Port | None | Required |
| Credentials | Environment variables | Request headers |
| Who spawns the server | The IDE / MCP client | You, separately |
| cwd | Critical — must be correct | Irrelevant |
| Headers available | No | Yes |
| Viable in containers | Yes (podman run -i) | Yes |
| Viable on managed platforms | No (no local filesystem) | Yes |

```
✓  Support both transports from day one. The same ten tools run on both.
✓  Read credentials from env vars in stdio mode (MCP_API_KEY, MCP_USERNAME).
✓  Never assume headers are present — they aren't in stdio.
```

### Laptop paths don't survive a container boundary

```
stdio mcp.json (laptop):  "cwd": "/Users/markus/projects/mcp-ticket-demo/server"
stdio mcp.json (Podman):  no cwd — the image has its own WORKDIR
stdio mcp.json (Cloud):   no local filesystem at all
```

If you paste a laptop absolute path into a `mcp.json` entry that a CI runner or
managed platform will use, the tools will silently disappear (see Lesson 3).

### MCP_MODE matters

The same `src/index.js` can be stdio or HTTP depending on `MCP_MODE`.
Without it set, the server may start and appear healthy but serve the wrong transport,
returning zero tools to the IDE.

```bash
MCP_MODE=stdio node src/index.js   # IDE spawns this
MCP_MODE=http  node src/index.js   # you run this for browser diagnostics
```

---

## 7. Authentication and authorization

**The MCP spec says nothing about auth.** Every server invents it.
This is one opinionated approach that works at all three scales: laptop, team, cloud.

### Three-mode model

| Mode | Effect | Use case |
|---|---|---|
| `off` | All tools open, no credential | Local dev, demos, public read-only servers |
| `write` | Read tools open; write + PII tools need a credential | Shared dev server, staging |
| `all` | Every tool call requires a credential | Production, multi-tenant |

### API keys over passwords

Issue short-lived API keys with explicit scopes (`read`, `write`, `pii`).
Never give every key every scope.

```
✓  Keys are hashed on issue (SHA-256). The plaintext is shown once and never stored.
✓  Prefix the key (mcpk_<id>_<secret>) so you can identify it in logs without exposing it.
✓  Support expiry. A key that never expires is a credential that can never be rotated.
✓  Revocation must be instant. Keep an in-memory revocation check.
```

### stdio has no headers — use environment variables

```bash
# HTTP caller sends:
Authorization: Bearer mcpk_abc123_...

# stdio caller sets in mcp.json env block:
MCP_API_KEY=mcpk_abc123_...
```

### Per-tool auth override

Sometimes you want one specific tool locked even when the global mode is `off`.
Implement per-tool auth overrides independently of the global mode.

```
✓  toolAuthOverrides[toolName] = true  →  always requires a credential
✓  Combine with per-tool gates (enable/disable) for full operational control
✓  Surface both in the admin UI so operators don't have to edit config files
```

### Discovery must always be open

`describe_server` (or `tools/list`) must work without a credential in every auth mode.
A model that cannot discover what tools are available cannot tell you what credential it needs.
Locking discovery forces the model to guess — and it will guess wrong.

---

## 8. Error messages are model instructions

The model reads your error messages and decides what to do next.
Write every error as if you are leaving a note for a junior developer who has never
seen your server before.

```
❌  "Unauthorized"
✓   "search_tickets requires authentication because auth mode is 'write'.
     Send Authorization: Bearer <api key> (create one on /admin → API keys)
     or HTTP Basic with a username and password.
     Over stdio set MCP_API_KEY in the server env."

❌  "Rate limit exceeded"
✓   "Rate limit reached: 60 calls per 60s for anonymous.
     Wait 23s and try again, or raise the limit on /admin.
     Do not retry in a loop."

❌  "Not found"
✓   "Ticket TCK-9999 not found. Call search_tickets with a keyword
     to find the correct id before calling get_ticket."
```

### Always include a `next` field

```json
{
  "ok": false,
  "error": "...",
  "next": "What the model should do right now to recover."
}
```

---

## 9. Rate limiting

Without rate limiting, a model that hits an error will retry in a loop until it
exhausts your quota, your database connections, or your patience.

```
✓  One bucket per principal (API key, username, or anonymous).
✓  Return retry_after_seconds in the rate-limit error.
✓  Say "do not retry in a loop" explicitly in the error message.
✓  Make the window and limit configurable at runtime (not just env vars).
✓  Clear buckets when the limit changes so operators don't have to restart.
```

### What to rate-limit

Rate-limit **every** tool call, including read tools and `describe_server`.
A model in a loop can hammer read endpoints just as effectively as write ones.

---

## 10. Observability

In-memory is fine for a demo server. The important thing is that it exists.

### Three layers

| Layer | What it captures | Ring buffer |
|---|---|---|
| **Counters** | success / error / denied per tool since restart | No limit |
| **Error log** | Full params + error for every failed call | Last 50 |
| **Call trace** | Every call when audit mode is on | Last 200 |

```
✓  Counters tell you which tools are being called and failing.
✓  Error log tells you why — with the full params the model sent.
✓  Audit trace tells you the sequence — for replay and demo.
✓  Expose all three in a browser UI (/log), not just in logs.
✓  Make audit mode a runtime toggle — off by default, on for demos and debugging.
```

### Surface errors in the tool response, not just server logs

The model cannot read your server logs. If a tool call fails, the error must come back
in the tool response. Log it server-side too, but the response is the primary channel.

---

## 11. Discovery must stay open

Repeat: **lock everything except discovery.**

`describe_server` is the MCP equivalent of `GET /` — it tells the model who the server is,
what scopes are available, what the current auth mode is, and what tools exist.

If you lock it:
- The model cannot tell the user what credential is needed
- The model cannot distinguish "wrong key" from "server is down"
- Every auth failure becomes a silent dead end

```
✓  describe_server and tools/list are always open in every auth mode.
✓  Rate-limit them, but never require a credential.
✓  Return the current auth mode, rate limit status, and denied count in describe_server.
```

---

## 12. PII and scope separation

Not all data is equal. Phone numbers, emails, and national IDs require a different
handling policy than ticket IDs and statuses.

```
Scope hierarchy (this server):
  read   →  open data: ticket IDs, statuses, subjects
  write  →  mutations: create_ticket, add_comment, close_ticket
  pii    →  customer records: email (in context), phone (redacted without pii scope)
  admin  →  implies all of the above
```

```
✓  Declare PII tools explicitly in a PII_TOOLS set.
✓  Redact PII fields when the caller lacks the pii scope — do not reject the call.
✓  Return a note in the response: "phone_number: redacted (requires pii scope)".
✓  Let the model report to the user that they need to escalate their access.
```

---

## 13. Deployment gotchas

### Hostname rotation on managed platforms

Cloud platforms (Code Engine, Cloud Run, Fly.io) rotate hostnames between deployments
or when you create a new project. Any `mcp.json` with a hardcoded URL breaks silently —
the entry still points at the old host, the tools still return zero.

```
✓  Store the URL in a settings file or env var, not in committed mcp.json.
✓  The extension should re-write mcp.json from the current settings on "Reconnect".
✓  Add a /health endpoint that returns the actual hostname — use it to verify.
```

### Container stdio vs native stdio

```
Native stdio:  IDE spawns  node src/index.js  with your local cwd
Podman stdio:  IDE spawns  podman run -i --rm mcp-ticket-demo  — no local path
```

The `mcp.json` entries are **different**. The extension must write the right one
for the mode the user chose. Never mix them.

### Podman vs Docker

Don't hardcode `podman` in command strings. Detect the available runtime at startup:

```js
const runtime = await which("podman").catch(() => null)
             || await which("docker").catch(() => null);
```

Cache the result. Use it everywhere container commands are issued.
Display the detected runtime in the UI so users know which one is active.

### `0.0.0.0` binding in production

```
❌  app.listen(8080, "0.0.0.0")   — all interfaces, including external
✓   app.listen(8080, "127.0.0.1") — localhost only for local dev
✓   app.listen(8080, "0.0.0.0")   — acceptable only inside a container
                                     where the container network provides the boundary
```

---

## 14. Testing

### Test the full MCP wire, not just the store

Unit-test your store directly. But also test end-to-end:

```
Phase 1 — in-process:   call tool handlers directly, no HTTP
Phase 2 — wire:         spawn an HTTP server, POST real JSON-RPC to /mcp, parse responses
```

Phase 2 catches encoding bugs, transport setup bugs, and JSON serialisation issues
that in-process tests miss entirely.

### Test auth at every level

```
✓  Anonymous caller on an open tool → succeeds
✓  Anonymous caller on a locked tool → denied with correct error
✓  Valid key with correct scope → succeeds
✓  Valid key with wrong scope → denied with scope error
✓  Revoked key → denied with revocation error
✓  Rate-limited caller → denied with retry_after_seconds
✓  Disabled tool (gate=false) → 503 with disabled message
✓  Per-tool auth override → denied for anonymous even in authMode=off
```

### The smoke test is a live health check, not a unit test

A `/test` endpoint that runs the same steps as your CI smoke test lets you verify
a running server (local or cloud) without a test runner. Make it return structured JSON:

```json
{
  "ok": true,
  "steps": [
    { "name": "search_tickets", "ok": true, "detail": "3 open tickets" },
    { "name": "create_ticket", "ok": true, "detail": "TCK-1042 owned by ada@example.com" }
  ]
}
```

---

## 15. Quick reference checklist

Use this before publishing or deploying a new MCP server.

### Tool design
- [ ] Each tool has a clear `when to use` description, not just `what it does`
- [ ] Common mistakes are called out in the description
- [ ] Every tool that can fail returns a `next` field
- [ ] No two tools do the same thing in slightly different ways
- [ ] PII fields are declared and redacted when scope is missing

### Transport
- [ ] Both stdio and HTTP are supported
- [ ] Credentials in stdio come from env vars (`MCP_API_KEY`, `MCP_USERNAME`)
- [ ] `MCP_MODE` is required and documented
- [ ] No absolute laptop paths in committed `mcp.json` entries

### Auth
- [ ] `describe_server` and `tools/list` are open in every auth mode
- [ ] API keys are hashed on issue — plaintext never stored
- [ ] Keys have explicit scopes and optional expiry
- [ ] Revocation is instant
- [ ] Per-tool gates exist independently of global auth mode
- [ ] Error messages name the required scope and where to get it

### Error handling
- [ ] Every error has a human-readable message AND a `next` action
- [ ] Stack traces never reach the tool response
- [ ] Rate-limit errors include `retry_after_seconds`
- [ ] Auth errors say which credential to present and where to get it

### Observability
- [ ] Per-tool counters (success / error / denied)
- [ ] Error log with params, not just counts
- [ ] `/health` returns tool count (silent-zero trap)
- [ ] `/test` runs real tool calls and returns structured results
- [ ] Admin UI exists for runtime control (auth mode, keys, gates)

### Security
- [ ] No secrets committed to the repo
- [ ] No `0.0.0.0` binding outside containers
- [ ] TLS on all public endpoints
- [ ] Rate limiting on every principal including anonymous
- [ ] Non-root user in container

### Deployment
- [ ] Container runtime detected at startup (podman → docker fallback)
- [ ] mcp.json entries are written by tooling, not hardcoded
- [ ] `/health` verifies the actual hostname after every deployment
- [ ] Smoke test runs in CI against a real HTTP instance

---

*Markus van Kempen · [markus.van.kempen@gmail.com](mailto:markus.van.kempen@gmail.com) · [markusvankempen.github.io](https://markusvankempen.github.io/)*
*Personal open-source project. Not an IBM product.*
