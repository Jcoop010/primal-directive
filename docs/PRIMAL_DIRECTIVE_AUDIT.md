# Primal Directive — Principal Systems Audit & Gemini Handoff Dossier

**Audit Date:** 2026-11-27  
**Repository:** `Jcoop010/primal-directive` (branch: `chore/primal-directive-revival`, base `main` @ `5b372ac`)  
**Production URL:** `https://primal-directive-loose-ends-co.vercel.app`  
**Target Supabase IDs Audited:** `rgivgiwfmoehrcmwakwk` (external/inaccessible via connected MCP org) & `phygbwjhozjjipxosszj` ("Primal Directive" in connected org `bzdreuvqbamxjljogeyv`, restored from `INACTIVE` → `ACTIVE_HEALTHY`)

---

## 1. Product Snapshot

### What Primal Directive Currently Does
Primal Directive is an **Autonomous Band OS** built for working independent musicians, regional bands, and artist managers. Rather than a generic musician utility or chatbot wrapper, it unifies booking intelligence, show operations, tour economics, merch inventory/ledger, financial truth, and approval-gated outreach into one private, account-scoped operating workspace.

### Who It Serves
- **Primary ICP:** Working regional and independent bands (and DIY managers) who play regularly, coordinate gigs/advancing/merch across scattered spreadsheets and threads, and lose revenue to missed follow-ups or uncollected balances.
- **Commercial Target:** \$3,000 MRR (~25 active band workspaces at ~\$129/mo, or Founding Band at \$79/mo; existing live Stripe prices are configured at Pro \$19/mo and Studio \$39/mo, currently disabled behind feature flags).

### Live vs. Unfinished Matrix

| Capability | Status | Details |
| --- | --- | --- |
| **Command Center & Workspace Modules** (`/`, `/gigs`, `/people`, `/calendar`, `/money`, `/tour`, `/merch`, `/tasks`, `/board`, `/dashboard`) | **Live (App Code)** | Full React 19 / TanStack Start UI with Zustand client state synced durably to `public.app_state` per authenticated user (`DurableSync`). Auto-generates 6-step confirmed-show task packs; merch sales atomically update inventory + gross revenue + COGS. |
| **Public Pages** (`/demo`, `/pricing`, `/help`, `/legal`) | **Live (App Code)** | Public unauthenticated routes bypass `SignInGate`. Legal page explicitly notes final ToS/Privacy/support contact are unfinished. |
| **Authentication** (`/api/auth/$`) | **Live (Google + Email/Pass); Blocked (Microsoft)** | Better Auth v1.6 with Google OAuth, Email/Password, `__Host-` cookies, and encrypted OAuth tokens. Microsoft Entra ID flow is implemented in code (`common` tenant, PKCE) but **disabled in production** awaiting `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`. |
| **Gmail / Outlook Mailbox Sync & Outreach** (`/outreach`, `/account`) | **Implemented, Release-Gated** | Bounded 10-header inbox sync (never fetches bodies), reply-header polling every 60s while `/outreach` is open, artist-owned drafts, Outlook draft export, atomic dispatch guard (`reserve_booking_outreach`), quotas (5/hr, 20/day user; 100/hr, 500/day global), 72h contact cooldown, and one-time verified Gmail send proof (Oct 23, 2026). General outbound sending stays locked behind `OUTREACH_SEND_ENABLED` + `OUTREACH_RELEASE_VERIFIED`. |
| **Growth Advisor & Venue Research** (`src/lib/ai.ts`, `src/lib/venue-research-api.ts`) | **Live (Server-Gated)** | Supports Anthropic, Gemini (with optional Search Grounding), and xAI providers via server-only API keys. |
| **Stripe Billing** (`/api/stripe/webhook`, `src/lib/billing.ts`) | **Implemented, Disabled** | Checkout, Customer Portal, webhook signature verification, and transactional reconciliation implemented (`pd_billing_customers`, `pd_subscriptions`, `pd_stripe_events`), but **disabled** (`BILLING_ENABLED` / `STRIPE_LIVE_VERIFIED` unset; sandbox test proof pending). |
| **Durable Background Automation Worker** (`src/lib/automation-worker.ts`, `automation_runs`) | **Partially Built (No Scheduler)** | State machine, retry backoff, and Postgres table `automation_runs` exist with unit tests, but **no cron trigger / worker loop** is wired yet (autonomous follow-ups & continuous inbox sync are intentionally unreleased). |
| **Production Availability (`/api/health`)** | **CURRENTLY DOWN (HTTP 503)** | Live probe on 2026-11-27 returned `HTTP 503 {"status":"unavailable"}`, indicating the production Postgres/Supabase database wired to Vercel is paused or unreachable. |

