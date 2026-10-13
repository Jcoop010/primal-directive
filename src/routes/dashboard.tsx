import { createFileRoute, redirect } from "@tanstack/react-router";

// Preserve the legacy dashboard URL while keeping the public demo as the destination.
export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => {
    throw redirect({ to: "/demo" });
  },
});
