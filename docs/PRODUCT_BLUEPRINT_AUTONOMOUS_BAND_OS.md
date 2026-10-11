# Primal Directive — Autonomous Band OS Product Blueprint

Status: implementation blueprint
Branch: feat/autonomous-band-os-foundation
Product principle: one trusted operating record, specialized agents, explicit permission boundaries.

## Product thesis

Primal Directive is not a collection of musician tools and not a chatbot placed over a dashboard. It is the operating system for running an independent band as a durable business. Its advantage must come from closing the loop between booking, show operations, audience growth, and money: every action creates or updates a record; every record can trigger a safe workflow; every workflow reports its result and learns from verified outcomes.

Do not claim "autonomous" for a workflow until it runs against real connected services, handles retries and duplicate events, records an audit trail, and exposes failures to the user.

## The five product pillars

1. Booking intelligence: venue and talent-buyer CRM, verified source links, fit scoring, personalized outreach, follow-up sequences, offer comparison, and pipeline conversion.
2. Show and tour operations: event lifecycle, availability, holds, contracts, advancing, hospitality, production, travel, member notifications, settlement, and post-show review.
3. Financial truth: income, expenses, receipts, invoices, deposits, balances, reimbursements, merch, mileage, member splits, cash flow, and show-level contribution margin.
4. Audience and business growth: EPK, content calendar, promotion checklists, mailing list and ticket links, campaign outcomes, and repeatable local-market growth.
5. Autonomous execution: durable task queue, scheduled rules, specialized agents, approvals, retries, observability, and a human-readable action log.

## Core UX: the Command Center

The first screen should answer, in order:
- What needs my attention today?
- What has Primal Directive already done?
- What money is expected, late, or at risk?
- What are the next shows and what is missing for each?
- What are the best next booking opportunities?
- What is the single highest-value next action?

Every metric must drill into source records. Never show fabricated sample metrics as if they were live data. Demo data must be clearly labeled and separable from a real band's records.

## Canonical event lifecycle

Use one shared lifecycle and explicit transitions:

lead -> researched -> qualified -> outreach_ready -> contacted -> negotiating -> hold -> contracted -> confirmed -> advancing -> performed -> settling -> settled

Terminal/exception states: lost, cancelled, postponed, disputed.

Transitions should be validated, timestamped, attributable to a user or agent, and idempotent. A hold is not a confirmed booking. An offer is not a contract. A draft email is not a sent email. A settlement estimate is not received money.

## Shared data model

Use the existing database and app-data patterns where viable; do not introduce a parallel store without an architectural reason.

- Organization / Band: identity, business settings, home market, genre, typical draw, fee floor, travel radius, tax year and timezone.
- Membership / Role: user, band, permissions, payout method metadata (never store raw bank credentials), active dates.
- Venue / Contact: normalized venue identity, address, room capacity, genres, verified contact channels, booking instructions, source URLs, confidence, last verified date.
- Opportunity / Outreach: target date, status, fit score with explanation, message draft, send status, provider message ID, follow-up schedule, reply classification.
- Offer / Contract: guarantee, door deal, expenses, deposit, payout timing, cancellation terms, technical requirements, document references, approval/signature status.
- Event / Show Advance: date/time/timezone, venue, set times, load-in, soundcheck, contacts, parking, hospitality, stage plot, input list, documents, member availability.
- Task / Automation Run: trigger, due time, owner/agent, status, attempts, idempotency key, evidence, errors, approval requirement, completion result.
- Transaction / Receipt / Invoice: amount, currency, date, counterparty, category, attachment reference, linked event, payment status, reconciliation status, audit history.
- Payout / Split: agreed split policy, eligible net proceeds, holds/reserves, calculated share, approval and payment status.
- Campaign / Content Asset: channel, goal, scheduled time, approval status, link/asset, results and attributed event where possible.
- Audit Event: actor, action, entity, timestamp, before/after summary, external provider ID, and correlation ID.

## Signature workflow: Lead-to-Settlement

1. Find potential venues from trustworthy sources and record the source URL, access date, and confidence. Do not invent contacts or treat scraped guesses as verified.
2. Score fit against genre, draw, market, date availability, fee floor, travel cost, and past results. Explain the score; allow the band to adjust weights.
3. Create personalized outreach drafts from approved band facts and venue context. Never invent a prior relationship, attendance number, guarantee, or past performance.
4. Send only when an authorized user has enabled a bounded campaign and the recipient, channel, message limits, opt-out rules, and daily cap are configured. Record delivery results.
5. Classify replies, extract proposed terms with confidence, and draft a response. Human approval is required for material negotiation, accepting offers, or legal commitments.
6. On confirmed booking, create/update the event, calendar sync jobs, member tasks, advance checklist, contract/deposit milestones, promotion plan, and show budget. Retries must not create duplicates.
7. During advancing, track required fields and automatically request missing information within approved rules.
8. After the show, collect actual income and costs, reconcile receipts and payment status, calculate the agreed split, and flag missing or disputed data.
9. Compare estimated vs. actual margin and feed verified outcomes into future venue and routing recommendations.

## Autonomy and safety contract

