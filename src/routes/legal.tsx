import { createFileRoute, Link } from "@tanstack/react-router";
export const Route = createFileRoute("/legal")({
  component: () => (
    <article className="mx-auto max-w-3xl space-y-6 px-5 py-10 text-sm leading-relaxed">
      <Link to="/" className="text-accent">
        Primal Directive
      </Link>
      <h1 className="font-display text-3xl font-bold">Privacy & service information</h1>
      <p>
        Primal Directive stores account information, artist workspace records, subscription
        identifiers and outreach approval and delivery records. Account-scoped server authorization
        protects access to these records. Payment details are collected by Stripe, not by this
        application.
      </p>
      <h2 className="text-lg font-bold">Google, Microsoft & mailbox permissions</h2>
      <p>
        Google and Microsoft sign-in identify your account. Inbox access is separate consent. Gmail
        read-only and Microsoft Mail.ReadBasic retrieve up to 10 inbox headers per manual check.
        Sender, subject, date, reply headers and conversation identifiers are persisted to track
        booking conversations; inbox bodies are not downloaded. Optional Microsoft Mail.ReadWrite
        creates an Outlook draft only when you click to export it. Local booking drafts retain the
        content you save. Separate send permission never approves a message by itself. OAuth access
        and refresh tokens are encrypted on the server. Disconnect deletes local tokens, pauses
        outreach and revokes unsent approvals while preserving sign-in. It does not withdraw the
        provider-side grant: revoke that in Google connections or Microsoft account permissions
        (your organization may require administrator involvement).
      </p>
      <h2 className="text-lg font-bold">AI and outreach</h2>
      <p>
        Information you submit to the Advisor may be processed by configured AI providers. Review
        generated content and source evidence before relying on it. This service does not guarantee
        bookings, revenue or recipient responses. You remain responsible for verifying contact
        preferences and obtaining permission for outreach. Pause outreach or suppress a recipient at
        any time. In-flight messages may already have reached the provider.
      </p>
      <h2 className="text-lg font-bold">Commercial launch requirements</h2>
      <p>
        Final terms of service, the operator’s contact details, data retention and deletion
        procedures, and a complete privacy policy require the operator’s review before commercial
        launch. This information page is not a completed legal agreement. Checkout remains gated
        while release verification is pending.
      </p>
      <Link to="/help" className="text-accent">
        Help & launch status
      </Link>
    </article>
  ),
});
