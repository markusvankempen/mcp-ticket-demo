const vscode = require("vscode");
const fs = require("fs");
const os = require("os");
const path = require("path");

const SERVER_ID = "mcp-ticket-demo";
const PODMAN_ID = "mcp-ticket-demo-podman";
const REMOTE_ID = "mcp-ticket-demo-remote";

const ALWAYS_ALLOW = [
  "describe_server",
  "search_tickets",
  "create_ticket",
  "add_comment",
  "get_ticket",
  "list_schemas",
  "get_schema",
  "run_query",
  "lookup_customer",
];

function workspaceRoot() {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
}

function serverDir() {
  return path.join(workspaceRoot(), "mcp-ticket-demo", "server");
}

function serverEntry() {
  return path.join(serverDir(), "src", "index.js");
}

function settings() {
  const cfg = vscode.workspace.getConfiguration("summitMcp");
  const port = Number(cfg.get("podmanPort") || 8787);
  const localHttpUrl = String(cfg.get("localHttpUrl") || `http://127.0.0.1:${port}`).replace(/\/$/, "");
  return {
    remoteUrl: String(cfg.get("remoteUrl") || "").replace(/\/$/, ""),
    localHttpUrl,
    podmanImage: String(cfg.get("podmanImage") || "mcp-ticket-demo:local"),
    podmanContainer: String(cfg.get("podmanContainer") || "mcp-ticket-demo"),
    podmanPort: port,
    adminUser: String(cfg.get("adminUser") || "demo"),
    adminPassword: String(cfg.get("adminPassword") || "demo"),
    demoToken: String(cfg.get("demoToken") || "demo-token"),
    apiKey: String(cfg.get("apiKey") || ""),
    authMode: String(cfg.get("authMode") || "off"),
    probeTarget: String(cfg.get("probeTarget") || "auto"),
  };
}

function podmanHttpUrl() {
  return `http://127.0.0.1:${settings().podmanPort}`;
}

