import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeWorkspace, intelligenceContext, intelligenceWorkspace, validDay } from '../src/lib/workspace-intelligence.ts';
const empty = () => ({ gigs: [], money: [], merchProducts: [], tasks: [] });
const gig = (id, extra = {}) => ({ id, name: id, date: '2026-11-01', fee: 100, conf: .5, status: 'lead', ...extra });
const task = (id, extra = {}) => ({ id, title: id, dueDate: '', status: 'open', gigId: '', createdAt: '2026-10-15T00:00:00Z', ...extra });

test('full ledger uses cents, separates outstanding and payouts, and includes unlinked records', () => {
  const workspace = empty();
  workspace.gigs = [gig('a')];
  workspace.money = Array.from({length: 25}, (_, i) => ({id: String(i), type: 'collected', amount: .1, gigId: 'a'}));
  workspace.money.push({id: 'refund', type: 'collected', amount: -.2}, {id: 'unpaid', type: 'outstanding', amount: 1000, gigId: 'a'}, {id: 'cost', type: 'cost', amount: 1.05, gigId: 'a'}, {id: 'pay', type: 'payout', amount: .5, gigId: 'missing'});
  const before = structuredClone(workspace);
  const brief = analyzeWorkspace(workspace, '2026-10-15');
  assert.deepEqual(brief.ledgerCents, {collected:230,outstanding:100000,cost:105,payout:50,operatingDifference:125,afterPayouts:75});
  assert.equal(brief.counts.unlinkedEntries, 1);
  assert.equal(brief.counts.orphanedEntries, 1);
  assert.equal(brief.recordedShows[0].difference, 145);
  assert.deepEqual(workspace, before);
  assert.match(intelligenceContext(workspace, '2026-10-15'), /"afterPayouts":"0.75"/);
});

test('opportunities rank confidence-weighted fee without treating it as profit or confirmed income', () => {
  const workspace = empty();
  workspace.gigs = [gig('high-fee', {fee:1000,conf:.1}), gig('likely', {fee:500,conf:.8}), gig('past',{date:'2026-01-01',fee:9999}), gig('booked',{status:'booked',fee:900}), gig('cancelled',{status:'cancelled',fee:9000})];
  const brief = analyzeWorkspace(workspace, '2026-10-15');
  assert.deepEqual(brief.opportunities.map(g => g.id), ['likely','high-fee']);
  assert.equal(brief.opportunities[0].weightedFeeCents,40000);
  assert.equal(brief.bookedListedFeesCents,90000);
  assert.equal(brief.ledgerCents.collected,0);
  assert.match(brief.priorities[0].detail,/not net profit/);
});

test('completed and unscheduled tasks are not overdue; real calendar dates are required', () => {
  const workspace = empty();
  workspace.tasks = [task('unscheduled'),task('done',{dueDate:'2026-01-01',status:'done'}),task('late',{dueDate:'2026-10-14'}),task('today',{dueDate:'2026-10-15'}),task('invalid',{dueDate:'2026-02-30'})];
  const brief = analyzeWorkspace(workspace,'2026-10-15');
  assert.equal(brief.counts.overdueTasks,1);
  assert.equal(brief.counts.completedTasks,1);
  assert.deepEqual(brief.completedTaskExamples,['done']);
  assert.equal(brief.existingOpenTasks[0],'late');
  assert.equal(validDay('2026-02-30'),false);
  assert.equal(validDay('2028-02-29'),true);
  assert.throws(() => analyzeWorkspace(workspace,'bad'),/valid analysis date/);
});

test('active merchandise margins handle zero prices and flag loss before restocking', () => {
  const workspace = empty();
  const product = (id, extra={}) => ({id,name:id,price:20,unitCost:8,stockOnHand:0,reorderAt:2,active:true,...extra});
  workspace.merchProducts = [product('shirt'),product('loss',{price:0}),product('inactive',{active:false})];
  const brief = analyzeWorkspace(workspace,'2026-10-15');
  assert.equal(brief.counts.lowStockItems,2);
  assert.equal(brief.unitMargins.find(p => p.id === 'shirt').marginPercent,60);
  assert.equal(brief.unitMargins.find(p => p.id === 'loss').marginPercent,null);
  assert.match(brief.priorities[0].title,/below unit cost/);
  assert.match(brief.priorities[1].detail,/1 active item/);
});

test('provider snapshot excludes private notes and unnecessary fields', () => {
  const workspace = {...empty(),gigs:[{...gig('a'),notes:'private',venue:'venue'}],profile:{notes:'private'}};
  const snapshot = intelligenceWorkspace(workspace);
  assert.equal(snapshot.gigs[0].notes,undefined);
  assert.equal(snapshot.profile,undefined);
  assert.equal(snapshot.gigs.length,1);
});
