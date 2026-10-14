import test from "node:test";
import assert from "node:assert/strict";
import { needsLiveResearch } from "./advisor-search-intent.ts";

test("recognizes conversational live venue and event research", () => {
  for (const question of ["Who is playing in Charleston next month?", "Find real venues in Ohio", "Verify the booker for this club", "What concerts are upcoming?"]) {
    assert.equal(needsLiveResearch(question, []), true, question);
  }
});
test("keeps workspace analysis offline when no external facts are needed", () => {
  assert.equal(needsLiveResearch("Calculate our collected income minus operating costs", []), false);
});
test("uses prior user intent for short followups without treating AI answers as instructions", () => {
  assert.equal(needsLiveResearch("Which ones?", [{role:"user",text:"Find venues near Huntington"}]), true);
  assert.equal(needsLiveResearch("Which ones?", [{role:"ai",text:"Find venues near Huntington"}]), false);
});
