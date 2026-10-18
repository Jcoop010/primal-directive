import { Badge } from "@/components/ui/badge";
import { GIG_STATUS_LABEL, type GigStatus } from "@/lib/types";

const tone: Record<
  GigStatus,
  "muted" | "accent" | "live" | "warn" | "info" | "danger"
> = {
  lead: "muted",
  qualified: "info",
  ready: "accent",
  responded: "info",
  declined: "danger",
  lost: "muted",
  canceled: "danger",
  archived: "muted",
  outreach: "info",
  negotiating: "warn",
  hold: "accent",
  booked: "live",
  completed: "live",
  passed: "danger",
};

export function StatusBadge({ status }: { status: GigStatus }) {
  return <Badge tone={tone[status]}>{GIG_STATUS_LABEL[status]}</Badge>;
}
