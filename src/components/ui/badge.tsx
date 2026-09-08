import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "muted",
  children,
}: {
  className?: string;
  tone?: "muted" | "accent" | "live" | "warn" | "info" | "danger";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
        tone === "muted" && "border-line bg-surface-2 text-muted",
        tone === "accent" && "border-accent/40 bg-accent/15 text-accent",
        tone === "live" && "border-live/30 bg-live/10 text-live",
        tone === "warn" && "border-warn/30 bg-warn/10 text-warn",
        tone === "info" && "border-info/30 bg-info/10 text-info",
        tone === "danger" && "border-danger/30 bg-danger/10 text-danger",
        className,
      )}
    >
      {children}
    </span>
  );
}
