# Primal Directive — Shared Multi-Agent State

> **Mandatory Protocol:** Every agent (**Antigravity, Cursor, OpenCode, Jules**) MUST read this file before starting work and append a 3-bullet handoff entry under **Recent Agent Handoffs** before finishing. Never write secrets or token values into this file.

---

## Current Live Status

| Component | Status | Notes |
| --- | --- | --- |
| **Production App** (`https://primal-directive-loose-ends-co.vercel.app`) | **DEGRADED (HTTP 503 on `/api/health`)** | App code deployed cleanly at `main@5b372ac` (Oct 23, 2026), but `/api/health` returned `HTTP 503 {"status":"unavailable"}` on 2026-11-27 because the wired production Postgres DB is paused/unreachable. |
| **Supabase (`rgivgiwfmoehrcmwakwk`)** | **UNKNOWN / EXTERNAL ORG** | Not accessible from connected Supabase MCP org (`bzdreuvqbamxjljogeyv`). Owner must unpause in Supabase Dashboard and confirm Vercel `DATABASE_URL` / `STORAGE_URL`. |
| **Supabase (`phygbwjhozjjipxosszj` — "Primal Directive")** | **ACTIVE_HEALTHY (0 rows)** | Restored from `INACTIVE` on 2026-11-27. Holds legacy Sept 2026 schema + 3 old Stripe Edge Functions; missing migrations `0004`–`0009`. |
| **Auth & Mailboxes** | **Google Live / Microsoft Unconfigured** | Google OAuth & Email/Password active. Microsoft Entra ID implemented but disabled awaiting `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`. |
| **Billing & Outbound Outreach** | **Intentionally Disabled** | `BILLING_ENABLED`, `STRIPE_LIVE_VERIFIED`, `OUTREACH_SEND_ENABLED`, and `OUTREACH_RELEASE_VERIFIED` remain off pending sandbox/owner verification. |
| **Agent Signal Intake** (`/api/intake/agent-signal`) | **Implemented on Branch (Pending Deploy & Secret)** | Protected by `Authorization: Bearer <AGENT_WEBHOOK_SECRET>`; writes to `public.agent_signals` (`migrations/0009_agent_signals.sql`). |

---

## Active Branch / PRs

- **Active Stabilization Branch:** `chore/primal-directive-revival` → **Draft PR #274** (`https://github.com/Jcoop010/primal-directive/pull/274`)
- **Stale Open PR:** `#264` (`feat/microsoft-signin-20261022`) — superseded by merged PR `#265`; safe to close.

---

## Recent Agent Handoffs

### 2026-11-27 13:42 EST — Antigravity
- **Auth Root Cause Diagnosed:** Live `GET /api/health` is still `HTTP 503 {"status":"unavailable"}` (Supabase `rgivgiwfmoehrcmwakwk` paused), causing `POST /api/auth/sign-in/social` to return **`HTTP 500`** (Better Auth cannot write OAuth state to `public.verification` or read/write `"user"`/`session`). Zero auth regressions were introduced by PR #274 (`git diff main...HEAD -- src/lib/auth src/routes/api.auth.$.ts` was empty), and redirect/cookie config (`__Host-primal-directive.oauth_state`, `Secure; HttpOnly; SameSite=Lax; Path=/`, dynamic `VERCEL_PROJECT_PRODUCTION_URL` + `primal-directive-loose-ends-co.vercel.app`) is clean.
- **Code Fix Applied:** Patched `src/lib/auth/verify.server.ts` so `databaseConfigured` uses `dbSource === "postgres"` instead of checking only `DATABASE_URL`, ensuring fail-closed auth parity when Vercel supplies `STORAGE_URL` or `POSTGRES_*` aliases. Verified `typecheck`, `lint`, `vite build`, and auth unit tests.
- **Next Step:** Unpause Supabase `rgivgiwfmoehrcmwakwk` in the Supabase Dashboard (immediately restores Google & Email/Password sign-in), verify Google/Microsoft OAuth callback URLs, and add `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` in Vercel if Microsoft sign-in is desired.

