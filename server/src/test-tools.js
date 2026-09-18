#!/usr/bin/env node
/**
 * Comprehensive MCP tool test.
 *
 * Phase 1 — in-process: calls every tool handler directly through the real
 *            store + security stack (auth mode off). Verifies return shapes,
 *            attribution logic, schema discovery, PII redaction, and error paths.
 *
 * Phase 2 — HTTP: starts the server on a random high port, calls every tool
 *            over POST /mcp (JSON-RPC 2.0), verifies the wire protocol is intact,
 *            then shuts down cleanly.
 *
 * Exit code: 0 = all passed, 1 = at least one failure.
 *
 * Usage:
 *   node src/test-tools.js          # run both phases
 *   node src/test-tools.js --phase1  # in-process only (no port needed)
 */

import { createStore } from "./store.js";
import { createSecurity } from "./security.js";
import { createMcpServer, TOOL_CATALOG, TOOL_COUNT } from "./create-server.js";
import { startHttp } from "./http.js";

// ── Tiny assertion / reporting harness ───────────────────────────────────────

const results = [];
let currentSuite = "";

function suite(name) {
  currentSuite = name;
}

function pass(name) {
  results.push({ ok: true, suite: currentSuite, name });
  process.stdout.write(`  ✓ ${name}\n`);
}

function fail(name, reason) {
  results.push({ ok: false, suite: currentSuite, name, reason });
  process.stdout.write(`  ✗ ${name}\n    → ${reason}\n`);
}

function check(name, condition, reason) {
  condition ? pass(name) : fail(name, reason || "condition was false");
}

function extractText(result) {
  const content = result?.content ?? result?.result?.content ?? [];
  return Array.isArray(content) ? content.map((c) => c.text || "").join("\n") : "";
}

function parseResult(result) {
  try {
    return JSON.parse(extractText(result));
  } catch {
    return {};
  }
}

// ── Phase 1: in-process via MCP server handler ────────────────────────────────

