-- Durable per-user Primal Directive state.
-- The application keeps its rich client model intact while this row provides a
-- transactional, ownership-scoped source of truth across devices.
create table if not exists app_state (
  user_id text primary key references "user" ("id") on delete cascade,
  state jsonb not null,
  version bigint not null default 1,
  created_at timestamptz not null default CURRENT_TIMESTAMP,
  updated_at timestamptz not null default CURRENT_TIMESTAMP
);
create index if not exists app_state_updated_at_idx on app_state (updated_at desc);
