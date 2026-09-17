const fs = require("fs");
const path = require("path");
const vscode = require("vscode");
const { discover, settings, httpBase } = require("./config");
const { PROMPTS } = require("./prompts");

function clientsLabel(vscodeYes, cursorYes, bobYes) {
  const n = [vscodeYes, cursorYes, bobYes].filter(Boolean).length;
  if (n === 3) return { label: "3 / 3", ok: true };
  if (n === 0) return { label: "off", ok: false };
  return { label: `${n} / 3`, ok: true };
}

function snapshot(extra = {}) {
  const info = discover();
  return {
    probe: httpBase(),
    live: Boolean(httpBase()),
    settings: settings(),
    native: clientsLabel(info.vscode.hasServer, info.cursor.hasServer, info.bob.hasServer),
    podman: clientsLabel(info.vscode.hasPodman, info.cursor.hasPodman, info.bob.hasPodman),
    remote: clientsLabel(info.vscode.hasRemote, info.cursor.hasRemote, info.bob.hasRemote),
    prompts: PROMPTS,
    workspace: info.workspace,
    ...extra,
  };
}

function loadHtml(context) {
  const file = path.join(context.extensionPath, "media", "diagnostics.html");
  return fs.readFileSync(file, "utf8");
}

function bindWebview(webview, handlers) {
  webview.onDidReceiveMessage(async (msg) => {
    if (!msg || !msg.command) return;
    if (msg.command === "ready") {
      webview.postMessage({ type: "state", state: snapshot() });
      return;
    }
    if (typeof handlers[msg.command] === "function") {
      await handlers[msg.command](msg);
    }
  });
}

function postState(webview, extra) {
  if (!webview) return;
  webview.postMessage({ type: "state", state: snapshot(extra) });
}

function postLog(webview, text) {
  if (webview) webview.postMessage({ type: "log", text });
}

function postToast(webview, text, kind) {
  if (webview) webview.postMessage({ type: "toast", text, kind });
}

function postDiagnostics(webview, result) {
  if (!webview) return;
  webview.postMessage({
    type: "diagnostics",
    steps: result.steps,
    ok: result.ok,
  });
  postState(webview, { steps: result.steps, diag: { ok: result.ok }, tab: "diag" });
}

module.exports = {
  snapshot,
  loadHtml,
  bindWebview,
  postState,
  postLog,
  postToast,
  postDiagnostics,
};
