import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="font-display text-base font-semibold">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
        {body}
      </p>
      {action && onAction ? (
        <Button className="mt-5" onClick={onAction}>
          {action}
        </Button>
      ) : null}
    </div>
  );
}
