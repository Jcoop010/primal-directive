import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { c as pipelineGigs, l as pipelineValue, m as weightedValue, n as cn, o as money, p as useMusician, s as parseDay, u as sumMoney } from "./store-bUlLR4gB.mjs";
import { n as Card, r as Eyebrow } from "./badge-DaFZM6LH.mjs";
import { t as MetricCard } from "./metric-card-DJHENY4Y.mjs";
import { t as StatusBadge } from "./status-badge-CYNcCiP5.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/board-D8mSvH-n.js
var import_jsx_runtime = require_jsx_runtime();
function deriveSignals(gigs, money, _people) {
	const out = [];
	const today = /* @__PURE__ */ new Date();
	today.setHours(0, 0, 0, 0);
	const upcoming = gigs.filter((g) => g.date && g.status !== "passed").map((g) => ({
		g,
		d: parseDay(g.date)
	})).filter(({ d }) => {
		const diff = (d.getTime() - today.getTime()) / 864e5;
		return diff >= 0 && diff <= 10;
	}).sort((a, b) => a.d.getTime() - b.d.getTime());
	if (upcoming[0]) {
		const { g, d } = upcoming[0];
		const days = Math.round((d.getTime() - today.getTime()) / 864e5);
		out.push({
			id: `soon-${g.id}`,
			tone: days <= 3 ? "warn" : "live",
			title: days === 0 ? `${g.venue} is today` : `${g.venue} in ${days} day${days === 1 ? "" : "s"}`,
			detail: `${g.name} · ${g.city}`,
			href: "/gigs"
		});
	}
	const outstanding = sumMoney(money, "outstanding");
	if (outstanding > 0) out.push({
		id: "unpaid",
		tone: "warn",
		title: `$${outstanding.toLocaleString()} still outstanding`,
		detail: "Chase deposits and remainders before the next routing week.",
		href: "/money"
	});
	const soft = pipelineGigs(gigs).filter((g) => g.conf < .45 && (g.fee || 0) >= 800);
	if (soft[0]) out.push({
		id: `soft-${soft[0].id}`,
		tone: "info",
		title: `Low-confidence $${soft[0].fee.toLocaleString()} hold`,
		detail: `${soft[0].venue} needs a follow-up or a full bill attached.`,
		href: "/gigs"
	});
	const outreach = gigs.filter((g) => g.status === "outreach" || g.status === "lead");
	if (outreach.length >= 2) out.push({
		id: "pipeline-move",
		tone: "info",
		title: `${outreach.length} leads waiting on a move`,
		detail: "Pick one room and send a one-sheet this week. Volume without follow-up is noise.",
		href: "/gigs"
	});
	if (out.length === 0) out.push({
		id: "quiet",
		tone: "live",
		title: "No urgent signals",
		detail: "Use the advisor to build the next 30-day pursuit list.",
		href: "/"
	});
	return out.slice(0, 4);
}
function BoardPage() {
	const gigs = useMusician((s) => s.gigs);
	const moneyEntries = useMusician((s) => s.money);
	const people = useMusician((s) => s.people);
	const collected = sumMoney(moneyEntries, "collected");
	const outstanding = sumMoney(moneyEntries, "outstanding");
	const costs = sumMoney(moneyEntries, "cost");
	const profit = Math.max(0, collected - costs);
	const open = pipelineGigs(gigs);
	const signals = deriveSignals(gigs, moneyEntries, people);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eyebrow, { children: "Booking board" }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid grid-cols-2 gap-2.5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MetricCard, {
					label: "Collected",
					value: money(collected),
					hint: "cash logged"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MetricCard, {
					label: "Outstanding",
					value: money(outstanding),
					hint: "money to collect"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MetricCard, {
					label: "Open pipeline",
					value: money(pipelineValue(gigs)),
					hint: `${open.length} opportunities`
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MetricCard, {
					label: "Weighted",
					value: money(Math.round(weightedValue(gigs))),
					hint: "planning estimate"
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MetricCard, {
			className: "mt-2.5",
			label: "Real gig profit",
			value: money(profit),
			hint: "after tracked costs"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eyebrow, { children: "Signals" }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "space-y-3",
			children: signals.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: s.href ?? "/board",
				className: cn("block", i < signals.length - 1 && "border-b border-line pb-3"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("size-1.5 rounded-full", s.tone === "live" && "bg-live", s.tone === "warn" && "bg-warn", s.tone === "info" && "bg-info") }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-sm font-semibold",
						children: s.title
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 pl-3.5 text-xs leading-relaxed text-muted",
					children: s.detail
				})]
			}, s.id))
		}) }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eyebrow, { children: "AI next move" }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-lg font-semibold",
				children: "Turn live web signals into a pursuit list"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm leading-relaxed text-muted",
				children: "Ask the advisor for rooms, bills, and routing that fit this draw — then push winners into the pipeline."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/",
				className: "mt-4 inline-flex h-11 items-center rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg",
				children: "Open advisor"
			})
		] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eyebrow, { children: "Pipeline snapshot" }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
			className: "p-0",
			children: open.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-4 py-8 text-center text-sm text-muted",
				children: "No open gigs. Add an opportunity or ask the advisor."
			}) : open.slice(0, 5).map((g, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: cn("flex items-center justify-between gap-3 px-4 py-3.5", i < Math.min(open.length, 5) - 1 && "border-b border-line"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "truncate text-sm font-semibold",
						children: g.venue || g.name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-xs text-muted",
						children: g.city
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex shrink-0 flex-col items-end gap-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-sm font-semibold tabular",
						children: money(g.fee)
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: g.status })]
				})]
			}, g.id))
		})
	] });
}
//#endregion
export { BoardPage as component };
