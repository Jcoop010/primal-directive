# Primal Directive — Shared Multi-Agent State

> **Mandatory Protocol:** Every agent (**Antigravity, Cursor, OpenCode, Jules**) MUST read this file before starting work and append a 3-bullet handoff entry under **Recent Agent Handoffs** before finishing. Never write secrets or token values into this file.

---

## Current Live Status

| Component | Status | Notes |
| --- | --- | --- |
| **Production App** (`https://primal-directive-loose-ends-co.vercel.app`) | **LIVE & HEALTHY (`HTTP 200` on `/api/health`)** | Deployed & promoted `main@8629e7e` (`dpl_6pWeVE23ggCGZz3cug58Lzw7mmG7`, PR #274 merged). All migrations `0001`–`0010` applied cleanly. |
| **Production Database (Neon `neon-cerulean-candle`)** | **ACTIVE_HEALTHY (IPv4, No Auto-Pause)** | Disconnected suspended Supabase Marketplace stores (`supabase-carmine-lever`, `supabase-camel-flame`) and connected Neon Postgres `neon-cerulean-candle` (`DATABASE_URL` auto-injected in Production & Preview). |
| **Auth & Sign-In** | **PASS (Google + Email/Pass Live)** | `scripts/oauth-state-smoke.mjs` passed (`HTTP 200`, host-only `__Host-` state cookie). Microsoft OAuth ready once Entra creds are verified. |
| **Agent Signal Intake & `/signals` Inbox** | **LIVE & VERIFIED** | `AGENT_WEBHOOK_SECRET` provisioned in Vercel Production & Preview. `POST /api/intake/agent-signal` passed live insert (`201`) + deduplication (`200`, `smoke-test-2026-11-27`). Authenticated `/signals` Inbox live. |

---

## Active Branch / PRs

- **Active Stabilization Branch:** `chore/primal-directive-revival` → **Draft PR #274** (`https://github.com/Jcoop010/primal-directive/pull/274`)
- **Stale Open PR:** `#264` (`feat/microsoft-signin-20261022`) — superseded by merged PR `#265`; safe to close.

---

## Recent Agent Handoffs

### 2026-11-27 14:25 EST — Cursor
- **Scoring & Migration 0011:** Added `migrations/0011_agent_signals_scoring.sql` (`fit_score`, `priority_tier`, `urgency`, `recommended_action`, `dedupe_fingerprint` + composite/partial indexes, registered in `scripts/migration-plan.test.mjs`) and pure deterministic scoring module `src/lib/agent-signal-scoring.ts` wired into both `POST /api/intake/agent-signal` and server-gated `src/lib/agent-signals.ts` reads.
- **`/signals` Triage Command Center:** Upgraded `src/routes/signals.tsx` with deep navy (`#0A1628`) / burnt orange (`#E25822` / `#D35400`) visual polish, status + priority filters, Highest Score (default) vs Newest sort, prominent score/urgency badges, recommended-action callouts, and single-click optimistic Approve/Archive actions with error rollback.
- **Verification & Next Step:** Verified `agent-signal.test.ts` (5/5), `migration-plan.test.mjs` (7/7), `brand-check.test.mjs` (29/29), `typecheck`, `lint`, and `vite build` on branch `feat/signals-scoring-triage`. Ready for owner review and PR merge into `main`.

### 2026-11-27 14:10 EST — Antigravity
- **Production DB & Deploy Live:** Disconnected suspended Vercel Supabase stores (`supabase-carmine-lever`, `supabase-camel-flame`), connected Neon Postgres `neon-cerulean-candle` (`Production` + `Preview`), merged PR #274 into `main` (`8629e7e`), and promoted `dpl_6pWeVE23ggCGZz3cug58Lzw7mmG7` to `primal-directive-loose-ends-co.vercel.app` (all migrations `0001`–`0010` applied).
- **All 3 Live Smoke Tests PASSED:** `GET /api/health` → `200 {"status":"ok","commit":"8629e7ef5172fede086f609779726c7b781ec248"}`; `scripts/oauth-state-smoke.mjs` → `200` (Google OAuth initiation verified); `POST /api/intake/agent-signal` (`smoke-test-2026-11-27`) → `201` insert + `200` deduplicated.
- **Next Step:** Copy `AGENT_WEBHOOK_SECRET` from local gitignored `.env.local` into your Grok bot runner and sign into `https://primal-directive-loose-ends-co.vercel.app/signals` to verify the smoke-test signal in the UI.

### 2026-11-27 13:57 EST — Antigravity
- **Root Cause Confirmed via Live Vercel Logs & Integrations:** Logged in as `jcoop010` and linked `loose-ends-co/primal-directive`. Live production logs show `(ENOTFOUND) tenant/user postgres.kxtcfvsitqmdznopaufh not found` on `/api/auth/sign-in/social` and `/api/auth/sign-in/email`. `vercel integration list --all` confirmed both Vercel Marketplace Supabase stores attached to `primal-directive` (`supabase-carmine-lever` = `kxtcfvsitqmdznopaufh` and `supabase-camel-flame` = `vdactpndbcwqvsfbzjrk`) are **Suspended**.
- **Secret Provisioned:** Added `AGENT_WEBHOOK_SECRET` (from gitignored `.env.local`) as a Sensitive Secret to both Vercel **Production** and **Preview** on `loose-ends-co/primal-directive`. Deleted temporary `.env.vercel.prod` and restored `.gitignore`.
- **Next Step:** Either (A) add `DATABASE_URL` (the `rgivgiwfmoehrcmwakwk` `us-east-2` Session Pooler URI from Supabase Connect) in Vercel Production & Preview (which overrides the suspended `POSTGRES_*` vars), or (B) un-suspend `supabase-carmine-lever` in Vercel Storage if preserving Oct 2026 data. Then merge PR #274 and run live `/api/health`, `oauth-state-smoke.mjs`, and `/api/intake/agent-signal` smoke tests.

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
