import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import { prepareAdvisorTask } from "../src/lib/advisor-tasks.ts";
import { emptyPlanning, saveGoal, saveMemory } from '../src/lib/artist-planning.ts';

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
    state.tasks = [prepareAdvisorTask({title:'Reviewed task',description:'Approved by account A',category:'finance',gigId:'',dueDate:''},[],[],'reviewed-task').task];
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
    assert.equal((await loadAppState({})).state.tasks[0].title,'Reviewed task');
    await saveAppState({state:{...state,chat:[...state.chat,{id:'a1',role:'ai',text:'Local fallback',source:'LOCAL WORKSPACE FALLBACK'}]},expectedVersion:1});
    assert.equal((await loadAppState({})).state.chat.length,2);
    await assert.rejects(saveAppState({state,expectedVersion:1}),/another session/);
    assert.equal((await loadAppState({})).version,2);
    const workspace={gigs:[],money:[],tasks:[],merchProducts:[]};
    const planning=saveMemory(saveGoal(emptyPlanning(),{title:'Keep this saved goal',metric:'manual',target:10,reported:2,deadline:'2026-12-01',nextAction:'Review the saved weekly goal'},workspace,'goal-a'),'Keep this approved memory','memory-a');
    await saveAppState({state:{...state,planning},expectedVersion:2});
    assert.equal((await loadAppState({})).state.planning.goals[0].reported,2);
    await saveAppState({state,expectedVersion:3});
    assert.equal((await loadAppState({})).state.planning.memories[0].text,'Keep this approved memory');
    globalThis[key].userId='account-b';
    assert.equal((await loadAppState({})).state.planning,undefined);
    globalThis[key].userId='account-a';
    await assert.rejects(saveAppState({state:{...state,chat:[{id:'large',role:'user',text:'💥'.repeat(510000)}]},expectedVersion:4}),/2 MB/);
    await saveAppState({state:{...state,planning:emptyPlanning()},expectedVersion:4});
    assert.deepEqual((await loadAppState({})).state.planning.memories,[]);
    assert.deepEqual((await loadAppState({})).state.planning.goals,[]);
  } finally {delete globalThis[key];await db.close();}
});
