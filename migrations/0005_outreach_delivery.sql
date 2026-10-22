-- Server-only delivery ledger. No schema changes happen in request handlers.
create table if not exists outreach_delivery_audit (
  idempotency_key text primary key,
  user_id text not null,
  gig_id text not null,
  recipient text not null,
  status text not null check (status in ('reserved','sent','failed','unknown')),
  provider_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table outreach_delivery_audit add column if not exists approval_id text;
alter table outreach_delivery_audit add column if not exists message_fingerprint text;
alter table outreach_delivery_audit add column if not exists provider_thread_id text;
create index if not exists outreach_delivery_user_time on outreach_delivery_audit(user_id,created_at);
create index if not exists outreach_delivery_time on outreach_delivery_audit(created_at);
create table if not exists outreach_dispatch_guard (
  id integer primary key check (id=1), epoch bigint not null default 0
);
insert into outreach_dispatch_guard(id) values(1) on conflict do nothing;
create table if not exists outreach_preferences (
  user_id text primary key, paused boolean not null default true,
  updated_at timestamptz not null default now()
);
create table if not exists outreach_suppressions (
  user_id text not null, recipient text not null, reason text not null,
  created_at timestamptz not null default now(), primary key(user_id,recipient)
);
create table if not exists outreach_approvals (
  id text primary key, user_id text not null, gig_id text not null,
  recipient text not null, subject text not null, body text not null,
  message_fingerprint text not null, contact_source_url text not null,
  policy_version text not null, approved_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '24 hours'),
  revoked_at timestamptz, unique(user_id,id)
);
-- Each invocation is one transaction. All dispatchers lock the same guard BEFORE
-- reading quota, policy or duplicate state. Counts include failed and unknown sends.
-- Updating the guard also makes stricter isolation levels fail closed on conflicts.
create or replace function reserve_booking_outreach(
  p_user text,p_gig text,p_recipient text,p_key text,p_approval text,p_fingerprint text
) returns text language plpgsql security invoker set search_path=public,pg_temp as $$
declare a outreach_approvals%rowtype; n_hour bigint; n_day bigint; g_hour bigint; g_day bigint;
begin
  update outreach_dispatch_guard set epoch=epoch+1 where id=1;
  if not found then return 'guard-missing'; end if;
  if not exists(select 1 from outreach_preferences where user_id=p_user and paused=false) then return 'paused'; end if;
  select * into a from outreach_approvals where id=p_approval and user_id=p_user for update;
  if not found or a.revoked_at is not null or a.expires_at<=now()
     or a.gig_id<>p_gig or a.recipient<>p_recipient or a.message_fingerprint<>p_fingerprint
     or a.policy_version<>'2026-10-22-v1' then return 'approval-required'; end if;
  if exists(select 1 from outreach_suppressions where user_id=p_user and recipient=p_recipient) then return 'suppressed'; end if;
  if exists(select 1 from outreach_delivery_audit where idempotency_key=p_key or (user_id=p_user and approval_id=p_approval)) then return 'duplicate'; end if;
  -- Also prevent altered-content re-sends to the same contact/gig during the cooldown.
  if exists(select 1 from outreach_delivery_audit where user_id=p_user and gig_id=p_gig and recipient=p_recipient and created_at>now()-interval '72 hours') then return 'contact-cooldown'; end if;
  select count(*) filter(where created_at>now()-interval '1 hour'),count(*) into n_hour,n_day
    from outreach_delivery_audit where user_id=p_user and created_at>now()-interval '24 hours';
  select count(*) filter(where created_at>now()-interval '1 hour'),count(*) into g_hour,g_day
    from outreach_delivery_audit where created_at>now()-interval '24 hours';
  if n_hour>=5 or n_day>=20 or g_hour>=100 or g_day>=500 then return 'quota-exceeded'; end if;
  insert into outreach_delivery_audit(idempotency_key,user_id,gig_id,recipient,status,approval_id,message_fingerprint)
    values(p_key,p_user,p_gig,p_recipient,'reserved',p_approval,p_fingerprint);
  return 'reserved';
end $$;
revoke all on function reserve_booking_outreach(text,text,text,text,text,text) from public;
alter table outreach_delivery_audit enable row level security;
alter table outreach_dispatch_guard enable row level security;
alter table outreach_preferences enable row level security;
alter table outreach_suppressions enable row level security;
alter table outreach_approvals enable row level security;
alter table automation_runs enable row level security;
-- Supabase may grant default function privileges directly to browser roles.
do $$ declare r text; begin
  foreach r in array array['anon','authenticated'] loop
    if exists(select 1 from pg_roles where rolname=r) then
      execute format('revoke all on function reserve_booking_outreach(text,text,text,text,text,text) from %I',r);
      execute format('revoke all on outreach_delivery_audit,outreach_dispatch_guard,outreach_preferences,outreach_suppressions,outreach_approvals from %I',r);
    end if;
  end loop;
end $$;
