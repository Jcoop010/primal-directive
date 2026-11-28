# Primal Directive — Shared Multi-Agent State

> **Mandatory Protocol:** Every agent (**Antigravity, Cursor, OpenCode, Jules**) MUST read this file before starting work and append a 3-bullet handoff entry under **Recent Agent Handoffs** before finishing. Never write secrets or token values into this file.

---

## Current Live Status

| Component | Status | Notes |
| --- | --- | --- |
| **Production App** (`https://primal-directive-loose-ends-co.vercel.app`) | **LIVE & HEALTHY (`HTTP 200` on `/api/health`)** | Backed by Neon Postgres `neon-cerulean-candle`. Migrations `0001`–`0014` landed cleanly on `main` (`c318b24`). |
| **Production Database (Neon `neon-cerulean-candle`)** | **ACTIVE_HEALTHY (IPv4, No Auto-Pause)** | Replaced suspended Vercel Supabase stores (`supabase-carmine-lever`, `supabase-camel-flame`). `DATABASE_URL` auto-injected in Production & Preview. |
| **Auth & Sign-In** | **PASS (Google + Email/Pass Live)** | `scripts/oauth-state-smoke.mjs` passed (`HTTP 200`, host-only `__Host-` state cookie). Microsoft OAuth ready once Entra creds are verified. |
| **Band Discovery, Scoring & Conversion (`/signals` → `/gigs`)** | **LIVE & CLOSED-LOOP** | `POST /api/intake/agent-signal` (Bearer `AGENT_WEBHOOK_SECRET`) scores band/live-music signals (`0011`), surfaces them on `/signals`, and converts them idempotently into `status: "lead"` gigs (`0012`) linked to `/gigs?gig=<id>`. |

---

## Active Branch / PRs

- **Merged:** PR #274 (`0009` + `0010`), PR #275 (`0011_agent_signals_scoring.sql`), PR #277 (`0012_agent_signals_conversion.sql`), PR #276 (Band & live-music scout pivot + scheduled workflow).
- **Stale Open PR:** `#264` (`feat/microsoft-signin-20261022`) — superseded by merged PR `#265`; safe to close.

---

## Recent Agent Handoffs

### 2026-11-27 22:55 EST — Antigravity
- **Elite OS System & Interface Upgrade (`feat/elite-os-upgrade`):** Grouped sidebar navigation into **Booking / Operations / Business**, added `Signals` to the 5-slot mobile bottom bar, removed the dead `SCENE INTEL` pill, upgraded `⌘K` into a workspace command search (pages, saved gigs, contacts, quick actions), and collapsed `/gigs` Gmail debug tools into a clean expandable panel.
- **Closed-Loop Booking Flow (`/signals` → `/gigs` → `/tour` → `/outreach`):** Wired `0014` Pre-Show Net Yield into `/tour` (live gross, road/room + linked costs, net yield, break-even heads, clickable stops), added **Open in Outreach →** from `GigDrawer` to `/outreach?gig=<id>` (auto-prefills recipient, source URL, subject, and draft; human-reviewed only), and added `/signals` keyword search, **Needs triage** filter, and 1-click **My gap** auto-anchors from booked/hold shows.
- **Zero-Warning Hygiene & Verification:** Cleared all 3 lingering ESLint warnings (`app-shell.tsx`, `use-current-user.ts`, `outreach-audit.ts`), renamed `Production Health Keepalive` workflow, added unit tests in `src/lib/agent-signal.test.ts`, and verified tests, typecheck, lint (0 errors / 0 warnings), and production build.

### 2026-11-27 17:03 EST — Antigravity
- **PR #282 Merged & Live (`main@c318b24`, `dpl_2wjTmcsDSbk7nbekT6WVMFweM6CA`):** Squash-merged `feat/preset-gap-sort-reset` into `main` (`c318b24130fbc029b291d7497d7dfda48ad91ef2`) after green CI (`validate`, `verify`, preview deploy) and promoted `primal-directive-c0u09q95w-loose-ends-co.vercel.app` to `https://primal-directive-loose-ends-co.vercel.app` (`[migrate] up to date.` for `0001`–`0014` on Neon Postgres `neon-cerulean-candle`).
- **Live Production Checks PASSED (Zero Extra Test Rows):** `GET /api/health` → `200` (`commit: c318b24130fbc029b291d7497d7dfda48ad91ef2`), `scripts/oauth-state-smoke.mjs` (`AUTH_SMOKE_ORIGIN=https://primal-directive-loose-ends-co.vercel.app`) → `200`, `GET /signals` → `200` (5,952 bytes, clean SSR HTML), and `GET /gigs` → `200` (clean SSR HTML).
- **Next Step:** Open `/signals` in a signed-in browser, apply a restrictive filter (e.g. `Archived` + `Low`), then click each Southeast/Midwest corridor preset (`I-40 · Nashville → Asheville`, `I-75 · Nashville → Atlanta`, `I-65 · Nashville → Chicago`, `Midwest · Louisville → Appleton`) to confirm anchors populate, sort switches to **Gap fit**, and matching leads surface immediately.

