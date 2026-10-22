import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import {
  cancelScheduledOutreach,
  configureOutreachRules,
  scheduleApprovedOutreach,
  scheduledOutreachStatus,
} from "@/lib/outreach-scheduling";
type Props = {
  approvals: { id: string; recipient: string; subject: string }[];
  activity: { idempotency_key: string; recipient: string; status: string }[];
  onChanged: () => Promise<void>;
};
export function OutreachScheduling({ approvals, activity, onChanged }: Props) {
  const [state, setState] = useState<Awaited<ReturnType<typeof scheduledOutreachStatus>>>();
  const [hourly, setHourly] = useState(5),
    [daily, setDaily] = useState(20),
    [followups, setFollowups] = useState(2);
  const [consent, setConsent] = useState(false),
    [id, setId] = useState(""),
    [due, setDue] = useState(""),
    [parent, setParent] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function load() {
    const next = await scheduledOutreachStatus();
    setState(next);
    setHourly(next.rules.hourly_limit);
    setDaily(next.rules.daily_limit);
    setFollowups(next.rules.max_followups);
  }
  useEffect(() => {
    let active = true;
    scheduledOutreachStatus()
      .then((next) => {
        if (active) {
          setState(next);
          setHourly(next.rules.hourly_limit);
          setDaily(next.rules.daily_limit);
          setFollowups(next.rules.max_followups);
        }
      })
      .catch(() => {
        if (active) setError("Scheduling is unavailable.");
      });
    return () => {
      active = false;
    };
  }, []);
  async function run(work: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    try {
      await work();
      await load();
      await onChanged();
      setNotice(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scheduling failed");
    } finally {
      setBusy(false);
    }
  }
  const field = "min-h-11 w-full rounded-lg border border-line bg-bg p-3 text-sm";
  return (
    <section className="space-y-5 rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-lg font-bold">Scheduled approvals & follow-ups</h2>
      <p className="text-sm text-muted">
        Scheduling is opt-in. Each scheduled message needs exact-message approval. The daily
        processor runs at 13:00 UTC and sends at most five due messages per run. Studio, Gmail
        read/send permission, account resume and release verification are required. Follow-ups stop
        on a detected inbound reply, opt-out, closed booking or failed safety check.
      </p>
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="space-y-2 text-sm">
          Hourly attempt limit
          <input
            type="number"
            min={1}
            max={5}
            value={hourly}
            onChange={(e) => setHourly(Number(e.target.value))}
            className={field}
          />
        </label>
        <label className="space-y-2 text-sm">
          Daily attempt limit
          <input
            type="number"
            min={1}
            max={20}
            value={daily}
            onChange={(e) => setDaily(Number(e.target.value))}
            className={field}
          />
        </label>
        <label className="space-y-2 text-sm">
          Maximum follow-ups
          <input
            type="number"
            min={0}
            max={2}
            value={followups}
            onChange={(e) => setFollowups(Number(e.target.value))}
            className={field}
          />
        </label>
      </div>
      <label className="flex min-h-11 items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 size-5 shrink-0"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        I opt in to scheduled delivery of messages I explicitly approve, within these limits. I
        authorize checking the related Gmail thread for replies and opt-outs before a follow-up.
      </label>
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={busy || !consent || !state}
          onClick={() =>
            run(
              () =>
                configureOutreachRules({
                  data: { enabled: true, consent: true, hourly, daily, followups },
                }),
              "Scheduling preferences saved. Sending remains subject to release verification.",
            )
          }
        >
          Save scheduling opt-in
        </Button>
        <Button
          variant="subtle"
          disabled={busy || !state?.rules.enabled}
          onClick={() =>
            run(
              () =>
                configureOutreachRules({
                  data: { enabled: false, consent: true, hourly, daily, followups },
                }),
              "Scheduling disabled; queued messages cancelled.",
            )
          }
        >
          Disable scheduling
        </Button>
      </div>
      <p className="text-sm text-muted">
        Scheduling preference: {state ? (state.rules.enabled ? "opted in" : "off") : "loading…"}.
        Exact-message approvals expire; scheduling creates a new consent record through one day
        after the selected time. Choose a time within 30 days.
      </p>
      <label className="block space-y-2 text-sm">
        Approved message
        <select
          aria-label="Approved message"
          className={field}
          value={id}
          onChange={(e) => setId(e.target.value)}
        >
          <option value="">Choose an approved message</option>
          {approvals.map((a) => (
            <option key={a.id} value={a.id}>
              {a.recipient} · {a.subject}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-2 text-sm">
        Earliest delivery time (your local time)
        <input
          type="datetime-local"
          className={field}
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
      </label>
      <label className="block space-y-2 text-sm">
        Follow-up parent
        <select
          aria-label="Follow-up parent"
          className={field}
          value={parent}
          onChange={(e) => setParent(e.target.value)}
        >
          <option value="">Initial message (no previous attempt)</option>
          {activity
            .filter((a) => a.status === "sent")
            .map((a) => (
              <option key={a.idempotency_key} value={a.idempotency_key}>
                {a.recipient} · confirmed delivery
              </option>
            ))}
        </select>
      </label>
      <Button
        disabled={busy || !consent || !state?.rules.enabled || !id || !due}
        onClick={() =>
          run(
            () =>
              scheduleApprovedOutreach({
                data: {
                  id,
                  notBefore: new Date(due).toISOString(),
                  ...(parent ? { parentKey: parent } : {}),
                  consent: true,
                },
              }),
            "Exact message scheduled. Nothing has been sent.",
          )
        }
      >
        Approve scheduled delivery
      </Button>
      <div className="space-y-3">
        <h3 className="font-bold">Schedule activity</h3>
        {state?.jobs.length === 0 && <p className="text-sm text-muted">No scheduled messages.</p>}
        {state?.jobs.map((j) => (
          <article key={j.id} className="space-y-2 rounded-xl border border-line p-4 text-sm">
            <p className="break-all font-semibold">
              {j.recipient} · {j.status}
            </p>
            <p className="text-xs text-muted">
              After {new Date(j.not_before).toLocaleString()}
              {j.result_code ? ` · ${j.result_code}` : ""}
            </p>
            {["scheduled", "blocked"].includes(j.status) && (
              <Button
                variant="subtle"
                disabled={busy}
                onClick={() =>
                  run(
                    () => cancelScheduledOutreach({ data: { id: j.id } }),
                    "Scheduled delivery cancelled.",
                  )
                }
              >
                Cancel scheduled message
              </Button>
            )}
            {["processing", "unknown"].includes(j.status) && (
              <p className="text-xs text-muted">
                Do not retry. Review Gmail and the delivery ledger first.
              </p>
            )}
          </article>
        ))}
      </div>
      {state?.replies.map((r) => (
        <p key={r.message_id} className="break-words text-sm">
          Reply from {r.recipient}: {r.classification}. Follow-up stopped. Classification uses
          conservative text rules; review Gmail before changing a booking.
        </p>
      ))}
    </section>
  );
}
