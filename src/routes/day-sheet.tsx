import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  ClipboardCopy,
  Clock,
  FileText,
  Mail,
  MapPin,
  Printer,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import {
  buildBandCallSheetText,
  buildVenueAdvanceEmail,
  computePreShowYield,
} from "@/lib/agent-signal-scoring";
import { longDate, money } from "@/lib/format";
import { useMusician } from "@/lib/store";
import { BOOKING_STAGE_LABEL, GIG_STATUS_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/day-sheet")({
  validateSearch: (search: Record<string, unknown>): { gig?: string } =>
    typeof search.gig === "string" && search.gig.trim() ? { gig: search.gig.trim() } : {},
  component: RoadDaySheetPage,
});

function RoadDaySheetPage() {
  const { gig: gigId } = Route.useSearch();
  const gigs = useMusician((s) => s.gigs);
  const profile = useMusician((s) => s.profile);
  const openGig = useMusician((s) => s.openGig);
  const [copiedKind, setCopiedKind] = useState<"call" | "advance" | null>(null);

  const gig = gigId ? gigs.find((item) => item.id === gigId) : undefined;
  const upcomingShows = gigs
    .filter((item) => item.status === "booked" || item.status === "hold")
    .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));

  function copyText(kind: "call" | "advance", text: string, label: string) {
    void navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopiedKind(kind);
        toast.success(`${label} copied`);
        window.setTimeout(() => setCopiedKind(null), 2000);
      })
      .catch(() => toast.error(`Could not copy ${label.toLowerCase()}`));
  }

  if (!gig) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            to="/gigs"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3.5 text-xs font-semibold text-fg hover:border-accent"
          >
            <ArrowLeft className="size-3.5" /> Back to Gigs
          </Link>
        </div>
        <Card className="p-6">
          <h2 className="font-display text-xl font-bold text-fg">Select a show for its Road Day Sheet</h2>
          <p className="mt-1 text-xs text-muted">
            Choose a booked or hold date below to view its print-ready run-of-show, venue logistics, and band call sheet.
          </p>
          {upcomingShows.length === 0 ? (
            <p className="mt-4 text-xs text-muted">
              No booked or hold shows saved yet. Open a gig from{" "}
              <Link to="/gigs" className="font-semibold text-accent underline">
                /gigs
              </Link>{" "}
              and fill out Section 5 (Show advance).
            </p>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {upcomingShows.map((item) => (
                <Link
                  key={item.id}
                  to="/day-sheet"
                  search={{ gig: item.id }}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-bg/70 px-4 py-3 text-left transition-colors hover:border-[#E25822]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-fg">
                      {item.venue || item.name}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted">
                      {item.city || "City TBD"} · {longDate(item.date)}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-live/45 bg-live/12 px-2 py-0.5 text-[10px] font-bold uppercase text-live">
                    {GIG_STATUS_LABEL[item.status]}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  const payout =
    typeof gig.guaranteeOrSplitEst === "number" && Number.isFinite(gig.guaranteeOrSplitEst)
      ? gig.guaranteeOrSplitEst
      : Math.max(0, Number.isFinite(gig.fee) ? gig.fee : 0);
  const yieldEst = computePreShowYield({
    guaranteeOrSplitEst: payout,
    estAttendance: gig.estAttendance ?? 0,
    merchPerHeadEst: gig.merchPerHeadEst ?? 0,
    roadAndRoomCostEst: gig.roadAndRoomCostEst ?? 0,
  });

  const timeline = [
    { label: "Load-in", value: gig.loadInTime?.trim() || "TBD" },
    { label: "Soundcheck", value: gig.soundcheckTime?.trim() || "TBD" },
    { label: "Doors", value: gig.doorsTime?.trim() || "TBD" },
    { label: "Set time", value: gig.setTime?.trim() || "TBD" },
    { label: "Curfew", value: gig.curfewTime?.trim() || "TBD" },
  ];

  const advanceEmail = buildVenueAdvanceEmail(gig, profile.artistName);
  const callSheetText = buildBandCallSheetText(gig);

  return (
    <div className="mx-auto max-w-4xl space-y-4 print:max-w-none print:space-y-3 print:text-black">
      {/* Action Bar (hidden when printing) */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#243652] bg-[#0A1628]/90 p-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/gigs"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line-strong bg-bg/70 px-3 text-xs font-semibold text-fg hover:border-[#E25822]"
          >
            <ArrowLeft className="size-3.5" /> Back to Gigs
          </Link>
          <button
            type="button"
            onClick={() => openGig(gig.id)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 text-xs font-semibold text-fg hover:border-[#E25822]"
          >
            <FileText className="size-3.5" /> Edit in GigDrawer
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => copyText("call", callSheetText, "Band call-sheet")}
            className={cn(
              "inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors",
              copiedKind === "call"
                ? "border-live/60 bg-live/15 text-live"
                : "border-line-strong bg-surface-2 text-fg hover:border-[#E25822]",
            )}
          >
            {copiedKind === "call" ? <Check className="size-3.5" /> : <ClipboardCopy className="size-3.5" />}
            {copiedKind === "call" ? "Copied!" : "Copy Band Call-Sheet"}
          </button>
          <button
            type="button"
            onClick={() => copyText("advance", advanceEmail, "Venue advance email")}
            className={cn(
              "inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors",
              copiedKind === "advance"
                ? "border-live/60 bg-live/15 text-live"
                : "border-line-strong bg-surface-2 text-fg hover:border-[#E25822]",
            )}
          >
            {copiedKind === "advance" ? <Check className="size-3.5" /> : <Mail className="size-3.5" />}
            {copiedKind === "advance" ? "Copied!" : "Copy Advance Email"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#E25822] px-3.5 text-xs font-bold text-white hover:bg-[#D35400]"
          >
            <Printer className="size-3.5" /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* Printable Road Day Sheet Surface */}
      <article className="space-y-4 rounded-2xl border border-[#243652] bg-[#0A1628]/95 p-5 shadow-card sm:p-6 print:rounded-none print:border-neutral-300 print:bg-white print:p-4 print:text-black print:shadow-none">
        {/* Header */}
        <header className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-start sm:justify-between print:border-neutral-300">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#E25822] print:text-neutral-700">
              Road Day Sheet {profile.artistName ? `· ${profile.artistName}` : ""}
            </div>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl print:text-black">
              {gig.venue || gig.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-soft print:text-neutral-700">
              <span className="inline-flex items-center gap-1 font-semibold">
                <MapPin className="size-3.5 text-[#E25822] print:text-neutral-700" />
                {gig.city || "City TBD"}
              </span>
              {gig.corridor ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{gig.corridor}</span>
                </>
              ) : null}
              {gig.runLabel ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-info print:text-black">{gig.runLabel}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
            <div className="tabular font-display text-lg font-extrabold text-fg print:text-black">
              {longDate(gig.date)}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full border border-live/45 bg-live/12 px-2.5 py-0.5 text-[11px] font-bold uppercase text-live print:border-neutral-400 print:bg-neutral-100 print:text-black">
                {gig.bookingStage ? BOOKING_STAGE_LABEL[gig.bookingStage] : GIG_STATUS_LABEL[gig.status]}
              </span>
              {gig.billRole ? (
                <span className="rounded-full border border-line bg-bg/70 px-2.5 py-0.5 text-[11px] font-semibold uppercase text-soft print:border-neutral-400 print:bg-white print:text-black">
                  {gig.billRole.replace("_", " ")}
                </span>
              ) : null}
            </div>
          </div>
        </header>

        {/* Chronological Run-of-Show Timeline */}
        <section aria-label="Run of show timeline">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted print:text-neutral-700">
            <Clock className="size-3.5 text-[#E25822] print:text-neutral-700" /> Run of Show
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {timeline.map((slot) => (
              <div
                key={slot.label}
                className="rounded-xl border border-line bg-bg/80 p-3 text-center print:border-neutral-300 print:bg-neutral-50"
              >
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted print:text-neutral-600">
                  {slot.label}
                </div>
                <div className="tabular mt-1 font-display text-base font-extrabold text-fg print:text-black">
                  {slot.value}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Venue & Production Logistics */}
        <section aria-label="Venue and production logistics" className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-line bg-bg/75 p-4 print:border-neutral-300 print:bg-white">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted print:text-neutral-600">
              Venue address
            </div>
            <p className="mt-1 text-sm font-semibold text-fg print:text-black">
              {gig.venueAddress?.trim() || "Add street address in GigDrawer Section 5"}
            </p>
            <div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted print:text-neutral-600">
              Parking &amp; load-in notes
            </div>
            <p className="mt-1 text-xs leading-relaxed text-soft print:text-neutral-800">
              {gig.parkingLoadInNotes?.trim() || "Confirm load-in entrance & van/trailer parking with PM."}
            </p>
          </div>

          <div className="rounded-xl border border-line bg-bg/75 p-4 print:border-neutral-300 print:bg-white">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted print:text-neutral-600">
              Production &amp; settlement contact
            </div>
            <p className="mt-1 text-sm font-semibold text-fg print:text-black">
              {gig.productionContact?.trim() || gig.outreachContact?.trim() || "TBD — confirm on advance"}
            </p>
            <div className="mt-3 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted print:text-neutral-600">
              <Wifi className="size-3" /> Backline &amp; Wi-Fi
            </div>
            <p className="mt-1 text-xs leading-relaxed text-soft print:text-neutral-800">
              {gig.backlineWifiNotes?.trim() || "Confirm shared backline, drum kit, and venue Wi-Fi."}
            </p>
            <div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted print:text-neutral-600">
              Guest list &amp; hospitality
            </div>
            <p className="mt-1 text-xs leading-relaxed text-soft print:text-neutral-800">
              {gig.guestListHospitality?.trim() || "Confirm guest list cap, buyout, and green room."}
            </p>
          </div>
        </section>

        {/* Deal & Readiness Snapshot */}
        <section
          aria-label="Deal and readiness snapshot"
          className="rounded-xl border border-line bg-bg/75 p-4 print:border-neutral-300 print:bg-neutral-50"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted print:text-neutral-700">
              <ShieldCheck className="size-3.5 text-[#E25822] print:text-neutral-700" /> Deal &amp; Readiness Snapshot
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "EPK ready", ok: Boolean(gig.epkReady) },
                { label: "Tech plot ready", ok: Boolean(gig.techPlotReady) },
                { label: "Routing checked", ok: Boolean(gig.routingChecked) },
              ].map((badge) => (
                <span
                  key={badge.label}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase",
                    badge.ok
                      ? "border-live/50 bg-live/15 text-live print:border-neutral-500 print:bg-white print:text-black"
                      : "border-line bg-surface text-muted print:border-neutral-300 print:text-neutral-500",
                  )}
                >
                  {badge.ok ? "✓ " : "○ "}
                  {badge.label}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <div className="text-[10px] font-semibold uppercase text-muted print:text-neutral-600">
                Deal / payout est.
              </div>
              <div className="tabular mt-0.5 text-sm font-bold text-fg print:text-black">
                {money(yieldEst.payoutEst)}
                {gig.dealType ? ` · ${gig.dealType.replace("_", " ")}` : ""}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase text-muted print:text-neutral-600">
                Forecast net yield
              </div>
              <div
                className={cn(
                  "tabular mt-0.5 text-sm font-bold print:text-black",
                  yieldEst.netYieldEst >= 0 ? "text-live" : "text-danger",
                )}
              >
                {yieldEst.netYieldEst >= 0 ? "+" : "-"}
                {money(Math.abs(yieldEst.netYieldEst))}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase text-muted print:text-neutral-600">
                Break-even heads
              </div>
              <div className="tabular mt-0.5 text-sm font-bold text-fg print:text-black">
                {yieldEst.breakEvenAttendance === null ? "N/A" : yieldEst.breakEvenAttendance}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase text-muted print:text-neutral-600">
                Road &amp; room est.
              </div>
              <div className="tabular mt-0.5 text-sm font-bold text-fg print:text-black">
                {money(yieldEst.roadAndRoomCostEst)}
              </div>
            </div>
          </div>
          {gig.notes?.trim() ? (
            <p className="mt-3 border-t border-line/70 pt-2.5 text-xs text-soft print:border-neutral-300 print:text-neutral-700">
              <span className="font-semibold">Show notes:</span> {gig.notes}
            </p>
          ) : null}
        </section>

        <footer className="flex items-center justify-between pt-1 text-[10px] text-muted print:text-neutral-600">
          <span>Primal Directive · Touring Day Sheet</span>
          <span>Advance emails are human-reviewed only · never auto-sent</span>
        </footer>
      </article>
    </div>
  );
}
