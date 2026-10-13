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
  sourceOrderId: z.string().optional(),
  sourceSaleId: z.string().optional(),
  memberId: z.string().optional(),
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
  size: z.string().optional(),
  color: z.string().optional(),
  imageUrl: z.string().optional(),
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
  orderId: z.string().optional(),
  channel: z.enum(["table", "show", "online"]).optional(),
  member: z.string().optional(),
  discountAmount: z.number().nonnegative().optional(),
  taxAmount: z.number().nonnegative().optional(),
  processingFee: z.number().nonnegative().optional(),
});

const merchOrderSchema = z.object({
  id: z.string(),
  status: z.enum(["paid", "refunded", "void"]),
  channel: z.enum(["table", "show", "online"]),
  date: z.string(),
  createdAt: z.string(),
  lines: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive(), unitPrice: z.number().nonnegative(), unitCost: z.number().nonnegative() })),
  subtotal: z.number().nonnegative(),
  discountAmount: z.number().nonnegative(),
  taxAmount: z.number().nonnegative(),
  processingFee: z.number().nonnegative(),
  total: z.number().nonnegative(),
  paymentMethod: z.enum(MERCH_PAYMENT_METHODS),
  gigId: z.string().optional(),
  member: z.string().optional(),
  notes: z.string(),
  providerReference: z.string().optional(),
  refundedAmount: z.number().nonnegative().optional(),
});

const merchInventoryAdjustmentSchema = z.object({
  id: z.string(),
  productId: z.string(),
  quantityDelta: z.number().int(),
  reason: z.enum(["opening", "restock", "sale", "return", "comp", "damage", "correction"]),
  date: z.string(),
  gigId: z.string().optional(),
  note: z.string(),
  sourceOrderId: z.string().optional(),
});

const merchRefundSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  date: z.string(),
  amount: z.number().nonnegative(),
  restocked: z.boolean(),
  note: z.string(),
});

const operationalTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.enum(["booking", "advancing", "promotion", "merch", "finance"]),
  gigId: z.string(),
  dueDate: z.string(),
  dueDateOverridden: z.boolean().optional(),
  status: z.enum(["open", "done"]),
  sourceKey: z.string(),
  createdAt: z.string(),
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
  merchOrders: z.array(merchOrderSchema).max(20000).default([]),
  merchInventoryAdjustments: z.array(merchInventoryAdjustmentSchema).max(50000).default([]),
  merchRefunds: z.array(merchRefundSchema).max(20000).default([]),
  tasks: z.array(operationalTaskSchema).max(20000).default([]),
  chat: z.array(chatSchema).max(2000),
  profile: profileSchema,
});

const loadInput = z.object({});
const saveInput = z.object({
  state: stateSchema,
  expectedVersion: z.number().int().nonnegative(),
});

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

    // Compare-and-swap prevents one browser tab from silently replacing a newer workspace.
    const rows = data.expectedVersion === 0
      ? await sql.query<{ version: number }>(
          `insert into app_state (user_id, state, version, updated_at)
           values ($1, $2::jsonb, 1, current_timestamp)
           on conflict (user_id) do nothing
           returning version`,
          [context.userId, serialized],
        )
      : await sql.query<{ version: number }>(
          `update app_state
           set state = $2::jsonb,
               version = version + 1,
               updated_at = current_timestamp
           where user_id = $1 and version = $3
           returning version`,
          [context.userId, serialized, data.expectedVersion],
        );

    if (!rows.length) {
      throw new Error("Workspace changed in another session. Reload before saving to avoid overwriting newer data.");
    }
    return { ok: true, version: Number(rows[0].version) };
  });
