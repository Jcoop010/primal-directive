import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
test("versioned outreach migration installs without request-time DDL and defaults to paused", async () => {
  const db = new PGlite();
  try {
    await db.exec("create table automation_runs(id text);");
    await db.exec(
      readFileSync(new URL("../migrations/0005_outreach_delivery.sql", import.meta.url), "utf8"),
    );
    const result = await db.query(
      "select reserve_booking_outreach('u','g','test@example.com','k','a',$1) as result",
      ["a".repeat(64)],
    );
    assert.equal(result.rows[0].result, "paused");
    const ledger = readFileSync(
      new URL("../src/lib/outreach-delivery-ledger.ts", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(ledger, /CREATE TABLE/i);
  } finally {
    await db.close();
  }
});
