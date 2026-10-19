import { BookingSummary } from "@/components/booking-summary";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/types";
import { useEffect, useRef, useState } from "react";
import { researchSavedVenue } from "@/lib/venue-research-api";
import { researchStatus, venueEvidenceSources } from "@/lib/venue-research";
import type { Gig } from "@/lib/types";
import { LayoutGrid, List, Search, CalendarClock } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, Eyebrow } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { downloadCsv, money } from "@/lib/format";
import { pipelineValue, useMusician } from "@/lib/store";
import {
  GIG_STATUS_LABEL,
  GIG_STATUSES,
  type GigStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const hasResearchableVenue = (gig: Gig) => Boolean(gig.city?.trim() && (gig.venue || gig.name)?.trim() && !/^(test|testing|demo|sample|untitled|unknown|tbd|n\/a)$/i.test((gig.venue || gig.name).trim()));

export const Route = createFileRoute("/gigs")({ component: GigsPage });

function GigsPage() {
  const gigs = useMusician((s) => s.gigs);
  const ownerId = useMusician((s) => s.workspaceOwnerId);
  const openGig = useMusician((s) => s.openGig);
  const updateGig = useMusician((s) => s.updateGig);
  const [filter, setFilter] = useState<"all" | GigStatus>("all");
  const [view, setView] = useState<"board" | "list">("board");
  const [query, setQuery] = useState("");
  const [researchId, setResearchId] = useState<string | null>(null);
  const [researchResult, setResearchResult] = useState<{ id: string; answer: string; citations: string[]; source: string; leadUrl?: string; evidence?: { venueCapacity?: number; capacitySourceUrl?: string; bookingRoute?: string; bookingContactName?: string; bookingContactSourceUrl?: string } } | null>(null);
  const [researchError, setResearchError] = useState("");
  const [autoResearchStatus, setAutoResearchStatus] = useState("");
  const attempted = useRef(new Set<string>());
  const inFlight = useRef(false);
  async function researchVenue(g: Gig) {
    const owner = useMusician.getState().workspaceOwnerId;
    if (!owner || inFlight.current || !hasResearchableVenue(g)) return;
    inFlight.current = true;
    setResearchId(g.id);
    setResearchResult(null);
    setResearchError("");
    updateGig(g.id, {venueResearchStatus:"Researching", venueResearchError:""});
    const isCurrent = () => {
      const state = useMusician.getState();
      const saved = state.gigs.find(item => item.id === g.id);
      return state.workspaceOwnerId === owner && saved && saved.venue === g.venue && saved.name === g.name && saved.city === g.city;
    };
    try {
      const response = await researchSavedVenue({data:{venue:g.venue || g.name,city:g.city}});
      if (!isCurrent()) return;
      const evidence = response.evidence;
      const saved = useMusician.getState().gigs.find(item => item.id === g.id)!;
      const merged = {...saved,...evidence};
      const status = researchStatus(merged,true);
      const error = status === "Research unavailable" ? "No verified source found. You can retry later." : "";
      updateGig(g.id, {...evidence,venueResearchStatus:status,venueResearchError:error,venueResearchedAt:new Date().toISOString(),
        ...(venueEvidenceSources(evidence)[0] ? {researchSourceUrl:venueEvidenceSources(evidence)[0]} : {})});
      setResearchResult({id:g.id,answer:response.message,citations:response.citations,source:"Source-supported research",evidence});
    } catch(error) {
      if (!isCurrent()) return;
      const message = error instanceof Error ? error.message : "Research failed. Check your connection and retry.";
      setResearchError(message);
      updateGig(g.id,{venueResearchStatus:researchStatus(g,true),venueResearchError:message.slice(0,2000)});
    } finally {
      inFlight.current = false;
      setResearchId(null);
    }
  }

  // Wait for the authenticated database snapshot, never the browser's previous account cache.
  // One automatic attempt per saved venue per visit (up to 3), sequentially to avoid provider bursts; explicit retry remains available.
  useEffect(() => {
    if (!ownerId || inFlight.current || attempted.current.size >= 3) return;
    const gig = gigs.find(g => hasResearchableVenue(g) && researchStatus(g) !== "Verified" && (!g.venueResearchedAt || Date.now() - Date.parse(g.venueResearchedAt) >= 86400000) && !attempted.current.has(ownerId + ":" + g.id));
    if (!gig) return;
    attempted.current.add(ownerId + ":" + gig.id);
    setAutoResearchStatus("Finding cited details for " + (gig.venue || gig.name));
    void researchVenue(gig).finally(() => { const latest = useMusician.getState().gigs.find(item => item.id === gig.id); const status = latest ? researchStatus(latest) : "Not researched"; setAutoResearchStatus(status === "Verified" ? "Verified venue details saved for " + (gig.venue || gig.name) + "." : status === "Partially verified" ? "Some venue facts verified for " + (gig.venue || gig.name) + ". Review missing details." : "No source-verified facts were saved for " + (gig.venue || gig.name) + ". Select Find & fill details to retry."); });
    // Changes caused by saving evidence advance the bounded queue; inFlight prevents overlaps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, gigs, researchId]);

  const [followUpOnly, setFollowUpOnly] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const active = gigs.filter((g) => ACTIVE_BOOKING_STATUSES.includes(g.status));
  const due = active.filter((g) => g.outreachNextFollowUp && g.outreachNextFollowUp <= today);
  const sourced = active.filter((g) => Boolean(g.researchSourceUrl));
  const unsourced = active.filter((g) => !g.researchSourceUrl);
  const missingContact = active.filter((g) => !g.outreachContact?.trim() && !(g.bookingContactName && g.bookingContactSourceUrl));
  const [attentionFilter, setAttentionFilter] = useState<"all" | "unsourced" | "contact">("all");

  const filtered = filter === "all" ? gigs : gigs.filter((g) => g.status === filter);
  const shown = filtered.filter((g) => (!followUpOnly || (ACTIVE_BOOKING_STATUSES.includes(g.status) && Boolean(g.outreachNextFollowUp && g.outreachNextFollowUp <= today))) && (attentionFilter === "all" || (ACTIVE_BOOKING_STATUSES.includes(g.status) && (attentionFilter === "unsourced" ? !g.researchSourceUrl : (!g.outreachContact?.trim() && !(g.bookingContactName && g.bookingContactSourceUrl))))) && [g.name, g.venue, g.city, g.outreachContact].join(" ").toLowerCase().includes(query.trim().toLowerCase()));

  // Build the board groups from the same filtered records rendered in their cards.
  // Otherwise search and attention filters leave unrelated empty stage columns visible.
  const visibleStages = GIG_STATUSES.filter(status => filter === status || (filter === "all" && (shown.some(gig => gig.status === status) || (gigs.length === 0 && status === "lead"))));

  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3 px-1">
        <Eyebrow>Gig pipeline</Eyebrow>
        <button
          type="button"
          className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted hover:text-fg"
          onClick={() =>
            downloadCsv("gigs.csv", [
              ["name", "venue", "city", "date", "fee", "confidence", "status", "notes", "research_source_url", "source_reviewed_at", "outreach_contact", "last_contacted_at", "next_follow_up", "outreach_notes"],
              ...gigs.map((g) => [
                g.name, g.venue, g.city, g.date,
                g.fee > 0 ? String(g.fee) : "",
                String(g.conf), g.status, g.notes,
                g.researchSourceUrl || "", g.researchVerifiedAt || "",
                g.outreachContact || "", g.outreachLastContactedAt || "",
                g.outreachNextFollowUp || "", g.outreachNotes || "",
              ]),
            ])
          }
        >
          Export CSV
        </button>
      </div>
      <p className="mb-3 px-1 text-xs text-muted">
        {money(pipelineValue(gigs))} open · {gigs.length} total
      </p>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div><div className="font-display text-xl font-bold">Opportunity workspace</div><p className="mt-1 text-xs text-muted">Leads are not confirmed bookings.</p></div>
        <div className="inline-flex rounded-xl border border-line-strong bg-surface p-1" aria-label="Booking display mode">
          <button type="button" aria-pressed={view === "board"} onClick={() => setView("board")} className={cn("inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold", view === "board" ? "bg-accent text-accent-fg" : "text-muted hover:text-fg")}><LayoutGrid className="size-4" /> Board</button>
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")} className={cn("inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold", view === "list" ? "bg-accent text-accent-fg" : "text-muted hover:text-fg")}><List className="size-4" /> List</button>
        </div>
      </div>
      <section aria-label="Booking pipeline health" className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="command-surface rounded-xl p-3 sm:p-4"><div className="command-kicker text-muted">Active leads</div><div className="mt-2 font-display text-3xl font-extrabold tabular text-info">{active.length}</div><p className="mt-1 text-xs text-muted">Not confirmed bookings</p></div>
        <div className="command-surface rounded-xl p-4"><div className="command-kicker text-muted">Follow-ups due</div><div className="mt-2 font-display text-3xl font-extrabold tabular text-accent">{due.length}</div><p className="mt-1 text-xs text-muted">Due today or overdue</p></div>
        <div className="command-surface hidden rounded-xl p-3 md:block"><div className="command-kicker text-muted">Source recorded</div><div className="mt-2 font-display text-3xl font-extrabold tabular">{sourced.length}<span className="text-sm text-muted"> / {active.length}</span></div><p className="mt-1 text-xs text-muted">Source recorded ≠ verified</p></div>
        <div className="command-surface hidden rounded-xl p-4 md:block"><div className="command-kicker text-muted">Open pipeline</div><div className="mt-2 font-display text-2xl font-extrabold tabular text-live">{money(pipelineValue(gigs))}</div><p className="mt-1 text-xs text-muted">Unconfirmed opportunity value</p></div>
      </section>
      <section aria-label="Booking action queue" className="mb-4 hidden rounded-2xl border border-line-strong bg-surface p-4 lg:block">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-display text-base font-bold">Action queue</div><p className="mt-1 text-xs text-muted">Review missing information before outreach.</p></div><button type="button" className="text-xs font-semibold text-accent hover:underline" onClick={() => { setAttentionFilter("all"); setFollowUpOnly(false); setFilter("all"); setQuery(""); }}>Clear filters</button></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <button type="button" aria-pressed={followUpOnly} onClick={() => {setFollowUpOnly(true);setAttentionFilter("all");setFilter("all");}} className="rounded-xl border border-line bg-bg/70 p-3 text-left hover:border-accent/50"><div className="text-2xl font-bold tabular text-accent">{due.length}</div><div className="mt-1 text-xs font-semibold">Follow-ups due</div><div className="mt-1 text-[11px] text-muted">Due today or overdue</div></button>
          <button type="button" aria-pressed={attentionFilter === "unsourced"} onClick={() => {setAttentionFilter("unsourced");setFollowUpOnly(false);setFilter("all");}} className="rounded-xl border border-line bg-bg/70 p-3 text-left hover:border-accent/50"><div className="text-2xl font-bold tabular text-warn">{unsourced.length}</div><div className="mt-1 text-xs font-semibold">Source missing</div><div className="mt-1 text-[11px] text-muted">Active leads without a research URL</div></button>
          <button type="button" aria-pressed={attentionFilter === "contact"} onClick={() => {setAttentionFilter("contact");setFollowUpOnly(false);setFilter("all");}} className="rounded-xl border border-line bg-bg/70 p-3 text-left hover:border-accent/50"><div className="text-2xl font-bold tabular text-info">{missingContact.length}</div><div className="mt-1 text-xs font-semibold">Contact missing</div><div className="mt-1 text-[11px] text-muted">Active leads needing a contact</div></button>
        </div>
      </section>
      <label className="mb-3 flex min-h-11 items-center gap-3 rounded-xl border border-line-strong bg-surface px-4 text-sm text-muted"><Search className="size-4 shrink-0" /><span className="sr-only">Search bookings</span><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search venue, city, opportunity, or contact…" className="min-w-0 w-full bg-transparent text-fg outline-none placeholder:text-muted" /></label>
      <button type="button" aria-pressed={followUpOnly} onClick={() => {setFollowUpOnly((value) => !value);setAttentionFilter("all");}} className={cn("mb-3 rounded-lg border px-3 py-2 text-xs font-semibold", followUpOnly ? "border-accent bg-accent/10 text-accent" : "border-line text-muted hover:text-fg")}>Follow-ups due ({due.length}) {followUpOnly ? "· Showing due" : "· Show only"}</button>
      <label className="mb-4 flex items-center gap-2 text-sm md:hidden"><span className="shrink-0 text-muted">Stage</span><select aria-label="Filter booking stage" value={filter} onChange={e => setFilter(e.target.value as "all" | GigStatus)} className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3"><option value="all">All stages</option>{GIG_STATUSES.map(status => <option key={status} value={status}>{GIG_STATUS_LABEL[status]}</option>)}</select></label>
      <div className="mb-5 hidden flex-wrap gap-2 pb-2 md:flex">
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label="All"
        />
        {GIG_STATUSES.map((s) => (
          <FilterChip
            key={s}
            active={filter === s}
            onClick={() => setFilter(s)}
            label={GIG_STATUS_LABEL[s]}
          />
        ))}
      </div>
      {gigs.some((g) => g.outreachNextFollowUp && ACTIVE_BOOKING_STATUSES.includes(g.status)) && <Card className="command-surface mb-5 hidden p-5 sm:p-6 md:block">
        <div className="flex items-center gap-2 font-display text-lg font-bold"><CalendarClock className="size-5 text-accent" /> Upcoming booking follow-ups</div>
        <p className="mt-1 text-xs text-muted">Scheduled reminders only; no emails or messages are sent automatically.</p>
        {gigs.filter((g) => g.outreachNextFollowUp && ACTIVE_BOOKING_STATUSES.includes(g.status)).sort((a,b) => (a.outreachNextFollowUp || "").localeCompare(b.outreachNextFollowUp || "")).slice(0,6).map((g) => (
          <button key={g.id} type="button" onClick={() => openGig(g.id)} className="mt-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-line bg-bg/70 px-4 py-3 text-left text-xs transition-colors hover:border-accent/50 hover:bg-surface-2">
            <span>{g.venue || g.name}</span><span>{g.outreachNextFollowUp}</span>
          </button>
        ))}
      </Card>}
      {autoResearchStatus && <p role="status" className="mb-3 px-1 text-xs text-muted">{autoResearchStatus}</p>}
      {view === "board" ? (
        <section aria-label="Booking pipeline board" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleStages.length === 0 && <div className="command-surface rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">No opportunities match the current filters.</div>}
          {visibleStages.map((status) => {
            const items = shown.filter((gig) => gig.status === status);
            return <div key={status} className={cn("command-surface min-w-0 rounded-2xl p-3", items.length === 0 && (shown.length > 0 || status !== (filter === 'all' ? 'lead' : filter)) && "hidden md:block")}>
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-line pb-3"><h2 className="text-xs font-bold uppercase tracking-wider text-soft">{GIG_STATUS_LABEL[status]}</h2><span className="rounded-full bg-surface-2 px-2 py-1 text-[11px] font-bold tabular text-muted">{items.length}</span></div>
              <div className="space-y-2">
                {items.map((gig) => <div key={gig.id} className="overflow-hidden rounded-xl border border-line bg-bg/80"><button type="button" onClick={() => openGig(gig.id)} className="w-full rounded-xl border border-line bg-bg/80 p-3 text-left transition-colors hover:border-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                  <BookingSummary gig={gig} today={today} />
                </button>
                <details className="px-3 pb-3 text-xs"><summary className="cursor-pointer py-2 text-muted hover:text-accent">More details & venue evidence</summary>
                  <div className="mb-3 grid grid-cols-2 gap-3 rounded-lg border border-line bg-surface-2/40 p-3 text-[11px]">
                    <div><span className="text-muted">Outreach contact</span><div className="break-words font-semibold">{gig.outreachContact || "Not recorded"}</div></div>
                    <div><span className="text-muted">Last contacted</span><div className="font-semibold">{gig.outreachLastContactedAt || "Not recorded"}</div></div>
                    <div><span className="text-muted">Capacity</span><div className="font-semibold">{gig.venueCapacity && gig.capacitySourceUrl ? gig.venueCapacity.toLocaleString() : "Not verified"}</div></div>
                    <div><span className="text-muted">Next follow-up</span><div className="font-semibold">{gig.outreachNextFollowUp || "Not scheduled"}</div></div>
                  </div>
                  {!hasResearchableVenue(gig) && <p className="mb-2 text-xs text-muted">Add the venue name and city to enable research.</p>}
                  {!hasResearchableVenue(gig) ? <button type="button" onClick={() => openGig(gig.id)} className="min-h-11 rounded-lg border border-accent/60 bg-accent/10 px-3 py-1.5 text-[11px] font-semibold text-accent">Add venue details</button> : <button type="button" disabled={researchId !== null || !ownerId} onClick={() => void researchVenue(gig)} className="min-h-11 rounded-lg border border-accent/60 bg-accent/10 px-3 py-1.5 text-[11px] font-semibold text-accent disabled:opacity-50">{researchId === gig.id ? "Researching venue…" : gig.venueResearchedAt ? "Retry research" : "Find & fill details"}</button>}
                  {hasResearchableVenue(gig) && gig.venueResearchError && <details className="mt-2 text-xs text-muted"><summary className="cursor-pointer">Research details</summary><p className="mt-2 break-words">{gig.venueResearchError}</p></details>}
                  {gig.venueCapacity && <p className="mt-2 text-xs text-muted">Capacity may depend on the room and layout. Review the source before outreach.</p>}
                  {venueEvidenceSources(gig).length > 0 && <details className="mt-2 text-xs"><summary className="min-h-11 cursor-pointer py-3 text-accent">View source evidence</summary>{venueEvidenceSources(gig).map(url => <a key={url} href={url} target="_blank" rel="noopener noreferrer" title={url} className="block break-all py-2 text-accent underline">{url}</a>)}</details>}
                  {researchResult?.id === gig.id && <div className="mt-3 space-y-2 text-xs">
                    <p className="whitespace-pre-wrap text-muted">{researchResult.answer}</p>
                    {researchResult.citations.length ? researchResult.citations.slice(0, 8).map((url) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block break-all text-accent underline">{url}</a>) : <p className="text-warn">No cited live sources. Research remains unverified.</p>}
                    {researchResult.evidence && <div className="rounded-lg border border-line p-3 text-xs">
                      <div className="font-semibold">Source-supported venue details</div>
                      <div className="mt-2">Capacity: {researchResult.evidence.venueCapacity ?? "Not verified"}</div>
                      <div>Booking contact: {researchResult.evidence.bookingContactName ?? "Not verified"}</div>
                      <div>Booking route: {researchResult.evidence.bookingRoute ? "Cited booking page available" : "Not verified"}</div>
                      {researchResult.evidence.bookingRoute && <a className="mt-1 block break-all text-accent underline" href={researchResult.evidence.bookingRoute} target="_blank" rel="noopener noreferrer">Open cited booking route ↗</a>}
                      <button type="button" className="mt-3 min-h-10 rounded-lg border border-accent px-3 py-2 font-semibold text-accent" onClick={() => updateGig(gig.id, { ...(researchResult.evidence?.venueCapacity && researchResult.evidence.capacitySourceUrl ? { venueCapacity: researchResult.evidence.venueCapacity, capacitySourceUrl: researchResult.evidence.capacitySourceUrl } : {}), ...(researchResult.evidence?.bookingContactName && researchResult.evidence.bookingContactSourceUrl ? { bookingContactName: researchResult.evidence.bookingContactName, bookingContactSourceUrl: researchResult.evidence.bookingContactSourceUrl } : {}), ...(researchResult.evidence?.bookingRoute ? { bookingRoute: researchResult.evidence.bookingRoute } : {}) })}>Save cited venue details</button>
                    </div>}
                    {researchResult.leadUrl && <button type="button" onClick={() => updateGig(gig.id, {researchSourceUrl: researchResult.leadUrl, researchVerifiedAt: ""})} className="min-h-11 w-full rounded-lg border border-accent px-3 py-2 font-semibold text-accent">Save cited source for review</button>}
                  </div>}
                  {researchError && !researchId && researchResult?.id === gig.id && <p role="alert" className="mt-2 text-xs text-warn">{researchError}</p>}
                </details></div>)}
                {items.length === 0 ? <div className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-muted">No opportunities</div> : null}
              </div>
            </div>;
          })}
        </section>
      ) : <Card className="command-surface overflow-hidden p-0">
        {shown.length === 0 ? (
          <EmptyState
            title="No gigs yet"
            body="Use the advisor to surface rooms, or add an opportunity yourself."
            action="Add gig"
            onAction={() => openGig()}
          />
        ) : (
          shown.map((g, i) => (
            <div key={g.id} className="border-b border-line">
            <button
              type="button"
              onClick={() => openGig(g.id)}
              className={cn(
                "w-full px-5 py-5 text-left transition-colors hover:bg-surface-2",
                i < shown.length - 1 && "border-b border-line",
              )}
            >
              <BookingSummary gig={g} today={today} />
            </button>
            <details className="px-5 pb-4 text-xs">
              <summary className="cursor-pointer text-accent">Research & outreach</summary>
              <p className="my-2 text-muted">{g.researchVerifiedAt ? "Source reviewed on " + g.researchVerifiedAt : "Research not independently verified. Do not assume contact, availability or booking terms are confirmed."}</p>
              <div className="my-3 grid grid-cols-2 gap-2 rounded-lg border border-line p-3 sm:grid-cols-3">
                <div><span className="text-muted">Stage</span><div className="font-semibold">{GIG_STATUS_LABEL[g.status]}</div></div>
                <div><span className="text-muted">Capacity</span><div className="font-semibold">{g.venueCapacity && g.capacitySourceUrl ? g.venueCapacity.toLocaleString() : "Not verified"}</div></div>
                <div><span className="text-muted">Booking contact</span><div className="break-words font-semibold">{g.bookingContactName && g.bookingContactSourceUrl ? g.bookingContactName : "Not verified"}</div></div>
                <div><span className="text-muted">Booking route</span><div className="font-semibold">{g.bookingRoute ? "Source-supported" : "Not verified"}</div></div>
                <div><span className="text-muted">Last contacted</span><div className="font-semibold">{g.outreachLastContactedAt || "Not recorded"}</div></div>
                <div><span className="text-muted">Next follow-up</span><div className="font-semibold">{g.outreachNextFollowUp || "Not scheduled"}</div></div>
                {venueEvidenceSources(g).length > 0 && <div className="col-span-2 sm:col-span-3"><span className="text-muted">Evidence</span>{venueEvidenceSources(g).map(url => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block break-all text-accent underline">{url}</a>)}</div>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>Contact<input aria-label="Booking contact" className="mt-1 w-full rounded border border-line bg-surface p-2" value={g.outreachContact || ""} onChange={(e) => updateGig(g.id, {outreachContact:e.target.value})}/></label>
                <label>Follow-up date<input aria-label="Follow-up date" type="date" className="mt-1 w-full rounded border border-line bg-surface p-2" value={g.outreachNextFollowUp || ""} onChange={(e) => updateGig(g.id, {outreachNextFollowUp:e.target.value})}/></label>
                <label>Last contacted<input aria-label="Last contacted" type="date" className="mt-1 w-full rounded border border-line bg-surface p-2" value={g.outreachLastContactedAt || ""} onChange={(e) => updateGig(g.id, {outreachLastContactedAt:e.target.value})}/></label>
                <button type="button" disabled={researchId !== null} className="rounded border border-accent/40 bg-accent/10 px-3 py-2 font-semibold text-accent disabled:opacity-50" onClick={() => void researchVenue(g)}>{researchId === g.id ? "Researching official sources…" : "Research venue with AI"}</button>
                <button type="button" className="rounded border border-accent/40 bg-accent/10 px-3 py-2 text-accent hover:bg-accent/20" onClick={() => { const search = [g.venue || g.name, g.city, "official venue booking contact"].filter(Boolean).join(" "); window.open("https://www.google.com/search?q=" + encodeURIComponent(search), "_blank", "noopener,noreferrer"); }}>Find official venue source ↗</button>
                {researchResult?.id === g.id && <div className="sm:col-span-2 rounded-lg border border-line bg-surface-2 p-3">
                  <div className="font-semibold">Research findings · {researchResult.source}</div>
                  <p className="mt-2 whitespace-pre-wrap text-muted">{researchResult.answer}</p>
                  {researchResult.citations.length ? <div className="mt-3 space-y-1"><div className="font-semibold">Retrieved sources (review before use)</div>{researchResult.citations.slice(0, 8).map((url) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block break-all text-accent underline">{url}</a>)}</div> : <p className="mt-2 text-warn">No cited live sources returned. Research remains unverified.</p>}
                  {researchResult.leadUrl && <button type="button" className="mt-3 rounded border border-accent/40 px-3 py-2 text-accent" onClick={() => updateGig(g.id, { researchSourceUrl: researchResult.leadUrl, researchVerifiedAt: "" })}>Save cited source for manual review</button>}
                </div>}
                {researchError && !researchId && <p role="alert" className="sm:col-span-2 text-warn">{researchError}</p>}
                <label>Research URL<input aria-label="Research URL" type="url" className="mt-1 w-full rounded border border-line bg-surface p-2" value={g.researchSourceUrl || ""} onChange={(e) => updateGig(g.id, {researchSourceUrl:e.target.value,researchVerifiedAt:""})}/></label>
                <label className="sm:col-span-2">Outreach notes<textarea aria-label="Outreach notes" rows={2} className="mt-1 w-full rounded border border-line bg-surface p-2" value={g.outreachNotes || ""} onChange={(e) => updateGig(g.id, {outreachNotes:e.target.value})}/></label>
                <a href={g.researchSourceUrl || undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!g.researchSourceUrl} onClick={(event) => { if (!g.researchSourceUrl) event.preventDefault(); }} className={cn("rounded border border-line px-3 py-2 text-center", !g.researchSourceUrl && "pointer-events-none opacity-40")}>Open research source ↗</a>
                <button type="button" disabled={!/^https?:\/\/[^\s]+$/i.test(g.researchSourceUrl || "")} className="rounded border border-line px-3 py-2 disabled:opacity-40" onClick={() => updateGig(g.id, {researchVerifiedAt:new Date().toISOString().slice(0,10)})}>I reviewed this source</button>
              </div>
              <div className="mt-4 rounded-xl border border-line bg-surface-2 p-3">
                <div className="font-semibold text-fg">Booking outreach assistant</div>
                <p className="mt-1 text-muted">Create a reviewable first-contact draft from your saved lead. Confirm venue details and the recipient before sending. No message is sent by Primal Directive.</p>
                <button type="button" className="mt-3 min-h-10 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 font-semibold text-accent hover:bg-accent/20" onClick={() => {
                  const artist = useMusician.getState().profile.artistName || "our band";
                  const venue = g.venue || g.name;
                  const subject = "Booking inquiry — " + artist + " / " + venue;
                  const body = "Hello,\n\nI'm reaching out on behalf of " + artist + " to ask about potential booking opportunities at " + venue + (g.city ? " in " + g.city : "") + ". We'd love to learn about your submission process and any appropriate upcoming dates.\n\nHappy to share our EPK, live footage, and recent draw information if useful.\n\nThanks for your consideration,\n" + artist;
                  const draft = "Subject: " + subject + "\n\n" + body;
                  if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(draft).catch(() => {});
                  updateGig(g.id, {outreachNotes: [g.outreachNotes, "DRAFT (not sent) — " + new Date().toISOString().slice(0,10) + "\n" + draft].filter(Boolean).join("\n\n")});
                }}>Prepare draft and copy</button>
                <p className="mt-2 text-muted">Draft is saved to outreach notes when prepared. Select and copy from notes if clipboard access is unavailable.</p>
              </div>
              <p className="mt-2 text-muted">Manual record only; no messages are sent automatically.</p>
            </details>
            </div>
          ))
        )}
      </Card>}
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
        active
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-line bg-surface text-muted hover:border-line-strong hover:text-fg",
      )}
    >
      {label}
    </button>
  );
}
