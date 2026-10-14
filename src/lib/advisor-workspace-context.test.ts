import assert from "node:assert/strict";
import test from "node:test";
import { advisorWorkspaceContext } from "./advisor-workspace-context.ts";

test("preserves financial and booking context beyond previous 5900-character cutoff", () => {
  const workspace = "PROFILE\n" + "x".repeat(6500) + "\nMONEY LEDGER\nGIG PIPELINE\nPEOPLE";
  assert.equal(advisorWorkspaceContext(workspace), workspace);
});
test("bounds oversized context and explicitly marks omitted records", () => {
  const output = advisorWorkspaceContext("x".repeat(15000));
  assert.ok(output.length <= 14000);
  assert.match(output, /truncated/);
});
