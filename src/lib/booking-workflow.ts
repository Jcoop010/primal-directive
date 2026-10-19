import { CLOSED_BOOKING_STATUSES } from "./types.ts";
import type { ArtistProfile, Gig, OperationalTask } from "./types.ts";

export const validBookingDay = (day: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(day) &&
  !Number.isNaN(Date.parse(day)) &&
  new Date(day).toISOString().slice(0, 10) === day;
export function syncBookingReminder(gig: Gig, tasks: OperationalTask[], id: string, now: string) {
  const key = "booking:" + gig.id + ":followup";
  const existing = tasks.find((t) => t.sourceKey === key && t.status === "open");
  // The Advisor may have created a follow-up before a date was scheduled.
  // Never create a second open task for the same gig.
  const advisorKey = "advisor:followup:" + gig.id;
  const advisorTask = tasks.find((t) => t.sourceKey === advisorKey && t.status === "open");
  if (advisorTask && !existing) {
    if (!validBookingDay(gig.outreachNextFollowUp ?? "") ||
        CLOSED_BOOKING_STATUSES.includes(gig.status)) return tasks;
    return tasks.map((t) => t.id === advisorTask.id
      ? { ...t, dueDate: gig.outreachNextFollowUp!, dueDateOverridden: true }
      : t);
  }
  if (
    !existing &&
    tasks.some(
      (t) => t.sourceKey === key && t.status === "done" && t.dueDate === gig.outreachNextFollowUp,
    )
  )
    return tasks;
  if (
    !validBookingDay(gig.outreachNextFollowUp ?? "") ||
    CLOSED_BOOKING_STATUSES.includes(gig.status)
  )
    return tasks.map((t) =>
      t.sourceKey === key && t.status === "open" ? { ...t, status: "done" as const } : t,
    );
  const reminder: OperationalTask = {
    id: existing?.id ?? id,
    title: "Booking follow-up: " + (gig.venue || gig.name),
    description:
      "Review the saved booking conversation and prepare the next action. No message is sent automatically.",
    category: "booking",
    gigId: gig.id,
    dueDate: gig.outreachNextFollowUp!,
    dueDateOverridden: true,
    status: "open",
    sourceKey: key,
    createdAt: existing?.createdAt ?? now,
  };
  return existing ? tasks.map((t) => (t.id === existing.id ? reminder : t)) : [reminder, ...tasks];
}
export function bookingDraft(gig: Gig, profile: ArtistProfile) {
  const epk = profile.epkUrl || profile.notes.match(/https:\/\/[^\s<>"']+/)?.[0];
  return (
    "Subject: Booking inquiry — " +
    (profile.artistName || "[artist name]") +
    " / " +
    (gig.venue || gig.name) +
    "\n\nHello,\n\nI’m reaching out on behalf of " +
    (profile.artistName || "[artist name]") +
    (profile.genre ? " (" + profile.genre + ")" : "") +
    (profile.city ? ", based in " + profile.city : "") +
    ". We’d like to discuss a possible show at " +
    (gig.venue || gig.name) +
    (gig.city ? " in " + gig.city : "") +
    ".\n\n" +
    (profile.draw ? "Our self-reported draw: " + profile.draw + ".\n\n" : "") +
    (epk
      ? "Artist link from our saved notes: " + epk + "\n\n"
      : "[Add a current EPK and representative live video.]\n\n") +
    "Could you share your booking submission process, suitable date windows, and terms? No date, availability, fee or booking relationship is assumed.\n\nThank you,\n" +
    (profile.artistName || "[artist name]")
  );
}

/** One venue/city is one prospect even when the model changes its pitch title.
 * Existing contacted, confirmed and closed records must be reviewed rather than re-created. */
export function isDuplicateVenue(existing: Pick<Gig, "venue" | "city">, candidate: Pick<Gig, "venue" | "city">) {
  const key = (v: string) => v.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
  return Boolean(key(candidate.venue) && key(candidate.city) && key(existing.venue) === key(candidate.venue) && key(existing.city) === key(candidate.city));
}

export function nextBookingAction(gig: Gig, today: string): string {
  if (gig.status === "completed") return "Reconcile payment and record show results";
  if (CLOSED_BOOKING_STATUSES.includes(gig.status)) return "Review outcome or reopen this opportunity";
  if (gig.status === "booked") return "Review advancing tasks and payment deadlines";
  if (gig.status === "hold") return "Confirm hold expiry, date and deal terms";
  if (gig.outreachReplyStatus === "declined") return "Record the declined outcome";
  if (gig.status === "responded" || gig.outreachReplyStatus === "interested") return "Review the reply and prepare a response";
  if (gig.status === "negotiating") return "Review proposed terms and decide your response";
  if (!gig.city?.trim()) return "Add venue location";
  if (!gig.bookingContactSourceUrl && !gig.bookingRoute) return "Verify booking contact and submission route";
  if (gig.status === "lead") return "Qualify venue fit against your draw and genre";
  if (gig.status === "qualified") return "Review sources and prepare an outreach draft";
  if (gig.status === "ready") return "Review the pitch and approve outreach";
  if (validBookingDay(gig.outreachNextFollowUp || "") && gig.outreachNextFollowUp! <= today) return "Review unanswered inquiry and prepare a follow-up";
  return gig.outreachNextFollowUp ? "Await reply; follow up on the scheduled date" : "Schedule a follow-up for this inquiry";
}

/** A recommendation only; never records a contact event or sends a message. */
export function suggestedFollowUp(gig: Gig): string | undefined {
  if (gig.status !== "outreach" || !validBookingDay(gig.outreachLastContactedAt || "")) return;
  const date = new Date(gig.outreachLastContactedAt + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString().slice(0, 10);
}