---

## 2. Architecture & Stack

### Core Framework & Packages
- **App Framework:** TanStack Start (`@tanstack/react-start` 1.168) + TanStack Router (`@tanstack/react-router` 1.170, file-based routing in `src/routes/`)
- **Frontend:** React 19.2, Vite 8.2, Tailwind CSS v4, Radix UI primitives, Lucide React, Recharts 2.13, Sonner, Zustand 5, TanStack Query 5, TanStack Table 8, React Hook Form + Zod 4
- **Server Runtime & Deploy:** Nitro v3 (`preset: "vercel"`, `serverDir: "./server"`), deployed via GitHub → Vercel (`Production – primal-directive` and `Production – primal-directive-preview`, last successful deploy Oct 23, 2026 @ `5b372ac`)
- **Database Layer:** Direct PostgreSQL via `pg` (`src/lib/db.ts`) + Kysely (Better Auth); embedded `@electric-sql/pglite` for local dev and isolated unit/CI tests. Production refuses to boot on PGlite if `VERCEL_ENV === "production"` and no Postgres URL is set.
- **Auth Providers:** Better Auth `~1.6.30` with:
  - Google OAuth (direct + Grok broker `grok-google`)
  - Microsoft Entra ID OAuth (`common` tenant, PKCE, `openid profile email` login scopes; separate explicit consent for `Mail.ReadBasic`, `Mail.Send`, `Mail.ReadWrite`, `offline_access`)
  - Email & Password (`emailAndPasswordEnabled`)
  - Encrypted OAuth token storage (`encryptOAuthTokens: true`), `disableImplicitLinking: true`

### Key Routes & API Endpoints
- **UI Routes (17):** `/`, `/dashboard`, `/board`, `/gigs`, `/people`, `/calendar`, `/money`, `/tour`, `/merch`, `/tasks`, `/outreach`, `/account`, `/demo`, `/pricing`, `/help`, `/legal` (+ `/auth/popup` served by Vite middleware in dev).
- **API Endpoints (3):**
  - `GET /api/health` — Read-only DB readiness check (`to_regclass(...)` on core tables; returns 200 `{ status: "ok", commit, outreachSending }` or 503).
  - `ALL /api/auth/$` — Better Auth handler (OAuth callbacks: `/api/auth/callback/google`, `/api/auth/callback/microsoft`, `/api/auth/oauth2/callback/grok-google`).
  - `POST /api/stripe/webhook` — Stripe webhook with 1MB payload cap, signature verification (`constructEvent` with 300s tolerance), and idempotent event receipts.
- **Server Functions (`createServerFn`):** 26 private functions across `ai.ts`, `billing.ts`, `gmail-inbox.ts`, `gmail-status.ts`, `mailboxes.ts`, `outreach.ts`, `persistence.ts`, `venue-research-api.ts` — **26/26 guarded by `authMiddleware`**. 1 public function (`signInCapabilities` in `auth-capabilities.ts`, returns `{ microsoft: boolean }` only).

