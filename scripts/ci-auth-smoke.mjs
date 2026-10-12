#!/usr/bin/env node

const base = "http://127.0.0.1:8080/api/auth";
const email = `ci-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
const password = "CI-Only-Test-Password-123!";

async function post(path, payload) {
  const response = await fetch(`${base}/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://127.0.0.1:8080",
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    console.error(`Auth integration failed at ${path}: HTTP ${response.status}`, body);
    process.exit(1);
  }
  return body;
}

const created = await post("sign-up/email", {
  name: "CI Auth Test",
  email,
  password,
});
if (created?.user?.email !== email) {
  console.error("Sign-up endpoint did not return the newly created test user.", created);
  process.exit(1);
}

const signedIn = await post("sign-in/email", { email, password });
if (signedIn?.user?.email !== email) {
  console.error("Sign-in endpoint did not return the authenticated test user.", signedIn);
  process.exit(1);
}

console.log("Auth integration passed: sign-up and sign-in both succeeded.");
