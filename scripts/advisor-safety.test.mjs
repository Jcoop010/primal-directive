import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";

const moduleUrl = (code) => "data:text/javascript;base64," + Buffer.from(code).toString("base64");
const policyUrl = new URL('../src/lib/provider-policy.ts', import.meta.url).href;
// Execute the real advisor handler with a minimal server-function registration
// harness. Provider HTTP is mocked; these tests never use quota or credentials.
const types = moduleUrl(stripTypeScriptTypes(await readFile(new URL("../src/lib/types.ts", import.meta.url), "utf8")));
const local = moduleUrl(stripTypeScriptTypes(await readFile(new URL("../src/lib/local-advisor.ts", import.meta.url), "utf8")));
let source = stripTypeScriptTypes(await readFile(new URL("../src/lib/ai.ts", import.meta.url), "utf8"));
source = source
  .replace('from "@/lib/venue-evidence"', "from " + JSON.stringify(new URL("../src/lib/venue-evidence.ts", import.meta.url).href))
  .replace('from "@/lib/advisor-answer"', "from " + JSON.stringify(new URL("../src/lib/advisor-answer.ts", import.meta.url).href))
  .replace('from "@/lib/provider-policy"', "from " + JSON.stringify(policyUrl))
  .replace("const policy = createProviderPolicy({", "const policy = createProviderPolicy({blocks:new Map(),")

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

