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
src/          MCP server source
README.md     npm package page content
```

`node_modules/`, `package-lock.json`, and everything else is excluded automatically.

### Checklist before publishing

- [ ] Bump `version` in `server/package.json` (semver — patch for fixes, minor for new tools, major for breaking)
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
[ ] 11. cd extension && npm run package   ← if extension changed
[ ] 12. Upload .vsix to Open VSX
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
