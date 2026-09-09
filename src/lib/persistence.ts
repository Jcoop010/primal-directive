import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

const stateSchema = z.object({
  gigs: z.array(z.unknown()).max(5000),
  people: z.array(z.unknown()).max(5000),
  money: z.array(z.unknown()).max(5000),
  chat: z.array(z.unknown()).max(2000),
  profile: z.record(z.string(), z.unknown()),
});

const loadInput = z.object({});
const saveInput = z.object({ state: stateSchema });

export const loadAppState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input) => loadInput.parse(input ?? {}))
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
  .validator((input) => saveInput.parse(input))
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
