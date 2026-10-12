import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

/**
 * Better Auth's API must be mounted as a real server route.
 * Without this catch-all, /api/auth/* falls through to the app shell and
 * browser signup/sign-in appears to do nothing because the client receives HTML
 * instead of Better Auth JSON.
 */
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
