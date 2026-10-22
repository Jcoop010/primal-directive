import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { OutreachScheduling } from "@/components/outreach-scheduling";
import { Button } from "@/components/ui/button";
import { useMusician } from "@/lib/store";
import {
  approveBookingMessage,
  outreachStatus,
  pauseOutreach,
  revokeBookingApproval,
  sendApprovedBooking,
  suppressOutreachContact,
} from "@/lib/outreach";
export const Route = createFileRoute("/outreach")({ component: Outreach });
function Outreach() {
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
  const inputClass = "min-h-11 w-full rounded-lg border border-line bg-bg p-3 text-sm";
  const refresh = async () => {
    setStatus(await outreachStatus());
  };
  useEffect(() => {
    let active = true;
    outreachStatus()
      .then((s) => {
        if (active) setStatus(s);
      })
      .catch(() => {
        if (active)
          setError("Outreach service is unavailable. Refresh after the release is ready.");
      });
    return () => {
      active = false;
    };
  }, []);
  async function run(work: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      await refresh();
      setNotice(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Outreach operation failed");
    } finally {
      setBusy(false);
    }
  }
  function draft() {
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
      <section className="rounded-2xl border border-line bg-surface p-6">
        <p className="text-xs font-bold tracking-widest text-accent">BOOKING OUTREACH</p>
        <h2 className="mt-2 font-display text-2xl font-bold">Every message, accounted for.</h2>
        <p className="mt-3 text-sm text-muted">
          {status
            ? status.released
              ? "Sending released · approvals required"
              : "Sending disabled · test-account verification pending"
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
            Gmail connection →
          </Link>
        </div>
        <p className="mt-3 text-xs text-muted">
          Limits: 5 attempts/hour, 20/day per account; 72-hour contact cooldown. Failed and unknown
          attempts count. Pausing cannot recall messages already sent.
        </p>
      </section>
      {error && (
        <p role="alert" className="rounded-xl border border-line p-4 text-sm">
          {error}
        </p>
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
          disabled={busy || !consent || !status || !gigId}
          onClick={() =>
            run(
              () =>
                approveBookingMessage({
                  data: {
                    gigId,
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
        <h2 className="text-lg font-bold">Approved messages</h2>
        {status?.approvals.length === 0 && (
          <p className="text-sm text-muted">No pending approvals.</p>
        )}
        {status?.approvals.map((a) => (
          <article key={a.id} className="space-y-3 rounded-xl border border-line p-4">
            <p className="break-all text-sm font-bold">{a.recipient}</p>
            <p className="text-sm">{a.subject}</p>
            <details className="text-sm">
              <summary className="min-h-11 cursor-pointer py-3">Read approved message</summary>
              <p className="whitespace-pre-wrap break-words">{a.body}</p>
            </details>
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={busy || status.paused || !status.released}
                onClick={() =>
                  run(async () => {
                    const delivery = await sendApprovedBooking({ data: { id: a.id } });
                    if (delivery.status !== "sent")
                      throw new Error(`${delivery.status}: inspect Gmail before any retry.`);
                  }, "Gmail confirmed delivery acceptance; receipt recorded.")
                }
              >
                Send approved email
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
      {status && (
        <OutreachScheduling
          approvals={status.approvals}
          activity={status.activity}
          onChanged={refresh}
        />
      )}
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
              {a.recipient} · {a.status}
            </p>
            <p className="text-xs text-muted">
              {new Date(a.created_at).toLocaleString()}
              {a.provider_message_id
                ? ` · Gmail ${a.provider_message_id}`
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
