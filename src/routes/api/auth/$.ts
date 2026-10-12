import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

/**
 * Better Auth's API must be mounted as a real server route.
 * Without this catch-all, /api/auth/* can fall through to the app shell and
 * browser signup/sign-in receives HTML instead of Better Auth JSON.
 *
 * The checked-in route tree is generated before production builds, while the
 * standalone typecheck runs against the committed tree. The assertion bridges
 * that generation boundary; the Vite/TanStack route generator resolves the
 * actual route path from this file.
 */
const handleAuth = ({ request }: { request: Request }) => auth.handler(request);

export const Route = createFileRoute("/api/auth/$" as never)({
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
