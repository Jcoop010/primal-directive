# Primal Directive — Engineering & Multi-Agent Operating Contract

**Primal Directive** is an Autonomous Band OS for independent musicians and working bands: booking intelligence, venue/contact CRM, show and tour economics, merch inventory/ledger, financial truth, and approval-gated outreach via Gmail and Outlook.

- **Repository:** `Jcoop010/primal-directive`
- **Production Vercel App:** `https://primal-directive-loose-ends-co.vercel.app`
- **Primary Database:** PostgreSQL (Supabase-hosted in production; embedded PGlite fallback in local dev/CI when `DATABASE_URL` is unset)

---

## 1. Exact Tech Stack

| Layer | Technology |
| --- | --- |
| Framework & Routing | TanStack Start (`@tanstack/react-start`) + TanStack Router (`@tanstack/react-router`, file-based routes in `src/routes/`) |
| UI & Styling | React 19, Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`), Radix UI primitives, Lucide icons, Recharts, Sonner |
| State & Validation | Zustand (`src/lib/store.ts`), TanStack Query, React Hook Form, Zod v4 |
| Server / Build Runtime | Nitro (`preset: "vercel"`, `serverDir: "./server"`) |
| Authentication | Better Auth (`better-auth` ~1.6.30) with Google OAuth, Microsoft Entra ID OAuth (`common` tenant, PKCE), Email/Password, encrypted OAuth token storage, and `__Host-` session/state cookies |
| Database & Migrations | Direct PostgreSQL via `pg` (`src/lib/db.ts`), Kysely (Better Auth adapter), PGlite (`@electric-sql/pglite`) for local/test isolation, versioned SQL migrations in `migrations/000N_*.sql` |
| Payments | Stripe SDK v22 (`src/lib/billing.ts`, `src/lib/billing.server.ts`, `src/routes/api.stripe.webhook.ts`) — gated behind `BILLING_ENABLED` & `STRIPE_LIVE_VERIFIED` |
| Testing & QA | Node built-in test runner (`node --test` + `--experimental-strip-types`), ESLint 9, Prettier, TypeScript 5.7 (`tsc --noEmit`), Playwright Chromium |

---

## 2. Folder Conventions & Protected Contracts

- `src/routes/` — TanStack Router file-based pages and server API routes (`api.health.ts`, `api.auth.$.ts`, `api.stripe.webhook.ts`). Put all new API routes here, **never** in `server/`.
- `src/components/` — Reusable UI components (`src/components/ui/` for Radix primitives).
- `src/lib/` — Domain logic, server functions (`createServerFn`), persistence, billing, mailboxes, outreach safety, and `src/lib/auth/`.
  - **Strict `.server.ts` rule:** Any module importing `@tanstack/react-start/server`, `pg`, or server secrets **must** use the `.server.ts` suffix (or be dynamically imported inside a server-only handler) so Vite never bundles Node-only APIs into the browser.
- `migrations/` — Ordered, additive SQL files (`0001_auth.sql` through `0008_mailbox_connection_tests.sql`, etc.). Applied automatically on production build via `scripts/release-migrate.mjs` (advisory-locked) and on PGlite startup in dev/tests.
- `scripts/` — Build helpers, migration runner, auth invariant check (`scripts/check-auth-invariant.mjs`), and browser/integration smoke tests.
- `docs/` — Architecture blueprints, commercial launch registers, integration registers, and audit dossiers.
- **Do not delete or break:** `vite.config.ts` port contracts (`0.0.0.0:8080` dev, `127.0.0.1:8081` preview), `server/middleware/grok-pwa.ts`, `public/__grok/`, `startup.sh`, or `scripts/with-app-env.mjs`. Always start dev via `npm run dev` (never raw `vite`).

---

## 3. Supabase / PostgreSQL Schema & RLS Rules

1. **Migrations are the single source of truth.** Never execute DDL inside request handlers. Add new schema changes strictly as additive, ordered `migrations/000N_<name>.sql` files.
2. **No destructive migrations without explicit owner approval.** Never run `DROP TABLE`, `TRUNCATE`, or destructive column drops autonomously.
3. **Deny-by-default RLS on every `public.*` table:**
   - Every table in `public` **must** have `ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;`.
   - Because Primal Directive accesses Postgres via server-side `pg` + Better Auth (not browser PostgREST), keep zero permissive PostgREST policies on server-only tables AND explicitly `REVOKE ALL ON TABLE ... FROM anon, authenticated;` (and on every PL/pgSQL function).
4. **Server-side tenant isolation:**
   - Every private `createServerFn` **must** attach `.middleware([authMiddleware])` (which enforces `assertSameSiteRequest()` and `requireUserId()`).
   - Scope every SQL read/write by the verified `context.userId` (never a client-supplied user ID).
   - Never fall back to ephemeral PGlite when `VERCEL_ENV === "production"`.
5. **Outreach & billing safety invariants:**
   - All email sends must pass through `reserve_booking_outreach()` under the `outreach_dispatch_guard` lock and `bind_outreach_mailbox()` trigger.
   - Never auto-retry `failed`, `reserved`, or `unknown` email delivery attempts.
   - Never fabricate venue contacts, delivery receipts, or booking confirmations.

---

## 4. Strict Multi-Agent Lane Separation

To prevent conflicting edits, schema drift, and unauthorized external side effects, all agents must respect these lanes:

| Agent / System | Permitted Lane | Explicitly Prohibited |
| --- | --- | --- |
| **Cursor** | Surgical refactors, TypeScript types, single-component or single-module edits, targeted bug fixes, and unit test additions. | Multi-file architectural rewrites, database migrations, CI/CD workflow changes, or direct deployments. |
| **Antigravity** | Multi-file feature builds, SQL migrations (`migrations/`), GitHub Actions/DevOps workflows, security & RLS audits, and Playwright/E2E verification. | Pushing directly to `main`, running destructive DB migrations, or printing/committing secrets. |
| **External Research Bots** | **Structured webhook intake only** (validated JSON payloads with verified source URLs and timestamps into a dedicated intake queue/endpoint). | Direct database writes, direct Git pushes, mailbox/outreach execution, or **any X/Twitter integrations**. |

> **No X/Twitter integrations:** Do not add, re-enable, or depend on X/Twitter OAuth, X posting/scraping, or X-coupled research pipelines. Keep `GROK_PROVIDERS` free of X/Twitter login and route external venue/lead discovery strictly through structured, source-cited webhook intake.

---

## 5. Security & Workflow Guardrails

1. **Branch-and-PR workflow only:** Never push directly to `main`. All changes go through a feature/chore branch and a Pull Request that passes CI (`typecheck`, `lint`, `test`, `check:auth`, `build`).
2. **Zero secrets in repo or logs:** Never commit `.env` files, API keys, OAuth client secrets, Stripe keys, or connection strings. Never echo or print secret values in terminal output, workflow logs, or markdown docs (variable names only).
3. **Release flags stay locked:** Never enable `OUTREACH_SEND_ENABLED`, `OUTREACH_RELEASE_VERIFIED`, `BILLING_ENABLED`, or `STRIPE_LIVE_VERIFIED` without explicit owner authorization and verified test evidence.
4. **Verification before PR:** Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` locally before opening or updating a PR.

---

## 6. Brand-Asset Pass Compatibility (Pinned by `scripts/brand-check.test.mjs`)

6. **Brand-asset pass — a subagent, never waited for.** When updating `public/` brand assets and `src/lib/og/site.json`, never block the main loop on it: **No `wait_tasks`, never `get_task_output`** on the brand pass. While running, it keeps `/workspace/.grok/og-pending` fresh (stale after 10 minutes).
7. **Post-edit verification:** Always verify `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` before merging.
