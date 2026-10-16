import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <Card className={cn("command-surface group relative min-h-32 overflow-hidden border-l-2 border-l-accent/70 transition-colors hover:border-accent/60", className)}>
      <div className="relative text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </div>
      <div className="relative mt-3 break-words font-display text-2xl font-extrabold tracking-tight tabular sm:text-3xl">
        {value}
      </div>
      {hint ? <div className="relative mt-1 text-xs text-muted">{hint}</div> : null}
    </Card>
  );
}
