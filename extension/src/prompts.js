const PROMPTS = [
  {
    id: "search",
    title: "Search open tickets",
    text: "Search open tickets, then tell me who owns each one.",
  },
  {
    id: "no-requester",
    title: "create_ticket without requester",
    text: "Create a ticket with subject 'Need the remote URL' and body 'demo' — do not pass requester_email. Then tell me who owns it.",
  },
  {
    id: "with-requester",
    title: "create_ticket with requester",
    text: "Create a ticket for ada@example.com about a missing hostname. Then search tickets owned by ada@example.com.",
  },
  {
    id: "query",
    title: "list_schemas → run_query",
    text: "List schemas, get the tickets schema, then run_query on tickets filtered to status=open.",
  },
  {
    id: "close",
    title: "close_ticket",
    text: "Search open tickets, pick one, then close_ticket with a short resolution note. Tell me the new status and resolved_at.",
  },
  {
    id: "zero-tools",
    title: "0 tools discovered",
    text: "If tools/list is empty, tell me why — cwd, MCP_MODE, native stdio vs Podman vs Code Engine — and what to try next. Do not retry the same failing call.",
  },
];

module.exports = { PROMPTS };
