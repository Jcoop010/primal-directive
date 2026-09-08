import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { n as GIG_STATUS_LABEL, t as GIG_STATUSES } from "./types-C-o5cF1n.mjs";
import { a as longDate, l as pipelineValue, n as cn, o as money, p as useMusician, r as downloadCsv } from "./store-bUlLR4gB.mjs";
import { n as Card, r as Eyebrow } from "./badge-DaFZM6LH.mjs";
import { t as StatusBadge } from "./status-badge-CYNcCiP5.mjs";
import { t as EmptyState } from "./empty-state-BH5lQUEI.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/gigs-9A6Y2ERy.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function GigsPage() {
	const gigs = useMusician((s) => s.gigs);
	const openGig = useMusician((s) => s.openGig);
	const [filter, setFilter] = (0, import_react.useState)("all");
	const shown = filter === "all" ? gigs : gigs.filter((g) => g.status === filter);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-2 flex items-end justify-between gap-3 px-1",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eyebrow, { children: "Gig pipeline" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted hover:text-fg",
				onClick: () => downloadCsv("gigs.csv", [[
					"name",
					"venue",
					"city",
					"date",
					"fee",
					"confidence",
					"status",
					"notes"
				], ...gigs.map((g) => [
					g.name,
					g.venue,
					g.city,
					g.date,
					String(g.fee),
					String(g.conf),
					g.status,
					g.notes
				])]),
				children: "Export CSV"
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mb-3 px-1 text-xs text-muted",
			children: [
				money(pipelineValue(gigs)),
				" open · ",
				gigs.length,
				" total"
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-3 flex gap-1.5 overflow-x-auto pb-1",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterChip, {
				active: filter === "all",
				onClick: () => setFilter("all"),
				label: "All"
			}), GIG_STATUSES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterChip, {
				active: filter === s,
				onClick: () => setFilter(s),
				label: GIG_STATUS_LABEL[s]
			}, s))]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
			className: "p-0",
			children: shown.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
				title: "No gigs yet",
				body: "Use the advisor to surface rooms, or add an opportunity yourself.",
				action: "Add gig",
				onAction: () => openGig()
			}) : shown.map((g, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => openGig(g.id),
				className: cn("flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left hover:bg-surface-2", i < shown.length - 1 && "border-b border-line"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "truncate text-sm font-semibold",
							children: g.venue || g.name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-0.5 text-xs text-muted",
							children: [g.name, g.city ? ` · ${g.city}` : ""]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: g.status })
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "shrink-0 text-right",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-sm font-semibold tabular",
							children: money(g.fee)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-xs text-muted",
							children: longDate(g.date)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-[11px] text-muted",
							children: [Math.round(g.conf * 100), "% conf"]
						})
					]
				})]
			}, g.id))
		})
	] });
}
function FilterChip({ active, label, onClick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick,
		className: cn("shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em]", active ? "border-line-strong bg-surface-2 text-fg" : "border-line bg-bg text-muted"),
		children: label
	});
}
//#endregion
export { GigsPage as component };
