import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { boundedHistory, createAdvisorTransport, retryAfterMs } from "../src/lib/ai-transport.ts";
import { emptyPlanning, saveMemory } from '../src/lib/artist-planning.ts';

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

const input={message:"Analyze my saved workspace",history:[],context:"Artist: Test"};
const payload=(answer,extra={})=>new Response(JSON.stringify({content:[{type:"text",text:JSON.stringify({answer,gigs:[],people:[],moves:[],...extra})}]}));
test("Claude handler enforces bounded inputs, one paid request, evidence gating, and honest recovery", async()=>{
 const original=globalThis.fetch, saved=process.env.ANTHROPIC_API_KEY, flag=process.env.ANTHROPIC_WEB_SEARCH_ENABLED;
 let calls=0,outgoing;
 try {
  delete process.env.ANTHROPIC_API_KEY;
  globalThis.fetch=async()=>{throw Error("Offline must not call a provider");};
  assert.match((await askGrowthAdvisor(input)).source,/OFFLINE/);
  process.env.ANTHROPIC_API_KEY="test-only";delete process.env.ANTHROPIC_WEB_SEARCH_ENABLED;
  assert.match((await askGrowthAdvisor({...input,message:"Find current booking contacts"})).source,/UNAVAILABLE/);
  globalThis.fetch=async(url,init)=>{calls++;assert.equal(url,"https://api.anthropic.com/v1/messages");outgoing=JSON.parse(init.body);return payload("Useful strategy");};
  assert.equal((await askGrowthAdvisor(input)).answer,"Useful strategy");
  assert.equal(calls,1);assert.equal(outgoing.max_tokens,768);assert.equal(outgoing.tools,undefined);assert.match(outgoing.system,/100–150/);
  await askGrowthAdvisor({...input,mode:"detailed"});assert.equal(outgoing.max_tokens,1536);
  assert.throws(()=>askGrowthAdvisor({...input,message:"x".repeat(2001)}));
  const planning=saveMemory(emptyPlanning(),"Remember CEDAR-48","m1","2026-10-15T12:00:00Z");
  const workspace={gigs:[],money:[{id:"r",type:"collected",amount:125},{id:"c",type:"cost",amount:25}],merchProducts:[],tasks:[]};
  await askGrowthAdvisor({...input,planning,workspace});assert.match(outgoing.system,/CEDAR-48/);assert.match(outgoing.system,/100\.00/);
  process.env.ANTHROPIC_WEB_SEARCH_ENABLED="true";
  globalThis.fetch=async()=>{calls++;return payload("Invented current fact",{gigs:[{name:"Unproven",reason:"No evidence"}]});};
  const unsupported=await askGrowthAdvisor({...input,mode:"research"});assert.match(unsupported.source,/UNAVAILABLE/);assert.deepEqual(unsupported.gigs,[]);
  globalThis.fetch=async(url,init)=>{calls++;outgoing=JSON.parse(init.body);return new Response(JSON.stringify({content:[{type:"text",text:JSON.stringify({answer:"Read this official source and verify the specific booking process.",gigs:[{name:"Supported lead",sourceUrl:"https://example.org/booking",reason:"Venue source",date:"2027-04-01",fee:1000,status:"booked",conf:1},{name:"Unproven",reason:"Not cited"}]}),citations:[{type:"web_search_result_location",url:"https://example.org/booking"}]}]}));};
  const sourced=await askGrowthAdvisor({...input,mode:"research"});
  assert.deepEqual(sourced.citations,["https://example.org/booking"]);assert.equal(outgoing.tools[0].max_uses,1);
  assert.equal(sourced.gigs.length,1);assert.equal(sourced.gigs[0].status,"lead");assert.equal(sourced.gigs[0].date,"");assert.equal(sourced.gigs[0].fee,0);assert.equal(sourced.gigs[0].conf,0);
  globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({content:[{type:"text",text:'{"answer":"broken"'}]}));};
  assert.match((await askGrowthAdvisor(input)).source,/OFFLINE/);
  let failureCalls=0;globalThis.fetch=async()=>{failureCalls++;return new Response(null,{status:503});};
  assert.match((await askGrowthAdvisor(input)).source,/OFFLINE/);assert.equal(failureCalls,1);
  globalThis.fetch=async()=>{failureCalls++;return new Response(null,{status:429,headers:{"retry-after":"60"}});};
  await askGrowthAdvisor(input);await askGrowthAdvisor(input);assert.equal(failureCalls,2,"429 cooldown prevents another paid request");
 } finally {globalThis.fetch=original;for(const [k,v]of[["ANTHROPIC_API_KEY",saved],["ANTHROPIC_WEB_SEARCH_ENABLED",flag]])if(v===undefined)delete process.env[k];else process.env[k]=v;}
});
test("transport deadline, per-account deduplication, and fixed conversation budget",async()=>{
 const history=boundedHistory(Array.from({length:10},(_,i)=>({role:"ai",text:"Turn "+i+" "+ "x".repeat(20000)})));
 assert.ok(history.reduce((s,m)=>s+m.content.length,0)<=3000);
 let calls=0,release;const gate=new Promise(r=>release=r);
 const options={fetchImpl:async()=>{calls++;await gate;return new Response("ok");},deduplicationScope:"one",cooldowns:new Map()};
 const a=createAdvisorTransport(options)("anthropic","https://example.com",{body:"same"}),b=createAdvisorTransport(options)("anthropic","https://example.com",{body:"same"}),c=createAdvisorTransport({...options,deduplicationScope:"two"})("anthropic","https://example.com",{body:"same"});
 await new Promise(r=>setTimeout(r,30));assert.equal(calls,2);release();await Promise.all([a,b,c]);
 const req=createAdvisorTransport({fetchImpl:async()=>new Response("ok"),cooldowns:new Map()});await req("anthropic","https://example.com",{});await assert.rejects(req("anthropic","https://example.com",{}),/budget/);
 assert.equal(retryAfterMs("2",0),60000);
});
