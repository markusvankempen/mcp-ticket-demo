const { execFile } = require("child_process");
const { promisify } = require("util");
const path = require("path");
const { workspaceRoot, settings } = require("./config");

const execFileAsync = promisify(execFile);

async function podman(args, options = {}) {
  try {
    const { stdout, stderr } = await execFileAsync("podman", args, {
      timeout: options.timeout || 30_000,
      maxBuffer: 12_000_000,
      cwd: options.cwd || workspaceRoot() || undefined,
    });
    return { ok: true, stdout: String(stdout || "").trim(), stderr: String(stderr || "").trim() };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
      stdout: String(error.stdout || "").trim(),
      stderr: String(error.stderr || "").trim(),
    };
  }
}

function demoRoot() {
  return path.join(workspaceRoot(), "mcp-ticket-demo");
}

function imageName() {
  return settings().podmanImage;
}

function containerName() {
  return settings().podmanContainer;
}

function hostPort() {
  return settings().podmanPort;
}

async function detect() {
  const version = await podman(["version", "--format", "{{.Client.Version}}"]);
  if (!version.ok) {
    return { ok: false, detail: version.stderr || version.error, next: "Install Podman, or start the machine: podman machine start" };
  }
  const info = await podman(["info", "--format", "{{.Host.Arch}}"]);
  return {
    ok: true,
    version: version.stdout,
    arch: info.ok ? info.stdout : "unknown",
    image: imageName(),
    container: containerName(),
    port: hostPort(),
  };
}

async function status() {
  const detected = await detect();
  if (!detected.ok) return { ...detected, running: false };
  const inspect = await podman(["inspect", "-f", "{{.State.Status}}", containerName()]);
  const running = inspect.ok && inspect.stdout === "running";
  return {
    ok: true,
    running,
    status: inspect.ok ? inspect.stdout : "missing",
    version: detected.version,
    image: imageName(),
    container: containerName(),
    port: hostPort(),
    detail: inspect.ok ? `${containerName()} is ${inspect.stdout}` : `${containerName()} is not created yet`,
  };
}

async function build() {
  return podman(
    ["build", "--platform", "linux/amd64", "-t", imageName(), demoRoot()],
    { timeout: 300_000, cwd: demoRoot() },
  );
}

async function runHttp() {
  const name = containerName();
  const existing = await podman(["inspect", name]);
  if (existing.ok) {
    const stopped = await podman(["rm", "-f", name]);
    if (!stopped.ok) return stopped;
  }
  const s = settings();
  const env = [
    "-e", "MCP_MODE=http",
    "-e", "PORT=8080",
    "-e", `ADMIN_USER=${s.adminUser}`,
    "-e", `ADMIN_PASSWORD=${s.adminPassword}`,
    "-e", `DEMO_TOKEN=${s.demoToken}`,
    "-e", `AUTH_MODE=${s.authMode}`,
  ];
  // An API key from settings is registered at boot so the same credential works
  // against the container as against a deployed instance.
  if (s.apiKey) env.push("-e", `API_KEY=${s.apiKey}`, "-e", "API_KEY_SCOPES=read,write,pii");
  return podman(["run", "-d", "--name", name, "-p", `${hostPort()}:8080`, ...env, imageName()]);
}

async function stopHttp() {
  return podman(["rm", "-f", containerName()]);
}

module.exports = { detect, status, build, runHttp, stopHttp, imageName, containerName, hostPort };
