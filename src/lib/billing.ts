import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "./auth/middleware";
import { getSql } from "./db";
import {
  APP_ORIGIN,
  billingConfiguration,
  priceFor,
  stripeClient,
  subscriptionState,
} from "./billing.server";
export const billingStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => ({
    ...(await subscriptionState(context.userId)),
    ...billingConfiguration(),
  }));
export const startCheckout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ plan: z.enum(["pro", "studio"]) }))
  .handler(async ({ context, data }) => {
    if (!billingConfiguration().enabled)
      throw new Error("Checkout is not yet available. No payment was taken.");
    const stripe = stripeClient();
    const sql = await getSql();
    const state = await subscriptionState(context.userId);
    // A second subscription must be managed through the existing billing portal.
    if (state.subscriptions.some((s) => !["canceled", "incomplete_expired"].includes(s.status)))
      throw new Error("Manage your existing subscription in Billing instead");
    let rows = await sql.query<{ customer_id: string }>(
      "select customer_id from pd_billing_customers where user_id=$1 and livemode=$2",
      [context.userId, billingConfiguration().live],
    );
    if (!rows.length) {
      const customer = await stripe.customers.create(
        {},
        { idempotencyKey: `pd-customer-${context.userId}-${billingConfiguration().live}` },
      );
      await sql.query(
        "insert into pd_billing_customers(user_id,customer_id,livemode) values($1,$2,$3) on conflict(user_id) do nothing",
        [context.userId, customer.id, billingConfiguration().live],
      );
      rows = await sql.query<{ customer_id: string }>(
        "select customer_id from pd_billing_customers where user_id=$1 and livemode=$2",
        [context.userId, billingConfiguration().live],
      );
      if (!rows.length) throw new Error("Billing environment mismatch");
    }
    const price = await stripe.prices.retrieve(priceFor(data.plan));
    if (
      !price.active ||
      price.currency !== "usd" ||
      price.unit_amount !== (data.plan === "pro" ? 1900 : 3900) ||
      price.recurring?.interval !== "month" ||
      price.recurring.interval_count !== 1 ||
      price.livemode !== billingConfiguration().live
    )
      throw new Error("Subscription price validation failed");
    // A stable window key prevents double clicks from creating parallel checkout sessions.
    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: rows[0].customer_id,
        line_items: [{ price: price.id, quantity: 1 }],
        success_url: `${APP_ORIGIN}/account?checkout=success`,
        cancel_url: `${APP_ORIGIN}/pricing`,
        integration_identifier: "primal_directive_abcdwxyz",
      },
      {
        idempotencyKey: `pd-checkout-${context.userId}-${data.plan}-${Math.floor(Date.now() / 1800000)}`,
      },
    );
    if (!session.url || new URL(session.url).hostname !== "checkout.stripe.com")
      throw new Error("Invalid checkout URL");
    return { url: session.url };
  });
export const openBillingPortal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<{ customer_id: string }>(
      "select customer_id from pd_billing_customers where user_id=$1 and livemode=$2",
      [context.userId, billingConfiguration().live],
    );
    if (!rows.length) throw new Error("No billing account yet");
    const session = await stripeClient().billingPortal.sessions.create({
      customer: rows[0].customer_id,
      return_url: `${APP_ORIGIN}/account`,
    });
    if (new URL(session.url).hostname !== "billing.stripe.com")
      throw new Error("Invalid billing portal URL");
    return { url: session.url };
  });
