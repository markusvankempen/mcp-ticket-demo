# Admin and tool security

Server **3.0.1** — 19 tools, three auth modes, four scopes (`read`, `write`, `pii`, `admin`). Every setting change goes through one tool: `update_settings` (admin scope).

`/admin` is how you operate the server. None of it is in the MCP spec — the spec says
nothing about who is allowed to call a tool, so every server invents an answer. This is one.

## Login

| | Default (change before a public URL) |
|---|---|
| Username | `demo` |
| Password | `demo` |
| Env | `ADMIN_USER`, `ADMIN_PASSWORD` |

Session cookie `mcp_admin`. Sign-out clears it.

On the laptop those defaults are fine. In a deployment they should be app env vars — that
is "secrets move off the laptop."

## Auth modes

The admin page picks one of three modes. `AUTH_MODE` sets the boot value.

| Mode | What needs a credential |
|---|---|
| `off` | Nothing. Every tool is callable by anyone who can reach the server. The boring laptop default. |
| `write` | `create_ticket`, `add_comment`, `close_ticket`. Read tools stay open. |
| `all` | Every tool call. Discovery still works, so a client can see the tools and learn what to ask for. |

`describe_server` is open in every mode. A client that cannot ask *"what do you need from
me?"* can only guess, and a guessing model retries in a loop.

The tools never disappear from `tools/list`. That is the point: capability without
permission fails with an instruction, not a silent empty list.

## Credentials

Four ways in, all resolving to the same thing — a **principal** with **scopes**.

```
Authorization: Bearer <api key>
Authorization: Basic base64(username:password)
x-api-key: <api key>
```

stdio has no headers, so a local server reads the credential from its own environment:
`MCP_API_KEY`, or `MCP_USERNAME` + `MCP_PASSWORD`. That also keeps it off the network.

### Scopes

| Scope | Grants |
|---|---|
| `read` | `describe_server`, `get_schema`, `run_query` (tickets, customers, settings and the other schemas), `start_timer`, `stop_timer`, `push_timer`, `watch_system`, `generate_traffic` |
| `write` | `create_ticket`, `add_comment`, `close_ticket`, `push_log` — and implies `read` |
| `pii` | No tool needs it. `run_query` with `schema=customers` returns the real `phone` instead of `REDACTED`. Implies `read` |
| `admin` | The 8 operating tools minus `generate_traffic` (`update_settings`, `set_mqtt`, `create_user`, `delete_user`, `issue_api_key`, `revoke_api_key`, `import_settings`), the `users`, `api_keys`, `trace`, `errors` and `counters` queries of `run_query`, and implies all of the above |

A denial names the scope it wanted, so the next request is a specific ask rather than a retry:

```
read only has scopes [read] but create_ticket needs "write".
Issue a key with that scope on /admin → API keys.
```

### API keys

**/admin → API keys** issues them. A key looks like `mcpk_<id>_<secret>` and is shown
**once** — only its SHA-256 hash is stored. Each key carries a label, its scopes, an
optional expiry, a last-used timestamp, and a call count, and can be revoked.

`API_KEY` in the environment registers one key at boot (scopes from `API_KEY_SCOPES`,
default `read,write`) for deployments that provision credentials outside the UI.

### Logins

Users sign in with HTTP Basic. They can come from the environment at boot:

```
MCP_USERS="alice:secret:read,write,bob:hunter2:read"
```

or be managed while the server runs: **/admin → Users**, `run_query` with `schema=users` and the `create_user` /
`delete_user` tools, **Remote config**, or `mcp-ticket-demo users …` on the command line.
Passwords are stored as hashes and never returned. Creating a name that exists replaces its
password and scopes; names are lower-case.

`ADMIN_USER` / `ADMIN_PASSWORD` is always present with the `admin` scope, and is what signs
you in to `/admin`. That built-in admin cannot be replaced or removed.

## Operating the server

The same operations are reachable four ways, and they all end up in the same tools:

