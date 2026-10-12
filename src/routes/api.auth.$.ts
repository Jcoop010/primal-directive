import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

/** Route all Better Auth requests (sign-up, sign-in, sessions and OAuth) to the auth handler. */
const handleAuth = ({ request }: { request: Request }) => auth.handler(request);

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: handleAuth,
      POST: handleAuth,
      PUT: handleAuth,
      PATCH: handleAuth,
      DELETE: handleAuth,
      OPTIONS: handleAuth,
    },
  },
});
