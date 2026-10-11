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



## Competitive research and differentiation strategy (reviewed 2026-10-11)

### Market reality

The category is moving beyond basic calendars and shared gig notes. Existing products already cover substantial parts of band coordination, touring logistics, booking CRM, finances, merch, release operations, fan CRM, and AI-assisted workflows. A feature-count race would be easy to copy and expensive to maintain.

Competitive examples reviewed:
- BandHelper: schedules, setlists, contacts, band finance, stage plots, invoices, and performance support — https://www.bandhelper.com/
- Master Tour / Eventric: professional tour itineraries, day sheets, travel and crew logistics; official pricing page — https://www.eventric.com/pricing-plans-tour-management-software/
- Artist Growth: broad artist-ecosystem collaboration and business management — https://help.artistgrowth.com/en/i-currently-use-master-tour.-is-artist-growth-the-same-thing-help-center
- Prism.fm: booking, offers, contracts, advancing, settlements, financial reporting, and live-event demand insights — https://prism.fm/
- Riffboard: independent artist shows, contacts, tasks, releases, audience tools and AI-assistant integration — https://www.riffboard.com/
- MNGR: releases, shows, tasks, finance, contacts and a command-center operating view — https://www.trymngr.com/
- Cultivate: live-music booking CRM with per-deal stages, next steps, quiet-deal alerts and linked tour stops — https://cultivatelmi.com/crm
- Bandruption: approval-led AI workflows across promotion, events, tickets, merch and fan participation — https://bandruption.com/
- Sonic DIY and ArtistHQ are further signs that independent-artist all-in-one operations and connected show/merch/finance flows are active competitive territory — https://www.sonic.diy/tools and https://artisthq.app/band-management-software

These are public product claims, not a hands-on feature audit. Recheck live pricing and capabilities before making public competitor comparisons.

### Recommended positioning

**Primal Directive should be the execution-first operating system for independent and regional touring bands.** Its promise should not be "everything in one dashboard"; it should be "the right work happens on time, the records stay connected, and the band knows what it actually earned."

The defensible wedge is a cross-functional, evidence-backed loop that is especially useful for bands without a full-time manager:
1. A booking opportunity becomes a dated deal, a next action, a follow-up deadline and a forecast — without creating duplicate records.
2. Confirmation triggers the show checklist, deal/payment deadlines, advance requests, promotion draft, travel considerations and show-specific merch preparation.
3. The system surfaces blockers and unanswered questions before show day, with owners and escalation rules.
4. Recorded show results reconcile guarantee/door income, deductions, expenses, merch sales, stock movements, outstanding balances and proposed band shares.
5. Verified outcomes update the venue/market history, actual show profitability, merch sell-through, routing assumptions and future offer recommendations.
6. Every important recommendation shows its source data, assumptions, confidence and what would change the conclusion.

### Market signals to turn into product advantage

- **Booking follow-through is a high-value workflow, not just a contact list.** Cultivate's current positioning around holds, offers, next steps, quiet-deal alerts and linked tour stops shows that specialized booking pipelines are getting more sophisticated. Primal Directive should connect the pipeline all the way through the show, money, merch and learning loop rather than recreate a generic CRM.
- **Mobile-first is a requirement.** The work happens in vans, venues, parking lots and after the show. Critical actions, task completion, receipt capture, sales entry and approval review must be fast and usable on a phone.
- **Fan value is concentrated.** Spotify for Artists' Fan Study reports that its super-listener segment represents about 2% of monthly listeners but over 18% of monthly streams, and in the cited sample accounted for 50% of on-platform ticket sales. The product opportunity is to help bands identify and nurture repeat attendees using permissioned, first-party information — not spam everyone. Source: https://artists.spotify.com/fan-study/merch-and-live
- **Merch is strategically important, but fan trust matters.** Spotify reports that among artists with fewer than one million monthly listeners, the number selling merch on Spotify grew more than threefold and total merch sales volume more than sixfold from 2022 to 2024. MIDiA's March 2026 discussion also notes rising appetite for more distinctive merch and concerns about affordability and over-monetization. Help bands select products and quantities from evidence, measure sell-through and margin, and avoid unnecessary inventory risk. Sources: https://artists.spotify.com/fan-study/merch-and-live and https://www.midiaresearch.com/blog/the-new-rules-of-musics-growth-engine-insights-from-midias-merch-and-ticket-buyer-survey
- **AI automation must be earned and verifiable.** OWASP identifies excessive agency, excessive permissions and excessive autonomy as material risks for AI agents. Enforce permissions at the execution layer, bind approval to the exact action, use idempotency/replay protection, show before/after, log outcomes, and fail closed on uncertain or high-impact actions. Source: https://genai.owasp.org/llmrisk/llm062025-excessive-agency/

### What to build next, in order

