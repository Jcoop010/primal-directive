import {
  buildBookingOutreachDraft,
  SIGNAL_BILL_ROLES,
  SIGNAL_BOOKING_STAGES,
  SIGNAL_DEAL_TYPES,
  type SignalBillRole,
  type SignalBookingStage,
  type SignalDealType,
} from "./agent-signal-scoring.ts";
import type { Sql } from "./db.ts";
import type { Gig } from "./types.ts";

export interface ConvertibleSignalRow {
  id: string;
  source_agent: string;
  signal_type: string;
  title: string;
  summary: string | null;
  source_url: string | null;
  payload: Record<string, unknown> | null;
  status: string;
  fit_score: number | null;
  priority_tier: string | null;
  urgency: string | null;
  recommended_action: string | null;
  dedupe_fingerprint: string | null;
  idempotency_key: string | null;
  received_at: string | Date;
  reviewed_by: string | null;
  reviewed_at: string | Date | null;
  converted_gig_id: string | null;
  converted_at: string | Date | null;
  converted_by: string | null;
  corridor: string | null;
  bill_role: string | null;
  target_window: string | null;
  deal_type: string | null;
  booking_stage: string | null;
  epk_ready: boolean | null;
  tech_plot_ready: boolean | null;
  routing_checked: boolean | null;
  outreach_draft: string | null;
}

function readString(obj: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return "";
}

function readNumber(obj: Record<string, unknown>, keys: readonly string[]): number {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "number" && Number.isFinite(val) && val >= 0) return val;
  }
  return 0;
}

export function buildLeadGigFromSignal(row: ConvertibleSignalRow): Gig {
  const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
  const gigId = `gig-sig-${row.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}`;
  const venue =
    readString(payload, ["venue", "festival", "promoter", "company"]) ||
    row.title.split("—")[0]?.trim() ||
    row.title;
  const city = readString(payload, ["city", "market", "region"]) || "TBD";
  const date = readString(payload, ["date", "targetDate"]) || "";
  const fee = readNumber(payload, ["guarantee", "fee", "offer"]);
  const outreachEmail = readString(payload, ["bookingEmail", "email"]) || undefined;
  const outreachContact = readString(payload, ["contact", "buyer", "promoter"]) || undefined;
  const corridor =
    row.corridor?.trim() || readString(payload, ["corridor", "routingFit", "cityRegion"]) || undefined;
  const rawRole = row.bill_role?.trim() || readString(payload, ["billRole"]);
  const billRole: SignalBillRole | undefined =
    rawRole && (SIGNAL_BILL_ROLES as readonly string[]).includes(rawRole)
      ? (rawRole as SignalBillRole)
      : undefined;
  const targetWindow =
    row.target_window?.trim() || readString(payload, ["targetWindow", "deadline", "window"]) || undefined;
  const rawDeal = row.deal_type?.trim() || readString(payload, ["dealType"]);
  const dealType: SignalDealType | undefined =
    rawDeal && (SIGNAL_DEAL_TYPES as readonly string[]).includes(rawDeal)
      ? (rawDeal as SignalDealType)
      : undefined;
  const bookingStage: SignalBookingStage =
    row.booking_stage && (SIGNAL_BOOKING_STAGES as readonly string[]).includes(row.booking_stage)
      ? (row.booking_stage as SignalBookingStage)
      : "lead";
  const outreachDraft =
    row.outreach_draft?.trim() ||
    buildBookingOutreachDraft({
      venue,
      city,
      corridor,
      billRole,
      targetWindow,
      dealType,
      recommendedAction: row.recommended_action,
    });
  const nowIso = new Date().toISOString();

  const noteParts = [
    row.summary?.trim(),
    row.recommended_action ? `Next action: ${row.recommended_action.trim()}` : "",
    row.source_url ? `Source: ${row.source_url.trim()}` : "",
    `Imported from ${row.source_agent} (${row.signal_type})`,
  ].filter(Boolean);

  return {
    id: gigId,
    name: row.title.slice(0, 140),
    venue: venue.slice(0, 120),
    city: city.slice(0, 80),
    date: date.slice(0, 40),
    fee,
    conf: typeof row.fit_score === "number" ? Math.max(0, Math.min(1, row.fit_score / 100)) : 0.6,
    status: "lead",
    notes: noteParts.join("\n\n"),
    corridor,
    billRole,
    targetWindow,
    dealType,
    bookingStage,
    epkReady: Boolean(row.epk_ready),
    techPlotReady: Boolean(row.tech_plot_ready),
    routingChecked: Boolean(row.routing_checked),
    outreachDraft,
    stageHistory: [{ from: "lead", to: "lead", at: nowIso }],
    ...(row.source_url ? { researchSourceUrl: row.source_url } : {}),
    ...(outreachEmail ? { outreachEmail } : {}),
    ...(outreachContact ? { outreachContact } : {}),
  };
}

