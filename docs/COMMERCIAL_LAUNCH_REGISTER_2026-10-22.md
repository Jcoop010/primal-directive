# Primal Directive launch evidence — October 22, 2026

This register distinguishes implemented safeguards from externally verified capabilities. Commercial launch remains NO-GO until all release blockers below are resolved.

## Confirmed baseline

- Main was `fcb33c7bc1e8aedaf9a3cd3e04e3e86a7f58604c`; PR #257 was merged and its CI/quality runs succeeded.
- Deployment `dpl_3Skug3cDwyihzaNVAUgm78uXpeY2` ended ERROR: `Resource provisioning timed out`, before build logs were available.
- Most recent observed READY production deployment before this work: `dpl_EHPEoWhxQxBeR44UAxVHoFd78cNg`, commit `dfc68f79dd49d31f7be40b6b3475d5cc5acdb17a`.
- The public production sign-in screen rendered in a browser. No authenticated production session was available for this audit.
- Supabase project `phygbwjhozjjipxosszj` had zero rows in its Better Auth user and app_state tables and no `_migrations` table. Vercel has two sets of database integration variables; their values were not available from the connector. The database actually used by the serving deployment must be confirmed before claiming persistence verification.
- The connected Stripe account is live `acct_1UD6zyIS04s94hSM`. Existing active monthly USD prices: Pro `price_1UPXQ4IS04s94hSMW7JAMY7Y` (1900 cents), Studio `price_1UPXQ4IS04s94hSMbHavjP0F` (3900 cents). No products were created or changed.
- Vercel environment inventory had no Stripe runtime key, webhook signing secret, billing enable flag, or outreach release/send enable flags.

## Engineering implemented in PR #258

- Versioned outreach audit schema; removed request-time DDL.
- A PostgreSQL function updates a global dispatch guard before approval, suppression, duplicate, cooldown and quota checks and reservation. Account limits: 5/hour and 20/24h. Global limits: 100/hour and 500/24h. Every attempted reservation counts regardless of eventual provider status.
- Durable approvals include account, gig, recipient, exact subject/body fingerprint, official contact source supplied and verified by the user, policy version, timestamp and expiry. Default account state is paused. Pause revokes pending approvals. Direct browser roles cannot execute the reservation function.
- Gmail MIME transport accepts one mailbox, encodes UTF-8, captures provider message/thread IDs, and does not retry. Ambiguous errors and missing success receipts become unknown. Failed, reserved and unknown attempts cannot be automatically retried.
- Account/outreach pages expose OAuth status, separate read/send linking, manual reply-header preview, draft editing, explicit approval, revoke/pause, suppression and delivery activity. No automatic booking status changes are made from headers alone.
- Stripe-hosted checkout, persisted customer mapping, customer portal, exact-price checks, signature verification, transactional event receipts and current-subscription reconciliation. Customer locks serialize reconciliation; event metadata is not trusted for ownership. Past-due/unpaid/canceled/expired subscriptions do not grant paid entitlements.
- Existing workspace access is preserved while billing is disabled. Once BILLING_ENABLED is true, paid Advisor operations require server-side paid access. Gmail sending always requires paid access and both release gates.
- Production builds run versioned migrations using the configured app database. A PostgreSQL advisory lock serializes migrators. Preview/local builds do not automatically migrate external production databases.
- Public plans, help and factual service/privacy information pages. The latter explicitly identifies the final legal documents and support contact as unfinished.

## Release blockers

| Priority | Blocker | Evidence needed to close |
| --- | --- | --- |
| P0 | Gmail integration has no authorized test-account proof | Connect designated test sender and recipient; verify initial authorization, refresh/expiry, revocation, send receipt, inbox/thread match and suppression. No real venue outreach. |
| P0 | Stripe sandbox is unavailable to the current connector and runtime credentials are absent | Configure restricted sandbox API key and webhook secret in deployment secrets; configure test Pro/Studio prices; test checkout, webhook replay, upgrade/downgrade, renewal, cancellation and failed payment. Then configure the live webhook/key and verify before enabling live checkout. |
| P0 | Latest production provisioning failed | Latest main must deploy READY with exact SHA, migration evidence, HTTP/browser checks and clean runtime-error inspection. |
| P0 | Authenticated production and database binding are unverified | Confirm selected database and account-scoped save/reload, bookings, Gmail, billing and automation records using an authorized account. Preserve all existing data. |
| P0 | Autonomous workflow is incomplete | Opt-in policy-based sending, durable follow-up scheduling, reply-body classification, stop-condition handling and authorized pipeline updates need implementation and end-to-end tests before being advertised or enabled. |
| P1 | Final legal/commercial ownership details | Operator-approved terms/privacy, support contact, retention/deletion procedure, Google permission disclosures and tax registration decision. The current information page is not a legal agreement. |
| P1 | Operational launch coverage | Confirm backups, recovery drill, alerts, production analytics/conversion tracking, and support incident workflow. No new paid infrastructure is authorized. |

## Required configuration (values belong only in secret stores)

- `STRIPE_SECRET_KEY`: restricted Stripe key for the selected environment.
- `STRIPE_WEBHOOK_SECRET`: secret for `/api/stripe/webhook`.
- `STRIPE_TEST_PRO_PRICE_ID`, `STRIPE_TEST_STUDIO_PRICE_ID`: sandbox equivalents with the verified monthly amounts.
- `BILLING_ENABLED=true` only after commercial configuration and tests pass.
- `STRIPE_LIVE_VERIFIED=true` only after sandbox proof, live endpoint configuration and release approval evidence exist. This gate is not a substitute for testing.
- `OUTREACH_SEND_ENABLED=true` and `OUTREACH_RELEASE_VERIFIED=true` only after the authorized Gmail test-account flow passes.

Do not set release-verification flags simply to make a button work. Do not put keys into VITE variables or repository files. Review applicable sales-tax registrations before enabling automatic tax; it is not enabled in this change.

## Validation boundaries

Local TypeScript, lint (three pre-existing warnings), production build and the automated unit/regression suites passed during implementation. Local browser download failed and the environment prevented running a separate PostgreSQL process. GitHub CI supplies the real PostgreSQL concurrency/tenant test and browser acceptance. Exact final CI/deployment results belong in the release response; this document does not predict those results.

Gmail mock transport tests verify no retry on 401/403/429/500, network timeout and malformed provider receipt; these are not real Gmail integration tests. Stripe SDK signature tests and fixture-based database reconciliation are not real payment tests.
