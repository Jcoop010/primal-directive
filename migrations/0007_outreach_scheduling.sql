create table outreach_rules (
  user_id text primary key, enabled boolean not null default false,
  hourly_limit integer not null default 5 check(hourly_limit between 1 and 5),
  daily_limit integer not null default 20 check(daily_limit between 1 and 20),
  max_followups integer not null default 2 check(max_followups between 0 and 2),
  policy_version text not null, consented_at timestamptz not null default now()
);
create table outreach_rule_events (
  id text primary key,user_id text not null,enabled boolean not null,
  hourly_limit integer not null,daily_limit integer not null,max_followups integer not null,
  policy_version text not null,consented_at timestamptz not null default now()
);
create table outreach_jobs (
  id text primary key,user_id text not null,approval_id text not null unique,
  parent_key text,followup_number integer not null default 0 check(followup_number between 0 and 2),not_before timestamptz not null,
  status text not null default 'scheduled' check(status in ('scheduled','processing','sent','blocked','cancelled','unknown')),
  result_code text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  foreign key(user_id,approval_id) references outreach_approvals(user_id,id)
);
create index outreach_jobs_due on outreach_jobs(status,not_before);
create table outreach_replies (
  user_id text not null,message_id text not null,thread_id text not null,
  gig_id text not null,recipient text not null,classification text not null,
  received_at timestamptz not null default now(),primary key(user_id,message_id)
);
alter table outreach_rules enable row level security;
alter table outreach_rule_events enable row level security;
alter table outreach_jobs enable row level security;
alter table outreach_replies enable row level security;

-- The same serialized reservation also honors the account’s lower configured limits.
create or replace function reserve_booking_outreach(
  p_user text,p_gig text,p_recipient text,p_key text,p_approval text,p_fingerprint text
) returns text language plpgsql security invoker set search_path=public,pg_temp as $$
declare a outreach_approvals%rowtype; n_hour bigint; n_day bigint; g_hour bigint; g_day bigint;
begin
  update outreach_dispatch_guard set epoch=epoch+1 where id=1;
  if not found then return 'guard-missing'; end if;
  if not exists(select 1 from outreach_preferences where user_id=p_user and paused=false) then return 'paused'; end if;
  if exists(select 1 from outreach_jobs where user_id=p_user and approval_id=p_approval)
     and not exists(select 1 from outreach_jobs j join outreach_rules r on r.user_id=j.user_id
       where j.user_id=p_user and j.approval_id=p_approval and j.status='processing'
       and j.not_before<=now() and r.enabled=true and r.max_followups>=j.followup_number)
     then return 'scheduling-consent-required'; end if;
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
  if n_hour>=coalesce((select hourly_limit from outreach_rules where user_id=p_user),5) or n_day>=coalesce((select daily_limit from outreach_rules where user_id=p_user),20) or g_hour>=100 or g_day>=500 then return 'quota-exceeded'; end if;
  insert into outreach_delivery_audit(idempotency_key,user_id,gig_id,recipient,status,approval_id,message_fingerprint)
    values(p_key,p_user,p_gig,p_recipient,'reserved',p_approval,p_fingerprint);
  return 'reserved';
end $$;
