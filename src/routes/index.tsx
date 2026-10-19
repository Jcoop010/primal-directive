import { BoardPage } from "@/routes/board";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/types";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { authClient } from "@/lib/auth/client";
import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUp, LoaderCircle, Sparkles, ShieldCheck, Compass, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { askGrowthAdvisor } from "@/lib/ai";
import { hostFromUrl, longDate, money } from "@/lib/format";
import { buildAdvisorContext, useMusician } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: CommandCenterPage });
function CommandCenterPage() {
 return <div className="space-y-4">
  <div className="grid min-w-0 gap-5 2xl:grid-cols-12">
   <section id="advisor" aria-label="AI booking advisor" className="min-w-0 2xl:col-span-5 2xl:order-2">
    <AdvisorPage />
   </section>
   <section id="overview" aria-label="Booking overview" className="min-w-0 2xl:col-span-7 2xl:order-1">
    <BoardPage embedded />
   </section>
  </div>
 </div>;
}

const SUGGESTIONS = [
  {
    label: "Prioritize booking leads",
    q: "Audit my saved gig pipeline. Rank the three most urgent open opportunities using only recorded evidence, explain what is missing, and give me a concrete next action for each. Do not invent contacts, dates, guarantees, or venue availability.",
  },
  {
    label: "Find matching venues",
    q: "Act as my booking agent and research exactly three realistic venue prospects for my genre, verified draw and home market. For EACH venue, show name and city, official website, official booking submission URL or clearly NOT VERIFIED, room capacity with verification status, genre fit, and a source URL. Return each cited venue as a gig lead card for review. Finish this research now; do not instruct me to say continue or search separately. Never invent contacts, availability or guarantees.",
  },
  {
    label: "Draft booking pitch",
    q: "Write a concise personalized venue booking pitch using only my saved artist profile and booking history. Include a clear ask, realistic draw information, and placeholders for any missing EPK or contact details. Do not claim unverified accomplishments.",
  },
  {
    label: "Plan a weekend run",
    q: "Act as my booking agent and propose a realistic three-show weekend routing based on my home market, draw, and genre. Separate researched facts from estimates, highlight drive-time and budget assumptions, and list the outreach needed to confirm each date.",
  },
  {
    label: "Prepare follow-ups",
    q: "Review my open booking pipeline and draft short, professional follow-up messages for the most urgent leads. Prioritize saved negotiations and overdue outreach, avoid invented contacts or dates, and do not send messages without my approval.",
  },
];

function buildBookingPitch(venue: string, city: string, profile: { artistName: string; city: string; genre: string; draw: string }) {
  const artist = profile.artistName.trim() || "[Artist name]";
  const hometown = profile.city.trim() || "[Home market]";
  const genre = profile.genre.trim() || "original live music";
  const draw = profile.draw.trim();
  return `Subject: ${artist} — booking inquiry for ${venue}

Hello ${venue} booking team,

I'm reaching out on behalf of ${artist}, a ${genre} act based in ${hometown}. We'd love to be considered for an appropriate support slot or bill at ${venue}${city ? ` in ${city}` : ""}.

${draw ? `Our recorded draw is ${draw} in our home market; we understand another market may differ. ` : ""}Could you share your booking submission process and any suitable upcoming opportunities?

Music / live video: [add links]
EPK: [add link]
Contact: [name and reply email]

Thanks for your consideration,
${artist}`;
}

