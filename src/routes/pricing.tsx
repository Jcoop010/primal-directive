import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { startCheckout } from "@/lib/billing";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/pricing")({ component: Pricing });
function Pricing() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function checkout(plan: "pro" | "studio") {
    setBusy(true);
    setError("");
    try {
      const result = await startCheckout({ data: { plan } });
      window.location.assign(result.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in to choose your plan");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-5 py-10">
      <Link to="/" className="text-xs font-bold tracking-widest text-accent">
        PRIMAL DIRECTIVE
      </Link>
      <div>
        <h1 className="font-display text-4xl font-extrabold">
          Run the business behind your music.
        </h1>
        <p className="mt-4 max-w-2xl text-muted">
          Keep bookings, relationships, show finances, tour plans and merch in one artist workspace.
          Research and draft with AI; review the evidence and stay in control.
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-xl border border-line p-4">
          {error}
        </p>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        {(
          [
            {
              id: "pro",
              title: "Pro",
              price: 19,
              description: "For independent artists managing their booking pipeline.",
              features: [
                "Artist workspace and booking pipeline",
                "Calendar, contacts, tour economics and merch",
                "AI-assisted research and personalized drafts",
                "Approval-based Gmail sending after release verification",
              ],
            },
            {
              id: "studio",
              title: "Studio",
              price: 39,
              description: "For artists who want to prepare more of their booking operations.",
              features: [
                "Everything in Pro",
                "Opt-in scheduling of approved emails after release verification",
                "Reply-aware follow-up stop controls after release verification",
                "Same account-level sending safety limits",
              ],
            },
          ] as const
        ).map((plan) => (
          <section
            key={plan.id}
            className="flex flex-col rounded-2xl border border-line bg-surface p-6"
          >
            <h2 className="text-xl font-bold">{plan.title}</h2>
            <p className="mt-4 text-4xl font-bold">
              ${plan.price}
              <span className="text-sm font-normal text-muted"> / month USD</span>
            </p>
            <p className="mt-4 text-sm text-muted">{plan.description}</p>
            <ul className="my-6 flex-1 space-y-3 text-sm">
              {plan.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <Button disabled={busy} onClick={() => checkout(plan.id)}>
              Choose {plan.title}
            </Button>
          </section>
        ))}
      </div>
      <p className="text-sm text-muted">
        Commercial checkout is being verified and may be unavailable. No free trial is currently
        offered. Existing workspace access remains available. Do not purchase Studio for autonomous
        sending until its availability is confirmed.
      </p>
      <div className="flex flex-wrap gap-5 text-sm text-accent">
        <Link to="/">Sign in / create account</Link>
        <Link to="/account">Manage your account</Link>
        <Link to="/help">Help</Link>
        <Link to="/legal">Privacy & service information</Link>
      </div>
    </div>
  );
}
