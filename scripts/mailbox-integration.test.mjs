import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { setTokenUtil } from "better-auth/oauth2";
const compile = (s) =>
  "data:text/javascript;base64," +
  Buffer.from(
    ts.transpile(s, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }),
  ).toString("base64");
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const policyUrl = compile(read("src/lib/mailbox-policy.ts"));
const policy = await import(policyUrl);
const oauthModule = read("src/lib/auth/microsoft.server.ts").replace(
  'from "better-auth/oauth2"',
  `from "${pathToFileURL(createRequire(import.meta.url).resolve("better-auth/oauth2")).href}"`,
);
const { microsoftOAuthOptions, MICROSOFT_LINKING_POLICY } = await import(compile(oauthModule));

const transportUrl = compile(read("src/lib/outreach-message.ts"));
const { deliverOutlook } = await import(transportUrl);
test("mailbox grants preserve previous permissions and separate login, read, send, drafts", () => {
  assert.deepEqual(
    policy.mailboxConsentScopes("google", [policy.MAIL_SCOPES.google.read], "send"),
    [policy.MAIL_SCOPES.google.read, policy.MAIL_SCOPES.google.send],
  );
  assert.equal(policy.hasMailScope("microsoft", ["openid", "User.Read"], "read"), false);
  assert.equal(
    policy.hasMailScope("microsoft", ["https://graph.microsoft.com/Mail.ReadWrite"], "read"),
    true,
  );
  assert.equal(policy.hasMailScope("microsoft", ["Mail.ReadWrite"], "send"), false);
  assert.deepEqual(policy.parseMailScopes("Mail.Read, Mail.Send offline_access"), [
    "Mail.Read",
    "Mail.Send",
    "offline_access",
  ]);
  assert.match(policy.mailboxError(401), /revoked/);
  assert.match(policy.mailboxError(403), /organization/);
  assert.match(policy.mailboxError(429), /Wait/);
  assert.throws(() => policy.graphHeaders({ value: "bad" }));
  const headers = policy.graphHeaders({
    value: [
      {
        id: "m",
        conversationId: "t",
        subject: "booking",
        from: { emailAddress: { address: "venue@example.invalid" } },
        internetMessageHeaders: [{ name: "In-Reply-To", value: "<r>" }],
      },
    ],
  });
  assert.equal(headers[0].replyTo, "<r>");
  assert.equal(headers[0].threadId, "t");
});
test("Graph one-shot submission never invents delivery confirmation or retries", async () => {
  for (const status of [202, 401, 403, 429, 500]) {
    let calls = 0;
    const result = await deliverOutlook(
      "fixture",
      { recipient: "venue@example.invalid", subject: "Approved fixture", body: "Fictional QA" },
      async (url, init) => {
        calls++;
        assert.equal(url, "https://graph.microsoft.com/v1.0/me/sendMail");
        assert.equal(JSON.parse(init.body).message.toRecipients.length, 1);
        return new Response(null, { status });
      },
    );
    assert.equal(calls, 1);
    assert.equal(result.status, status === 202 || status === 500 ? "unknown" : "failed");
  }
  const result = await deliverOutlook(
    "fixture",
    { recipient: "venue@example.invalid", subject: "Fixture", body: "Fixture" },
    async () => {
      throw new Error("ambiguous timeout");
    },
  );
  assert.equal(result.status, "unknown");
});
test("Better Auth encrypts and rotates expired Google/Microsoft tokens; HTTP cannot choose another user", async () => {
  for (const provider of ["google", "microsoft"]) {
    const database = {};
    let calls = 0,
      revoked = false;
    const instance = betterAuth({
      baseURL: "http://localhost:8080",
      secret: "fixture-secret-at-least-thirty-two-characters",
      database: memoryAdapter(database),
      account: {
        encryptOAuthTokens: true,
        accountLinking: { enabled: true, disableImplicitLinking: true },
      },
      socialProviders: {
        [provider]: {
          clientId: "fixture-client",
          clientSecret: "fixture-secret",
          refreshAccessToken: async (token) => {
            calls++;
            assert.equal(token, "refresh-fixture");
            if (revoked) throw new Error("invalid_grant");
            return {
              accessToken: "renewed-fixture",
              refreshToken: "rotated-fixture",
              accessTokenExpiresAt: new Date(Date.now() + 3600000),
            };
          },
        },
      },
      logger: { disabled: true },
    });
    const ctx = await instance.$context;
    const user = await ctx.internalAdapter.createUser({
      name: "A",
      email: "a@example.invalid",
      emailVerified: true,
    });
    const foreign = await ctx.internalAdapter.createUser({
      name: "B",
      email: "b@example.invalid",
      emailVerified: true,
    });
    const account = await ctx.internalAdapter.linkAccount({
      userId: user.id,
      providerId: provider,
      accountId: "provider-a",
      accessToken: await setTokenUtil("expired-fixture", ctx),
      refreshToken: await setTokenUtil("refresh-fixture", ctx),
      accessTokenExpiresAt: new Date(0),
      scope: "Mail.Read Mail.Send",
    });
    const token = await instance.api.getAccessToken({
      body: { userId: user.id, providerId: provider },
    });
    assert.equal(token.accessToken, "renewed-fixture");
    assert.equal(calls, 1);
    const stored = (await ctx.internalAdapter.findAccounts(user.id))[0];
    assert.notEqual(stored.accessToken, "renewed-fixture");
    assert.notEqual(stored.refreshToken, "rotated-fixture");
    await assert.rejects(() =>
      instance.api.getAccessToken({
        body: { userId: user.id, providerId: provider },
        headers: new Headers(),
      }),
    );
    await assert.rejects(() =>
      instance.api.getAccessToken({ body: { userId: foreign.id, providerId: provider } }),
    );
    revoked = true;
    await ctx.internalAdapter.updateAccount(account.id, {
      refreshToken: await setTokenUtil("refresh-fixture", ctx),
      accessTokenExpiresAt: new Date(0),
    });
    await assert.rejects(() =>
      instance.api.getAccessToken({ body: { userId: user.id, providerId: provider } }),
    );
  }
});
test("mailbox services persist sync/drafts, enforce account ownership, and disconnect without deleting login", async () => {
  const db = new PGlite();
  const previousFetch = globalThis.fetch;
  const sqlFor = (client) => ({
    query: async (q, p = []) => (await client.query(q, p)).rows,
    transaction: (work) => db.transaction((tx) => work(sqlFor(tx))),
  });
  globalThis.__mailSql = sqlFor(db);
  const providerSource = read("src/lib/mailbox-provider.server.ts")
    .replace('import { auth } from "./auth/server";', "const auth=globalThis.__mailAuth;")
    .replace(
      'import { getRequest } from "@tanstack/react-start/server";',
      'const getRequest=()=>new Request("http://localhost:8080");',
    )
    .replace('import { getSql } from "./db";', "const getSql=async()=>globalThis.__mailSql;")
    .replace('from "./mailbox-policy"', `from "${policyUrl}"`);
  let refreshFails = false;
  globalThis.__mailAuth = {
    api: {
      getAccessToken: async ({ body }) => {
        assert.ok(["pa", "pb"].includes(body.accountId));
        if (refreshFails) throw new Error("SECRET-TOKEN");
        return { accessToken: "fixture" };
      },
    },
  };
  const providerUrl = compile(providerSource);
  const provider = await import(providerUrl);
  const require = createRequire(import.meta.url),
    zod = pathToFileURL(require.resolve("zod")).href;
  let current = "a";
  globalThis.__mailUser = () => current;
  const service = read("src/lib/mailboxes.ts")
    .replace(
      'import { createServerFn } from "@tanstack/react-start";',
      `const createServerFn=()=>{let schema;const builder={middleware:()=>builder,validator:s=>{schema=s;return builder;},handler:fn=>async(options={})=>fn({context:{userId:globalThis.__mailUser()},data:schema?schema.parse(options.data):undefined})};return builder;};`,
    )
    .replace('import { authMiddleware } from "./auth/middleware";', "const authMiddleware={};")
    .replace('import { getSql } from "./db";', "const getSql=async()=>globalThis.__mailSql;")
    .replace('from "zod"', `from "${zod}"`)
    .replace('from "./mailbox-policy"', `from "${policyUrl}"`)
    .replace('from "./mailbox-provider.server"', `from "${providerUrl}"`)
    .replace('from "./outreach-message"', `from "${transportUrl}"`);
  const api = await import(compile(service));
  try {
    for (const migration of [
      "0001_auth.sql",
      "0002_app_state.sql",
      "0003_security_hardening.sql",
      "0004_automation_runs.sql",
      "0005_outreach_delivery.sql",
      "0006_billing.sql",
      "0007_mailboxes.sql",
    ])
      await db.exec(read("migrations/" + migration));
    await db.exec(`insert into "user"(id,name,email,"emailVerified") values('a','A','a@example.invalid',true),('b','B','b@example.invalid',true);
   insert into account(id,"userId","providerId","accountId",scope,"accessToken","refreshToken","updatedAt") values('aa','a','microsoft','pa','Mail.Read Mail.Send Mail.ReadWrite','encrypted-fixture','encrypted-fixture',now()),('bb','b','google','pb','https://www.googleapis.com/auth/gmail.readonly','encrypted-fixture','encrypted-fixture',now());
   insert into app_state(user_id,state) values('a','{"gigs":[{"id":"gig-a","venue":"Fixture"}]}'),('b','{"gigs":[]}');`);
    assert.equal((await api.mailboxStatus()).accounts.length, 1);
    await assert.rejects(() => provider.ownedMailbox("a", "bb"), /unavailable/);
    await assert.rejects(() => api.selectMailbox({ data: { accountId: "bb" } }), /unavailable/);
    await api.selectMailbox({ data: { accountId: "aa" } });
    assert.equal((await api.mailboxStatus()).selected, "aa");
    globalThis.fetch = async (url) => {
      assert.ok(
        String(url).startsWith("https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?"),
      );
      return Response.json({
        value: [
          {
            id: "message",
            conversationId: "thread",
            subject: "A real fixture",
            from: { emailAddress: { address: "venue@example.invalid" } },
            internetMessageHeaders: [{ name: "In-Reply-To", value: "<fixture>" }],
          },
        ],
      });
    };
    await db.exec(`insert into outreach_delivery_audit(idempotency_key,user_id,gig_id,recipient,status,provider_message_id,provider_thread_id,mailbox_account_id,mail_provider) values('receipt','a','gig-a','venue@example.invalid','sent','sent-message','thread','aa','microsoft');
    insert into outreach_approvals(id,user_id,gig_id,recipient,subject,body,message_fingerprint,contact_source_url,policy_version,mailbox_account_id) values('pending-reply','a','gig-a','venue@example.invalid','Fixture','Fixture','hash','https://example.invalid','2026-10-22-v1','aa');`);
    await api.syncMailbox({ data: { accountId: "aa" } });
    assert.equal(
      (
        await db.query(
          "select revoked_at is not null as revoked from outreach_approvals where id='pending-reply'",
        )
      ).rows[0].revoked,
      true,
    );
    assert.equal((await api.mailboxStatus()).messages[0].reply_to, "<fixture>");
    const draft = await api.saveMailboxDraft({
      data: {
        accountId: "aa",
        gigId: "gig-a",
        recipient: "venue@example.invalid",
        subject: "Fixture",
        body: "Fictional test draft",
      },
    });
    await assert.rejects(
      () =>
        api.saveMailboxDraft({
          data: {
            accountId: "aa",
            gigId: "foreign-gig",
            recipient: "venue@example.invalid",
            subject: "Fixture",
            body: "Fixture",
          },
        }),
      /booking/,
    );
    let exports = 0;
    globalThis.fetch = async (url, init) => {
      exports++;
      assert.equal(init.method, "POST");
      return Response.json({ id: "draft-provider" }, { status: 201 });
    };
    await api.exportOutlookDraft({ data: { id: draft.id } });
    await assert.rejects(() => api.exportOutlookDraft({ data: { id: draft.id } }), /already/);
    assert.equal(exports, 1);
    refreshFails = true;
    await assert.rejects(() => api.syncMailbox({ data: { accountId: "aa" } }), /revoked/);
    assert.doesNotMatch(
      JSON.stringify(await api.mailboxStatus()),
      /SECRET-TOKEN|encrypted-fixture/,
    );
    current = "b";
    assert.equal((await api.mailboxStatus()).drafts.length, 0);
    assert.equal((await api.mailboxStatus()).messages.length, 0);
    await assert.rejects(() => api.exportOutlookDraft({ data: { id: draft.id } }), /unavailable/);
    current = "a";
    await api.disconnectMailbox({ data: { accountId: "aa" } });
    await assert.rejects(() => provider.ownedMailbox("a", "aa"), /unavailable/);
    const [account] = (await db.query("select * from account where id='aa'")).rows;
    assert.equal(account.accessToken, null);
    assert.equal(account.refreshToken, null);
    assert.equal(account.userId, "a");
    await api.enableMailbox({ data: { provider: "microsoft" } });
    assert.equal((await api.mailboxStatus()).accounts[0].enabled, true);
    await assert.rejects(() => provider.mailboxToken("a", "aa", "read"), /missing/);
  } finally {
    globalThis.fetch = previousFetch;
    await db.close();
    delete globalThis.__mailSql;
    delete globalThis.__mailAuth;
    delete globalThis.__mailUser;
  }
});

