import { getSql, dbSource } from "./db.ts";
import type { AutomationRun } from "./automation-runner.ts";
import type { AutomationRunStore } from "./automation-worker.ts";

type RunRow = { id: string; band_id: string; action: string; idempotency_key: string; status: AutomationRun["status"]; attempt: number; max_attempts: number; created_at: string | Date; updated_at: string | Date; next_attempt_at: string | Date | null; last_error: string | null; approved_by: string | null; approved_at: string | Date | null };
const iso = (value: string | Date) => new Date(value).toISOString();
function decode(r: RunRow): AutomationRun {
  return { id: r.id, bandId: r.band_id, action: r.action, idempotencyKey: r.idempotency_key, status: r.status, attempt: r.attempt, maxAttempts: r.max_attempts, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at), ...(r.next_attempt_at ? { nextAttemptAt: iso(r.next_attempt_at) } : {}), ...(r.last_error ? { lastError: r.last_error } : {}), ...(r.approved_by && r.approved_at ? { approval: { approvedBy: r.approved_by, approvedAt: iso(r.approved_at) } } : {}) };
}
export function postgresAutomationRunStore(): AutomationRunStore {
  if (dbSource !== "postgres") throw new Error("Durable automation requires PostgreSQL; embedded preview database is not safe for jobs.");
  return {
    async listByBand(bandId) {
      const sql = await getSql();
      return (await sql.query<RunRow>("select * from automation_runs where band_id = $1", [bandId])).map(decode);
    },
    async save(run) {
      const sql = await getSql();
      // Only persist existing claims or approval transitions. No implicit creation or resurrection.
      const rows = await sql.query<{ id: string }>(
        "update automation_runs set status=$2, attempt=$3, updated_at=$4, next_attempt_at=$5, last_error=$6, approved_by=$7, approved_at=$8 where id=$1 and band_id=$9 returning id",
        [run.id, run.status, run.attempt, run.updatedAt, run.nextAttemptAt ?? null, run.lastError ?? null, run.approval?.approvedBy ?? null, run.approval?.approvedAt ?? null, run.bandId],
      );
      if (rows.length !== 1) throw new Error("Automation run missing or band scope mismatch.");
    },
    async claim(run) {
      const sql = await getSql();
      // Compare-and-swap ensures at most one worker starts this attempt.
      const previous = run.attempt === 1 ? "queued" : "retry_scheduled";
      const rows = await sql.query<{ id: string }>(
        "update automation_runs set status='running', attempt=$3, updated_at=$4, next_attempt_at=null where id=$1 and band_id=$2 and status=$5 and attempt=$6 returning id",
        [run.id, run.bandId, run.attempt, run.updatedAt, previous, run.attempt - 1],
      );
      return rows.length === 1;
    },
  };
}
