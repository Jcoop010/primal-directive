import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// Database-level acceptance of the same user-scoped SQL and optimistic locking
// employed by loadAppState/saveAppState. No production credentials or writes.
test("two users persist independently and stale writes cannot overwrite data", async () => {
  const db = new PGlite();
  try {
    await db.exec("create table app_state (user_id text primary key, state jsonb not null, version integer not null, updated_at timestamp not null default current_timestamp)");
    const save = async (userId, state, expectedVersion) => {
      const serialized = JSON.stringify(state);
      const rows = expectedVersion === 0
        ? await db.query(`insert into app_state (user_id, state, version, updated_at) values ($1, $2::jsonb, 1, current_timestamp) on conflict (user_id) do nothing returning version`, [userId, serialized])
        : await db.query(`update app_state set state = $2::jsonb, version = version + 1, updated_at = current_timestamp where user_id = $1 and version = $3 returning version`, [userId, serialized, expectedVersion]);
      if (!rows.rows.length) throw new Error("Workspace changed in another session.");
      return Number(rows.rows[0].version);
    };
    const load = async (userId) => {
      const rows = await db.query("select state, version from app_state where user_id = $1", [userId]);
      return rows.rows[0] ?? { state: null, version: 0 };
    };
    const alice = { gigs: [{ id: "a-gig", venue: "Alice Venue" }], people: [], money: [{ id: "a-expense", amount: 50 }], tasks: [{ id: "a-task" }] };
    const bob = { gigs: [{ id: "b-gig", venue: "Bob Venue" }], people: [{ id: "b-contact" }], money: [], tasks: [] };
    assert.equal(await save("alice", alice, 0), 1);
    assert.equal(await save("bob", bob, 0), 1);
    assert.deepEqual((await load("alice")).state, alice);
    assert.deepEqual((await load("bob")).state, bob);
    await assert.rejects(save("alice", bob, 0), /Workspace changed/);
    const revised = { ...alice, gigs: [...alice.gigs, { id: "a-gig-2" }] };
    assert.equal(await save("alice", revised, 1), 2);
    await assert.rejects(save("alice", bob, 1), /Workspace changed/);
    assert.deepEqual((await load("alice")).state, revised);
    assert.deepEqual((await load("bob")).state, bob);
    assert.deepEqual(await load("unknown"), { state: null, version: 0 });
  } finally {
    await db.close();
  }
});
