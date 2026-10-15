import { z } from 'zod';
import { validDay } from './workspace-intelligence.ts';
const id = z.string().min(1).max(200);
const finite = z.number().finite().min(-1e12).max(1e12);
const day = z.string().refine(validDay, 'Choose a real calendar date.');
const action = z.object({ id, title: z.string().max(160), description: z.string().max(2000), category: z.enum(['booking','advancing','promotion','merch','finance']), gigId: z.string().max(200), dueDate: z.union([z.literal(''), day]), minutes: z.number().int().min(15).max(600), goalId: z.string().max(200), taskId: id.optional() });
export const planningSchema = z.object({
  goals: z.array(z.object({ id, title: z.string().min(1).max(160), metric: z.enum(['manual','collected','shows','tasks']), target: finite.positive(), reported: finite.nonnegative(), baseline: finite, deadline: day, nextAction: z.string().min(1).max(500), createdAt: z.string().max(80) })).max(50),
  memories: z.array(z.object({ id, text: z.string().min(1).max(1000), updatedAt: z.string().max(80) })).max(30),
  plans: z.array(z.object({ id, start: day, end: day, capacityMinutes: z.number().int().min(15).max(2400), createdAt: z.string().max(80), actions: z.array(action).max(5) })).max(26),
  capacityMinutes: z.number().int().min(15).max(2400),
});
