import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
const compile = (s) =>
  "data:text/javascript;base64," +
  Buffer.from(
    ts.transpile(s, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }),
  ).toString("base64");
const zod = pathToFileURL(createRequire(import.meta.url).resolve("zod")).href;
const shim = `const createServerFn=()=>({middleware(){return this},validator(schema){this.schema=schema;return this},handler(fn){const schema=this.schema;return async(args)=>fn({...args,data:schema?schema.parse(args.data):args.data});}});`;
const source = readFileSync(new URL("../src/lib/outreach-scheduling.ts", import.meta.url), "utf8")
  .replace('import { createServerFn } from "@tanstack/react-start";', shim)
  .replace('import { authMiddleware } from "./auth/middleware";', "const authMiddleware={};")
  .replace('import { getSql } from "./db";', "const getSql=async()=>globalThis.__scheduleSql;")
  .replace(
    'import { OUTREACH_POLICY_VERSION } from "./outreach-message";',
    'const OUTREACH_POLICY_VERSION="2026-10-22-v1";',
  )
  .replace('from "zod"', `from "${zod}"`);
const api = await import(compile(source));
test("scheduling persists exact consent, defaults off, prevents cross-account scheduling, cancels on opt-out", async () => {
  const db = new PGlite();
  const wrap = (c) => ({
    query: async (t, p = []) => (await c.query(t, p)).rows,
    transaction: (work) => db.transaction((tx) => work(wrap(tx))),
  });
  globalThis.__scheduleSql = wrap(db);
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
    const id = "11111111-1111-4111-8111-111111111111",
      due = new Date(Date.now() + 86400000).toISOString();
    await db.query(
      "insert into outreach_approvals(id,user_id,gig_id,recipient,subject,body,message_fingerprint,contact_source_url,policy_version) values($1,'artist-a','gig','booker@example.com','Exact subject','Exact body',$2,'https://example.com','2026-10-22-v1')",
      [id, "a".repeat(64)],
    );
    const call = (fn, user, data) => fn({ context: { userId: user }, data });
    await assert.rejects(
      () => call(api.scheduleApprovedOutreach, "artist-a", { id, notBefore: due, consent: true }),
      /Opt in/,
    );
    await call(api.configureOutreachRules, "artist-a", {
      enabled: true,
      consent: true,
      hourly: 2,
      daily: 4,
      followups: 1,
    });
    await call(api.configureOutreachRules, "artist-b", {
      enabled: true,
      consent: true,
      hourly: 2,
      daily: 4,
      followups: 1,
    });
    await assert.rejects(
      () => call(api.scheduleApprovedOutreach, "artist-b", { id, notBefore: due, consent: true }),
      /Fresh approval/,
    );
    const scheduled = await call(api.scheduleApprovedOutreach, "artist-a", {
      id,
      notBefore: due,
      consent: true,
    });
    assert.ok(scheduled.id);
    const status = await call(api.scheduledOutreachStatus, "artist-a");
    assert.equal(status.jobs.length, 1);
    assert.equal(status.jobs[0].status, "scheduled");
    assert.equal((await call(api.scheduledOutreachStatus, "artist-b")).jobs.length, 0);
    const copies = await db.query("select subject,body from outreach_approvals where id<>$1", [id]);
    assert.deepEqual(copies.rows, [{ subject: "Exact subject", body: "Exact body" }]);
    await assert.rejects(
      () => call(api.scheduleApprovedOutreach, "artist-a", { id, notBefore: due, consent: true }),
      /Fresh approval/,
    );
    await call(api.configureOutreachRules, "artist-a", {
      enabled: false,
      consent: true,
      hourly: 2,
      daily: 4,
      followups: 1,
    });
    assert.equal((await call(api.scheduledOutreachStatus, "artist-a")).jobs[0].status, "cancelled");
    assert.equal((await db.query("select * from outreach_delivery_audit")).rows.length, 0);
  } finally {
    delete globalThis.__scheduleSql;
    await db.close();
  }
});
