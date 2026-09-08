import * as React from "react";
import { Label as LabelPrimitive } from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive>) {
  return (
    <LabelPrimitive
      data-slot="label"
      className={cn(
        "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
