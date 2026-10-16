# Primal Directive release verification — 2026-10-16

This QA-only branch starts from production commit `636bb496fefa19fe8748ae93c6a0c5ea292ea6df` and intentionally changes no application code.

The existing `.github/workflows/ci.yml` runs on pull requests and performs auth invariants, typecheck, tests, lint, production build, browser smoke, and local authenticated browser acceptance. Inspect the CI job and artifacts before deciding whether production is certified.

Outstanding checks not established by a passing mock-based CI suite: live provider-backed research, controlled invalid production credentials, offline production fallback, and real Google OAuth sign-in. Never substitute a READY preview or successful mocked test for these live verifications.

Do not merge this QA-only branch merely to record the results.