const SIGNAL_SELECT_COLUMNS = `id, source_agent, signal_type, title, summary, source_url, payload,
  status, fit_score, priority_tier, urgency, recommended_action, dedupe_fingerprint,
  idempotency_key, received_at, reviewed_by, reviewed_at,
  converted_gig_id, converted_at, converted_by,
  corridor, bill_role, target_window, deal_type, booking_stage,
  epk_ready, tech_plot_ready, routing_checked, outreach_draft`;

export async function convertSignalToLeadInDb(
  sql: Sql,
  input: { signalId: string; userId: string },
): Promise<{
  row: ConvertibleSignalRow;
  gig: Gig | null;
  gigId: string;
  alreadyConverted: boolean;
}> {
  return sql.transaction(async (tx) => {
    const existingRows = await tx.query<ConvertibleSignalRow>(
      `select ${SIGNAL_SELECT_COLUMNS}
       from public.agent_signals
       where id = $1
       for update`,
      [input.signalId],
    );
    const signal = existingRows[0];
    if (!signal) {
      throw new Error("Signal not found.");
    }

    if (signal.converted_gig_id) {
      return {
        row: signal,
        gig: null,
        gigId: signal.converted_gig_id,
        alreadyConverted: true,
      };
    }

    const gig = buildLeadGigFromSignal(signal);

    const stateRows = await tx.query<{ state: Record<string, unknown>; version: number }>(
      `select state, version from public.app_state where user_id = $1 for update`,
      [input.userId],
    );

    if (stateRows[0]) {
      const currentState =
        stateRows[0].state && typeof stateRows[0].state === "object" ? stateRows[0].state : {};
      const currentGigs = Array.isArray(currentState.gigs)
        ? (currentState.gigs as Array<{ id?: string }>)
        : [];
      const alreadyInState = currentGigs.some((item) => item?.id === gig.id);
      const nextGigs = alreadyInState ? currentGigs : [gig, ...currentGigs];
      const nextState = { ...currentState, gigs: nextGigs };
      await tx.query(
        `update public.app_state
         set state = $2::jsonb, version = version + 1, updated_at = CURRENT_TIMESTAMP
         where user_id = $1`,
        [input.userId, JSON.stringify(nextState)],
      );
    } else {
      const initialState = { gigs: [gig] };
      await tx.query(
        `insert into public.app_state (user_id, state, version)
         values ($1, $2::jsonb, 1)
         on conflict (user_id) do update
         set state = excluded.state, version = public.app_state.version + 1, updated_at = CURRENT_TIMESTAMP`,
        [input.userId, JSON.stringify(initialState)],
      );
    }

    const updatedRows = await tx.query<ConvertibleSignalRow>(
      `update public.agent_signals
       set status = 'imported',
           converted_gig_id = $2,
           converted_at = now(),
           converted_by = $3,
           reviewed_by = coalesce(reviewed_by, $3),
           reviewed_at = coalesce(reviewed_at, now()),
           outreach_draft = coalesce(outreach_draft, $4)
       where id = $1
       returning ${SIGNAL_SELECT_COLUMNS}`,
      [input.signalId, gig.id, input.userId, gig.outreachDraft ?? null],
    );

    return {
      row: updatedRows[0] ?? { ...signal, status: "imported", converted_gig_id: gig.id },
      gig,
      gigId: gig.id,
      alreadyConverted: false,
    };
  });
}
