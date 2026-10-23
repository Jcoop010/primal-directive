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
const testServiceUrl = compile(
  read("src/lib/mailbox-test.server.ts").replace(
    'from "./outreach-message"',
    `from "${transportUrl}"`,
  ),
);
const { deliverOutlook, outreachInternetMessageId } = await import(transportUrl);
test("one-time Gmail tests bind verified owner, selected mailbox and fixed recipient; concurrent and ambiguous sends never retry", async () => {
  const { executeMailboxTest, configuredMailboxTest, recordMailboxTestReplies } = await import(
    testServiceUrl
  );
  const db = new PGlite();
  const previousFetch = globalThis.fetch;
  const sqlFor = (client) => ({
    query: async (q, p = []) => (await client.query(q, p)).rows,
    transaction: (work) => db.transaction((tx) => work(sqlFor(tx))),
  });
  const sql = sqlFor(db);
  const grant = (n) => ({
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    ownerEmail: "a@example.invalid",
    recipient: "test-recipient@example.invalid",
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });
  const tokenFor = async () => ({ account: { providerId: "google" }, token: "PRIVATE-TOKEN" });
  let sends = 0;
  try {
    for (const migration of [
      "0001_auth.sql",
      "0002_app_state.sql",
      "0003_security_hardening.sql",
      "0004_automation_runs.sql",
      "0005_outreach_delivery.sql",
      "0006_billing.sql",
      "0007_mailboxes.sql",
      "0008_mailbox_connection_tests.sql",
    ])
      await db.exec(read("migrations/" + migration));
    await db.exec(`insert into "user"(id,name,email,"emailVerified") values('a','A','a@example.invalid',true),('b','B','b@example.invalid',true);
      insert into account(id,"userId","providerId","accountId",scope,"accessToken","refreshToken","updatedAt") values('aa','a','google','pa','https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send','encrypted','encrypted',now()),('bb','b','google','pb','https://www.googleapis.com/auth/gmail.send','encrypted','encrypted',now());
      insert into mailbox_preferences(user_id,account_id) values('a','aa'),('b','bb');
      insert into mailbox_connections(user_id,account_id,last_sync_at) values('a','aa',now()),('b','bb',now());`);
    globalThis.fetch = async (url, init) => {
      sends++;
      assert.equal(url, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
      const mime = Buffer.from(JSON.parse(init.body).raw, "base64url").toString();
      assert.match(mime, /^To: test-recipient@example.invalid\r\n/);
      assert.doesNotMatch(mime, /PRIVATE-TOKEN|Bcc:|Cc:/);
      return Response.json({ id: "provider-test", threadId: "test-thread" });
    };
    assert.equal(await configuredMailboxTest(sql, "b", JSON.stringify(grant(1))), null);
    assert.equal(
      await configuredMailboxTest(
        sql,
        "a",
        JSON.stringify({ ...grant(1), expiresAt: new Date(0).toISOString() }),
      ),
      null,
    );
    await assert.rejects(
      () => executeMailboxTest(sql, "b", "bb", grant(1).id, tokenFor, JSON.stringify(grant(1))),
      /not authorized/,
    );
    await assert.rejects(
      () => executeMailboxTest(sql, "a", "bb", grant(1).id, tokenFor, JSON.stringify(grant(1))),
      /Select and verify/,
    );
    await assert.rejects(
      () =>
        executeMailboxTest(
          sql,
          "a",
          "aa",
          grant(1).id,
          async () => {
            throw new Error("Authorization revoked");
          },
          JSON.stringify(grant(1)),
        ),
      /revoked/,
    );
    assert.equal(sends, 0);
    const concurrent = await Promise.allSettled(
      [1, 2].map(() =>
        executeMailboxTest(sql, "a", "aa", grant(1).id, tokenFor, JSON.stringify(grant(1))),
      ),
    );
    assert.equal(concurrent.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(sends, 1);
    const [audit] = await sql.query("select * from mailbox_connection_tests where grant_id=$1", [
      grant(1).id,
    ]);
    assert.equal(audit.provider_message_id, "provider-test");
    assert.equal(audit.provider_thread_id, "test-thread");
    assert.equal(audit.recipient, "test-recipient@example.invalid");
    assert.match(audit.policy_version, /connection-test/);
    assert.ok(audit.approved_at);
    assert.doesNotMatch(JSON.stringify(audit), /PRIVATE-TOKEN/);
    const reply = {
      id: "incoming-reply",
      threadId: "test-thread",
      from: "test-recipient@example.invalid",
      subject: "Re: test",
      date: "fixture",
      replyTo: "",
    };
    await recordMailboxTestReplies(sql, "b", "bb", [reply]);
    await recordMailboxTestReplies(sql, "a", "aa", [
      { ...reply, from: "unrelated@example.invalid" },
    ]);
    assert.equal(
      (await sql.query("select reply_message_id from mailbox_connection_tests"))[0]
        .reply_message_id,
      null,
    );
    await recordMailboxTestReplies(sql, "a", "aa", [reply]);
    assert.equal(
      (await sql.query("select reply_message_id from mailbox_connection_tests"))[0]
        .reply_message_id,
      "incoming-reply",
    );
    globalThis.fetch = async () => {
      sends++;
      throw new Error("ambiguous timeout PRIVATE-TOKEN");
    };
    const unknown = await executeMailboxTest(
      sql,
      "a",
      "aa",
      grant(2).id,
      tokenFor,
      JSON.stringify(grant(2)),
    );
    assert.equal(unknown.status, "unknown");
    await assert.rejects(
      () => executeMailboxTest(sql, "a", "aa", grant(2).id, tokenFor, JSON.stringify(grant(2))),
      /already been attempted/,
    );
    assert.equal(sends, 2);
    globalThis.fetch = async () => {
      sends++;
      return new Response(null, { status: 401 });
    };
    assert.equal(
      (await executeMailboxTest(sql, "a", "aa", grant(3).id, tokenFor, JSON.stringify(grant(3))))
        .status,
      "failed",
    );
    await sql.query("update mailbox_connections set enabled=false where user_id='a'");
    await assert.rejects(
      () => executeMailboxTest(sql, "a", "aa", grant(4).id, tokenFor, JSON.stringify(grant(4))),
      /Select and verify/,
    );
    assert.equal(sends, 3);
    await sql.query("update mailbox_connections set enabled=true where user_id='a'");
    await sql.query("update account set scope='openid' where id='aa'");
    await assert.rejects(
      () => executeMailboxTest(sql, "a", "aa", grant(4).id, tokenFor, JSON.stringify(grant(4))),
      /Select and verify/,
    );
    assert.equal(sends, 3);
    assert.equal((await sql.query("select count(*)::int n from mailbox_connection_tests"))[0].n, 3);
  } finally {
    globalThis.fetch = previousFetch;
    await db.close();
  }
});
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
      {
        recipient: "venue@example.invalid",
        subject: "Approved fixture",
        body: "Fictional QA",
        key: "fixture-key",
      },
      async (url, init) => {
        calls++;
        assert.equal(url, "https://graph.microsoft.com/v1.0/me/sendMail");
        assert.equal(init.headers["Content-Type"], "text/plain");
        assert.match(Buffer.from(init.body, "base64").toString(), /^To: venue@example.invalid\r\n/);
        return new Response(null, { status });
      },
    );
    assert.equal(calls, 1);
    assert.equal(result.status, status === 202 || status === 500 ? "unknown" : "failed");
  }
  const result = await deliverOutlook(
    "fixture",
    { recipient: "venue@example.invalid", subject: "Fixture", body: "Fixture", key: "fixture-key" },
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
    .replace('from "./mailbox-policy"', `from "${policyUrl}"`)
    .replace('from "./outreach-message"', `from "${transportUrl}"`);
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
    .replace('from "./mailbox-test.server"', `from "${testServiceUrl}"`)
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
      "0008_mailbox_connection_tests.sql",
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
      assert.equal(url, "https://graph.microsoft.com/oidc/userinfo");
      return Response.json({ email: "Outlook-Owner@example.invalid" });
    };
    assert.equal(
      (await api.mailboxIdentity({ data: { accountId: "aa" } })).address,
      "outlook-owner@example.invalid",
    );
    await assert.rejects(() => api.mailboxIdentity({ data: { accountId: "bb" } }), /unavailable/);
    current = "b";
    globalThis.fetch = async (url) => {
      assert.equal(url, "https://gmail.googleapis.com/gmail/v1/users/me/profile");
      return Response.json({ emailAddress: "Gmail-Owner@example.invalid" });
    };
    assert.equal(
      (await api.mailboxIdentity({ data: { accountId: "bb" } })).address,
      "gmail-owner@example.invalid",
    );
    current = "a";
    globalThis.fetch = async (url) => {
      if (String(url).includes("/sentitems/"))
        return Response.json({
          value: [
            {
              id: "actual-sent-receipt",
              conversationId: "thread",
              internetMessageId: outreachInternetMessageId("receipt"),
            },
          ],
        });
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
    await db.exec(`insert into outreach_delivery_audit(idempotency_key,user_id,gig_id,recipient,status,provider_message_id,provider_thread_id,mailbox_account_id,mail_provider) values('receipt','a','gig-a','venue@example.invalid','unknown',null,null,'aa','microsoft');
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
    assert.deepEqual(
      (
        await db.query(
          "select status,provider_message_id,provider_thread_id from outreach_delivery_audit where idempotency_key='receipt'",
        )
      ).rows,
      [
        {
          status: "sent",
          provider_message_id: "actual-sent-receipt",
          provider_thread_id: "thread",
        },
      ],
    );
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
    refreshFails = false;
    globalThis.fetch = async () =>
      Response.json(
        {
          error: {
            message: "private-provider-details",
            details: [
              {
                reason: "SERVICE_DISABLED",
                metadata: { activationUrl: "https://attacker.invalid/private" },
              },
            ],
          },
        },
        { status: 403 },
      );
    await assert.rejects(
      () => api.syncMailbox({ data: { accountId: "bb" } }),
      /Gmail API is disabled/,
    );
    const failedStatus = await api.mailboxStatus();
    assert.match(failedStatus.accounts[0].last_error, /Google Cloud project/);
    assert.doesNotMatch(JSON.stringify(failedStatus), /private-provider-details|attacker/);
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

test("Gmail failures distinguish disabled API, token scopes, domain policy and quotas without leaking provider details", () => {
  const failure = (reason) =>
    policy.mailboxFailure(403, "google", {
      error: {
        message: "private-token-and-email",
        errors: [{ reason }],
        details: [{ metadata: { activationUrl: "https://attacker.invalid/private-token" } }],
      },
    });
  assert.equal(failure("accessNotConfigured").code, "gmail-api-disabled");
  assert.equal(
    policy.mailboxFailure(403, "google", { error: { details: [{ reason: "SERVICE_DISABLED" }] } })
      .code,
    "gmail-api-disabled",
  );
  assert.match(failure("insufficientPermissions").message, /current token/);
  assert.equal(failure("domainPolicy").code, "gmail-domain-policy");
  assert.equal(failure("userRateLimitExceeded").code, "gmail-quota");
  assert.equal(failure("unknown-private-token").code, "gmail-forbidden-unclassified");
  for (const reason of [
    "accessNotConfigured",
    "insufficientPermissions",
    "domainPolicy",
    "unknown-private-token",
  ]) {
    assert.doesNotMatch(JSON.stringify(failure(reason)), /private-token|attacker|activationUrl/);
  }
  assert.equal(
    policy.mailboxFailure(403, "microsoft", {
      error: { details: [{ reason: "SERVICE_DISABLED" }] },
    }).code,
    "permission-denied",
  );
});
