import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = ts.transpile(
  readFileSync(new URL("../src/lib/outreach-followup-policy.ts", import.meta.url), "utf8"),
  { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
);
const { matchedBookingReplies, classifyBookingReply } = await import(
  "data:text/javascript;base64," + Buffer.from(source).toString("base64")
);
test("follow-up matching rejects foreign thread, sender, old mail and outgoing messages", () => {
  const base = {
    id: "inbound",
    threadId: "thread1",
    internalDate: "2000",
    labelIds: ["INBOX"],
    payload: {
      headers: [{ name: "From", value: "Booker <booker@example.com>" }],
      body: { data: Buffer.from("Please do not contact me").toString("base64url") },
    },
  };
  const input = { recipient: "booker@example.com", threadId: "thread1", sentAt: 1000 };
  assert.deepEqual(matchedBookingReplies([base], input), [
    { messageId: "inbound", classification: "opt_out" },
  ]);
  for (const patch of [
    { threadId: "other" },
    { internalDate: "500" },
    { labelIds: ["SENT"] },
    { payload: { headers: [{ name: "From", value: "other@example.com" }] } },
  ])
    assert.equal(matchedBookingReplies([{ ...base, ...patch }], input).length, 0);
  assert.equal(classifyBookingReply("not interested"), "declined");
  assert.equal(classifyBookingReply("send us available dates"), "interested");
  assert.equal(classifyBookingReply("Thanks for writing"), "unclassified");
});
