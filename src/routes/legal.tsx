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
      <h2 className="text-lg font-bold">Google and Gmail permissions</h2>
      <p>
        Google sign-in identifies your account. Optional Gmail read access supports bounded inbox
        previews and reply headers. Optional Gmail send access supports sending a message you
        approve when sending is released. Google authorization alone is not approval to contact a
        venue. If you explicitly enable scheduled follow-ups, related thread content is read on the
        server to detect replies and opt-outs. This feature stores reply identifiers and
        conservative classifications, not message bodies, and does not forward those bodies to AI
        providers. Tokens are encrypted on the server. You can revoke access through your Google
        account.
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
