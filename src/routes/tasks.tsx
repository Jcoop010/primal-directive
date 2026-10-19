import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
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
  const [urgency, setUrgency] = useState<"all" | "overdue" | "today" | "upcoming">("all");
  const [category, setCategory] = useState<"all" | OperationalTask["category"]>("all");
  const today = toIsoDay(new Date());
  const openTasks = tasks.filter((task) => task.status === "open");
  const overdue = openTasks.filter((task) => task.dueDate < today);
  const dueToday = openTasks.filter((task) => task.dueDate === today);
  const upcoming = openTasks.filter((task) => task.dueDate > today);
  const visible = useMemo(() => tasks
    .filter((task) => filter === "all" || task.status === filter)
    .filter((task) => category === "all" || task.category === category)
    .filter((task) => urgency === "all" || (task.status === "open" && (urgency === "overdue" ? task.dueDate < today : urgency === "today" ? task.dueDate === today : task.dueDate > today)))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title)), [tasks, filter, category, urgency, today]);
  const generatedCount = () => {
    const count = generateShowTasks();
    toast[count > 0 ? "success" : "info"](count > 0 ? `Created ${count} show tasks.` : "No new tasks needed. Existing tasks are preserved; add or confirm a dated gig to generate its pack.");
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard label="Open tasks" value={String(openTasks.length)} hint="still to do" />
        <MetricCard label="Overdue" value={String(overdue.length)} hint="past due date" />
        <MetricCard label="Completed" value={String(tasks.length - openTasks.length)} hint="marked done" />
        <MetricCard label="Booked shows" value={String(gigs.filter((gig) => gig.status === "booked").length)} hint="eligible for task packs" />
      </div>

      <Card>
        <h3 className="font-display text-base font-semibold">Generate show task packs</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Creates missing checklists for confirmed shows. No messages or payments are sent.
        </p>
        <button type="button" onClick={generatedCount} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg">
          <RefreshCw className="size-4" /> Generate missing tasks
        </button>
        
      </Card>

      <section aria-label="Task triage" className="rounded-2xl border border-line-strong bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-display text-base font-bold">Priority queue</h3><p className="mt-1 text-xs text-muted">Find work needing attention. No tasks are completed automatically.</p></div><button type="button" className="text-xs font-semibold text-accent hover:underline" onClick={() => {setUrgency("all");setCategory("all");setFilter("open");}}>Reset view</button></div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {([{key:"overdue",label:"Overdue",count:overdue.length},{key:"today",label:"Due today",count:dueToday.length},{key:"upcoming",label:"Upcoming",count:upcoming.length}] as const).map((item) => <button key={item.key} type="button" aria-pressed={urgency === item.key} onClick={() => {setUrgency(urgency === item.key ? "all" : item.key);setFilter("open");}} className={cn("rounded-xl border p-3 text-left transition-colors hover:border-accent/50",urgency === item.key ? "border-accent bg-accent/10" : "border-line bg-bg/60")}><div className="font-display text-2xl font-bold tabular">{item.count}</div><div className="mt-1 text-xs font-semibold text-muted">{item.label}</div></button>)}
        </div>
        <label className="mt-4 flex items-center gap-3 text-xs font-semibold text-muted">Workflow <select aria-label="Filter task workflow" value={category} onChange={(event) => setCategory(event.target.value as typeof category)} className="min-h-10 flex-1 rounded-lg border border-line bg-bg px-3 text-sm text-fg"><option value="all">All workflows</option>{(Object.keys(CATEGORY) as OperationalTask["category"][]).map((key) => <option key={key} value={key}>{CATEGORY[key]}</option>)}</select></label>
      </section>
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
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{tasks.length === 0 ? "Add or confirm a dated show, then generate its task pack to build the band's operational checklist." : "Reset filters or generate any missing show tasks."}</p>
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
