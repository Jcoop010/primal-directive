import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const compile = (source) =>
  "data:text/javascript;base64," +
  Buffer.from(
    ts.transpile(source, {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    }),
  ).toString("base64");
const require = createRequire(import.meta.url);
const zod = pathToFileURL(require.resolve("zod")).href;
const transport = compile(read("src/lib/outreach-message.ts"));
const policy = compile(read("src/lib/mailbox-policy.ts"));
const release = compile(read("src/lib/outreach-release.server.ts"));
const { outreachInternetMessageId } = await import(transport);
const connectionTest = compile(
  read("src/lib/mailbox-test.server.ts").replace(
    'from "./outreach-message"',
    `from "${transport}"`,
  ),
);
const sqlImport = 'import { getSql } from "./db";';
const sqlStub = "const getSql=async()=>globalThis.__bookingSql;";
const wrapServer = (source) =>
  source
    .replace(
      'import { createServerFn } from "@tanstack/react-start";',
      `const createServerFn=()=>{let schema;const b={middleware:()=>b,validator:s=>{schema=s;return b;},handler:fn=>async(o={})=>fn({context:{userId:globalThis.__bookingUser},data:schema?schema.parse(o.data):undefined})};return b;};`,
    )
    .replace('import { authMiddleware } from "./auth/middleware";', "const authMiddleware={};")
    .replace(sqlImport, sqlStub)
    .replace('from "zod"', `from "${zod}"`)
    .replace('from "./outreach-message"', `from "${transport}"`);

