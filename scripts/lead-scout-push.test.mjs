import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildLeadIdempotencyKey,
  isAllowedLeadSourceUrl,
  pushLeadSignals,
  validateLeadSignal,
} from "./lead-scout-push.mjs";

test("isAllowedLeadSourceUrl blocks x.com and twitter.com hosts", () => {
  assert.equal(isAllowedLeadSourceUrl("https://hildrethcpa.com"), true);
  assert.equal(isAllowedLeadSourceUrl("https://x.com/somebiz/status/1"), false);
  assert.equal(isAllowedLeadSourceUrl("https://twitter.com/somebiz"), false);
  assert.equal(isAllowedLeadSourceUrl("https://mobile.twitter.com/somebiz"), false);
  assert.equal(isAllowedLeadSourceUrl("javascript:alert(1)"), false);
});

test("validateLeadSignal enforces contract and generates deterministic idempotencyKey", () => {
  const res = validateLeadSignal(
    {
      title: "Hildreth & Associates CPA — Client intake & monthly close automation",
      summary: "Small business CPA firm in Nashville/Brentwood handling bookkeeping and cash flow.",
      sourceUrl: "https://hildrethcpa.com",
      payload: {
        company: "Hildreth & Associates CPA",
        segment: "accounting_firm",
        painPoint: "Manual client document chasing and slow onboarding follow-up",
        recommendedAngle: "Automated intake checklist and monthly close reminders",
        urgency: "high",
      },
    },
    "2026-11-27",
  );
  assert.equal(res.ok, true);
  assert.equal(res.signal.idempotencyKey, "lead-scout-2026-11-27-hildreth-associates-cpa");
  assert.equal(res.signal.sourceAgent, "lead-scout-bot");
  assert.equal(res.signal.signalType, "lead_opportunity");

  const badSegment = validateLeadSignal({
    title: "Test",
    summary: "Summary",
    sourceUrl: "https://example.com",
    payload: {
      company: "Acme",
      segment: "unknown_segment",
      painPoint: "Slow",
      recommendedAngle: "Fast",
      urgency: "high",
    },
  });
  assert.equal(badSegment.ok, false);
  assert.equal(buildLeadIdempotencyKey("Callison CPA", "2026-11-27"), "lead-scout-2026-11-27-callison-cpa");
});

test("pushLeadSignals handles 201 insert, 200 deduplicated, and rejects Twitter links without calling fetch", async () => {
  let calls = 0;
  const mockFetch = async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(JSON.stringify({ ok: true, id: "sig-1", status: "new" }), { status: 201 });
    }
    return new Response(
      JSON.stringify({ ok: true, deduplicated: true, idempotencyKey: "lead-scout-2026-11-27-acme" }),
      { status: 200 },
    );
  };

  const valid = {
    idempotencyKey: "lead-scout-2026-11-27-acme",
    title: "Acme HVAC — Missed-call recovery",
    summary: "Local service team handling high call volume with manual quote follow-up.",
    sourceUrl: "https://example.com/acme-hvac",
    payload: {
      company: "Acme HVAC",
      segment: "home_services",
      painPoint: "Missed calls and unclosed estimate follow-up",
      recommendedAngle: "Missed-call SMS recovery + automated estimate follow-up",
      urgency: "high",
    },
  };
  const blocked = { ...valid, sourceUrl: "https://x.com/acmehvac" };

  const summary = await pushLeadSignals([valid, valid, blocked], {
    secret: "test-secret",
    fetchImpl: mockFetch,
  });

  assert.equal(calls, 2);
  assert.equal(summary.inserted, 1);
  assert.equal(summary.deduplicated, 1);
  assert.equal(summary.rejected, 1);
  assert.equal(summary.failed, 0);
});
