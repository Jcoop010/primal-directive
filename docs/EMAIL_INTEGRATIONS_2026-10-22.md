# Google/Gmail and Microsoft/Outlook acceptance register

Baseline independently inspected: main c6b6a26957d224d0294aaae008a6e67c19d0970d (#263), production dpl_DoMuoqdsE1jvcYnMkWuyojspWcjQ READY. Existing PostgreSQL, Better Auth, Vercel project and customer records are retained. Additive migration 0007 adds server-only mailbox settings, metadata, drafts and audit records.

## Implemented

- Direct Better Auth Microsoft authorization-code flow, PKCE, signed state and trusted callback origins; common tenant supports personal and organization accounts subject to policy. Login requests only openid/profile/email. Mail access is separate explicit linking consent; no automatic linking based on email. Existing users sign in through their existing method and explicitly link Microsoft in Account, including different provider email addresses. Missing provider configuration is visible and disables unavailable controls.
- Google login remains direct. Gmail permissions are requested from Account, with explicit consent/offline renewal; existing grants are unioned during permission upgrades. Better Auth's Google provider also uses include_granted_scopes. No global mailbox scope is added to new-user login.
- Better Auth encrypts tokens and rotates refreshed credentials. Microsoft renewal deliberately omits scope so it preserves the original consent instead of narrowing to login scopes. Local disconnection removes OAuth tokens and stops approvals without removing the sign-in identity or user records. Provider-side revocation is a separate, clearly linked user action.
- Unified Gmail/Outlook settings distinguish stored consent, last successful API synchronization, errors and renewal availability. Selected booking mailbox persists. Manual bounded synchronization retrieves 10 inbox headers, not bodies; metadata and conversation IDs persist under the authenticated user/mailbox. Ownership is rechecked for every operation. Errors do not include provider request details or credentials. Per-user durable action throttling permits disconnect even when the normal limit is exhausted.
- Artist-owned booking drafts persist in the app. Outlook export explicitly requests draft permission and creates a Graph draft only on a user action. A durable claim prevents duplicate exports and never retries an ambiguous creation.
- Approvals bind the mailbox; the atomic send reservation checks current mailbox ownership/connection/send scope in the database and records provider/mailbox. Existing cross-provider contact/gig duplicate protection and atomic global/user quotas remain intact. Legacy approvals remain Gmail-bound. Matched sender/thread replies revoke unsent approvals without confirming a booking or inventing sentiment. Existing artist-managed stages, follow-up dates and calendar remain available.
- Gmail transport and Graph transport remain behind both outbound release flags. Graph HTTP 202 is recorded as unknown/accepted-unverified, never as delivered. No blind retries or fictional delivery confirmations. Outlook receipt reconciliation, continuous background inbox synchronization, automatic negotiation/confirmation, and autonomous follow-ups are not released.
- Privacy disclosures describe mailbox metadata persistence, draft content, provider consent and local disconnect limitations. Stripe billing and live outreach remain disabled.

## Microsoft registration required

Open https://entra.microsoft.com/ and navigate **Entra ID > App registrations > New registration**. Registration guide: https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app . Use the existing organization tenant; do not provision new paid infrastructure.

- Name: Primal Directive.
- Supported accounts: **Any Entra ID Tenant + Personal Microsoft accounts** (AzureADandPersonalMicrosoftAccount).
- Platform: **Web**, not SPA/public client.
- Exact redirect URI: `https://primal-directive-loose-ends-co.vercel.app/api/auth/callback/microsoft`.
- Do not enable implicit grant. Better Auth uses server authorization-code exchange and PKCE.
- Login scopes: `openid profile email`. Add optional `email` ID-token claim for managed accounts. Email is contact/display data, never an authorization anchor; the provider's application-specific subject identifies the account.
- Graph **delegated**, never application permissions: `Mail.ReadBasic` for header synchronization; `Mail.Send` only when separately requested; `Mail.ReadWrite` only for explicit Outlook draft export. `offline_access` is requested when connecting the mailbox. Broader existing Mail.Read/Mail.ReadWrite read grants are recognized. Organization policy may require administrator consent.
- Configure Vercel production sensitive variables `MICROSOFT_CLIENT_ID` (Application/client ID) and `MICROSOFT_CLIENT_SECRET` (client secret **value**, not secret ID). Tenant is intentionally `common`; no tenant secret or new database is required. Set credentials directly in Vercel; do not paste secrets into chat or commit them. Redeploy after configuration.

Official references: Better Auth v1.6 Microsoft provider https://better-auth.com/docs/1.6/authentication/microsoft ; Graph least-privilege message API https://learn.microsoft.com/en-us/graph/api/user-list-messages ; Graph draft API https://learn.microsoft.com/en-us/graph/api/user-post-messages .

## Verification and external gates

Automated fixtures exercise real Better Auth token encryption/refresh, both OAuth initiation paths, PKCE/state/callback denial, provider 401/403/429/500, ambiguous submission, persisted sync/drafts, no duplicate draft export, reply stops, disconnect/reconnect and foreign mailbox/draft/booking rejection. Existing CI runs real PostgreSQL concurrent reservations, quotas, suppression, RLS and two-user browser regression at desktop/mobile sizes. Provider fixtures are not proof of live OAuth/mailbox delivery.

The current agent browser is signed out of production. The user's prior Google consent is not visible in this separate session. Real Gmail scopes, token refresh and reply-header retrieval still require the owner to authenticate this browser or run the Account inbox check in their own session. No real Gmail messages have been sent in this change.

Microsoft credentials are absent from production. Real consumer/work/school sign-in, organization consent, mailbox read, draft export and real Graph renewal cannot be verified until registration and authorized consent are provided. Approved sandbox/test-recipient send and delivery/reply receipt reconciliation remain release gates for both providers. No test recipient has been authorized and outbound release flags remain off.

No fictional accounts are created in production by authentication smoke checks. Full mutable browser acceptance uses an isolated local/CI application database. Production checks verify public rendering, health/SHA, Google OAuth initiation/callback configuration and anonymous authentication behavior; these are not a claim of authenticated production acceptance.
