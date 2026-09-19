import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { VERSION } from "./version.js";

/** Return a successful tool response (structured JSON text). */
function json(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

/**
 * Return a tool error response.
 * isError:true tells spec-compliant clients (Copilot, Bob, Cursor) the call failed
 * without them needing to parse the JSON payload.
 */
function fail(message, extra = {}) {
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify({
      ok: false,
      error: message,
      next: extra.next || "Follow the error text. Call describe_server if you are unsure which tool or credential to use. Do not retry this exact call.",
      ...extra,
    }, null, 2) }],
  };
}

function denialPayload(result) {
  return {
    ok: false,
    error: result.error,
    status: result.status,
    denied: true,
    principal: result.principal?.label || "anonymous",
    retry_after_seconds: result.retryAfterSec,
    next: result.status === 429
      ? `Wait ${result.retryAfterSec || "the stated"} seconds, then retry once. Do not retry in a loop. Call describe_server to see your remaining rate-limit budget.`
      : result.status === 503
        ? "Call describe_server — it lists which tools are currently available. Do not retry this tool until an administrator enables it."
        : "Call describe_server to see the auth mode and the scopes you hold. Present a credential with the scope named in the error (Authorization: Bearer <api key> from /admin → API keys, or MCP_API_KEY over stdio), then retry this tool once.",
  };
}

/** Turn a denied gate result into a tool error the model can act on. */
function denied(result) {
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(denialPayload(result), null, 2) }],
  };
}

function resourceJson(uri, data) {
  return {
    contents: [{
      uri: uri.href,
      mimeType: "application/json",
      text: JSON.stringify(data, null, 2),
    }],
  };
}

function resourceDenied(result) {
  const payload = denialPayload(result);
  throw new McpError(ErrorCode.InvalidRequest, payload.error, payload);
}

/** Single source of truth for the tool inventory: name, required scope, one-line purpose. */
export const TOOL_CATALOG = [
  ["describe_server", "read", "Call first (and after any denial): identity, auth mode, your scopes, rate limit, and every tool"],
  ["search_tickets", "read", "Find tickets by status / requester / keyword. Default status is open; empty means no match, not a broken server"],
  ["create_ticket", "write", "Open a ticket. ALWAYS pass requester_email or the service account owns it"],
  ["add_comment", "write", "Comment on a real ticket_id from search_tickets or get_ticket"],
  ["close_ticket", "write", "Resolve a ticket (destructive, idempotent). Optional resolution note"],
  ["get_ticket", "read", "Fetch one known ticket id including comments and attribution"],
  ["list_schemas", "read", "List queryable schemas before run_query. There is no query_tickets tool"],
  ["get_schema", "read", "Fields and filterable keys for one schema. Call after list_schemas"],
  ["run_query", "read", "The one query tool. Pass schema from list_schemas — do not invent query_* tools"],
  ["lookup_customer", "pii", "Customer record by email. Phone is PII and stays redacted without the pii scope"],
];

export const TOOL_COUNT = TOOL_CATALOG.length;

/**
 * Server instructions — injected by MCP clients on connect.
 * The model reads this before its first tool call.
 */
const SERVER_INSTRUCTIONS = `\
You are connected to mcp-ticket-demo, a helpdesk ticketing server.

Rules:
1. Call describe_server first, and again after any denial — it tells you the current auth mode, which scopes you hold, and every available tool.
2. ALWAYS pass requester_email when calling create_ticket. Omitting it makes the service account the ticket owner and every reply goes to the bot, not the customer.
3. Empty search or query results mean no rows match — do not retry the same filters.
4. Write tools (create_ticket, add_comment, close_ticket) need a credential when auth mode is "write" or "all". Every error includes a next field; follow it once.
5. Use list_schemas → get_schema → run_query for data queries. Do not invent query_tickets, query_assets, or query_with_filter.
6. Tickets and schemas are also resources: call resources/list, then read ticket://TCK-1001, tickets://open, or schema://tickets. Resource reads use the same auth as the matching tool.`;

