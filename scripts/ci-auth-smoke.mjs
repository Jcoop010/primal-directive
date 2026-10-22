#!/usr/bin/env node
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const origin = process.env.AUTH_SMOKE_ORIGIN ?? "http://127.0.0.1:8080";
assert.ok(
  ["http://127.0.0.1:8080", "https://primal-directive-loose-ends-co.vercel.app"].includes(origin),
  "Auth smoke target must be the local test server or the existing production app",
);
const base = origin + "/api/auth";
if (origin.startsWith("https://")) {
  const response = await fetch(base + "/get-session");
  assert.equal(response.status, 200);
  assert.equal(await response.json(), null);
  console.log(
    "Production authentication endpoint verified anonymously. No production QA accounts created; real provider login requires user consent.",
  );
} else {
  const suffix = randomBytes(12).toString("hex");
  const password = "Ci-" + randomBytes(24).toString("base64url") + "!";

  // Only the ephemeral CI database is used. Never log passwords or session tokens.
  async function request(path, { payload, token, status = 200 } = {}) {
    const response = await fetch(base + "/" + path, {
      method: payload === undefined ? "GET" : "POST",
      headers: {
        "content-type": "application/json",
        origin,
        ...(token ? { authorization: "Bearer " + token } : {}),
      },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    });
    assert.equal(response.status, status, path + " returned unexpected HTTP status");
    return response.json();
  }

  const aliceEmail = "river-fold-a-" + suffix + "@example.invalid";
  const bobEmail = "river-fold-b-" + suffix + "@example.invalid";
  const alice = await request("sign-up/email", {
    payload: { name: "River Fold A (fictional CI account)", email: aliceEmail, password },
  });
  const bob = await request("sign-up/email", {
    payload: { name: "River Fold B (fictional CI account)", email: bobEmail, password },
  });
  assert.equal(alice.user.email, aliceEmail);
  assert.equal(bob.user.email, bobEmail);
  assert.notEqual(alice.user.id, bob.user.id);

  const signedIn = await request("sign-in/email", { payload: { email: aliceEmail, password } });
  assert.equal(signedIn.user.id, alice.user.id);
  assert.equal(typeof signedIn.token, "string");
  const recovered = await request("get-session", { token: signedIn.token });
  assert.equal(recovered.user.id, alice.user.id);
  const bobSession = await request("get-session", { token: bob.token });
  assert.equal(bobSession.user.id, bob.user.id);
  assert.equal(await request("get-session"), null);
  await request("sign-in/email", {
    payload: { email: aliceEmail, password: password + "-incorrect" },
    status: 401,
  });
  await request("sign-out", { payload: {}, token: signedIn.token });
  assert.equal(await request("get-session", { token: signedIn.token }), null);
  assert.equal((await request("get-session", { token: bob.token })).user.id, bob.user.id);
  const restored = await request("sign-in/email", { payload: { email: aliceEmail, password } });
  assert.equal((await request("get-session", { token: restored.token })).user.id, alice.user.id);
  await request("sign-out", { payload: {}, token: restored.token });
  await request("sign-out", { payload: {}, token: bob.token });
  console.log(
    "Auth integration passed: separate accounts, sign-in, session recovery, invalid password, anonymous access, logout/revocation, and sign-in recovery.",
  );
}
