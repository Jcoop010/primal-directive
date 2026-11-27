import { createFileRoute } from "@tanstack/react-router";
import { handleAgentSignalRequest } from "@/lib/agent-signal.server";

export const Route = createFileRoute("/api/intake/agent-signal")({
  server: {
    handlers: {
      POST: ({ request }) => handleAgentSignalRequest(request),
    },
  },
});
