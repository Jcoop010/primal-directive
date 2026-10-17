-- Durable, band-scoped automation queue. Never use in-memory state for production delivery.
create table if not exists automation_runs (
  id text primary key,
  band_id text not null,
  action text not null,
  idempotency_key text not null,
  status text not null check (status in ('queued','awaiting_approval','running','retry_scheduled','succeeded','failed','cancelled')),
  attempt integer not null default 0 check (attempt >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  next_attempt_at timestamptz,
  last_error text,
  approved_by text,
  approved_at timestamptz,
  unique (band_id, idempotency_key)
);
create index if not exists automation_runs_due_idx on automation_runs (status, next_attempt_at);
