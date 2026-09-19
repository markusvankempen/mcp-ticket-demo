const vscode = require("vscode");
const {
  discover, writeLocal, writeRemote, writePodmanStdio, writePodmanHttp,
  settings, httpBase, setContext,
} = require("./config");
const { runDiagnostics, runMcpCrud } = require("./diagnose");
const { getPanel } = require("./panel");
const { SetupViewProvider } = require("./sidebar");
const { ResourceTreeProvider } = require("./tree");
const { fillChat } = require("./chat");
const { postDiagnostics, postLog, postToast, postState } = require("./ui");
const podman = require("./podman");
const npmServer = require("./npm-server");

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
  const ready = info.vscode.hasServer || info.cursor.hasServer || info.bob.hasServer || info.windsurf.hasServer
    || info.vscode.hasPodman || info.bob.hasRemote;
  statusBar.text = ready ? "$(plug) LF MCP Demo" : "$(plug) LF MCP Demo $(warning)";
  statusBar.tooltip = ready
    ? `LF MCP Demo — probe ${httpBase()}. Click for navigation.`
    : "LF MCP Demo — native stdio not connected. Click to set up.";
  statusBar.show();
}

function webviews() {
  return [setupView?.view?.webview, panel?.webview].filter(Boolean);
}

function logAll(text) {
  webviews().forEach((w) => postLog(w, text));
}

