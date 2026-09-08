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
        "rounded-xl border border-line bg-surface p-4 shadow-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
      {children}
    </div>
  );
}
