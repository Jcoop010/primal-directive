import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-md border border-line-strong bg-bg px-3 text-sm text-fg outline-none transition-colors placeholder:text-muted focus:border-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-md border border-line-strong bg-bg px-3 py-2.5 text-sm text-fg outline-none transition-colors placeholder:text-muted focus:border-muted",
        className,
      )}
      {...props}
    />
  );
}

export function NativeSelect({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-md border border-line-strong bg-bg px-3 text-sm text-fg outline-none transition-colors focus:border-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const labelId = React.useId();
  const control = React.isValidElement<{ "aria-labelledby"?: string }>(children)
    ? React.cloneElement(children, { "aria-labelledby": children.props["aria-labelledby"] ?? labelId })
    : children;
  return (
    <label className="block space-y-1.5">
      <span id={labelId} className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </span>
      {control}
    </label>
  );
}