test("booking research retains grounding through failover and rate limits", async (t) => {
  const { askGrowthAdvisor, regressionBlocks } = await import(moduleUrl("export const regressionBlocks = new Map();\n" + source.replace("blocks:new Map()", "blocks:regressionBlocks")));
  const keys = ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "XAI_API_KEY", "GEMINI_SEARCH_GROUNDING_ENABLED", "GEMINI_MODEL"];
  const previous = keys.map((key) => process.env[key]);
  const researchData = { ...data, message: "Find venues in my home market" };
  const answer = { answer: "Review this fictional source before outreach.", gigs: [{ name: "Test Room", sourceUrl: "https://example.invalid/room?id=1", date: "2030-01-01", fee: 900, status: "booked" }] };
  const gemini = () => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] }, groundingMetadata: { groundingChunks: [{ web: { uri: "https://example.invalid/room?id=1" } }] } }] });
  const xai = () => Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(answer), annotations: [{ type: "url_citation", url: "https://example.invalid/room?id=1" }] }] }] });
  try {
    delete process.env.GEMINI_MODEL;
    delete process.env.ANTHROPIC_API_KEY;
    process.env.GEMINI_API_KEY = "fictional-gemini";
    process.env.XAI_API_KEY = "fictional-xai";
    process.env.GEMINI_SEARCH_GROUNDING_ENABLED = "false";
    await t.test("search-disabled Gemini cannot stop grounded xAI discovery", async (st) => {
      const mock = st.mock.method(globalThis, "fetch", async (url, options) => {
        assert.equal(url, "https://api.x.ai/v1/responses");
        assert.deepEqual(JSON.parse(options.body).tools, [{ type: "web_search" }]);
        return xai();
      });
      const result = await askGrowthAdvisor({ data: researchData });
      assert.equal(mock.mock.callCount(), 1);
      assert.equal(result.gigs.length, 1);
      assert.equal(result.gigs[0].status, "lead");
      assert.equal(result.gigs[0].date, "");
      assert.equal(result.gigs[0].fee, 0);
    });
    process.env.GEMINI_SEARCH_GROUNDING_ENABLED = "true";
    await t.test("Anthropic search-result sources survive JSON without inline citations", async (st) => {
      process.env.ANTHROPIC_API_KEY = "fictional-anthropic";
      st.mock.method(globalThis, "fetch", async (url) => {
        assert.match(String(url), /api.anthropic.com/);
        return Response.json({ content: [
          { type: "web_search_tool_result", content: [{ type: "web_search_result", url: answer.gigs[0].sourceUrl }] },
          { type: "text", text: JSON.stringify(answer) },
        ] });
      });
      const result = await askGrowthAdvisor({ data: researchData });
      assert.equal(result.gigs.length, 1);
      assert.deepEqual(result.citations, [answer.gigs[0].sourceUrl]);
      assert.match(result.source, /LIVE WEB SEARCH/);
      delete process.env.ANTHROPIC_API_KEY;
    });
    await t.test("research without returned evidence cannot claim live verification", async (st) => {
      process.env.ANTHROPIC_API_KEY = "fictional-anthropic";
      st.mock.method(globalThis, "fetch", async (url) => {
        if (String(url).includes("anthropic")) return Response.json({ content: [
          { type: "web_search_tool_result", content: { type: "web_search_tool_result_error", error_code: "unavailable" } },
          { type: "text", text: JSON.stringify({ ...answer, answer: "Live search confirmed!" }) },
        ] });
        return new Response("", { status: 503 });
      });
      const result = await askGrowthAdvisor({ data: researchData });
      assert.match(result.source, /UNAVAILABLE/);
      assert.doesNotMatch(result.answer, /Live search confirmed/);
      assert.deepEqual(result.gigs, []);
      delete process.env.ANTHROPIC_API_KEY;
      regressionBlocks.clear();
    });
    await t.test("an unknown fee cannot discard an otherwise grounded booking lead", async (st) => {
      st.mock.method(globalThis, "fetch", async () => {
        const response = await gemini().json();
        response.candidates[0].content.parts[0].text = JSON.stringify({ ...answer, answer: "Verified venue lead returned. See answer above.", gigs: [{ ...answer.gigs[0], fee: "", date: null, status: "unconfirmed" }] });
        return Response.json(response);
      });
      const result = await askGrowthAdvisor({ data: researchData });
      assert.equal(result.gigs.length, 1);
      assert.equal(result.gigs[0].fee, 0);
      assert.equal(result.gigs[0].date, "");
      assert.equal(result.gigs[0].status, "lead");
      assert.match(result.answer, /source-cited venue lead/);
      assert.equal(result.gigs[0].name, "Test Room");
      assert.match(result.source, /LIVE WEB SEARCH/);
    });
    await t.test("current Gemini model and full search timeout are preserved", async(st)=>{const timeout=AbortSignal.timeout;const budgets=[];st.mock.method(AbortSignal,"timeout",ms=>{budgets.push(ms);return timeout(ms)});st.mock.method(globalThis,"fetch",async url=>{assert.match(String(url),/gemini-3[.]8-flash:generateContent$/);return gemini()});assert.equal((await askGrowthAdvisor({data:researchData})).gigs.length,1);assert.equal(budgets[0],75000)});
    await t.test("Google grounding redirects match the destination without fetching it", async (st) => {
      const urls = [];
      st.mock.method(globalThis, "fetch", async (url, options) => {
        urls.push(String(url));
        if (String(url).startsWith("https://vertexaisearch.cloud.google.com/")) {
          assert.equal(options.redirect, "manual");
          assert.equal(options.headers, undefined);
          return new Response(null, { status: 302, headers: { location: "https://example.invalid/room?id=1" } });
        }
        const response = await gemini().json();
        response.candidates[0].groundingMetadata.groundingChunks[0].web.uri = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/test";
        return Response.json(response);
      });
      const result = await askGrowthAdvisor({ data: researchData });
      assert.equal(result.gigs.length, 1);
      assert.ok(result.citations.includes("https://example.invalid/room?id=1"));
      assert.equal(urls.length, 2);
    });
    await t.test("short confirmation preserves venue research", async (st) => {
      st.mock.method(globalThis, "fetch", async (_url, options) => {
        assert.deepEqual(JSON.parse(options.body).tools, [{ google_search: {} }]);
        return gemini();
      });
      assert.equal((await askGrowthAdvisor({ data: { ...data, message: "Do it", history: [{ role: "user", text: researchData.message }] } })).gigs.length, 1);
    });
    await t.test("invalid success and unsupported search fail over without dropping search", async (st) => {
      process.env.ANTHROPIC_API_KEY = "fictional-anthropic";
      const urls = [];
      st.mock.method(globalThis, "fetch", async (url, options) => {
        urls.push(url);
        if (url.includes("anthropic")) return Response.json({ content: [{ type: "text", text: "{}" }] });
        if (url.includes("googleapis")) return new Response("", { status: 400 });
        assert.deepEqual(JSON.parse(options.body).tools, [{ type: "web_search" }]);
        return xai();
      });
      const result = await askGrowthAdvisor({ data: researchData });
      assert.equal(result.gigs.length, 1);
      assert.equal(urls.length, 3);
      delete process.env.ANTHROPIC_API_KEY;
    });
    await t.test("different query records are not the same evidence", async (st) => {
      st.mock.method(globalThis, "fetch", async () => {
        const response = await gemini().json();
        response.candidates[0].groundingMetadata.groundingChunks[0].web.uri = "https://example.invalid/room?id=2";
        return Response.json(response);
      });
      assert.deepEqual((await askGrowthAdvisor({ data: researchData })).gigs, []);
    });
    await t.test("429 immediately fails over and honors Retry-After on later requests", async (st) => {
      let now = Date.now();
      st.mock.method(Date, "now", () => now);
      let geminiCalls = 0;
      st.mock.method(globalThis, "fetch", async (url) => {
        if (url.includes("googleapis")) {
          geminiCalls++;
          return new Response("", { status: 429, headers: { "retry-after": "30" } });
        }
        return xai();
      });
      assert.equal((await askGrowthAdvisor({ data: researchData })).gigs.length, 1);
      assert.equal((await askGrowthAdvisor({ data: researchData })).gigs.length, 1);
      assert.equal(geminiCalls, 1);
      now += 61_000;
      assert.equal((await askGrowthAdvisor({ data: researchData })).gigs.length, 1);
      assert.equal(geminiCalls, 2);
      // Expire the cooldown before other tests run.
      now += 61_000;
    });
  } finally {
    keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; });
  }
});