### Allowed when explicitly enabled
- Research and organize venue information with source citations.
- Draft pitches, follow-ups, invoices, checklists, budgets, and event packets.
- Create internal tasks and reminders.
- Sync calendar events after a booking reaches the configured confirmation threshold.
- Send routine follow-ups within user-defined campaign limits and approved templates.
- Categorize suggested transactions, identify duplicates, and prepare reconciliations.
- Produce tax-preparation exports and deadline reminders.

### Always require explicit approval or appropriate external authorization
- Accepting/declining a binding offer, signing a contract, or changing contract terms.
- Making or moving money, paying bills, issuing refunds, or initiating member payouts.
- Filing taxes or making tax elections.
- Sending unusual/high-stakes communications or contacting a person after an opt-out.
- Deleting financial records or changing permissions/security settings.

### Reliability requirements
- Durable background queue with retry/backoff and dead-letter visibility.
- Idempotency keys for every external write and event-triggered workflow.
- Per-band authorization checks on every read and write.
- Secret storage only on the server; no provider secrets in browser bundles or logs.
- Audit trail for every agent action and external side effect.
- Human-readable failure state and safe resume/retry controls.
- Rate limits, provider quota handling, timeouts, and circuit breakers.
- Demo data never mixed into real financial or booking reports.

## Competitive differentiation

Avoid trying to clone every feature of specialist platforms. Win through the connections they usually leave to the musician:
- Every booking is connected to real costs, deposits, member availability, marketing, and final profitability.
- Venue relationship memory preserves source evidence, history, offer terms, and follow-up context.
- Tour planning optimizes for expected net contribution and operational feasibility, not just geographic distance.
- The AI manager executes bounded workflows and provides receipts for its work rather than only suggesting actions.
- Band members see a clear, permission-aware mobile view of only the decisions and tasks they need.

## Build sequence

### P0 — Establish trust
- Verify the production project, Git integration, environment, auth, data persistence, and current routes.
- Run typecheck, lint, unit tests, production build, migration checks, and auth invariants.
- Fix deployment provisioning separately from application-code failures; record exact provider error and do not guess at the cause.
- Map every existing feature to its current data source and real persistence behavior.
- Add a seeded demo mode with unmistakable demo labeling if the public demo needs sample content.

### P1 — Shared operational backbone
- Define canonical schemas, ownership, validation, indexes, migration strategy, and audit events.
- Normalize event statuses and ensure calendar, gig, task, finance, and contacts refer to the same entities.
- Add automation run/task state with retries, idempotency, and visible outcomes.

### P2 — Highest-value complete workflows
- Confirmed gig -> calendar, member tasks, advance checklist, contract/deposit milestones, promotion plan, and budget.
- Expense/receipt -> suggested category -> event link -> reconciliation -> export.
- Booking follow-up -> reply classification -> approval queue -> next action.
- Post-show -> settlement reconciliation -> payout calculation -> profitability report.

### P3 — Real integrations
- Email and calendar provider adapters with explicit consent and revocable access.
- Accounting and banking integrations through reputable authorized providers; do not store bank credentials.
- Document storage/signature and payment providers where feasible.
- External API contracts, provider limits, webhook verification, and reconnection UX.

### P4 — Intelligence
- Venue-fit and fee-confidence models backed by actual outcomes.
- Tour route planner with drive time, cost, realistic buffers, and date constraints.
- Forecasts with assumptions, ranges, and confidence rather than false precision.
- Natural-language command interface that proposes a plan, shows intended side effects, and executes only within permissions.

### P5 — Launch quality
- End-to-end synthetic tour tests and failure injection.
- Mobile accessibility, loading/empty/error states, onboarding, import/export, privacy controls, backup/restore, and support diagnostics.
- Instrument completion rate, hours saved, response conversion, booking conversion, net show margin, overdue balances, and automation failure rate.

## Definition of done for every feature

A feature is not complete because a screen exists. It is complete only when:
- It has a clear user outcome and correct data model.
- It persists and reloads correctly.
- It is permission-checked and safe across bands.
- Loading, empty, validation, failure, and retry states work.
- Automated tests cover important behavior and regression cases.
- External actions are logged and duplicate-safe.
- Mobile UI is usable.
- It is deployed and verified against the intended project.
- Any unavailable integration is honestly labeled as not connected.

## Product north star

Administrative work removed per band per week, without increasing missed bookings, payment errors, or loss of control.

Supporting metrics: qualified booking opportunities, outreach reply rate, booking conversion, time from confirmation to fully advanced, show settlement completion, late-payment recovery, net profit per show, task completion reliability, and agent actions requiring manual correction.


## Implementation snapshot — October 11, 2026

The first implementation slice is available on `feat/autonomous-band-os-foundation` and is tracked in draft PR #2. It is not yet merged or verified as passing CI.

