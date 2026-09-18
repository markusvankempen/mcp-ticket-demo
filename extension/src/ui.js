const fs = require("fs");
const path = require("path");
const vscode = require("vscode");
const { discover, settings, httpBase } = require("./config");
const { PROMPTS } = require("./prompts");
const podman = require("./podman");

function clientsLabel(vscodeYes, cursorYes, bobYes, windsurfYes) {
  const n = [vscodeYes, cursorYes, bobYes, windsurfYes].filter(Boolean).length;
  if (n === 4) return { label: "4 / 4", ok: true };
  if (n === 0) return { label: "off", ok: false };
  return { label: `${n} / 4`, ok: true };
}

function snapshot(extra = {}) {
  const info = discover();
  return {
    probe: httpBase(),
    live: Boolean(httpBase()),
    settings: settings(),
    native: clientsLabel(info.vscode.hasServer, info.cursor.hasServer, info.bob.hasServer, info.windsurf.hasServer),
    podman: clientsLabel(info.vscode.hasPodman, info.cursor.hasPodman, info.bob.hasPodman, info.windsurf.hasPodman),
    remote: clientsLabel(info.vscode.hasRemote, info.cursor.hasRemote, info.bob.hasRemote, info.windsurf.hasRemote),
    prompts: PROMPTS,
    workspace: info.workspace,
    windsurf: { hasServer: info.windsurf.hasServer, hasPodman: info.windsurf.hasPodman, hasRemote: info.windsurf.hasRemote },
    ...extra,
  };
}

/** Async variant — resolves the container runtime and merges it into snapshot. */
async function snapshotWithRuntime(extra = {}) {
  const runtime = await podman.detectRuntime();
  return snapshot({ containerRuntime: runtime || null, ...extra });
}

function loadHtml(context) {
  const file = path.join(context.extensionPath, "media", "diagnostics.html");
  return fs.readFileSync(file, "utf8");
}

function bindWebview(webview, handlers) {
  webview.onDidReceiveMessage(async (msg) => {
    if (!msg || !msg.command) return;
    if (msg.command === "ready") {
      // Fire off async runtime detection; send a second state update once resolved
      snapshotWithRuntime().then((state) => {
        webview.postMessage({ type: "state", state });
      });
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
  snapshotWithRuntime,
  loadHtml,
  bindWebview,
  postState,
  postLog,
  postToast,
  postDiagnostics,
};
