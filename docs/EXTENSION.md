# VS Code / Cursor / Bob extension

This README describes extension **1.16.0**, which bundles server **3.0.1** (19 tools).

The extension does not call tickets for the model. It is a UI for **you**: set the server up, check it, configure it, and file a prompt to the chat. It is published as **LF MCP Demo** (`MarkusvanKempen.lf-mcp-summit-demo`), and every command and setting is named `summitMcp.*`.

The activity bar **LF MCP Demo** icon opens:

- **Setup & Diagnostics** — the dashboard with five tabs on by default: **Setup** · **Diagnose** · **MCP Test** · **Settings** · **Chat**, and three advanced tabs that are hidden until switched on under **Settings → Advanced tabs**: **Browser** · **Remote config** · **Events** (`summitMcp.showBrowserTab`, `summitMcp.showRemoteConfigTab`, `summitMcp.showEventsTab`), plus stats and a log
- **Resources** — tree: Transports, Pages (`/health` `/test` `/admin` `/tools` `/help`, the browser client and the command line page), Config files
- **Status bar** — click for the quick menu
- **Open panel** — the same dashboard in a full editor tab

**LF MCP Demo: Diagnose** opens the panel and runs the checklist.

The extension carries a copy of the server inside the package (`extension/server`), so it works without an npm install. `npm run check-sync` in `extension/` fails when that copy, or any version number, has drifted from `server/`.

## Load it

**Option A — VSIX**

```bash
cd mcp-ticket-demo/extension
npm run package      # tests, bundles server/ into extension/server, checks sync, then runs vsce
```

That writes `lf-mcp-summit-demo-<version>.vsix`. Then **Extensions: Install from VSIX…** in VS Code, Cursor, or IBM Bob.

**Option B — Extension Development Host**

Open `mcp-ticket-demo/extension` and start debugging with a `launch.json` of type `extensionHost` whose `args` hold `--extensionDevelopmentPath=${workspaceFolder}`. None is committed. A second window opens with the extension loaded.

To work on the panel without an editor, run `npm run preview` in `extension/` (optional tab: `mcpTest`, `remote`, …). It serves the same webview in a normal browser at http://127.0.0.1:8830/ against a throwaway server on port 8811, and runs the real **MCP CRUD test** and **Tickets** table through the same code paths as VS Code.

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
| `remoteUrl` | empty | Any public HTTPS host (Render, your own), written as `mcp-ticket-demo-remote`. No trailing slash |
| `codeEngineUrl` | empty | Your IBM Code Engine origin, no path. Empty until you paste your deployed URL; **Connect Code Engine** writes `mcp-ticket-demo-codeengine` |
| `localHttpUrl` | `http://127.0.0.1:8787` | Native HTTP |
| `podmanImage` | `mcp-ticket-demo:local` | Local image tag |
| `podmanContainer` | `mcp-ticket-demo` | Container name |
| `podmanPort` | `8787` | Host port → container 8080 |
| `adminUser` / `adminPassword` | `demo` / `demo` | `/admin`, and an `admin`-scoped MCP credential |
| `apiKey` | unset | API key sent when calling tools — `Bearer` over HTTP, `MCP_API_KEY` over stdio |
| `authMode` | `off` | `off` / `write` / `all` — what the local server gates |
| `corsOrigins` | empty | Web-page origins allowed to call the HTTP server from a browser. Passed as `CORS_ORIGINS` when the extension starts the server; restart it to apply |
| `autoConnectStdio` | `true` | On activate, writes native stdio into the IDE configs if it is missing. Never overwrites an HTTP or SSE entry |
| `showBrowserTab` | `false` | Show the **Browser** (CORS) tab |
| `showRemoteConfigTab` | `false` | Show the **Remote config** tab |
| `showEventsTab` | `false` | Show the **Events** tab |

`probeTarget`: `auto` (remote URL if set, else local HTTP) · `native-http` · `podman` · `remote` · `codeengine`. **Diagnose**, the **MCP CRUD test**, and the **Tickets** table all use the probe URL (`localHttpUrl` defaults to `http://127.0.0.1:8787`). Chat uses whatever is in `mcp.json` — they can differ.

## Diagnostics

**Diagnose** checks workspace, native mcp.json, Bob, Podman (when the probe target is Podman), `/health`, whether the running server is the same version as the code on disk (a stale process on 8787 fails; a public host is only reported), whether every chat client's config reaches that same server (a stdio entry is a private process with its own tickets, so it fails), `/test`, `tools/list`, and one `run_query` call. Failures say what to try.

`npm run check-sync` (in `extension/`) fails when the server version differs between `package.json`, the lock file, `server.json`, `src/version.js` and the READMEs, or when the copy bundled in `extension/server` differs from `server/`. `npm run package` runs it after bundling.

## MCP Test — CRUD and the ticket table

The **MCP Test** tab runs a full write cycle over HTTP against the probe server: `run_query` (baseline) → `create_ticket` → `run_query` by id → `add_comment` → `close_ticket` (optional) → `run_query` to find the ticket again by subject. It scores tool JSON (`ok`, fields, `next`), not bare HTTP 200. On a non-local probe host it asks first, because it leaves a real ticket behind.

**Test ticket** fields (blank uses the placeholder default):

