import test from "node:test";
import assert from "node:assert/strict";
import { localGrowthAdvice } from "./local-advisor.ts";

const financialContext = `ARTIST: Example Band
HOME: Parkersburg, WV
GENRE: Jam
TYPICAL DRAW: 80
FEE TARGET: $500

MONEY: collected 1200, outstanding 300, costs 450, profit 750
MERCH: recorded sales 200, gross profit 120, units sold 10, low-stock items 1

GIG PIPELINE:
- Friday show @ Example Room, Parkersburg | TBD | $500 | outreach | conf 50% | awaiting reply

PEOPLE:
(empty)`;

test("offline financial advice reports only the app-provided totals and labels limitations", () => {
  const result = localGrowthAdvice("Give me our financial summary", financialContext);
  assert.match(result.answer, /Collected: \$1,200\.00/);
  assert.match(result.answer, /Outstanding: \$300\.00/);
  assert.match(result.answer, /Recorded costs: \$450\.00/);
  assert.match(result.answer, /Recorded profit: \$750\.00/);
  assert.match(result.answer, /not independently verified against bank statements/i);
  assert.match(result.answer, /outstanding amounts are not collected cash/i);
});

test("offline financial advice refuses to invent totals when the money summary is missing", () => {
  const result = localGrowthAdvice("How much profit did we make?", "ARTIST: Example Band\nGIG PIPELINE:\n(empty)");
  assert.match(result.answer, /can't calculate a trustworthy financial summary/i);
  assert.match(result.answer, /won't fill the gaps with guesses/i);
  assert.doesNotMatch(result.answer, /\$\d/);
});

test("offline advisor refuses to rank gig profitability without gig-linked records", () => {
  const result = localGrowthAdvice("Which gigs are most profitable?", financialContext);
  assert.match(result.answer, /does not include a reconciled income-and-cost breakdown for each gig/i);
  assert.match(result.answer, /can't reliably rank gig profitability/i);
});

test("offline booking advice never fabricates venues or people", () => {
  const result = localGrowthAdvice("Find me a booker and available venue", "ARTIST: Example Band\nGIG PIPELINE:\n(empty)");
  assert.equal(result.gigs.length, 0);
  assert.equal(result.people.length, 0);
  assert.match(result.answer, /can't verify live venue calendars/i);
});

test("merch questions stay in the inventory advice path", () => {
  const result = localGrowthAdvice("How do I improve merch profit?", financialContext);
  assert.match(result.answer, /contribution margin and sell-through/i);
  assert.doesNotMatch(result.answer, /App-recorded financial summary/i);
});
