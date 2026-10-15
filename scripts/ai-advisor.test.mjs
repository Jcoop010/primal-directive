import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { boundedHistory, createAdvisorTransport, retryAfterMs } from "../src/lib/ai-transport.ts";
import { emptyPlanning, saveGoal, saveMemory } from '../src/lib/artist-planning.ts';

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
test('clock queries do not call Gemini; unavailable general questions do not become artist advice',async()=>{
 const original=globalThis.fetch;const key=process.env.GEMINI_API_KEY;let calls=0;
 try {
  delete process.env.GEMINI_API_KEY;
  globalThis.fetch=async()=>{calls++;throw Error('Unexpected request');};
  const clock=await askGrowthAdvisor({...input,message:'What time is it?'});
  assert.equal(clock.source,'SERVER CLOCK — UTC');assert.match(clock.answer,/UTC/);
  const general=await askGrowthAdvisor({...input,message:'Explain how a compiler works'});
  assert.match(general.source,/GENERAL ASSISTANT/);assert.deepEqual(general.moves,[]);assert.doesNotMatch(general.answer,/venue|booking|pipeline/);
  assert.equal(calls,0);
 } finally {globalThis.fetch=original;if(key===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=key;}
});

test("Gemini plain-text responses remain useful without extra quota requests", async () => {
  const saved = { fetch: globalThis.fetch, key: process.env.GEMINI_API_KEY, grounding: process.env.GEMINI_SEARCH_GROUNDING_ENABLED };
  let calls = 0;
  try {
    process.env.GEMINI_API_KEY = "test-only";
    process.env.GEMINI_SEARCH_GROUNDING_ENABLED = "true";
    globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Focus on collecting email signups at your next show." }] } }] })); };
    const general = await askGrowthAdvisor({...input, message: "How can my band grow?"});
    assert.equal(general.answer, "Focus on collecting email signups at your next show.");
    assert.match(general.source, /GEMINI AI/);
    assert.deepEqual(general.citations, []);
    assert.equal(calls, 1);
    const research = await askGrowthAdvisor({...input, message: "Find current venue booking contacts"});
    assert.match(research.answer, /LIVE RESEARCH NOT VERIFIED/);
    assert.deepEqual(research.citations, []);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = saved.fetch;
    if (saved.key === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = saved.key;
    if (saved.grounding === undefined) delete process.env.GEMINI_SEARCH_GROUNDING_ENABLED; else process.env.GEMINI_SEARCH_GROUNDING_ENABLED = saved.grounding;
  }
});


test("Transient Gemini 503 recovers on one retry without changing models", async () => {
  const saved = {fetch:globalThis.fetch,key:process.env.GEMINI_API_KEY};
  const urls=[];
  try {
    process.env.GEMINI_API_KEY="test-only";
    globalThis.fetch=async url => {
      urls.push(String(url));
      if (urls.length===1) return new Response(null,{status:503});
      return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({answer:"Recovered after temporary outage",gigs:[],people:[],moves:[]})}]}}]}));
    };
    const result=await askGrowthAdvisor({...input,message:"How can I improve my band promotion strategy?"});
    assert.equal(result.answer,"Recovered after temporary outage");
    assert.equal(urls.length,2);
    assert.equal(urls[0],urls[1]);
  } finally {
    globalThis.fetch=saved.fetch;
    if(saved.key===undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY=saved.key;
  }
});

