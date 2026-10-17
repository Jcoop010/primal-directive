import assert from "node:assert/strict";
const origin = process.env.AUTH_SMOKE_ORIGIN ?? "http://127.0.0.1:8080";
assert.ok(["http://127.0.0.1:8080", "https://primal-directive-loose-ends-co.vercel.app"].includes(origin));
const r = await fetch(origin + "/api/auth/sign-in/social", {method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify({provider:"google",callbackURL:"/",errorCallbackURL:"/"})});
assert.equal(r.status,200);
const body = await r.json();
const auth = new URL(body.url);
assert.equal(auth.hostname,"accounts.google.com");
assert.equal(new URL(auth.searchParams.get("redirect_uri")).origin,origin);
const cookie = r.headers.getSetCookie().find(c=>c.startsWith("__Host-primal-directive.oauth_state="));
assert.ok(cookie,"Host-only OAuth state cookie must be set");
assert.match(cookie,/; Secure/i);assert.match(cookie,/; HttpOnly/i);assert.match(cookie,/; SameSite=Lax/i);assert.match(cookie,/; Path=\//i);assert.doesNotMatch(cookie,/; Domain=/i);
// Fake code intentionally cannot authenticate. A correct state reaches code exchange;
// this verifies persistence/signature validation without a Google account or real code.
const cb = await fetch(origin+"/api/auth/callback/google?code=primal-qa-invalid-code&state="+encodeURIComponent(auth.searchParams.get("state")),{headers:{cookie:cookie.split(";")[0]},redirect:"manual"});
assert.equal(cb.status,302);assert.match(cb.headers.get("location"),/error=invalid_code/);
console.log("OAuth state persistence passed: host-only Secure/HttpOnly/Lax cookie, canonical callback, signed-state validation and code-exchange boundary. Real Google login remains a separate acceptance gate.");
