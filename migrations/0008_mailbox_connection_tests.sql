-- One-shot owner-authorized connection tests are separate from booking outreach.
create table mailbox_connection_tests (
  grant_id text primary key,
  user_id text not null,
  account_id text not null,
  recipient text not null,
  subject text not null,
  body text not null,
  policy_version text not null,
  approved_at timestamptz not null default now(),
  status text not null check (status in ('reserved','sent','failed','unknown')),
  provider_message_id text,
  provider_thread_id text,
  reply_message_id text,
  reason text,
  updated_at timestamptz not null default now()
);
create index mailbox_connection_tests_owner on mailbox_connection_tests(user_id,approved_at);
alter table mailbox_connection_tests enable row level security;
do $$ declare r text; begin
 foreach r in array array['anon','authenticated'] loop
  if exists(select 1 from pg_roles where rolname=r) then
   execute format('revoke all on mailbox_connection_tests from %I',r);
  end if;
 end loop;
end $$;
