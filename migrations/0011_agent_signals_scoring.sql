-- Add deterministic scoring, triage metadata, and dedupe fingerprint to public.agent_signals.
alter table public.agent_signals
  add column if not exists fit_score integer not null default 50 check (fit_score between 0 and 100),
  add column if not exists priority_tier text not null default 'medium' check (priority_tier in ('high', 'medium', 'low')),
  add column if not exists urgency text not null default 'normal' check (urgency in ('urgent', 'high', 'normal', 'low')),
  add column if not exists recommended_action text,
  add column if not exists dedupe_fingerprint text;

create index if not exists agent_signals_status_score_received_idx
  on public.agent_signals (status, fit_score desc, received_at desc);

create index if not exists agent_signals_priority_score_idx
  on public.agent_signals (priority_tier, fit_score desc, received_at desc);

create index if not exists agent_signals_dedupe_fingerprint_idx
  on public.agent_signals (dedupe_fingerprint)
  where dedupe_fingerprint is not null;
