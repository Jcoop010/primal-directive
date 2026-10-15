import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyPlanning,saveGoal,saveMemory,metricValue,goalProgress,weekRange,draftWeeklyPlan,acceptPlanAction,planProgress,planningContext,localPlanningSummary} from '../src/lib/artist-planning.ts';
const workspace=()=>({gigs:[],money:[],tasks:[],merchProducts:[]});
const goal=(extra={})=>({title:'Grow our audience',metric:'manual',target:12,reported:0,deadline:'2026-10-25',nextAction:'Prepare approved signup invitation',...extra});
test('recorded goals capture a baseline and handle cents, refunds and corrected records',()=>{
 const w=workspace(); w.money=[{id:'old',type:'collected',amount:100.01}];
 const p=saveGoal(emptyPlanning(),goal({metric:'collected',target:10}),w,'g');
 assert.equal(goalProgress(p.goals[0],w).current,0);
 w.money.push({id:'new',type:'collected',amount:10.1},{id:'unpaid',type:'outstanding',amount:900});
 assert.equal(goalProgress(p.goals[0],w).current,10.1);
 assert.equal(goalProgress(p.goals[0],w).reached,true);
 w.money.push({id:'refund',type:'collected',amount:-20});
 assert.equal(goalProgress(p.goals[0],w).current,-9.9);
 assert.equal(goalProgress(p.goals[0],w).percent,0);
});
test('goal edits preserve the baseline; reported progress is explicitly distinguished',()=>{
 const w=workspace(); let p=saveGoal(emptyPlanning(),goal({reported:3}),w,'g');
 assert.equal(goalProgress(p.goals[0],w).source,'User-reported');
 assert.equal(goalProgress(p.goals[0],w).percent,25);
 p=saveGoal(p,goal({reported:6,target:24}),w,'g');
 assert.equal(p.goals.length,1);
 assert.equal(goalProgress(p.goals[0],w).percent,25);
 assert.throws(()=>saveGoal(p,goal({metric:'tasks'}),w,'g'),/measurement/);
 for(const patch of [{deadline:'2026-02-30'},{target:0},{target:NaN},{reported:-1},{metric:'shows',target:1.5},{nextAction:' ' }]) assert.throws(()=>saveGoal(emptyPlanning(),goal(patch),w,'x'));
});
test('week boundaries are deterministic across year and leap-day boundaries',()=>{
 assert.deepEqual(weekRange('2027-01-01'),{start:'2026-12-28',end:'2027-01-03'});
 assert.deepEqual(weekRange('2028-02-29'),{start:'2028-02-28',end:'2028-03-05'});
 assert.throws(()=>weekRange('2026-02-30'));
});
test('drafts respect capacity, preserve workspace, avoid completed actions and prioritize due tasks',()=>{
 const w=workspace(); w.tasks=[{id:'due',title:'Resolve overdue advancing',dueDate:'2026-10-10',status:'open',gigId:'',createdAt:'2026-10-01'}];
 const p={...saveGoal(emptyPlanning(),goal(),w,'g'),capacityMinutes:45};
 const before=structuredClone({p,w});
 const drafted=draftWeeklyPlan(p,w,'2026-10-15','week');
 assert.equal(drafted.plans[0].actions.length,2);
 assert.equal(drafted.plans[0].actions[0].taskId,'due');
 assert.equal(drafted.plans[0].actions[1].minutes,15);
 assert.equal(drafted.plans[0].actions[1].goalId,'g');
 assert.deepEqual({p,w},before);
 assert.throws(()=>draftWeeklyPlan(drafted,w,'2026-10-16','second'),/already has a plan/);
 const done={...w,tasks:[{...w.tasks[0],title:goal().nextAction,status:'done'}]};
 assert.throws(()=>draftWeeklyPlan(p,done,'2026-10-15','week'),/Add an active goal/);
});
test('reviewed actions create tasks only on acceptance and remain idempotent',()=>{
 const w=workspace(); const p=draftWeeklyPlan(saveGoal(emptyPlanning(),goal(),w,'g'),w,'2026-10-15','week');
 const action=p.plans[0].actions[0];
 assert.equal(w.tasks.length,0);
 assert.deepEqual(planProgress(p.plans[0],w.tasks),{accepted:0,completed:0,total:1,percent:0});
 const accepted=acceptPlanAction(p,w.tasks,[],'week',action.id,{...action,title:'Approved custom action'},'t');
 assert.equal(accepted.created,true);assert.equal(accepted.tasks[0].title,'Approved custom action');
 const again=acceptPlanAction(accepted.planning,accepted.tasks,[],'week',action.id,action,'duplicate');
 assert.equal(again.created,false);assert.equal(again.tasks.length,1);
 const completed=[{...again.tasks[0],status:'done'}];
 assert.equal(planProgress(again.planning.plans[0],completed).percent,100);
 assert.equal(planProgress(again.planning.plans[0],[{...completed[0],status:'open'}]).percent,0);
 assert.equal(planProgress(again.planning.plans[0],[]).completed,0);
});
test('acceptance enforces dates, time budget, stale shows and completed-task duplicate protection',()=>{
 const w=workspace(); const p=draftWeeklyPlan({...saveGoal(emptyPlanning(),goal(),w,'g'),capacityMinutes:30},w,'2026-10-15','week');const a=p.plans[0].actions[0];
 for(const [patch,pattern] of [[{minutes:31},/capacity/],[{minutes:0},/15/],[{dueDate:'2026-10-25'},/end of this plan/],[{gigId:'missing'},/no longer exists/]]) assert.throws(()=>acceptPlanAction(p,[],[],'week',a.id,{...a,...patch},'t'),pattern);
 const accepted=acceptPlanAction(p,[],[],'week',a.id,a,'t');
 const duplicate=acceptPlanAction(p,[{...accepted.tasks[0],status:'done'}],[],'week',a.id,{...a,title:'  PREPARE approved signup invitation '},'other');
 assert.equal(duplicate.created,false);assert.equal(duplicate.tasks[0].status,'done');
 assert.equal(planProgress(duplicate.planning.plans[0],duplicate.tasks).completed,1);
});
test('saved notes are explicit editable records and deleted notes stay out of future memory context',()=>{
 let p=saveMemory(emptyPlanning(),'No weekday travel','n');p=saveMemory(p,'Only weekend travel','n');
 assert.equal(p.memories.length,1);assert.match(planningContext(p,workspace()),/Only weekend travel/);
 p={...p,memories:p.memories.filter(m=>m.id!=='n')};
 assert.doesNotMatch(planningContext(p,workspace()),/Only weekend travel/);
 assert.throws(()=>saveMemory(p,' '.repeat(3),'n'));
});
test('show and task measurements respond to status transitions without inflating existing baselines',()=>{
 const w=workspace();w.gigs=[{id:'old',status:'completed'},{id:'lead',status:'lead'}];w.tasks=[{id:'old',status:'done'},{id:'open',status:'open'}];
 assert.equal(metricValue('shows',w),1);assert.equal(metricValue('tasks',w),1);
 const p=saveGoal(emptyPlanning(),goal({metric:'tasks',target:1}),w,'g');
 w.tasks[1].status='done';assert.equal(goalProgress(p.goals[0],w).current,1);
 w.tasks[1].status='open';assert.equal(goalProgress(p.goals[0],w).current,0);
});
test('planning fallback recalls explicit saved facts and avoids completed actions without an AI call',()=>{
 const w=workspace();let p=saveMemory(saveGoal(emptyPlanning(),goal({reported:3}),w,'g'),'Planning code CEDAR-48','note');
 p=draftWeeklyPlan(p,w,'2026-10-15','week');const action=p.plans[0].actions[0];const accepted=acceptPlanAction(p,[],[],'week',action.id,action,'t');
 const summary=localPlanningSummary(accepted.planning,{...w,tasks:[{...accepted.tasks[0],status:'done'}]});
 assert.match(summary.answer,/CEDAR-48/);assert.match(summary.answer,/3 \/ 12/);assert.match(summary.answer,/1 \/ 1 actions complete/);assert.match(summary.answer,/without an AI answer/);assert.deepEqual(summary.moves,[]);
});
