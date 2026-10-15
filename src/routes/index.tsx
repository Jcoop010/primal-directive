import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUp, ChevronDown, ChevronUp, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { askGrowthAdvisor } from "@/lib/ai";
import { hostFromUrl, longDate, money } from "@/lib/format";
import { buildAdvisorContext, useMusician } from "@/lib/store";
import { cn } from "@/lib/utils";
import { intelligenceWorkspace } from "@/lib/workspace-intelligence";
import { WorkspaceBrief } from "@/components/workspace-brief";
import { AdvisorTaskReview } from "@/components/advisor-task-review";
import { ArtistPlanning } from "@/components/artist-planning";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/")({ component: AdvisorPage });

const SUGGESTIONS = [
  { label: "Analyze workspace", q: "Analyze my full recorded workspace. Explain the financial position, rank the most useful next priorities with reasons, and give three short actions. Distinguish recorded results from estimates and unknown costs; avoid repeating completed tasks." },
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

function AdvisorMessage({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 720;
  const visible = long && !expanded ? text.slice(0, 720).replace(/\\s+\\S*$/, "") + "…" : text;
  return (
    <div>
      <div className="whitespace-pre-wrap break-words">{visible}</div>
      {long && (
        <button type="button" onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="mt-2 inline-flex min-h-9 items-center gap-1 rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-accent hover:bg-bg">
          {expanded ? <><ChevronUp className="size-3.5" /> Show less</> : <><ChevronDown className="size-3.5" /> Read full answer</>}
        </button>
      )}
    </div>
  );
}

function AdvisorPage() {
  const { user } = useCurrentUserState();
  const owner = user?.id ?? null;
  const ownerRef = useRef<string | null>(owner);
  useEffect(() => {
    ownerRef.current = owner;
    return () => { ownerRef.current = null; };
  }, [owner]);
  const chat = useMusician((s) => s.chat);
  const addUserMessage = useMusician((s) => s.addUserMessage);
  const addAiMessage = useMusician((s) => s.addAiMessage);
  const ingestSuggestedGig = useMusician((s) => s.ingestSuggestedGig);
  const ingestSuggestedPerson = useMusician((s) => s.ingestSuggestedPerson);
  const clearChat = useMusician((s) => s.clearChat);
  const resetSample = useMusician((s) => s.resetSample);
  const profile = useMusician((s) => s.profile);
  const gigs = useMusician((s) => s.gigs);
  const people = useMusician((s) => s.people);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [answerMode, setAnswerMode] = useState<"quick" | "detailed" | "research">("quick");
  const [taskSuggestion, setTaskSuggestion] = useState<{ owner: string; text: string } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat, busy]);

  async function send(text: string) {
    const q = text.trim();
    const requestOwner = ownerRef.current;
    if (!q || busy || !requestOwner) return;
    const history = useMusician.getState().chat.slice(-8).map((m) => ({
      role: m.role,
      text: m.text,
    }));
    setInput("");
    addUserMessage(q);
    setBusy(true);
    try {
      const res = await askGrowthAdvisor({
        data: {
          message: `${answerMode === "quick" ? "Respond concisely: lead with the answer, aim for 100–150 words, at most 3 key points. Do not repeat the question or include raw JSON. Keep citations and uncertainty clear." : answerMode === "detailed" ? "Provide a detailed but well-organized answer; avoid repetition and raw JSON." : "Provide thorough research with sources, clearly distinguishing verified external facts from saved workspace data. No raw JSON."}\n\nUser request: ${q}`,
          history,
          context: buildAdvisorContext(),
          workspace: intelligenceWorkspace(useMusician.getState()),
          planning: useMusician.getState().planning,
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Eyebrow>Growth advisor</Eyebrow>
      <div className="my-3"><WorkspaceBrief /></div>
      <ArtistPlanning busy={busy} onExplain={() => void send('Explain my saved weekly plan and goal progress. Use the provided records, available capacity and completed work. Give the best next internal steps.')} />
      {taskSuggestion !== null && taskSuggestion.owner === owner && <AdvisorTaskReview key={taskSuggestion.text} suggestion={taskSuggestion.text} onClose={() => setTaskSuggestion(null)} />}

      <Card className="flex min-h-[28rem] flex-1 flex-col overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div><strong className="text-sm">Primal Directive AI</strong><p className="mt-0.5 text-[11px] text-muted">Clear answers. Your next move, without the noise.</p></div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (!window.confirm("Load fictional demo artist River Fold? This replaces your current local workspace, including gigs, contacts, finances, merch, tasks, and chat. This cannot be undone.")) return;
                resetSample();
                toast.success("Fictional demo workspace loaded. Ask the Advisor to analyze River Fold.");
              }}
              disabled={busy}
              className="rounded-md border border-live/40 bg-live/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-live hover:bg-live/20 disabled:opacity-50"
            >
              Load demo artist
            </button>
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
              {busy ? "THINKING" : "READY"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-4 py-2" role="group" aria-label="Advisor response length">
          {(["quick", "detailed", "research"] as const).map(mode => (
            <button key={mode} type="button" onClick={() => setAnswerMode(mode)} aria-pressed={answerMode === mode}
              disabled={busy}
              className={cn("min-h-9 rounded-md px-3 text-xs font-semibold transition-colors", answerMode === mode ? "bg-accent text-accent-fg" : "text-muted hover:bg-surface-2 hover:text-fg")}>
              {mode === "quick" ? "Quick" : mode === "detailed" ? "Detailed" : "Deep research"}
            </button>
          ))}
        </div>
        <div className="border-b border-line px-4 py-2 text-xs text-muted">
          {profile.artistName ? <span>Workspace: <strong className="text-fg">{profile.artistName}</strong> · {gigs.length} shows · {people.length} contacts {profile.artistName === "River Fold" ? "· FICTIONAL SAMPLE DATA" : ""}</span> : <span>No artist profile loaded. Use <strong>Load demo artist</strong> to explore the product with fictional data.</span>}
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
              {m.role === "ai" ? <AdvisorMessage text={m.text} /> : m.text}
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
                  {m.moves.map((move, index) => (
                    <li key={`${index}-${move}`} className="space-y-1 text-xs text-soft">
                      <div><span className="mr-2 text-accent">→</span>{move}</div>
                      <button type="button" disabled={busy || !owner} onClick={() => { if (owner) setTaskSuggestion({ owner, text: move }); }} className="min-h-11 rounded-md border border-line px-3 text-xs font-semibold text-accent disabled:opacity-50">Review task</button>
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
              Thinking through your question and checking sources when needed…
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