### Database Schema (Versioned Migrations `migrations/0001`–`0008`)
- **Auth (`0001_auth.sql`):** `"user"`, `session`, `account`, `verification`
- **Workspace State (`0002_app_state.sql`):** `app_state` (JSONB per-user durable store with `version` optimistic tracking)
- **Security (`0003_security_hardening.sql`):** Enables RLS on auth tables, `app_state`, `stripe_webhook_events`
- **Automation (`0004_automation_runs.sql`):** `automation_runs` (idempotent band-scoped queue)
- **Outreach (`0005_outreach_delivery.sql`):** `outreach_delivery_audit`, `outreach_dispatch_guard`, `outreach_preferences`, `outreach_suppressions`, `outreach_approvals`, PL/pgSQL `reserve_booking_outreach()`
- **Billing (`0006_billing.sql`):** `pd_billing_customers`, `pd_subscriptions`, `pd_stripe_events`
- **Mailboxes (`0007_mailboxes.sql`, `0008_mailbox_connection_tests.sql`):** `mailbox_preferences`, `mailbox_connections`, `mailbox_events`, `mailbox_messages`, `mailbox_drafts`, `mailbox_connection_tests`, trigger `bind_outreach_mailbox()`

### Required Vercel Environment Variable Names (Names Only — Zero Values)
- **Database (checked in priority order by `src/lib/db.ts` & `src/lib/auth/server.ts`):** `DATABASE_URL`, `STORAGE_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_URL`, `database_POSTGRES_PRISMA_URL`, `database_POSTGRES_URL_NON_POOLING`, `database_POSTGRES_URL`
- **Auth & OAuth:** `BETTER_AUTH_SECRET` (required in prod), `BETTER_AUTH_URL`, `VITE_AUTH_ENABLED`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `GROK_AUTH_ISSUER`, `GROK_AUTH_CLIENT_ID`, `GROK_AUTH_CLIENT_SECRET`
- **AI Advisors:** `ANTHROPIC_API_KEY`, `ANTHROPIC_WEB_SEARCH_ENABLED`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_SEARCH_GROUNDING_ENABLED`, `XAI_API_KEY`
- **Stripe & Release Gates:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_TEST_PRO_PRICE_ID`, `STRIPE_TEST_STUDIO_PRICE_ID`, `BILLING_ENABLED`, `STRIPE_LIVE_VERIFIED`, `OUTREACH_SEND_ENABLED`, `OUTREACH_RELEASE_VERIFIED`, `MAILBOX_TEST_GRANT`, `OUTREACH_VERIFICATION_GRANT`

---

## 3. Health & Security Findings

### Infrastructure & Connectivity Status
- **GitHub CLI (`gh`):** Connected as `Jcoop010` (`repo`, `workflow`, `read:org`, `gist` scopes). Recent CI & Quality workflows on `main` (`5b372ac`) were green as of Oct 23, 2026. Open stale PR `#264` (`feat/microsoft-signin-20261022`) appears superseded by merged PR `#265` and should be closed.
- **Vercel CLI / MCP:** Not installed or authenticated in this environment (`vercel` CLI not found; no local Vercel auth token). Deployment history was verified via GitHub Deployments API, and live production was probed directly.
  - To enable local Vercel CLI inspection: `npm i -g vercel && vercel login && vercel link` (then `vercel env ls` and `vercel logs primal-directive-loose-ends-co.vercel.app`).
- **Supabase MCP (`supabase_mcp`):** Connected to org `bzdreuvqbamxjljogeyv` (`coop29knight@yahoo.com`).
  - **Project ID Mismatch & Split-Brain Risk:** Target ID `rgivgiwfmoehrcmwakwk` returned `You do not have permission to perform this action` (belongs to another Supabase org/account or Vercel-managed integration). Meanwhile, org `bzdreuvqbamxjljogeyv` contains project **`phygbwjhozjjipxosszj` ("Primal Directive")**, which was **`INACTIVE` (paused)** and has been **restored to `ACTIVE_HEALTHY`** during this audit.
  - `phygbwjhozjjipxosszj` holds 47 empty tables (an older Sept 2026 relational schema + Better Auth/app_state bridge, 0 rows, missing migrations `0004`–`0008`) and 3 legacy Supabase Edge Functions (`create-checkout-session`, `create-portal-session`, `stripe-webhook`). Per `docs/COMMERCIAL_LAUNCH_REGISTER_2026-10-22.md`, Vercel production was wired to separate integration stores (`kxtcfvsitqmdznopaufh` / `vdactpndbcwqvsfbzjrk`, or `rgivgiwfmoehrcmwakwk`).
  - **LIVE PRODUCTION OUTAGE:** `GET https://primal-directive-loose-ends-co.vercel.app/api/health` returned **`HTTP 503 {"status":"unavailable"}`**. The active production database wired to Vercel is paused or unreachable.

