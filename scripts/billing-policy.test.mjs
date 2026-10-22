import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import Stripe from "stripe";
const compiled = ts.transpile(
  readFileSync(new URL("../src/lib/billing-policy.ts", import.meta.url), "utf8"),
  { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
);
const { entitledPlan, LIVE_PRICES } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);
test("only current active/trialing recognized subscriptions grant access", () => {
  const end = new Date(Date.now() + 86400000).toISOString();
  const row = { plan: "studio", status: "active", period_end: end };
  assert.equal(entitledPlan([row]), "studio");
  assert.equal(entitledPlan([{ ...row, plan: "pro" }]), "pro");
  for (const status of ["past_due", "unpaid", "incomplete", "canceled", "paused"])
    assert.equal(entitledPlan([{ ...row, status }]), "free");
  assert.equal(entitledPlan([{ ...row, period_end: new Date(0) }]), "free");
  assert.equal(entitledPlan([{ ...row, plan: "other" }]), "free");
  assert.equal(entitledPlan([]), "free");
  assert.notEqual(LIVE_PRICES.pro, LIVE_PRICES.studio);
});
test("Stripe signatures require original body, current timestamp and correct signing secret", () => {
  const stripe = new Stripe("sk_test_fixture");
  const body = JSON.stringify({ id: "evt_test", object: "event" }),
    secret = "whsec_fixture";
  const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret });
  assert.equal(stripe.webhooks.constructEvent(body, signature, secret).id, "evt_test");
  assert.throws(() => stripe.webhooks.constructEvent(body + " ", signature, secret));
  assert.throws(() => stripe.webhooks.constructEvent(body, signature, "whsec_wrong"));
  const stale = stripe.webhooks.generateTestHeaderString({ payload: body, secret, timestamp: 1 });
  assert.throws(() => stripe.webhooks.constructEvent(body, stale, secret));
});
