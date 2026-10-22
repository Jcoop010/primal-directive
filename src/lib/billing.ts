import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomUUID } from "node:crypto";
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
    // Persist the request key before contacting Stripe so an ambiguous API timeout
    // resumes the same provider operation, including across deploys and time windows.
    await sql.query(
      "update pd_billing_customers set checkout_request_key=$2,checkout_plan=$3 where user_id=$1 and checkout_request_key is null",
      [context.userId, randomUUID(), data.plan],
    );
    return sql.transaction(async (tx) => {
      const [customer] = await tx.query<{
        customer_id: string;
        checkout_request_key: string;
        checkout_plan: "pro" | "studio";
        checkout_session_id: string | null;
      }>(
        "select customer_id,checkout_request_key,checkout_plan,checkout_session_id from pd_billing_customers where user_id=$1 and livemode=$2 for update",
        [context.userId, billingConfiguration().live],
      );
      if (!customer) throw new Error("Billing account unavailable");
      const existing = await stripe.subscriptions.list({
        customer: customer.customer_id,
        status: "all",
        limit: 100,
      });
      if (existing.data.some((s) => !["canceled", "incomplete_expired"].includes(s.status)))
        throw new Error("Manage your existing subscription in Billing instead");
      if (customer.checkout_session_id) {
        const pending = await stripe.checkout.sessions.retrieve(customer.checkout_session_id);
        if (pending.status === "complete")
          throw new Error("Payment is being confirmed. Refresh Account shortly.");
        if (pending.status === "open" && pending.url) {
          if (customer.checkout_plan !== data.plan)
            throw new Error(
              "A checkout for your other plan is already open. Complete it or wait for it to expire.",
            );
          if (new URL(pending.url).hostname !== "checkout.stripe.com")
            throw new Error("Invalid checkout URL");
          return { url: pending.url };
        }
        customer.checkout_request_key = randomUUID();
        customer.checkout_plan = data.plan;
        await tx.query(
          "update pd_billing_customers set checkout_request_key=$2,checkout_plan=$3,checkout_session_id=null where user_id=$1",
          [context.userId, customer.checkout_request_key, data.plan],
        );
      }
      if (customer.checkout_plan !== data.plan)
        throw new Error(
          "A checkout request for another plan needs reconciliation before changing plans",
        );
      const session = await stripe.checkout.sessions.create(
        {
          mode: "subscription",
          customer: customer.customer_id,
          line_items: [{ price: price.id, quantity: 1 }],
          success_url: `${APP_ORIGIN}/account?checkout=success`,
          cancel_url: `${APP_ORIGIN}/pricing`,
          integration_identifier: "primal_directive_abcdwxyz",
        },
        { idempotencyKey: `pd-checkout-${customer.checkout_request_key}` },
      );
      if (!session.url || new URL(session.url).hostname !== "checkout.stripe.com")
        throw new Error("Invalid checkout URL");
      await tx.query("update pd_billing_customers set checkout_session_id=$2 where user_id=$1", [
        context.userId,
        session.id,
      ]);
      return { url: session.url };
    });
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
