import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { i as MONEY_TYPE_LABEL } from "./types-C-o5cF1n.mjs";
import { a as longDate, n as cn, o as money, p as useMusician, r as downloadCsv, u as sumMoney } from "./store-bUlLR4gB.mjs";
import { n as Card, r as Eyebrow, t as Badge } from "./badge-DaFZM6LH.mjs";
import { t as MetricCard } from "./metric-card-DJHENY4Y.mjs";
import { t as EmptyState } from "./empty-state-BH5lQUEI.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/money-BRHhBydc.js
var import_jsx_runtime = require_jsx_runtime();
var tone = {
	collected: "live",
	outstanding: "warn",
	cost: "danger"
};
function MoneyPage() {
	const entries = useMusician((s) => s.money);
	const openMoney = useMusician((s) => s.openMoney);
	const collected = sumMoney(entries, "collected");
	const outstanding = sumMoney(entries, "outstanding");
	const costs = sumMoney(entries, "cost");
	const profit = collected - costs;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-2 flex items-end justify-between px-1",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eyebrow, { children: "Money" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted hover:text-fg",
				onClick: () => downloadCsv("money.csv", [[
					"type",
					"amount",
					"label",
					"date"
				], ...entries.map((m) => [
					m.type,
					String(m.amount),
					m.label,
					m.date
				])]),
				children: "Export CSV"
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid grid-cols-2 gap-2.5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MetricCard, {
					label: "Collected",
					value: money(collected),
					hint: "tracked income"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MetricCard, {
					label: "Costs",
					value: money(costs),
					hint: "tracked expenses"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MetricCard, {
					label: "Outstanding",
					value: money(outstanding),
					hint: "still owed"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MetricCard, {
					label: "Profit",
					value: money(profit),
					hint: "collected minus costs"
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eyebrow, { children: "Real gig economics" }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "font-display text-lg font-semibold",
			children: "Track fee, travel, and merch — not vanity gross"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 text-sm leading-relaxed text-muted",
			children: "The board turns this ledger into actual profit. Log remainders the night of the show so outstanding does not go quiet."
		})] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eyebrow, { children: "Ledger" }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
			className: "p-0",
			children: entries.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
				title: "No money logged",
				body: "Capture a guarantee, a merch night, or a van receipt.",
				action: "Add money",
				onAction: () => openMoney()
			}) : entries.map((m, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => openMoney(m.id),
				className: cn("flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-surface-2", i < entries.length - 1 && "border-b border-line"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "truncate text-sm font-semibold",
						children: m.label
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-xs text-muted",
						children: longDate(m.date)
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex shrink-0 flex-col items-end gap-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: cn("text-sm font-semibold tabular", m.type === "cost" && "text-danger", m.type === "collected" && "text-live"),
						children: [m.type === "cost" ? "−" : "", money(m.amount)]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						tone: tone[m.type],
						children: MONEY_TYPE_LABEL[m.type]
					})]
				})]
			}, m.id))
		})
	] });
}
//#endregion
export { MoneyPage as component };