#### P0 — Finish and trust the operational foundation
- Make the task center the single source of truth for generated and manually created operational work; connect every task to its canonical show, deal, owner, evidence and next action.
- Build a real automation control room: enabled/disabled state, trigger, exact proposed action, approval, attempt count, last result, retry/resume, error reason, and audit trail.
- Add workflow-level idempotency keys, concurrency-safe writes and duplicate-event tests. A sale, email or imported event must never silently create duplicate ledger entries or repeat an external action.
- Add data provenance to financial summaries: actual vs projected, source transaction, missing fields, reconciliation status and last-updated time.
- Preserve phone-first usability, clear empty states, accessible controls, export/backup, and visible connection status.

#### P1 — Close the show-to-profit loop
- Add a show closeout checklist that compares the agreed deal with actual settlement, expenses, merch revenue/COGS and stock count.
- Separate projected, reported and verified money. Never call a show "profitable" if material expenses or settlement fields are missing; show a range or incomplete status instead.
- Track balances due, invoice/deposit deadlines, follow-up history and evidence of payment. Draft reminders first; require authorization before sending.
- Calculate proposed member shares only from an explicitly configured band policy, show the math, and require approval before marking payouts as paid.
- Generate a post-show report with actual net, merch sell-through, unresolved discrepancies, outstanding money and concrete follow-up actions.

#### P2 — Build a booking and routing intelligence advantage
- Model each pitch/deal separately from the venue/contact, with stages, last contact, next step, due date, offer terms, probability and loss reason.
- Surface stale opportunities and missing next actions; generate evidence-based personalized drafts, but never invent a contact or claim a message was sent when it was only drafted.
- Evaluate tour stops using expected net profit, travel time/cost, show spacing, availability and uncertainty — not just distance or headline guarantee.
- Build a venue memory from the band's own verified history: response time, deal outcomes, attendance, merch performance, payment reliability, production fit and rebooking interval.
- Show recommendation explanations and counterfactuals (e.g., why a stop is or is not worth adding).

#### P3 — Connect audience growth to live revenue
- Track event links, source/UTM, campaign dates, content assets, approved posts, ticket clicks where integrations permit, attendance and repeat attendance.
- Build a permission-based fan CRM with source, consent, interests and last interaction; support exports and deletion requests.
- Recommend a small set of high-value actions for the most engaged fans: announce nearby dates, share approved live clips, offer a relevant merch drop or invite repeat attendance.
- Measure results per campaign/show and distinguish correlation from causal attribution. Do not imply access to private platform analytics without an authorized connection.

#### P4 — Complete merch as a show-day workflow
- Add true product variants (size/color), inventory movement ledger, purchase/production costs, multi-item checkout, refunds/voids and payment-processing fees.
- Create a show pack: planned quantities by variant, packed-out stock, sold quantities, comps, damaged/returned units and counted remaining stock.
- Reconcile expected stock with physical count after the show; flag variance and update inventory only through traceable movements.
- Compare sell-through, margin and demand by venue, market, show attendance where known, and product variant before recommending the next print run.

### Product-level moat and success metrics

The moat should be accumulated verified operational history, not an AI prompt or a long feature list. Over time, the product can learn each band's actual booking conversion, venue reliability, route costs, show economics, merch demand and fan return behavior — while keeping the data portable and controlled by the band.

Track these outcomes:
- Admin minutes per show and per booking recovered.
- Percentage of confirmed shows with complete advances by deadline.
- Percentage of completed shows reconciled within 24–48 hours.
- Unpaid balances and overdue follow-ups recovered.
- Duplicate actions prevented; failed workflows recovered successfully.
- Forecast vs actual show profit error.
- Merch sell-through, stock variance and gross margin by show.
- Booking reply rate, conversion by stage, rebooking rate and route net profit.
- Campaign-to-ticket/attendance conversion where measurable.
- Approval edit/reject rates and verified automation success rates.

### What not to do

- Do not add more modules before the current modules share canonical records and reliable workflows.
- Do not market the product as fully autonomous until external integrations perform and verify real actions.
- Do not use fabricated industry benchmarks, fake venue intelligence or unsupported AI confidence.
- Do not make a feature checklist the main marketing message; show the end-to-end result.
- Do not force bands into a manager/label workflow if their reality is a small crew sharing responsibility.
- Do not sacrifice exports, data ownership, consent, least privilege or human override for automation.

### Research source list

Public pages reviewed on 2026-10-11; product features and pricing can change:
- BandHelper — https://www.bandhelper.com/
- Master Tour pricing — https://www.eventric.com/pricing-plans-tour-management-software/
- Artist Growth comparison — https://help.artistgrowth.com/en/i-currently-use-master-tour.-is-artist-growth-the-same-thing-help-center
- Prism.fm — https://prism.fm/
- Riffboard — https://www.riffboard.com/
- MNGR — https://www.trymngr.com/
- Cultivate CRM — https://cultivatelmi.com/crm
- Bandruption — https://bandruption.com/
- Spotify for Artists Fan Study — https://artists.spotify.com/fan-study/merch-and-live
- MIDiA Research, 19 March 2026 — https://www.midiaresearch.com/blog/the-new-rules-of-musics-growth-engine-insights-from-midias-merch-and-ticket-buyer-survey
- OWASP LLM06:2025 Excessive Agency — https://genai.owasp.org/llmrisk/llm062025-excessive-agency/
