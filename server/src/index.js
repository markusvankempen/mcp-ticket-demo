#!/usr/bin/env node
/**
 * One MCP server. Two ways to run it.
 *
 *   MCP_MODE=stdio node src/index.js     # local child process, no port
 *   MCP_MODE=http  node src/index.js     # /health /test /admin /sse /mcp
 *
 * Absolute laptop paths belong in neither. The process starts from its package root.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createStore } from "./store.js";
import { createSecurity } from "./security.js";
import { createMcpServer } from "./create-server.js";
import { startHttp } from "./http.js";

const mode = (process.env.MCP_MODE || (process.argv.includes("--http") ? "http" : "stdio")).toLowerCase();

const store = createStore();
const security = createSecurity({ log: store.log });

/**
 * stdio has no request headers, so the credential comes from the process env.
 * The client (IDE, workbench) puts it there; it never travels over a socket.
 */
function stdioHeaders() {
  const headers = {};
  if (process.env.MCP_API_KEY) headers["x-api-key"] = process.env.MCP_API_KEY;
  if (process.env.MCP_USERNAME) {
    const pair = `${process.env.MCP_USERNAME}:${process.env.MCP_PASSWORD || ""}`;
    headers.authorization = `Basic ${Buffer.from(pair).toString("base64")}`;
  }
  if (process.env.TENANT_ID) headers["x-tenant-id"] = process.env.TENANT_ID;
  return headers;
}

if (process.cwd().includes("/Users/") && mode === "http" && process.env.CODE_ENGINE_PROJECT) {
  console.error("Warning: cwd looks like a laptop path inside a cloud-shaped env. Use a relative package root.");
}

if (mode === "http") {
  await startHttp({ store, security });
} else {
  const server = createMcpServer({ store, security, requestHeaders: stdioHeaders });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  const authMode = security.snapshot().authMode;
  console.error(`mcp-ticket-demo stdio — no port, no URL. Secrets stay in env. auth mode=${authMode}`);
  if (authMode !== "off" && !process.env.MCP_API_KEY && !process.env.MCP_USERNAME) {
    console.error("  auth is on but no MCP_API_KEY / MCP_USERNAME in env — gated tools will be denied.");
  }
}
