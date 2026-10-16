import type { ArtistProfile, Gig, OperationalTask } from "./types.ts";

export const validBookingDay = (day: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(day) &&
  !Number.isNaN(Date.parse(day)) &&
  new Date(day).toISOString().slice(0, 10) === day;
export function syncBookingReminder(gig: Gig, tasks: OperationalTask[], id: string, now: string) {
  const key = "booking:" + gig.id + ":followup";
  const existing = tasks.find((t) => t.sourceKey === key && t.status === "open");
  if (
    !existing &&
    tasks.some(
      (t) => t.sourceKey === key && t.status === "done" && t.dueDate === gig.outreachNextFollowUp,
    )
  )
    return tasks;
  if (
    !validBookingDay(gig.outreachNextFollowUp ?? "") ||
    ["passed", "completed"].includes(gig.status)
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
  const epk = profile.notes.match(/https:\/\/[^\s<>"']+/)?.[0];
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
