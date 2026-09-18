const vscode = require("vscode");
const { discover, httpBase, settings } = require("./config");

class ResourceNode {
  constructor(label, opts = {}) {
    this.label = label;
    this.collapsible = opts.children ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None;
    this.description = opts.description;
    this.tooltip = opts.tooltip;
    this.iconPath = new vscode.ThemeIcon(opts.icon || "circle-outline");
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
        icon: "server-process",
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
        icon: "plug",
        children: [
          new ResourceNode("Native stdio", {
            icon: any(info.vscode.hasServer, info.cursor.hasServer, info.bob.hasServer, info.windsurf.hasServer) ? "check" : "circle-slash",
            description: connected(any(info.vscode.hasServer, info.cursor.hasServer, info.bob.hasServer, info.windsurf.hasServer)),
            command: cmd("summitMcp.connectLocal", "Connect native stdio"),
          }),
          new ResourceNode("Local Podman", {
            icon: any(info.vscode.hasPodman, info.cursor.hasPodman, info.bob.hasPodman, info.windsurf.hasPodman) ? "package" : "circle-slash",
            description: connected(any(info.vscode.hasPodman, info.cursor.hasPodman, info.bob.hasPodman, info.windsurf.hasPodman)),
            command: cmd("summitMcp.podmanStart", "Start Podman"),
          }),
          new ResourceNode("Code Engine remote", {
            icon: any(info.vscode.hasRemote, info.cursor.hasRemote, info.bob.hasRemote, info.windsurf.hasRemote) ? "cloud" : "circle-slash",
            description: s.remoteUrl ? s.remoteUrl.replace(/^https?:\/\//, "") : "not set",
            command: cmd("summitMcp.connectRemote", "Connect remote"),
          }),
        ],
      }),
      new ResourceNode("Pages", {
        icon: "globe",
        description: probe.replace(/^https?:\/\//, ""),
        children: [
          new ResourceNode("/health", { icon: "pulse", description: "Alive?", command: cmd("summitMcp.openHealth", "Open /health") }),
          new ResourceNode("/test", { icon: "beaker", description: "Works?", command: cmd("summitMcp.openTest", "Open /test") }),
          new ResourceNode("/admin", { icon: "lock", description: "Lock writes", command: cmd("summitMcp.openAdmin", "Open /admin") }),
          new ResourceNode("/tools", { icon: "tools", description: "Tool list", command: cmd("summitMcp.openTools", "Open /tools") }),
          new ResourceNode("/help", { icon: "book", description: "Docs", command: cmd("summitMcp.openHelp", "Open /help") }),
        ],
      }),
      new ResourceNode("Config", {
        icon: "json",
        children: [
          new ResourceNode(".vscode/mcp.json", {
            icon: "file-code",
            description: info.vscode.exists ? "present" : "missing",
            command: { command: "summitMcp.openConfig", title: "Open", arguments: ["vscode"] },
          }),
          new ResourceNode(".cursor/mcp.json", {
            icon: "file-code",
            description: info.cursor.exists ? "present" : "missing",
            command: { command: "summitMcp.openConfig", title: "Open", arguments: ["cursor"] },
          }),
          new ResourceNode(".bob/mcp.json", {
            icon: "file-code",
            description: info.bob.exists ? "present" : "missing",
            command: { command: "summitMcp.openConfig", title: "Open", arguments: ["bob"] },
          }),
          new ResourceNode(".windsurf/mcp.json", {
            icon: "file-code",
            description: info.windsurf.exists ? "present" : "missing",
            command: { command: "summitMcp.openConfig", title: "Open", arguments: ["windsurf"] },
          }),
        ],
      }),
      new ResourceNode("Control plane", {
        icon: "layout-sidebar-left",
        children: [
          new ResourceNode("Setup & Diagnostics", { icon: "graph", command: cmd("summitMcp.openPanel", "Open panel") }),
          new ResourceNode("Run diagnostics", { icon: "checklist", command: cmd("summitMcp.diagnose", "Diagnose") }),
          new ResourceNode("Send search to chat", { icon: "comment-discussion", command: cmd("summitMcp.chatSearch", "Chat") }),
        ],
      }),
      new ResourceNode("About & Links", {
        icon: "info",
        children: [
          new ResourceNode("Author Website", { icon: "globe", description: "markusvankempen.github.io", command: cmd("summitMcp.openAuthorSite", "Open Website") }),
          new ResourceNode("Linux Foundation Talk", { icon: "link-external", description: "MCP Dev Summit Toronto", command: cmd("summitMcp.openTalkPage", "Open Session") }),
        ],
      }),
    ];
  }
}

module.exports = { ResourceTreeProvider };
