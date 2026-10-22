import Stripe from "stripe";
import { getSql } from "./db";
import { entitledPlan, LIVE_PRICES, type PaidPlan } from "./billing-policy";
export const APP_ORIGIN = "https://primal-directive-loose-ends-co.vercel.app";
export function billingConfiguration() {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  const live = /^(sk|rk)_live_/.test(key);
  const enabled =
    process.env.BILLING_ENABLED === "true" &&
    Boolean(key && process.env.STRIPE_WEBHOOK_SECRET) &&
    (!live || process.env.STRIPE_LIVE_VERIFIED === "true");
  return { enabled, live };
}
export function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Billing is not configured");
  return new Stripe(key, { maxNetworkRetries: 1, timeout: 10000 });
}
export function priceFor(plan: PaidPlan) {
  if (billingConfiguration().live) return LIVE_PRICES[plan];
  const price =
    process.env[plan === "pro" ? "STRIPE_TEST_PRO_PRICE_ID" : "STRIPE_TEST_STUDIO_PRICE_ID"];
  if (!price) throw new Error("Stripe test prices are not configured");
  return price;
}
export async function subscriptionState(userId: string) {
  const sql = await getSql();
  const rows = await sql.query<{
    plan: string;
    status: string;
    period_end: Date | null;
    cancel_at_period_end: boolean;
  }>(
    "select plan,status,period_end,cancel_at_period_end from pd_subscriptions where user_id=$1 order by updated_at desc",
    [userId],
  );
  const customers = await sql.query<{ customer_id: string }>(
    "select customer_id from pd_billing_customers where user_id=$1",
    [userId],
  );
  return {
    plan: entitledPlan(rows),
    subscriptions: rows.map((r) => ({
      ...r,
      period_end: r.period_end ? new Date(r.period_end).toISOString() : null,
    })),
    hasCustomer: customers.length > 0,
  };
}
export async function requirePaid(userId: string, studio = false) {
  const state = await subscriptionState(userId);
  if (state.plan === "free" || (studio && state.plan !== "studio"))
    throw new Error(
      studio ? "Studio subscription required" : "Pro or Studio subscription required",
    );
}
/** Resolve ownership through our persisted Stripe customer mapping, never event metadata. */
export async function applyStripeEvent(event: Stripe.Event, stripe: Stripe = stripeClient()) {
  if (event.livemode !== billingConfiguration().live)
    throw new Error("Stripe environment mismatch");
  const supported = [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "invoice.paid",
    "invoice.payment_failed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ];
  if (!supported.includes(event.type)) return;
  const object = event.data.object as unknown as {
    id: string;
    subscription?: string | { id: string };
    parent?: { subscription_details?: { subscription?: string | { id: string } } };
  };
  const reference = event.type.startsWith("customer.subscription.")
    ? object.id
    : (object.subscription ?? object.parent?.subscription_details?.subscription);
  const subscriptionId = typeof reference === "string" ? reference : reference?.id;
  if (!subscriptionId) return;
  const customerRef = (event.data.object as unknown as { customer?: string | { id: string } })
    .customer;
  const customerId = typeof customerRef === "string" ? customerRef : customerRef?.id;
  if (!customerId) throw new Error("Stripe customer missing");
  const database = await getSql();
  await database.transaction(async (sql) => {
    // Serialize each customer's reconciliation, including the authoritative API read.
    const locked = await sql.query(
      "select user_id from pd_billing_customers where customer_id=$1 and livemode=$2 for update",
      [customerId, event.livemode],
    );
    if (locked.length !== 1) return; // Other products in this Stripe account are outside this app.
    if (
      (await sql.query("select event_id from pd_stripe_events where event_id=$1", [event.id]))
        .length
    )
      return;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const actualCustomer =
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
    if (actualCustomer !== customerId) throw new Error("Stripe ownership mismatch");
    const owners = await sql.query<{ user_id: string }>(
      "select user_id from pd_billing_customers where customer_id=$1 and livemode=$2",
      [customerId, event.livemode],
    );
    if (owners.length !== 1) throw new Error("Stripe customer mapping missing");
    const item = subscription.items.data[0];
    const price = item?.price.id ?? "";
    const plan =
      price === priceFor("studio") ? "studio" : price === priceFor("pro") ? "pro" : "free";
    const end = item?.current_period_end;
    // Receipt and entitlement update commit together. Failed processing remains retryable.
    await sql.query(
      `with receipt as (
    insert into pd_stripe_events(event_id,event_type) values($1,$2) on conflict do nothing returning event_id
  ) insert into pd_subscriptions(subscription_id,user_id,customer_id,price_id,plan,status,period_end,cancel_at_period_end,event_created)
    select $3,$4,$5,$6,$7,$8,$9,$10,$11 from receipt
    on conflict(subscription_id) do update set price_id=excluded.price_id,plan=excluded.plan,status=excluded.status,
      period_end=excluded.period_end,cancel_at_period_end=excluded.cancel_at_period_end,event_created=excluded.event_created,updated_at=now()
    where pd_subscriptions.user_id=excluded.user_id and pd_subscriptions.event_created<=excluded.event_created`,
      [
        event.id,
        event.type,
        subscription.id,
        owners[0].user_id,
        customerId,
        price,
        plan,
        subscription.status,
        end ? new Date(end * 1000) : null,
        subscription.cancel_at_period_end,
        event.created,
      ],
    );
  });
}
