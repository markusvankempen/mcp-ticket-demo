const { loadHtml, bindWebview, postState, postDiagnostics } = require("./ui");

class SetupViewProvider {
  constructor(context, onMessage) {
    this.context = context;
    this.onMessage = onMessage;
    this.view = undefined;
  }

  resolveWebviewView(webviewView) {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = loadHtml(this.context);
    bindWebview(webviewView.webview, this.onMessage);
  }

  refresh(extra) {
    if (this.view) postState(this.view.webview, extra);
  }

  showDiagnostics(result) {
    if (this.view) postDiagnostics(this.view.webview, result);
  }
}

module.exports = { SetupViewProvider };