test("OAuth initiates canonical callbacks, separate mailbox scopes, signed state and rejects external redirects", async () => {
  const instance = betterAuth({
    baseURL: "http://localhost:8080",
    secret: "fixture-secret-at-least-thirty-two-characters",
    database: memoryAdapter({ user: [], account: [], session: [], verification: [] }),
    socialProviders: {
      google: {
        clientId: "fixture",
        clientSecret: "fixture",
        prompt: "consent",
        accessType: "offline",
      },
      microsoft: {
        clientId: "fixture",
        clientSecret: "fixture",
        tenantId: "common",
        prompt: "consent",
      },
    },
    account: {
      encryptOAuthTokens: true,
      accountLinking: { enabled: true, disableImplicitLinking: true, allowDifferentEmails: true },
    },
    logger: { disabled: true },
  });
  for (const provider of ["google", "microsoft"]) {
    const start = await instance.api.signInSocial({
      body: { provider, callbackURL: "http://localhost:8080/account", disableRedirect: true },
      asResponse: true,
    });
    assert.equal(start.status, 200);
    const data = await start.json();
    const url = new URL(data.url);
    assert.equal(
      url.hostname,
      provider === "google" ? "accounts.google.com" : "login.microsoftonline.com",
    );
    assert.equal(
      url.searchParams.get("redirect_uri"),
      `http://localhost:8080/api/auth/callback/${provider}`,
    );
    assert.ok(url.searchParams.get("state"));
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.equal(url.searchParams.get("prompt"), "consent");
    assert.doesNotMatch(url.searchParams.get("scope"), /gmail|mail\.read|mail\.send/i);
    assert.match(start.headers.get("set-cookie"), /HttpOnly/i);
    const mismatch = await instance.handler(
      new Request(`http://localhost:8080/api/auth/callback/${provider}?state=forged&code=invalid`),
    );
    assert.equal(mismatch.status, 302);
    assert.match(mismatch.headers.get("location"), /error=state/);
    const external = await instance.handler(
      new Request("http://localhost:8080/api/auth/sign-in/social", {
        method: "POST",
        headers: { origin: "http://localhost:8080", "content-type": "application/json" },
        body: JSON.stringify({ provider, callbackURL: "https://attacker.invalid/" }),
      }),
    );
    assert.equal(external.status, 403);
  }
});

