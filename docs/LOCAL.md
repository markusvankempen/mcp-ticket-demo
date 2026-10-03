# Local — native stdio and laptop HTTP

## Native stdio (what the editor uses)

This is **not Docker**. The client launches `node` as a child process. There is **no port and no URL**. JSON-RPC 2.0 goes over stdin/stdout.

```bash
cd mcp-ticket-demo/server
npm install
npm run stdio          # MCP_MODE=stdio node src/index.js
```

`cwd` is the server package so `node_modules` resolve. Relative `src/index.js` — not a laptop absolute path, not a container image.

Cursor / VS Code / IBM Bob spawn that after the mcp files are in place (already committed, or **Connect native stdio**).

`.vscode/mcp.json`:

```json
{
  "servers": {
    "mcp-ticket-demo": {
      "type": "stdio",
      "command": "node",
      "args": ["src/index.js"],
      "cwd": "${workspaceFolder}/mcp-ticket-demo/server",
      "env": { "MCP_MODE": "stdio" }
    }
  }
}
```

`.cursor/mcp.json` and `.bob/mcp.json` use the same command with `cwd: "mcp-ticket-demo/server"`. Bob also lists the six ticket-desk tools in `alwaysAllow`.

A Docker / Code Engine remote is a **second** server (`mcp-ticket-demo-remote`). Connecting remote does not replace native stdio. See [REMOTE.md](REMOTE.md).

Reload the editor window after the file changes so the client respawns the process.

## HTTP on the laptop (diagnostics)

stdio has no `/health`. For the pages and for the extension's Diagnose command, run the same code as a server:

```bash
cd mcp-ticket-demo/server
MCP_MODE=http PORT=8787 node src/index.js
```

Or from the extension: **Start local HTTP**.

| URL | What it is |
|---|---|
| http://127.0.0.1:8787/health | Process up? cwd? lock state? |
| http://127.0.0.1:8787/test | Read-only smoke: schemas, `run_query`, seed tickets (`?write=1` needs admin sign-in) |
| http://127.0.0.1:8787/admin | `demo` / `demo` |
| http://127.0.0.1:8787/sse | Local SSE (same path as Code Engine) |
| http://127.0.0.1:8787/mcp | Streamable HTTP |

## From the terminal

With the HTTP server running, the same `mcp-ticket-demo` command is a client for it:

```bash
cd mcp-ticket-demo/server
node src/index.js status                       # or: npx mcp-ticket-demo status
node src/index.js call run_query schema=tickets 'filter={"status":"open"}' limit=5
node src/index.js users list --user demo --password-stdin     # type demo, Enter
node src/index.js demo apply --user demo --password demo     # then: demo check, demo remove
```

The default target is `http://127.0.0.1:8787/mcp` (`--url` or `MCP_URL` to change it). Run with **no arguments** it is the stdio server, which is what the `mcp.json` entries above start, so adding the command line did not change them. The operate commands (`users`, `keys`, `rate-limit`, `settings`) need an admin credential: the built-in `demo` / `demo` on a laptop. See [server/README.md](../server/README.md#command-line) for every command.

**Tests:** from `server/`, `npm run test:all` runs every suite (smoke, system, tools, ops, CLI, events, MQTT). With [mise](https://mise.jdx.dev/) installed, `mise run test-all` from the repo root does the same and pins Node 22.

## A real call with real output

Ask the agent:

> Search open tickets. Then create a ticket for ada@example.com with subject "Need the remote URL". Then create a second ticket *without* a requester and tell me who owns each one.

Expected:

1. At least TCK-1001 / 1002 / 1003 from the seed data.
2. New ticket owned by `ada@example.com`.
3. Second ticket owned by `mcp-bot@service.local`, status 201, warning in the tool result.

## Edge cases written down

| What you see | What it means | What to try |
|---|---|---|
| Empty `run_query` on `tickets` | No rows for those filters | Drop the `status` or `requester_email` filter (no `status` lists every ticket). Do not retry the same filters |
| `create_ticket` 201 + warning | Service account is the requester | Pass `requester_email` |
| Write tool says it is locked | `/admin` lock is on | Token in `Authorization: Bearer` or unlock |
| Extension Diagnose can't reach /health | HTTP server is not running | Start local HTTP, or set `summitMcp.remoteUrl` |
