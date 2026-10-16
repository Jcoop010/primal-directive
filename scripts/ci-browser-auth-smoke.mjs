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
    const signupResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/api/auth/sign-up/email"), { timeout: 20_000 });
    await page.getByRole("button", { name: "Create account" }).last().click();
    const signupResponse = await signupResponsePromise;
    const setCookie = await signupResponse.headerValue("set-cookie");
    const safeCookieInfo = setCookie
      ? setCookie.replace(/^[^=]+=[^;]*/, (part) => part.split("=")[0] + "=[REDACTED]")
      : "no set-cookie header";
    await page.getByRole("heading", { name: "Command Center" }).waitFor({ timeout: 20_000 });
    const browserCookies = (await context.cookies(base)).map(({ name, secure, sameSite }) => ({ name, secure, sameSite }));
    assert.ok(browserCookies.some((cookie) => cookie.name.endsWith("session_token")),
      `browser rejected session cookie after signup: ${JSON.stringify(browserCookies)}; HTTP ${signupResponse.status()}; ${safeCookieInfo}`);
    const beforeReload = await context.request.get(`${base}/api/auth/get-session`);
    const beforeSession = await beforeReload.json().catch(() => null);
    assert.equal(beforeSession?.user?.email, email, "session must be authenticated immediately after sign-up");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Command Center" }).waitFor({ timeout: 20_000 });
    const gigsResponse = await page.goto(`${base}/gigs`, { waitUntil: "domcontentloaded" });
    assert.equal(gigsResponse?.status(), 200);
    await page.getByRole("heading", { name: "Gigs", exact: true }).waitFor({ timeout: 8_000 }).catch(async () => {
      const pageText = (await page.locator("body").innerText()).slice(0, 450);
      const sessionResponse = await context.request.get(`${base}/api/auth/get-session`);
      const session = await sessionResponse.json().catch(() => null);
      throw new Error(`protected Gigs route did not render; url=${page.url()} sessionUser=${session?.user?.email ?? "none"} body=${JSON.stringify(pageText)}`);
    });
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
