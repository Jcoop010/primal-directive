import assert from "node:assert/strict";
import test from "node:test";
import { makeBriefingActionPrompt } from "./briefing-actions.ts";

test("creates an approval-first prompt grounded in the selected signal", () => {
  const prompt = makeBriefingActionPrompt({ id: "collections", priority: "important", title: "$250 to collect", detail: "Review outstanding payments.", href: "/money" });
  assert.match(prompt, /\$250 to collect/);
  assert.match(prompt, /Review outstanding payments/);
  assert.match(prompt, /for review/);
});