test("explicit Microsoft linking accepts provider identity, blocks cross-user reassignment and implicit email linking", async () => {
  const previous = globalThis.fetch;
  const instance = betterAuth({
    baseURL: "http://localhost:8080",
    secret: "fixture-secret-at-least-thirty-two-characters",
    database: memoryAdapter({ user: [], account: [], session: [], verification: [] }),
    emailAndPassword: { enabled: true },
    socialProviders: {
      microsoft: {
        ...microsoftOAuthOptions("fixture", "fixture"),
        clientId: "fixture",
        clientSecret: "fixture",
        tenantId: "common",
        getUserInfo: async () => ({
          user: {
            id: "provider-subject",
            name: "Fixture Microsoft",
            email: "linked@example.invalid",
            emailVerified: false,
          },
          data: {},
        }),
      },
    },
    account: {
      encryptOAuthTokens: true,
      accountLinking: {
        enabled: true,
        ...MICROSOFT_LINKING_POLICY,
      },
    },
    logger: { disabled: true },
  });
  const ctx = await instance.$context;
  const origin = "http://localhost:8080";
  const cookieJar = (res) =>
    res.headers
      .getSetCookie()
      .map((x) => x.split(";")[0])
      .join("; ");
  const signup = async (email) =>
    instance.handler(
      new Request(origin + "/api/auth/sign-up/email", {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify({
          name: "Fictional QA",
          email,
          password: "fixture-long-password-123",
        }),
      }),
    );
  const a = await signup("linked@example.invalid");
  assert.equal(a.status, 200);
  const aBody = await a.json(),
    aCookie = cookieJar(a);
  const b = await signup("other@example.invalid");
  assert.equal(b.status, 200);
  const bCookie = cookieJar(b);
  globalThis.fetch = async (url) => {
    assert.equal(String(url), "https://login.microsoftonline.com/common/oauth2/v2.0/token");
    return Response.json({
      access_token: "fixture-token",
      refresh_token: "fixture-refresh",
      expires_in: 3600,
      scope: "openid email profile Mail.ReadBasic",
    });
  };
  async function finish(start, cookie = "") {
    const data = await start.json();
    const url = new URL(data.url),
      state = url.searchParams.get("state");
    return instance.handler(
      new Request(
        origin +
          "/api/auth/callback/microsoft?state=" +
          encodeURIComponent(state) +
          "&code=fixture-code",
        { headers: { cookie: [cookie, cookieJar(start)].filter(Boolean).join("; ") } },
      ),
    );
  }
  try {
    const implicit = await instance.api.signInSocial({
      body: { provider: "microsoft", callbackURL: "/account", disableRedirect: true },
      asResponse: true,
    });
    const denied = await finish(implicit);
    assert.equal(denied.status, 302);
    assert.match(denied.headers.get("location"), /account_not_linked/);
    assert.equal(
      (await ctx.internalAdapter.findAccounts(aBody.user.id)).filter(
        (a) => a.providerId === "microsoft",
      ).length,
      0,
    );
    await assert.rejects(() =>
      instance.api.linkSocialAccount({
        body: { provider: "microsoft", callbackURL: "/account" },
        headers: new Headers(),
      }),
    );
    const explicit = await instance.api.linkSocialAccount({
      body: {
        provider: "microsoft",
        callbackURL: "/account",
        scopes: ["Mail.ReadBasic", "offline_access"],
        disableRedirect: true,
      },
      headers: new Headers({ cookie: aCookie, origin }),
      asResponse: true,
    });
    assert.equal(explicit.status, 200);
    const linked = await finish(explicit, aCookie);
    assert.equal(linked.status, 302);
    assert.doesNotMatch(linked.headers.get("location"), /error=/);
    assert.equal(
      (await ctx.internalAdapter.findAccounts(aBody.user.id)).filter(
        (a) => a.providerId === "microsoft",
      ).length,
      1,
    );
    const foreign = await instance.api.linkSocialAccount({
      body: { provider: "microsoft", callbackURL: "/account", disableRedirect: true },
      headers: new Headers({ cookie: bCookie, origin }),
      asResponse: true,
    });
    const rejected = await finish(foreign, bCookie);
    assert.match(rejected.headers.get("location"), /error=/);
    assert.equal(
      (await ctx.internalAdapter.findAccounts(aBody.user.id)).filter(
        (a) => a.providerId === "microsoft",
      ).length,
      1,
    );
  } finally {
    globalThis.fetch = previous;
  }
});

test("Microsoft renewal preserves mailbox consent by omitting login-only scope narrowing", async () => {
  const previous = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = async (url, init) => {
      calls++;
      assert.equal(String(url), "https://login.microsoftonline.com/common/oauth2/v2.0/token");
      const params = new URLSearchParams(init.body);
      assert.equal(params.get("grant_type"), "refresh_token");
      assert.equal(params.has("scope"), false);
      return Response.json({
        access_token: "renewed-fixture",
        refresh_token: "rotated-fixture",
        expires_in: 3600,
        scope: "Mail.ReadBasic Mail.Send",
      });
    };
    const options = microsoftOAuthOptions("fixture", "fixture");
    const tokens = await options.refreshAccessToken("refresh-fixture");
    assert.equal(calls, 1);
    assert.equal(tokens.accessToken, "renewed-fixture");
    assert.deepEqual(tokens.scopes, ["Mail.ReadBasic", "Mail.Send"]);
  } finally {
    globalThis.fetch = previous;
  }
});
