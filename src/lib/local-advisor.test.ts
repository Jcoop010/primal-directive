import test from "node:test";
import assert from "node:assert/strict";
import { localGrowthAdvice } from "./local-advisor.ts";

test("blank profile fields never consume the next field label", () => {
  const result = localGrowthAdvice("grow local draw", "ARTIST: \nHOME: \nGENRE: \nTYPICAL DRAW: \nFEE TARGET: $0\n");
  assert.doesNotMatch(result.answer, /HOME:|GENRE:|TYPICAL DRAW:|FEE TARGET:/);
});

test("gig financial fallback accepts the current ledger's member field", () => {
  const result = localGrowthAdvice("profit by gig", "MONEY LEDGER (app records):\n- date:2026-10-14 | type:collected | amount:500 | gigId:show-1 | gig:Real show | member:none | label:Fee\n- date:2026-10-14 | type:cost | amount:100 | gigId:show-1 | gig:Real show | member:none | label:Travel\n\n");
  assert.match(result.answer, /Real show/);
  assert.match(result.answer, /400/);
});

const financialContext = `ARTIST: Example Band
HOME: Parkersburg, WV
GENRE: Jam
TYPICAL DRAW: 80
FEE TARGET: $500

MONEY: collected 1200, outstanding 300, costs 450, profit 750, member payouts 200
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
  assert.match(result.answer, /Cash-based difference \(collected minus recorded costs\): \$750\.00/);
  assert.match(result.answer, /Member payouts \(tracked separately from operating costs\): \$200\.00/);
  assert.match(result.answer, /Difference after recorded payouts: \$550\.00/);
  assert.match(result.answer, /not independently verified against bank statements/i);
  assert.match(result.answer, /outstanding amounts are not collected cash/i);
});

test("offline advisor flags a profit total that conflicts with collected minus recorded costs", () => {
  const context = financialContext.replace("profit 750", "profit 900");
  const result = localGrowthAdvice("Give me our financial summary", context);
  assert.match(result.answer, /Cash-based difference \(collected minus recorded costs\): \$750\.00/);
  assert.match(result.answer, /App-reported profit: \$900\.00/);
  assert.match(result.answer, /does not match collected minus recorded costs/i);
  assert.match(result.answer, /not necessarily accounting profit or taxable income/i);
});

test("offline financial advice refuses to invent totals when the money summary is missing", () => {
  const result = localGrowthAdvice("How much profit did we make?", "ARTIST: Example Band\nGIG PIPELINE:\n(empty)");
  assert.match(result.answer, /can't calculate a trustworthy financial summary/i);
  assert.match(result.answer, /won't fill the gaps with guesses/i);
  assert.doesNotMatch(result.answer, /\$\d/);
});

test("offline advisor ranks gigs from linked collected income and cost records only", () => {
  const ledger = [
    "MONEY: collected 1800, outstanding 500, costs 550, profit 1250",
    "MONEY LEDGER (up to 18 records; may be incomplete; app-recorded, not bank-verified):",
    "- date:2026-10-01 | type:collected | amount:1000 | gigId:gig-a | gig:Show A | label:guarantee",
    "- date:2026-10-01 | type:cost | amount:400 | gigId:gig-a | gig:Show A | label:travel",
    "- date:2026-10-02 | type:collected | amount:800 | gigId:gig-b | gig:Show B | label:guarantee",
    "- date:2026-10-02 | type:cost | amount:100 | gigId:gig-b | gig:Show B | label:lodging",
    "- date:2026-10-02 | type:payout | amount:200 | gigId:gig-b | gig:Show B | member:Alex | label:member payout",
    "- date:2026-10-02 | type:outstanding | amount:500 | gigId:gig-b | gig:Show B | label:unpaid balance",
    "- date:2026-10-02 | type:cost | amount:999 | gigId:none | gig:unlinked | label:unassigned expense",
  ].join("\n");
  const context = financialContext.replace(
    "MONEY: collected 1200, outstanding 300, costs 450, profit 750",
    ledger,
  );
  const result = localGrowthAdvice("Which gigs are most profitable?", context);
  assert.match(result.answer, /Show A: collected \$1,000\.00; recorded costs \$400\.00; cash-based difference \$600\.00/);
  assert.match(result.answer, /Show B: collected \$800\.00; recorded costs \$100\.00; cash-based difference \$700\.00/);
  assert.match(result.answer, /highest cash-based difference is Show B at \$700\.00/);
  assert.match(result.answer, /outstanding amounts are excluded from collected cash/i);
  assert.doesNotMatch(result.answer, /\$1,299\.00/);
});

test("offline advisor refuses to rank gig profitability without gig-linked records", () => {
  const result = localGrowthAdvice("Which gigs are most profitable?", financialContext);
  assert.match(result.answer, /can.t reliably rank gig profitability because no collected-income or cost entries linked to individual gigs were included/i);
  assert.match(result.answer, /can.t reliably rank gig profitability/i);
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


test("offline advisor excludes unpaid fees and member distributions from gig cash comparison", () => {
  const context = [
    "ARTIST: Test Band",
    "MONEY: collected 600, outstanding 900, costs 200, profit 400, member payouts 150",
    "MONEY LEDGER (up to 18 records; may be incomplete; app-recorded, not bank-verified):",
    "- date:2026-10-14 | type:collected | amount:600 | gigId:gig-one | gig:First Show | member:none | label:Guarantee",
    "- date:2026-10-14 | type:cost | amount:200 | gigId:gig-one | gig:First Show | member:none | label:Travel",
    "- date:2026-10-14 | type:outstanding | amount:900 | gigId:gig-one | gig:First Show | member:none | label:Unpaid fee",
    "- date:2026-10-14 | type:payout | amount:150 | gigId:gig-one | gig:First Show | member:Alex | label:Distribution",
  ].join("\n");
  const result = localGrowthAdvice("Profit by gig?", context);
  assert.match(result.answer, /First Show: collected \$600\.00; recorded costs \$200\.00; cash-based difference \$400\.00/);
  assert.match(result.answer, /outstanding amounts are excluded from collected cash/i);
  assert.doesNotMatch(result.answer, /\$1,300\.00/);
});

test("offline advisor labels partially linked gig records as incomplete", () => {
  const context = [
    "ARTIST: Test Band",
    "MONEY LEDGER (up to 18 records; may be incomplete; app-recorded, not bank-verified):",
    "- date:2026-10-14 | type:collected | amount:500 | gigId:gig-a | gig:Only Income | member:none | label:Fee",
    "- date:2026-10-14 | type:cost | amount:100 | gigId:gig-b | gig:Only Costs | member:none | label:Travel",
  ].join("\n");
  const result = localGrowthAdvice("Which gigs were most profitable?", context);
  assert.match(result.answer, /Only Income: collected \$500\.00; no costs linked; incomplete/i);
  assert.match(result.answer, /Only Costs: no collected income linked; recorded costs \$100\.00; incomplete/i);
  assert.match(result.answer, /not enough gigs with both collected income and linked costs/i);
});
