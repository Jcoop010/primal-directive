import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
const origin=process.env.AUTH_SMOKE_ORIGIN ?? "http://127.0.0.1:8081";
assert.ok(["http://127.0.0.1:8081","https://primal-directive-loose-ends-co.vercel.app"].includes(origin));
const email="venue-qa-"+randomUUID()+"@example.invalid",password=randomBytes(32).toString("base64url");
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();
const errors=[];page.on("pageerror",e=>errors.push(e.message));
page.setDefaultTimeout(30000);
async function auth(path,data){const r=await context.request.post(origin+"/api/auth/"+path,{headers:{origin},data});assert.equal(r.status(),200,path);}
async function ready(){await page.goto(origin+"/gigs",{waitUntil:"domcontentloaded"});await page.locator("main").waitFor();await page.getByText("Loading your workspace",{exact:true}).waitFor({state:"hidden"});}
async function state(){return page.evaluate(()=>JSON.parse(localStorage.getItem("musician-os-v1")||"null")?.state);}
try {
 await auth("sign-up/email",{name:"Venue research QA (fictional)",email,password});await ready();
 for(const [venue,city] of [["Thunderbird Cafe","Pittsburgh, PA"],["Johnny Brenda's","Philadelphia, PA"]]){
  await page.getByRole("button",{name:"Add",exact:true}).click();
  await page.getByLabel("Opportunity",{exact:true}).fill(venue+" research QA");await page.getByLabel("Venue",{exact:true}).fill(venue);await page.getByLabel("City",{exact:true}).fill(city);
  await page.locator('[role=dialog] button[type=submit]').dispatchEvent("click");await page.locator('[role=dialog] form').waitFor({state:"hidden"});
 }
 await page.waitForFunction(()=>{const s=JSON.parse(localStorage.getItem("musician-os-v1")||"null")?.state;return s?.gigs.length===2 && s.gigs.every(g=>g.venueCapacity && g.capacitySourceUrl && g.bookingContactName && g.bookingContactSourceUrl && g.bookingRoute);},{},{timeout:150000});
 await page.getByRole("button",{name:"Retry research",exact:true}).first().click();
 await page.getByRole("button",{name:"Researching venue…",exact:true}).waitFor({state:"hidden",timeout:30000});
 const before=await state();assert.equal(before.gigs.find(g=>g.venue==="Thunderbird Cafe").venueCapacity,520);assert.equal(before.gigs.find(g=>g.venue==="Johnny Brenda's").venueCapacity,250);assert.ok(before.gigs.every(g=>g.status==="lead" && !g.date && g.fee===0));
 await page.waitForTimeout(2000);await page.evaluate(()=>localStorage.removeItem("musician-os-v1"));await ready();
 const restored=await state();assert.equal(restored.gigs.length,2);assert.ok(restored.gigs.every(g=>g.venueResearchStatus==="Verified"));
 await page.getByText("View source evidence",{exact:true}).first().click();assert.ok(await page.locator('a[href="https://johnnybrendas.com/menu-2-2/"]').count()>0);
 mkdirSync("/workspace/screenshots",{recursive:true});await page.screenshot({path:"/workspace/screenshots/venue-research-desktop.png",fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth));await page.screenshot({path:"/workspace/screenshots/venue-research-mobile.png",fullPage:true});
 await auth("sign-out",{});await auth("sign-in/email",{email,password});await ready();assert.equal((await state()).gigs.filter(g=>g.venueCapacity).length,2);
 assert.deepEqual(errors,[]);console.log("LIVE venue acceptance passed: both real venues enriched automatically, exact capacities, official booking contacts/routes, citations, no bookings fabricated, DB recovery after cache clearing, sign-out/sign-in recovery, 390px mobile and desktop rendering with no runtime errors. Google account completion is not covered.");
} catch(e){mkdirSync("/workspace/screenshots",{recursive:true});await page.screenshot({path:"/workspace/screenshots/venue-research-failure.png",fullPage:true}).catch(()=>{});throw e;} finally {await browser.close();}
