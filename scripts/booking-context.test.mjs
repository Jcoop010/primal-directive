import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";

// Load the actual store and its pure helpers with the application's aliases.
async function load(path) {
  let code = stripTypeScriptTypes(await readFile(new URL(path, import.meta.url), "utf8"));
  for (const match of [...code.matchAll(/from "(@\/[^"\n]+)"/g)]) {
    const url = await load("../src/" + match[1].slice(2) + ".ts");
    code = code.replaceAll(JSON.stringify(match[1]), JSON.stringify(url));
  }
  for (const name of ["zustand", "zustand/middleware", "clsx", "tailwind-merge"]) {
    code = code.replaceAll(JSON.stringify(name), JSON.stringify(import.meta.resolve(name)));
  }
  for (const match of [...code.matchAll(/from "(\.\/[^"\n]+)"/g)]) {
    code = code.replaceAll(JSON.stringify(match[1]), JSON.stringify(new URL(match[1], new URL(path, import.meta.url)).href));
  }
  return "data:text/javascript;base64," + Buffer.from(code).toString("base64");
}

test("booking leads remain unconfirmed and saved outreach reaches the advisor", async () => {
  const { useMusician, buildAdvisorContext } = await import(await load("../src/lib/store.ts"));
  useMusician.getState().clearAll();
  const lead = { name: "Fictional Room", venue: "Fictional Room", city: "Test City", date: "2030-01-01", fee: 999, conf: 0.4, status: "booked", reason: "Source requires review", sourceUrl: "https://example.invalid/room" };
  useMusician.getState().ingestSuggestedGig(lead);
  const gig = useMusician.getState().gigs[0];
  assert.equal(gig.status, "lead");
  assert.equal(gig.date, "");
  assert.equal(gig.fee, 0);
  assert.equal(gig.researchVerifiedAt, undefined);
  assert.equal(gig.researchSourceUrl, lead.sourceUrl);
  useMusician.getState().ingestSuggestedGig(lead);
  assert.equal(useMusician.getState().gigs.length, 1);
  useMusician.getState().updateGig(gig.id, { outreachContact: "Official submission form", outreachNextFollowUp: "2030-02-01", outreachLastContactedAt: "2030-01-20", outreachNotes: "Waiting for venue reply" });
  const context = buildAdvisorContext();
  for (const value of [lead.sourceUrl, "Official submission form", "2030-02-01", "2030-01-20", "Waiting for venue reply"]) assert.ok(context.includes(value));
  useMusician.getState().updateProfile({ notes: "long profile ".repeat(1000) });
  assert.ok(buildAdvisorContext().length <= 4500);
  assert.ok(buildAdvisorContext().includes("2030-02-01"));
});

test("booking lifecycle preserves records, stage history and task idempotency", async () => {
  const { useMusician, pipelineGigs, buildAdvisorContext } = await import(await load("../src/lib/store.ts"));
  useMusician.getState().clearAll();
  const base = { name: "Fictional booking", venue: "A Fictional Hall", city: "Test City", date: "", fee: 0, conf: 0.5, status: "lead", notes: "", outreachNextFollowUp: "2030-02-01" };
  const id = useMusician.getState().addGig(base);
  for (const status of ["qualified", "ready", "outreach", "responded", "negotiating", "hold"]) useMusician.getState().updateGig(id, { status });
  assert.equal(useMusician.getState().tasks.length, 1);
  assert.throws(() => useMusician.getState().updateGig(id, { status: "booked" }), /show date/);
  assert.equal(useMusician.getState().gigs[0].status, "hold");
  useMusician.getState().updateGig(id, { status: "booked", date: "2030-03-20", fee: 125.50 });
  const booked = useMusician.getState();
  assert.equal(booked.gigs[0].stageHistory.length, 7);
  assert.equal(booked.tasks.filter(t => t.sourceKey.startsWith("show:")).length, 6);
  useMusician.getState().updateGig(id, { notes: "Confirmed by artist" });
  assert.equal(useMusician.getState().gigs[0].stageHistory.length, 7);
  assert.equal(useMusician.getState().tasks.length, booked.tasks.length);
  useMusician.getState().ingestSuggestedGig({ ...base, name: "A different model title", date: "", reason: "", sourceUrl: "https://example.invalid/room" });
  assert.equal(useMusician.getState().gigs.length, 1, "confirmed venues cannot become duplicate new leads");
  for (const status of ["completed", "declined", "lost", "canceled", "archived", "passed"]) {
    useMusician.getState().updateGig(id, { status });
    assert.equal(pipelineGigs(useMusician.getState().gigs).length, 0);
    assert.equal(useMusician.getState().tasks.filter(t => t.sourceKey.startsWith("booking:") && t.status === "open").length, 0);
  }
  useMusician.getState().updateGig(id, { venueCapacity: 200, capacitySourceUrl: "https://example.invalid/about", bookingRoute: "https://example.invalid/book" });
  useMusician.getState().updateGig(id, { venue: "Different Fictional Venue" });
  assert.equal(useMusician.getState().gigs[0].venueCapacity, undefined);
  assert.equal(useMusician.getState().gigs[0].bookingRoute, undefined);
  useMusician.getState().updateProfile({ epkUrl: "https://example.invalid/epk", touringRadiusMiles: 120, audience: "Self-reported indie listeners" });
  assert.match(buildAdvisorContext(), /120 miles/);
  assert.match(buildAdvisorContext(), /https:\/\/example.invalid\/epk/);
  useMusician.setState({ workspaceOwnerId: "fictional-user" });
  const saved = useMusician.getState().gigs;
  useMusician.getState().resetSample();
  assert.deepEqual(useMusician.getState().gigs, saved, "demo reset must not replace signed-in records");
});
