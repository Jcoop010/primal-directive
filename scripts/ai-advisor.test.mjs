import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { createAdvisorTransport, retryAfterMs } from "../src/lib/ai-transport.ts";

// Isolate the actual handler from TanStack's HTTP compiler and auth database.
// The production middleware remains required; no provider credentials are used.
const framework = `export function createServerFn() { let schema; return {
 middleware(m) { if (!m.length) throw Error('Missing auth'); return this; },
 validator(v) { schema=v; return this; }, handler(fn) { return data => fn({data:schema(data)}); }
}; }`;
const require = createRequire(import.meta.url);
let source = ts.transpileModule(readFileSync(new URL("../src/lib/ai.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
source = source.replace('"@tanstack/react-start"', JSON.stringify(`data:text/javascript,${encodeURIComponent(framework)}`))
  .replace('"@/lib/auth/middleware"', JSON.stringify('data:text/javascript,export const authMiddleware = {};'))
  .replace('"zod"', JSON.stringify(pathToFileURL(require.resolve("zod")).href))
  .replace(/"@\/lib\/([^"]+)"/g, (_, name) => JSON.stringify(new URL(`../src/lib/${name}.ts`, import.meta.url).href));
assert.match(source, /\.middleware\(\[authMiddleware\]\)/);
const { askGrowthAdvisor } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const input = { message: "Explain margin", history: [], context: "Artist: Test" };
const good = () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ answer: "Valid strategy", gigs: [], people: [], moves: [] }) } }] }));

test("Advisor success, invalid bodies, repair, timeout, missing key and rate limits", async () => {
  const saved = { fetch: globalThis.fetch, xai: process.env.XAI_API_KEY, groq: process.env.GROQ_API_KEY };
  let calls = 0;
  try {
    delete process.env.XAI_API_KEY; process.env.GROQ_API_KEY = "test-only";
    globalThis.fetch = async () => { calls++; return good(); };
    assert.equal((await askGrowthAdvisor(input)).answer, "Valid strategy");
    for (const invalid of ["not JSON", "null", JSON.stringify({choices: [{message:{content:123}}]}), JSON.stringify({choices:[{message:{content:'{"answer":" "}'}}]})]) {
      calls=0; globalThis.fetch=async () => { calls++; return calls===1 ? new Response(invalid) : good(); };
      assert.equal((await askGrowthAdvisor(input)).answer, "Valid strategy"); assert.equal(calls,2);
    }
    calls=0; globalThis.fetch=async () => { calls++; return new Response('invalid'); };
    assert.match((await askGrowthAdvisor(input)).source,/INVALID AI RESPONSE/); assert.equal(calls,2);
    calls=0; globalThis.fetch=async () => { calls++; throw new DOMException("timeout", "TimeoutError"); };
    assert.match((await askGrowthAdvisor(input)).source,/FALLBACK/); assert.equal(calls,1);
    delete process.env.GROQ_API_KEY; calls=0;
    assert.match((await askGrowthAdvisor(input)).source,/OFFLINE/); assert.equal(calls,0);
    process.env.XAI_API_KEY="test-only"; process.env.GROQ_API_KEY="test-only"; calls=0;
    globalThis.fetch=async url => {calls++; return url.includes("x.ai") ? new Response(null,{status:429}) : good();};
    assert.equal((await askGrowthAdvisor(input)).answer,"Valid strategy"); assert.equal(calls,2);
    delete process.env.XAI_API_KEY; calls=0;
    globalThis.fetch=async () => {calls++; return new Response(null,{status:429,headers:{"Retry-After":"120"}});};
    assert.match((await askGrowthAdvisor(input)).source,/HTTP 429/); assert.equal(calls,1);
    assert.match((await askGrowthAdvisor(input)).source,/HTTP 429/); assert.equal(calls,1);
  } finally {
    globalThis.fetch=saved.fetch;
    for (const [key,value] of [["XAI_API_KEY",saved.xai],["GROQ_API_KEY",saved.groq]]) {
      if(value===undefined) delete process.env[key]; else process.env[key]=value;
    }
  }
});

test("Transport respects Retry-After, recovers after cooldown and caps attempts", async () => {
  assert.equal(retryAfterMs("120"),120000);
  assert.equal(retryAfterMs(null),60000);
  assert.equal(retryAfterMs(new Date(180000).toUTCString(),0),180000);
  let time=0, calls=0;
  const blocked=new Map();
  const options={now:()=>time,cooldowns:blocked,fetchImpl:async()=>{calls++;return calls===1?new Response(null,{status:429}):good();}};
  assert.equal((await createAdvisorTransport(options)("groq","https://example.com",{})).status,429);
  assert.equal((await createAdvisorTransport(options)("groq","https://example.com",{})).status,429);
  assert.equal(calls,1); time=60001;
  const request=createAdvisorTransport(options);
  assert.equal((await request("groq","https://example.com",{})).status,200);
  await request("groq","https://example.com",{});
  await assert.rejects(request("groq","https://example.com",{}),/budget/);
});

test("Transport aborts a stalled body as well as a stalled request", async () => {
  const request=createAdvisorTransport({timeoutMs:10,cooldowns:new Map(),fetchImpl:async(_,init)=>{
    return new Response(new ReadableStream({start(controller){init.signal.addEventListener('abort',()=>controller.error(init.signal.reason));}}));
  }});
  const keepAlive=setTimeout(()=>{},100);
  try {await assert.rejects(request("groq","https://example.com",{}),/timeout/i);} finally {clearTimeout(keepAlive);}
});
