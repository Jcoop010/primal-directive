#!/usr/bin/env node
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { chromium } from "playwright";

const base = "http://127.0.0.1:8080";
const unique = randomBytes(7).toString("hex");
const password = `Ci-${randomBytes(18).toString("base64url")}!`;
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });

async function createAccount(index) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const email = `ci-browser-${unique}-${index}@example.com`;
  try {
    const response = await page.goto(base, { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200);
    await page.getByRole("heading", { name: "Your command center." }).waitFor({ timeout: 20_000 });
    await page.getByRole("button", { name: "Create account" }).first().click();
    await page.getByPlaceholder("Artist / band name").fill(`Browser Artist ${index}`);
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password (8+ characters)").fill(password);
    await page.getByRole("button", { name: "Create account" }).last().click();
    await page.getByRole("heading", { name: "Command Center" }).waitFor({ timeout: 20_000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Command Center" }).waitFor({ timeout: 20_000 });
    const gigsResponse = await page.goto(`${base}/gigs`, { waitUntil: "domcontentloaded" });
    assert.equal(gigsResponse?.status(), 200);
    await page.getByRole("heading", { name: "Gigs", exact: true }).waitFor({ timeout: 20_000 });
    return { context, page, email };
  } catch (error) {
    await context.close();
    throw new Error(`account ${index}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

try {
  const first = await createAccount(1);
  const second = await createAccount(2);
  try {
    const getSession = async (ctx) => {
      const response = await ctx.request.get(`${base}/api/auth/get-session`);
      assert.equal(response.status(), 200);
      return response.json();
    };
    const a = await getSession(first.context);
    const b = await getSession(second.context);
    assert.equal(a?.user?.email, first.email);
    assert.equal(b?.user?.email, second.email);
    assert.notEqual(a.user.id, b.user.id);
    await first.page.reload({ waitUntil: "domcontentloaded" });
    await first.page.getByRole("heading", { name: "Gigs", exact: true }).waitFor({ timeout: 20_000 });
    console.log("Browser auth smoke passed: two accounts, independent cookies, navigation, refresh.");
  } finally {
    await first.context.close();
    await second.context.close();
  }
} finally {
  await browser.close();
}
