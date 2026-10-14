#!/usr/bin/env node
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const base = "http://127.0.0.1:8080/api/auth";
const origin = "http://127.0.0.1:8080";
const password = `Ci-${randomBytes(24).toString("base64url")}!`;
const unique = `${Date.now()}-${randomBytes(6).toString("hex")}`;

async function post(path, payload) {
  const response = await fetch(`${base}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  assert.equal(response.status, 200, `auth ${path} returned HTTP ${response.status}`);
  return { body, headers: response.headers };
}

function sessionCookie(headers) {
  const cookies = headers.getSetCookie?.() ?? [];
  const session = cookies
    .map((value) => value.split(";")[0])
    .find((value) => value.startsWith("__Host-grok-auth.session_token="));
  assert.ok(session, "sign-in must set a session cookie");
  return session;
}

async function currentSession(cookie) {
  const response = await fetch(`${base}/get-session`, {
    headers: cookie ? { cookie, origin } : { origin },
  });
  assert.equal(response.status, 200, `get-session returned HTTP ${response.status}`);
  return response.json();
}

const accounts = [];
for (const index of [1, 2]) {
  const email = `ci-${unique}-${index}@example.com`;
  const created = await post("sign-up/email", {
    name: `CI Auth User ${index}`, email, password,
  });
  assert.equal(created.body?.user?.email, email, "sign-up must return the new user");
  const signedIn = await post("sign-in/email", { email, password });
  assert.equal(signedIn.body?.user?.email, email, "sign-in must return the right user");
  accounts.push({ email, id: signedIn.body.user.id, cookie: sessionCookie(signedIn.headers) });
}

const anonymous = await currentSession(null);
assert.equal(anonymous?.user ?? null, null, "anonymous requests must not inherit an authenticated session");

for (const account of accounts) {
  const session = await currentSession(account.cookie);
  assert.equal(session?.user?.id, account.id, "session must retain the correct account ID");
  assert.equal(session?.user?.email, account.email, "session must retain the correct account email");
  assert.notEqual(session?.user?.id, accounts.find((other) => other !== account)?.id,
    "one account's cookie must not authenticate as another account");
}

console.log("Auth integration passed: two sign-ups, two sign-ins, independent sessions, anonymous isolation.");
