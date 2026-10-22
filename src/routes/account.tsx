import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { billingStatus, openBillingPortal } from "@/lib/billing";
import { previewGmailReplyHeaders } from "@/lib/gmail-inbox";
import { getGmailConnectionStatus } from "@/lib/gmail-status";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/account")({ component: Account });
function Account() {
  const [billing, setBilling] = useState<Awaited<ReturnType<typeof billingStatus>>>();
  const [gmail, setGmail] = useState<Awaited<ReturnType<typeof getGmailConnectionStatus>>>();
  const [replies, setReplies] = useState<Awaited<ReturnType<typeof previewGmailReplyHeaders>>>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([billingStatus(), getGmailConnectionStatus()])
      .then(([b, g]) => {
        if (active) {
          setBilling(b);
          setGmail(g);
        }
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
  async function connect(scopes: string[]) {
    setBusy(true);
    setError("");
    try {
      const result = await authClient.linkSocial({
        provider: "google",
        scopes,
        callbackURL: window.location.origin + "/account",
      });
      if (result.error) throw new Error("Gmail connection could not be started");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection unavailable");
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
          Review your plan and connect only the Gmail permissions you need.
        </p>
      </section>
      {error && (
        <p role="alert" className="rounded-xl border border-line p-4 text-sm">
          {error}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
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
        <section className="space-y-4 rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-lg font-bold">Gmail</h2>
          <p className="text-sm">
            {gmail
              ? gmail.apiVerified
                ? "Gmail API verified"
                : gmail.googleLinked
                  ? "Google linked · Gmail verification required"
                  : "Gmail not connected"
              : "Checking connection…"}
          </p>
          <p className="text-sm text-muted">
            Read permission supports inbox previews and reply metadata. Send permission is separate
            and never authorizes an email by itself. OAuth tokens stay encrypted on the server.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={busy}
              onClick={() => connect(["https://www.googleapis.com/auth/gmail.readonly"])}
            >
              Connect / reconnect inbox
            </Button>
            <Button
              variant="subtle"
              disabled={busy}
              onClick={() => connect(["https://www.googleapis.com/auth/gmail.send"])}
            >
              Authorize sending
            </Button>
          </div>
          <p className="text-xs text-muted">
            Sending stays disabled until integration checks pass. Revoke Primal Directive in your
            Google account to withdraw access.
          </p>
          <Link to="/outreach" className="inline-block py-3 text-sm text-accent">
            Review outreach approvals and activity →
          </Link>
        </section>
      </div>
      <section className="space-y-4 rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-lg font-bold">Inbox reply preview</h2>
        <p className="text-sm text-muted">
          Manually inspect up to 10 inbox messages for reply headers. No message bodies are loaded,
          and this does not change booking statuses.
        </p>
        <Button
          disabled={busy || !gmail?.apiVerified}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const result = await previewGmailReplyHeaders();
              setReplies(result);
              if (!result.connected) setError("Gmail read access is unavailable. Reconnect Gmail.");
            } catch {
              setError("Could not load Gmail replies");
            } finally {
              setBusy(false);
            }
          }}
        >
          Check reply headers
        </Button>
        {replies?.connected && replies.replies.length === 0 && (
          <p className="text-sm text-muted">No reply headers found in this bounded preview.</p>
        )}
        {replies?.replies.map((r) => (
          <div key={r.id} className="break-words border-t border-line pt-3 text-sm">
            <p className="font-bold">{r.subject || "No subject"}</p>
            <p>{r.from}</p>
            <p className="text-xs text-muted">
              {r.date} · Thread {r.threadId}
            </p>
          </div>
        ))}
      </section>
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
