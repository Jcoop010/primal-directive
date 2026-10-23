import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { billingStatus, openBillingPortal } from "@/lib/billing";
import { MailboxSettings } from "@/components/mailbox-settings";
import { useCurrentUser } from "@/lib/auth/use-current-user";

import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/account")({ component: Account });
function Account() {
  const user = useCurrentUser();
  const [billing, setBilling] = useState<Awaited<ReturnType<typeof billingStatus>>>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    billingStatus()
      .then((b) => {
        if (active) setBilling(b);
      })
      .catch(() => {
        if (active) setError("Account services are unavailable. Try refreshing shortly.");
      });
    return () => {
      active = false;
    };
  }, []);
  async function portal() {
    setBusy(true);
    setError("");
    try {
      const result = await openBillingPortal();
      window.location.assign(result.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Billing unavailable");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-surface p-6">
        <p className="text-xs font-bold tracking-widest text-accent">YOUR ACCOUNT</p>
        <h2 className="mt-2 font-display text-2xl font-bold">Services under your control.</h2>
        <p className="mt-2 text-sm text-muted">
          Review your plan and connect only the email permissions you need.
        </p>
        {user?.primaryEmail && (
          <p className="mt-2 break-all text-sm text-muted">Signed in as {user.primaryEmail}</p>
        )}
      </section>
      {error && (
        <p role="alert" className="rounded-xl border border-line p-4 text-sm">
          {error}
        </p>
      )}
      <div className="grid gap-6">
        <section className="space-y-4 rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-lg font-bold">Subscription</h2>
          <p className="text-sm text-muted">
            {billing ? `Current access: ${billing.plan.toUpperCase()}` : "Loading subscription…"}
          </p>
          {billing?.subscriptions.map((s, i) => (
            <p key={i} className="text-sm">
              {s.plan} · {s.status}
              {s.cancel_at_period_end ? " · cancels at period end" : ""}
              {s.period_end ? ` · through ${new Date(s.period_end).toLocaleDateString()}` : ""}
            </p>
          ))}
          <div className="flex flex-wrap gap-3">
            <Link
              to="/pricing"
              className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm"
            >
              Compare plans
            </Link>
            <Button disabled={busy || !billing?.hasCustomer} onClick={portal}>
              Manage billing
            </Button>
          </div>
          <p className="text-xs text-muted">
            Stripe manages payment methods, plan changes and cancellation. Payment confirmation
            comes from verified webhooks.
          </p>
        </section>
      </div>
      <MailboxSettings />
      <section className="flex flex-wrap gap-5 text-sm">
        <Link to="/help" className="text-accent">
          Help & launch status
        </Link>
        <Link to="/legal" className="text-accent">
          Privacy & service information
        </Link>
      </section>
    </div>
  );
}
