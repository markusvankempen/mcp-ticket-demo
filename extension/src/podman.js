const { execFile } = require("child_process");
const { promisify } = require("util");
const { workspaceRoot, settings } = require("./config");

const execFileAsync = promisify(execFile);

/**
 * Cache the detected runtime so we only probe once per session.
 * null  = not yet probed
 * ""    = probed, nothing found
 * "podman" | "docker" = found
 */
let _runtime = null;

/**
 * Find the first available container runtime.
 * Tries podman first (preferred), then docker.
 * Returns the binary name as a string, or "" if neither is available.
 */
async function detectRuntime() {
  if (_runtime !== null) return _runtime;
  for (const bin of ["podman", "docker"]) {
    try {
      await execFileAsync(bin, ["version", "--format", "{{.Client.Version}}"], { timeout: 5000 });
      _runtime = bin;
      return _runtime;
    } catch {
      // not found or not runnable — try next
    }
  }
  _runtime = "";
  return _runtime;
}

/** Reset the cache (used in tests or after a runtime is installed mid-session). */
function resetRuntimeCache() {
  _runtime = null;
}

/** Run a container CLI command with the detected runtime. */
async function cli(args, options = {}) {
  const runtime = await detectRuntime();
  if (!runtime) {
    return {
      ok: false,
      error: "No container runtime found. Install Podman or Docker.",
      stdout: "",
      stderr: "",
    };
  }
  try {
    const { stdout, stderr } = await execFileAsync(runtime, args, {
      timeout: options.timeout || 30_000,
      maxBuffer: 12_000_000,
      cwd: options.cwd || workspaceRoot() || undefined,
    });
    return { ok: true, stdout: String(stdout || "").trim(), stderr: String(stderr || "").trim(), runtime };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
      stdout: String(error.stdout || "").trim(),
      stderr: String(error.stderr || "").trim(),
      runtime,
    };
  }
}

function demoRoot() {
  return workspaceRoot();
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
  const runtime = await detectRuntime();
  if (!runtime) {
    return {
      ok: false,
      runtime: null,
      detail: "Neither Podman nor Docker found on PATH.",
      next: "Install Podman (podman.io) or Docker (docker.com), then retry.",
    };
  }

  const version = await cli(["version", "--format", "{{.Client.Version}}"]);
  if (!version.ok) {
    // Docker uses a different format key
    const versionDocker = await cli(["version", "--format", "{{.Client.Version}}"]);
    if (!versionDocker.ok) {
      return {
        ok: false,
        runtime,
        detail: version.stderr || version.error,
        next: runtime === "podman"
          ? "Start the Podman machine: podman machine start"
          : "Start the Docker daemon.",
      };
    }
  }

  const arch = await cli(["info", "--format", "{{.Host.Arch}}"]);
  return {
    ok: true,
    runtime,
    version: version.stdout || "(unknown)",
    arch: arch.ok ? arch.stdout : "unknown",
    image: imageName(),
    container: containerName(),
    port: hostPort(),
    detail: `${runtime} ${version.stdout || ""}`.trim(),
  };
}

async function status() {
  const detected = await detect();
  if (!detected.ok) return { ...detected, running: false };
  const inspect = await cli(["inspect", "-f", "{{.State.Status}}", containerName()]);
  const running = inspect.ok && inspect.stdout === "running";
  return {
    ok: true,
    runtime: detected.runtime,
    running,
    status: inspect.ok ? inspect.stdout : "missing",
    version: detected.version,
    image: imageName(),
    container: containerName(),
    port: hostPort(),
    detail: inspect.ok
      ? `${containerName()} is ${inspect.stdout} (${detected.runtime})`
      : `${containerName()} is not created yet`,
  };
}

async function build() {
  return cli(
    ["build", "--platform", "linux/amd64", "-t", imageName(), demoRoot()],
    { timeout: 300_000, cwd: demoRoot() },
  );
}

async function runHttp() {
  const name = containerName();
  const existing = await cli(["inspect", name]);
  if (existing.ok) {
    const stopped = await cli(["rm", "-f", name]);
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
  if (s.apiKey) env.push("-e", `API_KEY=${s.apiKey}`, "-e", "API_KEY_SCOPES=read,write,pii");
  return cli(["run", "-d", "--name", name, "-p", `${hostPort()}:8080`, ...env, imageName()]);
}

async function stopHttp() {
  return cli(["rm", "-f", containerName()]);
}

module.exports = {
  detectRuntime,
  resetRuntimeCache,
  detect,
  status,
  build,
  runHttp,
  stopHttp,
  imageName,
  containerName,
  hostPort,
};
