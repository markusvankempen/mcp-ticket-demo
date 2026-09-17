import { createStore } from "./store.js";

const store = createStore();
const { ticket, usedServiceAccount } = store.createTicket({
  subject: "cli smoke",
  body: "relative package root",
  requester_email: "ada@example.com",
});
if (usedServiceAccount || !ticket) {
  console.error("create_ticket smoke failed");
  process.exit(1);
}
const rows = store.listTickets({ query: "cli smoke", status: "all" });
if (!rows.length) {
  console.error("search_tickets smoke failed");
  process.exit(1);
}
console.log(`ok ${ticket.id} ${rows.length} ticket(s)`);
