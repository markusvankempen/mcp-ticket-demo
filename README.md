[![MCP as a Platform — MCP Dev Summit Toronto 2026](docs/assets/mcp-as-a-platform-banner.jpeg)](https://events.linuxfoundation.org/mcp-dev-summit-toronto/program/schedule/?id=1282401)

# MCP Demo

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Protocol-5A29E4?style=for-the-badge)](https://modelcontextprotocol.io/)
[![IBM Cloud](https://img.shields.io/badge/IBM-Cloud_Code_Engine-052FAD?style=for-the-badge&logo=ibm&logoColor=white)](https://www.ibm.com/products/code-engine)
[![npm](https://img.shields.io/npm/v/mcp-ticket-demo?style=for-the-badge&logo=npm&logoColor=white&label=npm)](https://www.npmjs.com/package/mcp-ticket-demo)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-mcp--ticket--demo-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/markusvankempen/mcp-ticket-demo)
[![Linux Foundation](https://img.shields.io/badge/Linux_Foundation-MCP_Dev_Summit_Toronto-003366?style=for-the-badge)](https://events.linuxfoundation.org/mcp-dev-summit-toronto/program/schedule/?id=1282401)

Companion repo for [**MCP as a Platform: What I Learned Building a Portfolio of MCP Servers**](https://events.linuxfoundation.org/mcp-dev-summit-toronto/program/schedule/?id=1282401) · [MCP Dev Summit Toronto](https://events.linuxfoundation.org/mcp-dev-summit-toronto/) · Monday 5 October 2026, 12:00–12:25 EDT · Terrace East + West

**Clone:** [github.com/markusvankempen/mcp-ticket-demo](https://github.com/markusvankempen/mcp-ticket-demo)

I built this because I wanted something I could point at on stage and say: here's the architecture from the talk, running twice — once on the laptop, once on IBM Cloud Code Engine — with an editor extension that is the control plane.

Personal open-source demo. **Not an IBM product.**

> The extension is the control plane. The MCP server is the capability.

Same tools. Same schemas. Same in-memory tickets. Two transports.

| How you run it | Transport | Port | Secrets |
|---|---|---|---|
| Laptop, native (Cursor / VS Code / Bob) | **stdio** — `node`, no Docker | none | env on your machine |
| Laptop, browser diagnostics | **HTTP** `:8787` | 8787 | env on your machine |
| Code Engine (container) | **SSE** `/sse` + **Streamable HTTP** `/mcp` | **443** | env on the app |

---

## What this demo is for

It is a support-ticketing sandbox that teaches the talk, not a Zendesk clone.

| You do this | Talk point it makes |
|---|---|
| Call `search_tickets` instead of `request(path, method)` | Naming is the interface |
| Call `create_ticket` **without** `requester_email` | 201 is not done — the bot owns the ticket |
| Call `list_schemas` then `run_query` | One query tool beats a pile of `query_*` names |
| Open `/health` then `/test` | Alive ≠ works |
| Sign in to `/admin` and lock write tools | Security is an operator concern, not a README footnote |
| Hand a laptop path to a cloud runner | **0 tools discovered** — no error, no warning |
| Write `mcp.json` from the extension | Discover → Connect → Diagnose |

---

## Repo layout

```
mcp-ticket-demo/
  server/          MCP server (stdio + HTTP)
  extension/       VS Code / Cursor extension
  docs/            Local, remote, extension, admin, talk map
  Dockerfile       Code Engine image, WORKDIR /app
```

---

## MCP server on npm

The server is published as [`mcp-ticket-demo`](https://www.npmjs.com/package/mcp-ticket-demo) — no clone required.

```bash
# stdio (what the IDE spawns)
npx mcp-ticket-demo

# HTTP — /health /test /admin /mcp /sse
MCP_MODE=http npx mcp-ticket-demo
```

## Ten-minute local path

Timed on a clean machine. Node 18+.

```bash
cd mcp-ticket-demo/server
npm install
npm run http          # MCP_MODE=http PORT=8787
```

Then in another terminal:

```bash
curl -s http://127.0.0.1:8787/health?format=json
curl -s http://127.0.0.1:8787/test?format=json
```

Browser:

- http://127.0.0.1:8787/health — is it alive?
- http://127.0.0.1:8787/test — does a real create + search work?
- http://127.0.0.1:8787/admin — login `demo` / `demo`, set the auth mode, issue API keys, set a rate limit

stdio (what the editor actually spawns):

```bash
cd mcp-ticket-demo/server
npm run stdio
```

No port. No URL. The client talks over stdin/stdout.

Load the extension (build with `npm run package` in `extension/`, or F5 in the Extension Development Host). The sidebar has Setup, Diagnose, Settings, and Chat. **Connect native stdio** writes the Node MCP. **Build & start local Podman** uses the same image as Code Engine. **Chat** files a prompt into the LLM. Reload the window after Connect.

IBM Bob: [docs/BOB.md](docs/BOB.md). Open the repo root, MCP tab, **Use MCP Servers**.

Full walkthroughs: [docs/LOCAL.md](docs/LOCAL.md) · [docs/EXTENSION.md](docs/EXTENSION.md) · [docs/REMOTE.md](docs/REMOTE.md) · [docs/ADMIN-AND-SECURITY.md](docs/ADMIN-AND-SECURITY.md) · [docs/BOB.md](docs/BOB.md)

**Building your own MCP server?** → [docs/LESSONS-LEARNED.md](docs/LESSONS-LEARNED.md) — 15 lessons, war stories, and a pre-publish checklist grounded in building this server.

---

## Tools the model sees

Descriptions say **when** to use the tool, not just what it does. Empty results tell it not to retry.

| Tool | When | Scope | Lesson |
|---|---|---|---|
| `describe_server` | First, and after any denial | open | Discovery beats guessing |
| `search_tickets` | Find tickets by status / requester / keyword | `read` | Journey name, not an HTTP wrapper |
| `create_ticket` | Open a ticket. Pass `requester_email`. | `write` | Omit it → 201 + service-account owner |
| `add_comment` | Comment on a known ticket id | `write` | Write tool; gated |
| `get_ticket` | You already have `TCK-…` | `read` | Instance fetch |
| `list_schemas` | Before any query | `read` | Discover the shape |
| `get_schema` | After list, before query | `read` | Fields + filters |
| `run_query` | The one query tool | `read` | Replaces `query_tickets` / `query_assets` / … |
| `lookup_customer` | Customer record. Phone is PII. | `pii` | Redacted without the `pii` scope |

There is no `request(path, method, query, body)`. On purpose.

Whether a scope is *enforced* depends on the auth mode set on `/admin`. The tools never
disappear from `tools/list` — see [docs/ADMIN-AND-SECURITY.md](docs/ADMIN-AND-SECURITY.md).

---

## HTTP surfaces (convention, not the spec)

Say this out loud if someone asks: **`/health` `/test` `/admin` are mine. They are not in the MCP spec.**

| Path | Question it answers |
|---|---|
| `GET /health` | Is the process up? |
| `GET /test` | Can it create and find a ticket? |
| `GET /admin` | Can an operator set the auth mode, issue keys, rate limit, and see attribution? |
| `GET /sse` + `POST /messages` | Legacy remote transport (Cursor `mcp-proxy`) |
| `ALL /mcp` | Streamable HTTP — current remote transport |

---

## Environment

See `.env.example`. Defaults are for the talk, not for production.

| Variable | Default | What it does |
|---|---|---|
| `MCP_MODE` | `stdio` unless `--http` | Transport |
| `PORT` | `8080` (compose uses `8787` locally) | HTTP only |
| `ADMIN_USER` / `ADMIN_PASSWORD` | `demo` / `demo` | `/admin` login, and an `admin`-scoped MCP credential |
| `AUTH_MODE` | `off` | `off`, `write`, or `all` — what needs a credential |
| `API_KEY` / `API_KEY_SCOPES` | unset / `read,write` | Register one API key at boot |
| `MCP_USERS` | unset | `"alice:secret:read,write"` — extra logins |
| `RATE_LIMIT` / `RATE_LIMIT_WINDOW_MS` | `60` / `60000` | Calls per window, per caller |
| `RATE_LIMIT_ENABLED` | `1` | Set `0` to turn rate limiting off |
| `MCP_API_KEY` | unset | stdio only: the credential this process presents to itself |
| `MCP_USERNAME` / `MCP_PASSWORD` | unset | stdio only: same, as a login |
| `DEMO_TOKEN` | `demo-token` | Legacy single bearer token, still accepted |
| `WRITE_TOOLS_LOCKED` | `0` | Legacy switch — same as `AUTH_MODE=write` |
| `TENANT_ID` | unset | If set, writes also need `x-tenant-id` |

On Code Engine those values live on the application, not in `mcp.json`.

---

## Remote deploy

IBM Cloud Code Engine, Toronto (`ca-tor`). Image builds from this folder so the process starts at `/app`.

```bash
# from repo root, after the image is in ICR
# or use the Code Engine MCP: proc_build_push_deploy
```

Details and the "0 tools discovered" repro: [docs/REMOTE.md](docs/REMOTE.md).

---

## Honest limits

- Tickets live in memory. A new container revision starts the seed data over.
- Admin auth is a session cookie, not SSO.
- The demo token is a shared bearer string. Fine for a stage. Not fine for customer PII.
- `/health` being green does not mean the ticket went to the right person.

*No bug too small, no syntax too weird.*

---

**Author:** Markus van Kempen · [mvankempen@ca.ibm.com](mailto:mvankempen@ca.ibm.com) · [markus.van.kempen@gmail.com](mailto:markus.van.kempen@gmail.com) · [markusvankempen.github.io](https://markusvankempen.github.io/) · [Linux Foundation Speaking Session](https://events.linuxfoundation.org/mcp-dev-summit-toronto/program/schedule/?id=1282401)