| Way | Where |
|---|---|
| The desk | `/admin` — Security, API Keys, Tool Gates, Users, Lab, Remote config |
| Remote config | `/admin` or `/clients/browser.html`, pointed at this server or any deployed one |
| The extension | The **Remote config** tab ([EXTENSION.md](EXTENSION.md)) |
| A terminal | `npx mcp-ticket-demo <command>` ([server/README.md](../server/README.md#command-line)) |

The tools behind them (`update_settings`, `set_mqtt`, the user and key tools, `import_settings`)
need the **`admin` scope even while the auth mode is `off`**, and so do the `run_query` schemas
`users`, `api_keys`, `trace`, `errors` and `counters`. Mode `off` opens the ticket tools, not the control plane. A client with no credential is told
which scope it needs and how to present a credential. Over HTTP that is a bearer key or HTTP
Basic; the `/admin` session cookie is for the desk pages and is not accepted on `/mcp`.

Settings are read with `run_query schema=settings` (a `read` call, and the row `import_settings` takes as it is), and `generate_traffic` takes any credential.
**Every setting is changed with one tool, `update_settings`**, which takes a patch shaped like the settings row. All fields are optional:

| Patch field | What it sets |
|---|---|
| `authMode` | `off`, `write` or `all` |
| `rateLimit` | `{enabled, limit, windowSeconds}` |
| `audit` | The full call trace on or off (read it with `run_query` and `schema=trace`) |
| `uiAuth` | Hide the desk HTML until sign-in |
| `protocols` | `{stdio, streamableHttp, sse}` |
| `events` | `{enabled, types, autoTimer, autoSystem}`: which events the server announces |
| `toolGates` | `{tool: false}` switches a tool off (it answers `503`) |
| `toolAuthOverrides` | `{tool: true}` requires a credential for that tool, whatever the mode |
| `toolScopeOverrides` | `{tool: read, write, pii, admin or default}` changes the scope a tool needs |

A patch is checked first and is all or nothing: if any part is refused, the answer is `{ok:false, error, next}` and nothing changes. A success returns `{ok, settings, changed[], next}`. MQTT is not part of it; `set_mqtt` stays separate. The trace, the errors and the counters are `run_query` reads (admin, at most 50 rows per call; `trace` records only while `audit` is on). Two things to
know when you script against the tools:

- Saving a rate limit clears every caller's budget, and a caller that has used its whole
  budget is refused every call, including the one that would raise the limit. So a script
  that restores a generous limit does it first (Demo setup's Remove does), and one that sets
  a tight limit does it last, so its own later calls still have budget (Apply does).
- A `protocols` patch can turn the HTTP transport off, which cuts off every client of `/mcp`.
  After that only the server's own stdio or SSE can turn it back on. At least one transport
  must stay on.

The settings row (what `run_query schema=settings` returns) leaves out API keys and passwords, so an import never needs a secret and
never touches the keys you hold.

## Rate limit

One fixed window per caller — per API key, per user, and one shared bucket for anonymous
calls. Defaults to 60 calls per 60s (`RATE_LIMIT`, `RATE_LIMIT_WINDOW_MS`,
`RATE_LIMIT_ENABLED=0` to turn it off), and is editable on `/admin`.

A refused call returns the seconds to wait:

```
Rate limit reached: 3 calls per 60s for key:909d1b1e.
Wait 60s and try again, or raise the limit on /admin. Do not retry in a loop.
```

The last sentence matters. Without it an agent hammers the endpoint until the window
resets, which looks exactly like an outage.

## Discovery — `describe_server`

The tool to call first, and the tool to call after a denial. It reports:

- server identity, version, and tool count
- the auth mode, and which credential formats are accepted
- who the server thinks you are, and the scopes you actually hold
- your rate-limit budget and when it resets
- every tool, the scope it needs, and whether that is enforced *right now*

If your credential was rejected, `you.problem` says why — expired, revoked, unknown, or
wrong password — instead of leaving the caller to infer it from a 401.

## Audit

Every call is logged with the tool, the caller, and the outcome, allowed or denied, and
shown at the bottom of `/admin`. Denials are counted separately in the stat row, which is
the fastest way to see that a client is configured wrong.

## Tenant header (optional scar)

Set `TENANT_ID=some-tenant` on the process. Write tools then also need:

```
x-tenant-id: some-tenant
```

If you skip it, the error is the slide 10 row: "Auth fine, every job fails — missing a
required tenant header."

## Attribution on the admin table

Create a ticket without `requester_email`, refresh `/admin`. The requester is
`mcp-bot@service.local` and the badge is **service account**. That is the 201-but-wrong-owner
story in a table you can point a camera at.
