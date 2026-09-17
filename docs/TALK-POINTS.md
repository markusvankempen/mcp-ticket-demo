# Talk points → MCP Demo

Companion for [**MCP as a Platform**](https://events.linuxfoundation.org/mcp-dev-summit-toronto/program/schedule/?id=1282401) · [MCP Dev Summit Toronto](https://events.linuxfoundation.org/mcp-dev-summit-toronto/) · Monday 5 October 2026, 12:00–12:25 EDT · [github.com/markusvankempen/mcp-ticket-demo](https://github.com/markusvankempen/mcp-ticket-demo)

Maps `talk-02-mcp-as-a-platform-portfolio-slides` onto something you can click.

| Slide | On stage, do this |
|---|---|
| 3 · Three ways to run it | Show native stdio in `.cursor/mcp.json` / `.bob/mcp.json` (`node`, no Docker), then the Code Engine `/health` URL |
| 5 · Naming | Compare `search_tickets(status, requester_email, limit)` with the tool that does **not** exist: `request(...)` |
| 6 · Tool overload | `list_schemas` → `get_schema` → `run_query`. There is no `query_tickets` / `query_assets` |
| 7 · 201 ≠ done | `create_ticket` with only subject + body. `/admin` shows attribution **service account**. Repeat with `requester_email` |
| 8 · Extension is a UI | Discover → Connect local → Diagnose. Failures say what to try |
| 9 · 0 tools discovered | Show REMOTE.md "wrong path" vs `WORKDIR /app` + `node src/index.js` |
| 10 · Silent failures | Lock writes without a token. Set `TENANT_ID` and omit `x-tenant-id`. Paste an old hostname |
| 12 / 15 · Two readers | README for you. Tool descriptions for the model — it never opens this file |

The live talk still has **one** official demo (discoverability search on slide 13). Everything here is the backup you can run in Q&A or in the workshop.
