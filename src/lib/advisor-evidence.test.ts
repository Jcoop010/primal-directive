import test from "node:test";
import assert from "node:assert/strict";
import { evidenceSupportedLeads } from "./advisor-evidence.ts";

test("rejects a lead without its own returned citation", () => {
  const leads = [
    { reason: "Booking contact at a venue", name: "Unverified" },
    { reason: "Venue listing: https://venue.example/events", name: "Supported" },
    { reason: "Found at https://invented.example/contact", name: "Invented URL" },
  ];
  assert.deepEqual(evidenceSupportedLeads(leads, ["https://venue.example/events"]).map(x => x.name), ["Supported"]);
});
test("rejects all structured leads when provider returns no citations", () => {
  assert.deepEqual(evidenceSupportedLeads([{ reason: "https://venue.example/events" }], []), []);
});
