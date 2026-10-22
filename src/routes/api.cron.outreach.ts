import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { runScheduledOutreach } from "@/lib/outreach-worker.server";
export const Route = createFileRoute("/api/cron/outreach")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret || secret.length < 32)
          return new Response("Scheduler unavailable", { status: 503 });
        const actual = Buffer.from(request.headers.get("authorization") ?? "");
        const expected = Buffer.from(`Bearer ${secret}`);
        if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
          return new Response("Unauthorized", { status: 401 });
        try {
          return Response.json(await runScheduledOutreach(), {
            headers: { "cache-control": "no-store" },
          });
        } catch {
          console.error("[outreach] scheduled processor failed");
          return new Response("Scheduler failed", { status: 500 });
        }
      },
    },
  },
});
