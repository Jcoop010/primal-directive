import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
const compile = (s) =>
  "data:text/javascript;base64," +
  Buffer.from(
    ts.transpile(s, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }),
  ).toString("base64");
const policy = compile(
  readFileSync(new URL("../src/lib/outreach-followup-policy.ts", import.meta.url), "utf8"),
);
const source = readFileSync(
  new URL("../src/lib/outreach-worker.server.ts", import.meta.url),
  "utf8",
)
  .replace(
    'import { auth } from "./auth/server";',
    'const auth={api:{getAccessToken:async()=>({accessToken:"fixture-only"})}};',
  )
  .replace('import { getSql } from "./db";', "const getSql=async()=>globalThis.__workerSql;")
  .replace('import { requirePaid } from "./billing.server";', "const requirePaid=async()=>{};")
  .replace(
    /import \{[^}]+\} from "\.\/outreach-dispatch.server";/,
    "const sendingReleased=()=>globalThis.__workerReleased;const dispatchApprovedBooking=(...args)=>globalThis.__workerDispatch(...args);",
  )
  .replace('from "./outreach-followup-policy"', `from "${policy}"`);
const { runScheduledOutreach } = await import(compile(source));
test("scheduled worker claims once, stops on reply/opt-out, never resends unknown delivery", async () => {
  const db = new PGlite();
  const originalFetch = globalThis.fetch;
  globalThis.__workerSql = { query: async (t, p = []) => (await db.query(t, p)).rows };
  try {
    for (const name of [
      "0001_auth.sql",
      "0002_app_state.sql",
      "0003_security_hardening.sql",
      "0004_automation_runs.sql",
      "0005_outreach_delivery.sql",
      "0006_billing.sql",
      "0007_outreach_scheduling.sql",
    ])
      await db.exec(readFileSync(new URL("../migrations/" + name, import.meta.url), "utf8"));
    await db.exec(
      `insert into "user"(id,name,email,"emailVerified") values('artist','Artist','artist@example.invalid',true);insert into account(id,"accountId","providerId","userId",scope,"updatedAt") values('google','google','google','artist','https://www.googleapis.com/auth/gmail.readonly',now());insert into outreach_preferences(user_id,paused) values('artist',false);insert into outreach_rules(user_id,enabled,policy_version) values('artist',true,'2026-10-22-v1')`,
    );
    const job = async (id, parent = null) => {
      await db.query(
        "insert into outreach_approvals(id,user_id,gig_id,recipient,subject,body,message_fingerprint,contact_source_url,policy_version) values($1,'artist',$1,'booker@example.com','Subject','Body',$2,'https://example.com','2026-10-22-v1')",
        [id, "a".repeat(64)],
      );
      await db.query(
        "insert into outreach_jobs(id,user_id,approval_id,parent_key,not_before) values($1,'artist',$1,$2,now()-interval '1 minute')",
        [id, parent],
      );
    };
    await job("initial");
    let calls = 0;
    globalThis.__workerDispatch = async () => {
      calls++;
      return { status: "unknown", reason: "provider-timeout-or-network-error" };
    };
    globalThis.__workerReleased = false;
    assert.equal((await runScheduledOutreach()).disabled, true);
    assert.equal(calls, 0);
    globalThis.__workerReleased = true;
    await Promise.all([runScheduledOutreach(), runScheduledOutreach()]);
    assert.equal(calls, 1);
    assert.equal(
      (await db.query("select status from outreach_jobs where id='initial'")).rows[0].status,
      "unknown",
    );
    await runScheduledOutreach();
    assert.equal(calls, 1);
    await job("follow", "parent");
    await db.query(
      "insert into outreach_delivery_audit(idempotency_key,user_id,gig_id,recipient,status,provider_thread_id,created_at) values('parent','artist','follow','booker@example.com','sent','thread1',now()-interval '4 days')",
    );
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          messages: [
            {
              id: "reply",
              threadId: "thread1",
              internalDate: String(Date.now()),
              labelIds: ["INBOX"],
              payload: {
                headers: [{ name: "From", value: "booker@example.com" }],
                body: { data: Buffer.from("Please unsubscribe").toString("base64url") },
              },
            },
          ],
        }),
        { status: 200 },
      );
    await runScheduledOutreach();
    assert.equal(calls, 1);
    assert.equal(
      (await db.query("select status from outreach_jobs where id='follow'")).rows[0].status,
      "cancelled",
    );
    assert.equal(
      (await db.query("select recipient from outreach_suppressions where user_id='artist'")).rows[0]
        .recipient,
      "booker@example.com",
    );
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.__workerSql;
    delete globalThis.__workerDispatch;
    delete globalThis.__workerReleased;
    await db.close();
  }
});
