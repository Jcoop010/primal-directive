# Primal Directive — deployment recovery and release checklist

Status: prepared for the next permitted deployment attempt; no production release authorized by this document.
Target: existing Vercel project `primal-directive`, domain `primal-directive.vercel.app`, repository `Jcoop010/primal-directive`.
Working branch: `feat/autonomous-band-os-foundation`.

## Why deployment is paused

The existing Vercel project rejected a deployment with HTTP 402, resource `api-deployments-free-per-day`, and a 24-hour retry window. A separate failed deployment reported `Resource provisioning failed`. Do not repeatedly retry while the quota is active. Do not create a replacement project, switch accounts, delete the other similarly named project, or merge the feature branch merely to bypass this blocker.

## Before retrying

- [ ] Confirm the account owner has resolved the quota/provisioning warning or the retry window has elapsed.
- [ ] Confirm the target remains the existing `primal-directive` project and the GitHub connection points to `Jcoop010/primal-directive`.
- [ ] Confirm latest branch SHA and inspect its GitHub Actions runs. Require both CI and Primal Directive quality checks to pass for that exact SHA.
- [ ] Review Vercel project settings and build logs for the provisioning error; do not infer that a successful GitHub build guarantees a successful Vercel deployment.
- [ ] Create one preview deployment only. If the platform still rejects it, stop and capture the returned error rather than retrying repeatedly.

## Preview acceptance test

Use a test band / disposable records if the app supports them. Never reset or clear real band data to make a test pass.

### Core navigation and persistence
- [ ] Load the app and sign in through the expected authentication flow.
- [ ] Open Command Center, gigs, people/contacts, money, tour, merch, tasks, and settings; confirm no blank screens or route errors.
- [ ] Create a test contact and gig; reload the page and confirm records persist.
- [ ] Confirm the intended server-backed persistence path and test the same account across a fresh session/device if available. Browser local storage alone is not cross-device persistence.
- [ ] Confirm the app does not leak data between separate band/user identities.

### Booking-to-show workflow
- [ ] Create a dated gig in a non-booked status; confirm it does not receive a confirmed-show task pack prematurely.
- [ ] Move it to Booked; confirm the six workflow tasks are generated once.
- [ ] Reload and repeat generation; confirm no duplicates and completed tasks remain completed.
- [ ] Confirm due dates for contract/deal review, advancing, promotion, merch pack, run sheet, and post-show reconciliation.
- [ ] Confirm external email, calendar, publishing, contract signing, and payment actions are not represented as completed unless a connected provider returns verifiable success.

### Merch and money integrity
- [ ] Add a test product, restock it, and record a sale linked to the test gig.
- [ ] Verify quantity-on-hand decreases by the sold quantity.
- [ ] Verify the sale creates both gross collected revenue and cost-of-goods expense with the same date and gig ID.
- [ ] Verify gross profit equals sales less saved unit cost; check that tour/show reporting does not double count merch.
- [ ] Attempt to oversell and submit an invalid quantity; confirm both are rejected without partial updates.
- [ ] Verify CSV export opens correctly and includes expected columns.

### Release gate
- [ ] GitHub tests, typecheck, auth invariants, lint, and production build pass on the exact deployed SHA.
- [ ] Preview smoke tests above pass and data integrity is confirmed.
- [ ] Check desktop/mobile layout and error states.
- [ ] Review deployment diff and confirm the target project/domain before any production promotion.
- [ ] Promote only after preview acceptance. Confirm production deployment status and test the production URL after promotion.
- [ ] If any gate fails, keep production unchanged and record the exact failure.

## Current code notes

- Newly booked gigs now receive generated show tasks automatically; the manual generator remains for backfilling existing bookings.
- Merch sale ledger calculation now records revenue and cost of goods together in the same store update. Dedicated unit tests cover the helper's amounts, show attribution, and invalid inputs.
- A passing GitHub production build does not prove Vercel deployment health, external integrations, or cross-device persistence.
