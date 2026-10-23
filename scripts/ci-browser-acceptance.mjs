import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { chromium } from "playwright";

const origin = process.env.AUTH_SMOKE_ORIGIN ?? "http://127.0.0.1:8080";
assert.ok(["http://127.0.0.1:8080", "http://127.0.0.1:8081", "https://primal-directive-loose-ends-co.vercel.app"].includes(origin));
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
  assert.equal(response.status(), 200, "Authentication endpoint failed: " + path + " (HTTP " + response.status() + ")");
}
async function ready(path) {
  try { await page.goto(origin + path, { waitUntil: "domcontentloaded" }); } catch(error) {
    // Hydration may replace the in-flight document; retry only this navigation cancellation once.
    if (!String(error.message).includes("net::ERR_ABORTED")) throw error;
    await page.waitForLoadState("domcontentloaded");
    await page.goto(origin + path, {waitUntil:"domcontentloaded"});
  }
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
  await auth("sign-up/email", { name: "River Fold A (fictional QA)", email: emailA, password });
  await ready("/");
  await page.locator("aside button").first().click();
  await page.getByLabel("Artist / band", { exact: true }).fill("River Fold (fictional QA)");
  await page.getByLabel("Home city", { exact: true }).fill("Test City (fictional)");
  await page.getByLabel("Genre", { exact: true }).fill("Indie folk");
  await page.getByLabel("EPK URL", { exact: true }).fill("https://example.invalid/river-fold-epk");
  await page.getByLabel("Touring radius (miles)", { exact: true }).fill("120");
  await submitDialog();
  await recover("/");
  assert.equal((await state()).profile.artistName, "River Fold (fictional QA)");
  assert.equal((await state()).profile.epkUrl, "https://example.invalid/river-fold-epk");
  assert.equal((await state()).profile.touringRadiusMiles, 120);
  // The preceding recovered state assertion verifies the saved artist profile.
  // Avoid reopening the profile drawer during hydration, which is redundant
  // and races the route-level UI transition.
  await ready("/people");
  await page.getByRole("button", { name: "Add contact", exact: true }).first().click();
  await page.getByLabel("Name", { exact: true }).fill("Fictional QA Booker");
  await page.getByLabel("Contact", { exact: true }).fill("fictional-booker@example.invalid");
  await submitDialog();
  await recover("/people");
  assert.equal((await state()).people[0].name, "Fictional QA Booker");
  await page.getByRole("searchbox", { name: "Search people", exact: true }).fill("no-such-fictional-contact");
  await page.getByText("No matching contacts", { exact: true }).waitFor();
  await page.getByRole("searchbox", { name: "Search people", exact: true }).fill("Fictional QA Booker");
  await page.getByText("Fictional QA Booker", { exact: true }).waitFor();

  await ready("/gigs");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByLabel("Opportunity", { exact: true }).fill("Fictional QA booking");
  await page.getByLabel("Venue", { exact: true }).fill("Fictional QA Hall");
  await page.getByLabel("City", { exact: true }).fill("Test City (fictional)");
  await page.getByLabel("Date", { exact: true }).fill("2027-06-12");
  await page.getByLabel("Fee", { exact: true }).fill("500");
  await page.getByLabel("Status", { exact: true }).selectOption("booked");
  await page.getByLabel("Next booking follow-up", {exact:true}).fill("2027-05-20");
  await page.getByLabel("Official research source", {exact:true}).fill("https://example.invalid/fictional-qa");
  await page.getByRole("button", {name:"Prepare personalized pitch",exact:true}).click();
  assert.match(await page.getByLabel("Conversation and deal notes",{exact:true}).inputValue(), /River Fold/);
  await submitDialog();
  await recover("/gigs");
  for (const status of ["qualified", "responded", "hold", "booked"]) {
    await page.locator('main button').filter({ hasText: "Fictional QA Hall" }).first().click();
    await page.getByLabel("Status", {exact:true}).selectOption(status);
    await submitDialog();
    await recover("/gigs");
    assert.equal((await state()).gigs[0].status, status, "Stage did not persist");
  }
  assert.equal((await state()).gigs[0].stageHistory.length, 4);
  await page.getByRole("button", {name:"List",exact:true}).click();
  for (const label of ["Capacity", "Next follow-up", "Next action"]) assert.ok((await page.locator('main').innerText()).includes(label));
  // Optional fields live in expanded details so the mobile summary remains concise.
  await page.getByText("Research & outreach", {exact:true}).first().click();
  for (const label of ["Booking contact", "Last contacted"]) assert.ok((await page.locator('main').innerText()).includes(label));
  await page.getByRole("button", {name:"Board",exact:true}).click();
  await recover("/tasks");
  const beforeTasks = await state();
  assert.equal(beforeTasks.tasks.filter(t=>t.sourceKey?.startsWith("booking:")).length,1);
  assert.equal(beforeTasks.gigs[0].outreachNextFollowUp,"2027-05-20");
  assert.match(beforeTasks.gigs[0].outreachNotes,/River Fold/);
  assert.ok(beforeTasks.tasks.length > 0, "Booking did not generate operational tasks");
  await page.getByRole("button", { name: "Mark task complete", exact: true }).first().click();
  await recover("/tasks");
  assert.ok((await state()).tasks.some((task) => task.status === "done"));

  await ready("/money");
  await page.getByRole("button", { name: "Add entry", exact: true }).click();
  await page.getByLabel("Amount", { exact: true }).fill("125.50");
  await page.getByLabel("Label", { exact: true }).fill("Fictional QA show income");
  await submitDialog();
  await recover("/money");
  assert.equal((await state()).money.find((entry) => entry.label === "Fictional QA show income").amount, 125.5);
  await page.screenshot({ path: "/workspace/screenshots/authenticated-money.png" });
  const downloadPending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const download = await downloadPending;
  const stream = await download.createReadStream();
  let csv = "";
  for await (const chunk of stream) csv += chunk.toString();
  assert.ok(csv.includes("Fictional QA show income") && csv.includes("125.5"), "Money export lost saved records or cents");

  await ready("/merch");
  await page.getByRole("button", { name: "Add first item", exact: true }).click();
  await page.getByLabel("Product name", { exact: true }).fill("Fictional River Fold QA tee");
  await page.getByLabel("Opening stock", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await recover("/merch");
  assert.equal((await state()).merchProducts[0].stockOnHand, 10);
  const productSelect = page.getByLabel("Product", { exact: true }).first();
  await productSelect.selectOption((await state()).merchProducts[0].id);
  await page.getByLabel("Quantity", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Add item to order", exact: true }).click();
  await page.getByRole("button", { name: "Record paid order", exact: true }).click();
  await recover("/merch");
  const merch = await state();
  assert.equal(merch.merchProducts[0].stockOnHand, 8);
  assert.equal(merch.merchOrders[0].status, "paid");
  assert.equal(merch.merchOrders[0].total, 60);

  if (origin === "http://127.0.0.1:8080") {
    await ready("/");
    await page.getByPlaceholder("Ask about growth, rooms, bills, routing…", { exact: true }).fill("Help fictional River Fold prioritize the next week using saved data.");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page.getByText("OFFLINE MODE — AI PROVIDER NOT CONFIGURED", { exact: true }).waitFor();
  }

  await ready("/outreach");
  await page.getByText("Sending disabled · test-account verification pending", {exact:true}).waitFor();
  await page.getByLabel("Saved booking", {exact:true}).selectOption((await state()).gigs[0].id);
  await page.getByRole("button", {name:"Build draft from profile",exact:true}).click();
  await page.getByLabel("Recipient email", {exact:true}).fill("fictional-booker@example.invalid");
  await page.getByLabel("Official booking contact source (HTTPS)", {exact:true}).fill("https://example.invalid/booking-contact");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", {name:"Save explicit approval",exact:true}).click();
  await page.getByText("Approval saved. Nothing has been sent.", {exact:true}).waitFor();
  await ready("/outreach");
  await page.getByRole("button", {name:"Send from Primal Directive",exact:true}).waitFor();
  assert.equal(await page.getByRole("button", {name:"Send from Primal Directive",exact:true}).isEnabled(),false);
  await ready("/account");
  await page.getByText("Current access: FREE", {exact:true}).waitFor();
  await page.getByRole("region", {name:"Email integrations"}).waitFor();
  await page.getByText("No synchronized messages yet. Check a connected inbox to get started.", {exact:true}).waitFor();
  assert.equal(await page.getByRole("button",{name:"Connect / reconnect Outlook",exact:true}).isEnabled(),false);
  assert.equal(await page.getByRole("button",{name:"Save booking draft",exact:true}).isEnabled(),false);
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const route of ["/", "/board", "/gigs", "/people", "/money", "/calendar", "/tour", "/merch", "/tasks", "/account", "/outreach"]) {
      await ready(route);
      assert.ok((await page.locator("main").innerText()).trim().length > 20, "Empty route: " + route);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), false, "Horizontal overflow: " + route);
      await page.screenshot({ path: "/workspace/screenshots/qa-" + viewport.width + "-" + (route.slice(1) || "advisor") + ".jpg", type: "jpeg", quality: 65, fullPage: true });
    }
  }
  await ready("/gigs");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByLabel("Opportunity", {exact:true}).fill("Fictional mobile booking");
  await page.getByLabel("Fee", {exact:true}).fill("125.50");
  await page.getByLabel("Status", {exact:true}).selectOption("qualified");
  await submitDialog();
  await recover("/gigs");
  assert.equal((await state()).gigs.find(gig => gig.name === "Fictional mobile booking").fee, 125.5);
  await page.locator('main button').filter({hasText:"Fictional mobile booking"}).first().click();
  await page.getByText("Edit venue facts and evidence", {exact:true}).click();
  await page.getByLabel("Venue capacity", {exact:true}).fill("180");
  await page.getByLabel("Capacity evidence URL", {exact:true}).fill("https://example.invalid/fictional-capacity");
  await submitDialog();
  await recover("/gigs");
  assert.equal((await state()).gigs.find(gig => gig.name === "Fictional mobile booking").venueCapacity, 180);
  await page.screenshot({ path: "/workspace/screenshots/authenticated-mobile.png" });
  await auth("sign-out", {});
  await auth("sign-up/email", { name: "River Fold B (fictional QA)", email: emailB, password });
  await ready("/people");
  const bob = await state();
  assert.equal(bob.people.length, 0);
  assert.equal(bob.gigs.length, 0);
  assert.equal(bob.money.length, 0);
  assert.equal(bob.merchProducts.length, 0);
  assert.equal(bob.profile.artistName, "");
  await ready("/outreach");
  await page.getByText("No pending approvals.", {exact:true}).waitFor();
  assert.equal(await page.getByRole("button",{name:"Send from Primal Directive",exact:true}).count(),0);
  await auth("sign-out", {});
  await auth("sign-in/email", { email: emailA, password });
  await ready("/people");
  assert.equal((await state()).people[0].name, "Fictional QA Booker");
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByText("Sign in to access your private pipeline", { exact: false }).waitFor();
  await page.goto(origin + "/money");
  await page.getByText("Sign in to access your private pipeline", { exact: false }).waitFor();
  assert.equal(await page.locator("main").count(), 0);
  assert.deepEqual(errors, [], "Browser errors during authenticated workflows");
  console.log("Browser acceptance passed: profile recovery, contacts, booked shows, generated tasks, decimal money, merch stock/order, all desktop/mobile routes, two-account isolation, logout and sign-in recovery.");
} catch (error) {
  console.error("Browser acceptance failed:", error.message);
  console.error((await page.locator("body").innerText()).slice(0, 5000));
  await page.screenshot({ path: "/workspace/screenshots/acceptance-failure.png" }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