function httpBase() {
  const s = settings();
  if (s.probeTarget === "remote") return s.remoteUrl || s.localHttpUrl;
  if (s.probeTarget === "podman") return podmanHttpUrl();
  if (s.probeTarget === "native-http") return s.localHttpUrl;
  return s.remoteUrl || s.localHttpUrl;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function stripJsonComments(text) {
  return text.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function readSettingsJson(file) {
  try {
    return JSON.parse(stripJsonComments(fs.readFileSync(file, "utf8")));
  } catch {
    return null;
  }
}

function bobProjectFile(root) {
  return path.join(root, ".bob", "mcp.json");
}

function vscodeSettingsFile(root) {
  return path.join(root, ".vscode", "settings.json");
}

function bobGlobalCandidates() {
  const home = os.homedir();
  return [
    { file: path.join(home, ".bob", "settings", "mcp.json"), label: "~/.bob/settings/mcp.json" },
    { file: path.join(home, ".bob", "mcp.json"), label: "~/.bob/mcp.json" },
    { file: path.join(home, ".bob", "mcp_settings.json"), label: "~/.bob/mcp_settings.json" },
  ];
}

function hasServer(json, id = SERVER_ID) {
  if (!json || typeof json !== "object") return false;
  return Boolean(json.mcpServers?.[id] || json.servers?.[id]);
}

/**
 * stdio has no request headers, so the credential and the auth mode travel in the
 * child process env instead.
 */
function stdioEnv() {
  const s = settings();
  const env = { MCP_MODE: "stdio" };
  if (s.authMode && s.authMode !== "off") env.AUTH_MODE = s.authMode;
  if (s.apiKey) {
    env.API_KEY = s.apiKey;
    env.API_KEY_SCOPES = "read,write,pii";
    env.MCP_API_KEY = s.apiKey;
  }
  return env;
}

function nativeStdioEntry() {
  return {
    type: "stdio",
    command: "node",
    args: ["src/index.js"],
    cwd: serverDir(),
    env: stdioEnv(),
  };
}

function bobNativeEntry() {
  return {
    command: "node",
    args: ["src/index.js"],
    cwd: serverDir(),
    env: stdioEnv(),
    alwaysAllow: ALWAYS_ALLOW,
    disabled: false,
  };
}

function sseUrl(url) {
  return url.endsWith("/sse") ? url : `${url.replace(/\/$/, "")}/sse`;
}

function mcpUrl(url) {
  const trimmed = url.replace(/\/$/, "").replace(/\/sse$/, "").replace(/\/mcp$/, "");
  return `${trimmed}/mcp`;
}

function bobRemoteEntry(url) {
  const s = settings();
  // An API key supersedes the legacy demo token when both are configured.
  const token = s.apiKey || s.demoToken;
  const entry = {
    type: "streamable-http",
    url: mcpUrl(url),
    alwaysAllow: ALWAYS_ALLOW,
    disabled: false,
  };
  if (token) {
    entry.headers = { Authorization: `Bearer ${token}` };
  }
  return entry;
}

function upsertMcpServers(file, id, entry) {
  const json = readJson(file) || { mcpServers: {} };
  json.mcpServers = json.mcpServers || {};
  json.mcpServers[id] = entry;
  writeJson(file, json);
  return file;
}

function upsertClineSettings(file, id, entry) {
  const json = readSettingsJson(file) || {};
  json["cline.mcpServers"] = json["cline.mcpServers"] || {};
  json["cline.mcpServers"][id] = entry;
  writeJson(file, json);
  return file;
}

function discover() {
  const root = workspaceRoot();
  const vscodeFile = path.join(root, ".vscode", "mcp.json");
  const cursorFile = path.join(root, ".cursor", "mcp.json");
  const bobFile = bobProjectFile(root);
  const settingsFile = vscodeSettingsFile(root);
  const vscodeJson = readJson(vscodeFile);
  const cursorJson = readJson(cursorFile);
  const bobJson = readJson(bobFile);
  const settingsJson = readSettingsJson(settingsFile);
  const entry = serverEntry();
  const globals = bobGlobalCandidates().map((item) => ({
    ...item,
    exists: fs.existsSync(item.file),
    hasServer: hasServer(readJson(item.file)),
  }));
  return {
    workspace: root,
    serverEntry: entry,
    serverEntryExists: fs.existsSync(entry),
    vscode: {
      file: vscodeFile,
      exists: fs.existsSync(vscodeFile),
      json: vscodeJson,
      hasServer: hasServer(vscodeJson),
      hasPodman: hasServer(vscodeJson, PODMAN_ID),
      hasRemote: hasServer(vscodeJson, REMOTE_ID),
    },
    cursor: {
      file: cursorFile,
      exists: fs.existsSync(cursorFile),
      json: cursorJson,
      hasServer: hasServer(cursorJson),
      hasPodman: hasServer(cursorJson, PODMAN_ID),
      hasRemote: hasServer(cursorJson, REMOTE_ID),
    },
    bob: {
      file: bobFile,
      exists: fs.existsSync(bobFile),
      json: bobJson,
      hasServer: hasServer(bobJson),
      hasPodman: hasServer(bobJson, PODMAN_ID),
      hasRemote: hasServer(bobJson, REMOTE_ID),
    },
    cline: {
      file: settingsFile,
      exists: Boolean(settingsJson?.["cline.mcpServers"]),
      hasServer: Boolean(settingsJson?.["cline.mcpServers"]?.[SERVER_ID]),
      hasPodman: Boolean(settingsJson?.["cline.mcpServers"]?.[PODMAN_ID]),
      hasRemote: Boolean(settingsJson?.["cline.mcpServers"]?.[REMOTE_ID]),
    },
    bobGlobal: {
      exists: globals.some((item) => item.exists),
      hasServer: globals.some((item) => item.hasServer),
      files: globals,
    },
    settings: settings(),
  };
}

function writeLocal() {
  const root = workspaceRoot();
  const vscodeFile = path.join(root, ".vscode", "mcp.json");
  const cursorFile = path.join(root, ".cursor", "mcp.json");
  const bobFile = bobProjectFile(root);
  const settingsFile = vscodeSettingsFile(root);
  const native = nativeStdioEntry();
  const bobNative = bobNativeEntry();

  const vscodeJson = readJson(vscodeFile) || { servers: {} };
  vscodeJson.servers = vscodeJson.servers || {};
  vscodeJson.servers[SERVER_ID] = native;
  writeJson(vscodeFile, vscodeJson);

  upsertMcpServers(cursorFile, SERVER_ID, {
    command: native.command,
    args: native.args,
    cwd: native.cwd,
    env: native.env,
  });
  upsertMcpServers(bobFile, SERVER_ID, bobNative);
  upsertClineSettings(settingsFile, SERVER_ID, bobNative);

  return { vscodeFile, cursorFile, bobFile, settingsFile, cwd: native.cwd };
}

function writeRemote(url) {
  const root = workspaceRoot();
  const sse = sseUrl(url);
  const mcp = mcpUrl(url);
  const vscodeFile = path.join(root, ".vscode", "mcp.json");
  const cursorFile = path.join(root, ".cursor", "mcp.json");
  const bobFile = bobProjectFile(root);
  const settingsFile = vscodeSettingsFile(root);

  const vscodeJson = readJson(vscodeFile) || { servers: {} };
  vscodeJson.servers = vscodeJson.servers || {};
  vscodeJson.servers[REMOTE_ID] = { type: "sse", url: sse };
  writeJson(vscodeFile, vscodeJson);

  upsertMcpServers(cursorFile, REMOTE_ID, {
    command: "uvx",
    args: ["mcp-proxy", sse],
  });

  const bobEntry = bobRemoteEntry(url);
  upsertMcpServers(bobFile, REMOTE_ID, bobEntry);
  upsertClineSettings(settingsFile, REMOTE_ID, bobEntry);

  return { vscodeFile, cursorFile, bobFile, settingsFile, sse, mcp };
}

function writePodmanStdio() {
  const root = workspaceRoot();
  const vscodeFile = path.join(root, ".vscode", "mcp.json");
  const cursorFile = path.join(root, ".cursor", "mcp.json");
  const bobFile = bobProjectFile(root);
  const settingsFile = vscodeSettingsFile(root);
  const image = settings().podmanImage;
  const vscodeEntry = {
    type: "stdio",
    command: "podman",
    args: ["run", "-i", "--rm", "-e", "MCP_MODE=stdio", image],
  };
  const bobEntry = {
    command: "podman",
    args: ["run", "-i", "--rm", "-e", "MCP_MODE=stdio", image],
    alwaysAllow: ALWAYS_ALLOW,
    disabled: false,
  };

  const vscodeJson = readJson(vscodeFile) || { servers: {} };
  vscodeJson.servers = vscodeJson.servers || {};
  vscodeJson.servers[PODMAN_ID] = vscodeEntry;
  writeJson(vscodeFile, vscodeJson);
  upsertMcpServers(cursorFile, PODMAN_ID, { command: vscodeEntry.command, args: vscodeEntry.args });
  upsertMcpServers(bobFile, PODMAN_ID, bobEntry);
  upsertClineSettings(settingsFile, PODMAN_ID, bobEntry);
  return { vscodeFile, cursorFile, bobFile, settingsFile, image };
}

function writePodmanHttp() {
  const root = workspaceRoot();
  const base = podmanHttpUrl();
  const vscodeFile = path.join(root, ".vscode", "mcp.json");
  const cursorFile = path.join(root, ".cursor", "mcp.json");
  const bobFile = bobProjectFile(root);
  const settingsFile = vscodeSettingsFile(root);
  const sse = `${base}/sse`;
  const mcp = `${base}/mcp`;

  const vscodeJson = readJson(vscodeFile) || { servers: {} };
  vscodeJson.servers = vscodeJson.servers || {};
  vscodeJson.servers[PODMAN_ID] = { type: "sse", url: sse };
  writeJson(vscodeFile, vscodeJson);
  upsertMcpServers(cursorFile, PODMAN_ID, { command: "uvx", args: ["mcp-proxy", sse] });
  const bobEntry = bobRemoteEntry(base);
  upsertMcpServers(bobFile, PODMAN_ID, bobEntry);
  upsertClineSettings(settingsFile, PODMAN_ID, bobEntry);
  return { vscodeFile, cursorFile, bobFile, settingsFile, sse, mcp };
}

module.exports = {
  SERVER_ID,
  PODMAN_ID,
  REMOTE_ID,
  ALWAYS_ALLOW,
  workspaceRoot,
  serverDir,
  serverEntry,
  settings,
  httpBase,
  podmanHttpUrl,
  discover,
  writeLocal,
  writeRemote,
  writePodmanStdio,
  writePodmanHttp,
};