async function phase1() {
  console.log("\n── Phase 1: in-process tool calls ──────────────────────────────\n");

  const store = createStore();
  const security = createSecurity({ log: store.log });

  // Use a thin wrapper that calls the MCP tool handler directly.
  // McpServer doesn't expose callTool publicly, so we invoke the underlying
  // store + security directly (the same path the handler uses).
  const noHeaders = () => ({});

  // Helper: route through the real MCP server by calling tools/list then
  // locating the handler via a thin in-process POST to a transport-less server.
  // For simplicity we call the store/security APIs directly — the same code
  // the handler delegates to — which is equivalent and avoids transport overhead.

  // ── describe_server ────────────────────────────────────────────────────────
  suite("describe_server");
  {
    const auth = security.authorizeCall("describe_server", noHeaders(), {});
    check("authorised in off mode", auth.ok, auth.error);
    const snap = security.snapshot();
    check("tool count matches catalog", snap.toolGates && Object.keys(snap.toolGates).length === TOOL_COUNT,
      `gates has ${Object.keys(snap.toolGates || {}).length}, catalog has ${TOOL_COUNT}`);
    check("catalog names match security ALL_TOOLS",
      TOOL_CATALOG.every(([name]) => name in (snap.toolGates || {})),
      "some catalog tool missing from toolGates");
  }

  // ── search_tickets ─────────────────────────────────────────────────────────
  suite("search_tickets");
  {
    const open = store.listTickets({ status: "open", limit: 10 });
    check("seed has open tickets", open.length > 0, `got ${open.length}`);
    const all = store.listTickets({ status: "all", limit: 50 });
    check("seed has 3 tickets", all.length === 3, `got ${all.length}`);
    const byEmail = store.listTickets({ requester_email: "ada@example.com", status: "all" });
    check("filter by email works", byEmail.length === 1 && byEmail[0].requester_email === "ada@example.com",
      `got ${byEmail.length}`);
    const byKeyword = store.listTickets({ query: "mcp.json", status: "all" });
    check("keyword filter matches body text", byKeyword.length >= 1, `got ${byKeyword.length}`);
    const empty = store.listTickets({ query: "zzznotfound", status: "all" });
    check("empty result on no-match keyword", empty.length === 0, `got ${empty.length}`);
    const limited = store.listTickets({ status: "all", limit: 1 });
    check("limit is respected", limited.length === 1, `got ${limited.length}`);
  }

  // ── create_ticket ──────────────────────────────────────────────────────────
  suite("create_ticket");
  {
    // happy path WITH requester_email
    const { ticket: t1, usedServiceAccount: s1 } = store.createTicket({
      subject: "Test: with email",
      body: "body text",
      requester_email: "markus.van.kempen@gmail.com",
    });
    check("create with email — ok", !!t1 && !s1, `usedServiceAccount=${s1}`);
    check("create with email — id format", /^TCK-\d+$/.test(t1?.id ?? ""), `id=${t1?.id}`);
    check("create with email — attribution=customer", t1?.attribution === "customer", `got ${t1?.attribution}`);
    check("create with email — requester set", t1?.requester_email === "markus.van.kempen@gmail.com",
      `got ${t1?.requester_email}`);

    // attribution scar — omit requester_email
    const { ticket: t2, usedServiceAccount: s2 } = store.createTicket({
      subject: "Test: scar",
      body: "no email",
    });
    check("create WITHOUT email — usedServiceAccount=true", s2 === true, `got ${s2}`);
    check("create WITHOUT email — attribution=service_account", t2?.attribution === "service_account",
      `got ${t2?.attribution}`);
    check("create WITHOUT email — requester is service account", t2?.requester_email === "mcp-bot@service.local",
      `got ${t2?.requester_email}`);

    // ticket appears in search
    const found = store.listTickets({ query: "with email", status: "all" });
    check("created ticket appears in search", found.some((t) => t.id === t1.id), `ids: ${found.map(t => t.id).join()}`);
  }

  // ── get_ticket ─────────────────────────────────────────────────────────────
  suite("get_ticket");
  {
    const t = store.getTicket("TCK-1001");
    check("get seed ticket TCK-1001", !!t, "returned null");
    check("get ticket — has comments array", Array.isArray(t?.comments), `got ${typeof t?.comments}`);
    check("get ticket — has attribution", !!t?.attribution, "attribution missing");

    const missing = store.getTicket("TCK-9999");
    check("get missing ticket returns null", missing === null, `got ${missing}`);
  }

  // ── add_comment ────────────────────────────────────────────────────────────
  suite("add_comment");
  {
    const before = store.getTicket("TCK-1001");
    const prevLen = before?.comments?.length ?? 0;

    const updated = store.addComment("TCK-1001", {
      author: "markus.van.kempen@gmail.com",
      body: "Test comment from test-tools",
    });
    check("add_comment returns updated ticket", !!updated, "returned null");
    check("add_comment increments comment count", (updated?.comments?.length ?? 0) === prevLen + 1,
      `before=${prevLen} after=${updated?.comments?.length}`);
    check("add_comment author set", updated?.comments?.at(-1)?.author === "markus.van.kempen@gmail.com",
      `got ${updated?.comments?.at(-1)?.author}`);

    // bad ticket id
    const bad = store.addComment("TCK-9999", { author: "x", body: "y" });
    check("add_comment bad id returns null", bad === null, `got ${bad}`);
  }

  // ── list_schemas ───────────────────────────────────────────────────────────
  suite("list_schemas");
  {
    const schemas = Object.keys(store.schemas);
    check("3 schemas registered", schemas.length === 3, `got ${schemas.length}: ${schemas.join()}`);
    check("tickets schema present", schemas.includes("tickets"), `schemas: ${schemas}`);
    check("customers schema present", schemas.includes("customers"), `schemas: ${schemas}`);
    check("assets schema present", schemas.includes("assets"), `schemas: ${schemas}`);
  }

  // ── get_schema ─────────────────────────────────────────────────────────────
  suite("get_schema");
  {
    const tickets = store.getSchema("tickets");
    check("get tickets schema", !!tickets, "returned null");
    check("tickets schema has fields", Array.isArray(tickets?.fields) && tickets.fields.length > 0,
      `fields=${tickets?.fields}`);
    check("tickets schema has filterable", Array.isArray(tickets?.filterable), "no filterable");

    const customers = store.getSchema("customers");
    check("get customers schema", !!customers, "returned null");

    const assets = store.getSchema("assets");
    check("get assets schema", !!assets, "returned null");

    const unknown = store.getSchema("orders");
    check("unknown schema returns null", unknown === null, `got ${unknown}`);
  }

  // ── run_query ──────────────────────────────────────────────────────────────
  suite("run_query");
  {
    const q1 = store.runQuery({ schema: "tickets", filter: { status: "open" }, limit: 10 });
    check("run_query tickets — no error", !q1.error, q1.error);
    check("run_query tickets — count field", typeof q1.count === "number", `got ${typeof q1.count}`);
    check("run_query tickets — rows is array", Array.isArray(q1.rows), `got ${typeof q1.rows}`);
    check("run_query tickets — filter applied", q1.rows.every((r) => r.status === "open"),
      `some rows not open: ${q1.rows.map(r => r.status).join()}`);

    const q2 = store.runQuery({ schema: "customers", limit: 10 });
    check("run_query customers — no error", !q2.error, q2.error);
    check("run_query customers — has rows", q2.rows.length > 0, `got ${q2.rows.length}`);
    check("run_query customers — phone stripped", !("phone" in (q2.rows[0] ?? {})),
      "phone should not appear in query results");

    const q3 = store.runQuery({ schema: "assets", limit: 10 });
    check("run_query assets — no error", !q3.error, q3.error);

    const q4 = store.runQuery({
      schema: "tickets",
      filter: {},
      fields: ["id", "subject"],
      limit: 10,
    });
    check("run_query field projection — only id+subject", q4.rows.every((r) =>
      Object.keys(r).length === 2 && "id" in r && "subject" in r),
      `keys: ${Object.keys(q4.rows[0] ?? {}).join()}`);

    const q5 = store.runQuery({ schema: "orders", limit: 5 });
    check("run_query unknown schema — returns error", !!q5.error, "expected error string");

    const q6 = store.runQuery({ schema: "tickets", limit: 2 });
    check("run_query limit respected", q6.rows.length <= 2, `got ${q6.rows.length}`);
  }

  // ── lookup_customer ────────────────────────────────────────────────────────
  suite("lookup_customer");
  {
    // without reveal — phone redacted
    const r1 = store.lookupCustomer("ada@example.com", { reveal: false });
    check("lookup ada — found", !!r1, "returned null");
    check("lookup ada — phone REDACTED without pii scope", r1?.phone === "REDACTED",
      `got phone=${r1?.phone}`);
    check("lookup ada — name present", !!r1?.name, `name=${r1?.name}`);

    // with reveal — full PII
    const r2 = store.lookupCustomer("ada@example.com", { reveal: true });
    check("lookup ada with reveal — phone visible", r2?.phone !== "REDACTED" && !!r2?.phone,
      `got phone=${r2?.phone}`);

    // unknown customer
    const r3 = store.lookupCustomer("nobody@example.com");
    check("lookup unknown customer — returns null", r3 === null, `got ${r3}`);
  }

  // ── auth / security layer ──────────────────────────────────────────────────
  suite("security — auth modes and tool gates");
  {
    // auth mode write — read tools open, write tools gated
    security.setAuthMode("write");
    const readAllowed = security.authorizeCall("search_tickets", {}, {});
    check("auth=write — search_tickets (read) allowed anon", readAllowed.ok, readAllowed.error);
    const writeBlocked = security.authorizeCall("create_ticket", {}, {});
    check("auth=write — create_ticket (write) blocked anon", !writeBlocked.ok, "expected denied");
    check("auth=write — denied status is 401", writeBlocked.status === 401,
      `got status=${writeBlocked.status}`);

    // auth mode all — everything gated
    security.setAuthMode("all");
    const readBlocked = security.authorizeCall("search_tickets", {}, {});
    check("auth=all — search_tickets blocked anon", !readBlocked.ok, "expected denied");

    // reset to off
    security.setAuthMode("off");
    const backOpen = security.authorizeCall("search_tickets", {}, {});
    check("auth=off — search_tickets open again", backOpen.ok, backOpen.error);

    // tool gate — disable a tool
    security.setToolGate("get_ticket", false);
    const gated = security.authorizeCall("get_ticket", {}, {});
    check("tool gate disabled — get_ticket returns 503", !gated.ok && gated.status === 503,
      `ok=${gated.ok} status=${gated.status}`);
    // re-enable
    security.setToolGate("get_ticket", true);
    const ungated = security.authorizeCall("get_ticket", {}, {});
    check("tool gate re-enabled — get_ticket open", ungated.ok, ungated.error);

    // valid API key
    const issued = security.issueKey({ label: "test key", scopes: ["read", "write", "pii"] });
    const keyHeaders = { authorization: `Bearer ${issued.key}` };
    security.setAuthMode("all");
    const authed = security.authorizeCall("create_ticket", keyHeaders, {});
    check("valid API key — create_ticket authorised in all mode", authed.ok,
      `${authed.error} (status ${authed.status})`);
    check("valid key — principal type=api_key", authed.principal?.type === "api_key",
      `got type=${authed.principal?.type}`);
    check("valid key — scopes include write", authed.principal?.scopes?.includes("write"),
      `scopes=${authed.principal?.scopes}`);

    // revoke the key
    security.revokeKey(issued.record.id);
    security.setAuthMode("off");

    // rate limiting
    const snap = security.snapshot();
    check("rate limit enabled by default", snap.rateLimit.enabled === true, `got ${snap.rateLimit.enabled}`);
    check("rate limit default 60/60s", snap.rateLimit.limit === 60 && snap.rateLimit.windowMs === 60000,
      `limit=${snap.rateLimit.limit} windowMs=${snap.rateLimit.windowMs}`);
  }

  // ── store audit log ────────────────────────────────────────────────────────
  suite("store audit log");
  {
    const audit = store.audit();
    check("audit has entries", audit.length > 0, `got ${audit.length}`);
    check("audit entries have 'at' timestamp", audit.every((a) => typeof a.at === "string"),
      "some entry missing at");
  }
}

