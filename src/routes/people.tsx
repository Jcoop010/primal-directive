import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
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
  const [query, setQuery] = useState("");
  const shown = useMemo(() => people.filter((p) => {
    const matchesRole = filter === "all" || p.role === filter;
    const search = query.trim().toLowerCase();
    return matchesRole && (!search || [p.name, p.city, p.contact, p.notes, PERSON_ROLE_LABEL[p.role]].some((value) => value?.toLowerCase().includes(search)));
  }).sort((a, b) => a.name.localeCompare(b.name)), [people, filter, query]);
  const withContact = people.filter((p) => Boolean(p.contact?.trim())).length;

  return (
    <div>
      <Eyebrow>People & bands</Eyebrow>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-display text-xl font-extrabold tracking-tight">Relationship command center</h2><p className="mt-1 text-sm text-muted">Find the right booker, venue contact, or collaborator when you need them.</p></div>
        <button type="button" onClick={() => openPerson()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg"><Plus className="size-4" /> Add contact</button>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-line bg-surface p-3"><div className="text-xs text-muted">Relationships</div><div className="mt-1 font-display text-2xl font-bold">{people.length}</div></div>
        <div className="rounded-xl border border-line bg-surface p-3"><div className="text-xs text-muted">Contact details saved</div><div className="mt-1 font-display text-2xl font-bold">{withContact}<span className="ml-1 text-sm font-normal text-muted">/ {people.length}</span></div></div>
      </div>
      <label className="relative mb-3 block"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted" /><span className="sr-only">Search people</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search names, cities, contacts, notes..." className="min-h-10 w-full rounded-lg border border-line bg-bg py-2 pl-10 pr-3 text-sm text-fg" /></label>
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
            title={people.length === 0 ? "No people yet" : "No matching contacts"}
            body={people.length === 0 ? "Save bookers, bill-share bands, and rooms the advisor finds." : "Try another search or role filter."}
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