test("advisor registers authentication before handling requests", () => {
  assert.deepEqual(registeredMiddleware, ["verified-session-middleware"]);
});

test('Anthropic citation text fragments preserve JSON and unknown optional claims do not discard sourced leads',async t=>{
 const keys=['ANTHROPIC_API_KEY','GEMINI_API_KEY','XAI_API_KEY'];const previous=keys.map(k=>process.env[k]);
 process.env.ANTHROPIC_API_KEY='fictional-test-key';delete process.env.GEMINI_API_KEY;delete process.env.XAI_API_KEY;
 try {
  const url='https://example.invalid/official-booking';
  const value=JSON.stringify({answer:'River Fold should review this official source before outreach.',gigs:[{name:'Fictional QA venue',sourceUrl:url,venueCapacity:'110',capacitySourceUrl:url,bookingRoute:null,bookingContactName:null,bookingContactSourceUrl:null,conf:null},{name:null,sourceUrl:url}],people:null,moves:null});
  const split=value.indexOf('review');
  t.mock.method(globalThis,'fetch',async()=>Response.json({content:[{type:'text',text:value.slice(0,split),citations:[{url}]},{type:'text',text:value.slice(split),citations:[{url}]}]}));
  const result=await askGrowthAdvisor({data:{...data,message:'Research official booking sources for River Fold'}});
  assert.match(result.source,/ANTHROPIC LIVE WEB SEARCH/);assert.equal(result.gigs.length,1);
  assert.equal(result.gigs[0].venueCapacity,110);assert.equal(result.gigs[0].bookingRoute,undefined);assert.equal(result.gigs[0].bookingContactName,undefined);
  assert.deepEqual(result.people,[]);assert.equal(result.gigs[0].date,'');assert.equal(result.gigs[0].fee,0);
 } finally {keys.forEach((key,i)=>previous[i]===undefined?delete process.env[key]:process.env[key]=previous[i]);}
});

