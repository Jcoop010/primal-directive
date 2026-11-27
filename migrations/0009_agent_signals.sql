-- Structured webhook intake for external research/signal bots (e.g. Grok).
-- Server-only write path via POST /api/intake/agent-signal (Bearer AGENT_WEBHOOK_SECRET).
create table if not exists public.agent_signals (
  id text primary key,
  source_agent text not null,
  signal_type text not null,
  title text not null,
  summary text,
  source_url text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new', 'reviewed', 'imported', 'archived', 'rejected')),
  idempotency_key text unique,
  received_at timestamptz not null default now()
);

create index if not exists agent_signals_status_received_idx
  on public.agent_signals (status, received_at desc);

create index if not exists agent_signals_source_received_idx
  on public.agent_signals (source_agent, received_at desc);

alter table public.agent_signals enable row level security;

do $$ declare r text; begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on public.agent_signals from %I', r);
    end if;
  end loop;
end $$;
