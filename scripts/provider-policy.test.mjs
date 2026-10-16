import { test } from "node:test";
import assert from "node:assert/strict";
import { createProviderPolicy, retryDelay } from "../src/lib/provider-policy.ts";
test("429 cooldown is provider-specific, honors Retry-After and recovers when the window expires", async () => {
  let now = 1000,
    calls = 0;
  const blocks = new Map();
  const opts = {
    now: () => now,
    blocks,
    fetchImpl: async () => {
      calls++;
      return new Response("quota", { status: 429, headers: { "retry-after": "120" } });
    },
  };
  await createProviderPolicy(opts).request("gemini", "https://example.org", {});
  assert.equal(createProviderPolicy(opts).blocked("gemini").seconds, 120);
  assert.equal(createProviderPolicy(opts).blocked("anthropic"), null);
  await createProviderPolicy(opts).request("gemini", "https://example.org", {});
  assert.equal(calls, 1);
  now += 120001;
  assert.equal(createProviderPolicy(opts).blocked("gemini"), null);
  await createProviderPolicy(opts).request("gemini", "https://example.org", {});
  assert.equal(calls, 2);
});
test("provider failures never cause a second request to the same provider in a turn", async () => {
  let calls = 0;
  const policy = createProviderPolicy({
    blocks: new Map(),
    fetchImpl: async () => {
      calls++;
      return new Response("ok");
    },
  });
  await policy.request("gemini", "https://example.org", {});
  await assert.rejects(policy.request("gemini", "https://example.org", {}), /budget/);
  await policy.request("anthropic", "https://example.org", {});
  assert.equal(calls, 2);
});
test("Gemini retry metadata and zero-quota failures produce bounded waits", () => {
  assert.equal(
    retryDelay(new Headers(), { error: { details: [{ retryDelay: "125s" }] } }, 0),
    125000,
  );
  assert.equal(
    retryDelay(new Headers(), { error: { details: [{ violations: [{ quotaValue: "0" }] }] } }, 0),
    900000,
  );
  assert.equal(retryDelay(new Headers({ "retry-after": "nonsense" }), {}, 0), 60000);
});
