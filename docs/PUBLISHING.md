# Publishing Guide

This document covers the full release process for both publishable artifacts in this repo:

| Artifact | Registry | Tool |
|---|---|---|
| `mcp-ticket-demo` npm package | [npmjs.com](https://www.npmjs.com/package/mcp-ticket-demo) | `npm publish` |
| `mcp-ticket-demo` MCP registry entry | [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io) | `mcp-publisher` |

> **Note:** The MCP Registry is currently in preview. Breaking changes or data resets may occur before GA.

---

## Part 1 — npm publish

### What ships in the tarball

The `files` field in `server/package.json` limits the tarball to:

```
src/          MCP server source, including src/cli (the command line client) and the test scripts
media/        Desk icons
clients/      Pages served at /clients/ (editors, browser, command line, settings)
scripts/      Helper scripts
README.md     npm package page content
server.json  LICENSE  NOTICE
```

`node_modules/`, `package-lock.json`, and everything else is excluded automatically. `bin` is
`src/index.js`: with no arguments it is the MCP server, with a command (`status`, `demo`, …) it
is the command line client, so one tarball serves both.

### Checklist before publishing

- [ ] Run the tests (each starts its own server): `cd server && npm run test:all` (smoke, tools, ops, cli, events), then `cd ../extension && npm test`
- [ ] Bump `version` in `server/package.json` (semver — patch for fixes, minor for new tools, major for breaking). Update the package-lock, `server.json`, `src/version.js` and the `describes server **x.y.z**` line in `server/README.md` to match; `cd extension && npm run check-sync` reports any that differ
- [ ] Update `mcpName` version in `server/server.json` to match
- [ ] Confirm `server/README.md` badges, links, and content are current
- [ ] Confirm `keywords`, `author`, `repository`, `homepage`, `bugs`, `license` are all set

### Publish steps

```bash
cd server

# 1. Verify what will be in the tarball
npm pack --dry-run

# 2. Authenticate (first time or after token expiry)
npm adduser        # or: npm login

# 3. Publish
npm publish --access public

# 4. Verify
open https://www.npmjs.com/package/mcp-ticket-demo
```

### Version history

| Version | npm | MCP Registry | Notes |
|---|---|---|---|
| 1.0.0 | ✓ | — | Initial publish — server source only, no README |
| 1.0.1 | ✓ | — | Added server/README.md, files field |
| 1.0.2 | ✓ | — | Keywords, author, repository, homepage, bugs, license, badges |
| 1.0.3 | ✓ | — | for-the-badge shields, Linux Foundation / IBM Cloud badges, mcpName added locally but not in tarball |
| 1.0.4 | ✓ | ✓ | mcpName in tarball, server.json, description ≤100 chars — **first MCP Registry publish** |
| 1.6.0 | ✓ | — | Resources, prompts, annotations, isError, VERSION alignment |
| 1.7.0 | ✓ | ✓ | Resource list + gate, Streamable HTTP sessions, CORS/Origin, read-only `/test`, public admin lock |
| 1.7.1 | | | README rewrite — description, cross-links, slides URL, lessons expanded (6), server/extension interlinks |
| 2.0.0 | | | Resources, prompts, structured results, completion. Tagged `server-v2.0.0`. Not published to npm (npm stayed at 1.9.0). |
| 2.1.0 | ✓ | — | Operating tools, client pages, desk themes (project / light / dark). Extension `1.10.0`. Published to npm; tagged `server-v2.1.0`. |
| 2.2.0 | ✓ | — | Sortable ticket and audit tables on `/admin` Data, Try-button JSON pretty-printed, README rewrite. The **command line client** (`mcp-ticket-demo <command>`: status, call, users, keys, settings, demo apply/check/remove, `--json`, exit codes; the bare command is still the server), **Remote config** on `/admin` and `/clients/browser.html`, `/clients/cli.html`. **Security fix:** `update_settings` now needs the `admin` scope (it was `write`, so a write key could switch auth off); callers that used a write key must switch to an admin key. 29 tools. Suites: `npm run test:all` = smoke + 178 tools + 334 ops + 222 cli. Published to npm on 2026-10-01; tagged `server-v2.2.0`. The `DEMO_PASSWORD` → `DEMO_PASS` rename made after it (for the Open VSX scan) changes no behaviour and ships in the next npm release. |
| (extension) | | | `1.13.2` — no default Code Engine URL (paste deploy URL in Settings or at **Connect Code Engine**); probe `auto` uses local HTTP when remote and Code Engine are empty; host-aware Diagnose “Chat and /admin share one server” and clearer stat tiles. Server still **2.2.0**. |
| (extension) | | | `1.13.3` — fixes the `1.13.2` activation crash (`DEFAULT_CODE_ENGINE_URL is not defined`), adds `npm run smoke` (loads every module before packaging), README uses generic Render / Code Engine examples. Server still **2.2.0**. |
| (extension) | | | `1.14.0` — published to Open VSX and the VS Code Marketplace on 2026-10-01; tagged `extension-v1.14.0`. `1.13.3` was never published. Native **Remote config tab** (Demo setup, rate limit, users, keys, any tool), **Open command line page**, the bundled server is 2.2.0. `npm test` = 54. Leaves the server's test suites out of the bundle (Open VSX secret scan). Cut with `npm run package`. |
| 3.0.0 | | | **Built, never published or tagged** (superseded by 3.0.1). Extension `1.15.0` bundles it. **Breaking:** 31 tools became 19, with no aliases. Settings are one tool: `update_settings` takes a patch shaped like the settings row (`authMode`, `rateLimit`, `audit`, `uiAuth`, `protocols`, `events`, `toolGates`, `toolAuthOverrides`, `toolScopeOverrides`), is checked first and applies all or nothing, and returns `{ok, settings, changed[], next}`; it replaces `set_auth_mode`, `set_rate_limit`, `set_audit`, `set_ui_auth`, `set_protocols`, `set_events`, `set_tool_gate`, `set_tool_lock` and `set_tool_scope` (`set_mqtt` stays). `list_schemas` is merged into `get_schema` (no `name` lists every name with its kind). Reads moved to `run_query`, which now has 12 schemas: `tickets` and `customers` replace `search_tickets`, `get_ticket` and `lookup_customer` (phone is REDACTED without the pii scope), `settings` replaces `get_settings` and `export_settings` (its row imports as it is), and the admin schemas `users`, `api_keys`, `trace`, `errors` and `counters` replace `list_users`, `list_api_keys` and `export_log`. `run_query` refuses filter keys that are not in the schema. **New:** timers (`start_timer`, `stop_timer`, `push_timer`), events streamed as MCP log notifications over SSE, Streamable HTTP or stdio (`push_log`; off by default), MQTT publishing (`set_mqtt`), system info (`watch_system`, `run_query` schema `system`) and `/clients/dashboard.html`, tool scopes (`required_scope`, `own_scope` in `describe_server`), and a `/help` Tools tab with a curl per tool. **Fixes:** the server `instructions` are sent at the top level of the `initialize` result, `GET /mcp` with no session is 405, the Remote config demo setup says plainly when Connection has no admin credential and has a one-click demo / demo login on localhost. Author header on every source file. Suites: smoke, `test:system` 17, `test:tools` 271, `test:ops` 433, `test:cli` 252, `test:events` 349, `test:mqtt` 77; extension 46 in the event-host suite. |
| (extension) | | | `1.15.0` — **built, never published or tagged** (superseded by 1.16.0). Bundles server 3.0.0 (19 tools); the Browser, Remote config and Events tabs are hidden by default and switched on under Settings → Advanced tabs (`summitMcp.showBrowserTab`, `summitMcp.showRemoteConfigTab`, `summitMcp.showEventsTab`; a command that belongs to a hidden tab turns it on); Remote config and Events call `update_settings` and `run_query`; chat prompts, tree and diagnostics follow the new tool names. |
| 3.0.1 | | | **Built, not yet published or tagged.** Same server code as 3.0.0, which was never published; npm goes from 2.2.0 to 3.0.1. Extension `1.16.0` bundles it. 19 tools. |
| (extension) | | | `1.16.0` — **built, not yet published or tagged.** Bundles server 3.0.1. The MCP Test tab has **Test ticket** fields (subject, body, requester email, status at the end: solved or open) for the CRUD test, which now checks the read-back subject and email and finds the ticket by its subject. A **Tickets** table below it shows id, subject, email and status, filtered by status (`run_query schema=tickets`). `npm run preview` runs the real CRUD test against its throwaway server. |

---

## Part 2 — MCP Registry publish

The MCP Registry hosts **metadata only** — not the artifact. The npm package must be published first.

### Prerequisites

- npm package published at `https://www.npmjs.com/package/mcp-ticket-demo`
- GitHub account (used for registry authentication)
- `mcp-publisher` CLI installed (see below)

### Install mcp-publisher

**macOS / Linux (binary):**
```bash
curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" \
  | tar xz mcp-publisher && sudo mv mcp-publisher /usr/local/bin/
```

**macOS (Homebrew):**
```bash
brew install mcp-publisher
```

**Verify:**
```bash
mcp-publisher --help
```

### Key files

| File | Purpose |
|---|---|
| `server/package.json` | Must contain `mcpName` field for registry verification |
| `server/server.json` | Registry metadata — passed to `mcp-publisher publish` |

### `mcpName` format

Because we use GitHub authentication, `mcpName` **must** start with `io.github.<github-username>/`:

```json
"mcpName": "io.github.markusvankempen/mcp-ticket-demo"
```

This value must match the `name` field in `server/server.json`.

### Publish steps

```bash
cd server

# Step 1 — Authenticate with GitHub
mcp-publisher login github
# Follow the device flow:
#   Go to https://github.com/login/device
#   Enter the code shown in the terminal
#   Authorize the application

# Step 2 — (First time only) Generate server.json template
mcp-publisher init
# server/server.json is already committed — skip if it exists

# Step 3 — Review server/server.json
#   Confirm name, version, description, repository match current state

# Step 4 — Publish
mcp-publisher publish

# Step 5 — Verify
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.markusvankempen/mcp-ticket-demo"
```

### `server/server.json` reference

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "io.github.markusvankempen/mcp-ticket-demo",
  "description": "Demo MCP server for ticket workflows — local stdio and remote HTTP. Teaches real-world MCP patterns: tool naming, attribution, schema discovery, auth, and PII gating.",
  "repository": {
    "url": "https://github.com/markusvankempen/mcp-ticket-demo",
    "source": "github"
  },
  "version": "1.0.4",
  "packages": [
    {
      "registryType": "npm",
      "identifier": "mcp-ticket-demo",
      "version": "1.0.4",
      "transport": {
        "type": "stdio"
      }
    }
  ]
}
```

### Environment variables (optional — add to server.json if auth is enabled)

```json
"environmentVariables": [
  {
    "name": "MCP_API_KEY",
    "description": "API key issued on /admin → API Keys. Required when AUTH_MODE=write or AUTH_MODE=all.",
    "isRequired": false,
    "isSecret": true,
    "format": "string"
  },
  {
    "name": "AUTH_MODE",
    "description": "off | write | all. Default: off.",
    "isRequired": false,
    "isSecret": false,
    "format": "string"
  }
]
```

---

## Part 3 — Full release checklist (both registries)

Run through this for every release:

```
[ ] 0.  cd server && npm run test:all ; cd ../extension && npm test   ← all green
[ ] 1.  Bump version in server/package.json
[ ] 2.  Update version in server/server.json  (name.version + packages[0].version)
[ ] 3.  Update version history table in this file
[ ] 4.  Commit everything
[ ] 5.  cd server && npm pack --dry-run   ← confirm tarball contents
[ ] 6.  cd server && npm publish --access public
[ ] 7.  Verify: https://www.npmjs.com/package/mcp-ticket-demo
[ ] 8.  mcp-publisher login github         ← if token expired
[ ] 9.  cd server && mcp-publisher publish
[ ] 10. Verify: curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.markusvankempen/mcp-ticket-demo"
[ ] 11. cd extension && npm run package   ← if extension changed. Rebuilds extension/server from server/
                                            and fails if anything is out of sync
