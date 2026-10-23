import assert from "node:assert/strict";
import test from "node:test";
import { isPublicSourceAddress, publicSourceUrl, fetchSourcePage } from "../src/lib/source-fetch.server.ts";

test("source verification rejects private, mapped, link-local, reserved and metadata addresses", () => {
  for (const ip of ["127.0.0.1","10.0.0.1","172.16.0.1","192.168.1.1","169.254.169.254","100.64.0.1","0.0.0.0","224.0.0.1","198.18.0.1","::1","::ffff:127.0.0.1","fe80::1","fc00::1","2002:7f00:1::","2001:db8::1"]) assert.equal(isPublicSourceAddress(ip), false, ip);
  for (const ip of ["1.1.1.1","8.8.8.8","2606:4700:4700::1111","2001:4860:4860::8888"]) assert.equal(isPublicSourceAddress(ip),true,ip);
});
test("source URLs reject credentials, non-HTTPS, IP encodings, nonstandard ports and local hostnames", () => {
  for (const url of ["http://venue.com","https://user:password@venue.com","https://127.1","https://2130706433","https://[::1]","https://venue.com:8080/","https://localhost/","https://metadata.internal/","https://not-a-host/"]) assert.equal(publicSourceUrl(url),null,url);
  assert.equal(publicSourceUrl("https://a-real-venue.org/booking").pathname,"/booking");
});

test("mixed private/public DNS fails closed before any HTTP request", async () => {
  let requests=0;
  const result=await fetchSourcePage("https://a-real-venue.org/about",{proxyConfigured:false,lookup:async()=>[{address:"1.1.1.1",family:4},{address:"127.0.0.1",family:4}],fetch:async()=>{requests++;throw Error("must not request");}});
  assert.equal(result,null);assert.equal(requests,0);
});
test("source reading bounds bytes, rejects redirects/HTTP errors and preserves exact page identity",async()=>{
  const url="https://a-real-venue.org/booking";
  let resolutions=0;
  const deps={proxyConfigured:false,lookup:async()=>{resolutions++;return [{address:"1.1.1.1",family:4}];},fetch:async (requested,options)=>{
    assert.equal(String(requested),url);assert.equal(options.redirect,"error");assert.ok(options.dispatcher);assert.ok(options.signal);
    return new Response("<h1>Fictional Venue</h1>",{headers:{"content-type":"text/html"}});
  }};
  assert.deepEqual(await fetchSourcePage(url,deps),{url,html:"<h1>Fictional Venue</h1>"});
  assert.equal(resolutions,1,"DNS answers are resolved once then pinned to the HTTP connection");
  assert.equal(await fetchSourcePage(url,{...deps,fetch:async()=>new Response("",{status:302,headers:{location:"http://127.0.0.1"}})}),null);
  assert.equal(await fetchSourcePage(url,{...deps,fetch:async()=>new Response("x".repeat(1000001),{headers:{"content-type":"text/html"}})}),null);
  assert.equal(await fetchSourcePage(url,{...deps,fetch:async()=>{throw Error("timeout");}}),null);
  assert.equal(await fetchSourcePage(url,{...deps,proxyConfigured:true,fetch:async()=>{throw Error("managed proxy must not be bypassed");}}),null);
});
