import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const headers = { "cache-control": "no-store" };
        try {
          const sql = await getSql();
          const [state] = await sql.query<{
            outreach: string | null;
            billing: string | null;
            app_state: string | null;
            approvals: string | null;
            mailboxes: string | null;
          }>(
            "select to_regclass('public.outreach_delivery_audit')::text as outreach,to_regclass('public.pd_subscriptions')::text as billing,to_regclass('public.outreach_approvals')::text as approvals,to_regclass('public.app_state')::text as app_state,to_regclass('public.mailbox_connections')::text as mailboxes",
          );
          if (
            !state?.mailboxes ||
            !state?.outreach ||
            !state.approvals ||
            !state.app_state ||
            (process.env.BILLING_ENABLED === "true" && !state.billing)
          )
            return Response.json({ status: "not-ready" }, { status: 503, headers });
          return Response.json(
            {
              status: "ok",
              commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
              outreachSending:
                process.env.OUTREACH_SEND_ENABLED === "true" &&
                process.env.OUTREACH_RELEASE_VERIFIED === "true",
            },
            { headers },
          );
        } catch {
          return Response.json({ status: "unavailable" }, { status: 503, headers });
        }
      },
    },
  },
});
