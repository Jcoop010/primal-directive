-- Pre-show net yield estimates and anchor-date routing gap metadata on public.agent_signals.
alter table public.agent_signals
  add column if not exists guarantee_or_split_est numeric(10, 2) not null default 0 check (guarantee_or_split_est >= 0),
  add column if not exists est_attendance integer not null default 0 check (est_attendance >= 0),
  add column if not exists merch_per_head_est numeric(8, 2) not null default 0 check (merch_per_head_est >= 0),
  add column if not exists road_and_room_cost_est numeric(10, 2) not null default 0 check (road_and_room_cost_est >= 0),
  add column if not exists anchor_gap_note text,
  add column if not exists gap_fit_score integer check (gap_fit_score is null or (gap_fit_score between 0 and 100));

create index if not exists agent_signals_gap_fit_idx
  on public.agent_signals (gap_fit_score desc, fit_score desc)
  where gap_fit_score is not null;