- **Tour Economics page:** `/tour` is now connected to the existing navigation and reads the current gig pipeline plus cost entries linked to each gig. It shows expected gross, recorded linked costs, expected net, and confidence-weighted net.
- **Shared logic:** show lifecycle transitions, finance summaries, tour-stop economics, automation permission decisions, retry backoff, and an automation-run state machine have isolated unit tests.
- **Current data limitation:** tour cost estimates only include costs already linked to a gig. Travel, lodging, crew, production, door, merch, tax, and settlement-specific fields are not yet captured as first-class data.
- **Validation gate:** run `npm test`, `npm run typecheck`, `npm run check:auth`, and `npm run lint` in a working CI environment before merge. Do not infer that checks passed merely because the workflow file exists.
- **Release gate:** keep production untouched until CI passes and the existing Vercel project's team/domain/deployment provisioning issue is resolved.

## Operating model: one autonomous administrative workflow

The band should not have to manage separate tools as disconnected destinations. Primal Directive should own a shared operational record and orchestrate work across the existing modules. A module is a capability and focused workspace, not a separate silo.

### The closed-loop execution cycle

1. **Observe:** monitor the band's approved inboxes, calendar, booking pipeline, task list, money records, merch activity, deadlines, and connected services.
2. **Understand:** connect each event to the right band, contact, show, task, transaction, or campaign; deduplicate updates and identify missing or conflicting facts.
3. **Prioritize:** rank work by deadline, expected value, risk, and dependency; explain why a task matters.
4. **Prepare:** draft the next email, checklist, invoice, budget, promotion plan, packing list, or reconciliation using verified band data.
5. **Authorize:** check the band's permissions and the action's risk tier. Routine, reversible actions can run under explicit rules; financial transfers, binding commitments, signatures, refunds, and sensitive communications require approval.
6. **Execute:** call the connected provider or update the canonical record. A plan or draft is not considered executed.
7. **Verify:** confirm the provider result or persisted state, prevent duplicate writes, and record evidence.
8. **Follow through:** create the next task, schedule a permitted follow-up, or escalate a blocker with a clear reason and one-tap decision.
9. **Learn:** compare expected and actual results, then improve future recommendations using verified outcomes rather than guesses.

### One event should coordinate the entire business

When a gig becomes confirmed, the system should orchestrate—not merely recommend—the following connected work:
- Add or update the canonical event and sync the authorized calendars.
- Confirm member availability and create role-specific tasks.
- Generate an advance checklist and request missing production, hospitality, schedule, parking, and contact details.
- Track the contract, deposit, balance due, invoice, and payment deadlines.
- Prepare the show budget, travel plan, and merch allocation based on inventory and previous sales.
- Prepare a promotion plan with approved assets, event links, deadlines, and channel-specific copy.
- After the show, reconcile the guarantee/door income, expenses, merch, receipts, and outstanding balances.
- Produce a reviewable show report with actual net, missing data, and next actions; feed verified outcomes into booking and routing intelligence.

Every stage must be resumable. If a provider is disconnected or a venue does not respond, the system should preserve progress, show the blocker, and retry only within safe limits.

### Modules and shared capabilities

- **Command Center:** prioritized work queue, blockers, overdue items, money at risk, and a visible record of what the agents did.
- **Booking & relationships:** venue research, verified contacts, opportunity scoring, outreach, reply triage, follow-up, and pipeline movement.
- **Shows & tour operations:** calendars, member availability, advancing, contracts, production documents, routing, checklists, and show closeout.
- **Money & administration:** invoices, deposits, expenses, receipts, reimbursements, tax-ready exports, payment follow-up, budgets, and show profitability.
- **Merch:** product/size/color variants, purchase costs, inventory movements, show packing and reconciliation, multi-item orders, refunds/voids, and sales analytics.
- **Audience & content:** EPK, assets, content calendar, approved publishing workflows, mailing/ticket links, campaign measurement, and follow-up.
- **Documents & knowledge:** one searchable home for contracts, riders, stage plots, input lists, invoices, receipts, EPK versions, and important contact history.
- **People & permissions:** band-member roles, assignments, approval rights, and a clear view of each person's responsibilities.
- **Automation control room:** enabled workflows, trigger conditions, action limits, approval queue, run history, retry/resume, errors, and audit evidence.

### Product rules

- One canonical record for a venue, contact, gig, task, product, sale, or transaction; modules link to it rather than duplicating it.
- One task system and one audit history across the product.
- Every automated action has a visible status: proposed, awaiting approval, running, succeeded, failed, or blocked.
- No fabricated live facts, invented venue contacts, fake delivery confirmations, or unsupported financial certainty.
- All external connections are opt-in, revocable, permission-scoped, and clearly marked connected or disconnected.
- Routine work may be autonomous only after its limits and failure behavior are configured. Human approval remains mandatory for high-impact or irreversible actions.
- The interface must remain usable from a phone; automation status and approvals cannot depend on desktop-only workflows.

### Implementation priority: prove one end-to-end loop

Build and test a complete workflow before adding more disconnected screens: **confirmed gig → advance tasks and deadlines → approved promotion → show-day merch pack → recorded sales and expenses → post-show reconciliation → profitability and next actions**.

For each stage, tests must prove correct persistence, retries, duplicate-event handling, permission checks, failure recovery, and audit logging. Only claim a step is autonomous after the connected service actually performs and verifies it. Expand next into lead-to-booking and receipt-to-reconciliation workflows, reusing the same automation engine and data model.

