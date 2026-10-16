import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUp, LoaderCircle, Sparkles, ShieldCheck, Compass, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { askGrowthAdvisor } from "@/lib/ai";
import { hostFromUrl, longDate, money } from "@/lib/format";
import { buildAdvisorContext, useMusician } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: AdvisorPage });

const SUGGESTIONS = [
  {
    label: "Prioritize booking leads",
    q: "Audit my saved gig pipeline. Rank the three most urgent open opportunities using only recorded evidence, explain what is missing, and give me a concrete next action for each. Do not invent contacts, dates, guarantees, or venue availability.",
  },
  {
    label: "Find matching venues",
    q: "Act as my booking agent: identify realistic venue prospects for my genre, draw, and home market. Include official venue URLs when supported, mark capacity and booking contacts unverified unless confirmed by sources, and do not invent availability or guarantees.",
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

function AdvisorPage() {
  const chat = useMusician((s) => s.chat);
  const addUserMessage = useMusician((s) => s.addUserMessage);
  const addAiMessage = useMusician((s) => s.addAiMessage);
  const ingestSuggestedGig = useMusician((s) => s.ingestSuggestedGig);
  const ingestSuggestedPerson = useMusician((s) => s.ingestSuggestedPerson);
  const clearChat = useMusician((s) => s.clearChat);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
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
    if (!q || busy) return;
    setInput("");
    addUserMessage(q);
    setBusy(true);
    try {
      const history = useMusician.getState().chat.slice(-8).map((m) => ({
        role: m.role,
        text: m.text,
      }));
      const res = await askGrowthAdvisor({
        data: {
          message: q,
          history,
          context: buildAdvisorContext(),
        },
      });
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
      addAiMessage({
        text: "The live connector dropped. Check the board and pipeline, then try the advisor again.",
        source: "CONNECTOR",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <section className="command-surface relative isolate overflow-hidden rounded-2xl px-5 py-6 sm:px-8 sm:py-8" aria-label="AI Advisor introduction">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 command-grid" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 command-glow" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-accent command-kicker"><Sparkles className="size-4" /> BOOKING INTELLIGENCE / YOUR NEXT SHOW</div>
            <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Book the right room. <span className="text-accent">Build the next tour.</span></h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-soft">Your AI booking agent for venue discovery, personalized pitches, follow-ups, and smarter routing. Work from your real artist profile and pipeline; verify venue details before outreach.</p>
          </div>
          <div className="flex flex-col gap-2 text-[11px] font-semibold text-soft">
            <span className="flex items-center gap-2 rounded-full border border-live/25 bg-live/10 px-3 py-2"><span className="size-2 rounded-full bg-live" /> BOOKING WORKSPACE</span>
            <span className="flex items-center gap-2 px-3"><ShieldCheck className="size-4 text-info" /> Sources require verification</span>
          </div>
        </div>
        <div className="relative mt-6 flex flex-wrap items-center gap-2 border-t border-line/70 pt-4">
          <span className="mr-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted"><Compass className="size-4" /> Start booking</span>
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="Booking agent quick actions">
            {SUGGESTIONS.map((s, i) => <button key={s.label} type="button" disabled={busy} onClick={() => void send(s.q)} className={cn("group flex min-h-14 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors disabled:opacity-50", i === 1 ? "border-accent/50 bg-accent/10 text-fg hover:bg-accent/15" : "border-line-strong bg-bg/75 text-soft hover:border-accent/60 hover:text-fg")}><span className="flex items-center gap-3"><span className="text-[10px] font-bold tabular text-muted">{String(i + 1).padStart(2, "0")}</span>{s.label}</span><ArrowUpRight className="size-4 shrink-0 text-accent transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></button>)}
          </div>
        </div>
      </section>

      <Card className="command-surface flex min-h-[min(62dvh,38rem)] flex-1 flex-col overflow-hidden rounded-2xl p-0">
        <div className="flex items-center justify-between border-b border-line bg-surface/80 px-4 py-3">
          <strong className="flex items-center gap-2 text-sm"><span className="grid size-8 place-items-center rounded-lg bg-accent/15 text-accent"><Sparkles className="size-4" /></span> Primal Booking Agent</strong>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                clearChat();
                toast("Thread cleared");
              }}
              className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted hover:text-fg"
            >
              Clear
            </button>
            <span className="text-[10px] font-bold tracking-[0.12em] text-live">
              {busy ? "SEARCHING" : "READY"}
            </span>
          </div>
        </div>

        <div ref={scroller} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
          {chat.map((m) => (
            <div
              key={m.id}
              className={cn(
                "max-w-[95%] rounded-xl sm:max-w-[82%] px-3.5 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                m.role === "user"
                  ? "ml-auto bg-accent font-medium text-accent-fg"
                  : "border border-line bg-surface-2 text-fg",
              )}
            >
              {m.text}
              {m.role === "ai" && m.source ? (
                <div className="mt-2 text-[9px] font-bold tracking-[0.14em] text-muted uppercase">
                  {m.source}
                </div>
              ) : null}
              {m.citations && m.citations.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.citations.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-line bg-bg px-2 py-0.5 text-[10px] font-medium text-soft hover:border-muted"
                    >
                      {hostFromUrl(url)}
                    </a>
                  ))}
                </div>
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
              {m.gigs && m.gigs.length > 0 ? (
                <div className="mt-3 space-y-2 border-t border-line pt-3">
                  {m.gigs.map((g, i) => (
                    <div
                      key={`${g.name}-${i}`}
                      className="rounded-md border border-line bg-bg p-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
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
                      <p className="mt-1.5 text-xs text-soft">{g.reason}</p>
                      {g.sourceUrl ? <a href={g.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block text-xs text-accent underline">View supporting source</a> : null}
                      <p className="mt-1 text-[11px] text-muted">Research lead only · Not a confirmed booking · Capacity, availability and contacts require separate verification</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[11px] text-muted">
                          {longDate(g.date)} · {Math.round(g.conf * 100)}%
                        </span>
                        <Button
                          size="sm"
                          onClick={() => {
                            ingestSuggestedGig(g);
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
                        {p.sourceUrl ? <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-accent underline">View supporting source</a> : null}
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
              Searching the live web…
            </div>
          ) : null}
        </div>

        <div className="flex gap-2 overflow-x-auto px-3 pb-2">
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
          <Button
            type="submit"
            size="icon"
            disabled={busy || !input.trim()}
            aria-label="Send"
          >
            <ArrowUp className="size-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
}
