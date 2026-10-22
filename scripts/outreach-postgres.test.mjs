import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import pg from "pg";
const url = process.env.TEST_DATABASE_URL;
// CI supplies an isolated disposable PostgreSQL database. Never run fixtures on the app database.
if (url) {
  const parsed = new URL(url);
  if (!["localhost", "127.0.0.1"].includes(parsed.hostname) || parsed.pathname !== "/pd_test")
    throw new Error("Tests require local disposable pd_test database");
}
test(
  "real PostgreSQL concurrency, quotas, suppression, revocation and account isolation",
  { skip: !url },
  async () => {
    const pool = new pg.Pool({ connectionString: url, max: 12 });
    try {
      await pool.query("drop schema public cascade; create schema public;");
      for (const name of [
        "0001_auth.sql",
        "0002_app_state.sql",
        "0003_security_hardening.sql",
        "0004_automation_runs.sql",
        "0005_outreach_delivery.sql",
        "0006_billing.sql",
        "0007_mailboxes.sql",
      ])
        await pool.query(readFileSync(new URL("../migrations/" + name, import.meta.url), "utf8"));
      const approve = async (user, id, gig = id, recipient = `${id}@example.com`) => {
        await pool.query(
          "insert into outreach_preferences(user_id,paused) values($1,false) on conflict do nothing",
          [user],
        );
        await pool.query(
          "insert into outreach_approvals(id,user_id,gig_id,recipient,subject,body,message_fingerprint,contact_source_url,policy_version) values($1,$2,$3,$4,'subject','body',$5,'https://example.com','2026-10-22-v1')",
          [id, user, gig, recipient, "a".repeat(64)],
        );
      };
      const reserve = async (user, id, gig = id, recipient = `${id}@example.com`) => {
        const r = await pool.query("select reserve_booking_outreach($1,$2,$3,$4,$5,$6) as result", [
          user,
          gig,
          recipient,
          `${user}:${id}`,
          id,
          "a".repeat(64),
        ]);
        return r.rows[0].result;
      };
      await approve("one", "duplicate");
      assert.deepEqual(
        (await Promise.all([reserve("one", "duplicate"), reserve("one", "duplicate")])).sort(),
        ["duplicate", "reserved"],
      );
      for (let i = 0; i < 8; i++) await approve("quota", `quota${i}`);
      const quota = await Promise.all(
        Array.from({ length: 8 }, (_, i) => reserve("quota", `quota${i}`)),
      );
      assert.equal(quota.filter((r) => r === "reserved").length, 5);
      assert.equal(quota.filter((r) => r === "quota-exceeded").length, 3);
      await approve("two", "foreign");
      assert.equal(await reserve("one", "foreign"), "approval-required");
      await pool.query("update outreach_preferences set paused=true where user_id='two'");
      assert.equal(await reserve("two", "foreign"), "paused");
      await pool.query("update outreach_preferences set paused=false where user_id='two'");
      await pool.query("update outreach_approvals set revoked_at=now() where id='foreign'");
      assert.equal(await reserve("two", "foreign"), "approval-required");
      await approve("three", "suppressed");
      await pool.query(
        "insert into outreach_suppressions(user_id,recipient,reason) values('three','suppressed@example.com','opt-out')",
      );
      assert.equal(await reserve("three", "suppressed"), "suppressed");
      await approve("four", "expired");
      await pool.query(
        "update outreach_approvals set expires_at=now()-interval '1 second' where id='expired'",
      );
      assert.equal(await reserve("four", "expired"), "approval-required");
      await approve("five", "hash");
      const tampered = await pool.query(
        "select reserve_booking_outreach('five','hash','hash@example.com','bad','hash',$1) as result",
        ["b".repeat(64)],
      );
      assert.equal(tampered.rows[0].result, "approval-required");
      await pool.query("update outreach_delivery_audit set status='unknown' where user_id='one'");
      assert.equal(await reserve("one", "duplicate"), "duplicate");
      await approve("daily", "daily-a");
      await approve("daily", "daily-b");
      await pool.query(`insert into outreach_delivery_audit(idempotency_key,user_id,gig_id,recipient,status,created_at)
        select 'daily-seed-'||n,'daily','seed-'||n,'daily-seed@example.com','failed',now()-interval '2 hours' from generate_series(1,19) n`);
      const daily = await Promise.all([reserve("daily", "daily-a"), reserve("daily", "daily-b")]);
      assert.equal(daily.filter((r) => r === "reserved").length, 1);
      assert.equal(daily.filter((r) => r === "quota-exceeded").length, 1);
      for (const id of ["global-a", "global-b", "global-c", "global-d"]) await approve(id, id);
      await pool.query(`insert into outreach_delivery_audit(idempotency_key,user_id,gig_id,recipient,status)
        select 'global-seed-'||n,'global-seed','seed-'||n,'global@example.com','unknown'
        from generate_series(1,(98-(select count(*) from outreach_delivery_audit where created_at>now()-interval '1 hour'))::integer) n`);
      const global = await Promise.all(
        ["global-a", "global-b", "global-c", "global-d"].map((id) => reserve(id, id)),
      );
      assert.equal(global.filter((r) => r === "reserved").length, 2);
      assert.equal(global.filter((r) => r === "quota-exceeded").length, 2);
      // Bind a delivery to a real owned mailbox; a foreign or revoked connection
      // must fail inside the same transaction as the send reservation.
      await pool.query("delete from outreach_delivery_audit where user_id='global-seed'");
      await pool.query(`insert into "user"(id,name,email,"emailVerified") values('mail-a','Mail A','mail-a@example.invalid',true),('mail-b','Mail B','mail-b@example.invalid',true);
       insert into account(id,"userId","providerId","accountId",scope,"updatedAt") values('mail-aa','mail-a','microsoft','provider-aa','Mail.Read Mail.Send',now()),('mail-bb','mail-b','google','provider-bb','https://www.googleapis.com/auth/gmail.send',now());`);
      await approve("mail-a", "mail-approval");
      await pool.query(
        "update outreach_approvals set mailbox_account_id='mail-bb' where id='mail-approval'",
      );
      await assert.rejects(
        () => reserve("mail-a", "mail-approval"),
        /Mailbox authorization unavailable/,
      );
      await pool.query(
        "update outreach_approvals set mailbox_account_id='mail-aa' where id='mail-approval'",
      );
      await pool.query(
        "insert into mailbox_connections(user_id,account_id,enabled) values('mail-a','mail-aa',false)",
      );
      await assert.rejects(
        () => reserve("mail-a", "mail-approval"),
        /Mailbox authorization unavailable/,
      );
      await pool.query("update mailbox_connections set enabled=true where user_id='mail-a'");
      const mailReservations = await Promise.all([
        reserve("mail-a", "mail-approval"),
        reserve("mail-a", "mail-approval"),
      ]);
      assert.deepEqual(mailReservations.sort(), ["duplicate", "reserved"]);
      const bound = await pool.query(
        "select mailbox_account_id,mail_provider from outreach_delivery_audit where user_id='mail-a'",
      );
      assert.deepEqual(bound.rows, [{ mailbox_account_id: "mail-aa", mail_provider: "microsoft" }]);
      await pool.query(
        "drop role if exists pd_browser; create role pd_browser nologin; grant usage on schema public to pd_browser; grant select on outreach_approvals,outreach_delivery_audit to pd_browser",
      );
      const browser = await pool.connect();
      try {
        await browser.query("set role pd_browser");
        assert.equal((await browser.query("select * from outreach_approvals")).rowCount, 0);
        await assert.rejects(
          () =>
            browser.query("select reserve_booking_outreach('one','x','x@example.com','x','x','x')"),
          /permission denied/,
        );
      } finally {
        await browser.query("reset role");
        browser.release();
      }
    } finally {
      await pool.end();
    }
  },
);
