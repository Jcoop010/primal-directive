import { Link, useRouterState } from "@tanstack/react-router";
import { Banknote, CalendarDays, LayoutGrid, Music2, Plus, Sparkles, UserRound, Users } from "lucide-react";
import { CommandDrawer, GigDrawer, MoneyDrawer, PersonDrawer, ProfileDrawer } from "@/components/forms";
import { DurableSync } from "@/components/durable-sync";
import { todayLabel } from "@/lib/format";
import { useMusician } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Advisor", icon: Sparkles }, { to: "/board", label: "Board", icon: LayoutGrid },
  { to: "/gigs", label: "Gigs", icon: Music2 }, { to: "/people", label: "People", icon: Users },
  { to: "/calendar", label: "Calendar", icon: CalendarDays }, { to: "/money", label: "Money", icon: Banknote },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const profile = useMusician((s) => s.profile), setComposer = useMusician((s) => s.setComposer);
  const openGig = useMusician((s) => s.openGig), openPerson = useMusician((s) => s.openPerson), openMoney = useMusician((s) => s.openMoney);
  const pageTitle = NAV.find((n) => (n.to === "/" ? pathname === "/" : pathname.startsWith(n.to)))?.label ?? "Command";
  function onFab() { if (pathname.startsWith("/gigs") || pathname.startsWith("/calendar")) openGig(); else if (pathname.startsWith("/people")) openPerson(); else if (pathname.startsWith("/money")) openMoney(); else setComposer({ commandOpen: true }); }
  return <div className="min-h-dvh md:flex">
    <DurableSync />
    <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-bg/80 md:flex">
      <div className="px-5 pt-6 pb-4"><div className="text-[11px] font-bold tracking-[0.22em]">PRIMAL DIRECTIVE</div><div className="mt-1 text-xs text-muted">Artist Command Center</div></div>
      <nav className="flex flex-1 flex-col gap-1 px-3">{NAV.map((item) => { const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to); return <Link key={item.to} to={item.to} className={cn("flex h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors", active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface hover:text-fg")}><item.icon className="size-4" strokeWidth={1.75} />{item.label}</Link>; })}</nav>
      <button type="button" onClick={() => setComposer({ profileOpen: true })} className="m-3 flex items-center gap-3 rounded-md border border-line px-3 py-2.5 text-left hover:bg-surface-2"><UserRound className="size-4 text-muted" /><span className="min-w-0"><span className="block truncate text-sm font-semibold">{profile.artistName}</span><span className="block truncate text-[11px] text-muted">{profile.city}</span></span></button>
    </aside>
    <div className="flex min-h-dvh min-w-0 flex-1 flex-col"><header className="px-4 pt-5 pb-2 md:px-8 md:pt-7"><div className="mx-auto flex max-w-3xl items-end justify-between gap-4"><div><div className="text-[11px] font-bold tracking-[0.22em] md:hidden">PRIMAL DIRECTIVE</div><div className="mt-1 text-xs text-muted md:hidden">Artist Command Center</div><h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight md:mt-0">{pathname === "/" ? "Command Center" : pageTitle}</h1><div className="mt-1 text-xs text-muted">{todayLabel()}</div></div><div className="flex items-center gap-2"><div className="hidden items-center gap-2 rounded-full border border-line bg-bg px-3 py-1.5 text-[10px] font-bold tracking-[0.12em] text-muted sm:flex"><span className="size-1.5 rounded-full bg-live shadow-[0_0_10px_var(--color-live)]" />SCENE INTEL</div><button type="button" onClick={() => setComposer({ profileOpen: true })} className="flex size-11 items-center justify-center rounded-full border border-line bg-surface md:hidden" aria-label="Artist profile"><UserRound className="size-4" /></button></div></div></header><main className={cn("mx-auto w-full max-w-3xl flex-1 px-3.5 pb-28 md:px-8 md:pb-10", pathname === "/" && "flex flex-col pb-24 md:pb-8")}>{children}</main></div>
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/90 backdrop-blur-md md:hidden"><div className="mx-auto grid max-w-3xl grid-cols-6 px-1 pb-[env(safe-area-inset-bottom)]">{NAV.map((item) => { const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to); return <Link key={item.to} to={item.to} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-semibold", active ? "text-fg" : "text-muted")}><item.icon className="size-4" strokeWidth={1.75} />{item.label}</Link>; })}</div></nav>
    <button type="button" onClick={onFab} className={cn("fixed right-4 bottom-[4.75rem] z-30 size-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-[0_10px_30px_#0009] md:right-8 md:bottom-8", pathname === "/" ? "hidden md:flex" : "flex")} aria-label="Add"><Plus className="size-7" strokeWidth={2} /></button>
    <GigDrawer /><PersonDrawer /><MoneyDrawer /><ProfileDrawer /><CommandDrawer />
  </div>;
}