### Legacy Netlify & Background Jobs Scan
- **Netlify:** **Zero legacy Netlify files** (`netlify.toml`, Netlify functions, or Netlify references) exist anywhere in the repository. No Netlify migration is needed.
- **Background Jobs / Agent Runner:** `src/lib/automation-worker.ts` and `migrations/0004_automation_runs.sql` implement a durable automation queue (`automation_runs`), but no scheduler invokes it yet. When ready to activate, wire a **Vercel Cron Job** (`vercel.json` → `POST /api/cron/automation-tick` authenticated via `CRON_SECRET`) or a **Supabase Edge Function + `pg_cron`**.
- **Legacy Supabase Edge Functions on `phygbwjhozjjipxosszj`:** 3 older Stripe Edge Functions (`create-checkout-session`, `create-portal-session`, `stripe-webhook`) are active on `phygbwjhozjjipxosszj` and duplicate the current TanStack Start `/api/stripe/webhook` + `src/lib/billing.ts` implementation. Retire or archive once database consolidation is confirmed.

### Codebase, OAuth & RLS Audit Findings
1. **Local Verification Results (on `chore/primal-directive-revival`):**
   - `npm run typecheck` (`tsc --noEmit`): **PASS** (0 errors).
   - `npm run lint` (`eslint .`): **PASS** (0 errors; 3 pre-existing warnings in `src/components/app-shell.tsx`, `src/lib/auth/use-current-user.ts`, `src/lib/outreach-audit.ts`).
   - `node ./node_modules/vite/bin/vite.js build` (Vite 8 + Nitro `vercel` preset): **PASS** (`✓ built in 3.25s`). Note: on Windows, `scripts/with-app-env.mjs` spawns `vite` without `.cmd` (`ENOENT`); Ubuntu CI is unaffected.
   - `scripts/brand-check.test.mjs`: **29/29 PASS** after aligning `AGENTS.md` compatibility section. Full `npm test` passed 215/218 on Windows (2 Windows-only `EPERM: symlink` failures in `check-auth-invariant.test.mjs` and `with-app-env.test.mjs`; 1 skipped Postgres test without `TEST_DATABASE_URL`).
   - `npm audit`: **13 vulnerabilities** reported during `npm ci` (2 low, 7 moderate, 3 high, 1 critical) + deprecation notices for `recharts@2.15.4` and `eslint@9.39.5`.
2. **OAuth Security (Strong, with 1 Missing Config & 1 Hygiene Note):**
   - Google & Microsoft OAuth flows use Better Auth PKCE, signed `__Host-primal-directive.oauth_state` cookies, `encryptOAuthTokens: true`, `disableImplicitLinking: true`, and explicit scope separation (login never requests mail scopes).
   - Microsoft token refresh properly omits `scope` so mail permissions are not narrowed on renewal (`src/lib/auth/microsoft.server.ts`).
   - **Gap:** Microsoft OAuth is unconfigured in Vercel (`MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` absent), leaving Outlook login/sync/drafts unavailable in production.
   - **Note:** `src/lib/auth/server.ts` sets `prompt: "consent"` on Google login (`socialProviders.google`), which forces a consent screen on every Google sign-in (similar to the Microsoft issue fixed in PR `#269`). Consider switching login to `prompt: "select_account"` and reserving `prompt: "consent"` for explicit mailbox linking in Account.
