const path = require("path");
const vscode = require("vscode");
const { discover, httpBase, settings } = require("./config");

const ICONS = path.join(__dirname, "..", "media", "icons");
const THEME_ICONS = new Set(["check", "error", "warning", "circle-slash", "circle-outline"]);

function iconPath(name) {
  if (!name) return new vscode.ThemeIcon("circle-outline");
  if (THEME_ICONS.has(name)) return new vscode.ThemeIcon(name);
  return {
    light: path.join(ICONS, "light", `${name}.svg`),
    dark: path.join(ICONS, "dark", `${name}.svg`),
  };
}

class ResourceNode {
  constructor(label, opts = {}) {
    this.label = label;
    this.collapsible = opts.children ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None;
    this.description = opts.description;
    this.tooltip = opts.tooltip;
    this.iconPath = iconPath(opts.icon);
    this.contextValue = opts.contextValue;
    this.command = opts.command;
    this.children = opts.children || [];
  }

  toItem() {
    const item = new vscode.TreeItem(this.label, this.collapsible);
    item.description = this.description;
    item.tooltip = this.tooltip;
    item.iconPath = this.iconPath;
    item.contextValue = this.contextValue;
    item.command = this.command;
    return item;
  }
}

class ResourceTreeProvider {
  constructor() {
    this._onDidChange = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChange.event;
  }

  refresh() {
    this._onDidChange.fire();
  }

  getTreeItem(element) {
    return element.toItem();
  }

  getChildren(element) {
    if (element) return element.children;
    const info = discover();
    const probe = httpBase();
    const s = settings();
    const cmd = (command, title) => ({ command, title, arguments: [] });

    const connected = (ok) => (ok ? "connected" : "missing");
    const any = (a, b, c) => a || b || c;

    return [
      new ResourceNode("Server", {
        icon: "server",
        children: [
          new ResourceNode("Server entry", {
            icon: info.serverEntryExists ? "check" : "error",
            description: info.serverEntryExists ? "server/src/index.js" : "missing",
          }),
          new ResourceNode("Dependencies", {
            icon: info.serverDependenciesInstalled ? "check" : "warning",
            description: info.serverDependenciesInstalled ? "installed" : "npm install needed",
            tooltip: info.serverDependenciesInstalled ? "server/node_modules present" : "Run 'cd server && npm install'",
          }),
        ],
      }),
      new ResourceNode("Transports", {
        icon: "transports",
        children: [
          new ResourceNode("Native stdio", {
            icon: any(info.vscode.hasServer, info.cursor.hasServer, info.bob.hasServer, info.windsurf.hasServer) ? "stdio" : "circle-slash",
            description: connected(any(info.vscode.hasServer, info.cursor.hasServer, info.bob.hasServer, info.windsurf.hasServer)),
            command: cmd("summitMcp.connectLocal", "Connect native stdio"),
          }),
          new ResourceNode("Local Podman", {
            icon: any(info.vscode.hasPodman, info.cursor.hasPodman, info.bob.hasPodman, info.windsurf.hasPodman) ? "container" : "circle-slash",
            description: connected(any(info.vscode.hasPodman, info.cursor.hasPodman, info.bob.hasPodman, info.windsurf.hasPodman)),
            command: cmd("summitMcp.podmanStart", "Start Podman"),
          }),
          new ResourceNode("Code Engine remote", {
            icon: any(info.vscode.hasRemote, info.cursor.hasRemote, info.bob.hasRemote, info.windsurf.hasRemote) ? "remote" : "circle-slash",
            description: s.remoteUrl ? s.remoteUrl.replace(/^https?:\/\//, "") : "not set",
            command: cmd("summitMcp.connectRemote", "Connect remote"),
          }),
        ],
      }),
      new ResourceNode("Pages", {
        icon: "pages",
        description: probe.replace(/^https?:\/\//, ""),
        children: [
          new ResourceNode("/health", { icon: "health", description: "Alive?", command: cmd("summitMcp.openHealth", "Open /health") }),
          new ResourceNode("/test", { icon: "test", description: "Works?", command: cmd("summitMcp.openTest", "Open /test") }),
          new ResourceNode("/admin", { icon: "admin", description: "Lock writes", command: cmd("summitMcp.openAdmin", "Open /admin") }),
          new ResourceNode("/tools", { icon: "tools", description: "Tool list", command: cmd("summitMcp.openTools", "Open /tools") }),
          new ResourceNode("/help", { icon: "help", description: "Docs", command: cmd("summitMcp.openHelp", "Open /help") }),
        ],
      }),
      new ResourceNode("Config", {
        icon: "config",
        children: [
          new ResourceNode(".vscode/mcp.json", {
            icon: "file",
            description: info.vscode.exists ? "present" : "missing",
            command: { command: "summitMcp.openConfig", title: "Open", arguments: ["vscode"] },
          }),
          new ResourceNode(".cursor/mcp.json", {
            icon: "file",
            description: info.cursor.exists ? "present" : "missing",
            command: { command: "summitMcp.openConfig", title: "Open", arguments: ["cursor"] },
          }),
          new ResourceNode(".bob/mcp.json", {
            icon: "file",
            description: info.bob.exists ? "present" : "missing",
            command: { command: "summitMcp.openConfig", title: "Open", arguments: ["bob"] },
          }),
          new ResourceNode(".windsurf/mcp.json", {
            icon: "file",
            description: info.windsurf.exists ? "present" : "missing",
            command: { command: "summitMcp.openConfig", title: "Open", arguments: ["windsurf"] },
          }),
        ],
      }),
      new ResourceNode("Control plane", {
        icon: "panel",
        children: [
          new ResourceNode("Setup & Diagnostics", { icon: "panel", command: cmd("summitMcp.openPanel", "Open panel") }),
          new ResourceNode("Run diagnostics", { icon: "diagnose", command: cmd("summitMcp.diagnose", "Diagnose") }),
          new ResourceNode("Send search to chat", { icon: "chat", command: cmd("summitMcp.chatSearch", "Chat") }),
        ],
      }),
      new ResourceNode("About & Links", {
        icon: "about",
        children: [
          new ResourceNode("Author Website", { icon: "pages", description: "markusvankempen.github.io", command: cmd("summitMcp.openAuthorSite", "Open Website") }),
          new ResourceNode("Linux Foundation Talk", { icon: "ticket", description: "MCP Dev Summit Toronto", command: cmd("summitMcp.openTalkPage", "Open Session") }),
        ],
      }),
    ];
  }
}

module.exports = { ResourceTreeProvider };
