import {chromium} from "playwright";
import assert from "node:assert/strict";
import {mkdir, writeFile} from "node:fs/promises";
import {randomUUID} from "node:crypto";
const base="https://primal-directive-loose-ends-co.vercel.app";
const source="GEMINI AI — CURRENT FACTS NOT VERIFIED";
const results=[];
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();
const errors=[];
let advisorEndpoint;
page.on("request",request=>{
 if(request.method()==="POST" && request.url().includes("/_serverFn/") && request.postData()?.includes('"history"')) advisorEndpoint=request.url();
});
page.on("pageerror",()=>errors.push("uncaught_browser_error"));
const email="primal-qa-"+randomUUID()+"@example.invalid";
const password=randomUUID()+"aA1!";
console.log("::add-mask::"+email);
console.log("::add-mask::"+password);
await mkdir("qa-evidence",{recursive:true});
try {
 await page.goto(base,{waitUntil:"networkidle"});
 await page.getByRole("button",{name:"Create account",exact:true}).click();
 await page.getByPlaceholder("Artist / band name").fill("Primal release QA");
 await page.getByPlaceholder("Email",{exact:true}).fill(email);
 await page.getByPlaceholder("Password (8+ characters)").fill(password);
 await page.locator("form").getByRole("button",{name:"Create account",exact:true}).click();
 await page.getByRole("heading",{name:"Command Center",exact:true}).waitFor({timeout:30000});
 await page.getByPlaceholder("Ask about growth, rooms, bills, routing…").waitFor();
 const session=await context.request.get(base+"/api/auth/get-session");
 const identity=await session.json();
 assert.ok(identity.user?.id);
 results.push({test:"Real production email authentication",passed:true});
 await page.getByRole("button",{name:/Artist profile/}).filter({visible:true}).first().click();
 const dialog=page.getByRole("dialog");
 await dialog.getByLabel("Artist / band",{exact:true}).fill("Copper Lantern QA");
 await dialog.getByLabel("Home city").fill("Albany, NY");
 await dialog.getByLabel("Genre",{exact:true}).fill("indie rock");
 await dialog.getByLabel("Typical draw").fill("35");
 await dialog.getByLabel("Growth notes").fill("Synthetic QA workspace. Weekly goal: capture 12 permission-based email signups.");
 await dialog.getByRole("button",{name:"Save profile",exact:true}).click();
 await page.waitForTimeout(1500);
 async function ask(test,message,{research=false,contextAware=false,moves=false}={}) {
  for(let attempt=0;attempt<2;attempt++){
   const before=await page.locator("div.whitespace-pre-wrap").count();
   await page.getByPlaceholder("Ask about growth, rooms, bills, routing…").fill(message);
   await page.getByRole("button",{name:"Send",exact:true}).click();
   await page.waitForFunction(n=>document.querySelectorAll("div.whitespace-pre-wrap").length>=n,before+2,{timeout:70000});
   const answer=await page.locator("div.whitespace-pre-wrap").last().innerText();
   if(research){
    assert.match(answer,/LIVE RESEARCH NOT VERIFIED/);
    assert.match(answer,/LIVE RESEARCH UNAVAILABLE — GROUNDING OFF/);
    assert.equal(await page.locator('div.whitespace-pre-wrap').last().getByRole('button',{name:'Review task',exact:true}).count(),0);
    results.push({test,passed:true,source:'LIVE RESEARCH UNAVAILABLE — GROUNDING OFF',providerRequest:false});
    console.log(JSON.stringify({test,passed:true,providerRequest:false}));return;
   }
   if(attempt===0 && /HTTP (502|503|504)|network error or timeout|connection failed or timed out/i.test(answer) && !/HTTP 429/.test(answer)){
    results.push({test:"Transient provider/network failure explicitly labelled; one delayed verification retry",passed:true});
    console.log(JSON.stringify({test,transientNetworkFailure:true}));
    await page.waitForTimeout(10000);
    continue;
   }
   assert.ok(answer.length>80);
   assert.ok(answer.includes(source),"Expected genuine Gemini provenance");
   assert.doesNotMatch(answer,/LOCAL WORKSPACE FALLBACK|OFFLINE MODE|ADVISOR UNAVAILABLE/);
   if(research) assert.match(answer,/LIVE RESEARCH NOT VERIFIED/);
   if(contextAware) assert.match(answer,/Copper Lantern|Albany|12|35/i);
   if(moves) assert.ok(await page.locator("div.whitespace-pre-wrap").last().locator("li").count()>0);
   results.push({test,passed:true,source,excerpt:answer.slice(0,180)});
   console.log(JSON.stringify({test,passed:true,source}));
   return;
  }
 }
 await ask("General career advice","Give a practical two-week career plan for this independent act.");
 await ask("Booking strategy","Suggest a booking strategy using only our saved profile and workspace records.");
 await ask("Venue research limitation","Find current venue availability and booking contacts in Albany. Be clear about what you can verify.",{research:true});
 await ask("Marketing and fan growth","Recommend a measurable fan-growth and marketing experiment using our saved weekly goal.",{contextAware:true});
 await ask("Workspace context awareness","What are our saved act name, home city, typical draw, and weekly signup goal?",{contextAware:true});
 await ask("Structured suggested actions","Give exactly three actionable priorities with a first step and completion signal.",{moves:true});
 await ask("Consecutive follow-up","Which of those three should we do first, and why?");
 await ask("Consecutive clarification","Turn that first action into a short checklist.");
 // The app intentionally debounces writes; verify persistence after the final server acknowledgement.
 await page.waitForResponse(response=>{
  const request=response.request();
  const body=request.postData()??"";
  return request.method()==="POST" && request.url().includes("/_serverFn/") && !body.includes('"history"') && body.includes("Turn that first action into a short checklist.") && response.status()===200;
 },{timeout:20000});
 await page.reload({waitUntil:"networkidle"});
 await page.getByText(source,{exact:true}).first().waitFor({timeout:30000});
 assert.equal(await page.getByText(source,{exact:true}).count(),7);
 results.push({test:"Profile and conversation persist after refresh",passed:true});
 await page.locator("div.whitespace-pre-wrap").last().scrollIntoViewIfNeeded();
 await page.screenshot({path:"qa-evidence/production-desktop.png"});
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
 await page.locator("input[placeholder^='Ask about growth']").scrollIntoViewIfNeeded();
 await page.screenshot({path:"qa-evidence/production-mobile.png"});
 results.push({test:"Mobile layout without horizontal overflow",passed:true});
 assert.ok(advisorEndpoint,"Advisor request endpoint was observed");
 await page.route(advisorEndpoint,route=>route.fulfill({status:503,body:"Temporarily unavailable"}));
 await page.getByPlaceholder("Ask about growth, rooms, bills, routing…").fill("Network recovery check");
 await page.getByRole("button",{name:"Send",exact:true}).click();
 await page.waitForFunction(()=>Array.from(document.querySelectorAll("div.whitespace-pre-wrap")).at(-1)?.textContent?.includes("The live connector dropped. Check the board and pipeline, then try the advisor again."),null,{timeout:70000});
 await page.unroute(advisorEndpoint);
 await ask("Recovery after simulated network failure","Give one short measurable next step.");
 await page.setViewportSize({width:1440,height:1000});
 await page.getByRole("button",{name:"Sign out",exact:true}).click();
 await page.getByRole("heading",{name:"Your command center.",exact:true}).waitFor({timeout:30000});
 const loggedOut=await (await context.request.get(base+"/api/auth/get-session")).json();
 assert.equal(loggedOut,null);
 assert.deepEqual(errors,[]);
 results.push({test:"Logout invalidates session and no uncaught browser errors",passed:true});
 await writeFile("qa-evidence/results.json",JSON.stringify({base,tests:results},null,2));
 console.log(JSON.stringify({production:base,passed:results.length,tests:results.map(r=>r.test)}));
} catch(error) {
 console.log(JSON.stringify({completedTests:results.map(r=>r.test),lastSyntheticAnswer:(await page.locator("div.whitespace-pre-wrap").last().innerText().catch(()=>"")).slice(0,250)}));
 await writeFile("qa-evidence/results.json",JSON.stringify({base,tests:results,failed:true,errorType:error?.name??"Error"},null,2));
 // The page uses only this newly created synthetic QA account.
 await page.screenshot({path:"qa-evidence/production-failure.png"}).catch(()=>{});
 throw error;
} finally {await browser.close();}
