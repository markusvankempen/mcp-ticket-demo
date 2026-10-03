# Documentation

Personal open-source project. Current releases: **mcp-ticket-demo** server **3.0.1** (19 tools) and **LF MCP Demo** extension **1.16.0** (bundles that server). Version history is in [PUBLISHING.md](PUBLISHING.md).

All curl examples assume a laptop HTTP server at **http://127.0.0.1:8787** unless a doc says otherwise.

| Doc | What's in it |
|---|---|
| [DEMO.md](DEMO.md) | **16 live curl demos** plus one-command setup — health, smoke, discovery, `run_query`, attribution, auth, events, MQTT, real captured JSON |
| [LESSONS-LEARNED.md](LESSONS-LEARNED.md) | Lessons from building a real MCP server — naming, errors, consolidation (31 → 19 tools), checklist |
| [LOCAL.md](LOCAL.md) | Native stdio and laptop HTTP — `mcp.json`, `/health` `/test` `/admin`, CLI, tests |
| [REMOTE.md](REMOTE.md) | Deploy to IBM Code Engine (or any HTTPS host) and the **0 tools discovered** cwd repro |
| [ADMIN-AND-SECURITY.md](ADMIN-AND-SECURITY.md) | Auth modes, API keys, scopes, tool gates, `update_settings` patch |
| [BOB.md](BOB.md) | IBM Bob — `.bob/mcp.json`, Streamable HTTP `/mcp`, auto-approve |
| [EXTENSION.md](EXTENSION.md) | LF MCP Demo extension — tabs, Diagnose, MCP Test (CRUD + ticket table), Remote config, preview |
| [PUBLISHING.md](PUBLISHING.md) | npm, MCP Registry, VS Code Marketplace / Open VSX — version history |

Server API reference: [../server/README.md](../server/README.md). Extension detail: [../extension/README.md](../extension/README.md).