### 2026-11-27 13:12 EST — Antigravity
- **Signals Inbox & Migration 0010 Built:** Since Cursor's `.patch` was not on disk, implemented the authenticated `/signals` Inbox (`src/routes/signals.tsx`, `src/lib/agent-signals.ts`, sidebar link in `src/components/app-shell.tsx`) and `migrations/0010_agent_signals_approved_status.sql` (`approved` status + `reviewed_by`/`reviewed_at` columns), registered `0010` in `scripts/migration-plan.test.mjs`, and verified `typecheck`, `lint`, `vite build`, and unit tests.
- **Connection Verification:** Confirmed `.env.local` (containing generated 32-byte hex `AGENT_WEBHOOK_SECRET`) and `.agents/mcp_config.json` are gitignored, and installed `vercel` CLI globally. However, `vercel whoami` is still logged out and `supabase_mcp` still lacks permission on `rgivgiwfmoehrcmwakwk` (needs `.agents/mcp_config.json` with PAT + Antigravity restart).
- **Next Step:** Complete `vercel.cmd login` + `vercel.cmd link`, save your Supabase PAT in `.agents/mcp_config.json`, unpause `rgivgiwfmoehrcmwakwk` in Supabase Dashboard, then say **"resume go-live"** to push `AGENT_WEBHOOK_SECRET` to Vercel, merge PR #274 into `main`, and run the live `smoke-test-2026-11-27` deduplication check.

### 2026-11-27 13:02 EST — Antigravity
- **Live Status & CI Fix:** Confirmed `GET https://primal-directive-loose-ends-co.vercel.app/api/health` is still `HTTP 503 {"status":"unavailable"}` and GitHub check `Supabase Preview` confirms `rgivgiwfmoehrcmwakwk` is the connected Supabase project; fixed PR #274 CI failure in `scripts/migration-plan.test.mjs` by registering `0009_agent_signals.sql`.
- **Migrations & Secret Prep:** Generated a 32-byte hex `AGENT_WEBHOOK_SECRET` into gitignored `.env.local` (never committed); `migrations/0009_agent_signals.sql` is ready, while `0010_agent_signals_approved_status.sql` and Cursor's patch (`0001-feat-add-authenticated-Signals-Inbox-for-agent_signa.patch`) were not found on disk or remote branches.
- **Next Step (Manual Blockers):** Owner must (1) drop Cursor's `.patch` into repo root or `~/Downloads` (or push its branch), (2) unpause Supabase `rgivgiwfmoehrcmwakwk` in the owning Supabase Dashboard, and (3) copy `AGENT_WEBHOOK_SECRET` from local `.env.local` into Vercel Production & Preview env vars (or install/login `vercel` CLI) before merging PR #274 and running the live deduplication smoke test.

### 2026-11-27 12:41 EST — Antigravity
- **Summary:** Completed 4-phase Primal Directive audit & stabilization on `chore/primal-directive-revival` (Draft PR #274): restored Supabase `phygbwjhozjjipxosszj`, added `.github/workflows/supabase-keepalive.yml`, hardened `.github/workflows/ci.yml`, replaced `AGENTS.md` + created `.cursorrules`, and published `docs/PRIMAL_DIRECTIVE_AUDIT.md`.
- **Added Coordination & Intake:** Created `docs/STATE.md`, enforced mandatory state-read/handoff rules in `AGENTS.md` and `.cursorrules`, and implemented `migrations/0009_agent_signals.sql` + `POST /api/intake/agent-signal` (Bearer `AGENT_WEBHOOK_SECRET`, timing-safe auth, Zod validation, no X/Twitter URLs, RLS-locked `public.agent_signals`).
- **Next Step:** Owner to unpause production Supabase (`rgivgiwfmoehrcmwakwk`), confirm Vercel `DATABASE_URL`/`STORAGE_URL`, set `AGENT_WEBHOOK_SECRET` in Vercel env vars, and review/merge Draft PR #274 once CI passes.

---

## Open Blockers

1. **[P0 — Production Outage]** Unpause `rgivgiwfmoehrcmwakwk` in the owning Supabase account and verify which Postgres host Vercel `DATABASE_URL` / `STORAGE_URL` points to so `GET /api/health` returns `200 {"status":"ok"}`.
2. **[P0 — Ops Access]** Authenticate Vercel CLI locally (`npm i -g vercel && vercel login && vercel link`) or connect Vercel MCP for deployment log & env inspection.
3. **[P1 — Webhook Secret]** Generate a strong random `AGENT_WEBHOOK_SECRET` and set it in Vercel Production/Preview environment variables to activate `POST /api/intake/agent-signal`.
4. **[P1 — Microsoft OAuth]** Register Primal Directive in Microsoft Entra ID (`https://primal-directive-loose-ends-co.vercel.app/api/auth/callback/microsoft`) and set `MICROSOFT_CLIENT_ID` + `MICROSOFT_CLIENT_SECRET` in Vercel.
5. **[P1 — Stripe Sandbox]** Configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_TEST_PRO_PRICE_ID`, and `STRIPE_TEST_STUDIO_PRICE_ID` in Vercel and run sandbox E2E before enabling billing.
6. **[P2 — Hygiene]** Enable Supabase Auth Leaked Password Protection, close superseded PR `#264`, and decide whether to decommission empty Supabase project `phygbwjhozjjipxosszj`.
