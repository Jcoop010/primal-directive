import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, Eyebrow } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  PERSON_ROLE_LABEL,
  PERSON_ROLES,
  type PersonRole,
} from "@/lib/types";
import { useMusician } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/people")({ component: PeoplePage });

function PeoplePage() {
  const people = useMusician((s) => s.people);
  const openPerson = useMusician((s) => s.openPerson);
  const [filter, setFilter] = useState<"all" | PersonRole>("all");
  const shown =
    filter === "all" ? people : people.filter((p) => p.role === filter);

  return (
    <div>
      <Eyebrow>People & bands</Eyebrow>
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        <Chip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label="All"
        />
        {PERSON_ROLES.map((r) => (
          <Chip
            key={r}
            active={filter === r}
            onClick={() => setFilter(r)}
            label={PERSON_ROLE_LABEL[r]}
          />
        ))}
      </div>
      <Card className="p-0">
        {shown.length === 0 ? (
          <EmptyState
            title="No people yet"
            body="Save bookers, bill-share bands, and rooms the advisor finds."
            action="Add contact"
            onAction={() => openPerson()}
          />
        ) : (
          shown.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => openPerson(p.id)}
              className={cn(
                "flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left hover:bg-surface-2",
                i < shown.length - 1 && "border-b border-line",
              )}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{p.name}</div>
                <div className="mt-0.5 text-xs text-muted">
                  {p.city}
                  {p.contact ? ` · ${p.contact}` : ""}
                </div>
                {p.notes ? (
                  <p className="mt-1 line-clamp-2 text-xs text-soft">{p.notes}</p>
                ) : null}
              </div>
              <Badge>{PERSON_ROLE_LABEL[p.role]}</Badge>
            </button>
          ))
        )}
      </Card>
    </div>
  );
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
        active
          ? "border-line-strong bg-surface-2 text-fg"
          : "border-line bg-bg text-muted",
      )}
    >
      {label}
    </button>
  );
}
