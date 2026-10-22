import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
const compile = (s) =>
  "data:text/javascript;base64," +
  Buffer.from(
    ts.transpile(s, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }),
  ).toString("base64");
const policy = compile(
  readFileSync(new URL("../src/lib/billing-policy.ts", import.meta.url), "utf8"),
);
const stripePath = pathToFileURL(createRequire(import.meta.url).resolve("stripe")).href;
const source = readFileSync(new URL("../src/lib/billing.server.ts", import.meta.url), "utf8")
  .replace('from "stripe"', `from "${stripePath}"`)
  .replace(
    'import { getSql } from "./db";',
    "const getSql = async () => globalThis.__pdBillingSql;",
  )
  .replace('from "./billing-policy"', `from "${policy}"`);
const { applyStripeEvent, subscriptionState } = await import(compile(source));
test("billing webhook reconciliation is atomic, idempotent, account-scoped and follows authoritative subscription state", async () => {
  const db = new PGlite();
  const old = { ...process.env };
  process.env.STRIPE_SECRET_KEY = "sk_test_fixture";
  process.env.STRIPE_TEST_PRO_PRICE_ID = "price_test_pro";
  process.env.STRIPE_TEST_STUDIO_PRICE_ID = "price_test_studio";
  const sqlFor = (client) => ({
    query: async (text, params = []) => (await client.query(text, params)).rows,
    transaction: (work) => db.transaction((tx) => work(sqlFor(tx))),
  });
  globalThis.__pdBillingSql = sqlFor(db);
  try {
    await db.exec(readFileSync(new URL("../migrations/0001_auth.sql", import.meta.url), "utf8"));
    await db.exec(readFileSync(new URL("../migrations/0006_billing.sql", import.meta.url), "utf8"));
    await db.exec(
      `insert into "user"(id,name,email,"emailVerified") values('artist-a','A','a@example.invalid',true),('artist-b','B','b@example.invalid',true);insert into pd_billing_customers(user_id,customer_id,livemode) values('artist-a','cus_a',false),('artist-b','cus_b',false)`,
    );
    let status = "active",
      price = "price_test_pro",
      calls = 0,
      actualCustomer = "cus_a";
    const provider = {
      subscriptions: {
        retrieve: async () => {
          calls++;
          return {
            id: "sub_a",
            customer: actualCustomer,
            status,
            cancel_at_period_end: false,
            items: {
              data: [
                { price: { id: price }, current_period_end: Math.floor(Date.now() / 1000) + 86400 },
              ],
            },
          };
        },
      },
    };
    const event = (id, created = 1, customer = "cus_a") => ({
      id,
      type: "customer.subscription.updated",
      livemode: false,
      created,
      data: { object: { id: "sub_a", customer } },
    });
    await applyStripeEvent(event("evt_1"), provider);
    assert.equal((await subscriptionState("artist-a")).plan, "pro");
    assert.equal((await subscriptionState("artist-b")).plan, "free");
    await applyStripeEvent(event("evt_1"), provider);
    assert.equal(calls, 1);
    price = "price_test_studio";
    await applyStripeEvent(event("evt_2", 2), provider);
    assert.equal((await subscriptionState("artist-a")).plan, "studio");
    status = "past_due";
    await applyStripeEvent(event("evt_3", 3), provider);
    assert.equal((await subscriptionState("artist-a")).plan, "free");
    status = "active";
    await applyStripeEvent(event("evt_4", 4), provider);
    assert.equal((await subscriptionState("artist-a")).plan, "studio");
    status = "canceled";
    await applyStripeEvent(event("evt_5", 5), provider);
    assert.equal((await subscriptionState("artist-a")).plan, "free");
    status = "active";
    await applyStripeEvent(event("evt_old", 1), provider);
    assert.equal((await subscriptionState("artist-a")).plan, "free");
    actualCustomer = "cus_b";
    await assert.rejects(
      () => applyStripeEvent(event("evt_bad", 6), provider),
      /ownership mismatch/,
    );
    assert.equal(
      (await db.query("select event_id from pd_stripe_events where event_id='evt_bad'")).rows
        .length,
      0,
    );
    const before = calls;
    await applyStripeEvent(event("evt_unrelated", 7, "cus_other_product"), provider);
    assert.equal(calls, before);
    await assert.rejects(
      () => applyStripeEvent({ ...event("evt_live"), livemode: true }, provider),
      /environment mismatch/,
    );
  } finally {
    delete globalThis.__pdBillingSql;
    process.env = old;
    await db.close();
  }
});