function AdvisorPage() {
  const owner = useCurrentUserState().user?.id ?? null;
  const ownerRef = useRef(owner);
  useEffect(() => {
    ownerRef.current = owner;
    return () => {
      ownerRef.current = null;
    };
  }, [owner]);
  const chat = useMusician((s) => s.chat);
  const pipelineGigs = useMusician((s) => s.gigs);
  const addUserMessage = useMusician((s) => s.addUserMessage);
  const addAiMessage = useMusician((s) => s.addAiMessage);
  const ingestSuggestedGig = useMusician((s) => s.ingestSuggestedGig);
  const ingestSuggestedPerson = useMusician((s) => s.ingestSuggestedPerson);
  const clearChat = useMusician((s) => s.clearChat);
  const [input, setInput] = useState("");
  const [selectedVenues, setSelectedVenues] = useState<string[]>([]);
  const [gmailConnection, setGmailConnection] = useState<"checking" | "connected" | "not-connected">("checking");
  const [busy, setBusy] = useState(false);
  const [answerMode, setAnswerMode] = useState<"quick" | "detailed" | "research">("quick");
  const [showMissions, setShowMissions] = useState(true);
  const [selectedMission, setSelectedMission] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat, busy]);

  useEffect(() => {
    const queued = window.sessionStorage.getItem("primal-briefing-prompt");
    if (!queued) return;
    window.sessionStorage.removeItem("primal-briefing-prompt");
    void send(queued);
    // A queued briefing is consumed only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(text: string) {
    const q = text.trim();
    const requestOwner = ownerRef.current;
    if (!q || busy || !requestOwner) return;
    const history = useMusician
      .getState()
      .chat.slice(-8)
      .map((m) => ({ role: m.role, text: m.text.slice(-12000) }));
    setInput("");
    setShowMissions(false);
    addUserMessage(q);
    setBusy(true);
    try {
      const res = await askGrowthAdvisor({
        data: {
          message: q,
          mode: answerMode,
          history,
          context: buildAdvisorContext(),
        },
      });
      if (ownerRef.current !== requestOwner) return;
      if (!res.ok) {
        addAiMessage({
          text: res.error,
          source: "ADVISOR UNAVAILABLE",
        });
      } else {
        addAiMessage({
          text: res.answer,
          source: res.source,
          citations: res.citations,
          gigs: res.gigs,
          people: res.people,
          moves: res.moves,
        });
      }
    } catch {
      if (ownerRef.current !== requestOwner) return;
      addAiMessage({
        text: "The live connector dropped. Check the board and pipeline, then try the advisor again.",
        source: "CONNECTOR",
      });
    } finally {
      if (ownerRef.current === requestOwner) setBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (!owner) {
      setGmailConnection("not-connected");
      return;
    }
    void authClient.listAccounts().then(({ data }) => {
      if (cancelled) return;
      const connected = data?.some((account) =>
        account.providerId === "google" &&
        (account.scopes || []).includes("https://www.googleapis.com/auth/gmail.send")
      );
      setGmailConnection(connected ? "connected" : "not-connected");
    }).catch(() => {
      if (!cancelled) setGmailConnection("not-connected");
    });
    return () => { cancelled = true; };
  }, [owner]);

  async function requestGmailAccess() {
    if (!owner) return;
    try {
      const result = await authClient.linkSocial({
        provider: "google",
        scopes: ["https://www.googleapis.com/auth/gmail.send"],
        callbackURL: "/",
      });
      if (result.error) toast("Gmail authorization could not start. Check Google OAuth settings.");
    } catch {
      toast("Gmail authorization unavailable.");
    }
  }

  const followUps = pipelineGigs
    .filter((gig) => ACTIVE_BOOKING_STATUSES.includes(gig.status))
    .sort((a, b) => {
      const rank = (gig: typeof a) => gig.outreachNextFollowUp || (gig.outreachLastContactedAt ? "9998" : "9997");
      return rank(a).localeCompare(rank(b));
    })
    .slice(0, 8);

  function recordContact(gigId: string) {
    const gig = useMusician.getState().gigs.find((item) => item.id === gigId);
    if (!gig) return;
    const today = new Date().toISOString().slice(0, 10);
    useMusician.getState().updateGig(gigId, {
      outreachLastContactedAt: today,
      outreachReplyStatus: "awaiting",
      ...(gig.status === "lead" ? { status: "outreach" as const } : {}),
    });
    toast("Contact date recorded. No email was sent.");
  }

  function composeFollowUpEmail(gigId: string) {
    const gig = useMusician.getState().gigs.find((item) => item.id === gigId);
    if (!gig) return;
    const email = gig.outreachEmail?.trim() || "";
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
      toast("Enter and review a booking email address first.");
      return;
    }
    const profile = useMusician.getState().profile;
    const subject = `Booking follow-up: ${profile.artistName || "[Artist]"} at ${gig.venue || gig.name}`;
    const body = `Hello,

Following up about possible booking opportunities for ${profile.artistName || "[Artist]"} at ${gig.venue || gig.name}.

Music / live video: [add links]
EPK: [add link]
Your name: [add name]`;
    const url = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
    toast("Email draft opened; sending requires your approval in your email app.");
  }

  async function copyFollowUp(gigId: string) {
    const gig = useMusician.getState().gigs.find((item) => item.id === gigId);
    if (!gig) return;
    const profile = useMusician.getState().profile;
    const draft = `Subject: Following up — ${profile.artistName || "[Artist]"} / ${gig.venue || gig.name}

Hello ${gig.bookingContactName || (gig.venue || gig.name) + " booking team"},

I'm following up on our booking inquiry for ${profile.artistName || "[Artist]"} (${profile.genre || "live music"}). Are there any suitable support slots or dates we could discuss?

Music: [add link]
EPK: [add link]
Thanks,
[Your name]`;
    try {
      await navigator.clipboard.writeText(draft);
      toast("Follow-up copied. Review before sending.");
    } catch {
      toast("Clipboard unavailable. Please use your browser copy controls.");
    }
  }

  const researchLeads = chat.flatMap((message) => message.gigs ?? []);
  const uniqueLeads = researchLeads.filter((lead, index, leads) =>
    leads.findIndex((other) => other.name === lead.name && other.venue === lead.venue && other.city === lead.city) === index
  );
  const leadKey = (lead: { name: string; venue: string; city: string }) =>
    JSON.stringify([lead.name, lead.venue, lead.city]);
  const selectedLeads = uniqueLeads.filter((lead) => selectedVenues.includes(leadKey(lead)));

  async function copyCampaign() {
    if (!selectedLeads.length) return;
    const profile = useMusician.getState().profile;
    const messages = selectedLeads.map((lead, index) =>
      `PITCH ${index + 1} — ${lead.venue || lead.name}, ${lead.city}\n\n${buildBookingPitch(lead.venue || lead.name, lead.city, profile)}`
    );
    try {
      await navigator.clipboard.writeText(messages.join("\n\n--------------------\n\n"));
      toast(`${messages.length} draft pitches copied — review before sending`);
    } catch {
      toast("Clipboard unavailable; use each card's Copy pitch button");
    }
  }

  function saveCampaignLeads() {
    const store = useMusician.getState();
    const existing = new Set(store.gigs.map((gig) => `${gig.venue.toLowerCase().trim()}|${gig.city.toLowerCase().trim()}`));
    let added = 0;
    selectedLeads.forEach((lead) => {
      const key = `${lead.venue.toLowerCase().trim()}|${lead.city.toLowerCase().trim()}`;
      if (existing.has(key)) return;
      store.ingestSuggestedGig(lead);
      existing.add(key);
      added++;
    });
    toast(`${added} new venue lead${added === 1 ? "" : "s"} added; existing pipeline venues skipped`);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <section
        className="command-surface relative isolate overflow-hidden rounded-2xl px-5 py-6 sm:px-8 sm:py-8"
        aria-label="AI Advisor introduction"
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 command-grid" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 command-glow" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-accent command-kicker">
              <Sparkles className="size-4" /> BOOKING INTELLIGENCE / YOUR NEXT SHOW
            </div>
            <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Book the right room. <span className="text-accent">Build the next tour.</span>
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-soft">
              Your AI booking agent for venue discovery, personalized pitches, follow-ups, and
              smarter routing. Work from your real artist profile and pipeline; verify venue details
              before outreach.
            </p>
          </div>
          <div className="flex flex-col gap-2 text-[11px] font-semibold text-soft">
            <span className="flex items-center gap-2 rounded-full border border-live/25 bg-live/10 px-3 py-2">
              <span className="size-2 rounded-full bg-live" /> BOOKING WORKSPACE
            </span>
            <span className="flex items-center gap-2 px-3">
              <ShieldCheck className="size-4 text-info" /> Sources require verification
            </span>
          </div>
        </div>
        <div className="relative mt-6 flex flex-wrap items-center gap-2 border-t border-line/70 pt-4">
          <button
            type="button"
            onClick={() => setShowMissions((visible) => !visible)}
            aria-expanded={showMissions}
            aria-controls="booking-missions"
            className="mr-2 flex min-h-9 items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-fg"
          >
            <Compass className="size-4" />{" "}
            {showMissions ? "Hide booking actions" : "Show booking actions"}
          </button>
          {showMissions ? (
            <div
              id="booking-missions"
              className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2"
              aria-label="Booking agent quick actions"
            >
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={s.label}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setSelectedMission(i);
                    void send(s.q);
                  }}
                  aria-label={`Start booking mission: ${s.label}`}
                  className={cn(
                    "group flex min-h-14 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors disabled:opacity-50",
                    i === 1 || selectedMission === i
                      ? "border-accent/50 bg-accent/10 text-fg hover:bg-accent/15"
                      : "border-line-strong bg-bg/75 text-soft hover:border-accent/60 hover:text-fg",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span className="text-[10px] font-bold tabular text-muted">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {s.label}
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-accent transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {uniqueLeads.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-2 p-3" aria-label="Booking campaign preparation">
          <span className="mr-auto text-xs font-semibold">
            Campaign prep · {selectedLeads.length} of {uniqueLeads.length} venues selected
          </span>
          <Button size="sm" variant="ghost" onClick={() => setSelectedVenues(uniqueLeads.map(leadKey))}>Select all</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedVenues([])}>Clear</Button>
          <Button size="sm" disabled={!selectedLeads.length} onClick={saveCampaignLeads}>Save leads</Button>
          <Button size="sm" disabled={!selectedLeads.length} onClick={() => void copyCampaign()}>Copy campaign pitches</Button>
          <span className="w-full text-[11px] text-muted">Drafts only. No messages are sent. Verify contacts and EPK links before outreach.</span>
        </div>
      ) : null}
      <details className="rounded-xl border border-line bg-surface-2 p-3">
        <summary className="cursor-pointer text-sm font-semibold">Gmail connection · {gmailConnection === "connected" ? "send permission granted" : gmailConnection === "checking" ? "checking" : "not connected"}</summary>
        <p className="mt-2 text-xs text-muted">
          Optional Google authorization for future approval-based booking outreach. Connecting grants the app permission to send Gmail messages, but this release does not send messages, read inboxes, or sync replies.
        </p>
        {gmailConnection !== "connected" ? (
          <Button size="sm" className="mt-2" disabled={!owner} onClick={() => void requestGmailAccess()}>
            Authorize Gmail sending
          </Button>
        ) : (
          <p className="mt-2 text-xs text-soft">Gmail permission recorded. Continue using reviewed email drafts; automatic sends are disabled.</p>
        )}
      </details>
      {followUps.length > 0 ? (
        <details className="rounded-xl border border-line bg-surface-2 p-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Booking follow-ups · {followUps.length} tracked
          </summary>
          <div className="mt-3 space-y-2">
            {followUps.map((gig) => (
              <div key={gig.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-bg p-2">
                <span className="mr-auto min-w-36 text-xs font-medium">
                  {gig.venue || gig.name} · {gig.city}
                  <span className="block text-[11px] text-muted">
                    {gig.outreachNextFollowUp ? `Next: ${gig.outreachNextFollowUp}${gig.outreachNextFollowUp < new Date().toISOString().slice(0, 10) ? " · overdue" : ""}` : "Follow-up not scheduled"}
                  </span>
                </span>
                <input
                  type="date"
                  aria-label={`Next follow-up date for ${gig.venue || gig.name}`}
                  className="min-h-9 rounded-md border border-line bg-bg px-2 text-xs"
                  value={gig.outreachNextFollowUp || ""}
                  onChange={(event) => useMusician.getState().updateGig(gig.id, { outreachNextFollowUp: event.target.value })}
                />
                <select
                  aria-label={`Reply status for ${gig.venue || gig.name}`}
                  className="min-h-9 rounded-md border border-line bg-bg px-2 text-xs"
                  value={gig.outreachReplyStatus || "awaiting"}
                  onChange={(event) => {
                    const status = event.target.value as "awaiting" | "interested" | "declined";
                    useMusician.getState().updateGig(gig.id, {
                      outreachReplyStatus: status,
                      outreachReplyReceivedAt: status === "awaiting" ? "" : new Date().toISOString().slice(0, 10),
                      ...(status === "interested" && gig.status === "lead" ? { status: "responded" as const } : {}),
                      ...(status === "declined" ? { status: "declined" as const, outreachNextFollowUp: "" } : {}),
                    });
                    toast("Reply status updated manually");
                  }}
                >
                  <option value="awaiting">Awaiting reply</option>
                  <option value="interested">Interested</option>
                  <option value="declined">Declined</option>
                </select>
                <input
                  type="email"
                  aria-label={`Booking email for ${gig.venue || gig.name}`}
                  placeholder="Verified booking email"
                  className="min-h-9 w-44 rounded-md border border-line bg-bg px-2 text-xs"
                  value={gig.outreachEmail || ""}
                  onChange={(event) => useMusician.getState().updateGig(gig.id, { outreachEmail: event.target.value })}
                />
                <Button size="sm" variant="ghost" onClick={() => composeFollowUpEmail(gig.id)}>Open email draft</Button>
                <Button size="sm" variant="ghost" onClick={() => void copyFollowUp(gig.id)}>Copy follow-up</Button>
                <Button size="sm" variant="ghost" onClick={() => {
                  const created = useMusician.getState().addBookingFollowUpTask(gig.id);
                  toast(created ? "Follow-up task created. Review it in Tasks before outreach." : "An open follow-up task already exists for this booking.");
                }}>Create follow-up task</Button>
                <Button size="sm" variant="ghost" onClick={() => recordContact(gig.id)}>Mark contacted</Button>
              </div>
            ))}
            <p className="text-[11px] text-muted">Reply status, dates, and contact activity are manually recorded. Opens your installed email app with a draft; does not send or sync replies.</p>
          </div>
        </details>
      ) : null}
      <Card className="command-surface flex min-h-[min(62dvh,38rem)] flex-1 flex-col overflow-hidden rounded-2xl p-0">
        <div className="flex items-center justify-between border-b border-line bg-surface/80 px-4 py-3">
          <strong className="flex items-center gap-2 text-sm">
            <span className="grid size-8 place-items-center rounded-lg bg-accent/15 text-accent">
              <Sparkles className="size-4" />
            </span>{" "}
            Primal Booking Agent
          </strong>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                clearChat();
                setSelectedMission(null);
                setShowMissions(true);
                toast("Thread cleared");
              }}
              className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted hover:text-fg"
            >
              Clear
            </button>
            <span className="text-[10px] font-bold tracking-[0.12em] text-live">
              {busy ? "WORKING" : "READY"}
            </span>
          </div>
        </div>

        <div
          role="group"
          aria-label="Response mode"
          className="flex flex-wrap gap-2 border-b border-line px-4 py-2"
        >
          {(["quick", "detailed", "research"] as const).map((mode) => (
            <button
              type="button"
              key={mode}
              aria-pressed={answerMode === mode}
              disabled={busy}
              onClick={() => setAnswerMode(mode)}
              className={cn(
                "min-h-11 rounded-lg px-3 text-sm font-semibold",
                answerMode === mode ? "bg-accent text-accent-fg" : "text-muted hover:bg-surface-2",
              )}
            >
              {mode === "quick" ? "Quick" : mode === "detailed" ? "Detailed" : "Deep research"}
            </button>
          ))}
        </div>
        <div ref={scroller} className="min-h-0 min-w-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto px-3 py-4 sm:px-6">
          {chat.map((m) => (
            <div
              key={m.id}
              data-advisor-message={m.role}
              className={cn(
                "min-w-0 max-w-full overflow-hidden break-words rounded-xl px-3 py-3 text-sm leading-relaxed whitespace-pre-wrap sm:max-w-[82%] sm:px-3.5",
                m.role === "user"
                  ? "ml-auto bg-accent font-medium text-accent-fg"
                  : "border border-line bg-surface-2 text-fg",
              )}
            >
              {m.gigs && m.gigs.length > 0 ? (
                <div className="mt-3 min-w-0 space-y-2 border-t border-line pt-3">
                  {m.gigs.map((g, i) => (
                    <div
                      key={`${g.name}-${i}`}
                      className="min-w-0 max-w-full break-words rounded-md border border-line bg-bg p-2.5"
                    >
                      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold">{g.name}</div>
                          <div className="text-xs text-muted">
                            {[g.venue, g.city].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold tabular">
                            {g.fee ? money(g.fee) : "—"}
                          </div>
                          {g.status ? <StatusBadge status={g.status} /> : null}
                        </div>
                      </div>
                      <label className="mt-2 flex items-center gap-2 text-xs font-medium text-soft">
                        <input
                          type="checkbox"
                          checked={selectedVenues.includes(leadKey(g))}
                          onChange={(event) => setSelectedVenues((current) =>
                            event.target.checked
                              ? [...new Set([...current, leadKey(g)])]
                              : current.filter((key) => key !== leadKey(g))
                          )}
                        />
                        Include in booking campaign
                      </label>
                      <p className="mt-1.5 text-xs text-soft">{g.reason}</p>
                      {g.venueCapacity && g.capacitySourceUrl ? (
                        <p className="mt-2 text-xs text-soft">
                          Capacity claim: {g.venueCapacity} ·{" "}
                          <a
                            href={g.capacitySourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent underline"
                          >
                            Review capacity source
                          </a>
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-muted">
                          Capacity not source-supported in this result.
                        </p>
                      )}
                      {g.bookingContactName && g.bookingContactSourceUrl ? (
                        <p className="mt-1 text-xs text-soft">
                          Source-cited contact: {g.bookingContactName} ·{" "}
                          <a
                            href={g.bookingContactSourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent underline"
                          >
                            Review contact source
                          </a>
                        </p>
                      ) : null}
                      {g.bookingRoute ? (
                        <a
                          href={g.bookingRoute}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex min-h-11 items-center text-xs text-accent underline"
                        >
                          Review cited booking route
                        </a>
                      ) : (
                        <p className="mt-1 text-xs text-muted">Booking route not verified.</p>
                      )}
                      {g.sourceUrl ? (
                        <a
                          href={g.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 block text-xs text-accent underline"
                        >
                          View supporting source
                        </a>
                      ) : null}
                      <p className="mt-1 text-[11px] text-muted">
                        Research lead only · Not a confirmed booking · Capacity, availability and
                        contacts require separate verification
                      </p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                        <span className="text-[11px] text-muted">
                          {longDate(g.date)} · Research prospect
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            const profile = useMusician.getState().profile;
                            const pitch = buildBookingPitch(g.venue || g.name, g.city, profile);
                            try {
                              await navigator.clipboard.writeText(pitch);
                              toast("Booking pitch copied — review links and contact before sending");
                            } catch {
                              setInput(pitch);
                              toast("Pitch inserted below — review and copy before sending");
                            }
                          }}
                        >
                          Copy pitch
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            ingestSuggestedGig(g);
                            const saved = useMusician
                              .getState()
                              .gigs.find((item) => item.name === g.name && item.venue === g.venue);
                            if (saved) useMusician.getState().openGig(saved.id);
                            toast(`Added ${g.venue || g.name}`);
                          }}
                        >
                          Add to pipeline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {m.text}
              {m.role === "ai" && m.source ? (
                <div className="mt-2 text-[9px] font-bold tracking-[0.14em] text-muted uppercase">
                  {m.source}
                </div>
              ) : null}
              {m.citations && m.citations.length > 0 ? (
                <details className="mt-2 rounded-lg border border-line bg-bg/50 p-2">
                  <summary className="cursor-pointer select-none text-xs font-medium text-accent">
                    View sources ({m.citations.length})
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.citations.map((url, index) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-line bg-bg px-2 py-1 text-[11px] font-medium text-soft underline hover:border-muted"
                      >
                        {`Source ${index + 1}: ${hostFromUrl(url)}`}
                      </a>
                    ))}
                  </div>
                </details>
              ) : null}
              {m.moves && m.moves.length > 0 ? (
                <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
                  {m.moves.map((move) => (
                    <li key={move} className="text-xs text-soft">
                      <span className="mr-2 text-accent">→</span>
                      {move}
                    </li>
                  ))}
                </ul>
              ) : null}
              {m.people && m.people.length > 0 ? (
                <div className="mt-3 space-y-2 border-t border-line pt-3">
                  {m.people.map((p, i) => (
                    <div
                      key={`${p.name}-${i}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-line bg-bg p-2.5"
                    >
                      <div>
                        <div className="text-sm font-semibold">{p.name}</div>
                        <div className="text-xs text-muted">
                          {p.role} · {p.city}
                        </div>
                        {p.sourceUrl ? (
                          <a
                            href={p.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-accent underline"
                          >
                            View supporting source
                          </a>
                        ) : null}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          ingestSuggestedPerson(p);
                          toast(`Added ${p.name}`);
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {busy ? (
            <div className="flex max-w-[88%] items-center gap-2 rounded-lg border border-line bg-surface-2 px-3.5 py-3 text-sm text-muted">
              <LoaderCircle className="size-4 animate-spin text-accent" />
              Working on your booking request…
            </div>
          ) : null}
        </div>

        <div className="flex max-w-full gap-2 overflow-x-auto overscroll-x-contain px-3 pb-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              type="button"
              disabled={busy}
              onClick={() => send(s.q)}
              className="shrink-0 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[10px] font-semibold text-soft hover:border-muted disabled:opacity-50"
            >
              {s.label}
            </button>
          ))}
        </div>

        <form
          className="flex gap-2 border-t border-line bg-surface/80 p-3 sm:p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about growth, rooms, bills, routing…"
            className="h-11 min-w-0 flex-1 rounded-xl border border-line-strong bg-bg px-3 text-sm outline-none placeholder:text-muted focus:border-muted"
            autoComplete="off"
          />
          <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send">
            <ArrowUp className="size-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
}