3. **RLS & Privilege Hardening Gaps:**
   - **Good:** All 26 private `createServerFn` handlers enforce `authMiddleware` (`assertSameSiteRequest()` + `requireUserId()`). All app tables in migrations `0001`–`0008` enable RLS with zero permissive PostgREST policies (deny-by-default).
   - **Gap 1 (Missing explicit `REVOKE`):** Migrations `0001`–`0004` and `0006` rely solely on RLS without explicit `REVOKE ALL ON TABLE ... FROM anon, authenticated` (unlike `0005`, `0007`, `0008`). Adding an additive hardening migration (`0009_revoke_browser_roles.sql`) to revoke `anon`/`authenticated` on `"user"`, `session`, `account`, `verification`, `app_state`, `automation_runs`, `pd_*`, `_migrations`, and `bind_outreach_mailbox()` will close defense-in-depth gaps.
   - **Gap 2 (Supabase Auth Advisor WARN):** `phygbwjhozjjipxosszj` flagged `auth_leaked_password_protection` (HaveIBeenPwned check disabled in Supabase Auth).
4. **Dead / Stale Artifacts:**
   - Open PR `#264` (`feat/microsoft-signin-20261022`) is superseded by merged PR `#265`.
   - `recharts@2.15.4` is deprecated (upgrade path to Recharts v3 when convenient).
   - `AGENTS.md` previously contained generic Grok App Builder boilerplate; replaced in this PR with Primal Directive's real contract + `.cursorrules`.

---

## 4. Top 5 Leverage Upgrades

1. **Automated Venue & Booking Lead Intake Webhook (`POST /api/intake/venues` + Supabase Queue)**
   - **Architecture:** Build a signed, Zod-validated webhook endpoint (using `INTAKE_WEBHOOK_SECRET` HMAC verification) that accepts structured JSON payloads from external research bots (n8n, Apify, or custom scrapers — zero X/Twitter dependencies) with mandatory `source_url`, `verified_at`, `venue_name`, `city`, `capacity`, and `booking_contact`. Store in a new `venue_intake_queue` table (RLS-locked) and surface in `/outreach` as a "Review & Import" queue.
   - **Lane:** Antigravity builds migration + webhook endpoint + E2E test; Cursor refines Zod schemas and UI review drawer.

2. **Observability & Error Monitoring with Sentry (GitHub Student Pack)**
   - **Architecture:** Wire `@sentry/react` + `@sentry/node` (free via GitHub Student Developer Pack) into `src/router.tsx` (`AppErrorComponent`), `src/routes/api.stripe.webhook.ts`, and `src/lib/mailbox-provider.server.ts` with PII scrubbing (`sendDefaultPii: false`, stripping OAuth tokens/email bodies). Add Sentry source map upload in `.github/workflows/ci.yml` on `main`.
   - **Impact:** Instant visibility into silent 503 DB pauses, Gmail/Graph 401/403 token errors, and Stripe webhook failures.

3. **Custom Production Domain & Branded Email Deliverability (GitHub Student Pack — Namecheap/Name.com)**
   - **Architecture:** Claim a free `.me` / `.tech` / `.live` domain via GitHub Student Pack (e.g., `primaldirective.live` or `primaldirective.app`), attach it to Vercel (`primal-directive`), update `BETTER_AUTH_URL` / OAuth redirect URIs, and configure **SPF, DKIM, and DMARC** records.
   - **Impact:** Eliminates `.vercel.app` trust friction during band onboarding and fixes the Yahoo Junk placement issue observed during the Oct 23 Gmail send test.

4. **Durable Automation Runner via Vercel Cron + `automation_runs` Queue**
   - **Architecture:** Add `vercel.json` with a scheduled Vercel Cron (`/api/cron/automation-tick` every 15 minutes, guarded by `CRON_SECRET`) that drains due rows from `public.automation_runs` using the already-tested `executeAutomationTick()` in `src/lib/automation-worker.ts`. Start with internal-only actions (overdue deposit reminders, 7-day advancing alerts, stale booking follow-up drafts) before enabling external sends.
   - **Impact:** Turns Primal Directive from a passive dashboard into a true closed-loop Autonomous Band OS without adding paid worker infrastructure.

