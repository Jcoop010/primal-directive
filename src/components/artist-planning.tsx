import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Drawer } from '@/components/ui/drawer';
import { AdvisorTaskReview } from '@/components/advisor-task-review';
import { useMusician } from '@/lib/store';
import { useCurrentUserState } from '@/lib/auth/use-current-user';
import { METRIC_LABELS, goalProgress, planProgress, type ArtistGoal, type GoalDraft, type GoalMetric, type SavedMemory, type PlanAction } from '@/lib/artist-planning';

const actionClass = 'min-h-11 rounded-md border border-line px-3 text-sm font-semibold text-accent disabled:opacity-50';
function GoalEditor({ goal, onClose }: { goal?: ArtistGoal; onClose: () => void }) {
  const save = useMusician(state => state.saveGoal);
  const [draft, setDraft] = useState<GoalDraft>(goal ?? { title: '', metric: 'manual', target: 10, reported: 0, deadline: new Date().toISOString().slice(0, 10), nextAction: '' });
  const [error, setError] = useState('');
  return <Drawer open title={goal ? 'Edit goal' : 'Add goal'} onOpenChange={open => { if (!open) onClose(); }}><form className="space-y-3" onSubmit={event => { event.preventDefault(); try { save(draft, goal?.id); toast.success('Goal saved.'); onClose(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save goal.'); } }}>
    <Field label="Goal title"><Input required maxLength={160} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></Field>
    <Field label="Progress measurement"><NativeSelect disabled={Boolean(goal)} value={draft.metric} onChange={event => setDraft({ ...draft, metric: event.target.value as GoalMetric })}>{Object.entries(METRIC_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect></Field>
    <p className="text-xs leading-relaxed text-muted">Recorded measurements count changes since this goal was created. Refunds, reopened tasks or corrected records can reduce progress. For an existing goal, create a new goal to change its measurement.</p>
    <Field label="Target"><Input required type="number" min={draft.metric === 'tasks' || draft.metric === 'shows' ? 1 : 0.01} max={1e9} step={draft.metric === 'tasks' || draft.metric === 'shows' ? 1 : 0.01} value={draft.target} onChange={event => setDraft({ ...draft, target: Number(event.target.value) })} /></Field>
    {draft.metric === 'manual' && <Field label="Reported progress"><Input required type="number" min={0} max={1e9} step="0.01" value={draft.reported} onChange={event => setDraft({ ...draft, reported: Number(event.target.value) })} /></Field>}
    <Field label="Goal deadline"><Input required type="date" value={draft.deadline} onChange={event => setDraft({ ...draft, deadline: event.target.value })} /></Field>
    <Field label="First action"><Textarea required maxLength={500} value={draft.nextAction} onChange={event => setDraft({ ...draft, nextAction: event.target.value })} /></Field>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <div className="flex gap-2"><Button type="button" variant="ghost" className="min-h-11" onClick={onClose}>Cancel</Button><Button type="submit" className="min-h-11">Save goal</Button></div>
  </form></Drawer>;
}
function MemoryEditor({ memory, onClose }: { memory?: SavedMemory; onClose: () => void }) {
  const save = useMusician(state => state.saveMemory);
  const [text, setText] = useState(memory?.text ?? '');
  const [error, setError] = useState('');
  return <Drawer open title="Saved note" onOpenChange={open => { if (!open) onClose(); }}><form className="space-y-3" onSubmit={event => { event.preventDefault(); try { save(text, memory?.id); toast.success('Note saved.'); onClose(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save note.'); } }}>
    <Field label="Memory note"><Textarea required maxLength={1000} value={text} onChange={event => setText(event.target.value)} /></Field>
    <p className="text-xs text-muted">Save a preference, constraint or decision you want the Advisor to use later. You can edit or delete it at any time.</p>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <div className="flex gap-2"><Button type="button" variant="ghost" className="min-h-11" onClick={onClose}>Cancel</Button><Button type="submit" className="min-h-11">Save note</Button></div>
  </form></Drawer>;
}
export function ArtistPlanning({ onExplain, busy }: { onExplain: () => void; busy: boolean }) {
  const { user } = useCurrentUserState();
  return user ? <PlanningWorkspace key={user.id} onExplain={onExplain} busy={busy} /> : null;
}
function PlanningWorkspace({ onExplain, busy }: { onExplain: () => void; busy: boolean }) {
  const planning = useMusician(state => state.planning);
  const tasks = useMusician(state => state.tasks);
  const gigs = useMusician(state => state.gigs);
  const money = useMusician(state => state.money);
  const merchProducts = useMusician(state => state.merchProducts);
  const deleteGoal = useMusician(state => state.deleteGoal);
  const deleteMemory = useMusician(state => state.deleteMemory);
  const setCapacity = useMusician(state => state.setWeeklyCapacity);
  const createPlan = useMusician(state => state.draftWeeklyPlan);
  const deletePlan = useMusician(state => state.deleteWeeklyPlan);
  const [goalEditor, setGoalEditor] = useState<ArtistGoal | 'new' | null>(null);
  const [memoryEditor, setMemoryEditor] = useState<SavedMemory | 'new' | null>(null);
  const [review, setReview] = useState<{ planId: string; action: PlanAction } | null>(null);
  const [capacity, setCapacityDraft] = useState(String(planning.capacityMinutes));
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');
  const workspace = { tasks, gigs, money, merchProducts };
  function run(action: () => void) { try { action(); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update planning.'); } }
  return <details className="my-3 rounded-lg border border-line bg-surface">
    <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold">Goals & weekly plan · {planning.goals.length} goals · {planning.memories.length} saved notes</summary>
    <div className="space-y-5 border-t border-line p-4">
      <section aria-label="Saved goals" className="space-y-3">
        <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Saved goals</h2><button type="button" className={actionClass} onClick={() => setGoalEditor('new')}>Add goal</button></div>
        {!planning.goals.length && <p className="text-sm text-muted">Set a measurable goal and its first action to give your weekly plan direction.</p>}
        {planning.goals.map(goal => { const progress = goalProgress(goal, workspace); return <article key={goal.id} className="space-y-2 rounded-md border border-line p-3"><h3 className="font-semibold">{goal.title}</h3><p className="text-sm">{progress.current} / {goal.target} · {progress.percent}% · {progress.reached ? 'Target reached' : `Due ${goal.deadline}`}</p><p className="text-xs text-muted">{progress.source} · {METRIC_LABELS[goal.metric]}</p><p className="text-sm text-soft">First action: {goal.nextAction}</p><div className="flex flex-wrap gap-2"><button className={actionClass} type="button" onClick={() => setGoalEditor(goal)}>Edit goal</button><button className={actionClass} type="button" onClick={() => { if (window.confirm('Delete this goal? Tasks already created from it will stay in Tasks.')) deleteGoal(goal.id); }}>Delete goal</button></div></article>; })}
      </section>
      <section aria-label="Saved memory" className="space-y-3"><div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Saved memory</h2><button className={actionClass} type="button" onClick={() => setMemoryEditor('new')}>Add saved note</button></div><p className="text-xs leading-relaxed text-muted">Only notes you save here are added as saved memory. The Advisor also uses your saved profile, goals, plans and recent conversation. Deleting a note removes it from future saved-memory context; past chat messages are still visible until you clear the thread.</p>
        {planning.memories.map(memory => <article key={memory.id} className="rounded-md border border-line p-3"><p className="whitespace-pre-wrap break-words text-sm">{memory.text}</p><div className="mt-2 flex gap-2"><button className={actionClass} type="button" onClick={() => setMemoryEditor(memory)}>Edit note</button><button className={actionClass} type="button" onClick={() => deleteMemory(memory.id)}>Delete note</button></div></article>)}
      </section>
      <section aria-label="Weekly planning" className="space-y-3"><h2 className="font-semibold">Weekly planning</h2><p className="text-xs leading-relaxed text-muted">Drafts prioritize existing due tasks, active goals and recorded workspace issues. Allow 30 minutes per action initially; edit estimates when reviewing. These are internal plans, not messages, purchases or external bookings.</p>
        <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); run(() => { setCapacity(Number(capacity)); toast.success('Weekly capacity saved.'); }); }}><Field label="Available minutes per week"><Input required type="number" min={15} max={2400} value={capacity} onChange={event => setCapacityDraft(event.target.value)} /></Field><Button type="submit" variant="ghost" className="min-h-11">Save capacity</Button></form>
        <Field label="Plan week containing"><Input required type="date" value={day} onChange={event => setDay(event.target.value)} /></Field>
        <div className="flex flex-wrap gap-2"><Button type="button" className="min-h-11" onClick={() => run(() => { setCapacity(Number(capacity)); createPlan(day); toast.success('Weekly draft saved. Review actions before adding tasks.'); })}>Draft weekly plan</Button><Button type="button" variant="ghost" disabled={busy || planning.plans.length === 0} className="min-h-11" onClick={onExplain}>Explain plan with Gemini</Button></div>
        {planning.plans.map(plan => { const progress = planProgress(plan, tasks); return <article key={plan.id} className="space-y-3 rounded-md border border-line p-3"><h3 className="font-semibold">Week of {plan.start}</h3><p className="text-sm">{progress.completed} / {progress.total} actions complete · {progress.accepted} linked tasks · {plan.actions.reduce((sum, action) => sum + action.minutes, 0)} / {plan.capacityMinutes} minutes estimated</p><p className="text-xs text-muted">Workspace draft · {plan.start} through {plan.end} · Estimates are not measured work.</p>
          <ol className="space-y-3">{plan.actions.map(action => { const task = tasks.find(item => item.id === action.taskId); const goal = planning.goals.find(item => item.id === action.goalId); return <li key={action.id} className="border-t border-line pt-3"><strong className="text-sm">{task?.title ?? action.title}</strong><p className="mt-1 text-xs leading-relaxed text-muted">{action.description}</p>{goal && <p className="mt-1 text-xs text-soft">Goal: {goal.title}</p>}<p className="mt-1 text-xs text-muted">{action.minutes} estimated minutes · {task ? task.status === 'done' ? 'Completed' : `Task saved · ${task.dueDate || 'unscheduled'}` : 'Draft — not added to Tasks'}</p>{task ? <Link className={actionClass + ' mt-2 inline-flex items-center'} to="/tasks">Open Tasks</Link> : <button type="button" className={actionClass + ' mt-2'} onClick={() => setReview({ planId: plan.id, action })}>Review plan action</button>}</li>; })}</ol><button type="button" className={actionClass} onClick={() => { if (window.confirm('Delete this plan only? Linked tasks will stay in Tasks.')) deletePlan(plan.id); }}>Delete plan only</button></article>; })}
      </section>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
    {goalEditor && <GoalEditor key={goalEditor === 'new' ? 'new' : goalEditor.id} goal={goalEditor === 'new' ? undefined : goalEditor} onClose={() => setGoalEditor(null)} />}
    {memoryEditor && <MemoryEditor key={memoryEditor === 'new' ? 'new' : memoryEditor.id} memory={memoryEditor === 'new' ? undefined : memoryEditor} onClose={() => setMemoryEditor(null)} />}
    {review && <AdvisorTaskReview key={review.action.id} suggestion={review.action.title} planReview={review} onClose={() => setReview(null)} />}
  </details>;
}
