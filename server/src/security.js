/**
 * Auth, scopes, API keys, and rate limiting for the demo server.
 *
 * None of this is in the MCP spec. The spec says nothing about who is allowed to
 * call a tool, so every server invents it. This file is one opinionated answer:
 *
 *   authMode  off    anyone can call anything (boring laptop default)
 *             write  read tools are open; write and PII tools need a credential
 *             all    every tool call needs a credential
 *
 * Credentials are an API key (Authorization: Bearer / x-api-key) or a username and
 * password (HTTP Basic). Each one resolves to a principal with scopes, and every
 * call is rate limited per principal.
 *
 * stdio has no headers, so the same credentials are read from the environment
 * (MCP_API_KEY, or MCP_USERNAME + MCP_PASSWORD).
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const WRITE_TOOLS = new Set(["create_ticket", "add_comment"]);
export const PII_TOOLS = new Set(["lookup_customer"]);
/**
 * Discovery stays open in every mode. A client that cannot ask "what do you need
 * from me?" can only guess, and a guessing model retries in a loop.
 * These calls are still rate limited.
 */
export const OPEN_TOOLS = new Set(["describe_server"]);

export const AUTH_MODES = ["off", "write", "all"];
export const SCOPES = ["read", "write", "pii", "admin"];

const KEY_PREFIX = "mcpk";
/** admin implies everything; write implies read. */
const IMPLIED = { admin: ["read", "write", "pii", "admin"], write: ["read", "write"], pii: ["read", "pii"], read: ["read"] };

const now = () => new Date().toISOString();

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function expandScopes(scopes) {
  const out = new Set();
  for (const scope of scopes || []) {
    for (const implied of IMPLIED[scope] || [scope]) out.add(implied);
  }
  return [...out];
}

function normalizeScopes(input, fallback = ["read"]) {
  const list = (Array.isArray(input) ? input : String(input || "").split(/[\s,]+/))
    .map((s) => String(s || "").trim().toLowerCase())
    .filter((s) => SCOPES.includes(s));
  return list.length ? [...new Set(list)] : fallback;
}

/** "alice:secret:read,write" — one user per comma-separated group. */
function parseUsers(raw) {
  const users = new Map();
  for (const chunk of String(raw || "").split(",")) {
    const part = chunk.trim();
    if (!part) continue;
    const [username, password, scopes] = part.split(":");
    if (!username || !password) continue;
    users.set(username, { username, password, scopes: normalizeScopes(scopes, ["read", "write"]) });
  }
  return users;
}

function initialAuthMode() {
  const raw = String(process.env.AUTH_MODE || "").trim().toLowerCase();
  if (AUTH_MODES.includes(raw)) return raw;
  // Back-compat with the original single lock switch.
  if (process.env.WRITE_TOOLS_LOCKED === "1") return "write";
  return "off";
}

