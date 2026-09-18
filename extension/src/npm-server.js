const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");

const NPM_PACKAGE = "mcp-ticket-demo";

/**
 * Where the extension installs the server when no workspace clone is present.
 * Uses VS Code's globalStorageUri so it survives extension updates.
 */
function bundledServerRoot(context) {
  return path.join(context.globalStorageUri.fsPath, NPM_PACKAGE);
}

function bundledServerEntry(context) {
  return path.join(bundledServerRoot(context), "node_modules", NPM_PACKAGE, "src", "index.js");
}

function bundledServerDir(context) {
  return path.join(bundledServerRoot(context), "node_modules", NPM_PACKAGE);
}

function bundledServerNodeModules(context) {
  return path.join(bundledServerRoot(context), "node_modules");
}

function installedVersion(context) {
  try {
    const pkgPath = path.join(bundledServerRoot(context), "node_modules", NPM_PACKAGE, "package.json");
    return JSON.parse(fs.readFileSync(pkgPath, "utf8")).version || null;
  } catch {
    return null;
  }
}

/**
 * Fetch the latest published version from the npm registry.
 * Returns null on any network error — never throws.
 */
async function latestNpmVersion() {
  try {
    const res = await fetch(`https://registry.npmjs.org/${NPM_PACKAGE}/latest`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.version || null;
  } catch {
    return null;
  }
}

/**
 * Run `npm install --prefix <root> mcp-ticket-demo` in a child process.
 * Resolves with { ok, version, error }.
 */
function runNpmInstall(root, log) {
  return new Promise((resolve) => {
    fs.mkdirSync(root, { recursive: true });
    log(`npm install ${NPM_PACKAGE} → ${root}`);
    execFile("npm", ["install", "--prefix", root, "--save", NPM_PACKAGE], {
      env: { ...process.env, npm_config_loglevel: "error" },
      timeout: 120_000,
    }, (err, stdout, stderr) => {
      if (err) {
        resolve({ ok: false, error: stderr || err.message });
        return;
      }
      resolve({ ok: true, version: installedVersion({ globalStorageUri: { fsPath: path.dirname(root) } }) });
    });
  });
}

/**
 * Install the server into global storage if not already present.
 * Returns { ok, version, alreadyInstalled }.
 */
async function ensureInstalled(context, log = () => {}) {
  const entry = bundledServerEntry(context);
  if (fs.existsSync(entry)) {
    return { ok: true, alreadyInstalled: true, version: installedVersion(context) };
  }
  const root = bundledServerRoot(context);
  const result = await runNpmInstall(root, log);
  return { ...result, alreadyInstalled: false };
}

/**
 * Check for a newer version and prompt the user to update.
 * Call this on extension activation (fire-and-forget, never throws).
 */
async function checkForUpdate(context, logAll) {
  try {
    const current = installedVersion(context);
    if (!current) return; // not installed yet — nothing to update
    const latest = await latestNpmVersion();
    if (!latest || latest === current) return;
    const action = await vscode.window.showInformationMessage(
      `LF MCP Demo: mcp-ticket-demo ${latest} is available (installed: ${current}).`,
      "Update now",
      "Later",
    );
    if (action === "Update now") {
      await vscode.commands.executeCommand("summitMcp.updateServer");
    }
  } catch {
    // silent — update check must never crash activation
  }
}

module.exports = {
  NPM_PACKAGE,
  bundledServerRoot,
  bundledServerEntry,
  bundledServerDir,
  bundledServerNodeModules,
  installedVersion,
  latestNpmVersion,
  ensureInstalled,
  checkForUpdate,
  runNpmInstall,
};
