import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, ListChecks, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Card, Eyebrow } from "@/components/ui/card";
import { MetricCard } from "@/components/metric-card";
import { downloadCsv, longDate, toIsoDay } from "@/lib/format";
import { useMusician } from "@/lib/store";
import type { OperationalTask } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tasks")({ component: TasksPage });

const CATEGORY: Record<OperationalTask["category"], string> = {
  booking: "Booking & money terms",
  advancing: "Show advancing",
  promotion: "Promotion",
  merch: "Merch operations",
  finance: "Post-show finance",
};

function TasksPage() {
  const tasks = useMusician((s) => s.tasks);
  const gigs = useMusician((s) => s.gigs);
  const generateShowTasks = useMusician((s) => s.generateShowTasks);
  const updateTask = useMusician((s) => s.updateOperationalTask);
  const [filter, setFilter] = useState<"open" | "all" | "done">("open");
  const today = toIsoDay(new Date());
  const openTasks = tasks.filter((task) => task.status === "open");
  const overdue = openTasks.filter((task) => task.dueDate < today);
  const visible = useMemo(() => tasks
    .filter((task) => filter === "all" || task.status === filter)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title)), [tasks, filter]);
  const generatedCount = () => {
    const count = generateShowTasks();
    toast[count > 0 ? "success" : "info"](count > 0 ? `Created ${count} show tasks.` : "No new tasks needed. Existing tasks are preserved; add or confirm a dated gig to generate its pack.");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>Operational control room</Eyebrow>
          <h2 className="mt-2 text-xl font-extrabold tracking-tight">Tasks & show workflows</h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
            Booking a show now creates its operational checklist automatically, from deal terms through post-show reconciliation. Use the generator below to backfill missing tasks for existing bookings; tasks are saved and duplicate-protected.
          </p>
        </div>
        <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-surface-2">
          <ListChecks className="size-5 text-accent" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard label="Open tasks" value={String(openTasks.length)} hint="still to do" />
        <MetricCard label="Overdue" value={String(overdue.length)} hint="past due date" />
        <MetricCard label="Completed" value={String(tasks.length - openTasks.length)} hint="marked done" />
        <MetricCard label="Booked shows" value={String(gigs.filter((gig) => gig.status === "booked").length)} hint="eligible for task packs" />
      </div>

      <Card>
        <h3 className="font-display text-base font-semibold">Generate show task packs</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Creates tasks for payment terms, venue advancing, approved promotion, merch packing, the run sheet, and post-show reconciliation. It will not send messages, publish posts, sign contracts, or move money.
        </p>
        <button type="button" onClick={generatedCount} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg">
          <RefreshCw className="size-4" /> Generate missing tasks
        </button>
        <p className="mt-2 text-xs text-muted">Saved, dated gigs marked Booked or Completed can receive missing task steps. Tasks are generated once per show and workflow step.</p>
      </Card>

      <div className="flex gap-2">
        {(["open", "all", "done"] as const).map((value) => (
          <button key={value} type="button" onClick={() => setFilter(value)} className={cn("min-h-10 rounded-md border px-3 text-sm font-semibold capitalize", filter === value ? "border-accent bg-surface-2 text-fg" : "border-line text-muted")}>
            {value === "all" ? "All tasks" : value === "done" ? "Completed" : "Open"}
          </button>
        ))}
        <button type="button" onClick={() => downloadCsv("primal-directive-tasks.csv", [["title", "category", "show", "due date", "status", "description"], ...visible.map((task) => [task.title, CATEGORY[task.category], gigs.find((gig) => gig.id === task.gigId)?.venue || "", task.dueDate, task.status, task.description])])} className="ml-auto min-h-10 rounded-md border border-line px-3 text-sm font-semibold">
          Export
        </button>
      </div>

      <Card className="p-0">
        {visible.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm font-semibold">{tasks.length === 0 ? "Your workflow starts here" : "No tasks in this view"}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{tasks.length === 0 ? "Add or confirm a dated show, then generate its task pack to build the band's operational checklist." : "Switch filters or generate any missing show tasks."}</p>
            <Link to="/gigs" className="mt-3 inline-flex text-sm font-semibold text-accent">Open gig pipeline</Link>
          </div>
        ) : visible.map((task, index) => {
          const gig = gigs.find((item) => item.id === task.gigId);
          const isOverdue = task.status === "open" && task.dueDate < today;
          return (
            <div key={task.id} className={cn("flex items-start gap-3 px-4 py-4", index < visible.length - 1 && "border-b border-line")}>
              <button type="button" onClick={() => updateTask(task.id, { status: task.status === "done" ? "open" : "done" })} className="mt-0.5 shrink-0" aria-label={task.status === "done" ? "Mark task open" : "Mark task complete"}>
                {task.status === "done" ? <CheckCircle2 className="size-5 text-live" /> : <Circle className="size-5 text-muted" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className={cn("text-sm font-semibold", task.status === "done" && "text-muted line-through")}>{task.title}</div>
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{CATEGORY[task.category]}</div>
                <p className="mt-2 text-xs leading-relaxed text-muted">{task.description}</p>
                <div className={cn("mt-2 text-xs font-semibold", isOverdue ? "text-danger" : "text-muted")}>
                  {isOverdue ? "OVERDUE · " : "Due · "}{longDate(task.dueDate)}
                </div>
                {gig && <Link to="/gigs" className="mt-1 inline-block text-xs font-semibold text-accent">{gig.venue || gig.name} · {gig.city}</Link>}
              </div>
            </div>
          );
        })}
      </Card>
      <p className="text-xs leading-relaxed text-muted">This task center currently coordinates internal work only. External calendar, email, ticketing, and payment execution must be connected and authorized before those actions can run automatically.</p>
    </div>
  );
}