| Field | Default | Notes |
|---|---|---|
| Subject | MCP CRUD test ticket | Passed to `create_ticket` |
| Body | Created by the MCP CRUD test in the extension. | |
| Requester email | ada@example.com | Omit only to reproduce the attribution scar in chat, not here |
| Status at the end | solved | `solved` calls `close_ticket`; `open` skips it. MCP has no tool that sets `pending` — new tickets start open |

After each run, the **Tickets** section refreshes if you have loaded it once. **Show tickets** calls `run_query` with `schema=tickets`, up to 50 rows, newest first. Columns: id, subject, requester email, status. The **Status** filter (`all`, `open`, `pending`, `solved`) reloads on change. Send `summitMcp.apiKey` as `Authorization: Bearer` when the server is in auth mode `write` or `all`.

![MCP Test tab — full CRUD cycle passing](assets/screenshots/ext-crudtest.png)

## Browser — can a web page call it?

*Advanced tab — off by default; turn it on under **Settings → Advanced tabs** (`summitMcp.showBrowserTab`).*

A browser sends an `Origin` header with every cross-site call, and the server answers only for localhost, its own host, or an origin listed in `CORS_ORIGINS`. Editors, curl and Claude send no origin, so this only matters for web pages. The **Browser** tab sets `summitMcp.corsOrigins`, runs a preflight plus a real `run_query` call with the origin you enter (and checks that an unlisted site is refused), opens `/clients/browser.html`, and copies a `fetch()` snippet with a `<your-api-key>` placeholder. The test is read-only.

## Remote config — operate a server over MCP

*Advanced tab — off by default; turn it on under **Settings → Advanced tabs** (`summitMcp.showRemoteConfigTab`).*

The **Remote config** tab is the same page as **Admin → Remote config** on the server's `/admin` desk, running inside the panel. Point it at the probe server or any deployed one, then:

- **Set the rate limit and call trace**, **manage users and API keys** (list, create, delete, revoke; a key secret is shown once), and run **any tool** from a form built from its schema.
- **Demo setup.** **Apply** creates four users (`demo-reader`, `demo-writer`, `demo-pii`, `demo-admin`, password `demo-pass`) and four labelled API keys, turns the call trace on, records sample traffic, sets auth mode `write` and the rate limit to 30 per 60 s. **Check** signs in as each role and as nobody and tests who can read, write, see PII and use admin tools. **Remove** puts auth back to `off`, 60 per 60 s and trace off. Apply and Remove ask first.
- A **self-test** creates and removes a throwaway user and key.

The operate tools need an `admin` credential even while auth is `off`. A local server gets the admin user from Settings (`demo` / `demo`); a remote URL never gets a password from the extension, so paste a key or a username. A webview cannot call the network, so the extension makes each request from its own process and hands the reply back; no CORS setup is needed for this tab.

The Demo setup is the same sequence the `mcp-ticket-demo demo apply | check | remove` command runs, so either one can check what the other applied. `npm test` in `extension/` runs the checks, including a full Apply, Check and Remove against a live server.

## Events — listen live

*Advanced tab — off by default; turn it on under **Settings → Advanced tabs** (`summitMcp.showEventsTab`).*

Events are **off until an admin turns them on** (`update_settings` with `events.enabled=true`, or the Events tick boxes on `/admin`). When enabled, the server sends standard MCP logging notifications (`notifications/message`) over SSE, Streamable HTTP (`GET /mcp` on an initialized session), or stdio. The tab opens a filtered stream (`ticket.*`, `timer.*`, …), shows hello/status lines, and can run a small demo (create a ticket and watch `ticket.created`). MQTT is optional (`set_mqtt` on the server). See [DEMO.md — Demo 15](DEMO.md#demo-15--listen-to-the-server).

## Command line

The server packed in the extension is also a command line client for any running server. See [server/README.md](../server/README.md#command-line) for every command. **LF MCP Demo: Open command line page** opens `/clients/cli.html` on the probe server, with the commands to copy.

```bash
npx mcp-ticket-demo status --url http://127.0.0.1:8787
npx mcp-ticket-demo demo check --user demo --password-stdin
```

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
| Open /health /test /admin /tools /help | Browser |
| Remote config | Opens the Remote config tab |
| Test browser access (CORS) | Preflight and `run_query` as a web-page origin, plus a refused-site check |
| Open browser client page | `/clients/browser.html` on the probe server |
| Open command line page | `/clients/cli.html` on the probe server |
| Copy browser fetch snippet | `fetch()` for the probe URL, key left as a placeholder |
| Copy CORS_ORIGINS line | `CORS_ORIGINS=…` for a deployed server's environment |
| Register server with all IDEs | Writes VS Code, Cursor, Bob (and Windsurf / Cline if installed) |
| Run MCP CRUD test | Panel → MCP Test: configurable ticket, then create → read → comment → close (optional) → find by subject; asks first on remote hosts |
| Install bundled server / Update server from npm | Confirms the packed server; installs from npm only for builds without one |

## What a failure looks like

| Fail | Typical next action |
|---|---|
| Server package missing | Open the repo root |
| mcp.json missing | Connect native, Podman, or remote |
| Podman overlay / machine error | `podman machine start`, or use native stdio |
| /health down | Start native HTTP or Start local Podman, or set `remoteUrl` |
| **0 tools discovered** | cwd / path / MCP_MODE. Slide 9. |

Reload the editor after Connect. Clients cache the spawned process.
