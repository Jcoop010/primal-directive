import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUp, LoaderCircle } from "lucide-react";
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
    label: "Grow local draw",
    q: "How do we grow our local draw in the next 90 days given our current pipeline and home city?",
  },
  {
    label: "Build a 3-band bill",
    q: "Build me a realistic 3-band bill for a 250-cap room that fits our sound and draw.",
  },
  {
    label: "Northeast routing",
    q: "Find regional routing opportunities in the Northeast so we are not driving six hours for one gig.",
  },
  {
    label: "Content that sells tickets",
    q: "What should we post this month that actually grows fans and ticket sales, not vanity metrics?",
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
    <div className="flex min-h-0 flex-1 flex-col">
      <Eyebrow>Growth advisor</Eyebrow>
      <Card className="mb-3">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Grow the band — not just the calendar.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Ask in plain English. The advisor searches the live web and reads your
          pipeline so advice fits this band, this city, this week.
        </p>
      </Card>

      <Card className="flex min-h-[28rem] flex-1 flex-col overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <strong className="text-sm">Musician OS AI</strong>
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

        <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
          {chat.map((m) => (
            <div
              key={m.id}
              className={cn(
                "max-w-[88%] rounded-lg px-3.5 py-3 text-sm leading-relaxed whitespace-pre-wrap",
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
          className="flex gap-2 border-t border-line bg-bg p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about growth, rooms, bills, routing…"
            className="h-11 flex-1 rounded-md border border-line-strong bg-bg px-3 text-sm outline-none placeholder:text-muted focus:border-muted"
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
