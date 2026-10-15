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
        "command-panel p-4 transition-colors duration-200 hover:border-line-strong",
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
