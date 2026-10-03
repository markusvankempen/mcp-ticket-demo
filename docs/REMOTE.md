# Remote — Code Engine

The same `src/index.js`. `MCP_MODE=http`. Working directory is `/app` inside the image. Secrets are application environment variables. The public URL is HTTPS on port **443**.

## Endpoints

Once deployed, if the app is `mcp-ticket-demo` in project `markus-app-v2-toronto`:

```
https://mcp-ticket-demo.<subdomain>.ca-tor.codeengine.appdomain.cloud/health
https://mcp-ticket-demo.<subdomain>.ca-tor.codeengine.appdomain.cloud/test
https://mcp-ticket-demo.<subdomain>.ca-tor.codeengine.appdomain.cloud/admin
https://mcp-ticket-demo.<subdomain>.ca-tor.codeengine.appdomain.cloud/sse
https://mcp-ticket-demo.<subdomain>.ca-tor.codeengine.appdomain.cloud/mcp
```

A new Code Engine project means a **new hostname**. Never paste an old URL into `mcp.json` from memory. Resolve it after deploy (extension **Connect remote SSE**, or `ce_get_application`).

Remote is a **second** MCP server (`mcp-ticket-demo-remote`). Native stdio (`mcp-ticket-demo`, `node`, no Docker) stays in the same mcp files.

## Cursor remote config

Cursor connects to Streamable HTTP directly:

```json
{
  "mcpServers": {
    "mcp-ticket-demo-remote": {
      "url": "https://<host>/mcp",
      "headers": { "Authorization": "Bearer mcpk_your_api_key" }
    }
  }
}
```

VS Code:

```json
{
  "servers": {
    "mcp-ticket-demo-remote": {
      "type": "http",
      "url": "https://<host>/mcp",
      "headers": { "Authorization": "Bearer mcpk_your_api_key" }
    }
  }
}
```

Leave `headers` out while `AUTH_MODE=off`. Do not send a made-up token: the server reads every Bearer value as an API key and answers 401 to one it does not know.

## Configure the deployed server over MCP

Once it is up you can operate it without opening `/admin`: patch settings with `update_settings`, manage users and API keys, read the settings row with `run_query schema=settings`, or run the Demo setup. Three UIs do the same thing against any MCP URL:

- **Remote config** on `/admin` (or `/clients/browser.html`), with the deployed `https://<host>/mcp` in the URL field
- the extension's **Remote config** tab, after pointing the probe at the host
- the command line:

```bash
export MCP_URL=https://<host>/mcp
export MCP_API_KEY=mcpk_your_admin_key        # an admin-scope key, or use --user and --password-stdin
npx mcp-ticket-demo status
npx mcp-ticket-demo rate-limit --limit 120 --window 60
npx mcp-ticket-demo keys create --label ci --scopes read
npx mcp-ticket-demo settings export --out settings.json
```

The operate tools need the `admin` scope even while `AUTH_MODE=off`, and `demo` / `demo` is a laptop default only: set `ADMIN_PASSWORD` in the app's environment first, and use a key you issued rather than a password in a script. An HTTPS host with the default admin password is not safe to leave up. The `/admin` cookie is not accepted on `/mcp`, so a script needs a key or HTTP Basic.

`demo apply` and `demo remove` change real settings on whatever host you name, so run them on a deployment you own, not a shared one. Nothing here is saved by the tools: tickets, users and keys live in memory and reset when the app restarts, so after a restart run `settings import` or the Demo setup again.

## Deploy from this machine

Podman is the local runtime. Project: `markus-app-v2-toronto` (`ca-tor`, id `7e131e87-e967-4e7f-a2f1-480957244eac`). ICR namespace: `ce--5d0be-29m5mrru3s3n`. Pull secret: `ce-auto-icr-private-ca-tor`.

```bash
# ibmcloud must already be logged in (ce + cr plugins)
chmod +x mcp-ticket-demo/deploy.sh
./mcp-ticket-demo/deploy.sh
```

Or from the Code Engine MCP, once Podman machine is up:

`proc_build_push_deploy` with context `mcp-ticket-demo/`, project id above, app `mcp-ticket-demo`, `icr_host=ca.icr.io`, min instances `1`.

A Code Engine *local-source* build was registered as `mcp-ticket-demo-build`. It expects a source image `…/mcp-ticket-demo-source:latest` — that is what `ibmcloud ce buildrun submit --source .` uploads. Don't start the build config by name alone.

Environment on the app (not in git):

```
MCP_MODE=http
PORT=8080
ADMIN_USER=demo
ADMIN_PASSWORD=<change me>
AUTH_MODE=write
RATE_LIMIT=60
```

A public URL should not accept anonymous writes, so `AUTH_MODE=write` is the deploy default
even though the laptop default is `off`. Then sign in to `/admin`, issue an API key with the
scopes a client needs, and give clients the key rather than the admin password. `API_KEY`
also registers one key at boot if you would rather provision it with the app.

Keep at least one instance warm before going on stage (`scale_min_instances=1`) so `/health` is not a cold start.

## The "0 tools discovered" repro

This is the scar from slide 9.

**Wrong** — what I registered the first time:

```
command: node /Users/me/projects/.../mcp-ticket-demo/server/src/index.js
```

The orchestrator runs in a cloud container. It `stat`s that path, finds nothing, and a missing file reads as an empty tool list. No error. No warning.

**Right** — what the Dockerfile does:

```
WORKDIR /app
CMD ["node", "src/index.js"]
```

Relative to the package root. The image is the upload.

If you are attaching this server to watsonx Orchestrate as a toolkit, upload the package and set the command to `node src/index.js` with package-root `./mcp-ticket-demo/server`. Do not paste a laptop path.

## Hostname instability

`mcp.json` that worked yesterday 404s today when the app was recreated in a new project. Diagnose will fail `GET /health` and tell you to set `summitMcp.remoteUrl` to the URL from the current revision — not the one in last week's notes.
