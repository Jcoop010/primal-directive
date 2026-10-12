import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

/**
 * Better Auth HTTP endpoint. All Better Auth operations (email sign-up,
 * email sign-in, sessions, OAuth callbacks) are served from this same-origin
 * catch-all route.
 */
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request),
    },
  },
});
