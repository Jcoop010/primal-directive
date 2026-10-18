import assert from "node:assert/strict";
import test from "node:test";
import { buildDailyBriefing } from "./daily-briefing.ts";
import type { Gig, OperationalTask, MoneyEntry, MerchProduct } from "./types.ts";

const today = "2026-10-15";
const gig: Gig = { id: "gig1", name: "Fall Show", venue: "The Room", city: "Parkersburg", date: "2026-10-20", fee: 500, conf: 1, status: "booked", notes: "" };
const task: OperationalTask = { id: "t1", title: "Confirm load in", description: "", category: "advancing", gigId: "gig1", dueDate: "2026-10-14", status: "open", sourceKey: "test", createdAt: today };
const money: MoneyEntry = { id: "m1", type: "outstanding", amount: 250, label: "Deposit", date: today };
const merch: MerchProduct = { id: "p1", name: "Shirt", sku: "s", category: "apparel", price: 25, unitCost: 10, stockOnHand: 2, reorderAt: 3, active: true };
test("briefing prioritizes overdue work and includes actionable workspace signals", () => {
  const result = buildDailyBriefing({ gigs: [gig], tasks: [task], money: [money], merchProducts: [merch] }, today);
  assert.equal(result[0].id, "overdue");
  assert.ok(result.some((item) => item.id === "collections" && item.href === "/money"));
  assert.ok(result.some((item) => item.id === "merch" && item.href === "/merch"));
  assert.ok(result.some((item) => item.id === "next-show" && item.href === "/tasks"));
});
test("completed tasks and inactive products do not generate false alerts", () => {
  const result = buildDailyBriefing({ gigs: [], tasks: [{ ...task, status: "done" }], money: [], merchProducts: [{ ...merch, active: false }] }, today);
  assert.deepEqual(result.map((item) => item.id), ["ready"]);
});
test("undated opportunities do not appear as upcoming booked shows", () => {
  const result = buildDailyBriefing({ gigs: [{ ...gig, date: "" }], tasks: [], money: [], merchProducts: [] }, today);
  assert.deepEqual(result.map((item) => item.id), ["ready"]);
});

test("briefing surfaces replies, negotiations and holds without reopening closed deals", () => {
  const result = buildDailyBriefing({ gigs: [{ ...gig, id: "reply", status: "responded" }, { ...gig, id: "negotiation", status: "negotiating" }, { ...gig, id: "hold", status: "hold" }, { ...gig, id: "canceled", status: "canceled", outreachNextFollowUp: "2020-01-01" }], tasks: [], money: [], merchProducts: [] }, today);
  for (const id of ["booking-replies", "booking-negotiations", "booking-holds"]) assert.ok(result.some(item => item.id === id));
  assert.equal(result.some(item => item.id === "booking-followups"), false);
});
