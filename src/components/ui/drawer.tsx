import { Drawer as Vaul } from "vaul";
import { cn } from "@/lib/utils";

export function Drawer({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Vaul.Root open={open} onOpenChange={onOpenChange}>
      <Vaul.Portal>
        <Vaul.Overlay className="fixed inset-0 z-50 bg-bg/70" />
        <Vaul.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-xl border border-line bg-surface outline-none",
            "md:inset-auto md:top-1/2 md:left-1/2 md:max-h-[85dvh] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl",
          )}
        >
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-line-strong md:hidden" />
          <Vaul.Title className="px-5 pt-4 pb-2 font-display text-lg font-semibold tracking-tight">
            {title}
          </Vaul.Title>
          <div className="overflow-y-auto px-5 pb-6">{children}</div>
        </Vaul.Content>
      </Vaul.Portal>
    </Vaul.Root>
  );
}
