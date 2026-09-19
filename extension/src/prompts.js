const PROMPTS = [
  // Demo 3 — Discover the server
  {
    id: "describe",
    title: "Discover the server",
    text: "Call describe_server. Tell me the auth mode, my scopes, rate-limit budget, and which tools need a credential.",
  },
  // Demo 4 — Search tickets
  {
    id: "search",
    title: "Search open tickets",
    text: "Search open tickets, then tell me who owns each one.",
  },
  // Demo 5A — Attribution scar (without requester_email)
  {
    id: "no-requester",
    title: "create_ticket without requester",
    text: "Create a ticket with subject 'Need the remote URL' and body 'demo' — do not pass requester_email. Then tell me who owns it.",
  },
  // Demo 5B — Correct attribution (with requester_email)
  {
    id: "with-requester",
    title: "create_ticket with requester",
    text: "Create a ticket for ada@example.com about a missing hostname. Then search tickets owned by ada@example.com.",
  },
  // Demo 6 — Comment on a ticket
  {
    id: "comment",
    title: "add_comment on a ticket",
    text: "Search open tickets, pick one, then add a comment as support@example.com explaining what you found. Show me the updated comment thread.",
  },
  // Demo 7 — Close a ticket
  {
    id: "close",
    title: "close_ticket",
    text: "Search open tickets, pick one, then close_ticket with a short resolution note. Tell me the new status and resolved_at.",
  },
  // Demo 8 — Schema discovery
  {
    id: "query",
    title: "list_schemas → run_query",
    text: "List schemas, get the tickets schema, then run_query on tickets filtered to status=open.",
  },
  // Demo 9 — PII gating
  {
    id: "pii",
    title: "PII gating on lookup_customer",
    text: "Look up the customer record for ada@example.com. Is the phone number visible? Explain why or why not, and what credential would be needed to see it.",
  },
  // Demo 10 — Auth modes
  {
    id: "auth",
    title: "Auth modes & scopes",
    text: "Call describe_server and tell me the current auth mode, which tools are locked, and what scope each write tool requires.",
  },
  // Demo 11 — 0 tools discovered
  {
    id: "zero-tools",
    title: "0 tools discovered",
    text: "If tools/list is empty, tell me why — cwd, MCP_MODE, native stdio vs Podman vs Code Engine — and what to try next. Do not retry the same failing call.",
  },
];

module.exports = { PROMPTS };
