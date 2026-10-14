import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

test("real workspace SQL preserves saves, isolates accounts and rejects stale versions", async () => {
  const db = new PGlite();
  await db.exec("CREATE TABLE app_state (user_id text PRIMARY KEY, state jsonb NOT NULL, version integer NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())");
  const key = Symbol.for("primal-persistence-release-test");
  globalThis[key] = { userId: "account-a", sql: { query: async (text, params) => (await db.query(text, params)).rows } };
  const framework = `export function createServerFn() {let schema; return {
    middleware(m) {if(!m.length) throw Error('Missing auth');return this;},
    validator(v) {schema=v;return this;},
    handler(fn) {return data => fn({data:schema.parse(data),context:{userId:globalThis[Symbol.for('primal-persistence-release-test')].userId}});}
  };}`;
  const require = createRequire(import.meta.url);
  let source = ts.transpileModule(readFileSync(new URL("../src/lib/persistence.ts", import.meta.url), "utf8"), {
    compilerOptions: {module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
  }).outputText;
  assert.equal((source.match(/\.middleware\(\[authMiddleware\]\)/g)??[]).length,2);
  source = source.replace('"@tanstack/react-start"',JSON.stringify(`data:text/javascript,${encodeURIComponent(framework)}`))
    .replace('"@/lib/auth/middleware"',JSON.stringify('data:text/javascript,export const authMiddleware = {};'))
    .replace('"@/lib/db"',JSON.stringify("data:text/javascript,export async function getSql(){return globalThis[Symbol.for('primal-persistence-release-test')].sql;}"))
    .replace('"zod"',JSON.stringify(pathToFileURL(require.resolve("zod")).href))
    .replace(/"@\/lib\/([^"]+)"/g,(_,name)=>JSON.stringify(new URL(`../src/lib/${name}.ts`,import.meta.url).href));
  try {
    const {saveAppState,loadAppState}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    const state={gigs:[],people:[],money:[],chat:[{id:'q1',role:'user',text:'Preserve this during AI failure'}],profile:{artistName:'Account A',city:'',genre:'',draw:'',feeTarget:0,notes:''}};
    assert.deepEqual(await loadAppState({}),{state:null,version:0});
    assert.equal((await saveAppState({state,expectedVersion:0})).version,1);
    assert.equal((await loadAppState({})).state.chat[0].text,state.chat[0].text);
    await assert.rejects(saveAppState({state,expectedVersion:0}),/another session/);
    globalThis[key].userId='account-b';
    assert.deepEqual(await loadAppState({}),{state:null,version:0});
    await assert.rejects(saveAppState({state,expectedVersion:1}),/another session/);
    await saveAppState({state:{...state,profile:{...state.profile,artistName:'Account B'}},expectedVersion:0});
    globalThis[key].userId='account-a';
    assert.equal((await loadAppState({})).state.profile.artistName,'Account A');
    await saveAppState({state:{...state,chat:[...state.chat,{id:'a1',role:'ai',text:'Local fallback',source:'LOCAL WORKSPACE FALLBACK'}]},expectedVersion:1});
    assert.equal((await loadAppState({})).state.chat.length,2);
    await assert.rejects(saveAppState({state,expectedVersion:1}),/another session/);
    assert.equal((await loadAppState({})).version,2);
    // UTF-8 multibyte input can exceed 2 MB even when JS .length is lower.
    // Oversize rejects must not overwrite or increment an existing save.
    const oversizedNotes = "🎵".repeat(550_000);
    assert.ok(oversizedNotes.length < 2_000_000);
    assert.ok(new TextEncoder().encode(oversizedNotes).byteLength > 2_000_000);
    await assert.rejects(
      saveAppState({
        state: { ...state, profile: { ...state.profile, notes: oversizedNotes } },
        expectedVersion: 2,
      }),
      /2 MB safety limit/,
    );
    assert.equal((await loadAppState({})).version, 2);
    assert.equal((await loadAppState({})).state.profile.notes, "");
    // A corrupt DB version must never masquerade as a fresh version 1.
    await db.query("update app_state set version = 0 where user_id = $1", ["account-a"]);
    await assert.rejects(loadAppState({}), /Stored workspace version is invalid/);
    await db.query("update app_state set version = 2 where user_id = $1", ["account-a"]);
    assert.equal((await loadAppState({})).version, 2);
    // Two clients starting from the same revision cannot both commit.
    // The losing save must not overwrite the winner or affect another account.
    const changes = [
      saveAppState({state:{...state,profile:{...state.profile,artistName:'Tab one'}},expectedVersion:2}),
      saveAppState({state:{...state,profile:{...state.profile,artistName:'Tab two'}},expectedVersion:2}),
    ];
    const outcomes = await Promise.allSettled(changes);
    assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter(x => x.status === 'rejected').length, 1);
    assert.match(String(outcomes.find(x => x.status === 'rejected').reason), /another session/);
    const afterRace = await loadAppState({});
    assert.equal(afterRace.version, 3);
    assert.ok(['Tab one','Tab two'].includes(afterRace.state.profile.artistName));
    globalThis[key].userId='account-b';
    const otherAccount = await loadAppState({});
    assert.equal(otherAccount.version, 1);
    assert.equal(otherAccount.state.profile.artistName, 'Account B');
  } finally {delete globalThis[key];await db.close();}
});