test("Gemini-only Advisor handles valid output, offline mode and rate limits", async () => {
  const saved = { grounding: process.env.GEMINI_SEARCH_GROUNDING_ENABLED, fetch: globalThis.fetch, gemini: process.env.GEMINI_API_KEY, xai: process.env.XAI_API_KEY, groq: process.env.GROQ_API_KEY };
  let calls = 0;
  try {
    delete process.env.XAI_API_KEY;
    process.env.GROQ_API_KEY = "test-only";
    process.env.GEMINI_API_KEY = "test-only";
    const geminiGood = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ answer: "Valid strategy", gigs: [], people: [], moves: [] }) }] } }] }));
    let outgoing;
    globalThis.fetch = async (url, init) => { calls++; assert.match(String(url), /models\/gemini-3\.1-flash-lite:generateContent/); outgoing = JSON.parse(init.body); assert.equal(outgoing.tools, undefined); return geminiGood(); };
    const workspace = {gigs:[],money:[{id:'collected',type:'collected',amount:12.34}],merchProducts:[],tasks:[]};
    const planning=saveMemory(saveGoal(emptyPlanning(),{title:'Capture 12 email signups',metric:'manual',target:12,reported:3,deadline:'2026-12-01',nextAction:'Review signup invitation'},workspace,'goal'),'No weekday travel','note');
    assert.equal((await askGrowthAdvisor({...input,workspace,planning})).answer, "Valid strategy");
    assert.equal(calls,1);
    assert.match(JSON.stringify(outgoing),/APP-CALCULATED WORKSPACE BRIEF/);
    assert.ok(outgoing.contents[0].parts[0].text.includes('"collected":1234'));
    assert.match(outgoing.contents[0].parts[0].text,/Capture 12 email signups/);
    assert.match(outgoing.contents[0].parts[0].text,/No weekday travel/);
    assert.match(outgoing.contents[0].parts[0].text,/User-reported/);
    process.env.GEMINI_SEARCH_GROUNDING_ENABLED = "true";
    let researchModel = ""; globalThis.fetch = async (url, init) => { researchModel=String(url); assert.deepEqual(JSON.parse(init.body).tools,[{google_search:{}}]); return geminiGood(); };
    const research = await askGrowthAdvisor({...input,message:"Find current venue booking contacts"});
    assert.match(researchModel,/models\/gemini-2\.5-flash-lite:generateContent/);
    const urls=[];
    globalThis.fetch=async (url)=>{ urls.push(String(url)); return urls.length===1 ? new Response(null,{status:404}) : urls.length===2 ? new Response(JSON.stringify({models:[{name:"models/gemini-3.8-flash",supportedGenerationMethods:["generateContent"]}]})) : geminiGood(); };
    await askGrowthAdvisor({...input,message:"Find current venue booking contacts"});
    assert.equal(urls.length,3);
    assert.ok(urls[1].includes("/models?pageSize="));
    assert.ok(urls[2].includes("gemini-3.8-flash:generateContent"));
    delete process.env.GEMINI_SEARCH_GROUNDING_ENABLED;
    assert.match(research.answer, /LIVE RESEARCH NOT VERIFIED/);
    assert.deepEqual(research.citations,[]);
    assert.deepEqual(research.moves,[]);
    assert.doesNotMatch(research.answer,/Valid strategy/);
    calls=0;
    globalThis.fetch=async()=>{calls++;throw Error("Disabled grounding must not call Gemini");};
    const disabledResearch=await askGrowthAdvisor({...input,message:"Find current venue booking contacts"});
    assert.match(disabledResearch.answer,/LIVE RESEARCH UNAVAILABLE/);
    assert.deepEqual(disabledResearch.citations,[]);
    assert.equal(calls,0);
    calls=0;
    globalThis.fetch=async()=>{calls++;return new Response(null,{status:503});};
    const planningFailure=await askGrowthAdvisor({...input,message:'Explain my saved weekly plan',workspace,planning});
    assert.match(planningFailure.source,/HTTP 503/);
    assert.match(planningFailure.answer,/No weekday travel/);
    assert.match(planningFailure.answer,/Capture 12 email signups/);
    assert.match(planningFailure.answer,/without an AI answer/);
    assert.equal(calls,2);
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
    if(saved.grounding === undefined) delete process.env.GEMINI_SEARCH_GROUNDING_ENABLED; else process.env.GEMINI_SEARCH_GROUNDING_ENABLED = saved.grounding;
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

