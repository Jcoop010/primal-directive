import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { a as longDate, d as toIsoDay, n as cn, p as useMusician } from "./store-bUlLR4gB.mjs";
import { n as Card, r as Eyebrow } from "./badge-DaFZM6LH.mjs";
import { t as StatusBadge } from "./status-badge-CYNcCiP5.mjs";
import { l as ChevronRight, u as ChevronLeft } from "../_libs/lucide-react.mjs";
import { t as EmptyState } from "./empty-state-BH5lQUEI.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/calendar-BMftKGiY.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var WEEKDAYS = [
	"S",
	"M",
	"T",
	"W",
	"T",
	"F",
	"S"
];
function CalendarPage() {
	const gigs = useMusician((s) => s.gigs);
	const openGig = useMusician((s) => s.openGig);
	const [cursor, setCursor] = (0, import_react.useState)(() => {
		const n = /* @__PURE__ */ new Date();
		return new Date(n.getFullYear(), n.getMonth(), 1);
	});
	const [selected, setSelected] = (0, import_react.useState)(null);
	const byDay = (0, import_react.useMemo)(() => {
		const map = /* @__PURE__ */ new Map();
		for (const g of gigs) {
			if (!g.date) continue;
			const list = map.get(g.date) ?? [];
			list.push(g);
			map.set(g.date, list);
		}
		return map;
	}, [gigs]);
	const cells = (0, import_react.useMemo)(() => buildCells(cursor), [cursor]);
	const monthLabel = cursor.toLocaleDateString(void 0, {
		month: "long",
		year: "numeric"
	});
	const selectedGigs = selected ? byDay.get(selected) ?? [] : [];
	const upcoming = [...gigs].filter((g) => g.date && g.status !== "passed").sort((a, b) => a.date.localeCompare(b.date));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eyebrow, { children: "Calendar" }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-4 flex items-center justify-between",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "flex size-10 items-center justify-center rounded-md border border-line hover:bg-surface-2",
						onClick: () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1)),
						"aria-label": "Previous month",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "size-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-display text-lg font-semibold",
						children: monthLabel
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "flex size-10 items-center justify-center rounded-md border border-line hover:bg-surface-2",
						onClick: () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)),
						"aria-label": "Next month",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4" })
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-7 gap-1 text-center text-[10px] font-semibold tracking-[0.12em] text-muted",
				children: WEEKDAYS.map((d, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "py-1",
					children: d
				}, `${d}-${i}`))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-1 grid grid-cols-7 gap-1",
				children: cells.map((cell, i) => {
					if (!cell) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {}, `pad-${i}`);
					const iso = toIsoDay(cell);
					const items = byDay.get(iso) ?? [];
					const isToday = iso === toIsoDay(/* @__PURE__ */ new Date());
					const isSel = selected === iso;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setSelected(iso),
						className: cn("flex min-h-11 flex-col items-center justify-center rounded-md text-sm", isSel && "bg-accent text-accent-fg", !isSel && isToday && "border border-accent/60", !isSel && !isToday && "hover:bg-surface-2"),
						children: [cell.getDate(), items.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("mt-0.5 size-1 rounded-full", isSel ? "bg-accent-fg" : "bg-accent") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mt-0.5 size-1" })]
					}, iso);
				})
			})
		] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eyebrow, { children: selected ? longDate(selected) : "Upcoming" }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
			className: "p-0",
			children: (selected ? selectedGigs : upcoming).length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
				title: selected ? "Nothing this day" : "Nothing scheduled",
				body: "Add a dated gig from the pipeline or ask the advisor for a routing cluster.",
				action: "Add gig",
				onAction: () => openGig()
			}) : (selected ? selectedGigs : upcoming).map((g, i, arr) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => openGig(g.id),
				className: cn("flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-surface-2", i < arr.length - 1 && "border-b border-line"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-sm font-semibold",
					children: g.venue || g.name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-xs text-muted",
					children: [g.city, !selected ? ` · ${longDate(g.date)}` : ""]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: g.status })]
			}, g.id))
		})
	] });
}
function buildCells(month) {
	const start = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
	const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
	const cells = [];
	for (let i = 0; i < start; i++) cells.push(null);
	for (let d = 1; d <= days; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));
	return cells;
}
//#endregion
export { CalendarPage as component };