5. **Cloud-Hosted E2E Staging & Stripe Sandbox Launch Gate (GitHub Student Pack — DigitalOcean/Azure Credits)**
   - **Architecture:** Use a dedicated staging Supabase branch + Stripe Sandbox keys (`STRIPE_TEST_PRO_PRICE_ID`, `STRIPE_TEST_STUDIO_PRICE_ID`) to run the full Checkout → Webhook → Entitlement → Portal → Cancellation suite in CI, closing the P0 billing blocker so Founding Band (\$79/mo) or Pro/Studio subscriptions can launch cleanly.

---

## 5. Manual Blockers (Exact Actions Required by Owner)

1. **[P0 — CRITICAL] Unpause Active Production Database (`rgivgiwfmoehrcmwakwk`) & Confirm Vercel DB Binding**
   - **Why:** `https://primal-directive-loose-ends-co.vercel.app/api/health` is currently returning **`HTTP 503 {"status":"unavailable"}`**. Supabase project `rgivgiwfmoehrcmwakwk` is not accessible from the connected Supabase MCP org (`bzdreuvqbamxjljogeyv`), while `phygbwjhozjjipxosszj` has already been unpaused by this audit.
   - **Exact Clicks:**
     1. Log into the Supabase Dashboard account that owns `rgivgiwfmoehrcmwakwk` and click **Restore / Unpause Project**.
     2. In **Vercel Dashboard → `primal-directive` → Settings → Environment Variables**, confirm which Postgres host `DATABASE_URL` / `STORAGE_URL` points to (`rgivgiwfmoehrcmwakwk` vs `kxtcfvsitqmdznopaufh` vs `phygbwjhozjjipxosszj`).
     3. Once restored, verify `https://primal-directive-loose-ends-co.vercel.app/api/health` returns `200 {"status":"ok",...}` and manually trigger the new **Supabase Keepalive** GitHub Action to confirm green.

2. **[P0] Authenticate Vercel CLI Locally (for Future Autonomous Log/Env Audits)**
   - Run: `npm i -g vercel && vercel login && vercel link` inside the repo root (or connect the Vercel MCP server in Antigravity Plugins).

3. **[P1] Register Microsoft Entra ID App (to Enable Outlook Sign-In & Mailbox Sync)**
   - In [Microsoft Entra Admin Center](https://entra.microsoft.com/) → **App registrations → New registration**:
     - Supported accounts: **Any Entra ID Tenant + Personal Microsoft accounts**
     - Redirect URI (Web): `https://primal-directive-loose-ends-co.vercel.app/api/auth/callback/microsoft`
     - Delegated Graph permissions: `openid`, `profile`, `email`, `offline_access`, `Mail.ReadBasic`, `Mail.Send`, `Mail.ReadWrite`
   - Add `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` (Value, not Secret ID) in Vercel Production env vars and redeploy.

4. **[P1] Configure Stripe Sandbox & Live Webhook Secrets (Before Enabling Billing)**
   - Add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_TEST_PRO_PRICE_ID`, `STRIPE_TEST_STUDIO_PRICE_ID` in Vercel secrets; verify sandbox checkout/webhook lifecycle before setting `BILLING_ENABLED=true` and `STRIPE_LIVE_VERIFIED=true`.

5. **[P2] Enable Leaked Password Protection & Clean Up Legacy Resources**
   - In Supabase Dashboard → **Authentication → Attack Protection**, enable **Leaked Password Protection**.
   - Close superseded GitHub PR `#264` (`feat/microsoft-signin-20261022`).
   - Decide whether to decommission unused Supabase project `phygbwjhozjjipxosszj` (0 rows) and its 3 legacy Stripe Edge Functions once production DB binding is confirmed.
