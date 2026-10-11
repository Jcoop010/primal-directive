import type { Gig, OperationalTask } from "./types.ts";
import { addDays, toIsoDay } from "./format.ts";

type TaskTemplate = {
  key: string;
  daysBefore: number;
  title: string;
  description: string;
  category: OperationalTask["category"];
};

const TEMPLATES: readonly TaskTemplate[] = [
  { key: "contract", daysBefore: 30, title: "Confirm deal terms and payment deadlines", description: "Verify guarantee or door split, deposit, balance due, cancellation terms, and who owes what. Flag any unsigned agreement for human review.", category: "booking" },
  { key: "advance", daysBefore: 14, title: "Advance the show with the venue", description: "Confirm set times, load-in, soundcheck, backline, stage plot, hospitality, parking, contacts, and production requirements.", category: "advancing" },
  { key: "promo", daysBefore: 14, title: "Prepare and approve show promotion", description: "Gather the correct event link, approved artwork, ticket link, and copy. Draft assets for review before anything is published.", category: "promotion" },
  { key: "merch", daysBefore: 7, title: "Build the show-specific merch pack", description: "Review available stock, select sizes and quantities, check low-stock items, and record what leaves inventory for the show.", category: "merch" },
  { key: "run-sheet", daysBefore: 2, title: "Finalize the show-day run sheet", description: "Put venue address, contacts, arrival/load-in, set times, travel plan, gear, and outstanding questions in one shareable run sheet.", category: "advancing" },
  { key: "reconcile", daysBefore: -1, title: "Reconcile show income, costs, and merch", description: "Record actual guarantee/door income, expenses, merch sales and remaining stock. Follow up on balances due and review actual show profit.", category: "finance" },
];

export function buildShowTaskPack(gig: Gig, existing: readonly OperationalTask[], now = new Date()): Omit<OperationalTask, "id">[] {
  if (!gig.id.trim()) throw new Error("A saved gig ID is required to generate its task pack.");
  if (gig.status !== "booked" && gig.status !== "completed") return [];
  const showDate = /^\d{4}-\d{2}-\d{2}$/.test(gig.date) ? new Date(Number(gig.date.slice(0, 4)), Number(gig.date.slice(5, 7)) - 1, Number(gig.date.slice(8, 10))) : null;
  if (!showDate || !Number.isFinite(showDate.getTime())) return [];
  const existingKeys = new Set(existing.map((task) => task.sourceKey));
  return TEMPLATES.filter((template) => !existingKeys.has(`show:${gig.id}:${template.key}:v1`)).map((template) => ({
    title: `${gig.venue || gig.name}: ${template.title}`,
    description: template.description,
    category: template.category,
    gigId: gig.id,
    dueDate: toIsoDay(addDays(showDate, -template.daysBefore)),
    status: "open" as const,
    sourceKey: `show:${gig.id}:${template.key}:v1`,
    createdAt: now.toISOString(),
  }));
}

export function generateShowTaskPacks(gigs: readonly Gig[], existing: readonly OperationalTask[], now = new Date()) {
  const created: Omit<OperationalTask, "id">[] = [];
  for (const gig of gigs) {
    const combined = [...existing, ...created.map((task, index) => ({ ...task, id: `generated-${index}` }))];
    created.push(...buildShowTaskPack(gig, combined, now));
  }
  return created;
}
