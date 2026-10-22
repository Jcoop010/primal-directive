import { createFileRoute } from "@tanstack/react-router";
import { applyStripeEvent, stripeClient } from "@/lib/billing.server";
export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret) return new Response("Billing unavailable", { status: 503 });
        if (Number(request.headers.get("content-length")) > 1000000)
          return new Response("Payload too large", { status: 413 });
        const raw = await request.text();
        if (raw.length > 1000000) return new Response("Payload too large", { status: 413 });
        const stripe = stripeClient();
        let event;
        try {
          event = stripe.webhooks.constructEvent(
            raw,
            request.headers.get("stripe-signature") ?? "",
            secret,
            300,
          );
        } catch {
          return new Response("Invalid signature", { status: 400 });
        }
        try {
          await applyStripeEvent(event, stripe);
          return Response.json({ received: true });
        } catch {
          console.error("[billing] webhook processing failed", {
            eventId: event.id,
            eventType: event.type,
          });
          return new Response("Webhook processing failed", { status: 500 });
        }
      },
    },
  },
});
