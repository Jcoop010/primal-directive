import type { Gig, OperationalTask } from "./types.ts";
import { validDay } from "./workspace-intelligence.ts";

export type AdvisorTaskDraft = Pick<OperationalTask, "title" | "description" | "category" | "gigId" | "dueDate">;
const canonical = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();

export function prepareAdvisorTask(draft: AdvisorTaskDraft, tasks: readonly OperationalTask[], gigs: readonly Pick<Gig, "id">[], id: string, now = new Date().toISOString()) {
  const title = draft.title.trim();
  if (!title || title.length > 160) throw new Error("Enter a task title of 1–160 characters.");
  if (draft.description.length > 2000) throw new Error("Keep the task description within 2,000 characters.");
  if (!["booking", "advancing", "promotion", "merch", "finance"].includes(draft.category)) throw new Error("Choose a valid task category.");
  if (draft.dueDate && !validDay(draft.dueDate)) throw new Error("Choose a valid due date or leave it unscheduled.");
  if (draft.gigId && !gigs.some(gig => gig.id === draft.gigId)) throw new Error("This show no longer exists. Choose another show or a general task.");
  const existing = tasks.find(task => canonical(task.title) === canonical(title) && task.gigId === draft.gigId);
  if (existing) return { task: existing, created: false };
  if (tasks.length >= 20000) throw new Error("The workspace task limit has been reached.");
  const task: OperationalTask = { ...draft, title, description: draft.description.trim(), id, status: "open", sourceKey: "advisor:" + JSON.stringify([draft.gigId, canonical(title)]), createdAt: now };
  return { task, created: true };
}
