-- Keep the app's Better Auth text IDs separate from legacy workspace billing.
create table if not exists pd_billing_customers (
  user_id text primary key references "user"(id) on delete cascade,
  customer_id text not null unique,
  livemode boolean not null,
  checkout_request_key text,
  checkout_plan text,
  checkout_session_id text,
  created_at timestamptz not null default now()
);
create table if not exists pd_subscriptions (
  subscription_id text primary key,
  user_id text not null references "user"(id) on delete cascade,
  customer_id text not null,
  price_id text not null,
  plan text not null check(plan in ('pro','studio','free')),
  status text not null,
  period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  event_created bigint not null,
  updated_at timestamptz not null default now()
);
create index if not exists pd_subscriptions_user on pd_subscriptions(user_id);
create table if not exists pd_stripe_events (
  event_id text primary key, event_type text not null,
  created_at timestamptz not null default now()
);
alter table pd_billing_customers enable row level security;
alter table pd_subscriptions enable row level security;
alter table pd_stripe_events enable row level security;
