# IBM Bob IDE

Bob is a third MCP client. Same server. Different config file.

Official project file: [Using MCP in Bob](https://bob.ibm.com/docs/ide/configuration/mcp/mcp-in-bob).

| Level | File | Who it is for |
|---|---|---|
| Project (this repo) | `.bob/mcp.json` | Share with the team. Wins when names collide. |
| Global (this laptop) | `~/.bob/settings/mcp.json` | Every workspace. Older Bob builds also read `~/.bob/mcp.json` or `~/.bob/mcp_settings.json`. |
| Bob-as-VS-Code-extension | `.vscode/settings.json` → `cline.mcpServers` | Same `mcpServers` shape. Leftover path from Cline / Roo-Cline. |

The MCP spec does not name these files. Each client invented one.

## Open the repo root

Bob must open **MCP-SummitToronto**, not `mcp-ticket-demo/` or `mcp-ticket-demo/server/`. Relative `args` in `.bob/mcp.json` resolve from the workspace. A laptop absolute path in a committed Bob file is how you get **0 tools discovered** on the next machine.

## Local stdio

Already committed as `.bob/mcp.json`. After `npm install` in `mcp-ticket-demo/server`:

1. Open this folder in Bob.
2. Bob panel → gear → **MCP** tab.
3. Confirm **Use MCP Servers** is checked.
4. **Edit Project MCP** should show `mcp-ticket-demo`.
5. Reload the window if the server was already listed as missing.
6. Ask: *Search open tickets.*

```json
{
  "mcpServers": {
    "mcp-ticket-demo": {
      "command": "node",
      "args": ["src/index.js"],
      "cwd": "mcp-ticket-demo/server",
      "env": { "MCP_MODE": "stdio" },
      "alwaysAllow": [
        "search_tickets",
        "create_ticket",
        "add_comment",
        "get_ticket",
        "list_schemas",
        "get_schema",
        "run_query",
        "lookup_customer"
      ],
      "disabled": false
    }
  }
}
```

This is native `node`, not Docker. `cwd` is the server package so `node_modules` resolve. The extension writes an absolute `cwd` on the laptop so a stray working directory cannot silently load zero tools.

There is still **no port and no URL**. JSON-RPC 2.0 goes over stdin/stdout.

A Code Engine remote is a second server named `mcp-ticket-demo-remote`. Connecting remote does not replace this native entry.

## Remote Streamable HTTP

Bob's current remote transport is Streamable HTTP (`type: streamable-http`, `url` ends in `/mcp`). That is not the SSE URL VS Code writes.

```json
{
  "mcpServers": {
    "mcp-ticket-demo": {
      "type": "streamable-http",
      "url": "https://<host>/mcp",
      "headers": {
        "Authorization": "Bearer mcpk_your_api_key"
      },
      "alwaysAllow": [
        "search_tickets",
        "create_ticket",
        "add_comment",
        "get_ticket",
        "list_schemas",
        "get_schema",
        "run_query",
        "lookup_customer"
      ],
      "disabled": false
    }
  }
}
```

The Bearer header only matters after `/admin` locks write tools. A new Code Engine project means a new hostname — paste the URL you just deployed.

Connect remote from the extension writes this Bob shape plus VS Code SSE and Cursor `mcp-proxy`.

## Auto-approve

Bob does not auto-approve MCP tools unless:

1. **Use MCP servers** is on under Auto-approving actions, and
2. the tool is in `alwaysAllow` **or** you check **Always allow** next to that tool.

The committed list is the eight demo tools so the talk is not a click-through of permission cards. You can still toggle tools off in the MCP tab to shrink context.

## Extension inside Bob

Bob is VS Code compatible. Install the VSIX the same way:

```bash
cd mcp-ticket-demo/extension
npx @vscode/vsce package --no-dependencies
```

Then **Install from VSIX**. Discover / Connect / Diagnose write `.bob/mcp.json` and `cline.mcpServers` as well as the Cursor and VS Code files.

You do not need the extension to *use* the tools. You need `.bob/mcp.json`. The extension is the control plane.

## What a failure looks like

| What you see | What it means | What to try |
|---|---|---|
| Server missing in the MCP tab | File not at project root, or MCP disabled | Open the repo root. Check **Use MCP Servers**. **Edit Project MCP**. |
| **0 tools discovered** | Process started, `tools/list` is empty | cwd / relative path / `MCP_MODE`. Same scar as slide 9. |
| Tools listed, every call asks for approval | Auto-approve off | Global MCP auto-approve + `alwaysAllow` |
| Remote connect works in VS Code, not in Bob | You pointed Bob at `/sse` | Use `/mcp` and `type: streamable-http` |
| Writes fail after lock | Token not in `headers` | Unlock in `/admin`, or set `Authorization: Bearer` |
