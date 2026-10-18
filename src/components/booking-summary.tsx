import type { Gig } from "@/lib/types";
import { GIG_STATUS_LABEL } from "@/lib/types";
import { longDate, money } from "@/lib/format";
import { nextBookingAction } from "@/lib/booking-workflow";
import { ArrowUpRight } from "lucide-react";

/** The same recorded facts in every saved booking card and display mode. */
export function BookingSummary({ gig, today }: { gig: Gig; today: string }) {
  return <div className="space-y-2 text-xs">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><div className="break-words text-sm font-bold">{gig.venue || gig.name}</div><div className="mt-1 text-muted">{gig.city || "Location not entered"}</div></div>
      <ArrowUpRight className="size-4 shrink-0 text-muted" />
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="rounded-md border border-line bg-surface-2 px-2 py-1 font-semibold">{GIG_STATUS_LABEL[gig.status]}</span>
      <span className="font-semibold tabular">{gig.fee > 0 ? money(gig.fee) : "Fee not entered"}</span>
    </div>
    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-line pt-3 text-muted">
      <Fact label={gig.status === "booked" || gig.status === "completed" ? "Confirmed date" : "Proposed date"} value={gig.date ? longDate(gig.date) : "Not entered"} />
      <Fact label="Capacity" value={gig.venueCapacity ? gig.venueCapacity.toLocaleString() + (gig.capacitySourceUrl ? " · source cited" : " · unverified") : "Not researched"} />
      {gig.outreachNextFollowUp && <Fact label="Next follow-up" value={gig.outreachNextFollowUp} />}
      {gig.bookingContactName && <Fact label="Booking contact" value={gig.bookingContactName + (gig.bookingContactSourceUrl ? " · cited source" : " · unverified")} />}
      {!gig.bookingContactName && gig.outreachContact && <Fact label="Booking contact" value={gig.outreachContact + " · manually recorded"} />}
    </dl>
    {gig.outreachReplyStatus && <p className="text-info">Reply: {gig.outreachReplyStatus}{gig.outreachReplyReceivedAt ? " · " + gig.outreachReplyReceivedAt : ""}</p>}
    <div className="rounded-lg border border-line bg-surface-2/50 p-3 leading-relaxed">
      <div className="font-semibold text-muted">Next action</div>
      <div className="mt-1 font-semibold">{nextBookingAction(gig, today)}</div>


      <div className="mt-2 font-semibold text-accent">Open complete booking workspace ↗</div>
    </div>

  </div>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt>{label}</dt><dd className="mt-0.5 break-words font-medium text-fg">{value}</dd></div>;
}