### 2026-11-27 16:56 EST — Antigravity
- **Touring Corridor Presets & Stale-Filter Reset (`feat/preset-gap-sort-reset`):** Added 4 Southeast & Midwest touring corridor presets (`I-40 · Nashville → Asheville`, `I-75 · Nashville → Atlanta`, `I-65 · Nashville → Chicago`, `Midwest · Louisville → Appleton`), expanded `REGION_ALIASES` for Midwest states (`KY`, `IN`, `IL`, `OH`, `WI`), and added pure state helpers (`applyCorridorPreset`, `clearAnchorsFromFilterState`, `createDefaultSignalsFilterState`) in `src/lib/agent-signal-scoring.ts`.
- **`/signals` UX Wiring (`src/routes/signals.tsx`):** Clicking any touring corridor preset populates `Prev stop`, `Prev date`, `Next stop`, and `Next date`, switches `Sort` to **Gap fit** (`gap`), and resets active status/priority filters to `all` so matching routing signals surface immediately; manual anchor edits clear the active preset pill, and `Clear anchors` / `Reset filters & anchors` stay predictable.
- **Verification & Next Step:** Added unit tests in `src/lib/agent-signal.test.ts` verifying preset anchor population, gap-sort switch, stale filter reset, and `Clear anchors` behavior. Ran tests, `typecheck`, `lint`, and production build; opened PR for review before merging into `main`.

