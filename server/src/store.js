/** In-memory ticket store. Enough to teach the lessons; not a product. */

export const SERVICE_ACCOUNT = "mcp-bot@service.local";

const now = () => new Date().toISOString();

function seed() {
  return [
    {
      id: "TCK-1001",
      subject: "0 tools discovered after I registered the server",
      body: "The orchestrator is in a cloud container. I handed it /Users/me/my-mcp/index.js.",
      status: "open",
      requester_email: "ada@example.com",
      attribution: "customer",
      comments: [{ author: "ada@example.com", body: "No error. No warning. Just an empty tool list.", at: now() }],
      created_at: now(),
    },
    {
      id: "TCK-1002",
      subject: "Customer never got the reply — ticket looks fine in the API",
      body: "create_ticket returned 201. The requester is the API service account.",
      status: "pending",
      requester_email: SERVICE_ACCOUNT,
      attribution: "service_account",
      comments: [{ author: SERVICE_ACCOUNT, body: "Every reply is mailing the bot.", at: now() }],
      created_at: now(),
    },
    {
      id: "TCK-1003",
      subject: "mcp.json worked yesterday, 404 today",
      body: "The managed platform assigned a new hostname after I created a new project.",
      status: "solved",
      requester_email: "sam@example.com",
      attribution: "customer",
      comments: [{ author: "sam@example.com", body: "Never paste a URL you can't resolve after deploy.", at: now() }],
      created_at: now(),
    },
  ];
}

const SCHEMAS = {
  tickets: {
    name: "tickets",
    description: "Support tickets. Use run_query with schema=tickets — do not invent query_tickets / query_with_filter tools.",
    fields: ["id", "subject", "status", "requester_email", "attribution", "created_at"],
    filterable: ["status", "requester_email", "attribution"],
  },
  customers: {
    name: "customers",
    description: "Customer directory. Email is the join key to tickets.requester_email.",
    fields: ["email", "name", "plan", "region"],
    filterable: ["email", "region"],
  },
  assets: {
    name: "assets",
    description: "Demo assets. Same query tool as tickets — this is the 'one query tool plus schema discovery' lesson.",
    fields: ["id", "name", "site", "status"],
    filterable: ["status", "site"],
  },
};

const CUSTOMERS = [
  { email: "ada@example.com", name: "Ada Example", plan: "enterprise", region: "ca-tor", phone: "+1-416-555-0100" },
  { email: "sam@example.com", name: "Sam Example", plan: "team", region: "us-south", phone: "+1-512-555-0199" },
];

const ASSETS = [
  { id: "AST-1", name: "Toronto lab rack", site: "yyz", status: "online" },
  { id: "AST-2", name: "Spare projector", site: "yyz", status: "spare" },
];

export function createStore() {
  const tickets = seed();
  let seq = 1004;
  const audit = [];

  function log(event) {
    audit.unshift({ at: now(), ...event });
    if (audit.length > 200) audit.pop();
  }

  return {
    SERVICE_ACCOUNT,
    schemas: SCHEMAS,
    audit: () => audit.slice(0, 100),
    log,

    listTickets({ status = "open", requester_email, query, limit = 10 } = {}) {
      let rows = tickets.slice();
      if (status && status !== "all") rows = rows.filter((t) => t.status === status);
      if (requester_email) rows = rows.filter((t) => t.requester_email === requester_email);
      if (query) {
        const q = query.toLowerCase();
        rows = rows.filter((t) => `${t.subject} ${t.body}`.toLowerCase().includes(q));
      }
      return rows.slice(0, limit);
    },

    getTicket(id) {
      return tickets.find((t) => t.id === id) || null;
    },

    createTicket({ subject, body, requester_email }) {
      const usedServiceAccount = !requester_email;
      const ticket = {
        id: `TCK-${seq++}`,
        subject,
        body,
        status: "open",
        requester_email: requester_email || SERVICE_ACCOUNT,
        attribution: usedServiceAccount ? "service_account" : "customer",
        comments: [],
        created_at: now(),
      };
      tickets.unshift(ticket);
      log({
        tool: "create_ticket",
        ticket: ticket.id,
        attribution: ticket.attribution,
        outcome: usedServiceAccount ? "201 but wrong owner" : "201 and customer owns it",
      });
      return { ticket, usedServiceAccount };
    },

    addComment(id, { author, body }) {
      const ticket = tickets.find((t) => t.id === id);
      if (!ticket) return null;
      const comment = { author: author || SERVICE_ACCOUNT, body, at: now() };
      ticket.comments.push(comment);
      log({ tool: "add_comment", ticket: id });
      return ticket;
    },

    getSchema(name) {
      return SCHEMAS[name] || null;
    },

    runQuery({ schema, filter = {}, fields, limit = 10 }) {
      const def = SCHEMAS[schema];
      if (!def) {
        return {
          error: `Unknown schema '${schema}'. Call list_schemas, then get_schema, then run_query. Do not invent a query_${schema} tool.`,
        };
      }
      let rows;
      if (schema === "tickets") rows = tickets.map(({ comments, ...rest }) => rest);
      else if (schema === "customers") rows = CUSTOMERS.map(({ phone, ...rest }) => rest);
      else rows = ASSETS.slice();

      for (const [key, value] of Object.entries(filter || {})) {
        if (value === undefined || value === null || value === "") continue;
        rows = rows.filter((row) => String(row[key]) === String(value));
      }
      if (fields && fields.length) {
        rows = rows.map((row) => {
          const slim = {};
          for (const f of fields) if (f in row) slim[f] = row[f];
          return slim;
        });
      }
      return { schema, count: rows.length, rows: rows.slice(0, limit) };
    },

    lookupCustomer(email, { reveal } = {}) {
      const row = CUSTOMERS.find((c) => c.email === email);
      if (!row) return null;
      if (!reveal) return { email: row.email, name: row.name, plan: row.plan, region: row.region, phone: "REDACTED" };
      return row;
    },
  };
}
