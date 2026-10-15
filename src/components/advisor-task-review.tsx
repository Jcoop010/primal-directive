import { useState } from "react";
import { toast } from "sonner";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { useMusician } from "@/lib/store";
import type { AdvisorTaskDraft } from "@/lib/advisor-tasks";

export function AdvisorTaskReview({ suggestion, onClose }: { suggestion: string; onClose: () => void }) {
  const gigs = useMusician(state => state.gigs);
  const addTask = useMusician(state => state.addAdvisorTask);
  const [draft, setDraft] = useState<AdvisorTaskDraft>({ title: suggestion.trim().slice(0, 160), description: suggestion.slice(0, 2000), category: "promotion", gigId: "", dueDate: "" });
  const [error, setError] = useState("");
  return (
    <Drawer open onOpenChange={open => { if (!open) onClose(); }} title="Review suggested task">
      <p className="mb-4 text-sm leading-relaxed text-muted">Review the wording, category and date before adding this to Tasks. This only creates an internal task.</p>
      <form className="space-y-3" onSubmit={event => {
        event.preventDefault();
        setError("");
        try {
          const result = addTask(draft);
          toast[result.created ? "success" : "info"](result.created ? "Task added to your workspace." : "This task already exists. Check Tasks, including completed tasks.");
          onClose();
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add this task."); }
      }}>
        <Field label="Task title"><Input required maxLength={160} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></Field>
        <Field label="Task details"><Textarea maxLength={2000} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} /></Field>
        <Field label="Category"><NativeSelect value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value as AdvisorTaskDraft["category"] })}><option value="promotion">Promotion</option><option value="booking">Booking</option><option value="advancing">Show advancing</option><option value="merch">Merchandise</option><option value="finance">Finance</option></NativeSelect></Field>
        <Field label="Linked show"><NativeSelect value={draft.gigId} onChange={event => setDraft({ ...draft, gigId: event.target.value })}><option value="">General task</option>{gigs.map(gig => <option key={gig.id} value={gig.id}>{gig.name || gig.venue}</option>)}</NativeSelect></Field>
        <Field label="Due date (optional)"><Input type="date" value={draft.dueDate} onChange={event => setDraft({ ...draft, dueDate: event.target.value })} /></Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2"><Button type="button" variant="ghost" className="min-h-11 flex-1" onClick={onClose}>Cancel</Button><Button type="submit" className="min-h-11 flex-1">Add task</Button></div>
      </form>
    </Drawer>
  );
}
