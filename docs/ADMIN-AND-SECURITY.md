# Admin and tool security

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
| `write` | `create_ticket`, `add_comment`, `close_ticket`, `lookup_customer`. Read tools stay open. |
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
| `read` | `search_tickets`, `get_ticket`, `list_schemas`, `get_schema`, `run_query` |
| `write` | `create_ticket`, `add_comment`, `close_ticket` — and implies `read` |
| `pii` | `lookup_customer` returns the real phone number instead of `REDACTED` |
| `admin` | Implies all of the above |

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

A demo server has no user database, so users come from the environment:

```
MCP_USERS="alice:secret:read,write,bob:hunter2:read"
```

`ADMIN_USER` / `ADMIN_PASSWORD` is always present with the `admin` scope, and is what signs
you in to `/admin`.

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
