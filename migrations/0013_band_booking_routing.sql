-- Structured band booking, routing corridor, readiness flags, and human-reviewed outreach draft.
alter table public.agent_signals
  add column if not exists corridor text,
  add column if not exists bill_role text check (bill_role in ('support', 'co_bill', 'headliner', 'festival', 'session')),
  add column if not exists target_window text,
  add column if not exists deal_type text check (deal_type in ('guarantee', 'door_split', 'versus', 'promo_showcase')),
  add column if not exists booking_stage text not null default 'lead' check (booking_stage in ('lead', 'hold_requested', 'hold_confirmed', 'advance_in_progress', 'booked', 'passed')),
  add column if not exists epk_ready boolean not null default false,
  add column if not exists tech_plot_ready boolean not null default false,
  add column if not exists routing_checked boolean not null default false,
  add column if not exists outreach_draft text;

create index if not exists agent_signals_corridor_role_idx
  on public.agent_signals (corridor, bill_role)
  where corridor is not null;

create index if not exists agent_signals_booking_stage_idx
  on public.agent_signals (booking_stage, fit_score desc, received_at desc);
