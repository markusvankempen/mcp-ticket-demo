const vscode = require("vscode");
const {
  discover, writeLocal, writeRemote, writePodmanStdio, writePodmanHttp,
  settings, httpBase,
} = require("./config");
const { runDiagnostics } = require("./diagnose");
const { getPanel } = require("./panel");
const { SetupViewProvider } = require("./sidebar");
const { ResourceTreeProvider } = require("./tree");
const { fillChat } = require("./chat");
const { postDiagnostics, postLog, postToast, postState } = require("./ui");
const podman = require("./podman");

let panel;
let setupView;
let treeProvider;
let statusBar;

function refreshUi(extra) {
  setupView?.refresh(extra);
  if (panel) postState(panel.webview, extra);
  treeProvider?.refresh();
  refreshStatusBar();
}

function refreshStatusBar() {
  if (!statusBar) return;
  const info = discover();
  const ready = info.vscode.hasServer || info.cursor.hasServer || info.bob.hasServer
    || info.vscode.hasPodman || info.bob.hasRemote;
  statusBar.text = ready ? "$(plug) MCP Platform" : "$(plug) MCP Platform $(warning)";
  statusBar.tooltip = ready
    ? `MCP Platform — probe ${httpBase()}. Click for navigation.`
    : "MCP Platform — native stdio not connected. Click to set up.";
  statusBar.show();
}

function webviews() {
  return [setupView?.view?.webview, panel?.webview].filter(Boolean);
}

function logAll(text) {
  webviews().forEach((w) => postLog(w, text));
}

