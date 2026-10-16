import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";

const moduleUrl = (code) => "data:text/javascript;base64," + Buffer.from(code).toString("base64");
// Execute the real advisor handler with a minimal server-function registration
// harness. Provider HTTP is mocked; these tests never use quota or credentials.
const types = moduleUrl(stripTypeScriptTypes(await readFile(new URL("../src/lib/types.ts", import.meta.url), "utf8")));
const local = moduleUrl(stripTypeScriptTypes(await readFile(new URL("../src/lib/local-advisor.ts", import.meta.url), "utf8")));
let source = stripTypeScriptTypes(await readFile(new URL("../src/lib/ai.ts", import.meta.url), "utf8"));
source = source
  .replace('import { createServerFn } from "@tanstack/react-start";', `
    export const registeredMiddleware = [];
    const createServerFn = () => ({
      middleware(items) { registeredMiddleware.push(...items); return this; },
      validator() { return this; },
      handler(fn) { return fn; },
    });
  `)
  .replace('import { authMiddleware } from "@/lib/auth/middleware";', 'const authMiddleware = "verified-session-middleware";')
  .replace('from "zod"', "from " + JSON.stringify(import.meta.resolve("zod")))
  .replace('from "@/lib/local-advisor"', "from " + JSON.stringify(local))
  .replace('from "@/lib/types"', "from " + JSON.stringify(types));
const { askGrowthAdvisor, registeredMiddleware } = await import(moduleUrl(source));
const data = { message: "Help River Fold plan next week", context: "River Fold is a fictional test band.", history: [] };

test("advisor registers authentication before handling requests", () => {
  assert.deepEqual(registeredMiddleware, ["verified-session-middleware"]);
});

test("advisor handles provider failures without fabricating verified leads", async (t) => {
  const previous = { xai: process.env.XAI_API_KEY, anthropic: process.env.ANTHROPIC_API_KEY };
  delete process.env.ANTHROPIC_API_KEY;
  process.env.XAI_API_KEY = "fictional-test-key";
  try {
    for (const [name, reply] of [
      ["network error", () => { throw new Error("test network failure"); }],
      ["provider HTTP failure", () => new Response("", { status: 503 })],
      ["invalid JSON", () => new Response("not JSON")],
      ["null envelope", () => Response.json(null)],
      ["array envelope", () => Response.json([])],
      ["non-text response", () => Response.json({ choices: [{ message: { content: { bad: true } } }] })],
      ["invalid structured output", () => Response.json({ choices: [{ message: { content: "{}" } }] })],
    ]) {
      await t.test(name, async (subtest) => {
        subtest.mock.method(globalThis, "fetch", async () => reply());
        const result = await askGrowthAdvisor({ data });
        assert.equal(result.ok, true);
        assert.match(result.source, /UNAVAILABLE|INVALID/);
        assert.deepEqual(result.gigs, []);
        assert.deepEqual(result.people, []);
        assert.deepEqual(result.citations, []);
      });
    }
    await t.test("uncited invented leads are discarded", async (subtest) => {
      subtest.mock.method(globalThis, "fetch", async () => Response.json({
        choices: [{ message: { content: JSON.stringify({
          answer: "Planning analysis for fictional River Fold.",
          gigs: [{ name: "Invented Test Venue", sourceUrl: "https://example.invalid/venue" }],
          people: [{ name: "Invented Test Booker", sourceUrl: "https://example.invalid/contact" }],
        }) } }],
      }));
      const result = await askGrowthAdvisor({ data });
      assert.equal(result.ok, true);
      assert.match(result.source, /NO SOURCES/);
      assert.deepEqual(result.gigs, []);
      assert.deepEqual(result.people, []);
    });
    await t.test("missing keys never call a provider", async (subtest) => {
      delete process.env.XAI_API_KEY;
      const mocked = subtest.mock.method(globalThis, "fetch", () => { throw new Error("must not call"); });
      const result = await askGrowthAdvisor({ data });
      assert.match(result.source, /NOT CONFIGURED/);
      assert.equal(mocked.mock.callCount(), 0);
    });
  } finally {
    if (previous.xai === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = previous.xai;
    if (previous.anthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previous.anthropic;
  }
});