export function createMcpServer({ store, security, requestHeaders = () => ({}) }) {
  const server = new McpServer({
    name: "mcp-ticket-demo",
    version: VERSION,
    instructions: SERVER_INSTRUCTIONS,
  });

  const headers = () => requestHeaders() || {};

  /**
   * One gate for every tool: credential → scope → rate limit → tool enabled check.
   * Returns the same shape as before, so callers keep reading `.ok` and `.error`.
   */
  function gate(name) {
    return security.authorizeCall(name, headers());
  }

  // ── resources ──────────────────────────────────────────────────────────────
  // Addressable, pinnable data. resources/list enumerates instances so a
  // client can browse without already knowing the URI. Reads go through the
  // same gate() as the matching tool — ticket:// via get_ticket, tickets://open
  // via search_tickets, schema:// via get_schema.

  server.resource(
    "ticket",
    new ResourceTemplate("ticket://{id}", {
      list: async () => {
        const allowed = gate("search_tickets");
        if (!allowed.ok) return { resources: [] };
        return {
          resources: store.listTickets({ status: "all", limit: 25 }).map((ticket) => ({
            uri: `ticket://${ticket.id}`,
            name: ticket.id,
            description: `${ticket.status}: ${ticket.subject}`,
            mimeType: "application/json",
          })),
        };
      },
    }),
    async (uri, { id }) => {
      const allowed = gate("get_ticket");
      if (!allowed.ok) return resourceDenied(allowed);
      const ticket = store.getTicket(id);
      if (!ticket) {
        return resourceJson(uri, {
          ok: false,
          error: `Ticket ${id} not found.`,
          next: "Call search_tickets with status=all, or read tickets://open, then use a real ticket://TCK-#### URI. Do not invent an id.",
        });
      }
      return resourceJson(uri, ticket);
    },
  );

  server.resource(
    "tickets-open",
    new ResourceTemplate("tickets://open", {
      list: async () => {
        const allowed = gate("search_tickets");
        if (!allowed.ok) return { resources: [] };
        return {
          resources: [{
            uri: "tickets://open",
            name: "Open tickets",
            description: "Current open tickets (top 25). Same auth as search_tickets.",
            mimeType: "application/json",
          }],
        };
      },
    }),
    async (uri) => {
      const allowed = gate("search_tickets");
      if (!allowed.ok) return resourceDenied(allowed);
      const tickets = store.listTickets({ status: "open", limit: 25 });
      return resourceJson(uri, { count: tickets.length, tickets });
    },
  );

  server.resource(
    "schema",
    new ResourceTemplate("schema://{name}", {
      list: async () => {
        const allowed = gate("list_schemas");
        if (!allowed.ok) return { resources: [] };
        return {
          resources: Object.values(store.schemas).map((schema) => ({
            uri: `schema://${schema.name}`,
            name: schema.name,
            description: schema.description,
            mimeType: "application/json",
          })),
        };
      },
    }),
    async (uri, { name }) => {
      const allowed = gate("get_schema");
      if (!allowed.ok) return resourceDenied(allowed);
      const schema = store.getSchema(name);
      if (!schema) {
        return resourceJson(uri, {
          ok: false,
          error: `No schema '${name}'. Available: tickets, customers, assets.`,
          next: "Read schema://tickets, schema://customers, or schema://assets — or call list_schemas. Do not invent a schema name.",
        });
      }
      return resourceJson(uri, schema);
    },
  );

  // ── prompts ────────────────────────────────────────────────────────────────
  // User-facing prompts (prompts/list + prompts/get).
  // The user picks these; the model executes them. Each one teaches a talk lesson.

  server.prompt(
    "search-open-tickets",
    "Search open tickets, then tell me who owns each one and whether any are service-account scars.",
    () => ({
      messages: [{
        role: "user",
        content: { type: "text", text: "Search open tickets, then tell me who owns each one and whether any are service-account scars (attribution=service_account)." },
      }],
    }),
  );

  server.prompt(
    "attribution-scar",
    "Demonstrate the attribution scar: create a ticket without requester_email, then explain what went wrong.",
    () => ({
      messages: [{
        role: "user",
        content: { type: "text", text: 'Create a support ticket with subject "Demo scar" and body "Testing attribution." Do NOT pass requester_email. Then get the ticket and tell me who owns it and why that is a problem.' },
      }],
    }),
  );

  server.prompt(
    "schema-discovery",
    "Demonstrate schema discovery: list_schemas → get_schema → run_query instead of inventing query_* tools.",
    () => ({
      messages: [{
        role: "user",
        content: { type: "text", text: "List all queryable schemas, get the full shape of the tickets schema, then run a query for open tickets. Show me each step." },
      }],
    }),
  );

  server.prompt(
    "close-ticket-flow",
    "Find an open ticket, add a resolution comment, then close it.",
    { ticket_id: z.string().optional().describe("Specific ticket id. If omitted, find the first open ticket.") },
    ({ ticket_id }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: ticket_id
            ? `Add a comment to ticket ${ticket_id} saying "Resolved — closing now." then close it with that as the resolution.`
            : "Find the first open ticket, add a comment saying \"Resolved — closing now.\" then close it with that as the resolution.",
        },
      }],
    }),
  );

  server.prompt(
    "diagnose-server",
    "Call describe_server and explain the current auth mode, available tools, and any denied scopes.",
    () => ({
      messages: [{
        role: "user",
        content: { type: "text", text: "Call describe_server and tell me: what is the current auth mode, which tools are available, which require a credential right now, and what scopes do I currently hold?" },
      }],
    }),
  );

  // ── tools ──────────────────────────────────────────────────────────────────

  server.tool(
    "search_tickets",
    "Find support tickets by status, requester email, or a keyword in subject/body. Use this when someone asks to list, find, or search tickets. Default status is open — an empty list means no match for those filters, not that the server is empty; broaden to status=all or drop requester_email. Do not retry the same filters. To fetch one known id use get_ticket or read ticket://TCK-1001. Do not invent query_tickets or a generic HTTP request tool.",
    {
      status: z.enum(["open", "pending", "solved", "all"]).default("open").describe("Lifecycle filter. Default open. Use all if a search comes back empty."),
      requester_email: z.string().optional().describe("Optional exact customer email, e.g. ada@example.com. Combine with status=all if you are unsure the ticket is still open."),
      query: z.string().optional().describe("Optional keyword matched against subject and body, e.g. hostname or mcp.json."),
      limit: z.number().int().min(1).max(25).default(10).describe("Max rows to return. Default 10, max 25."),
    },
    { readOnlyHint: true, openWorldHint: false },
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
        empty: rows.length === 0 ? "No tickets matched these filters." : undefined,
        next: rows.length === 0
          ? "Broaden status to all, drop requester_email, or try a different query keyword. Do not call search_tickets again with the same filters."
          : undefined,
      });
    },
  );

  server.tool(
    "create_ticket",
    "Open a support ticket on behalf of a customer. ALWAYS pass requester_email as the real customer email. If you omit it the call still succeeds (201) but the service account owns the ticket and every reply is mailed to the bot, not the customer — that is the attribution scar. A tool is not done when the API call succeeds; it is done when the next thing that happens is right. This is a write tool and may require a credential.",
    {
      subject: z.string().describe("Required. Short customer-facing subject, e.g. Cannot find the deployed MCP URL."),
      body: z.string().describe("Required. What happened, in the customer's words."),
      requester_email: z.string().optional().describe("The real customer's email, e.g. ada@example.com. Omit ONLY to reproduce the attribution scar."),
    },
    { destructiveHint: false, idempotentHint: false, openWorldHint: false },
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
    "Add a comment to an existing ticket. You need a real ticket_id from search_tickets or get_ticket — do not invent TCK- ids. Pass author as the human speaking; omitting it attributes the comment to the service account. This is a write tool and may require a credential. To resolve the ticket after commenting, call close_ticket.",
    {
      ticket_id: z.string().describe("Existing ticket id from search_tickets or get_ticket. Format: TCK-1001. Do not invent an id."),
      body: z.string().describe("The comment text the human wants on the ticket."),
      author: z.string().optional().describe("Email of the person speaking, e.g. ada@example.com. Omit only if you intend to comment as the service account."),
    },
    { destructiveHint: false, idempotentHint: false, openWorldHint: false },
    async (params) => {
      const { ticket_id, body, author } = params;
      const allowed = gate("add_comment");
      if (!allowed.ok) return denied(allowed);
      const ticket = store.addComment(ticket_id, { body, author });
      if (!ticket) {
        security.recordError("add_comment", allowed.principal, { ticket_id }, `Ticket ${ticket_id} does not exist`);
        return fail(`Ticket ${ticket_id} does not exist.`, {
          next: "Call search_tickets with status=all (or a keyword from the subject) and use an id from that list. Do not invent a TCK- id.",
        });
      }
      security.recordSuccess("add_comment", allowed.principal, { ticket_id });
      return json({
        ok: true,
        ticket,
        next: `Comment added on ${ticket.id}. Call get_ticket to reread the thread, or close_ticket if this resolves it.`,
      });
    },
  );

  server.tool(
    "close_ticket",
    "Resolve and close a support ticket (destructive, idempotent). Sets status to solved and records resolved_at. Optionally appends resolution as the final comment. If the ticket is already solved this is a no-op and returns alreadyClosed=true — do not retry. Use a real ticket_id from search_tickets or get_ticket. Use add_comment first if you want a longer explanation before closing. This is a write tool and may require a credential.",
    {
      ticket_id: z.string().describe("Existing ticket id from search_tickets or get_ticket. Format: TCK-1001. Do not invent an id."),
      resolution: z.string().optional().describe("Optional note appended as the final comment, e.g. Fixed by using an absolute cwd in mcp.json."),
      closed_by: z.string().optional().describe("Who is closing, e.g. support@example.com. Defaults to the service account."),
    },
    { destructiveHint: true, idempotentHint: true, openWorldHint: false },
    async (params) => {
      const { ticket_id, resolution, closed_by } = params;
      const allowed = gate("close_ticket");
      if (!allowed.ok) return denied(allowed);
      const result = store.closeTicket(ticket_id, { resolution, closed_by });
      if (!result) {
        security.recordError("close_ticket", allowed.principal, { ticket_id }, `Ticket ${ticket_id} does not exist`);
        return fail(`Ticket ${ticket_id} does not exist.`, {
          next: "Call search_tickets with status=all (or a keyword from the subject) and use an id from that list. Do not invent a TCK- id.",
        });
      }
      security.recordSuccess("close_ticket", allowed.principal, { ticket_id });
      return json({
        ok: true,
        ticket: result.ticket,
        alreadyClosed: result.alreadyClosed,
        next: result.alreadyClosed
          ? `Ticket ${ticket_id} was already solved — no change made. Do not call close_ticket again for this id.`
          : `Ticket ${ticket_id} is now solved. resolved_at: ${result.ticket.resolved_at}.`,
      });
    },
  );

  server.tool(
    "get_ticket",
    "Fetch one ticket by id, including comments and attribution (customer vs service_account). Use when you already have a ticket_id like TCK-1001. If you do not have an id, call search_tickets first — a missing id is not a reason to invent one. Same data is also at ticket://TCK-1001.",
    {
      ticket_id: z.string().describe("Existing ticket id from search_tickets. Format: TCK-1001. Do not invent an id."),
    },
    { readOnlyHint: true, openWorldHint: false },
    async (params) => {
      const { ticket_id } = params;
      const allowed = gate("get_ticket");
      if (!allowed.ok) return denied(allowed);
      const ticket = store.getTicket(ticket_id);
      if (!ticket) {
        security.recordError("get_ticket", allowed.principal, { ticket_id }, `Ticket ${ticket_id} does not exist`);
        return fail(`Ticket ${ticket_id} does not exist.`, {
          next: "Call search_tickets with status=all (or a keyword from the subject) and use an id from that list. Do not invent a TCK- id.",
        });
      }
      security.recordSuccess("get_ticket", allowed.principal, { ticket_id });
      return json({
        ok: true,
        ticket,
        next: ticket.attribution === "service_account"
          ? `Ticket ${ticket.id} is a service-account scar — replies will go to the bot. Tell the human. Use add_comment or close_ticket if they still want to act on it.`
          : `Ticket ${ticket.id} is owned by ${ticket.requester_email}. Use add_comment to reply or close_ticket to resolve it.`,
      });
    },
  );

  server.tool(
    "list_schemas",
    "List the queryable schemas on this server (tickets, customers, assets). Call this BEFORE run_query. There is no query_tickets, query_assets, or query_with_filter tool — discover the shape here, then get_schema, then run_query. Same list is also at schema://{name} after resources/list.",
    {},
    { readOnlyHint: true, openWorldHint: false },
    async () => {
      const allowed = gate("list_schemas");
      if (!allowed.ok) return denied(allowed);
      security.recordSuccess("list_schemas", allowed.principal, {});
      return json({
        ok: true,
        schemas: Object.values(store.schemas).map(({ name, description }) => ({ name, description })),
        next: "Call get_schema with one name from this list (tickets, customers, or assets), then run_query. Do not invent a query_* tool.",
      });
    },
  );

  server.tool(
    "get_schema",
    "Return fields and filterable keys for one schema. Call after list_schemas and before run_query so you know which filter keys are valid. name must be tickets, customers, or assets.",
    {
      name: z.enum(["tickets", "customers", "assets"]).describe("Schema name from list_schemas: tickets, customers, or assets."),
    },
    { readOnlyHint: true, openWorldHint: false },
    async (params) => {
      const { name } = params;
      const allowed = gate("get_schema");
      if (!allowed.ok) return denied(allowed);
      const schema = store.getSchema(name);
      if (!schema) {
        security.recordError("get_schema", allowed.principal, { name }, `No schema '${name}'`);
        return fail(`No schema '${name}'.`, {
          next: "Call list_schemas and use a name from that list (tickets, customers, or assets). Do not invent a schema name.",
        });
      }
      security.recordSuccess("get_schema", allowed.principal, { name });
      return json({
        ok: true,
        schema,
        next: `Call run_query with schema=${name}. Only filter with keys from filterable: ${schema.filterable.join(", ")}.`,
      });
    },
  );

  server.tool(
    "run_query",
    "Run one exact-match query against a schema from list_schemas. Pass schema plus optional filter (keys from get_schema.filterable) and fields. This is the only query tool — do not invent query_tickets, query_assets, or query_with_filter. Empty rows mean no match; loosen the filter, do not retry the identical query.",
    {
      schema: z.enum(["tickets", "customers", "assets"]).describe("One of tickets, customers, assets — from list_schemas. Do not invent a name."),
      filter: z.record(z.string()).optional().describe("Optional exact-match map. Keys must be listed in get_schema.filterable. Example: {\"status\":\"open\"}."),
      fields: z.array(z.string()).optional().describe("Optional field projection. Example: [\"id\",\"subject\"]. Omit to return all fields."),
      limit: z.number().int().min(1).max(50).default(10).describe("Max rows to return. Default 10, max 50."),
    },
    { readOnlyHint: true, openWorldHint: false },
    async (params) => {
      const { schema, filter, fields, limit } = params;
      const allowed = gate("run_query");
      if (!allowed.ok) return denied(allowed);
      const result = store.runQuery({ schema, filter, fields, limit });
      if (result.error) {
        security.recordError("run_query", allowed.principal, { schema, filter }, result.error);
        return fail(result.error, {
          next: "Call list_schemas, then get_schema with a name from that list, then run_query. Do not invent a query_* tool.",
        });
      }
      store.log({ tool: "run_query", schema, count: result.count, principal: allowed.principal.label });
      security.recordSuccess("run_query", allowed.principal, { schema, filter, limit });
      return json({
        ok: true,
        ...result,
        empty: result.count === 0 ? "No rows matched this filter." : undefined,
        next: result.count === 0
          ? "Loosen or drop the filter. Do not retry the identical run_query. Call get_schema if you are unsure which keys are filterable."
          : undefined,
      });
    },
  );

  server.tool(
    "lookup_customer",
    "Look up one customer by email (plan, region, contact). Use this for customer records, not tickets — tickets use search_tickets. Phone is PII: it stays REDACTED unless the caller presents a credential with the pii scope. Known demo emails: ada@example.com, sam@example.com. Do not invent other addresses and retry.",
    {
      email: z.string().describe("Customer email. Demo records: ada@example.com, sam@example.com."),
    },
    { readOnlyHint: true, openWorldHint: false },
    async (params) => {
      const { email } = params;
      const allowed = gate("lookup_customer");
      if (!allowed.ok) return denied(allowed);
      // PII is only revealed to a caller that actually proved the pii scope.
      const reveal = allowed.authenticated && allowed.principal.scopes.includes("pii");
      const row = store.lookupCustomer(email, { reveal });
      if (!row) {
        security.recordError("lookup_customer", allowed.principal, { email }, `No customer ${email}`);
        return fail(`No customer record for ${email}.`, {
          next: "Use a known demo email: ada@example.com or sam@example.com. Do not retry this address.",
        });
      }
      store.log({ tool: "lookup_customer", email, redacted: !reveal, principal: allowed.principal.label });
      security.recordSuccess("lookup_customer", allowed.principal, { email });
      return json({
        ok: true,
        customer: row,
        note: reveal
          ? `Phone is visible because ${allowed.principal.label} holds the "pii" scope.`
          : "Phone is REDACTED. Present an API key with the pii scope (create one on /admin → API keys) and call lookup_customer again to see the full record.",
        next: reveal
          ? undefined
          : "If the human needs the phone number, obtain a pii-scoped API key and retry once. Do not guess the number.",
      });
    },
  );

  server.tool(
    "describe_server",
    "Call this first, and again after any denial or empty tool list: server identity, auth mode, who the server thinks you are, the scopes you hold, your rate-limit budget, and every tool with the scope it needs and whether it is currently available. Discovery stays open in every auth mode. When a call was denied, this tells you which credential is missing — do not guess.",
    {},
    { readOnlyHint: true, openWorldHint: false },
    async () => {
      // Open in every mode, but still rate limited — that is what the gate returns here.
      const allowed = gate("describe_server");
      if (!allowed.ok) return denied(allowed);
      const snap = security.snapshot();
      const principal = allowed.principal;
      const rate = security.rateSnapshot(principal.id);
      security.recordSuccess("describe_server", allowed.principal, {});
      return json({
        ok: true,
        server: { name: "mcp-ticket-demo", version: VERSION, tool_count: TOOL_COUNT },
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
        resources: [
          { uri: "ticket://{id}", description: "One ticket by id. Same auth as get_ticket. Example: ticket://TCK-1001" },
          { uri: "tickets://open",  description: "Current open ticket list (top 25). Same auth as search_tickets" },
          { uri: "schema://{name}", description: "Query schema. Same auth as get_schema. Example: schema://tickets" },
        ],
        prompts: [
          "search-open-tickets",
          "attribution-scar",
          "schema-discovery",
          "close-ticket-flow",
          "diagnose-server",
        ],
        next: snap.authMode === "off"
          ? "Auth is off — every enabled tool is callable. If you need to act, start with the tool that matches the human request. After a denial, call describe_server again."
          : "Call the tool that matches the human request. If it is denied, the error names the missing scope and how to get a key — follow next once, do not guess another tool name.",
      });
    },
  );

  return server;
}
