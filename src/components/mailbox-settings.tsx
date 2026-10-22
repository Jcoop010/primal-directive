import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "./ui/button";
import { authClient } from "@/lib/auth/client";
import {
  mailboxStatus,
  enableMailbox,
  syncMailbox,
  selectMailbox,
  disconnectMailbox,
  saveMailboxDraft,
  exportOutlookDraft,
} from "@/lib/mailboxes";
import { mailboxConsentScopes, type MailProvider } from "@/lib/mailbox-policy";
type Status = Awaited<ReturnType<typeof mailboxStatus>>;
const inputClass = "min-h-11 w-full rounded-lg border border-line-strong bg-bg px-3 py-2 text-sm";
export function MailboxSettings() {
  const [status, setStatus] = useState<Status>();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [recipient, setRecipient] = useState(""),
    [subject, setSubject] = useState(""),
    [body, setBody] = useState(""),
    [gigId, setGig] = useState("");
  const load = useCallback(async () => setStatus(await mailboxStatus()), []);
  useEffect(() => {
    let active = true;
    mailboxStatus()
      .then((s) => {
        if (active) setStatus(s);
      })
      .catch(() => {
        if (active) setError("Email services are unavailable. Refresh to try again.");
      });
    if (new URLSearchParams(window.location.search).has("error"))
      setError(
        "Email authorization was cancelled or denied. Your existing sign-in remains available. Retry consent or check your organization’s policy.",
      );
    return () => {
      active = false;
    };
  }, []);
  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      await load();
      setNotice(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Email action unavailable.");
    } finally {
      setBusy(false);
    }
  }
  async function connect(provider: MailProvider, purpose: "read" | "send" | "drafts") {
    await run(async () => {
      await enableMailbox({ data: { provider } });
      const previous = status?.accounts.find((a) => a.providerId === provider)?.scopes ?? [];
      const result = await authClient.linkSocial({
        provider,
        scopes: mailboxConsentScopes(provider, previous, purpose),
        callbackURL: "/account",
        errorCallbackURL: "/account?error=mailbox_consent",
        disableRedirect: true,
      });
      if (result.error)
        throw new Error(
          provider === "microsoft" && !status?.microsoftConfigured
            ? "Microsoft connection awaits application registration. Google and existing sign-in remain available."
            : "Could not start provider consent. Try again.",
        );
      if (!result.data?.url)
        throw new Error(
          "Provider did not return an authorization page. Connection is not verified.",
        );
      window.location.assign(result.data.url);
    }, "");
  }
  const selected = status?.accounts.find((a) => a.id === status.selected && a.enabled);
  return (
    <section
      aria-label="Email integrations"
      className="space-y-6 rounded-2xl border border-line bg-surface p-5 sm:p-6"
    >
      <div>
        <p className="text-xs font-bold tracking-widest text-accent">CONNECTED EMAIL</p>
        <h2 className="mt-2 text-xl font-bold">Your booking correspondence.</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Sign-in and mailbox access are separate. Choose inbox, send, or Outlook draft permissions
          explicitly. Connecting a mailbox never sends an email.
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-line p-3 text-sm text-warn">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-accent">
          {notice}
        </p>
      )}
      {!status && (
        <p role="status" className="text-sm text-muted">
          Checking email connections…
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {(["google", "microsoft"] as const).map((provider) => {
          const a = status?.accounts.find((a) => a.providerId === provider),
            label = provider === "google" ? "Gmail" : "Outlook";
          const unavailable = provider === "microsoft" && status && !status.microsoftConfigured;
          return (
            <article key={provider} className="space-y-4 rounded-xl border border-line bg-bg p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold">{label}</h3>
                <span className="text-xs text-muted">
                  {a?.enabled && a.read
                    ? "Permission granted"
                    : a && !a.enabled
                      ? "Disconnected"
                      : "Mailbox not connected"}
                </span>
              </div>
              <p className="text-sm text-muted">
                {unavailable
                  ? "Microsoft application registration is required before login or mailbox consent can be tested."
                  : a?.enabled && a.last_sync_at
                    ? `Inbox API verified ${new Date(a.last_sync_at).toLocaleString()}. Recheck to verify current access.`
                    : "Mailbox API access is not yet verified. Connect, then check inbox."}
              </p>
              {a?.enabled && (
                <p className="text-xs text-muted">
                  Read: {a.read ? "granted" : "missing"} · Send: {a.send ? "granted" : "missing"}
                  {provider === "microsoft"
                    ? ` · Drafts: ${a.drafts ? "granted" : "missing"}`
                    : ""}{" "}
                  · Renewal: {a.refreshable ? "available" : "reconnect needed"}
                </p>
              )}
              {a?.last_error && <p className="text-sm text-warn">{a.last_error}</p>}
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy || !status || Boolean(unavailable)}
                  onClick={() => void connect(provider, "read")}
                >
                  Connect / reconnect {label}
                </Button>
                <Button
                  variant="subtle"
                  disabled={busy || !a?.enabled || Boolean(unavailable)}
                  onClick={() => void connect(provider, "send")}
                >
                  Allow {label} sending
                </Button>
                {provider === "microsoft" && (
                  <Button
                    variant="subtle"
                    disabled={busy || !a?.enabled || Boolean(unavailable)}
                    onClick={() => void connect(provider, "drafts")}
                  >
                    Allow Outlook drafts
                  </Button>
                )}
              </div>
              {a?.enabled && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="subtle"
                    disabled={busy || !a.read}
                    onClick={() =>
                      void run(
                        () => syncMailbox({ data: { accountId: a.id } }),
                        "Inbox headers synchronized. Booking replies stop pending outreach; booking stages remain yours to review.",
                      )
                    }
                  >
                    Check {label} inbox
                  </Button>
                  <Button
                    variant="subtle"
                    disabled={busy || !a.read || status?.selected === a.id}
                    onClick={() =>
                      void run(
                        () => selectMailbox({ data: { accountId: a.id } }),
                        `${label} selected for new booking drafts.`,
                      )
                    }
                  >
                    {status?.selected === a.id ? "Booking mailbox selected" : "Use for bookings"}
                  </Button>
                  <Button
                    variant="subtle"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => disconnectMailbox({ data: { accountId: a.id } }),
                        "Mailbox disconnected and local tokens removed. Outreach is paused. Sign-in is preserved.",
                      )
                    }
                  >
                    Disconnect {label}
                  </Button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <p className="text-xs text-muted">
        Disconnect removes stored access and refresh tokens and pauses outreach. Withdraw the
        provider grant too in{" "}
        <a
          className="text-accent underline"
          href="https://myaccount.google.com/connections"
          target="_blank"
          rel="noreferrer"
        >
          Google connections
        </a>{" "}
        or{" "}
        <a
          className="text-accent underline"
          href="https://account.live.com/consent/Manage"
          target="_blank"
          rel="noreferrer"
        >
          Microsoft permissions
        </a>{" "}
        (work/school accounts may require your administrator). Revocation is detected on the next
        API check. Live outreach remains disabled.
      </p>
      <div className="space-y-3 border-t border-line pt-5">
        <h3 className="font-bold">Booking conversations</h3>
        <p className="text-sm text-muted">
          Up to 10 recent inbox headers per check. No message bodies are downloaded. Thread matches
          stay within your artist account and mailbox.
        </p>
        {status?.messages.length === 0 && (
          <p className="text-sm text-muted">
            No synchronized messages yet. Check a connected inbox to get started.
          </p>
        )}
        {status?.messages.map((m) => (
          <article
            key={m.account_id + ":" + m.message_id}
            className="break-words rounded-lg border border-line p-3 text-sm"
          >
            <p className="font-semibold">{m.subject || "No subject"}</p>
            <p>{m.sender}</p>
            <p className="text-xs text-muted">
              {m.received_at} · {m.reply_to ? "Reply header detected" : "Inbox message"}
              {m.gig_id
                ? " · Matched booking; unsent approvals stopped"
                : " · No verified booking match"}
            </p>
          </article>
        ))}
      </div>
      <div className="space-y-3 border-t border-line pt-5">
        <h3 className="font-bold">Prepare a booking draft</h3>
        <p className="text-sm text-muted">
          {selected
            ? `${selected.providerId === "google" ? "Gmail" : "Outlook"} is selected.`
            : "Choose a connected mailbox for bookings first."}{" "}
          Drafts stay in Primal Directive until you explicitly export an Outlook draft. Review
          recipient, source and exact content on the outreach page before any send approval.
        </p>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (selected)
              void run(
                () =>
                  saveMailboxDraft({
                    data: { accountId: selected.id, gigId, recipient, subject, body },
                  }),
                "Draft saved. No email was sent.",
              );
          }}
        >
          <label className="text-xs text-muted">
            Saved booking
            <select
              required
              aria-label="Draft booking"
              value={gigId}
              onChange={(e) => setGig(e.target.value)}
              className={inputClass}
            >
              <option value="">Choose a booking</option>
              {status?.gigs.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted">
            Venue recipient
            <input
              required
              type="email"
              aria-label="Draft recipient"
              className={inputClass}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
          </label>
          <label className="text-xs text-muted sm:col-span-2">
            Subject
            <input
              required
              maxLength={200}
              aria-label="Draft subject"
              className={inputClass}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
          <label className="text-xs text-muted sm:col-span-2">
            Personalized booking message
            <textarea
              required
              maxLength={30000}
              rows={6}
              aria-label="Draft message"
              className={inputClass}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <div className="sm:col-span-2">
            <Button disabled={busy || !selected}>Save booking draft</Button>
          </div>
        </form>
        {status?.drafts.map((d) => (
          <article key={d.id} className="space-y-2 rounded-lg border border-line p-3 text-sm">
            <p className="font-bold">{d.subject}</p>
            <p>
              {d.recipient} ·{" "}
              {d.export_status === "local"
                ? "Saved in Primal Directive"
                : d.export_status === "exported"
                  ? "Outlook draft confirmed"
                  : "Export unconfirmed; check Outlook before retrying"}
            </p>
            <Link
              to="/outreach"
              search={{ draft: d.id }}
              className="inline-flex min-h-11 items-center text-accent"
            >
              Review draft for approval →
            </Link>
            <p className="whitespace-pre-wrap break-words text-muted">{d.body}</p>
            {status.accounts.find((a) => a.id === d.account_id)?.providerId === "microsoft" && (
              <Button
                variant="subtle"
                disabled={
                  busy ||
                  d.export_status !== "local" ||
                  !status.accounts.find((a) => a.id === d.account_id)?.drafts
                }
                onClick={() =>
                  void run(
                    () => exportOutlookDraft({ data: { id: d.id } }),
                    "Outlook draft created. No email was sent.",
                  )
                }
              >
                Create draft in Outlook
              </Button>
            )}
          </article>
        ))}
        {status && status.events.length > 0 && (
          <details className="rounded-lg border border-line p-3 text-sm">
            <summary className="min-h-11 cursor-pointer font-semibold">
              Recent email activity
            </summary>
            {status.events.map((event, i) => (
              <p key={event.at + ":" + i} className="py-1 text-muted">
                {event.action.replaceAll("-", " ")} · {new Date(event.at).toLocaleString()}
              </p>
            ))}
          </details>
        )}
        <Link to="/outreach" className="inline-block py-3 text-sm text-accent">
          Review booking approvals & activity →
        </Link>
      </div>
    </section>
  );
}