async function activate(context) {
  // Make context available to config.js for bundled-server fallback
  setContext(context);

  // Fire-and-forget update check — never blocks activation
  npmServer.checkForUpdate(context, logAll);

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
    help: () => vscode.commands.executeCommand("summitMcp.openHelp"),
    openPanel: () => vscode.commands.executeCommand("summitMcp.openPanel"),
    focusTree: () => vscode.commands.executeCommand("summitMcp.resources.focus"),
    chat: (msg) => vscode.commands.executeCommand("summitMcp.fillChat", msg.text),
    copy: async (msg) => {
      await vscode.env.clipboard.writeText(msg.text);
      vscode.window.showInformationMessage("Copied. Paste it in chat if send-to-chat is blocked.");
    },
    saveSettings: (msg) => vscode.commands.executeCommand("summitMcp.saveSettings", msg.values),
    registerIde: () => vscode.commands.executeCommand("summitMcp.registerIde"),
    runMcpCrud: () => vscode.commands.executeCommand("summitMcp.runMcpCrud"),
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
      `Native stdio: .vscode ${info.vscode.hasServer ? "yes" : "no"} · .cursor ${info.cursor.hasServer ? "yes" : "no"} · .bob ${info.bob.hasServer ? "yes" : "no"} · .windsurf ${info.windsurf.hasServer ? "yes" : "no"}`,
      `Podman MCP: .vscode ${info.vscode.hasPodman ? "yes" : "no"} · .cursor ${info.cursor.hasPodman ? "yes" : "no"} · .bob ${info.bob.hasPodman ? "yes" : "no"} · .windsurf ${info.windsurf.hasPodman ? "yes" : "no"}`,
      `Code Engine: .vscode ${info.vscode.hasRemote ? "yes" : "no"} · .cursor ${info.cursor.hasRemote ? "yes" : "no"} · .bob ${info.bob.hasRemote ? "yes" : "no"} · .windsurf ${info.windsurf.hasRemote ? "yes" : "no"}`,
      `Probe: ${httpBase()}`,
    ];
    const out = vscode.window.createOutputChannel("LF MCP Demo");
    out.appendLine(lines.join("\n"));
    out.show(true);
    logAll("Discovered mcp.json — see Output channel");
    refreshUi();
  });

  register("summitMcp.connectLocal", async () => {
    const info = discover();
    if (!info.serverEntryExists) {
      const action = await vscode.window.showErrorMessage(
        "server/src/index.js not found. Open the mcp-ticket-demo repo root, or install the bundled server.",
        "Install bundled server",
      );
      if (action) await vscode.commands.executeCommand("summitMcp.installServer");
      return;
    }
    if (!info.serverDependenciesInstalled) {
      vscode.window.showWarningMessage("server/node_modules is missing. Run 'cd server && npm install' before starting or testing native stdio/HTTP.");
    }
    writeLocal();
    vscode.window.showInformationMessage("Wrote native stdio (node, no Docker) into client MCP config files (.vscode, .cursor, .bob, .windsurf). Reload the window.");
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
    const runtime = await podman.detectRuntime();
    if (!runtime) {
      vscode.window.showErrorMessage("No container runtime found. Install Podman (podman.io) or Docker (docker.com).");
      return;
    }
    const written = writePodmanStdio(runtime);
    vscode.window.showInformationMessage(`Wrote ${runtime} stdio MCP (${runtime} run -i ${written.image}). Reload the window.`);
    logAll(`${runtime} stdio → ${written.image}`);
    refreshUi();
  });

  register("summitMcp.connectPodmanHttp", async () => {
    const written = writePodmanHttp();
    const runtime = await podman.detectRuntime() || "podman";
    vscode.window.showInformationMessage(`Wrote ${runtime} HTTP MCP at ${written.sse}. Start the container first.`);
    logAll(`${runtime} HTTP ${written.sse}`);
    refreshUi();
  });

  register("summitMcp.podmanStart", async () => {
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "MCP Demo · Container",
      cancellable: false,
    }, async (progress) => {
      progress.report({ message: "Detecting container runtime (Podman / Docker)…" });
      const detected = await podman.detect();
      if (!detected.ok) {
        vscode.window.showErrorMessage(detected.next || detected.detail);
        logAll(detected.next || detected.detail);
        return;
      }
      const rt = detected.runtime;
      webviews().forEach((w) => postToast(w, `Using ${rt}`, "ok"));
      progress.report({ message: `Building ${detected.image} with ${rt}…` });
      const built = await podman.build();
      if (!built.ok) {
        vscode.window.showErrorMessage(`${rt} build failed: ${built.stderr || built.error}`);
        logAll(built.stderr || built.error);
        return;
      }
      progress.report({ message: "Starting container…" });
      const ran = await podman.runHttp();
      if (!ran.ok) {
        vscode.window.showErrorMessage(`${rt} run failed: ${ran.stderr || ran.error}`);
        logAll(ran.stderr || ran.error);
        return;
      }
      await vscode.workspace.getConfiguration("summitMcp").update("probeTarget", "podman", vscode.ConfigurationTarget.Workspace);
      vscode.window.showInformationMessage(`${rt} container is up. Open /health or Connect Container HTTP MCP.`);
      logAll(`${rt} container started`);
    });
    refreshUi();
  });

  register("summitMcp.podmanStop", async () => {
    const stopped = await podman.stopHttp();
    if (!stopped.ok) {
      vscode.window.showWarningMessage(stopped.stderr || stopped.error || "Nothing to stop.");
      return;
    }
    const rt = await podman.detectRuntime() || "container";
    logAll(`Stopped ${rt} container`);
    refreshUi();
  });

  register("summitMcp.startLocalHttp", async () => {
    const info = discover();
    if (!info.serverDependenciesInstalled) {
      vscode.window.showWarningMessage("server/node_modules is missing. Installing server dependencies first...");
    }
    const term = vscode.window.createTerminal({ name: "mcp-ticket-demo", cwd: info.workspace });
    term.show();
    const cmd = info.serverDependenciesInstalled
      ? `cd server && MCP_MODE=http PORT=${settings().podmanPort} node src/index.js`
      : `cd server && npm install && MCP_MODE=http PORT=${settings().podmanPort} node src/index.js`;
    term.sendText(cmd);
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
    const map = { vscode: info.vscode.file, cursor: info.cursor.file, bob: info.bob.file, windsurf: info.windsurf.file };
    const file = map[which];
    if (!file) return;
    const doc = await vscode.workspace.openTextDocument(file);
    await vscode.window.showTextDocument(doc, { preview: true });
  });

  register("summitMcp.installServer", async () => {
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "LF MCP Demo",
      cancellable: false,
    }, async (progress) => {
      progress.report({ message: `Installing ${npmServer.NPM_PACKAGE} from npm…` });
      const result = await npmServer.ensureInstalled(context, (msg) => logAll(msg));
      if (!result.ok) {
        vscode.window.showErrorMessage(`Server install failed: ${result.error}`);
        logAll(`Server install failed: ${result.error}`);
        return;
      }
      if (result.alreadyInstalled) {
        vscode.window.showInformationMessage(`Server already installed (v${result.version}). Use Update to get a newer version.`);
      } else {
        vscode.window.showInformationMessage(`mcp-ticket-demo v${result.version} installed. Run Connect native stdio.`);
        logAll(`Bundled server installed v${result.version}`);
      }
      refreshUi();
    });
  });

  register("summitMcp.updateServer", async () => {
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "LF MCP Demo",
      cancellable: false,
    }, async (progress) => {
      const current = npmServer.installedVersion(context);
      progress.report({ message: "Checking npm for latest version…" });
      const latest = await npmServer.latestNpmVersion();
      if (!latest) {
        vscode.window.showWarningMessage("Could not reach npm registry. Check your network.");
        return;
      }
      if (latest === current) {
        vscode.window.showInformationMessage(`mcp-ticket-demo is already up to date (v${current}).`);
        return;
      }
      progress.report({ message: `Updating ${current} → ${latest}…` });
      const root = npmServer.bundledServerRoot(context);
      const result = await npmServer.runNpmInstall(root, (msg) => logAll(msg));
      if (!result.ok) {
        vscode.window.showErrorMessage(`Update failed: ${result.error}`);
        return;
      }
      const newVersion = npmServer.installedVersion(context);
      vscode.window.showInformationMessage(`mcp-ticket-demo updated to v${newVersion}. Reload the window.`);
      logAll(`Server updated to v${newVersion}`);
      refreshUi();
    });
  });

  register("summitMcp.registerIde", async () => {
    const info = discover();
    if (!info.serverEntryExists) {
      const action = await vscode.window.showErrorMessage(
        "server/src/index.js not found. Install the bundled server first.",
        "Install bundled server",
      );
      if (action) await vscode.commands.executeCommand("summitMcp.installServer");
      webviews().forEach((w) => w.postMessage({
        type: "registerIdeResult",
        ok: false,
        detail: "Server not found — install the bundled server first.",
      }));
      return;
    }
    if (!info.serverDependenciesInstalled) {
      vscode.window.showWarningMessage("server/node_modules missing — run 'cd server && npm install' before reloading.");
    }
    const written = writeLocal();
    const lines = [
      "✓ Registered mcp-ticket-demo as native stdio in:",
      `  VS Code : ${written.vscodeFile}`,
      `  Cursor  : ${written.cursorFile}`,
      `  Bob     : ${written.bobFile}`,
      `  Windsurf: ${written.windsurfFile}`,
      "",
      "Reload the window (Cmd/Ctrl+Shift+P → Reload Window) to activate.",
    ].join("\n");
    vscode.window.showInformationMessage("Registered with VS Code, Cursor, Bob and Windsurf. Reload the window.");
    logAll("Registered with all IDEs");
    webviews().forEach((w) => w.postMessage({ type: "registerIdeResult", ok: true, detail: lines }));
    refreshUi();
  });

  register("summitMcp.runMcpCrud", async () => {
    logAll("Running MCP CRUD test…");
    const result = await runMcpCrud();
    webviews().forEach((w) => w.postMessage({ type: "mcpTestResult", steps: result.steps, ok: result.ok }));
    if (!result.ok) {
      vscode.window.showWarningMessage("MCP CRUD test had failures. Check the MCP Test tab.");
    } else {
      vscode.window.showInformationMessage("MCP CRUD test passed — create, get, comment, close, search all OK.");
    }
    logAll("MCP CRUD test " + (result.ok ? "passed" : "failed"));
  });

  register("summitMcp.openAuthorSite", () => vscode.env.openExternal(vscode.Uri.parse("https://markusvankempen.github.io/")));
  register("summitMcp.openTalkPage", () => vscode.env.openExternal(vscode.Uri.parse("https://events.linuxfoundation.org/mcp-dev-summit-toronto/program/schedule/?id=1282401")));

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
    const picked = await vscode.window.showQuickPick(items, { placeHolder: "LF MCP Demo — choose an action" });
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
  register("summitMcp.openHelp", () => vscode.env.openExternal(vscode.Uri.parse(`${httpBase()}/help`)));

  try {
    await vscode.commands.executeCommand("workbench.view.extension.summitMcp");
  } catch {
    // Some hosts don't expose the view container command.
  }
}

function deactivate() {}

module.exports = { activate, deactivate };
