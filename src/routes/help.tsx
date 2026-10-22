import { createFileRoute, Link } from "@tanstack/react-router";
export const Route = createFileRoute("/help")({
  component: () => (
    <article className="mx-auto max-w-3xl space-y-6 px-5 py-10">
      <Link to="/" className="text-accent">
        Primal Directive
      </Link>
      <h1 className="font-display text-3xl font-bold">Get your workspace ready.</h1>
      <ol className="list-decimal space-y-4 pl-5 text-sm leading-relaxed">
        <li>
          Create your account, then open Artist profile. Add your actual artist name, home market,
          genre, draw and EPK.
        </li>
        <li>
          Add a booking or ask the Advisor to research venues. Review source links and verify each
          booking recipient yourself.
        </li>
        <li>Save your work and wait for the sync confirmation before switching devices.</li>
        <li>
          Connect Gmail from Account. Reading and sending require separate permissions. Reconnect
          there if permission expires.
        </li>
        <li>
          Review and edit outreach drafts. Every send needs a saved approval, and account pause and
          suppression controls remain in effect.
        </li>
        <li>Use Billing to manage a subscription once commercial checkout is available.</li>
      </ol>
      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-bold">Current release limits</h2>
        <p className="mt-3 text-sm text-muted">
          Gmail sending and commercial checkout stay gated until test-account delivery and Stripe
          sandbox checkout are verified. Autonomous follow-ups, body-based reply classification and
          automatic negotiation updates are not enabled. Unknown delivery must be reconciled in
          Gmail before any further outreach.
        </p>
      </section>
      <p className="text-sm text-muted">
        For a failed operation, keep the time, page and error message. Never share passwords,
        payment details or OAuth tokens. A dedicated customer support channel must be configured
        before commercial launch.
      </p>
      <div className="flex gap-5 text-sm text-accent">
        <Link to="/account">Account</Link>
        <Link to="/legal">Privacy & service information</Link>
      </div>
    </article>
  ),
});
