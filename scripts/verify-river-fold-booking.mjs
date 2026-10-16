import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { chromium } from "playwright";

const origin = process.env.AUTH_SMOKE_ORIGIN ?? "http://127.0.0.1:8080";
assert.ok(["http://127.0.0.1:8080", "https://primal-directive-loose-ends-co.vercel.app"].includes(origin));
const suffix = randomUUID();
const password = randomBytes(32).toString("base64url");
const emailA = "river-fold-a-" + suffix + "@example.invalid";
const emailB = "river-fold-b-" + suffix + "@example.invalid";
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
page.setDefaultTimeout(25_000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

async function auth(path, payload) {
  const response = await context.request.post(origin + "/api/auth/" + path, {
    headers: { origin }, data: payload,
  });
  assert.equal(response.status(), 200, "Authentication endpoint failed: " + path);
}
async function ready(path) {
  await page.goto(origin + path, { waitUntil: "domcontentloaded" });
  await page.locator("main").waitFor();
  await page.waitForFunction(() =>
    !document.body.innerText.includes("Preparing your artist workspace") &&
    !document.body.innerText.includes("Loading your workspace"));
}
async function saved() {
  // The application debounces persistence for 650 ms. Verify recovery after
  // clearing its cache rather than treating the local success toast as a save.
  await page.waitForTimeout(1800);
}
async function recover(path) {
  await saved();
  await page.evaluate(() => localStorage.removeItem("musician-os-v1"));
  await ready(path);
}
async function submitDialog() {
  const button = page.locator("[role=dialog] button[type=submit]");
  // This dialog animates/rerenders while the profile saves. Dispatching the
  // click exercises the real submit handler without Playwright's stability
  // requirement racing the transition.
  await button.dispatchEvent("click");
  await page.locator("[role=dialog] form").waitFor({ state: "hidden" });
}
async function state() {
  return page.evaluate(() => JSON.parse(localStorage.getItem("musician-os-v1") ?? "null")?.state);
}

try {
  const googleResponse=await context.request.post(origin+"/api/auth/sign-in/social",{headers:{origin},data:{provider:"google",callbackURL:origin+"/",disableRedirect:true}});
  assert.equal(googleResponse.status(),200,"Configured Google authorization handoff failed");
  const googleUrl=new URL((await googleResponse.json()).url);
  assert.equal(googleUrl.hostname,"accounts.google.com");
  assert.equal(new URL(googleUrl.searchParams.get("redirect_uri")).origin,origin);
  console.log("Google OAuth authorization handoff passed; personal consent/callback completion is not automated.");
  await auth("sign-up/email", {name:"River Fold booking QA (fictional)",email:emailA,password});
  await ready("/");
  await page.locator("aside button").first().click();
  await page.getByLabel("Artist / band",{exact:true}).fill("River Fold (fictional QA)");
  await page.getByLabel("Home city",{exact:true}).fill("Albany, NY");
  await page.getByLabel("Genre",{exact:true}).fill("Indie folk / Americana");
  await page.getByLabel("Growth notes",{exact:true}).fill("FICTIONAL QA BAND. Self-reported draw 50–75, not independently verified. EPK fixture: https://example.invalid/river-fold-epk");
  await submitDialog();
  await recover("/");
  await page.getByRole("button",{name:"Deep research",exact:true}).click();
  await page.getByPlaceholder("Ask about growth, rooms, bills, routing…",{exact:true}).fill("Research Caffè Lena in Saratoga Springs as a prospective regional venue for fictional River Fold in Albany, NY. Use official caffelena.org booking and contact pages. Return one source-cited gig lead with venueCapacity, capacitySourceUrl, bookingRoute, bookingContactName and bookingContactSourceUrl only where supported. Explain capacity, geographic and genre fit and uncertainty about our unverified draw. No available date or agreed fee is known. Give a complete answer now.");
  const priorReplies=await page.locator('[data-advisor-message="ai"]').count();
  await page.getByRole("button",{name:"Send",exact:true}).click();
  await page.waitForFunction(n=>document.querySelectorAll('[data-advisor-message="ai"]').length>n,priorReplies,{timeout:210000});
  const reply=page.locator('[data-advisor-message="ai"]').last();
  const text=await reply.innerText();
  console.log("REAL_BOOKING_RESEARCH_ANSWER="+JSON.stringify(text));
  assert.match(text,/LIVE WEB SEARCH/,"Live sourced provider response required; offline output does not pass");
  assert.match(text,/Lena/i);
  await reply.getByRole("button",{name:"Add to pipeline",exact:true}).first().click();
  await page.getByLabel("Opportunity",{exact:true}).waitFor();
  assert.equal(await page.getByLabel("Date",{exact:true}).inputValue(),"");
  assert.equal(await page.getByLabel("Fee",{exact:true}).inputValue(),"0");
  await page.getByLabel("Next booking follow-up",{exact:true}).fill("2027-05-20");
  await page.getByRole("button",{name:"Prepare personalized pitch",exact:true}).click();
  assert.match(await page.getByLabel("Conversation and deal notes",{exact:true}).inputValue(),/River Fold/);
  await submitDialog();
  await recover("/gigs");
  const recovered=await state(),lead=recovered.gigs[0];
  assert.ok(['caffelena.org','www.caffelena.org'].includes(new URL(lead.researchSourceUrl).hostname));
  assert.equal(lead.status,"lead");assert.equal(lead.date,"");assert.equal(lead.fee,0);
  assert.equal(lead.venueCapacity,110,"Actual official-source capacity must persist");
  assert.match(lead.bookingContactName,/Hannah/i,"Official booking contact must be source-cited");
  assert.match(lead.bookingContactSourceUrl,/caffelena[.]org/);
  assert.ok(lead.bookingRoute,"A source-supported submission route is required");
  assert.equal(recovered.tasks.filter(t=>t.sourceKey==="booking:"+lead.id+":followup").length,1);
  console.log("RIVER_FOLD_SAVED_LEAD="+JSON.stringify(lead));
  await ready("/calendar");
  await page.getByRole("heading",{name:"Booking follow-ups",exact:true}).waitFor();
  await page.getByRole("button",{name:/Booking follow-up:/}).first().click();
  await page.getByLabel("Opportunity",{exact:true}).waitFor();
  await page.getByLabel("Next booking follow-up",{exact:true}).fill("2027-05-21");
  await submitDialog();
  await recover("/tasks");
  const tasks=(await state()).tasks.filter(t=>t.sourceKey==="booking:"+lead.id+":followup");
  assert.equal(tasks.length,1);assert.equal(tasks[0].dueDate,"2027-05-21");
  await ready("/calendar");
  await page.getByRole("button",{name:/Booking follow-up:/}).first().click();
  await page.getByLabel("Opportunity",{exact:true}).waitFor();
  await page.getByLabel("Status",{exact:true}).selectOption("hold");
  await page.getByLabel("Date",{exact:true}).fill("2027-06-12");
  await page.getByLabel("Notes",{exact:true}).fill("FICTIONAL QA ROUTING SCENARIO. No real venue hold, date availability or fee agreement exists.");
  await submitDialog();
  await recover("/tour");
  assert.match(await page.locator("main").innerText(),/Lena/i,"Held fictional scenario did not reach tour planning");
  await ready("/gigs");
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1),false);
  await page.screenshot({path:"/workspace/screenshots/river-fold-booking.png",fullPage:true});
  await auth("sign-out",{});
  await auth("sign-up/email",{name:"River Fold isolation QA",email:emailB,password});
  await ready("/");
  assert.equal((await state()).gigs.length,0);assert.equal((await state()).tasks.length,0);
  assert.deepEqual(errors,[]);
  console.log("REAL RIVER FOLD BOOKING JOURNEY PASSED: sourced provider response, official capacity/contact, unconfirmed lead, personalized draft, server recovery, one rescheduled reminder, calendar, mobile and account isolation. No external outreach sent.");
} catch(error) {
 console.error("REAL BOOKING JOURNEY FAILED:",error.message);
 console.error((await page.locator("body").innerText()).slice(-14000));
 await page.screenshot({path:"/workspace/screenshots/river-fold-booking-failure.png",fullPage:true}).catch(()=>{});
 throw error;
} finally {await browser.close();}
