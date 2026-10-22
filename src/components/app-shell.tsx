import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Banknote,
  CalendarDays,
  LayoutGrid,
  ListChecks,
  Music2,
  Plus,
  Menu,
  Search,
  X,
  Route as RouteIcon,
  ShoppingBag,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import {
  CommandDrawer,
  GigDrawer,
  MoneyDrawer,
  PersonDrawer,
  ProfileDrawer,
} from "@/components/forms";
import { DurableSync } from "@/components/durable-sync";
import { SignInButtons, SignInGate, UserButton } from "@/lib/auth/gates";
import { todayLabel } from "@/lib/format";
import { useMusician } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Command Center", icon: Sparkles },
  { to: "/gigs", label: "Gigs", icon: Music2 },
  { to: "/people", label: "People", icon: Users },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/money", label: "Money", icon: Banknote },
  { to: "/tour", label: "Tour", icon: RouteIcon },
  { to: "/merch", label: "Merch", icon: ShoppingBag },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/outreach", label: "Outreach", icon: Music2 },
  { to: "/account", label: "Account & billing", icon: UserRound },
] as const;

function SignInScreen() {
  return (
    <div className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-card">
        <div className="text-[11px] font-bold tracking-[0.22em] text-accent">
          PRIMAL DIRECTIVE
        </div>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight">
          Your command center.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Sign in to access your private pipeline, gigs, people, calendar, money,
          Advisor, Tour, Merch, and Tasks. Each account gets its own workspace data.
        </p>
        <div className="mt-6">
          <SignInButtons />
        </div>
        <p className="mt-5 text-center text-[11px] text-muted">
          Your workspace is private to your account.
        </p>
        <div className="mt-4 flex justify-center gap-5 text-xs text-accent"><Link to="/pricing">Plans</Link><Link to="/help">Help</Link><Link to="/legal">Privacy</Link></div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandSearchOpen, setCommandSearchOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const profile = useMusician((s) => s.profile);
  const setComposer = useMusician((s) => s.setComposer);
  const openGig = useMusician((s) => s.openGig);
  const openPerson = useMusician((s) => s.openPerson);
  const openMoney = useMusician((s) => s.openMoney);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);
  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandSearchOpen((open) => !open);
      } else if (event.key === "Escape") {
        setCommandSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);
  const commandMatches = NAV.filter((item) => item.label.toLowerCase().includes(commandQuery.trim().toLowerCase()));
  const pageTitle =
    NAV.find((n) => (n.to === "/" ? pathname === "/" : pathname.startsWith(n.to)))?.label ??
    "Command";

  function onFab() {
    if (pathname.startsWith("/gigs") || pathname.startsWith("/calendar")) openGig();
    else if (pathname.startsWith("/people")) openPerson();
    else if (pathname.startsWith("/money")) openMoney();
    else setComposer({ commandOpen: true });
  }

  if (["/demo", "/pricing", "/help", "/legal"].includes(pathname)) return <>{children}</>;

  return (
    <SignInGate fallback={<SignInScreen />}>
      <div className="min-h-dvh md:flex">
        <DurableSync />
        <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-[#0b1016]/95 shadow-[12px_0_60px_#0002] md:flex">
          <div className="relative overflow-hidden px-5 pt-8 pb-7"><div aria-hidden="true" className="pointer-events-none absolute inset-0 command-glow" /><div className="relative">
            <div className="text-[12px] font-extrabold tracking-[0.19em] text-accent">PRIMAL DIRECTIVE</div>
            <div className="mt-1 text-xs text-muted">Artist Command Center</div><div className="mt-5 flex items-center gap-2 text-[10px] font-bold tracking-[.15em] text-live"><span className="size-1.5 rounded-full bg-live shadow-[0_0_12px_#55d49a]" /> YOUR OPERATIONS HUB</div></div>
          </div>
          <nav className="flex flex-1 flex-col gap-1 px-3">
            {NAV.map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "command-link flex h-11 items-center gap-3 rounded-lg px-4 text-sm font-semibold transition-colors",
                    active ? "bg-accent/10 text-accent ring-1 ring-accent/20" : "text-muted hover:bg-surface hover:text-fg",
                  )}
                >
                  <item.icon className="size-4" strokeWidth={1.75} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="m-3 rounded-md border border-line p-3">
            <button
              type="button"
              onClick={() => setComposer({ profileOpen: true })}
              className="flex w-full items-center gap-3 text-left hover:opacity-90"
            >
              <UserRound className="size-4 shrink-0 text-muted" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {profile.artistName || "Artist profile"}
                </span>
                <span className="block truncate text-[11px] text-muted">
                  {profile.city || "Set your home market"}
                </span>
              </span>
            </button>
            <div className="mt-3 border-t border-line pt-3">
              <UserButton />
            </div>
          </div>
        </aside>

        <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
          <header className="relative isolate overflow-hidden border-b border-line/60 bg-bg/75 px-4 py-3 backdrop-blur-xl md:px-8 md:py-5">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 command-grid" /><div aria-hidden="true" className="pointer-events-none absolute inset-0 command-glow" /><div className="relative mx-auto flex max-w-7xl items-end justify-between gap-4">
              <div>
                
                <div className="mb-1 hidden items-center gap-2 md:flex"><span className="h-px w-6 bg-accent" /><span className="command-kicker text-accent">Artist operations / {pageTitle}</span></div><h1 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">
                  {pathname === "/" ? "Command Center" : pageTitle}
                </h1>
                <div className="mt-1 hidden text-xs text-muted md:block">{todayLabel()}</div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => {setCommandQuery("");setCommandSearchOpen(true);}} aria-label="Search workspace navigation" className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-muted transition-colors hover:border-accent/40 hover:text-fg"><Search className="size-4" /><span className="hidden lg:inline">Jump to page</span><kbd className="hidden rounded border border-line px-1.5 py-0.5 text-[10px] lg:inline">⌘ K</kbd></button>
                <button type="button" onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation" aria-expanded={mobileMenuOpen} className="flex size-11 items-center justify-center rounded-xl border border-line bg-surface md:hidden"><Menu className="size-5" /></button>
                <div className="hidden items-center gap-2 rounded-full border border-line bg-bg px-3 py-1.5 text-[10px] font-bold tracking-[0.12em] text-muted xl:flex">
                  <span className="size-1.5 rounded-full bg-live shadow-[0_0_10px_var(--color-live)]" />
                  SCENE INTEL
                </div>
                <button
                  type="button"
                  onClick={() => setComposer({ profileOpen: true })}
                  className="flex size-11 items-center justify-center rounded-full border border-line bg-surface md:hidden"
                  aria-label="Artist profile"
                >
                  <UserRound className="size-4" />
                </button>
              </div>
            </div>
          </header>

          <main
            className={cn(
              "mx-auto w-full max-w-7xl flex-1 px-4 pt-4 pb-28 md:px-8 md:pt-6 md:pb-10",
              pathname === "/" && "flex flex-col pb-24 md:pb-8",
            )}
          >
            {children}
          </main>
        </div>

        {commandSearchOpen && (
          <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/75 px-4 pt-[min(15vh,120px)] backdrop-blur-sm" onMouseDown={(event) => {if (event.target === event.currentTarget) setCommandSearchOpen(false);}}>
            <section role="dialog" aria-modal="true" aria-label="Jump to workspace page" className="w-full max-w-lg overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-2xl">
              <div className="flex items-center gap-3 border-b border-line px-4 py-3"><Search className="size-5 text-accent"/><input autoFocus aria-label="Search pages" placeholder="Search pages…" value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} className="min-h-10 min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-muted"/><button type="button" aria-label="Close page search" onClick={() => setCommandSearchOpen(false)} className="rounded-lg p-2 text-muted hover:bg-bg hover:text-fg"><X className="size-4"/></button></div>
              <nav aria-label="Workspace search results" className="max-h-[min(60vh,480px)] overflow-y-auto p-2">
                {commandMatches.map((item) => <Link key={item.to} to={item.to} onClick={() => {setCommandSearchOpen(false);setCommandQuery("");setMobileMenuOpen(false);}} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-fg transition-colors hover:bg-accent/10 hover:text-accent"><item.icon className="size-4 text-accent"/>{item.label}</Link>)}
                {commandMatches.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted">No matching pages</p>}
              </nav>
              <p className="border-t border-line px-4 py-3 text-[11px] text-muted">Navigate across Advisor, bookings, tours, finance, people, merch, and tasks. Press Esc to close.</p>
            </section>
          </div>
        )}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm md:hidden" onClick={() => setMobileMenuOpen(false)}>
            <nav aria-label="Mobile navigation" className="h-full w-[min(85vw,340px)] overflow-y-auto border-r border-line bg-bg p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="mb-8 flex items-center justify-between">
                <div><div className="text-xs font-extrabold tracking-[0.2em] text-accent">PRIMAL DIRECTIVE</div><div className="mt-1 text-xs text-muted">Artist Command Center</div></div>
                <button type="button" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)} className="rounded-xl border border-line p-2"><X className="size-5" /></button>
              </div>
              <div className="flex flex-col gap-1">
                {NAV.map((item) => {
                  const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                  return <Link key={item.to} to={item.to} onClick={() => setMobileMenuOpen(false)} aria-current={active ? "page" : undefined} className={cn("flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold", active ? "bg-accent/10 text-accent" : "text-muted hover:bg-surface hover:text-fg")}><item.icon className="size-5" />{item.label}</Link>;
                })}
              </div>
              <div className="mt-8 border-t border-line pt-5"><UserButton /></div>
            </nav>
          </div>
        )}

        <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur-xl md:hidden">
          <div className="mx-auto grid w-full max-w-lg grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)]">
            {NAV.filter((item) => ["/", "/gigs", "/calendar", "/tasks"].includes(item.to)).map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              return <Link key={item.to} to={item.to} aria-current={active ? "page" : undefined} className={cn("flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold", active ? "text-accent" : "text-muted")}><item.icon className="size-5" strokeWidth={active ? 2.4 : 1.8} /><span className="max-w-full truncate text-center">{item.to === "/" ? "Command" : item.label}</span></Link>;
            })}
            <button type="button" aria-label="Add" onClick={onFab} className="flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 text-xs font-semibold text-accent"><Plus className="size-5" /><span>Add</span></button>
          </div>
        </nav>

        <button
          type="button"
          onClick={onFab}
          className={cn(
            "fixed right-4 bottom-[4.75rem] z-30 size-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-[0_10px_30px_#0009] md:right-8 md:bottom-8",
            "hidden md:flex",
          )}
          aria-label="Add"
        >
          <Plus className="size-7" strokeWidth={2} />
        </button>

        <GigDrawer />
        <PersonDrawer />
        <MoneyDrawer />
        <ProfileDrawer />
        <CommandDrawer />
      </div>
    </SignInGate>
  );
}
