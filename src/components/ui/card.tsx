import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line/85 bg-surface/95 p-5 shadow-card transition-colors hover:border-line-strong/80",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 mt-7 px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-muted first:mt-0">
      {children}
    </div>
  );
}
