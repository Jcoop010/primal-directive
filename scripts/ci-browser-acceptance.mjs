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
  await button.scrollIntoViewIfNeeded();
  await button.click();
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
  await submitDialog();
  await recover("/");
  assert.equal((await state()).profile.artistName, "River Fold (fictional QA)");
  await page.locator("aside button").first().click();
  assert.equal(await page.getByLabel("Artist / band", { exact: true }).inputValue(), "River Fold (fictional QA)");
  await submitDialog();

  await ready("/people");
  await page.getByRole("button", { name: "Add contact", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Fictional QA Booker");
  await page.getByLabel("Contact", { exact: true }).fill("fictional-booker@example.invalid");
  await submitDialog();
  await recover("/people");
  assert.equal((await state()).people[0].name, "Fictional QA Booker");

  await ready("/gigs");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByLabel("Opportunity", { exact: true }).fill("Fictional QA booking");
  await page.getByLabel("Venue", { exact: true }).fill("Fictional QA Hall");
  await page.getByLabel("City", { exact: true }).fill("Test City (fictional)");
  await page.getByLabel("Date", { exact: true }).fill("2027-06-12");
  await page.getByLabel("Fee", { exact: true }).fill("500");
  await page.getByLabel("Status", { exact: true }).selectOption("booked");
  await submitDialog();
  await recover("/tasks");
  const beforeTasks = await state();
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

  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const route of ["/", "/board", "/gigs", "/people", "/money", "/calendar", "/tour", "/merch", "/tasks"]) {
      await ready(route);
      assert.ok((await page.locator("main").innerText()).trim().length > 20, "Empty route: " + route);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), false, "Horizontal overflow: " + route);
    }
  }
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
