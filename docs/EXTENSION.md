# VS Code / Cursor / Bob extension

The extension does not call tickets for the model. It is a UI for **you**: Setup, Settings, Diagnose, and Chat.

The activity bar **MCP Platform** icon matches the Code Engine MCP layout:

- **Setup & Diagnostics** — dark dashboard (Setup · Diagnose · Settings · Chat), stats, log
- **Resources** — tree: Transports, Pages (`/health` `/test` `/admin` `/tools`), Config files
- **Status bar** — `MCP Platform` · click for the quick menu
- **Open panel** — the same dashboard in a full editor tab (ViewColumn.One)

**MCP Platform: Diagnose** opens the panel and runs the checklist.

## Load it

**Option A — VSIX**

```bash
cd mcp-ticket-demo/extension
npx @vscode/vsce package --no-dependencies --allow-missing-repository --allow-star-activation
```

Then **Extensions: Install from VSIX…** in VS Code, Cursor, or IBM Bob. Current file: `summit-mcp-platform-1.1.0.vsix`.

**Option B — Extension Development Host**

F5 using **MCP Platform extension** in `.vscode/launch.json`. Open the **MCP-SummitToronto** folder in the new window.

## Three ways to run the MCP

| Mode | What it starts | mcp.json server |
|---|---|---|
| Native stdio | `node src/index.js` in `mcp-ticket-demo/server` | `mcp-ticket-demo` |
| Local Podman | Same Dockerfile as Code Engine. HTTP on host port **8787**, or `podman run -i` stdio | `mcp-ticket-demo-podman` |
| Remote Code Engine | Public HTTPS `/sse` (VS Code / Cursor) and `/mcp` (Bob) | `mcp-ticket-demo-remote` |

Connecting one mode does not delete the others.

## Settings

Tab **Settings**, or `summitMcp.*` in workspace settings:

| Setting | Default | Used for |
|---|---|---|
| `probeTarget` | `auto` | Which URL Diagnose and Open /health use |
| `remoteUrl` | empty | Code Engine hostname |
| `localHttpUrl` | `http://127.0.0.1:8787` | Native HTTP |
| `podmanImage` | `mcp-ticket-demo:local` | Local image tag |
| `podmanContainer` | `mcp-ticket-demo` | Container name |
| `podmanPort` | `8787` | Host port → container 8080 |
| `adminUser` / `adminPassword` | `demo` / `demo` | `/admin`, and an `admin`-scoped MCP credential |
| `apiKey` | unset | API key sent when calling tools — `Bearer` over HTTP, `MCP_API_KEY` over stdio |
| `authMode` | `off` | `off` / `write` / `all` — what the local server gates |
| `demoToken` | `demo-token` | Legacy single bearer token, superseded by `apiKey` |

`probeTarget`: `auto` (remote URL if set, else local HTTP) · `native-http` · `podman` · `remote`.

## Diagnostics

**Diagnose** checks workspace, native mcp.json, Bob, Podman (when the probe target is Podman), `/health`, `/test`, `tools/list`, and one `search_tickets` call. Failures say what to try.

## Chat — file a prompt to the LLM

The **Chat** tab sends a talk-scar prompt into this editor's chat (VS Code Copilot / Cursor / Bob). If the chat API is not available, the prompt is copied and you paste.

Quick action **Send search to chat** does the same for "Search open tickets…".

## Commands

| Command | What it does |
|---|---|
| Discover mcp.json | Reads VS Code, Cursor, and Bob files |
| Connect native stdio | `node` + `cwd` = `mcp-ticket-demo/server` |
| Build & start local Podman | `podman build` + `podman run` mapping 8787→8080 |
| Connect Podman stdio | `podman run -i --rm` |
| Connect Podman HTTP | localhost `/sse` and `/mcp` |
| Connect remote Code Engine | Second server, public URL |
| Diagnose | Panel + sidebar checklist |
| Send prompt to chat | Files text into the LLM |
| Open /health /test /admin /tools | Browser |

## What a failure looks like

| Fail | Typical next action |
|---|---|
| Server package missing | Open the repo root |
| mcp.json missing | Connect native, Podman, or remote |
| Podman overlay / machine error | `podman machine start`, or use native stdio |
| /health down | Start native HTTP or Start local Podman, or set `remoteUrl` |
| **0 tools discovered** | cwd / path / MCP_MODE. Slide 9. |

Reload the editor after Connect. Clients cache the spawned process.
