-- Additive mailbox state; Better Auth retains ownership of encrypted OAuth tokens.
create table mailbox_preferences (
  user_id text primary key, account_id text, updated_at timestamptz not null default now()
);
create table mailbox_connections (
  user_id text not null, account_id text not null, enabled boolean not null default true,
  last_sync_at timestamptz, last_error text, primary key(user_id,account_id)
);
create table mailbox_events (
  id text primary key, user_id text not null, account_id text not null,
  action text not null, created_at timestamptz not null default now()
);
create index mailbox_events_limit on mailbox_events(user_id,created_at);
create table mailbox_messages (
  user_id text not null, account_id text not null, message_id text not null,
  thread_id text not null, sender text not null, subject text not null,
  received_at text not null, reply_to text, gig_id text,
  synced_at timestamptz not null default now(), primary key(user_id,account_id,message_id)
);
create table mailbox_drafts (
  id text primary key, user_id text not null, account_id text not null, gig_id text not null,
  recipient text not null, subject text not null, body text not null,
  provider_draft_id text, export_status text not null default 'local',
  created_at timestamptz not null default now()
);
alter table outreach_approvals add column mailbox_account_id text;
alter table outreach_delivery_audit add column mailbox_account_id text;
alter table outreach_delivery_audit add column mail_provider text not null default 'google';
alter table mailbox_preferences enable row level security;
alter table mailbox_connections enable row level security;
alter table mailbox_events enable row level security;
alter table mailbox_messages enable row level security;
alter table mailbox_drafts enable row level security;
do $$ declare r text; begin
 foreach r in array array['anon','authenticated'] loop
  if exists(select 1 from pg_roles where rolname=r) then
   execute format('revoke all on mailbox_preferences,mailbox_connections,mailbox_events,mailbox_messages,mailbox_drafts from %I',r);
  end if;
 end loop;
end $$;
-- Reservation and quota checks still run in the existing atomic guard transaction.
-- Bind any selected mailbox to the immutable delivery reservation, verifying ownership
-- and local revocation again at reservation time (not just before token refresh).
create function bind_outreach_mailbox() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare selected text; provider text;
begin
 select mailbox_account_id into selected from outreach_approvals where id=new.approval_id and user_id=new.user_id;
 if selected is not null then
  select a."providerId" into provider from account a left join mailbox_connections c on c.user_id=a."userId" and c.account_id=a.id
   where a.id=selected and a."userId"=new.user_id and coalesce(c.enabled,true)
   and ((a."providerId"='google' and coalesce(a.scope,'') ~ '(^|[ ,])https://www[.]googleapis[.]com/auth/gmail[.]send($|[ ,])')
     or (a."providerId"='microsoft' and coalesce(a.scope,'') ~* '(^|[ ,])(?:https://graph[.]microsoft[.]com/)?Mail[.]Send($|[ ,])'));
  if provider is null then raise exception 'Mailbox authorization unavailable'; end if;
  new.mailbox_account_id=selected; new.mail_provider=provider;
 end if;
 return new;
end $$;
create trigger outreach_mailbox_binding before insert on outreach_delivery_audit for each row execute function bind_outreach_mailbox();
revoke all on function bind_outreach_mailbox() from public;
