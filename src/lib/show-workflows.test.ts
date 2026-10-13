import assert from "node:assert/strict";
import test from "node:test";
import { buildShowTaskPack, generateShowTaskPacks, rescheduleOpenShowTasks } from "./show-workflows.ts";
import type { Gig, OperationalTask } from "./types.ts";

const gig: Gig = {
  id: "gig-1", name: "Summer show", venue: "The Room", city: "Morgantown, WV",
  date: "2026-11-15", fee: 900, conf: 1, status: "booked", notes: "",
};

test("generates a six-step operational pack around a booked show date", () => {
  const tasks = buildShowTaskPack(gig, [], new Date("2026-10-01T12:00:00.000Z"));
  assert.equal(tasks.length, 6);
  assert.equal(tasks.find((task) => task.sourceKey.endsWith(":contract:v1"))?.dueDate, "2026-10-16");
  assert.equal(tasks.find((task) => task.sourceKey.endsWith(":advance:v1"))?.dueDate, "2026-11-01");
  assert.equal(tasks.find((task) => task.sourceKey.endsWith(":reconcile:v1"))?.dueDate, "2026-11-16");
});

test("does not generate task packs for unconfirmed opportunities or undated shows", () => {
  assert.equal(buildShowTaskPack({ ...gig, status: "negotiating" }, []).length, 0);
  assert.equal(buildShowTaskPack({ ...gig, date: "" }, []).length, 0);
});

test("rejects impossible or malformed calendar dates instead of rolling them into another month", () => {
  for (const date of ["2026-02-30", "2026-13-01", "2026-04-31", "26-11-15", "0001-01-01"]) {
    assert.equal(buildShowTaskPack({ ...gig, date }, []).length, 0, `should reject ${date}`);
  }
  assert.equal(buildShowTaskPack({ ...gig, date: "2028-02-29" }, []).length, 6);
});

test("is idempotent and preserves existing completed tasks", () => {
  const first = buildShowTaskPack(gig, [], new Date("2026-10-01T12:00:00.000Z"));
  const existing = first.map((task, index) => ({ ...task, id: `task-${index}`, status: index === 0 ? "done" as const : task.status }));
  assert.equal(buildShowTaskPack(gig, existing).length, 0);
  assert.equal(generateShowTaskPacks([gig], existing).length, 0);
  assert.equal(existing[0]?.status, "done");
});

test("generates only missing task steps across multiple shows", () => {
  const existing: OperationalTask[] = [{
    id: "existing", title: "already advanced", description: "", category: "advancing",
    gigId: "gig-1", dueDate: "2026-11-01", status: "done",
    sourceKey: "show:gig-1:advance:v1", createdAt: "2026-10-01T00:00:00.000Z",
  }];
  const tasks = generateShowTaskPacks([gig, { ...gig, id: "gig-2", venue: "Other Room" }], existing);
  assert.equal(tasks.length, 11);
  assert.equal(tasks.some((task) => task.sourceKey === existing[0]?.sourceKey), false);
});


test("reschedules only untouched open tasks when a show date changes", () => {
  const generated = buildShowTaskPack(gig, [], new Date("2026-10-01T12:00:00.000Z"));
  const tasks: OperationalTask[] = generated.map((task, index) => ({
    ...task,
    id: `task-${index}`,
    ...(index === 1 ? { dueDateOverridden: true, dueDate: "2026-10-25" } : {}),
    ...(index === 2 ? { status: "done" as const } : {}),
  }));
  const moved = rescheduleOpenShowTasks({ ...gig, date: "2026-11-22" }, tasks);
  assert.equal(moved[0]?.dueDate, "2026-10-23");
  assert.equal(moved[1]?.dueDate, "2026-10-25");
  assert.equal(moved[2]?.dueDate, tasks[2]?.dueDate);
  assert.equal(moved[2]?.status, "done");
});

test("leaves task deadlines unchanged for an invalid replacement show date", () => {
  const generated = buildShowTaskPack(gig, [], new Date("2026-10-01T12:00:00.000Z"));
  const tasks: OperationalTask[] = generated.map((task, index) => ({ ...task, id: `task-${index}` }));
  const moved = rescheduleOpenShowTasks({ ...gig, date: "2026-02-30" }, tasks);
  assert.deepEqual(moved, tasks);
});
