import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(new URL("../src/lib/outreach-message.ts", import.meta.url), "utf8");
const compiled = ts.transpile(source, {
  module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ES2022,
});
const { normalizeRecipient, messageFingerprint, encodeGmailMessage, deliverGmail } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);
test("MIME isolates one recipient and preserves Unicode subject/body", () => {
  assert.equal(normalizeRecipient(" Band@Example.com "), "band@example.com");
  for (const value of [
    "a@example.com\r\nBcc: x@example.com",
    "a@example.com,b@example.com",
    "A <a@example.com>",
  ])
    assert.throws(() => normalizeRecipient(value));
  const raw = Buffer.from(
    encodeGmailMessage({
      recipient: "band@example.com",
      subject: "Björk booking",
      body: "Music 🎵\nHello",
      key: "key",
    }),
    "base64url",
  ).toString();
  assert.match(raw, /To: band@example.com\r\n/);
  assert.ok(raw.includes(Buffer.from("Björk booking").toString("base64")));
  assert.equal(
    Buffer.from(raw.split("\r\n\r\n")[1].replaceAll("\r\n", ""), "base64").toString(),
    "Music 🎵\r\nHello",
  );
  assert.throws(() =>
    encodeGmailMessage({
      recipient: "band@example.com",
      subject: "a\r\nBcc: bad",
      body: "test",
      key: "key",
    }),
  );
  assert.notEqual(
    messageFingerprint("band@example.com", "subject", "one"),
    messageFingerprint("band@example.com", "subject", "two"),
  );
});
test("provider receipt, expiration, revocation, throttling, failure and unknown delivery never retry", async () => {
  for (const [status, body, expected] of [
    [200, { id: "m1", threadId: "t1" }, "sent"],
    [200, {}, "unknown"],
    [401, {}, "failed"],
    [403, {}, "failed"],
    [429, {}, "failed"],
    [500, {}, "unknown"],
  ]) {
    let calls = 0;
    const result = await deliverGmail("test-token", "test-raw", async (url, options) => {
      calls++;
      assert.equal(options.method, "POST");
      return new Response(JSON.stringify(body), { status });
    });
    assert.equal(result.status, expected);
    assert.equal(calls, 1);
  }
  let calls = 0;
  const result = await deliverGmail("test-token", "test-raw", async () => {
    calls++;
    throw new Error("timeout");
  });
  assert.equal(result.status, "unknown");
  assert.equal(calls, 1);
});
