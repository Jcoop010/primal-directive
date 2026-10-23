import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  reviewMailboxDraft,
  mailboxStatus,
  mailboxIdentity,
  selectMailbox,
  syncMailbox,
} from "@/lib/mailboxes";
import { useMusician } from "@/lib/store";
import {
  approveBookingMessage,
  outreachStatus,
  pauseOutreach,
  revokeBookingApproval,
  sendApprovedBooking,
  suppressOutreachContact,
} from "@/lib/outreach";
export const Route = createFileRoute("/outreach")({
  validateSearch: (search: Record<string, unknown>): { draft?: string } => ({
    draft: typeof search.draft === "string" ? search.draft : undefined,
  }),
  component: Outreach,
});
function Outreach() {
  const { draft: reviewDraftId } = Route.useSearch();
  const [draftMailboxId, setDraftMailboxId] = useState<string>();
  const [draftProvider, setDraftProvider] = useState<string>();
  const gigs = useMusician((s) => s.gigs),
    profile = useMusician((s) => s.profile);
  const [status, setStatus] = useState<Awaited<ReturnType<typeof outreachStatus>>>();
  const [gigId, setGigId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [source, setSource] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mail, setMail] = useState<Awaited<ReturnType<typeof mailboxStatus>>>();
  const [sendingAddress, setSendingAddress] = useState<string | null>(null);
  const [syncError, setSyncError] = useState("");
  const [pendingApproval, setPendingApproval] = useState<string>();
  const sendingId = draftMailboxId ?? mail?.selected;
  const sendingAccount = mail?.accounts.find((a) => a.id === sendingId && a.enabled);
  const readableError = (message: string) =>
    message.includes("contactSourceUrl") || message.includes("invalid_format")
      ? "Enter a valid official HTTPS booking contact source before approving real outreach. Sending from this page does not require exporting a draft or opening your email app."
      : message;
  useEffect(() => {
    if (!reviewDraftId) return;
    let active = true;
    reviewMailboxDraft({ data: { id: reviewDraftId } })
      .then((d) => {
        if (!active) return;
        setGigId(d.gig_id);
        setRecipient(d.recipient);
        setSubject(d.subject);
        setBody(d.body);
        setDraftMailboxId(d.account_id);
        setDraftProvider(d.provider);
        setConsent(false);
      })
      .catch(() => {
        if (active) setError("Draft unavailable or mailbox disconnected. Reconnect from Account.");
      });
    return () => {
      active = false;
    };
  }, [reviewDraftId]);
  const inputClass = "min-h-11 w-full rounded-lg border border-line bg-bg p-3 text-sm";
  const refresh = async () => {
    const [nextStatus, nextMail] = await Promise.all([outreachStatus(), mailboxStatus()]);
    setStatus(nextStatus);
    setMail(nextMail);
  };
  useEffect(() => {
    let active = true;
    Promise.all([outreachStatus(), mailboxStatus()])
      .then(([s, m]) => {
        if (active) {
          setStatus(s);
          setMail(m);
        }
      })
      .catch(() => {
        if (active)
          setError("Outreach service is unavailable. Refresh after the release is ready.");
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    setSendingAddress(null);
    if (!sendingId || !sendingAccount?.read) return;
    let active = true;
    mailboxIdentity({ data: { accountId: sendingId } })
      .then((result) => {
        if (active) setSendingAddress(result.address);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [sendingId, sendingAccount?.read]);
  useEffect(() => {
    if (!sendingId || !sendingAccount?.read || busy) return;
    let active = true,
      running = false;
    const check = async () => {
      if (document.hidden || running) return;
      running = true;
      try {
        await syncMailbox({ data: { accountId: sendingId } });
        const [nextMail, nextStatus] = await Promise.all([mailboxStatus(), outreachStatus()]);
        if (active) {
          setMail(nextMail);
          setStatus(nextStatus);
          setSyncError("");
          if (
            pendingApproval &&
            nextStatus.activity.some(
              (a) => a.approval_id === pendingApproval && a.status === "sent",
            )
          ) {
            setError("");
            setNotice("Provider submission confirmed from Sent Items; message receipt recorded.");
            setPendingApproval(undefined);
          }
        }
      } catch (e) {
        if (active)
          setSyncError(
            e instanceof Error ? e.message : "Inbox check failed. Reconnect from Account.",
          );
      } finally {
        running = false;
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 60000);
    const visible = () => {
      if (!document.hidden) void check();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [sendingId, sendingAccount?.read, busy, pendingApproval]);
  async function run(work: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      await refresh();
      setNotice(message);
    } catch (e) {
      setError(readableError(e instanceof Error ? e.message : "Outreach operation failed"));
    } finally {
      setBusy(false);
    }
  }
  function draft() {
    setDraftMailboxId(undefined);
    setDraftProvider(undefined);
    const gig = gigs.find((g) => g.id === gigId);
    if (!gig || !profile.artistName) {
      setError("Choose a saved gig and complete your artist profile first");
      return;
    }
    setRecipient(gig.outreachEmail ?? "");
    setSource(gig.bookingContactSourceUrl ?? gig.bookingRoute ?? "");
    setSubject(`${profile.artistName} — booking inquiry for ${gig.venue}`);
    setBody(
      `Hello${gig.bookingContactName ? ` ${gig.bookingContactName}` : ""},\n\nI’m reaching out on behalf of ${profile.artistName}${profile.city ? ` from ${profile.city}` : ""}${profile.genre ? ` (${profile.genre})` : ""}. We’re interested in performing at ${gig.venue}${gig.city ? ` in ${gig.city}` : ""}.\n\n${profile.epkUrl ? `Our EPK: ${profile.epkUrl}\n\n` : ""}Could you share your current booking availability and submission requirements?\n\nThank you,\n${profile.artistName}\n\nIf you prefer no further booking emails from us, please reply and we will stop.`,
    );
    setConsent(false);
  }
  return (
    <div className="space-y-6">
      {draftProvider && (
        <p role="status" className="text-sm text-muted">
          Reviewing saved {draftProvider === "microsoft" ? "Outlook" : "Gmail"} draft. This approval
          stays bound to that mailbox.
        </p>
      )}
      <section className="rounded-2xl border border-line bg-surface p-6">
        <p className="text-xs font-bold tracking-widest text-accent">BOOKING OUTREACH</p>
        <h2 className="mt-2 font-display text-2xl font-bold">Every message, accounted for.</h2>
        <p className="mt-3 text-sm text-muted">
          {status
            ? status.released
              ? "Sending released · approvals required"
              : status.verificationApprovalId
                ? "Controlled test available · only the designated approval can send"
                : "Sending disabled · production verification pending"
            : "Loading outreach controls…"}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            disabled={busy || !status}
            onClick={() =>
              run(
                () => pauseOutreach({ data: { paused: !status?.paused } }),
                status?.paused
                  ? "Outreach resumed. Review a fresh approval before sending."
                  : "Paused. All unsent approvals revoked.",
              )
            }
          >
            {status?.paused ? "Resume account outreach" : "Pause & revoke approvals"}
          </Button>
          <Link
            to="/account"
            className="inline-flex min-h-11 items-center px-3 text-sm text-accent"
          >
            Email connections →
          </Link>
        </div>
        <p className="mt-3 text-xs text-muted">
          Limits: 5 attempts/hour, 20/day per account; 72-hour contact cooldown. Failed and unknown
          attempts count. Pausing cannot recall messages already sent.
        </p>
      </section>
      {error && (
        <div role="alert" className="rounded-xl border border-line p-4 text-sm">
          <p>{error}</p>
          <a href="/account#booking-drafts" className="mt-2 inline-block text-accent underline">
            Go to email draft editor →
          </a>
        </div>
      )}
      {notice && (
        <p role="status" className="rounded-xl border border-line p-4 text-sm">
          {notice}
        </p>
      )}
      <section className="space-y-4 rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-lg font-bold">Review a booking message</h2>
        <p className="text-sm text-muted">
          Build a draft from your saved artist and booking facts, or paste an Advisor draft. Edit
          before approving. Approval expires in 24 hours and covers only this exact message and
          recipient.
        </p>
        <label className="block space-y-2 text-sm">
          Sending account
          <select
            aria-label="Sending account"
            className={inputClass}
            value={sendingId ?? ""}
            disabled={busy || !mail}
            onChange={(e) => {
              const id = e.target.value;
              setConsent(false);
              setDraftMailboxId(id);
              setDraftProvider(mail?.accounts.find((a) => a.id === id)?.providerId);
              void run(
                () => selectMailbox({ data: { accountId: id } }),
                "Sending account selected. Review and approve the exact message.",
              );
            }}
          >
            <option value="" disabled>
              Choose a connected mailbox
            </option>
            {mail?.accounts
              .filter((a) => a.enabled)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.providerId === "microsoft" ? "Outlook" : "Gmail"}
                  {a.send ? " · send permission granted" : " · send permission missing"}
                </option>
              ))}
          </select>
        </label>
        <p className="text-sm text-muted">
          {sendingAddress
            ? `Sending from ${sendingAddress}`
            : sendingAccount
              ? `${sendingAccount.providerId === "microsoft" ? "Outlook" : "Gmail"} selected · mailbox address not returned by provider`
              : "Connect a sending account in Account first."}{" "}
          Approval and sending both happen here. Exporting to Outlook Drafts is optional.
        </p>
        {!sendingAccount?.send && (
          <Link to="/account" className="text-sm text-accent">
            Connect or grant mailbox send permission →
          </Link>
        )}
        <label className="block space-y-2 text-sm">
          Saved booking
          <select
            aria-label="Saved booking"
            className={inputClass}
            value={gigId}
            onChange={(e) => {
              setGigId(e.target.value);
              setConsent(false);
            }}
          >
            <option value="">Choose a booking</option>
            {gigs.map((g) => (
              <option key={g.id} value={g.id}>
                {g.venue} · {g.name}
              </option>
            ))}
          </select>
        </label>
        <Button variant="subtle" disabled={!gigId} onClick={draft}>
          Build draft from profile
        </Button>
        <label className="block space-y-2 text-sm">
          Recipient email
          <input
            type="email"
            className={inputClass}
            value={recipient}
            onChange={(e) => {
              setRecipient(e.target.value);
              setConsent(false);
            }}
          />
        </label>
        <label className="block space-y-2 text-sm">
          Official booking contact source (HTTPS)
          <input
            type="url"
            className={inputClass}
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setConsent(false);
            }}
          />
        </label>
        <label className="block space-y-2 text-sm">
          Subject
          <input
            maxLength={200}
            className={inputClass}
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setConsent(false);
            }}
          />
        </label>
        <label className="block space-y-2 text-sm">
          Message
          <textarea
            rows={12}
            className={inputClass}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setConsent(false);
            }}
          />
        </label>
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-5 shrink-0"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          I verified this recipient’s booking contact and preferences at the linked source, and
          approve this exact email. I am authorized to send it.
        </label>
        <Button
          disabled={busy || !consent || !status || !gigId || !sendingAccount?.send}
          onClick={() =>
            run(
              () =>
                approveBookingMessage({
                  data: {
                    gigId,
                    mailboxAccountId: sendingId ?? undefined,
                    recipient,
                    subject,
                    body,
                    contactSourceUrl: source,
                    verifiedContact: true,
                    consent: true,
                  },
                }),
              "Approval saved. Nothing has been sent.",
            )
          }
        >
          Save explicit approval
        </Button>
      </section>
      <section className="space-y-4 rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-lg font-bold">Send directly from Primal Directive</h2>
        <p className="text-sm text-muted">
          After saving approval, select Send from Primal Directive here. Your connected Outlook or
          Gmail account sends it; you do not need to open the email app. Only approved messages can
          send when release verification permits them.
        </p>
        {status?.approvals.length === 0 && (
          <p className="text-sm text-muted">No pending approvals.</p>
        )}
        {status?.approvals.map((a) => (
          <article key={a.id} className="space-y-3 rounded-xl border border-line p-4">
            <p className="break-all text-sm font-bold">{a.recipient}</p>
            <p className="text-sm">{a.subject}</p>
            <p className="text-xs text-muted">
              Approval saved {new Date(a.approved_at).toLocaleString()} ·{" "}
              {a.mail_provider === "microsoft" ? "Outlook" : "Gmail"} · exact recipient and message
            </p>
            <p className="break-all text-xs text-muted">Approval reference: {a.id}</p>
            <details className="text-sm">
              <summary className="min-h-11 cursor-pointer py-3">Read approved message</summary>
              <p className="whitespace-pre-wrap break-words">{a.body}</p>
            </details>
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={
                  busy ||
                  status.paused ||
                  (!status.released && status.verificationApprovalId !== a.id)
                }
                onClick={() =>
                  run(async () => {
                    const delivery = await sendApprovedBooking({ data: { id: a.id } });
                    if (delivery.status !== "sent") {
                      const accepted = delivery.reason === "provider-accepted-delivery-unverified";
                      if (delivery.status === "unknown") setPendingApproval(a.id);
                      const problem =
                        delivery.reason === "provider-401"
                          ? "Authorization expired or was revoked. Reconnect this mailbox in Account."
                          : delivery.reason === "provider-403"
                            ? "Provider denied sending. Review send permission and organization policy in Account."
                            : delivery.reason === "provider-429"
                              ? "Provider rate limit reached. Wait and review the failed attempt before creating a fresh approval."
                              : delivery.reason;
                      await refresh();
                      throw new Error(
                        accepted
                          ? "Outlook accepted the message. Submission confirmation is pending; automatic inbox checks will reconcile it. Do not resend."
                          : `${delivery.status}: ${problem} No automatic resend will occur; inspect the sending mailbox before any retry.`,
                      );
                    }
                  }, "Provider confirmed submission; message receipt recorded.")
                }
              >
                {busy ? "Working…" : "Send from Primal Directive"}
              </Button>
              <Button
                variant="subtle"
                disabled={busy}
                onClick={() =>
                  run(() => revokeBookingApproval({ data: { id: a.id } }), "Approval revoked.")
                }
              >
                Revoke
              </Button>
              <Button
                variant="subtle"
                disabled={busy}
                onClick={() =>
                  run(
                    () =>
                      suppressOutreachContact({
                        data: { recipient: a.recipient, reason: "User requested suppression" },
                      }),
                    "Contact suppressed and approvals revoked.",
                  )
                }
              >
                Suppress contact
              </Button>
            </div>
          </article>
        ))}
      </section>
      <section className="space-y-4 rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-lg font-bold">Contact preferences</h2>
        <p className="text-sm text-muted">
          Suppress the email in the recipient field above at any time. Existing approvals for it
          will be revoked.
        </p>
        <Button
          variant="subtle"
          disabled={busy || !recipient.trim()}
          onClick={() =>
            run(
              () =>
                suppressOutreachContact({
                  data: { recipient, reason: "Contact opt-out or preference" },
                }),
              "Recipient suppressed.",
            )
          }
        >
          Suppress entered recipient
        </Button>
      </section>
      <section
        aria-label="Booking conversations"
        className="space-y-4 rounded-2xl border border-line bg-surface p-6"
      >
        <h2 className="text-lg font-bold">Booking conversations</h2>
        <p className="text-sm text-muted">
          The selected inbox is checked every minute while this page is open and visible. Replies
          stop pending outreach; booking stages remain yours to review.
        </p>
        <p className="text-xs text-muted">
          {sendingAccount?.last_sync_at
            ? `Last successful check: ${new Date(sendingAccount.last_sync_at).toLocaleString()}`
            : "No inbox check verified yet."}
        </p>
        {syncError && (
          <p role="alert" className="text-sm">
            {syncError}{" "}
            <Link to="/account" className="text-accent">
              Review connection →
            </Link>
          </p>
        )}
        {!mail?.messages.some((m) => m.account_id === sendingId && m.gig_id) && (
          <p className="text-sm text-muted">No matched booking replies yet.</p>
        )}
        {mail?.messages
          .filter((m) => m.account_id === sendingId && m.gig_id)
          .map((m) => (
            <article key={m.message_id} className="rounded-xl border border-line p-4 text-sm">
              <p className="font-semibold">{m.subject}</p>
              <p>{m.sender}</p>
              <p className="text-xs text-muted">{m.received_at} · Matched to your booking</p>
            </article>
          ))}
      </section>
      <section className="space-y-4 rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-lg font-bold">Delivery activity</h2>
        {status?.activity.length === 0 && (
          <p className="text-sm text-muted">
            No delivery attempts recorded. This log shows provider results, not scheduled tasks.
          </p>
        )}
        {status?.activity.map((a) => (
          <div key={a.idempotency_key} className="space-y-1 border-b border-line pb-3 text-sm">
            <p className="break-all font-semibold">
              {a.recipient} ·{" "}
              {a.status === "sent"
                ? "Provider submission confirmed"
                : a.status === "unknown"
                  ? "Submission unconfirmed — do not resend"
                  : a.status === "reserved"
                    ? "Reserved — submission outcome pending"
                    : "Provider rejected submission"}
            </p>
            <p className="text-xs text-muted">
              {new Date(a.created_at).toLocaleString()}
              {a.provider_message_id
                ? ` · ${a.mail_provider === "microsoft" ? "Outlook" : "Gmail"} ${a.provider_message_id}`
                : " · no confirmed provider receipt"}
            </p>
            <Button
              variant="subtle"
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    suppressOutreachContact({
                      data: { recipient: a.recipient, reason: "User requested suppression" },
                    }),
                  "Contact suppressed.",
                )
              }
            >
              Suppress contact
            </Button>
          </div>
        ))}
      </section>
    </div>
  );
}
