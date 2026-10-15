import { z } from "zod";
import { GIG_STATUSES, MONEY_TYPES } from "./types.ts";

const id = z.string().max(200);
const cash = z.number().finite().min(-1_000_000_000).max(1_000_000_000);
export const intelligenceWorkspaceSchema = z.object({
  gigs: z.array(z.object({ id, name: z.string().max(2000), date: z.string().max(40), fee: cash, conf: z.number().finite().min(0).max(1), status: z.enum(GIG_STATUSES) })).max(5000),
  money: z.array(z.object({ id, type: z.enum(MONEY_TYPES), amount: cash, gigId: id.optional() })).max(5000),
  merchProducts: z.array(z.object({ id, name: z.string().max(2000), price: cash.nonnegative(), unitCost: cash.nonnegative(), stockOnHand: z.number().int().nonnegative(), reorderAt: z.number().int().nonnegative(), active: z.boolean() })).max(5000),
  tasks: z.array(z.object({ id, title: z.string().max(2000), dueDate: z.string().max(40), status: z.enum(["open", "done"]), gigId: id, createdAt: z.string().max(80) })).max(20000),
});