test("actual booking handlers approve, reserve, send once, sync replies and revoke follow-ups for both providers", async () => {
  const db = new PGlite();
  const previousFetch = globalThis.fetch;
  const previousFlags = [process.env.OUTREACH_SEND_ENABLED, process.env.OUTREACH_RELEASE_VERIFIED];
  const previousGrant = process.env.OUTREACH_VERIFICATION_GRANT;
  delete process.env.OUTREACH_VERIFICATION_GRANT;
  const sqlFor = (client) => ({
    query: async (q, p = []) => (await client.query(q, p)).rows,
    transaction: (work) => db.transaction((tx) => work(sqlFor(tx))),
  });
  globalThis.__bookingSql = sqlFor(db);
  globalThis.__bookingUser = "artist-a";
  let tokenRevoked = false;
  const provider = compile(
    read("src/lib/mailbox-provider.server.ts")
      .replace(
        'import { auth } from "./auth/server";',
        "const auth={api:{getAccessToken:async()=>globalThis.__bookingToken()}};",
      )
      .replace(
        'import { getRequest } from "@tanstack/react-start/server";',
        'const getRequest=()=>new Request("http://localhost:8080");',
      )
      .replace(sqlImport, sqlStub)
      .replace('from "./mailbox-policy"', `from "${policy}"`)
      .replace('from "./outreach-message"', `from "${transport}"`),
  );
  globalThis.__bookingToken = () => {
    if (tokenRevoked) throw new Error("private-token-must-not-leak");
    return { accessToken: "private-token" };
  };
  const ledger = compile(read("src/lib/outreach-delivery-ledger.ts").replace(sqlImport, sqlStub));
  const outreach = await import(
    compile(
      wrapServer(read("src/lib/outreach.ts"))
        .replace(
          'import { requirePaid } from "./billing.server";',
          "const requirePaid=async()=>{};",
        )
        .replace('from "./mailbox-provider.server"', `from "${provider}"`)
        .replace('from "./outreach-delivery-ledger"', `from "${ledger}"`)
        .replace('from "./outreach-release.server"', `from "${release}"`)
        .replace('from "./mailbox-policy"', `from "${policy}"`),
    )
  );
  const mail = await import(
    compile(
      wrapServer(read("src/lib/mailboxes.ts"))
        .replace('from "./mailbox-provider.server"', `from "${provider}"`)
        .replace('from "./mailbox-policy"', `from "${policy}"`)
        .replace('from "./mailbox-test.server"', `from "${connectionTest}"`),
    )
  );
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
    await db.exec(`insert into "user"(id,name,email,"emailVerified") values('artist-a','A','a@example.invalid',true),('artist-b','B','b@example.invalid',true);
      insert into account(id,"userId","providerId","accountId",scope,"accessToken","refreshToken","updatedAt") values
      ('gmail-a','artist-a','google','ga','https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send','encrypted','encrypted',now()),
      ('outlook-a','artist-a','microsoft','ma','Mail.Read Mail.Send','encrypted','encrypted',now()),
      ('gmail-b','artist-b','google','gb','https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send','encrypted','encrypted',now());
      insert into app_state(user_id,state) values('artist-a','{"gigs":[{"id":"gmail-gig","venue":"Test room"},{"id":"outlook-gig","venue":"Test room"},{"id":"failure-gig","venue":"Test room"}]}'),('artist-b','{"gigs":[]}');`);
    const message = (gigId, mailboxAccountId, recipient) => ({
      gigId,
      mailboxAccountId,
      recipient,
      subject: "Artist booking test",
      body: "An explicitly approved fixture message",
      verifiedContact: true,
      consent: true,
      contactSourceUrl: "https://example.invalid/booking",
    });
    const approve = async (gig, account, recipient) =>
      (await outreach.approveBookingMessage({ data: message(gig, account, recipient) })).id;
    await assert.rejects(
      () =>
        outreach.approveBookingMessage({
          data: message("foreign-gig", "gmail-a", "test@example.invalid"),
        }),
      /Save this booking/,
    );
    await assert.rejects(
      () =>
        outreach.approveBookingMessage({
          data: message("gmail-gig", "gmail-b", "test@example.invalid"),
        }),
      /Mailbox unavailable/,
    );
    await assert.rejects(() =>
      outreach.approveBookingMessage({
        data: { ...message("gmail-gig", "gmail-a", "test@example.invalid"), consent: false },
      }),
    );
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      throw new Error("unexpected network");
    };
    const gmailApproval = await approve("gmail-gig", "gmail-a", "gmail-test@example.invalid");
    delete process.env.OUTREACH_SEND_ENABLED;
    delete process.env.OUTREACH_RELEASE_VERIFIED;
    await assert.rejects(
      () => outreach.sendApprovedBooking({ data: { id: gmailApproval } }),
      /Sending remains disabled/,
    );
    assert.equal(calls, 0);
    const row = (
      await db.query("select message_fingerprint from outreach_approvals where id=$1", [
        gmailApproval,
      ])
    ).rows[0];
    const grant = {
      approvalId: gmailApproval,
      ownerEmail: "a@example.invalid",
      recipient: "gmail-test@example.invalid",
      mailboxAccountId: "gmail-a",
      messageFingerprint: row.message_fingerprint,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
    const { verificationApprovalId } = await import(release);
    for (const changed of [
      { recipient: "someone-else@example.invalid" },
      { ownerEmail: "b@example.invalid" },
      { mailboxAccountId: "gmail-b" },
      { messageFingerprint: "b".repeat(64) },
      { expiresAt: new Date(0).toISOString() },
    ]) {
      process.env.OUTREACH_VERIFICATION_GRANT = JSON.stringify({ ...grant, ...changed });
      assert.equal(await verificationApprovalId(globalThis.__bookingSql, "artist-a"), null);
    }
    process.env.OUTREACH_VERIFICATION_GRANT = JSON.stringify(grant);
    assert.equal(await verificationApprovalId(globalThis.__bookingSql, "artist-a"), gmailApproval);
    assert.equal(await verificationApprovalId(globalThis.__bookingSql, "artist-b"), null);
    globalThis.fetch = async () => {
      calls++;
      return Response.json({ id: "scoped-live-fixture", threadId: "gmail-thread" });
    };
    await assert.rejects(
      () => outreach.sendApprovedBooking({ data: { id: gmailApproval } }),
      /Send blocked/,
    );
    assert.equal(calls, 0);
    await outreach.pauseOutreach({ data: { paused: false } });
    assert.equal(
      (await outreach.sendApprovedBooking({ data: { id: gmailApproval } })).status,
      "sent",
    );
    assert.equal(calls, 1);
    assert.equal(await verificationApprovalId(globalThis.__bookingSql, "artist-a"), null);
    await assert.rejects(
      () => outreach.sendApprovedBooking({ data: { id: gmailApproval } }),
      /Sending remains disabled/,
    );
    assert.equal(calls, 1);
    // Reset only this isolated fixture so the same handler is also tested in general-release mode.
    await db.query("delete from outreach_delivery_audit where approval_id=$1", [gmailApproval]);
    delete process.env.OUTREACH_VERIFICATION_GRANT;
    // Flags affect this isolated Node process only. No real credentials or network are used.
    process.env.OUTREACH_SEND_ENABLED = "true";
    process.env.OUTREACH_RELEASE_VERIFIED = "true";
    await outreach.pauseOutreach({ data: { paused: false } });
    for (const [account, gig, recipient, id] of [
      ["gmail-a", "gmail-gig", "gmail-test@example.invalid", gmailApproval],
      ["outlook-a", "outlook-gig", "outlook-test@example.invalid", null],
    ]) {
      const approval = id ?? (await approve(gig, account, recipient));
      globalThis.__bookingUser = "artist-b";
      await assert.rejects(
        () => outreach.sendApprovedBooking({ data: { id: approval } }),
        /Approval expired/,
      );
      globalThis.__bookingUser = "artist-a";
      let sends = 0;
      globalThis.fetch = async (url, init) => {
        sends++;
        assert.match(url, /messages\/send$|\/sendMail$/);
        const mime =
          account === "gmail-a"
            ? Buffer.from(JSON.parse(init.body).raw, "base64url").toString()
            : Buffer.from(init.body, "base64").toString();
        assert.match(mime, new RegExp(`^To: ${recipient}\\r\\n`));
        assert.doesNotMatch(mime, /private-token|Bcc:|Cc:/);
        return account === "gmail-a"
          ? Response.json({ id: "sent-gmail", threadId: "gmail-thread" })
          : new Response(null, { status: 202 });
      };
      const attempts = await Promise.allSettled([
        outreach.sendApprovedBooking({ data: { id: approval } }),
        outreach.sendApprovedBooking({ data: { id: approval } }),
      ]);
      assert.equal(sends, 1);
      assert.equal(attempts.filter((x) => x.status === "fulfilled").length, 1);
      const receipt = (
        await db.query("select * from outreach_delivery_audit where approval_id=$1", [approval])
      ).rows[0];
      assert.equal(receipt.mailbox_account_id, account);
      assert.equal(receipt.status, account === "gmail-a" ? "sent" : "unknown");
      await assert.rejects(
        () => outreach.sendApprovedBooking({ data: { id: approval } }),
        /Send blocked/,
      );
      assert.equal(sends, 1);
      const followUp = await approve(gig, account, recipient);
      globalThis.fetch = async (url) => {
        const link = String(url);
        if (link.includes("/sentitems/")) return Response.json({ value: [] }); // No invented Graph receipt.
        if (account === "outlook-a") return Response.json({ value: [] });
        if (link.includes("messages?")) return Response.json({ messages: [{ id: "reply" }] });
        assert.ok(link.includes("/messages/reply?format=metadata"));
        return Response.json({
          id: "reply",
          threadId: "gmail-thread",
          payload: {
            headers: [
              { name: "From", value: `Test <${recipient}>` },
              { name: "Subject", value: "Re: Artist booking test" },
              { name: "Date", value: new Date().toUTCString() },
              { name: "In-Reply-To", value: "<fixture>" },
            ],
          },
        });
      };
      await mail.syncMailbox({ data: { accountId: account } });
      const stopped = (
        await db.query("select revoked_at from outreach_approvals where id=$1", [followUp])
      ).rows[0];
      if (account === "gmail-a") {
        assert.ok(stopped.revoked_at);
        assert.equal(
          (
            await db.query(
              "select gig_id from mailbox_messages where user_id='artist-a' and message_id='reply'",
            )
          ).rows[0].gig_id,
          gig,
        );
        assert.equal(
          (await db.query("select state from app_state where user_id='artist-a'")).rows[0].state
            .gigs[0].venue,
          "Test room",
        );
      } else {
        assert.equal(stopped.revoked_at, null); // No reply or receipt means no fictional match.
        globalThis.fetch = async (url) =>
          String(url).includes("/sentitems/")
            ? Response.json({
                value: [
                  {
                    id: "sent-outlook",
                    conversationId: "outlook-thread",
                    internetMessageId: outreachInternetMessageId(`artist-a:${approval}`),
                  },
                ],
              })
            : Response.json({
                value: [
                  {
                    id: "outlook-reply",
                    conversationId: "outlook-thread",
                    from: { emailAddress: { address: recipient } },
                    subject: "Re: Artist booking test",
                    receivedDateTime: new Date().toISOString(),
                    internetMessageHeaders: [
                      {
                        name: "In-Reply-To",
                        value: outreachInternetMessageId(`artist-a:${approval}`),
                      },
                    ],
                  },
                ],
              });
        await mail.syncMailbox({ data: { accountId: account } });
        assert.ok(
          (await db.query("select revoked_at from outreach_approvals where id=$1", [followUp]))
            .rows[0].revoked_at,
        );
        assert.equal(
          (
            await db.query(
              "select gig_id from mailbox_messages where user_id='artist-a' and message_id='outlook-reply'",
            )
          ).rows[0].gig_id,
          gig,
        );
        assert.equal(
          (
            await db.query("select status from outreach_delivery_audit where approval_id=$1", [
              approval,
            ])
          ).rows[0].status,
          "sent",
        );
      }
      globalThis.__bookingUser = "artist-b";
      assert.equal((await outreach.outreachStatus()).activity.length, 0);
      await assert.rejects(
        () => mail.syncMailbox({ data: { accountId: account } }),
        /Mailbox unavailable/,
      );
      globalThis.__bookingUser = "artist-a";
    }
    // Fresh gigs/contacts avoid cooldown interference while testing revocation and unknown outcomes.
    const failure = await approve("failure-gig", "gmail-a", "failure@example.invalid");
    tokenRevoked = true;
    await assert.rejects(
      () => outreach.sendApprovedBooking({ data: { id: failure } }),
      /Authorization expired/,
    );
    assert.equal(
      (await db.query("select * from outreach_delivery_audit where approval_id=$1", [failure])).rows
        .length,
      0,
    );
    tokenRevoked = false;
    let ambiguousCalls = 0;
    globalThis.fetch = async () => {
      ambiguousCalls++;
      throw new Error("ambiguous timeout");
    };
    assert.equal((await outreach.sendApprovedBooking({ data: { id: failure } })).status, "unknown");
    await assert.rejects(
      () => outreach.sendApprovedBooking({ data: { id: failure } }),
      /Send blocked/,
    );
    assert.equal(ambiguousCalls, 1);
    await outreach.pauseOutreach({ data: { paused: true } });
    assert.equal((await outreach.outreachStatus()).approvals.length, 0);
    await assert.rejects(
      () => outreach.sendApprovedBooking({ data: { id: failure } }),
      /Approval expired/,
    );
  } finally {
    globalThis.fetch = previousFetch;
    for (const [i, key] of ["OUTREACH_SEND_ENABLED", "OUTREACH_RELEASE_VERIFIED"].entries()) {
      if (previousFlags[i] === undefined) delete process.env[key];
      else process.env[key] = previousFlags[i];
    }
    if (previousGrant === undefined) delete process.env.OUTREACH_VERIFICATION_GRANT;
    else process.env.OUTREACH_VERIFICATION_GRANT = previousGrant;
    delete globalThis.__bookingSql;
    delete globalThis.__bookingUser;
    delete globalThis.__bookingToken;
    await db.close();
  }
});
