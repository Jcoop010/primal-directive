-- Defense-in-depth for the direct Postgres application architecture.
-- Better Auth and the application use a server-side database role, so these
-- tables remain fully usable by the server while browser/PostgREST access is
-- deny-by-default unless an explicit policy is added later.

alter table if exists public."user" enable row level security;
alter table if exists public.session enable row level security;
alter table if exists public.account enable row level security;
alter table if exists public.verification enable row level security;
alter table if exists public.app_state enable row level security;
alter table if exists public.stripe_webhook_events enable row level security;

-- Explicitly document the intended posture: no client-side policy exists.
-- This prevents accidental exposure through PostgREST while preserving the
-- server-side Better Auth/database access path.
