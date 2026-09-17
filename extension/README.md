# MCP Platform Demo

Control plane for the summit ticket MCP.

- **Native stdio** — `node`, no container
- **Local Podman** — same Dockerfile as Code Engine
- **Remote Code Engine** — public `/sse` and `/mcp`
- **Settings** — probe target, URLs, Podman image, admin lock
- **Diagnose** — config, runtime, `/health`, `tools/list`, one real call
- **Chat** — file a talk-scar prompt into the LLM in this editor

Open the **MCP-SummitToronto** repo root after install. The **MCP Platform** activity-bar icon is the Code Engine–style control plane: Setup & Diagnostics dashboard, Resources tree, status-bar quick menu, and a full diagnostics panel.

Personal open-source demo. Not an IBM product.