### 2026-11-27 16:53 EST — Antigravity
- **Southeast & Midwest Queue Expansion Merged & Live (PR #281, `main@6b546d1`, `dpl_4qepxg9wAa8qfExF5wbLCyeKkxEz`):** Appended 7 verified `https://` Southeast & Midwest live-music opportunities to `data/lead-scout-queue.json` (13 total: Cat's Cradle, The Pour House Music Hall, Zanzabar, HI-FI Indy, The Empty Bottle, MOTR Pub, Mile of Music), tightened `scripts/lead-scout-push.mjs` to `https:`-only + non-X/Twitter, and added a full queue-integrity test in `scripts/lead-scout-push.test.mjs`.
- **Production Double-Push PASSED:** Promoted `dpl_4qepxg9wAa8qfExF5wbLCyeKkxEz` (`GET /api/health` → `200` at `6b546d1c32c9f5357ea534bac268a26cc0f5abb2`), then ran `node scripts/lead-scout-push.mjs` twice against production: Run 1 → `7 inserted (201, fitScore: 100)` + `6 deduplicated (200)`; Run 2 → `0 inserted` + `13 deduplicated (200)` (`0 rejected`, `0 failed`).
- **Next Step:** Open `/signals` on `https://primal-directive-loose-ends-co.vercel.app/signals` to triage all 13 live Southeast & Midwest band opportunities and test anchor-date routing gap scoring (e.g. `Prev stop: Nashville`, `Next stop: Chicago`).

### 2026-11-27 16:38 EST — Antigravity
- **PR #280 Merged & Live (`main@d98f997`, `dpl_AV6xp6GuanJHYB9eerEAQXffe9Bx`):** Squash-merged `feat/signals-gigdrawer-ui-polish` into `main` (`d98f9977d21e39ddfed3f5ede994188a004f242f`) after green CI (`validate`, `verify`, preview deploy) and promoted `primal-directive-3u74z4nd0-loose-ends-co.vercel.app` to `https://primal-directive-loose-ends-co.vercel.app` (`[migrate] up to date.` for `0001`–`0014` on Neon Postgres `neon-cerulean-candle`).
- **Live Production Verification PASSED (Zero Extra Test Rows):** `GET /api/health` → `200` (`commit: d98f9977d21e39ddfed3f5ede994188a004f242f`), `scripts/oauth-state-smoke.mjs` (`AUTH_SMOKE_ORIGIN=https://primal-directive-loose-ends-co.vercel.app`) → `200`, `GET /signals` → `200` (5952 bytes, clean SSR HTML), and `GET /gigs` → `200` (5653 bytes, clean SSR HTML).
- **Next Step:** Open `/signals` in a signed-in browser to review the polished 3-second scannable card hierarchy, test Prev/Next anchor gap sorting + mobile responsiveness, and open a converted lead in `/gigs?gig=<id>` to verify the sticky Net Yield header and `Copy draft` button.

### 2026-11-27 16:24 EST — Antigravity
- **`/signals` UI/UX Polish (`feat/signals-gigdrawer-ui-polish`):** Rebuilt `src/routes/signals.tsx` card hierarchy for 3-second scanning (Title/Source/Corridor + `tabular-nums` Score/Gap badges top row, routing/bill metadata chips + single-line fit/action summary middle row, collapsible Details/source/payload drawer, distinct Converted/Archived visual states, per-action loading labels, and one-click empty-state filter/anchor reset).
- **`GigDrawer` Sticky Net-Yield & Ergonomics:** Added a sticky top `tabular-nums` summary header (Net Yield, Merch Gross, Break-Even Heads, Break-Even \$/Head) inside `src/components/forms.tsx` and reorganized fields into 3 scannable sections (`1. Show economics & gap context`, `2. Booking stage & readiness` pill toggles, `3. Outreach draft` with `Copied!` confirmation and human-review badge).
- **Verification & Next Step:** Verified `agent-signal.test.ts` (8/8), script tests (39/39), `typecheck`, `lint`, and `vite build`. Opened PR for owner review before merging into `main`.

### 2026-11-27 15:20 EST — Antigravity
- **PR #279 Merged & Live (`main@cf9f284`, `dpl_vYkAPKHd3YgH7f68TNQHgbrGJeg6`):** Merged `feat/routing-gap-and-net-yield` into `main`, promoted `primal-directive-ctsavhpwz-loose-ends-co.vercel.app` to `https://primal-directive-loose-ends-co.vercel.app`, and confirmed migrations `0001`–`0014` (`0014_routing_gap_and_yield.sql`) applied cleanly on Neon Postgres `neon-cerulean-candle`.
- **All Live Production Checks PASSED:** `GET /api/health` → `200` (`commit: cf9f284102d8dc368773d2838dc4f49d264325aa`), `scripts/oauth-state-smoke.mjs` → `200`, and `POST /api/intake/agent-signal` (`band-yield-check-2026-11-27`) → `201` insert + `200` deduplicated.
- **Next Step:** Open `/signals`, test anchor cities/dates (`Prev stop` / `Next stop`) + `Sort: Gap fit`, convert a Southeast band signal to a lead, and verify the live Pre-Show Net Yield & Break-Even estimator inside `/gigs?gig=<id>`.

### 2026-11-27 15:15 EST — Antigravity
- **Migration `0014` & Routing/Yield Math (`feat/routing-gap-and-net-yield`):** Added `migrations/0014_routing_gap_and_yield.sql` (`guarantee_or_split_est`, `est_attendance`, `merch_per_head_est`, `road_and_room_cost_est`, `anchor_gap_note`, `gap_fit_score`, registered in `scripts/migration-plan.test.mjs`) and pure `computeRoutingGapFit()` + `computePreShowYield()` helpers in `src/lib/agent-signal-scoring.ts`.
- **`/signals` Anchor Gap & `GigDrawer` Net Yield Estimator:** Added inline Prev/Next anchor city & date bar, Gap Fit badges/reasons, and `Sort: Gap fit` to `src/routes/signals.tsx`; wired gap & yield carryover into `convertAgentSignalToLead`; added live Pre-Show Net Yield + Break-Even Attendance/Merch estimator inside `GigDrawer` (`src/components/forms.tsx`, persisted via `app_state`).
- **Verification & Next Step:** Verified `agent-signal.test.ts` (8/8), script tests (39/39), `typecheck`, `lint`, and `vite build`. Opened Draft PR for review before merging into `main`.

### 2026-11-27 14:56 EST — Antigravity
- **Band Booking, Routing & Outreach Draft Engine (`0013`):** Added `migrations/0013_band_booking_routing.sql` (`corridor`, `bill_role`, `target_window`, `deal_type`, `booking_stage`, `epk_ready`, `tech_plot_ready`, `routing_checked`, `outreach_draft`), updated `agent-signal-scoring.ts` with corridor/bill-role boosts + tailored `buildBookingOutreachDraft()`, carried all metadata into `Convert to Lead` (`app_state` gigs), and added the Booking, Routing & Outreach Draft panel to `GigDrawer` + corridor/role/window chips on `/signals`.
- **Multi-Stream Band Discovery:** Expanded `data/lead-scout-queue.json` to 6 verified Southeast opportunities (venue bookings, tour support, regional routing, promoter bills, and 2 festival calls: Musicians Corner & Carolina Indie Fest; zero X/Twitter links) and forwarded routing/bill fields in `scripts/lead-scout-push.mjs`.
- **Verification & Next Step:** Merged to `main`, promoted Vercel production deploy (`0001`–`0013`), and verified live `/api/health` (`200`), `oauth-state-smoke.mjs` (`200`), and band signal push (`201` + `200 deduplicated`). Ready to triage and convert all 6 live band opportunities in `/signals`.

### 2026-11-27 14:43 EST — Antigravity
- **Phase 1 & 2 Reconciled & Merged:** Merged PR #275 (`0011_agent_signals_scoring.sql`) and PR #277 (`0012_agent_signals_conversion.sql` + idempotent `Convert to Lead` into `app_state` + `/gigs?gig=<id>` deep-link) onto `main` with zero migration collisions.
- **Band & Live-Music Pivot (PR #276):** Tuned `src/lib/agent-signal-scoring.ts` for bands, touring support, festivals, and regional routing; replaced B2B leads in `data/lead-scout-queue.json` with 4 verified Southeast live-music venues (zero X/Twitter URLs); updated `scripts/lead-scout-push.mjs`, `scripts/lead-scout-push.test.mjs`, and `.github/workflows/lead-scout-intake.yml`.
- **Next Step:** Verify live production deploy (`0001`–`0012`), run live double-push deduplication of band signals (`201` + `200 deduplicated`), and test **Approve → Convert to Lead → View lead** in `/signals`.

### 2026-11-27 14:25 EST — Cursor
- **Scoring & Migration 0011:** Added `migrations/0011_agent_signals_scoring.sql` (`fit_score`, `priority_tier`, `urgency`, `recommended_action`, `dedupe_fingerprint` + composite/partial indexes, registered in `scripts/migration-plan.test.mjs`) and pure deterministic scoring module `src/lib/agent-signal-scoring.ts` wired into both `POST /api/intake/agent-signal` and server-gated `src/lib/agent-signals.ts` reads.
- **`/signals` Triage Command Center:** Upgraded `src/routes/signals.tsx` with deep navy (`#0A1628`) / burnt orange (`#E25822` / `#D35400`) visual polish, status + priority filters, Highest Score (default) vs Newest sort, prominent score/urgency badges, recommended-action callouts, and single-click optimistic Approve/Archive actions with error rollback.
- **Verification & Next Step:** Verified `agent-signal.test.ts` (5/5), `migration-plan.test.mjs` (7/7), `brand-check.test.mjs` (29/29), `typecheck`, `lint`, and `vite build` on branch `feat/signals-scoring-triage`. Ready for owner review and PR merge into `main`.

### 2026-11-27 14:10 EST — Antigravity
- **Production DB & Deploy Live:** Disconnected suspended Vercel Supabase stores (`supabase-carmine-lever`, `supabase-camel-flame`), connected Neon Postgres `neon-cerulean-candle` (`Production` + `Preview`), merged PR #274 into `main` (`8629e7e`), and promoted `dpl_6pWeVE23ggCGZz3cug58Lzw7mmG7` to `primal-directive-loose-ends-co.vercel.app` (all migrations `0001`–`0010` applied).
- **All 3 Live Smoke Tests PASSED:** `GET /api/health` → `200 {"status":"ok","commit":"8629e7ef5172fede086f609779726c7b781ec248"}`; `scripts/oauth-state-smoke.mjs` → `200` (Google OAuth initiation verified); `POST /api/intake/agent-signal` (`smoke-test-2026-11-27`) → `201` insert + `200` deduplicated.
- **Next Step:** Copy `AGENT_WEBHOOK_SECRET` from local gitignored `.env.local` into your Grok bot runner and sign into `https://primal-directive-loose-ends-co.vercel.app/signals` to verify the smoke-test signal in the UI.