export function createSecurity({ log } = {}) {
  const audit = typeof log === "function" ? log : () => {};

  const state = {
    authMode: initialAuthMode(),
    tenantId: process.env.TENANT_ID || "",
    demoToken: process.env.DEMO_TOKEN || "demo-token",
    adminUser: process.env.ADMIN_USER || "demo",
    adminPassword: process.env.ADMIN_PASSWORD || "demo",
    rateLimit: {
      enabled: process.env.RATE_LIMIT_ENABLED !== "0",
      limit: Math.max(1, Number(process.env.RATE_LIMIT || 60)),
      windowMs: Math.max(1000, Number(process.env.RATE_LIMIT_WINDOW_MS || 60000)),
    },
    deniedCount: 0,
    lastDeniedAt: "",
  };

  /** id -> { id, label, prefix, hash, scopes, createdAt, expiresAt, revokedAt, lastUsedAt, calls } */
  const keys = new Map();
  const users = parseUsers(process.env.MCP_USERS);
  const sessions = new Map();
  const buckets = new Map();

  users.set(state.adminUser, {
    username: state.adminUser,
    password: state.adminPassword,
    scopes: ["admin"],
  });

  function issueKey({ label, scopes, expiresInDays, createdBy } = {}) {
    const id = randomBytes(4).toString("hex");
    const secret = randomBytes(24).toString("base64url");
    const key = `${KEY_PREFIX}_${id}_${secret}`;
    const record = {
      id,
      label: String(label || "unnamed key").slice(0, 60),
      prefix: `${KEY_PREFIX}_${id}`,
      hash: sha256(key),
      scopes: normalizeScopes(scopes, ["read"]),
      createdAt: now(),
      createdBy: createdBy || "admin",
      expiresAt: Number(expiresInDays) > 0
        ? new Date(Date.now() + Number(expiresInDays) * 86400000).toISOString()
        : "",
      revokedAt: "",
      lastUsedAt: "",
      calls: 0,
    };
    keys.set(id, record);
    audit({ tool: "admin.api_key", outcome: `issued ${record.prefix} (${record.scopes.join("+")})` });
    // The plaintext is returned once and never stored.
    return { key, record: publicKey(record) };
  }

  if (process.env.API_KEY) {
    // A key supplied by the environment cannot be hashed-on-issue, so register it directly.
    const id = "env00001";
    keys.set(id, {
      id,
      label: "API_KEY from environment",
      prefix: String(process.env.API_KEY).slice(0, 12),
      hash: sha256(process.env.API_KEY),
      scopes: normalizeScopes(process.env.API_KEY_SCOPES, ["read", "write"]),
      createdAt: now(),
      createdBy: "env",
      expiresAt: "",
      revokedAt: "",
      lastUsedAt: "",
      calls: 0,
      fromEnv: true,
    });
  }

  function publicKey(record) {
    return {
      id: record.id,
      label: record.label,
      prefix: record.prefix,
      scopes: record.scopes,
      createdAt: record.createdAt,
      createdBy: record.createdBy,
      expiresAt: record.expiresAt,
      revokedAt: record.revokedAt,
      lastUsedAt: record.lastUsedAt,
      calls: record.calls,
      active: isActive(record),
      fromEnv: Boolean(record.fromEnv),
    };
  }

  function isActive(record) {
    if (!record || record.revokedAt) return false;
    if (record.expiresAt && Date.parse(record.expiresAt) < Date.now()) return false;
    return true;
  }

  function findKey(presented) {
    const text = String(presented || "");
    if (!text) return null;
    const parts = text.split("_");
    const byId = parts.length >= 3 ? keys.get(parts[1]) : null;
    const candidates = byId ? [byId] : [...keys.values()];
    const hash = sha256(text);
    return candidates.find((record) => safeEqual(record.hash, hash)) || null;
  }

  /** Pull whatever credential the caller presented out of headers (or stdio env). */
  function readCredentials(headers = {}, extra = {}) {
    const get = (name) => headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || "";
    const authorization = String(get("authorization") || "");
    const out = { apiKey: "", username: "", password: "" };

    if (/^Bearer\s+/i.test(authorization)) out.apiKey = authorization.replace(/^Bearer\s+/i, "").trim();
    if (/^Basic\s+/i.test(authorization)) {
      const decoded = Buffer.from(authorization.replace(/^Basic\s+/i, "").trim(), "base64").toString("utf8");
      const idx = decoded.indexOf(":");
      if (idx > 0) {
        out.username = decoded.slice(0, idx);
        out.password = decoded.slice(idx + 1);
      }
    }
    out.apiKey = out.apiKey || String(get("x-api-key") || get("x-demo-token") || extra.token || "");
    out.username = out.username || String(get("x-mcp-username") || "");
    out.password = out.password || String(get("x-mcp-password") || "");
    return out;
  }

  /** Resolve a credential to a principal. Anonymous is a valid principal with no scopes. */
  function identify(headers = {}, extra = {}) {
    const creds = readCredentials(headers, extra);

    if (creds.apiKey) {
      const record = findKey(creds.apiKey);
      if (!record) {
        return {
          type: "invalid",
          id: "invalid",
          label: "unknown API key",
          scopes: [],
          error: "That API key is not recognised. Create one on /admin → API keys, then send it as Authorization: Bearer <key>.",
        };
      }
      if (!isActive(record)) {
        return {
          type: "invalid",
          id: record.id,
          label: record.label,
          scopes: [],
          error: record.revokedAt
            ? `API key ${record.prefix} was revoked on ${record.revokedAt}. Issue a new one on /admin.`
            : `API key ${record.prefix} expired on ${record.expiresAt}. Issue a new one on /admin.`,
        };
      }
      record.lastUsedAt = now();
      record.calls += 1;
      return {
        type: "apikey",
        id: `key:${record.id}`,
        label: record.label,
        prefix: record.prefix,
        scopes: expandScopes(record.scopes),
        grantedScopes: record.scopes,
      };
    }

    if (creds.username) {
      const user = users.get(creds.username);
      if (!user || !safeEqual(user.password, creds.password)) {
        return {
          type: "invalid",
          id: "invalid",
          label: creds.username,
          scopes: [],
          error: "Wrong username or password. Set MCP_USERS on the server, or use an API key instead.",
        };
      }
      return {
        type: "user",
        id: `user:${user.username}`,
        label: user.username,
        scopes: expandScopes(user.scopes),
        grantedScopes: user.scopes,
      };
    }

    // Legacy single-token switch, kept so older configs still work.
    if (state.demoToken && creds.apiKey && safeEqual(creds.apiKey, state.demoToken)) {
      return { type: "token", id: "token:demo", label: "DEMO_TOKEN", scopes: expandScopes(["write", "pii"]), grantedScopes: ["write", "pii"] };
    }

    return { type: "anonymous", id: "anonymous", label: "anonymous", scopes: [], grantedScopes: [] };
  }

  function requiredScope(toolName) {
    if (WRITE_TOOLS.has(toolName)) return "write";
    if (PII_TOOLS.has(toolName)) return "pii";
    return "read";
  }

  /** Does this tool need a credential under the current mode? */
  function authRequiredFor(toolName) {
    if (OPEN_TOOLS.has(toolName)) return false;
    if (state.authMode === "all") return true;
    if (state.authMode === "write") return WRITE_TOOLS.has(toolName) || PII_TOOLS.has(toolName);
    return false;
  }

  function rateSnapshot(principalId) {
    const { enabled, limit, windowMs } = state.rateLimit;
    if (!enabled) return { enabled: false, limit, windowMs, used: 0, remaining: limit, resetInMs: 0 };
    const bucket = buckets.get(principalId);
    const fresh = !bucket || bucket.resetAt <= Date.now();
    const used = fresh ? 0 : bucket.count;
    return {
      enabled: true,
      limit,
      windowMs,
      used,
      remaining: Math.max(0, limit - used),
      resetInMs: fresh ? windowMs : bucket.resetAt - Date.now(),
    };
  }

  function consumeRate(principalId) {
    const { enabled, limit, windowMs } = state.rateLimit;
    if (!enabled) return { ok: true };
    const existing = buckets.get(principalId);
    const bucket = !existing || existing.resetAt <= Date.now()
      ? { count: 0, resetAt: Date.now() + windowMs }
      : existing;
    bucket.count += 1;
    buckets.set(principalId, bucket);
    if (bucket.count > limit) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000));
      return {
        ok: false,
        retryAfterSec,
        error: `Rate limit reached: ${limit} calls per ${Math.round(windowMs / 1000)}s for ${principalId}. Wait ${retryAfterSec}s and try again, or raise the limit on /admin. Do not retry in a loop.`,
      };
    }
    return { ok: true, remaining: limit - bucket.count };
  }

  function deny(principal, toolName, error, extra = {}) {
    state.deniedCount += 1;
    state.lastDeniedAt = now();
    audit({ tool: toolName, principal: principal?.label || "anonymous", outcome: `denied — ${extra.reason || "unauthorized"}` });
    return { ok: false, principal, error, ...extra };
  }

  return {
    /** Everything the /health page, the admin page, and describe_server report. */
    snapshot() {
      return {
        authMode: state.authMode,
        authModes: AUTH_MODES,
        // Kept for older clients and pages that only knew about the write lock.
        writeToolsLocked: state.authMode !== "off",
        allToolsLocked: state.authMode === "all",
        tenantRequired: Boolean(state.tenantId),
        tenantPresent: Boolean(state.tenantId),
        tokenConfigured: Boolean(state.demoToken),
        apiKeys: [...keys.values()].map(publicKey),
        activeKeyCount: [...keys.values()].filter(isActive).length,
        users: [...users.values()].map((u) => ({ username: u.username, scopes: u.scopes })),
        rateLimit: { ...state.rateLimit },
        deniedCount: state.deniedCount,
        lastDeniedAt: state.lastDeniedAt,
        scopes: SCOPES,
      };
    },

    setAuthMode(mode) {
      const next = String(mode || "").toLowerCase();
      if (!AUTH_MODES.includes(next)) return this.snapshot();
      state.authMode = next;
      audit({ tool: "admin.security", outcome: `auth mode set to ${next}` });
      return this.snapshot();
    },

    /** Back-compat: the old boolean lock maps onto write mode. */
    setLocked(locked) {
      return this.setAuthMode(locked ? "write" : "off");
    },

    setRateLimit({ enabled, limit, windowMs } = {}) {
      if (enabled !== undefined) state.rateLimit.enabled = Boolean(enabled);
      if (Number(limit) > 0) state.rateLimit.limit = Math.floor(Number(limit));
      if (Number(windowMs) >= 1000) state.rateLimit.windowMs = Math.floor(Number(windowMs));
      buckets.clear();
      audit({
        tool: "admin.security",
        outcome: `rate limit ${state.rateLimit.enabled ? `${state.rateLimit.limit}/${Math.round(state.rateLimit.windowMs / 1000)}s` : "disabled"}`,
      });
      return this.snapshot();
    },

    issueKey,

    revokeKey(id) {
      const record = keys.get(String(id));
      if (!record) return false;
      record.revokedAt = now();
      audit({ tool: "admin.api_key", outcome: `revoked ${record.prefix}` });
      return true;
    },

    listKeys() {
      return [...keys.values()].map(publicKey);
    },

    identify,
    requiredScope,
    authRequiredFor,
    rateSnapshot,

    /**
     * The single gate every tool call goes through.
     * Returns { ok, principal, error } — the error text is written for a model to act on.
     */
    authorizeCall(toolName, headers = {}, extra = {}) {
      const principal = identify(headers, extra);

      // A bad credential is fatal everywhere except discovery, which has to be able
      // to tell the caller *why* the credential was rejected.
      if (principal.type === "invalid" && !OPEN_TOOLS.has(toolName)) {
        return deny(principal, toolName, principal.error, { status: 401, reason: "bad credential" });
      }

      const tenant = this.checkTenant(headers);
      if (!tenant.ok && !OPEN_TOOLS.has(toolName) && (WRITE_TOOLS.has(toolName) || state.authMode === "all")) {
        return deny(principal, toolName, tenant.error, { status: 403, reason: "tenant header missing" });
      }

      const needed = requiredScope(toolName);
      if (authRequiredFor(toolName)) {
        if (principal.type === "anonymous") {
          return deny(
            principal,
            toolName,
            `${toolName} needs a credential because auth mode is "${state.authMode}". Send Authorization: Bearer <api key> (create one on /admin → API keys) or HTTP Basic with a username and password. Over stdio set MCP_API_KEY in the server env.`,
            { status: 401, reason: "anonymous" },
          );
        }
        if (!principal.scopes.includes(needed)) {
          return deny(
            principal,
            toolName,
            `${principal.label} has scopes [${principal.grantedScopes.join(", ") || "none"}] but ${toolName} needs "${needed}". Issue a key with that scope on /admin → API keys.`,
            { status: 403, reason: `missing scope ${needed}` },
          );
        }
      }

      const rate = consumeRate(principal.id);
      if (!rate.ok) {
        return deny(principal, toolName, rate.error, { status: 429, reason: "rate limited", retryAfterSec: rate.retryAfterSec });
      }

      return {
        ok: true,
        principal,
        authenticated: principal.type !== "anonymous",
        scope: needed,
        remaining: rate.remaining,
      };
    },

    checkTenant(headers = {}) {
      if (!state.tenantId) return { ok: true };
      const got = headers["x-tenant-id"] || headers["X-Tenant-Id"];
      if (got === state.tenantId) return { ok: true };
      return {
        ok: false,
        error: "Auth looks fine, but every write will fail. Send header x-tenant-id with the tenant from /admin. This is the silent-failure row from the talk.",
      };
    },

    extractToken(headers = {}, extra = {}) {
      return readCredentials(headers, extra).apiKey;
    },

    /** Kept so existing callers keep working; both now route through authorizeCall. */
    authorizeWrite(headers, extra) {
      const result = this.authorizeCall("create_ticket", headers, extra);
      return { ...result, locked: state.authMode !== "off" };
    },

    authorizePii(headers, extra) {
      const result = this.authorizeCall("lookup_customer", headers, extra);
      return { ...result, locked: state.authMode !== "off" };
    },

    /** Admin browser session for /admin — separate from MCP tool credentials. */
    login(username, password) {
      const user = users.get(username);
      const okAdmin = username === state.adminUser && safeEqual(state.adminPassword, String(password || ""));
      const okUser = user && safeEqual(user.password, String(password || "")) && user.scopes.includes("admin");
      if (okAdmin || okUser) {
        const id = `ses_${randomBytes(12).toString("hex")}`;
        sessions.set(id, Date.now());
        audit({ tool: "admin.login", outcome: `${username} signed in` });
        return id;
      }
      audit({ tool: "admin.login", outcome: `failed sign-in for ${username || "(blank)"}` });
      return null;
    },

    validSession(id) {
      return Boolean(id && sessions.has(id));
    },

    logout(id) {
      sessions.delete(id);
    },

    adminUser() {
      return state.adminUser;
    },
  };
}
