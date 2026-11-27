-- Track idempotent conversion of agent_signals into app_state lead gigs.
alter table public.agent_signals
  add column if not exists converted_gig_id text,
  add column if not exists converted_at timestamptz,
  add column if not exists converted_by text;

create index if not exists agent_signals_converted_gig_idx
  on public.agent_signals (converted_gig_id)
  where converted_gig_id is not null;
