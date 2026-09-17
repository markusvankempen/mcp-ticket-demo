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

`.cursor/mcp.json` and `.bob/mcp.json` use the same command with `cwd: "mcp-ticket-demo/server"`. Bob also lists the nine tools in `alwaysAllow`.

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
| http://127.0.0.1:8787/test | Create + search smoke test |
| http://127.0.0.1:8787/admin | `demo` / `demo` |
| http://127.0.0.1:8787/sse | Local SSE (same path as Code Engine) |
| http://127.0.0.1:8787/mcp | Streamable HTTP |

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
| Empty `search_tickets` | No rows for those filters | `status=all` or drop `requester_email`. Do not retry the same filters |
| `create_ticket` 201 + warning | Service account is the requester | Pass `requester_email` |
| Write tool says it is locked | `/admin` lock is on | Token in `Authorization: Bearer` or unlock |
| Extension Diagnose can't reach /health | HTTP server is not running | Start local HTTP, or set `summitMcp.remoteUrl` |
