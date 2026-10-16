import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";

const code = stripTypeScriptTypes(await readFile(new URL("../src/lib/format.ts", import.meta.url), "utf8"));
const { money } = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
test("financial displays retain cents without adding decimals to whole dollars", () => {
  assert.equal(money(125.5), money(125.5, 2));
  assert.equal(money(-12.49), money(-12.49, 2));
  assert.equal(money(0.49), money(0.49, 2));
  assert.equal(money(500), money(500, 0));
});
