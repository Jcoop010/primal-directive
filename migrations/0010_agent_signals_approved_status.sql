-- Allow explicit 'approved' triage state and record reviewer metadata on agent_signals.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.agent_signals'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.agent_signals drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.agent_signals
  add constraint agent_signals_status_check
  check (status in ('new', 'reviewed', 'approved', 'imported', 'archived', 'rejected'));

alter table public.agent_signals
  add column if not exists reviewed_by text,
  add column if not exists reviewed_at timestamptz;
