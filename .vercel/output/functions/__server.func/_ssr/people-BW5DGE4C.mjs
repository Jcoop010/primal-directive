import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { a as PERSON_ROLES, o as PERSON_ROLE_LABEL } from "./types-C-o5cF1n.mjs";
import { n as cn, p as useMusician } from "./store-bUlLR4gB.mjs";
import { n as Card, r as Eyebrow, t as Badge } from "./badge-DaFZM6LH.mjs";
import { t as EmptyState } from "./empty-state-BH5lQUEI.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/people-BW5DGE4C.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function PeoplePage() {
	const people = useMusician((s) => s.people);
	const openPerson = useMusician((s) => s.openPerson);
	const [filter, setFilter] = (0, import_react.useState)("all");
	const shown = filter === "all" ? people : people.filter((p) => p.role === filter);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eyebrow, { children: "People & bands" }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-3 flex gap-1.5 overflow-x-auto pb-1",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
				active: filter === "all",
				onClick: () => setFilter("all"),
				label: "All"
			}), PERSON_ROLES.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
				active: filter === r,
				onClick: () => setFilter(r),
				label: PERSON_ROLE_LABEL[r]
			}, r))]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
			className: "p-0",
			children: shown.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
				title: "No people yet",
				body: "Save bookers, bill-share bands, and rooms the advisor finds.",
				action: "Add contact",
				onAction: () => openPerson()
			}) : shown.map((p, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => openPerson(p.id),
				className: cn("flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left hover:bg-surface-2", i < shown.length - 1 && "border-b border-line"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "truncate text-sm font-semibold",
							children: p.name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-0.5 text-xs text-muted",
							children: [p.city, p.contact ? ` · ${p.contact}` : ""]
						}),
						p.notes ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 line-clamp-2 text-xs text-soft",
							children: p.notes
						}) : null
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: PERSON_ROLE_LABEL[p.role] })]
			}, p.id))
		})
	] });
}
function Chip({ active, label, onClick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick,
		className: cn("shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em]", active ? "border-line-strong bg-surface-2 text-fg" : "border-line bg-bg text-muted"),
		children: label
	});
}
//#endregion
export { PeoplePage as component };
