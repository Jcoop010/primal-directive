import assert from "node:assert/strict";
import test from "node:test";
import { boundedHistory, createAdvisorTransport, readProviderBody, retryAfterMs } from "./ai-transport.ts";

test("transport preserves successful Gemini JSON", async () => {
 const body = {candidates:[{content:{parts:[{text:'{"answer":"OK"}'}]}}]};
 const request = createAdvisorTransport({fetchImpl:async () => new Response(JSON.stringify(body))});
 assert.deepEqual(await readProviderBody(await request("gemini","https://example.test",{})),body);
});
test("HTTP 400 is exposed without an automatic second request", async () => {
 let calls = 0;
 const request = createAdvisorTransport({fetchImpl:async () => {calls++; return new Response(null,{status:400});}});
 assert.equal((await request("gemini","https://example.test",{})).status,400);
 await assert.rejects(() => request("gemini","https://example.test",{}),/budget exhausted/);
 assert.equal(calls,1);
});
test("transport permits only one attempt per turn", async () => {
 const request=createAdvisorTransport({fetchImpl:async()=>new Response(null,{status:503})});
 await request("gemini","https://example.test",{});
 await assert.rejects(()=>request("gemini","https://example.test",{}),/budget exhausted/);
});
test("provider body parser safely handles malformed JSON",async()=>{
 assert.deepEqual(await readProviderBody(new Response("not json")),{});
});
test("retry-after honors minimum minute and capped day",()=>{
 assert.equal(retryAfterMs("2"),60000);
 assert.equal(retryAfterMs("120"),120000);
 assert.equal(retryAfterMs("999999"),86400000);
});
test("bounded history preserves recent conversation without unbounded prompts",()=>{
 const history=Array.from({length:20},(_,i)=>({role:i%2?"ai" as const:"user" as const,text:"x".repeat(2000)}));
 const result=boundedHistory(history);
 assert.ok(result.length<=8);
 assert.ok(result.reduce((n,x)=>n+x.content.length,0)<=3000);
});