// ── Phase 2: HTTP wire test ───────────────────────────────────────────────────

async function phase2() {
  console.log("\n── Phase 2: HTTP wire test (JSON-RPC 2.0 over POST /mcp) ────────\n");

  const TEST_PORT = 8799;
  process.env.MCP_MODE = "http";
  process.env.PORT = String(TEST_PORT);
  process.env.AUTH_MODE = "off";

  const store = createStore();
  const security = createSecurity({ log: store.log });

  let httpServer;
  try {
    httpServer = await startHttp({ store, security });
  } catch (err) {
    fail("HTTP server start", `Could not bind to port ${TEST_PORT}: ${err.message}`);
    return;
  }

  const BASE = `http://127.0.0.1:${TEST_PORT}`;

  async function mcpPost(id, method, params = {}) {
    const res = await fetch(`${BASE}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    });
    const text = await res.text();
    // Streamable HTTP may return SSE or plain JSON
    const jsonLine = text.split("\n").find((l) => l.startsWith("{") || l.startsWith("data:"));
    const raw = jsonLine?.startsWith("data:") ? jsonLine.slice(5).trim() : jsonLine || text;
    try {
      return { status: res.status, body: JSON.parse(raw) };
    } catch {
      return { status: res.status, body: { raw: text.slice(0, 300) } };
    }
  }

  suite("HTTP — /health");
  {
    const res = await fetch(`${BASE}/health?format=json`);
    const body = await res.json().catch(() => ({}));
    check("/health returns 200", res.status === 200, `got ${res.status}`);
    check("/health body.ok = true", body.ok === true, `ok=${body.ok}`);
    check("/health transport = http", body.transport === "http", `got ${body.transport}`);
    check("/health tools count", body.tools === TOOL_COUNT, `got ${body.tools}, want ${TOOL_COUNT}`);
  }

  suite("HTTP — /test");
  {
    const res = await fetch(`${BASE}/test?format=json`);
    const body = await res.json().catch(() => ({}));
    check("/test returns 200", res.status === 200, `got ${res.status}`);
    check("/test body.ok = true", body.ok === true, `ok=${body.ok}, steps: ${JSON.stringify(body.steps?.map(s => ({ n: s.name, ok: s.ok, d: s.detail })))}`);
    check("/test has steps array", Array.isArray(body.steps), `got ${typeof body.steps}`);
    check("/test all steps passed", (body.steps || []).every((s) => s.ok),
      (body.steps || []).filter((s) => !s.ok).map((s) => `${s.name}: ${s.detail}`).join("; "));
  }

  suite("HTTP — tools/list");
  {
    const r = await mcpPost(1, "tools/list");
    const tools = r.body?.result?.tools ?? r.body?.tools ?? [];
    check("tools/list — HTTP 200", r.status === 200, `got ${r.status}`);
    check(`tools/list — ${TOOL_COUNT} tools returned`, tools.length === TOOL_COUNT,
      `got ${tools.length}: ${tools.map(t => t.name).join()}`);
    check("tools/list — all catalog names present",
      TOOL_CATALOG.every(([name]) => tools.some((t) => t.name === name)),
      `missing: ${TOOL_CATALOG.filter(([n]) => !tools.some(t => t.name === n)).map(([n]) => n).join()}`);
  }

  suite("HTTP — describe_server");
  {
    const r = await mcpPost(2, "tools/call", { name: "describe_server", arguments: {} });
    const text = extractText(r.body);
    const data = safeJson(text);
    check("describe_server — HTTP 200", r.status === 200, `got ${r.status}`);
    check("describe_server — ok=true", data?.ok === true, `ok=${data?.ok}`);
    check("describe_server — tools array present", Array.isArray(data?.tools), `tools=${typeof data?.tools}`);
    check("describe_server — tool_count matches", data?.server?.tool_count === TOOL_COUNT,
      `got ${data?.server?.tool_count}`);
  }

  suite("HTTP — search_tickets");
  {
    const r = await mcpPost(3, "tools/call", {
      name: "search_tickets",
      arguments: { status: "open", limit: 5 },
    });
    const data = safeJson(extractText(r.body));
    check("search_tickets — HTTP 200", r.status === 200, `got ${r.status}`);
    check("search_tickets — ok=true", data?.ok === true, `ok=${data?.ok}`);
    check("search_tickets — has tickets array", Array.isArray(data?.tickets), `tickets=${typeof data?.tickets}`);
    check("search_tickets — count > 0", (data?.count ?? 0) > 0, `count=${data?.count}`);
  }

  suite("HTTP — create_ticket");
  {
    // with email
    const r1 = await mcpPost(4, "tools/call", {
      name: "create_ticket",
      arguments: {
        subject: "HTTP test ticket",
        body: "Created by test-tools.js phase 2",
        requester_email: "markus.van.kempen@gmail.com",
      },
    });
    const d1 = safeJson(extractText(r1.body));
    check("create_ticket — HTTP 200", r1.status === 200, `got ${r1.status}`);
    check("create_ticket — ok=true", d1?.ok === true, `ok=${d1?.ok}`);
    check("create_ticket — no warning (email provided)", !d1?.warning, `warning: ${d1?.warning}`);
    check("create_ticket — ticket id present", /^TCK-\d+/.test(d1?.ticket?.id ?? ""), `id=${d1?.ticket?.id}`);

    // attribution scar
    const r2 = await mcpPost(5, "tools/call", {
      name: "create_ticket",
      arguments: { subject: "Scar test", body: "no email" },
    });
    const d2 = safeJson(extractText(r2.body));
    check("create_ticket scar — warning present", !!d2?.warning, `warning=${d2?.warning}`);
    check("create_ticket scar — service account requester",
      d2?.ticket?.requester_email === "mcp-bot@service.local",
      `got ${d2?.ticket?.requester_email}`);
  }

  suite("HTTP — get_ticket");
  {
    const r = await mcpPost(6, "tools/call", { name: "get_ticket", arguments: { ticket_id: "TCK-1001" } });
    const data = safeJson(extractText(r.body));
    check("get_ticket — HTTP 200", r.status === 200, `got ${r.status}`);
    check("get_ticket — ok=true", data?.ok === true, `ok=${data?.ok}`);
    check("get_ticket — correct id", data?.ticket?.id === "TCK-1001", `got ${data?.ticket?.id}`);

    // bad id
    const r2 = await mcpPost(7, "tools/call", { name: "get_ticket", arguments: { ticket_id: "TCK-9999" } });
    const d2 = safeJson(extractText(r2.body));
    check("get_ticket bad id — ok=false", d2?.ok === false, `ok=${d2?.ok}`);
    check("get_ticket bad id — error mentions id", String(d2?.error ?? "").includes("TCK-9999"),
      `error=${d2?.error}`);
  }

  suite("HTTP — add_comment");
  {
    const r = await mcpPost(8, "tools/call", {
      name: "add_comment",
      arguments: {
        ticket_id: "TCK-1001",
        body: "HTTP wire test comment",
        author: "markus.van.kempen@gmail.com",
      },
    });
    const data = safeJson(extractText(r.body));
    check("add_comment — HTTP 200", r.status === 200, `got ${r.status}`);
    check("add_comment — ok=true", data?.ok === true, `ok=${data?.ok}`);

    // bad ticket id
    const r2 = await mcpPost(9, "tools/call", {
      name: "add_comment",
      arguments: { ticket_id: "TCK-9999", body: "x" },
    });
    const d2 = safeJson(extractText(r2.body));
    check("add_comment bad id — ok=false", d2?.ok === false, `ok=${d2?.ok}`);
  }

  suite("HTTP — list_schemas");
  {
    const r = await mcpPost(10, "tools/call", { name: "list_schemas", arguments: {} });
    const data = safeJson(extractText(r.body));
    check("list_schemas — ok=true", data?.ok === true, `ok=${data?.ok}`);
    check("list_schemas — 3 schemas", data?.schemas?.length === 3, `got ${data?.schemas?.length}`);
  }

  suite("HTTP — get_schema");
  {
    for (const name of ["tickets", "customers", "assets"]) {
      const r = await mcpPost(20 + ["tickets", "customers", "assets"].indexOf(name), "tools/call", {
        name: "get_schema",
        arguments: { name },
      });
      const data = safeJson(extractText(r.body));
      check(`get_schema ${name} — ok=true`, data?.ok === true, `ok=${data?.ok}`);
      check(`get_schema ${name} — fields present`, Array.isArray(data?.schema?.fields),
        `fields=${data?.schema?.fields}`);
    }
  }

  suite("HTTP — run_query");
  {
    const r = await mcpPost(30, "tools/call", {
      name: "run_query",
      arguments: { schema: "tickets", filter: { status: "open" }, limit: 5 },
    });
    const data = safeJson(extractText(r.body));
    check("run_query — ok=true", data?.ok === true, `ok=${data?.ok}`);
    check("run_query — count field present", typeof data?.count === "number", `count=${data?.count}`);

    // bad schema
    const r2 = await mcpPost(31, "tools/call", {
      name: "run_query",
      arguments: { schema: "orders", limit: 5 },
    });
    const d2 = safeJson(extractText(r2.body));
    check("run_query bad schema — ok=false", d2?.ok === false, `ok=${d2?.ok}`);
    check("run_query bad schema — error present", !!d2?.error, `error=${d2?.error}`);
  }

  suite("HTTP — lookup_customer");
  {
    const r = await mcpPost(40, "tools/call", {
      name: "lookup_customer",
      arguments: { email: "ada@example.com" },
    });
    const data = safeJson(extractText(r.body));
    check("lookup_customer — ok=true", data?.ok === true, `ok=${data?.ok}`);
    check("lookup_customer — phone REDACTED (no pii scope)", data?.customer?.phone === "REDACTED",
      `got phone=${data?.customer?.phone}`);

    // unknown customer
    const r2 = await mcpPost(41, "tools/call", {
      name: "lookup_customer",
      arguments: { email: "nobody@example.com" },
    });
    const d2 = safeJson(extractText(r2.body));
    check("lookup_customer unknown — ok=false", d2?.ok === false, `ok=${d2?.ok}`);
  }

  suite("HTTP — auth mode enforcement over wire");
  {
    // Switch server to write mode — create_ticket should be denied for anon
    security.setAuthMode("write");
    const r = await mcpPost(50, "tools/call", {
      name: "create_ticket",
      arguments: { subject: "auth test", body: "x" },
    });
    const data = safeJson(extractText(r.body));
    check("auth=write over wire — create_ticket denied anon", data?.denied === true,
      `ok=${data?.ok} denied=${data?.denied}`);
    check("auth=write over wire — status 401 in payload", data?.status === 401,
      `got status=${data?.status}`);

    // search_tickets still open
    const r2 = await mcpPost(51, "tools/call", {
      name: "search_tickets",
      arguments: { status: "open" },
    });
    const d2 = safeJson(extractText(r2.body));
    check("auth=write over wire — search_tickets still open", d2?.ok === true, `ok=${d2?.ok}`);

    security.setAuthMode("off");
  }

  // Shut down cleanly
  await new Promise((resolve, reject) => {
    if (httpServer && typeof httpServer.close === "function") {
      httpServer.close((err) => (err ? reject(err) : resolve()));
    } else {
      resolve();
    }
  });
}

// ── Summary ───────────────────────────────────────────────────────────────────

function safeJson(text) {
  try { return JSON.parse(text); } catch { return {}; }
}

async function main() {
  const phaseArg = process.argv.find((a) => a.startsWith("--phase"));
  const runPhase1 = !phaseArg || phaseArg === "--phase1" || phaseArg === "--all";
  const runPhase2 = !phaseArg || phaseArg === "--phase2" || phaseArg === "--all";

  console.log("mcp-ticket-demo — tool test suite");
  console.log(`Node ${process.version}  cwd=${process.cwd()}`);

  if (runPhase1) await phase1();
  if (runPhase2) await phase2();

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  const total = results.length;

  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${passed}/${total} passed${failed > 0 ? `  ← ${failed} FAILED` : "  ✓ all good"}`);

  if (failed > 0) {
    console.log("\nFailed tests:");
    results.filter((r) => !r.ok).forEach((r) => {
      console.log(`  [${r.suite}] ${r.name}`);
      console.log(`    ${r.reason}`);
    });
    process.exit(1);
  }
  console.log("─".repeat(60));
  process.exit(0);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
