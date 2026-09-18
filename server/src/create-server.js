import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

function json(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function fail(message, extra = {}) {
  return json({ ok: false, error: message, next: extra.next || "Read the error. It already says what to try.", ...extra });
}

/** Turn a denied gate result into a tool error the model can act on. */
function denied(result) {
  return json({
    ok: false,
    error: result.error,
    status: result.status,
    denied: true,
    principal: result.principal?.label || "anonymous",
    retry_after_seconds: result.retryAfterSec,
    next: result.status === 429
      ? "Wait for the window to reset. Do not retry immediately."
      : result.status === 503
        ? "This tool has been disabled by an administrator. Check /tools for available tools."
        : "Present a credential with the scope named in the error, then call the tool again.",
  });
}

/** Single source of truth for the tool inventory: name, required scope, one-line purpose. */
export const TOOL_CATALOG = [
  ["describe_server", "read", "Identity, auth mode, your scopes, rate limit, and the tool inventory"],
  ["search_tickets", "read", "Find tickets by status / requester / keyword"],
  ["create_ticket", "write", "Open a ticket. Pass requester_email or the bot owns it."],
  ["add_comment", "write", "Comment on a known ticket id"],
  ["close_ticket", "write", "Resolve and close a ticket. Optionally add a resolution note."],
  ["get_ticket", "read", "Fetch one ticket including attribution"],
  ["list_schemas", "read", "Discover query shapes before you query"],
  ["get_schema", "read", "Fields and filters for one schema"],
  ["run_query", "read", "The one query tool — not query_tickets / query_assets"],
  ["lookup_customer", "pii", "Customer record. Phone is PII."],
];

export const TOOL_COUNT = TOOL_CATALOG.length;

export function createMcpServer({ store, security, requestHeaders = () => ({}) }) {
  const server = new McpServer({
    name: "mcp-ticket-demo",
    version: "1.5.0",
  });

  const headers = () => requestHeaders() || {};

  /**
   * One gate for every tool: credential → scope → rate limit → tool enabled check.
   * Returns the same shape as before, so callers keep reading `.ok` and `.error`.
   */
  function gate(name) {
    return security.authorizeCall(name, headers());
  }

  // ── tools ──────────────────────────────────────────────────────────────────

  server.tool(
    "search_tickets",
    "Search support tickets by status, requester, or keyword. Use this when a human asks to find or list tickets — not request(path, method). Empty results mean no tickets match those filters; do not retry the same call.",
    {
      status: z.enum(["open", "pending", "solved", "all"]).default("open").describe("Ticket status. Example: open"),
      requester_email: z.string().optional().describe("Real customer email. Example: ada@example.com"),
      query: z.string().optional().describe("Keyword against subject and body. Example: hostname"),
      limit: z.number().int().min(1).max(25).default(10).describe("Max rows. Default 10"),
    },
    async (params) => {
      const { status, requester_email, query, limit } = params;
      const allowed = gate("search_tickets");
      if (!allowed.ok) return denied(allowed);
      const rows = store.listTickets({ status, requester_email, query, limit });
      store.log({ tool: "search_tickets", count: rows.length, principal: allowed.principal.label });
      security.recordSuccess("search_tickets", allowed.principal, { status, query, limit });
      return json({
        ok: true,
        count: rows.length,
        tickets: rows,
        empty: rows.length === 0 ? "No tickets matched. Broaden status to 'all' or drop requester_email. Do not call this again with the same filters." : undefined,
      });
    },
  );

  server.tool(
    "create_ticket",
    "Open a support ticket on behalf of a customer. ALWAYS pass requester_email as the real customer. If you omit it the HTTP call still returns 201, but the service account owns the ticket and every email reply goes to the bot. A tool is not done when the API call succeeds — it is done when the next thing that happens is right.",
    {
      subject: z.string().describe("Short subject. Example: Cannot find the deployed MCP URL"),
      body: z.string().describe("What happened, in the customer's words"),
      requester_email: z.string().optional().describe("Real customer email. Example: ada@example.com. Omit this only to reproduce the attribution scar."),
    },
    async (params) => {
      const { subject, body, requester_email } = params;
      const allowed = gate("create_ticket");
      if (!allowed.ok) return denied(allowed);
      const { ticket, usedServiceAccount } = store.createTicket({ subject, body, requester_email });
      security.recordSuccess("create_ticket", allowed.principal, { subject, requester_email: requester_email || "(omitted)" });
      return json({
        ok: true,
        status: 201,
        created: true,
        ticket,
        warning: usedServiceAccount
          ? "201 Created. The requester is the API service account. The platform will mail every reply to the bot, not the customer."
          : undefined,
        next: usedServiceAccount
          ? "Call create_ticket again with requester_email set to the real customer so the downstream email thread routes correctly."
          : `Ticket ${ticket.id} is owned by ${ticket.requester_email}. Replies will reach the customer.`,
      });
    },
  );

  server.tool(
    "add_comment",
    "Add a comment to an existing ticket. Use after search_tickets or get_ticket. Author should be the person speaking, not the bot, unless you mean to comment as the service account.",
    {
      ticket_id: z.string().describe("Ticket id. Example: TCK-1001"),
      body: z.string().describe("Comment text"),
      author: z.string().optional().describe("Who is speaking. Example: ada@example.com"),
    },
    async (params) => {
      const { ticket_id, body, author } = params;
      const allowed = gate("add_comment");
      if (!allowed.ok) return denied(allowed);
      const ticket = store.addComment(ticket_id, { body, author });
      if (!ticket) {
        security.recordError("add_comment", allowed.principal, { ticket_id }, `Ticket ${ticket_id} does not exist`);
        return fail(`Ticket ${ticket_id} does not exist.`, { next: "Call search_tickets with status=all and pick a real id." });
      }
      security.recordSuccess("add_comment", allowed.principal, { ticket_id });
      return json({ ok: true, ticket });
    },
  );

  server.tool(
    "close_ticket",
    "Resolve and close a support ticket. Sets status to 'solved' and records resolved_at. Optionally appends a resolution note as the final comment. If the ticket is already closed this is a no-op — it returns the ticket unchanged with alreadyClosed=true. Use add_comment first if you want to explain the resolution before closing.",
    {
      ticket_id: z.string().describe("Ticket id. Example: TCK-1001"),
      resolution: z.string().optional().describe("Optional resolution note appended as the final comment. Example: 'Fixed by updating the cwd in mcp.json to use an absolute path.'"),
      closed_by: z.string().optional().describe("Who is closing. Example: support@example.com. Defaults to the service account."),
    },
    async (params) => {
      const { ticket_id, resolution, closed_by } = params;
      const allowed = gate("close_ticket");
      if (!allowed.ok) return denied(allowed);
      const result = store.closeTicket(ticket_id, { resolution, closed_by });
      if (!result) {
        security.recordError("close_ticket", allowed.principal, { ticket_id }, `Ticket ${ticket_id} does not exist`);
        return fail(`Ticket ${ticket_id} does not exist.`, { next: "Call search_tickets with status=all to find a valid id." });
      }
      security.recordSuccess("close_ticket", allowed.principal, { ticket_id });
      return json({
        ok: true,
        ticket: result.ticket,
        alreadyClosed: result.alreadyClosed,
        next: result.alreadyClosed
          ? `Ticket ${ticket_id} was already solved — no change made.`
          : `Ticket ${ticket_id} is now closed. resolved_at: ${result.ticket.resolved_at}.`,
      });
    },
  );

  server.tool(
    "get_ticket",
    "Fetch one ticket by id, including comments and attribution. Use when you already have a ticket id.",
    {
      ticket_id: z.string().describe("Ticket id. Example: TCK-1001"),
    },
    async (params) => {
      const { ticket_id } = params;
      const allowed = gate("get_ticket");
      if (!allowed.ok) return denied(allowed);
      const ticket = store.getTicket(ticket_id);
      if (!ticket) {
        security.recordError("get_ticket", allowed.principal, { ticket_id }, `Ticket ${ticket_id} does not exist`);
        return fail(`Ticket ${ticket_id} does not exist.`, { next: "Call search_tickets with status=all." });
      }
      security.recordSuccess("get_ticket", allowed.principal, { ticket_id });
      return json({ ok: true, ticket });
    },
  );

  server.tool(
    "list_schemas",
    "List queryable schemas. Use this BEFORE run_query. This is the replacement for a pile of query_* tools — discover the shape, then run one query tool.",
    {},
    async (params) => {
      const allowed = gate("list_schemas");
      if (!allowed.ok) return denied(allowed);
      security.recordSuccess("list_schemas", allowed.principal, {});
      return json({
        ok: true,
        schemas: Object.values(store.schemas).map(({ name, description }) => ({ name, description })),
        next: "Call get_schema with one name, then run_query.",
      });
    },
  );

  server.tool(
    "get_schema",
    "Describe one schema: fields and filterable keys. Use after list_schemas, before run_query.",
    {
      name: z.enum(["tickets", "customers", "assets"]).describe("Schema name from list_schemas"),
    },
    async (params) => {
      const { name } = params;
      const allowed = gate("get_schema");
      if (!allowed.ok) return denied(allowed);
      const schema = store.getSchema(name);
      if (!schema) {
        security.recordError("get_schema", allowed.principal, { name }, `No schema '${name}'`);
        return fail(`No schema '${name}'.`, { next: "Call list_schemas and use a name from that list." });
      }
      security.recordSuccess("get_schema", allowed.principal, { name });
      return json({ ok: true, schema });
    },
  );

  server.tool(
    "run_query",
    "Run one query against a discovered schema. Prefer this over inventing query_tickets, query_assets, or query_with_filter — those names are technically precise and operationally confusing.",
    {
      schema: z.enum(["tickets", "customers", "assets"]).describe("Schema from list_schemas"),
      filter: z.record(z.string()).optional().describe("Exact-match filters. Example: {\"status\":\"open\"}"),
      fields: z.array(z.string()).optional().describe("Optional field projection. Example: [\"id\",\"subject\"]"),
      limit: z.number().int().min(1).max(50).default(10),
    },
    async (params) => {
      const { schema, filter, fields, limit } = params;
      const allowed = gate("run_query");
      if (!allowed.ok) return denied(allowed);
      const result = store.runQuery({ schema, filter, fields, limit });
      if (result.error) {
        security.recordError("run_query", allowed.principal, { schema, filter }, result.error);
        return fail(result.error);
      }
      store.log({ tool: "run_query", schema, count: result.count, principal: allowed.principal.label });
      security.recordSuccess("run_query", allowed.principal, { schema, filter, limit });
      return json({
        ok: true,
        ...result,
        empty: result.count === 0 ? "No rows. Loosen the filter. Do not retry the identical query." : undefined,
      });
    },
  );

  server.tool(
    "lookup_customer",
    "Look up a customer record. Phone number is PII. When tool security is on, this requires the demo bearer token. When it is off, the phone is redacted so the laptop demo stays boring on purpose.",
    {
      email: z.string().describe("Customer email. Example: ada@example.com"),
    },
    async (params) => {
      const { email } = params;
      const allowed = gate("lookup_customer");
      if (!allowed.ok) return denied(allowed);
      // PII is only revealed to a caller that actually proved the pii scope.
      const reveal = allowed.authenticated && allowed.principal.scopes.includes("pii");
      const row = store.lookupCustomer(email, { reveal });
      if (!row) {
        security.recordError("lookup_customer", allowed.principal, { email }, `No customer ${email}`);
        return fail(`No customer ${email}.`, { next: "Try ada@example.com or sam@example.com." });
      }
      store.log({ tool: "lookup_customer", email, redacted: !reveal, principal: allowed.principal.label });
      security.recordSuccess("lookup_customer", allowed.principal, { email });
      return json({
        ok: true,
        customer: row,
        note: reveal
          ? `Phone is visible because ${allowed.principal.label} holds the "pii" scope.`
          : "Phone is redacted. Call this with an API key that has the \"pii\" scope (create one on /admin → API keys) to see the full record.",
      });
    },
  );

  server.tool(
    "describe_server",
    "Discover this server before you call anything else: identity, transport, auth mode, who the server thinks you are, which scopes you hold, your rate-limit budget, and every tool with the scope it needs and whether it is currently available. Call this first when a call was denied — it tells you exactly which credential is missing.",
    {},
    async (params) => {
      // Open in every mode, but still rate limited — that is what the gate returns here.
      const allowed = gate("describe_server");
      if (!allowed.ok) return denied(allowed);
      const snap = security.snapshot();
      const principal = allowed.principal;
      const rate = security.rateSnapshot(principal.id);
      security.recordSuccess("describe_server", allowed.principal, {});
      return json({
        ok: true,
        server: { name: "mcp-ticket-demo", version: "1.5.0", tool_count: TOOL_COUNT },
        you: {
          principal: principal.label,
          type: principal.type,
          authenticated: principal.type !== "anonymous" && principal.type !== "invalid",
          scopes: principal.grantedScopes || [],
          effective_scopes: principal.scopes || [],
          problem: principal.error,
        },
        auth: {
          mode: snap.authMode,
          modes: snap.authModes,
          meaning: {
            off: "no credential needed",
            write: "read tools open, write and PII tools require authentication",
            all: "every tool call requires authentication",
          }[snap.authMode],
          accepted: [
            "Authorization: Bearer <api key>",
            "Authorization: Basic base64(username:password)",
            "x-api-key: <api key>",
            "stdio: MCP_API_KEY or MCP_USERNAME + MCP_PASSWORD in the server env",
          ],
          active_api_keys: snap.activeKeyCount,
          tenant_header_required: snap.tenantRequired,
        },
        rate_limit: rate,
        tools: TOOL_CATALOG.map(([name, scope, purpose]) => ({
          name,
          required_scope: scope,
          credential_required_now: security.authRequiredFor(name),
          available: snap.toolGates[name] !== false,
          purpose,
        })),
        next: snap.authMode === "off"
          ? "Auth is off — every enabled tool is callable. Turn on write or all mode from /admin to see the gate."
          : "Call the tool you need. If it is denied, the error names the scope to ask for.",
      });
    },
  );

  return server;
}
