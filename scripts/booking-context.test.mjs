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
