const vscode = require("vscode");
const { loadHtml, bindWebview, postDiagnostics } = require("./ui");

function getPanel(context, onMessage) {
  const panel = vscode.window.createWebviewPanel(
    "summitMcp.panel",
    "MCP Platform diagnostics",
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true },
  );
  panel.webview.html = loadHtml(context);
  bindWebview(panel.webview, onMessage);
  return panel;
}

function renderPanel(_webview, result) {
  return { unused: result };
}

module.exports = { getPanel, renderPanel, postDiagnostics };