async function activate(context) {
  const handlers = {
    discover: () => vscode.commands.executeCommand("summitMcp.discover"),
    local: () => vscode.commands.executeCommand("summitMcp.connectLocal"),
    remote: () => vscode.commands.executeCommand("summitMcp.connectRemote"),
    http: () => vscode.commands.executeCommand("summitMcp.startLocalHttp"),
    podmanStart: () => vscode.commands.executeCommand("summitMcp.podmanStart"),
    podmanStdio: () => vscode.commands.executeCommand("summitMcp.connectPodmanStdio"),
    podmanHttp: () => vscode.commands.executeCommand("summitMcp.connectPodmanHttp"),
    podmanStop: () => vscode.commands.executeCommand("summitMcp.podmanStop"),
    diagnose: () => vscode.commands.executeCommand("summitMcp.diagnose"),
    health: () => vscode.commands.executeCommand("summitMcp.openHealth"),
    test: () => vscode.commands.executeCommand("summitMcp.openTest"),
    admin: () => vscode.commands.executeCommand("summitMcp.openAdmin"),
    tools: () => vscode.commands.executeCommand("summitMcp.openTools"),
    openPanel: () => vscode.commands.executeCommand("summitMcp.openPanel"),
    focusTree: () => vscode.commands.executeCommand("summitMcp.resources.focus"),
    chat: (msg) => vscode.commands.executeCommand("summitMcp.fillChat", msg.text),
    copy: async (msg) => {
      await vscode.env.clipboard.writeText(msg.text);
      vscode.window.showInformationMessage("Copied. Paste it in chat if send-to-chat is blocked.");
    },
    saveSettings: (msg) => vscode.commands.executeCommand("summitMcp.saveSettings", msg.values),
  };

  setupView = new SetupViewProvider(context, handlers);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("summitMcp.setup", setupView, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );

  treeProvider = new ResourceTreeProvider();
  const treeView = vscode.window.createTreeView("summitMcp.resources", {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 90);
  statusBar.command = "summitMcp.showMenu";
  context.subscriptions.push(statusBar);
  refreshStatusBar();

  const register = (id, fn) => context.subscriptions.push(vscode.commands.registerCommand(id, fn));

  register("summitMcp.discover", async () => {
    const info = discover();
    const lines = [
      `Workspace: ${info.workspace || "(none)"}`,
      `Server: ${info.serverEntryExists ? "found" : "MISSING"} — ${info.serverEntry}`,
      `Native stdio: VS Code ${info.vscode.hasServer ? "yes" : "no"} · Cursor ${info.cursor.hasServer ? "yes" : "no"} · Bob ${info.bob.hasServer ? "yes" : "no"}`,
      `Podman MCP: VS Code ${info.vscode.hasPodman ? "yes" : "no"} · Cursor ${info.cursor.hasPodman ? "yes" : "no"} · Bob ${info.bob.hasPodman ? "yes" : "no"}`,
      `Code Engine: VS Code ${info.vscode.hasRemote ? "yes" : "no"} · Cursor ${info.cursor.hasRemote ? "yes" : "no"} · Bob ${info.bob.hasRemote ? "yes" : "no"}`,
      `Probe: ${httpBase()}`,
    ];
    const out = vscode.window.createOutputChannel("MCP Platform Demo");
    out.appendLine(lines.join("\n"));
    out.show(true);
    logAll("Discovered mcp.json — see Output channel");
    refreshUi();
  });

  register("summitMcp.connectLocal", async () => {
    const info = discover();
    if (!info.serverEntryExists) {
      vscode.window.showErrorMessage("mcp-ticket-demo/server/src/index.js is missing. Open the repo root.");
      return;
    }
    writeLocal();
    vscode.window.showInformationMessage("Wrote native stdio (node, no Docker) into VS Code, Cursor, and Bob. Reload the window.");
    logAll("Native stdio written");
    refreshUi();
  });

  register("summitMcp.connectRemote", async () => {
    const url = await vscode.window.showInputBox({
      prompt: "Public Code Engine URL (no trailing slash). A new project means a new hostname.",
      value: settings().remoteUrl,
      placeHolder: "https://mcp-ticket-demo.xxxx.ca-tor.codeengine.appdomain.cloud",
    });
    if (!url) return;
    await vscode.workspace.getConfiguration("summitMcp").update("remoteUrl", url.replace(/\/$/, ""), vscode.ConfigurationTarget.Workspace);
    const written = writeRemote(url);
    vscode.window.showInformationMessage(`Remote Code Engine is a second server at ${written.sse}. Reload the window.`);
    logAll(`Remote SSE ${written.sse}`);
    refreshUi();
  });

  register("summitMcp.connectPodmanStdio", async () => {
    const written = writePodmanStdio();
    vscode.window.showInformationMessage(`Wrote Podman stdio MCP (podman run -i ${written.image}). Reload the window.`);
    logAll(`Podman stdio → ${written.image}`);
    refreshUi();
  });

  register("summitMcp.connectPodmanHttp", async () => {
    const written = writePodmanHttp();
    vscode.window.showInformationMessage(`Wrote Podman HTTP MCP at ${written.sse}. Start the container first.`);
    logAll(`Podman HTTP ${written.sse}`);
    refreshUi();
  });

  register("summitMcp.podmanStart", async () => {
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Summit ticket MCP · Podman",
      cancellable: false,
    }, async (progress) => {
      progress.report({ message: "Detecting Podman…" });
      const detected = await podman.detect();
      if (!detected.ok) {
        vscode.window.showErrorMessage(detected.next || detected.detail);
        logAll(detected.next || detected.detail);
        return;
      }
      progress.report({ message: `Building ${detected.image}…` });
      const built = await podman.build();
      if (!built.ok) {
        vscode.window.showErrorMessage(`Podman build failed: ${built.stderr || built.error}`);
        logAll(built.stderr || built.error);
        return;
      }
      progress.report({ message: "Starting container…" });
      const ran = await podman.runHttp();
      if (!ran.ok) {
        vscode.window.showErrorMessage(`Podman run failed: ${ran.stderr || ran.error}`);
        logAll(ran.stderr || ran.error);
        return;
      }
      await vscode.workspace.getConfiguration("summitMcp").update("probeTarget", "podman", vscode.ConfigurationTarget.Workspace);
      vscode.window.showInformationMessage("Podman is up. Open /health or Connect Podman HTTP MCP.");
      logAll("Podman container started");
    });
    refreshUi();
  });

  register("summitMcp.podmanStop", async () => {
    const stopped = await podman.stopHttp();
    if (!stopped.ok) {
      vscode.window.showWarningMessage(stopped.stderr || stopped.error || "Nothing to stop.");
      return;
    }
    logAll("Stopped Podman container");
    refreshUi();
  });

  register("summitMcp.startLocalHttp", async () => {
    const info = discover();
    const term = vscode.window.createTerminal({ name: "mcp-ticket-demo", cwd: info.workspace });
    term.show();
    term.sendText(`cd mcp-ticket-demo/server && MCP_MODE=http PORT=${settings().podmanPort} node src/index.js`);
    await vscode.workspace.getConfiguration("summitMcp").update("probeTarget", "native-http", vscode.ConfigurationTarget.Workspace);
    logAll("Started native HTTP in a terminal");
    refreshUi();
  });

  register("summitMcp.diagnose", async () => {
    if (!panel) {
      panel = getPanel(context, handlers);
      panel.onDidDispose(() => { panel = null; });
    } else {
      panel.reveal(vscode.ViewColumn.One);
    }
    logAll("Running diagnostics…");
    const result = await runDiagnostics();
    webviews().forEach((w) => postDiagnostics(w, result));
    treeProvider.refresh();
    refreshStatusBar();
    if (!result.ok) {
      vscode.window.showWarningMessage("Diagnostics found a failure. The panel says what to try.");
    }
  });

  register("summitMcp.openPanel", async () => {
    if (!panel) {
      panel = getPanel(context, handlers);
      panel.onDidDispose(() => { panel = null; });
    } else {
      panel.reveal(vscode.ViewColumn.One);
    }
  });

  register("summitMcp.saveSettings", async (values) => {
    const cfg = vscode.workspace.getConfiguration("summitMcp");
    const keys = [
      "probeTarget", "remoteUrl", "localHttpUrl", "podmanImage",
      "podmanContainer", "podmanPort", "adminUser", "adminPassword", "demoToken",
    ];
    for (const key of keys) {
      if (values && values[key] !== undefined) {
        await cfg.update(key, values[key], vscode.ConfigurationTarget.Workspace);
      }
    }
    webviews().forEach((w) => postToast(w, "Saved workspace settings", "ok"));
    refreshUi();
  });

  register("summitMcp.fillChat", async (text) => {
    const prompt = text || await vscode.window.showInputBox({
      prompt: "Prompt to file into the LLM chat",
      value: "Search open tickets, then tell me who owns each one.",
    });
    if (!prompt) return;
    await fillChat(prompt);
    logAll("Filed prompt into chat");
  });
  register("summitMcp.chatSearch", () => vscode.commands.executeCommand(
    "summitMcp.fillChat",
    "Search open tickets, then tell me who owns each one.",
  ));

  register("summitMcp.openConfig", async (which) => {
    const info = discover();
    const map = { vscode: info.vscode.file, cursor: info.cursor.file, bob: info.bob.file };
    const file = map[which];
    if (!file) return;
    const doc = await vscode.workspace.openTextDocument(file);
    await vscode.window.showTextDocument(doc, { preview: true });
  });

  register("summitMcp.refreshTree", () => treeProvider.refresh());

  register("summitMcp.showMenu", async () => {
    const info = discover();
    const items = [
      { label: "$(graph) Open diagnostics panel", action: "panel" },
      { label: "$(checklist) Run diagnostics", description: httpBase(), action: "diagnose" },
      { label: "$(plug) Connect native stdio", description: info.vscode.hasServer ? "connected" : "missing", action: "local" },
      { label: "$(package) Start local Podman", action: "podman" },
      { label: "$(cloud) Connect Code Engine", action: "remote" },
      { label: "$(list-tree) Reveal resource tree", action: "tree" },
      { label: "$(comment-discussion) Send search to chat", action: "chat" },
      { label: "$(link-external) Open /health", action: "health" },
    ];
    const picked = await vscode.window.showQuickPick(items, { placeHolder: "MCP Platform — choose an action" });
    if (!picked) return;
    const map = {
      panel: "summitMcp.openPanel",
      diagnose: "summitMcp.diagnose",
      local: "summitMcp.connectLocal",
      podman: "summitMcp.podmanStart",
      remote: "summitMcp.connectRemote",
      tree: "summitMcp.resources.focus",
      chat: "summitMcp.chatSearch",
      health: "summitMcp.openHealth",
    };
    if (map[picked.action]) await vscode.commands.executeCommand(map[picked.action]);
  });

  register("summitMcp.openHealth", () => vscode.env.openExternal(vscode.Uri.parse(`${httpBase()}/health`)));
  register("summitMcp.openTest", () => vscode.env.openExternal(vscode.Uri.parse(`${httpBase()}/test`)));
  register("summitMcp.openAdmin", () => vscode.env.openExternal(vscode.Uri.parse(`${httpBase()}/admin`)));
  register("summitMcp.openTools", () => vscode.env.openExternal(vscode.Uri.parse(`${httpBase()}/tools`)));

  try {
    await vscode.commands.executeCommand("workbench.view.extension.summitMcp");
  } catch {
    // Some hosts don't expose the view container command.
  }
}

function deactivate() {}

module.exports = { activate, deactivate };
