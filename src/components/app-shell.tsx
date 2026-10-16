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
  { to: "/", label: "Advisor", icon: Sparkles },
  { to: "/board", label: "Board", icon: LayoutGrid },
  { to: "/gigs", label: "Gigs", icon: Music2 },
  { to: "/people", label: "People", icon: Users },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/money", label: "Money", icon: Banknote },
  { to: "/tour", label: "Tour", icon: RouteIcon },
  { to: "/merch", label: "Merch", icon: ShoppingBag },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
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
          Your data is never shared between artist accounts.
        </p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
  const pageTitle =
    NAV.find((n) => (n.to === "/" ? pathname === "/" : pathname.startsWith(n.to)))?.label ??
    "Command";

  function onFab() {
    if (pathname.startsWith("/gigs") || pathname.startsWith("/calendar")) openGig();
    else if (pathname.startsWith("/people")) openPerson();
    else if (pathname.startsWith("/money")) openMoney();
    else setComposer({ commandOpen: true });
  }

  if (pathname === "/demo") return <>{children}</>;

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
          <header className="relative isolate overflow-hidden border-b border-line/60 bg-bg/75 px-4 pt-5 pb-5 backdrop-blur-xl md:px-8 md:pt-8 md:pb-8">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 command-grid" /><div aria-hidden="true" className="pointer-events-none absolute inset-0 command-glow" /><div className="relative mx-auto flex max-w-7xl items-end justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold tracking-[0.22em] md:hidden">PRIMAL DIRECTIVE</div>
                <div className="mt-1 text-xs text-muted md:hidden">Artist Command Center</div>
                <div className="mb-2 hidden items-center gap-2 md:flex"><span className="h-px w-6 bg-accent" /><span className="command-kicker text-accent">Artist operations / {pageTitle}</span></div><h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight md:mt-0 md:text-4xl">
                  {pathname === "/" ? "Command Center" : pageTitle}
                </h1>
                <div className="mt-1 text-xs text-muted">{todayLabel()}</div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation" aria-expanded={mobileMenuOpen} className="flex size-11 items-center justify-center rounded-xl border border-line bg-surface md:hidden"><Menu className="size-5" /></button>
                <div className="hidden items-center gap-2 rounded-full border border-line bg-bg px-3 py-1.5 text-[10px] font-bold tracking-[0.12em] text-muted sm:flex">
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
              "mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-28 md:px-8 md:pt-8 md:pb-10",
              pathname === "/" && "flex flex-col pb-24 md:pb-8",
            )}
          >
            {children}
          </main>
        </div>

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
          <div className="mx-auto grid max-w-md grid-cols-5 pb-[env(safe-area-inset-bottom)]">
            {NAV.filter((item) => ["/", "/board", "/gigs", "/calendar", "/tasks"].includes(item.to)).map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              return <Link key={item.to} to={item.to} aria-current={active ? "page" : undefined} className={cn("flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-semibold", active ? "text-accent" : "text-muted")}><item.icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />{item.label}</Link>;
            })}
          </div>
        </nav>

        <button
          type="button"
          onClick={onFab}
          className={cn(
            "fixed right-4 bottom-[4.75rem] z-30 size-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-[0_10px_30px_#0009] md:right-8 md:bottom-8",
            pathname === "/" ? "hidden md:flex" : "flex",
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
