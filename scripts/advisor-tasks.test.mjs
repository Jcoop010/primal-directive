import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareAdvisorTask } from '../src/lib/advisor-tasks.ts';
const draft = {title:'Review merch pricing',description:'Check costs first',category:'merch',gigId:'',dueDate:''};
test('reviewed task is open, unscheduled and prepared without mutating workspace', () => {
  const tasks = [];
  const result = prepareAdvisorTask(draft,tasks,[],'new','2026-10-15T00:00:00Z');
  assert.equal(result.created,true);
  assert.equal(result.task.status,'open');
  assert.equal(result.task.dueDate,'');
  assert.equal(result.task.id,'new');
  assert.match(result.task.sourceKey,/^advisor:/);
  assert.deepEqual(tasks,[]);
  assert.equal(draft.title,'Review merch pricing');
});
test('duplicate protection includes completed tasks and normalizes whitespace, case and Unicode', () => {
  const existing = {...prepareAdvisorTask(draft,[],[],'original').task,status:'done'};
  const result = prepareAdvisorTask({...draft,title:'  ＲＥＶＩＥＷ   MERCH pricing  '},[existing],[],'duplicate');
  assert.equal(result.created,false);
  assert.equal(result.task.id,'original');
  assert.equal(result.task.status,'done');
  assert.equal(prepareAdvisorTask({...draft,gigId:'other'},[existing],[{id:'other'}],'new').created,true);
});
test('rejects invalid date, stale show, blank title, overlong details and exhausted task capacity', () => {
  for (const [patch,pattern] of [[{title:' '},/title/],[{title:'x'.repeat(161)},/title/],[{description:'x'.repeat(2001)},/description/],[{dueDate:'2026-02-30'},/due date/],[{gigId:'deleted'},/no longer exists/],[{category:'payments'},/category/]]) {
    assert.throws(() => prepareAdvisorTask({...draft,...patch},[],[],'new'),pattern);
  }
  const tasks = Array.from({length:20000},(_,i)=>({title:String(i),gigId:''}));
  assert.throws(() => prepareAdvisorTask(draft,tasks,[],'new'),/limit/);
  assert.equal(prepareAdvisorTask({...draft,title:'0'},tasks,[],'new').created,false);
});