[ ] 12. Upload .vsix to Open VSX            ← its secret scan rejects password literals in the package.
                                            The server's test suites (src/test-*.js) are therefore left out of
                                            extension/server; check-sync fails if they sneak back in.
[ ] 13. Tag: server-vX.Y.Z / extension-vX.Y.Z
```

---

## Troubleshooting

### npm

| Problem | Fix |
|---|---|
| `ENOENT: package.json` | Run `npm publish` from `server/`, not the repo root |
| `403 Forbidden` | Run `npm login` — token may have expired |
| README blank on npmjs.com | `server/README.md` must exist; re-publish after adding it |
| Wrong files in tarball | Check `files` field in `server/package.json`; run `npm pack --dry-run` |

### MCP Registry

| Error | Fix |
|---|---|
| `Registry validation failed for package` | `mcpName` in `package.json` must match `name` in `server.json` |
| `Invalid or expired Registry JWT token` | Run `mcp-publisher login github` again |
| `You do not have permission to publish this server` | `name` in `server.json` must start with `io.github.markusvankempen/` |
| `version 'x.y.z' was not found (status: 404)` | npm propagation delay — wait ~60s after `npm publish` before running `mcp-publisher publish` |
| `mcpName field missing` | The live npm tarball must contain `mcpName` — bump the version, `npm publish`, wait, then retry |
| Server not found after publish | Wait ~60s then retry the `curl` verify command |

---

## Links

- npm package: https://www.npmjs.com/package/mcp-ticket-demo
- MCP Registry: https://registry.modelcontextprotocol.io
- MCP Registry quickstart: https://modelcontextprotocol.io/registry/quickstart
- mcp-publisher releases: https://github.com/modelcontextprotocol/registry/releases
- GitHub repo: https://github.com/markusvankempen/mcp-ticket-demo
