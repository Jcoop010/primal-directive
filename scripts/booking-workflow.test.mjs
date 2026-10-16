import assert from "node:assert/strict";
import { test } from "node:test";
import { citationMatches, citedVenueEvidence, evidencePage } from "../src/lib/venue-evidence.ts";
import { syncBookingReminder, validBookingDay, bookingDraft } from "../src/lib/booking-workflow.ts";
import { readableAdvisorAnswer } from "../src/lib/advisor-answer.ts";

test("source matching preserves page identity and rejects unsupported contact and capacity claims", () => {
  assert.ok(
    citationMatches("https://venue.example/Booking?utm_source=test", [
      "https://venue.example/Booking",
    ]),
  );
  assert.equal(
    citationMatches("https://venue.example/Booking?room=large", [
      "https://venue.example/Booking?room=small",
    ]),
    false,
  );
  assert.equal(
    citationMatches("https://venue.example/booking", ["https://venue.example/Booking"]),
    false,
  );
  assert.equal(evidencePage("https://user:password@venue.example/"), null);
  assert.deepEqual(
    citedVenueEvidence(
      {
        venueCapacity: 500,
        capacitySourceUrl: "https://venue.example/about",
        bookingContactName: "Unsupported Person",
        bookingContactSourceUrl: "https://venue.example/team",
      },
      ["https://venue.example/booking"],
    ),
    {},
  );
  assert.equal(
    citedVenueEvidence({ venueCapacity: 110, capacitySourceUrl: "https://venue.example/booking" }, [
      "https://venue.example/booking",
    ]).venueCapacity,
    110,
  );
});
test("River Fold follow-up is stable, reschedulable, completed once and never sends messages", () => {
  const gig = {
    id: "river-fold",
    name: "Fictional test inquiry",
    venue: "QA venue",
    status: "lead",
    outreachNextFollowUp: "2027-03-12",
  };
  const first = syncBookingReminder(gig, [], "task-1", "2026-10-16");
  assert.equal(first.length, 1);
  assert.equal(first[0].gigId, gig.id);
  const twice = syncBookingReminder(gig, first, "task-2", "2026-10-16");
  assert.equal(twice.length, 1);
  assert.equal(twice[0].id, "task-1");
  const moved = syncBookingReminder(
    { ...gig, outreachNextFollowUp: "2027-03-13" },
    twice,
    "task-3",
    "2026-10-16",
  );
  assert.equal(moved[0].dueDate, "2027-03-13");
  const done = moved.map((t) => ({ ...t, status: "done" }));
  assert.deepEqual(
    syncBookingReminder(
      { ...gig, outreachNextFollowUp: "2027-03-13" },
      done,
      "task-4",
      "2026-10-16",
    ),
    done,
  );
  assert.equal(
    syncBookingReminder({ ...gig, status: "passed" }, first, "task-5", "2026-10-16")[0].status,
    "done",
  );
  assert.equal(validBookingDay("2027-02-30"), false);
  const draft = bookingDraft(gig, {
    artistName: "River Fold",
    city: "Albany, NY",
    genre: "Indie folk",
    draw: "50–75, self-reported",
    notes: "https://example.invalid/river-fold-epk",
  });
  assert.match(draft, /River Fold/);
  assert.match(draft, /self-reported/);
  assert.match(draft, /No date, availability, fee/);
});
test("advisor output unwraps nested JSON without exposing structured payloads", () => {
  assert.equal(
    readableAdvisorAnswer(
      JSON.stringify({ answer: JSON.stringify({ answer: "Readable booking advice." }) }),
    ).answer,
    "Readable booking advice.",
  );
  assert.equal(readableAdvisorAnswer('{"answer":').answer, "");
});
