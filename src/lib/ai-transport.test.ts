import assert from "node:assert/strict";
import test from "node:test";
import { boundedHistory, createAdvisorTransport, readProviderBody, providerContent, retryAfterMs } from "./ai-transport.ts";

test("transport accepts successful JSON and extracts model answer", async () => {
  const request = createAdvisorTransport({ fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"answer":"OK"}' } }] }), { status: 200 }) });
  const response = await request("groq", "https://example.test", { method: "POST" });
  assert.equal(response.status, 200);
  assert.equal(providerContent(await readProviderBody(response)), '{"answer":"OK"}');
});

test("transport exposes HTTP 400 so search can retry without search", async () => {
  let calls = 0;
  const request = createAdvisorTransport({ fetchImpl: async () => new Response(null, { status: ++calls === 1 ? 400 : 200 }) });
  assert.equal((await request("groq", "https://example.test", {})).status, 400);
  assert.equal((await request("groq", "https://example.test", {})).status, 200);
  assert.equal(calls, 2);
});

test("transport permits only two attempts per turn", async () => {
  const request = createAdvisorTransport({ fetchImpl: async () => new Response(null, { status: 503 }) });
  await request("groq", "https://example.test", {});
  await request("groq", "https://example.test", {});
  await assert.rejects(() => request("groq", "https://example.test", {}), /budget exhausted/);
});

test("provider body parser safely handles malformed JSON", async () => {
  assert.deepEqual(await readProviderBody(new Response("not json")), {});
  assert.equal(providerContent({ choices: [{ message: { content: null } }] }), "");
});

test("retry-after honors minimum minute and capped day", () => {
  assert.equal(retryAfterMs("2"), 60000);
  assert.equal(retryAfterMs("120"), 120000);
  assert.equal(retryAfterMs("999999"), 86400000);
});

test("bounded history preserves recent conversation without unbounded prompts", () => {
  const history = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? "ai" as const : "user" as const, text: "x".repeat(2000) }));
  const result = boundedHistory(history);
  assert.ok(result.length <= 8);
  assert.ok(result.reduce((n, x) => n + x.content.length, 0) <= 3000);
});
