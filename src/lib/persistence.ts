import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { GIG_STATUSES, MERCH_CATEGORIES, MERCH_PAYMENT_METHODS, MONEY_TYPES, PERSON_ROLES } from "@/lib/types";

const suggestedGigSchema = z.object({
  name: z.string(),
  venue: z.string(),
  city: z.string(),
  date: z.string(),
  fee: z.number(),
  conf: z.number(),
  reason: z.string(),
  status: z.enum(GIG_STATUSES).optional(),
});

const suggestedPersonSchema = z.object({
  name: z.string(),
  role: z.enum(PERSON_ROLES),
  city: z.string(),
  detail: z.string(),
  reason: z.string(),
});

const gigSchema = z.object({
  id: z.string(),
  name: z.string(),
  venue: z.string(),
  city: z.string(),
  date: z.string(),
  fee: z.number(),
  conf: z.number(),
  status: z.enum(GIG_STATUSES),
  notes: z.string(),
});

const personSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(PERSON_ROLES),
  city: z.string(),
  contact: z.string(),
  notes: z.string(),
  settlementSharePercent: z.number().min(0).max(100).optional(),
});

const moneySchema = z.object({
  id: z.string(),
  type: z.enum(MONEY_TYPES),
  amount: z.number(),
  label: z.string(),
  date: z.string(),
  gigId: z.string().optional(),
});


const merchProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
  category: z.enum(MERCH_CATEGORIES),
  price: z.number().nonnegative(),
  unitCost: z.number().nonnegative(),
  stockOnHand: z.number().int().nonnegative(),
  reorderAt: z.number().int().nonnegative(),
  active: z.boolean(),
});

const merchSaleSchema = z.object({
  id: z.string(),
  productId: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  unitCost: z.number().nonnegative(),
  date: z.string(),
  gigId: z.string().optional(),
  paymentMethod: z.enum(MERCH_PAYMENT_METHODS),
  notes: z.string(),
});

const chatSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "ai"]),
  text: z.string(),
  source: z.string().optional(),
  citations: z.array(z.string()).optional(),
  gigs: z.array(suggestedGigSchema).optional(),
  people: z.array(suggestedPersonSchema).optional(),
  moves: z.array(z.string()).optional(),
});

const profileSchema = z.object({
  artistName: z.string(),
  city: z.string(),
  genre: z.string(),
  draw: z.string(),
  feeTarget: z.number(),
  notes: z.string(),
  reservePercent: z.number().min(0).max(100).default(0),
});

const stateSchema = z.object({
  gigs: z.array(gigSchema).max(5000),
  people: z.array(personSchema).max(5000),
  money: z.array(moneySchema).max(5000),
  merchProducts: z.array(merchProductSchema).max(5000).default([]),
  merchSales: z.array(merchSaleSchema).max(20000).default([]),
  chat: z.array(chatSchema).max(2000),
  profile: profileSchema,
});

const loadInput = z.object({});
const saveInput = z.object({ state: stateSchema });

export const loadAppState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(loadInput)
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<{ state: unknown; version: number }>(
      "select state, version from app_state where user_id = $1",
      [context.userId],
    );
    if (!rows.length) return { state: null, version: 0 };
    return {
      state: stateSchema.parse(rows[0].state),
      version: Number(rows[0].version) || 1,
    };
  });

export const saveAppState = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(saveInput)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const serialized = JSON.stringify(data.state);
    if (serialized.length > 2_000_000) {
      throw new Error("App state exceeds the 2 MB safety limit");
    }
    const rows = await sql.query<{ version: number }>(
      `insert into app_state (user_id, state, version, updated_at)
       values ($1, $2::jsonb, 1, current_timestamp)
       on conflict (user_id) do update
       set state = excluded.state,
           version = app_state.version + 1,
           updated_at = current_timestamp
       returning version`,
      [context.userId, serialized],
    );
    return { ok: true, version: Number(rows[0]?.version ?? 1) };
  });
