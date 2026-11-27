import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  buildLeadIdempotencyKey,
  isAllowedLeadSourceUrl,
  pushLeadSignals,
  validateLeadSignal,
} from "./lead-scout-push.mjs";

test("isAllowedLeadSourceUrl blocks x.com and twitter.com hosts", () => {
  assert.equal(isAllowedLeadSourceUrl("https://localnash.com"), true);
  assert.equal(isAllowedLeadSourceUrl("https://x.com/somevenue/status/1"), false);
  assert.equal(isAllowedLeadSourceUrl("https://twitter.com/somevenue"), false);
  assert.equal(isAllowedLeadSourceUrl("https://mobile.twitter.com/somevenue"), false);
  assert.equal(isAllowedLeadSourceUrl("javascript:alert(1)"), false);
});

test("validateLeadSignal enforces band/live-music contract and deterministic idempotencyKey", () => {
  const res = validateLeadSignal(
    {
      title: "The Local — Independent band showcase",
      summary: "Nashville independent band room accepting EPKs and local draw history.",
      sourceUrl: "https://localnash.com",
      urgency: "high",
      payload: {
        venue: "The Local",
        city: "Nashville, TN",
        segment: "venue_booking",
        billType: "Showcase / Co-bill",
        recommendedAngle: "Pitch EPK + live video + weekend dates",
      },
    },
    "2026-11-27",
  );
  assert.equal(res.ok, true);
  assert.equal(res.signal.idempotencyKey, "band-scout-2026-11-27-the-local-nashville-tn");
  assert.equal(res.signal.sourceAgent, "band-scout-bot");
  assert.equal(res.signal.signalType, "venue_lead");

  const badSegment = validateLeadSignal({
    title: "Non-music B2B lead",
    summary: "Should be rejected by band-only segment allowlist",
    sourceUrl: "https://example.com",
    payload: {
      venue: "Acme CPA",
      city: "Nashville, TN",
      segment: "accounting_firm",
      billType: "N/A",
      recommendedAngle: "N/A",
    },
  });
  assert.equal(badSegment.ok, false);
  assert.equal(
    buildLeadIdempotencyKey("Asheville Music Hall", "2026-11-27"),
    "band-scout-2026-11-27-asheville-music-hall",
  );
});

test("pushLeadSignals handles 201 insert, 200 deduplicated, and blocks Twitter links without fetch", async () => {
  let calls = 0;
  const mockFetch = async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(
        JSON.stringify({ ok: true, id: "sig-band-1", status: "new", fitScore: 92, priorityTier: "high" }),
        { status: 201 },
      );
    }
    return new Response(
      JSON.stringify({
        ok: true,
        deduplicated: true,
        idempotencyKey: "band-scout-2026-11-27-asheville-music-hall",
      }),
      { status: 200 },
    );
  };

  const valid = {
    idempotencyKey: "band-scout-2026-11-27-asheville-music-hall",
    title: "Asheville Music Hall — Direct tour support slot",
    summary: "Mid-size independent room coordinating Southeast regional support bills.",
    sourceUrl: "https://ashevillemusichall.com",
    urgency: "high",
    payload: {
      venue: "Asheville Music Hall",
      city: "Asheville, NC",
      segment: "tour_support",
      billType: "Direct support",
      recommendedAngle: "Pitch EPK + routing dates 8 weeks out",
    },
  };
  const blocked = { ...valid, sourceUrl: "https://x.com/ashevillemusichall" };

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

test("data/lead-scout-queue.json contains only valid HTTPS non-X/Twitter Southeast & Midwest band signals", () => {
  const queueRaw = readFileSync(resolve(process.cwd(), "data/lead-scout-queue.json"), "utf8");
  assert.equal(/\b(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\b/i.test(queueRaw), false);

  const items = JSON.parse(queueRaw);
  assert.ok(Array.isArray(items) && items.length >= 12);

  const keys = new Set();
  let hasSoutheast = false;
  let hasMidwest = false;

  for (const item of items) {
    const checked = validateLeadSignal(item);
    assert.equal(checked.ok, true, `Invalid queue item ${item?.idempotencyKey}: ${checked.error}`);
    assert.ok(checked.signal.sourceUrl.startsWith("https://"), `Expected https URL for ${item.idempotencyKey}`);
    assert.ok(checked.signal.corridor, `Missing corridor for ${item.idempotencyKey}`);
    assert.ok(checked.signal.billRole, `Missing billRole for ${item.idempotencyKey}`);
    assert.ok(checked.signal.targetWindow, `Missing targetWindow for ${item.idempotencyKey}`);
    assert.ok(checked.signal.dealType, `Missing dealType for ${item.idempotencyKey}`);
    assert.equal(keys.has(checked.signal.idempotencyKey), false, `Duplicate idempotencyKey: ${checked.signal.idempotencyKey}`);
    keys.add(checked.signal.idempotencyKey);

    const city = checked.signal.payload.city;
    if (/(TN|NC|GA)\b/.test(city)) hasSoutheast = true;
    if (/(KY|IN|IL|OH|WI)\b/.test(city)) hasMidwest = true;
  }

  assert.equal(hasSoutheast, true);
  assert.equal(hasMidwest, true);
});