test("advisor handles provider failures without fabricating verified leads", async (t) => {
  const previous = { xai: process.env.XAI_API_KEY, anthropic: process.env.ANTHROPIC_API_KEY, gemini: process.env.GEMINI_API_KEY, grounding: process.env.GEMINI_SEARCH_GROUNDING_ENABLED };
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;
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
    await t.test("Gemini uses configured grounding and provider-returned sources", async (subtest) => {
      process.env.GEMINI_API_KEY = "fictional-gemini-key";
      process.env.GEMINI_SEARCH_GROUNDING_ENABLED = "true";
      const researchData = { ...data, message: "Research venues for River Fold next week" };
      const mocked = subtest.mock.method(globalThis, "fetch", async (url, options) => {
        assert.match(String(url), /generativelanguage.googleapis.com/);
        const request = JSON.parse(options.body);
        assert.deepEqual(request.tools, [{ google_search: {} }]);
        assert.equal(request.contents.at(-1).parts[0].text, researchData.message);
        return Response.json({
          candidates: [{
            content: { parts: [{ text: JSON.stringify({ answer: "Fictional QA research example.", gigs: [{ name: "Fictional QA venue", sourceUrl: "https://example.invalid/source" }] }) }] },
            groundingMetadata: { groundingChunks: [{ web: { uri: "https://example.invalid/source" } }] },
          }],
        });
      });
      const result = await askGrowthAdvisor({ data: researchData });
      assert.equal(result.ok, true);
      assert.deepEqual(result.citations, ["https://example.invalid/source"]);
      assert.equal(result.gigs[0].status, "lead");
      assert.equal(result.gigs[0].date, "");
      assert.equal(result.gigs[0].fee, 0);
      assert.equal(mocked.mock.callCount(), 1);
      delete process.env.GEMINI_API_KEY;
    });
    await t.test("citation normalization accepts same page without tracking query", async (subtest) => {
      process.env.GEMINI_API_KEY = "fictional-gemini-key";
      process.env.GEMINI_SEARCH_GROUNDING_ENABLED = "true";
      const researchData = { ...data, message: "Research venues for River Fold" };
      subtest.mock.method(globalThis, "fetch", async () => Response.json({
        candidates: [{
          content: { parts: [{ text: JSON.stringify({
            answer: "Verified fictional source only.",
            gigs: [{ name: "Fictional room", sourceUrl: "https://example.invalid/venue/" }],
          }) }] },
          groundingMetadata: { groundingChunks: [{ web: { uri: "https://example.invalid/venue?utm_source=google" } }] },
        }],
      }));
      const result = await askGrowthAdvisor({ data: researchData });
      assert.equal(result.gigs.length, 1);
      assert.equal(result.gigs[0].status, "lead");
      delete process.env.GEMINI_API_KEY;
    });
    await t.test("citation matching refuses unrelated pages on the same site", async (subtest) => {
      process.env.GEMINI_API_KEY = "fictional-gemini-key";
      process.env.GEMINI_SEARCH_GROUNDING_ENABLED = "true";
      subtest.mock.method(globalThis, "fetch", async () => Response.json({
        candidates: [{
          content: { parts: [{ text: JSON.stringify({
            answer: "Research is preliminary.",
            gigs: [{ name: "Fictional room", sourceUrl: "https://example.invalid/venue" }],
          }) }] },
          groundingMetadata: { groundingChunks: [{ web: { uri: "https://example.invalid/unrelated" } }] },
        }],
      }));
      const result = await askGrowthAdvisor({ data: { ...data, message: "Research venues for River Fold" } });
      assert.equal(result.gigs.length, 0);
      delete process.env.GEMINI_API_KEY;
    });
    await t.test("Gemini HTTP failure returns offline guidance without retrying paid calls", async (subtest) => {
      process.env.GEMINI_API_KEY = "fictional-gemini-key";
      const mocked = subtest.mock.method(globalThis, "fetch", async () => new Response("", { status: 503 }));
      const result = await askGrowthAdvisor({ data });
      assert.match(result.source, /UNAVAILABLE/);
      assert.deepEqual(result.gigs, []);
      assert.equal(mocked.mock.callCount(), 2); // Gemini failure then configured xAI fallback.
      delete process.env.GEMINI_API_KEY;
    });
    await t.test("missing keys never call a provider", async (subtest) => {
      delete process.env.XAI_API_KEY;
      delete process.env.GEMINI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      const mocked = subtest.mock.method(globalThis, "fetch", () => { throw new Error("must not call"); });
      const result = await askGrowthAdvisor({ data });
      assert.match(result.source, /NOT CONFIGURED/);
      assert.equal(mocked.mock.callCount(), 0);
    });
  } finally {
    if (previous.gemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous.gemini;
    if (previous.grounding === undefined) delete process.env.GEMINI_SEARCH_GROUNDING_ENABLED;
    else process.env.GEMINI_SEARCH_GROUNDING_ENABLED = previous.grounding;
    if (previous.xai === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = previous.xai;
    if (previous.anthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previous.anthropic;
  }
});

test("Advisor fails over from an unavailable Anthropic provider to Gemini without inventing sources", async (t) => {
  const old = { anthropic: process.env.ANTHROPIC_API_KEY, gemini: process.env.GEMINI_API_KEY, xai: process.env.XAI_API_KEY, grounding: process.env.GEMINI_SEARCH_GROUNDING_ENABLED };
  process.env.ANTHROPIC_API_KEY = "fictional-anthropic-key";
  process.env.GEMINI_API_KEY = "fictional-gemini-key";
  process.env.GEMINI_SEARCH_GROUNDING_ENABLED = "false";
  delete process.env.XAI_API_KEY;
  try {
    const urls = [];
    t.mock.method(globalThis, "fetch", async (url) => {
      urls.push(String(url));
      if (urls.length === 1) return new Response("", { status: 503 });
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ answer: "Fallback provider is responding.", gigs: [{ name: "Unverified gig" }] }) }] } }] });
    });
    const result = await askGrowthAdvisor({ data });
    assert.equal(result.ok, true);
    assert.match(result.answer, /Fallback provider is responding/);
    assert.match(result.source, /NO SOURCES/);
    assert.deepEqual(result.gigs, []);
    assert.equal(urls.length, 2);
    assert.match(urls[0], /api.anthropic.com/);
    assert.match(urls[1], /generativelanguage.googleapis.com/);
  } finally {
    for (const [key, value] of Object.entries({ ANTHROPIC_API_KEY: old.anthropic, GEMINI_API_KEY: old.gemini, XAI_API_KEY: old.xai, GEMINI_SEARCH_GROUNDING_ENABLED: old.grounding })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
