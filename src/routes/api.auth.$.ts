import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

/** Route all Better Auth requests (sign-up, sign-in, sessions and OAuth) to the auth handler. */
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request),
    },
  },
});
