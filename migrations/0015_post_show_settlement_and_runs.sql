-- Post-show settlement actuals and multi-date routing run grouping on public.agent_signals.
alter table public.agent_signals
  add column if not exists actual_payout numeric(10, 2) check (actual_payout is null or actual_payout >= 0),
  add column if not exists actual_attendance integer check (actual_attendance is null or actual_attendance >= 0),
  add column if not exists actual_merch_gross numeric(10, 2) check (actual_merch_gross is null or actual_merch_gross >= 0),
  add column if not exists actual_road_and_room_cost numeric(10, 2) check (actual_road_and_room_cost is null or actual_road_and_room_cost >= 0),
  add column if not exists settled_at timestamptz,
  add column if not exists settlement_note text,
  add column if not exists run_label text;

create index if not exists agent_signals_run_label_idx
  on public.agent_signals (run_label)
  where run_label is not null;

create index if not exists agent_signals_settled_at_idx
  on public.agent_signals (settled_at desc)
  where settled_at is not null;
