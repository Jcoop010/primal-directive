import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  LayoutDashboard,
  Music2,
  Sparkles,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/demo")({ component: DemoPage });

type Section = "Overview" | "Gigs" | "People" | "Money";

const gigs = [
  { venue: "The Purple Fiddle", city: "Thomas, WV", date: "Oct 16", fee: 650, status: "Booked" },
  { venue: "Club Cafe", city: "Pittsburgh, PA", date: "Oct 22", fee: 900, status: "Booked" },
  { venue: "Mr. Smalls Theatre", city: "Millvale, PA", date: "Nov 3", fee: 1500, status: "Negotiating" },
  { venue: "Thunderbird Cafe", city: "Pittsburgh, PA", date: "Nov 19", fee: 700, status: "Lead" },
];

function DemoPage() {
  const [section, setSection] = useState<Section>("Overview");
  const nav: { label: Section; icon: typeof LayoutDashboard }[] = [
    { label: "Overview", icon: LayoutDashboard },
    { label: "Gigs", icon: Music2 },
    { label: "People", icon: Users },
    { label: "Money", icon: Banknote },
  ];

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="text-[11px] font-bold tracking-[0.22em]">PRIMAL DIRECTIVE</div>
            <div className="mt-1 text-xs text-muted">Artist Command Center</div>
          </div>
          <span className="rounded-full border border-live/30 bg-live/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-live">
            Public demo · Sample data
          </span>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 md:grid-cols-[190px_minmax(0,1fr)] md:py-9">
        <aside className="hidden md:block">
          <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Workspace</div>
          <nav className="space-y-1">
            {nav.map(({ label, icon: Icon }) => (
              <button key={label} type="button" onClick={() => setSection(label)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold transition-colors ${section === label ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface hover:text-fg"}`}>
                <Icon className="size-4" />{label}{section === label && <ChevronRight className="ml-auto size-4" />}
              </button>
            ))}
          </nav>
          <div className="mt-8 rounded-xl border border-line bg-surface p-4">
            <Sparkles className="size-5 text-accent" />
            <div className="mt-3 text-sm font-semibold">Built for the business behind the music.</div>
            <p className="mt-2 text-xs leading-relaxed text-muted">Track opportunities, relationships, dates, and real gig economics in one place.</p>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Sample workspace</div>
              <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{section === "Overview" ? "Command Center" : section}</h1>
              <p className="mt-2 text-sm text-muted">A realistic preview using fictional artist data.</p>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 text-[10px] font-bold tracking-[0.12em] text-muted sm:flex"><span className="size-1.5 rounded-full bg-live" /> SCENE INTEL</div>
          </div>

          <nav className="mb-5 grid grid-cols-4 gap-1 rounded-xl border border-line bg-surface p-1 md:hidden">
            {nav.map(({ label, icon: Icon }) => (
              <button key={label} type="button" onClick={() => setSection(label)} className={`flex flex-col items-center gap-1 rounded-lg px-1 py-2.5 text-[11px] font-semibold ${section === label ? "bg-surface-2 text-fg" : "text-muted"}`}><Icon className="size-4" />{label}</button>
            ))}
          </nav>

          {section === "Overview" && (
            <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <Metric label="Collected" value="$2,284" note="cash logged" />
                <Metric label="Outstanding" value="$1,250" note="money to collect" />
                <Metric label="Open pipeline" value="$4,600" note="4 opportunities" />
                <Metric label="Booked dates" value="2" note="next 30 days" />
              </div>
              <section className="mt-5 rounded-xl border border-line bg-surface p-4 sm:p-5">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-accent"><Sparkles className="size-4" /> AI next move</div>
                <h2 className="mt-3 text-lg font-bold">Turn your next run into a regional route.</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">You have a Pittsburgh date in the pipeline and an opportunity in Morgantown. Cluster 2–3 nearby rooms before confirming travel so fuel and lodging don't eat the guarantee.</p>
                <div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full border border-line px-3 py-1.5 text-xs text-muted">Pittsburgh → Morgantown</span><span className="rounded-full border border-line px-3 py-1.5 text-xs text-muted">Target: 3 dates</span></div>
              </section>
              <section className="mt-5 rounded-xl border border-line bg-surface">
                <div className="flex items-center justify-between border-b border-line px-4 py-4"><div><h2 className="font-semibold">Upcoming opportunities</h2><p className="mt-1 text-xs text-muted">Your next moves at a glance</p></div><button onClick={() => setSection("Gigs")} className="text-xs font-semibold text-accent">View pipeline <ArrowUpRight className="ml-1 inline size-3.5" /></button></div>
                <GigRows />
              </section>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <section className="rounded-xl border border-line bg-surface p-4"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted"><CalendarDays className="size-4" /> Next date</div><div className="mt-3 text-xl font-bold">The Purple Fiddle</div><div className="mt-1 text-sm text-muted">Thomas, WV · Oct 16</div><div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm"><span className="text-muted">Guarantee</span><span className="font-semibold">$650</span></div></section>
                <section className="rounded-xl border border-line bg-surface p-4"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted"><CircleDollarSign className="size-4" /> Revenue signal</div><div className="mt-3 text-xl font-bold">$1,250 outstanding</div><p className="mt-1 text-sm leading-relaxed text-muted">Two balances need follow-up before the next run.</p><button onClick={() => setSection("Money")} className="mt-4 text-xs font-semibold text-accent">Review money <ArrowUpRight className="ml-1 inline size-3.5" /></button></section>
              </div>
            </>
          )}

          {section === "Gigs" && <section className="rounded-xl border border-line bg-surface"><div className="border-b border-line p-4"><h2 className="font-semibold">Gig pipeline</h2><p className="mt-1 text-xs text-muted">$4,600 total listed opportunity value</p></div><GigRows /></section>}

          {section === "People" && (
            <section className="rounded-xl border border-line bg-surface">
              <div className="border-b border-line p-4"><h2 className="font-semibold">People & relationships</h2><p className="mt-1 text-xs text-muted">Fictional sample contacts</p></div>
              {[
                ["Maya Chen", "Booker · Pittsburgh, PA", "Club Cafe"],
                ["Dana Ortiz", "Talent buyer · Millvale, PA", "Mr. Smalls Theatre"],
                ["Eli Brooks", "Promoter · Pittsburgh, PA", "Stage Left showcases"],
                ["The Copper Wires", "Artist · Morgantown, WV", "Potential bill partner"],
              ].map(([name, role, detail], i) => <div key={name} className={`flex items-center gap-3 p-4 ${i < 3 ? "border-b border-line" : ""}`}><div className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-bold">{name.charAt(0)}</div><div className="min-w-0 flex-1"><div className="text-sm font-semibold">{name}</div><div className="mt-1 text-xs text-muted">{role}</div></div><div className="hidden text-right text-xs text-muted sm:block">{detail}</div></div>)}
            </section>
          )}

          {section === "Money" && (
            <section className="rounded-xl border border-line bg-surface">
              <div className="border-b border-line p-4"><h2 className="font-semibold">Gig economics</h2><p className="mt-1 text-xs text-muted">Collected, outstanding, and expenses in one view</p></div>
              {[
                ["River festival deposit", "Collected", "+$1,500"],
                ["Merch — last Saturday", "Collected", "+$420"],
                ["Club Cafe remainder", "Outstanding", "$600"],
                ["Purple Fiddle guarantee", "Outstanding", "$650"],
                ["Van repair", "Expense", "−$380"],
                ["Gas — Morgantown scout", "Expense", "−$85"],
              ].map(([label, type, amount], i) => <div key={label} className={`flex items-center justify-between gap-3 p-4 ${i < 5 ? "border-b border-line" : ""}`}><div><div className="text-sm font-semibold">{label}</div><div className="mt-1 text-xs text-muted">{type}</div></div><div className="shrink-0 text-sm font-semibold tabular">{amount}</div></div>)}
            </section>
          )}

          <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:p-5">
            <div><div className="text-sm font-semibold">Want your own workspace?</div><p className="mt-1 text-xs leading-relaxed text-muted">This demo is public and uses sample data. Your real workspace remains behind sign-in.</p></div>
            <Link to="/" className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg">Open sign-in <ChevronRight className="ml-1 size-4" /></Link>
          </div>
          <p className="mt-5 text-center text-[10px] leading-relaxed text-muted">PRIMAL DIRECTIVE · DEMO MODE · No account required</p>
        </main>
      </div>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-xl border border-line bg-surface p-4"><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{label}</div><div className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">{value}</div><div className="mt-1 text-[11px] text-muted">{note}</div></div>;
}

function GigRows() {
  return <div>{gigs.map((gig, i) => <div key={gig.venue} className={`flex items-center justify-between gap-3 p-4 ${i < gigs.length - 1 ? "border-b border-line" : ""}`}><div className="min-w-0"><div className="truncate text-sm font-semibold">{gig.venue}</div><div className="mt-1 text-xs text-muted">{gig.city} · {gig.date}</div></div><div className="shrink-0 text-right"><div className="text-sm font-semibold tabular">${gig.fee.toLocaleString("en-US")}</div><div className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted"><CheckCircle2 className="size-3" /> {gig.status}</div></div></div>)}</div>;
}
