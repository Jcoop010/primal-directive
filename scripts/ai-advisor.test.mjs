import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { boundedHistory, createAdvisorTransport, retryAfterMs } from "../src/lib/ai-transport.ts";

// Isolate the actual handler from TanStack's HTTP compiler and auth database.
// The production middleware remains required; no provider credentials are used.
const framework = `export function createServerFn() { let schema; return {
 middleware(m) { if (!m.length) throw Error('Missing auth'); return this; },
 validator(v) { schema=v; return this; }, handler(fn) { return data => fn({data:schema(data),context:{userId:"test-user"}}); }
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

test("long conversation history has a fixed budget and retains recent turns", () => {
  const history = Array.from({length:8},(_,i)=>({role:"ai",text:`Turn ${i}: `+"x".repeat(20000)}));
  const messages = boundedHistory(history);
  assert.ok(messages.reduce((sum,item)=>sum+item.content.length,0)<=3000);
  assert.match(messages.at(-1).content,/Turn 7/);
});

test("Gemini-only Advisor handles valid output, offline mode and rate limits", async () => {
  const saved = { fetch: globalThis.fetch, gemini: process.env.GEMINI_API_KEY, xai: process.env.XAI_API_KEY, groq: process.env.GROQ_API_KEY };
  let calls = 0;
  try {
    delete process.env.XAI_API_KEY;
    process.env.GROQ_API_KEY = "test-only";
    process.env.GEMINI_API_KEY = "test-only";
    const geminiGood = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ answer: "Valid strategy", gigs: [], people: [], moves: [] }) }] } }] }));
    let outgoing;
    globalThis.fetch = async (url, init) => { calls++; assert.match(String(url), /generativelanguage.googleapis.com/); outgoing = JSON.parse(init.body); assert.equal(outgoing.tools, undefined); return geminiGood(); };
    const workspace = {gigs:[],money:[{id:'collected',type:'collected',amount:12.34}],merchProducts:[],tasks:[]};
    assert.equal((await askGrowthAdvisor({...input,workspace})).answer, "Valid strategy");
    assert.equal(calls,1);
    assert.match(JSON.stringify(outgoing),/APP-CALCULATED WORKSPACE BRIEF/);
    assert.ok(outgoing.contents[0].parts[0].text.includes('"collected":1234'));
    const research = await askGrowthAdvisor({...input,message:"Find current venue booking contacts"});
    assert.match(research.answer, /LIVE RESEARCH NOT VERIFIED/);
    assert.deepEqual(research.citations,[]);
    delete process.env.GEMINI_API_KEY;
    calls = 0;
    assert.match((await askGrowthAdvisor(input)).source, /OFFLINE/);
    assert.equal(calls, 0);
    process.env.GEMINI_API_KEY = "test-only";
    calls = 0;
    globalThis.fetch = async url => { calls++; assert.match(String(url), /generativelanguage.googleapis.com/); return new Response(null, {status:429, headers: {"Retry-After":"120"}}); };
    assert.match((await askGrowthAdvisor(input)).source, /HTTP 429/);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = saved.fetch;
    for (const [key,value] of [["GEMINI_API_KEY",saved.gemini],["XAI_API_KEY",saved.xai],["GROQ_API_KEY",saved.groq]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
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
  assert.equal((await createAdvisorTransport(options)("gemini","https://example.com",{})).status,429);
  assert.equal((await createAdvisorTransport(options)("gemini","https://example.com",{})).status,429);
  assert.equal(calls,1); time=60001;
  const request=createAdvisorTransport(options);
  assert.equal((await request("gemini","https://example.com",{})).status,200);
  await assert.rejects(request("gemini","https://example.com",{}),/budget/);
});

test("Transport aborts a stalled body as well as a stalled request", async () => {
  const request=createAdvisorTransport({timeoutMs:10,cooldowns:new Map(),fetchImpl:async(_,init)=>{
    return new Response(new ReadableStream({start(controller){init.signal.addEventListener('abort',()=>controller.error(init.signal.reason));}}));
  }});
  const keepAlive=setTimeout(()=>{},100);
  try {await assert.rejects(request("gemini","https://example.com",{}),/timeout/i);} finally {clearTimeout(keepAlive);}
});

test("Concurrent identical requests deduplicate only within the same authenticated account", async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let calls = 0;
  const options = {deduplicationScope:"account-a", cooldowns:new Map(), fetchImpl:async () => {calls++; await gate; return good();}};
  const a = createAdvisorTransport(options)("gemini","https://example.com",{body:"same"});
  const b = createAdvisorTransport(options)("gemini","https://example.com",{body:"same"});
  const c = createAdvisorTransport({...options,deduplicationScope:"account-b"})("gemini","https://example.com",{body:"same"});
  await new Promise(resolve => setTimeout(resolve, 25));
  release();
  await Promise.all([a,b,c]);
  assert.equal(calls,2);
});
