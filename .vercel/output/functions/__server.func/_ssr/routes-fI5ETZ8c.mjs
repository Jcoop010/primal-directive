import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { a as object, n as array, o as string, t as _enum } from "../_libs/zod.mjs";
import { a as longDate, i as hostFromUrl, n as cn, o as money, p as useMusician, t as buildAdvisorContext } from "./store-bUlLR4gB.mjs";
import { n as Card, r as Eyebrow } from "./badge-DaFZM6LH.mjs";
import { t as StatusBadge } from "./status-badge-CYNcCiP5.mjs";
import { p as ArrowUp, s as LoaderCircle } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { n as Button } from "./router-DehgPuxk.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-fI5ETZ8c.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var HistoryItem = object({
	role: _enum(["user", "ai"]),
	text: string()
});
var Input = object({
	message: string().min(1).max(2e3),
	history: array(HistoryItem).max(10),
	context: string().max(4500)
});
var askGrowthAdvisor = createServerFn({ method: "POST" }).validator((input) => Input.parse(input)).handler(createSsrRpc("fe5cf2d238b1d227b07f5f0cc7dfb8433122c64422ea5ba88be0d92bed669444"));
var SUGGESTIONS = [
	{
		label: "Grow local draw",
		q: "How do we grow our local draw in the next 90 days given our current pipeline and home city?"
	},
	{
		label: "Build a 3-band bill",
		q: "Build me a realistic 3-band bill for a 250-cap room that fits our sound and draw."
	},
	{
		label: "Northeast routing",
		q: "Find regional routing opportunities in the Northeast so we are not driving six hours for one gig."
	},
	{
		label: "Content that sells tickets",
		q: "What should we post this month that actually grows fans and ticket sales, not vanity metrics?"
	}
];
function AdvisorPage() {
	const chat = useMusician((s) => s.chat);
	const addUserMessage = useMusician((s) => s.addUserMessage);
	const addAiMessage = useMusician((s) => s.addAiMessage);
	const ingestSuggestedGig = useMusician((s) => s.ingestSuggestedGig);
	const ingestSuggestedPerson = useMusician((s) => s.ingestSuggestedPerson);
	const clearChat = useMusician((s) => s.clearChat);
	const [input, setInput] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const scroller = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const el = scroller.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [chat, busy]);
	async function send(text) {
		const q = text.trim();
		if (!q || busy) return;
		setInput("");
		addUserMessage(q);
		setBusy(true);
		try {
			const res = await askGrowthAdvisor({ data: {
				message: q,
				history: useMusician.getState().chat.slice(-8).map((m) => ({
					role: m.role,
					text: m.text
				})),
				context: buildAdvisorContext()
			} });
			if (!res.ok) addAiMessage({
				text: res.error,
				source: "ADVISOR UNAVAILABLE"
			});
			else addAiMessage({
				text: res.answer,
				source: res.source,
				citations: res.citations,
				gigs: res.gigs,
				people: res.people,
				moves: res.moves
			});
		} catch {
			addAiMessage({
				text: "The live connector dropped. Check the board and pipeline, then try the advisor again.",
				source: "CONNECTOR"
			});
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-0 flex-1 flex-col",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eyebrow, { children: "Growth advisor" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "mb-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-xl font-semibold tracking-tight",
					children: "Grow the band — not just the calendar."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm leading-relaxed text-muted",
					children: "Ask in plain English. The advisor searches the live web and reads your pipeline so advice fits this band, this city, this week."
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "flex min-h-[28rem] flex-1 flex-col overflow-hidden p-0",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between border-b border-line px-4 py-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
							className: "text-sm",
							children: "Musician OS AI"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									clearChat();
									toast("Thread cleared");
								},
								className: "text-[10px] font-semibold uppercase tracking-[0.12em] text-muted hover:text-fg",
								children: "Clear"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] font-bold tracking-[0.12em] text-live",
								children: busy ? "SEARCHING" : "READY"
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						ref: scroller,
						className: "flex-1 space-y-3 overflow-y-auto px-3 py-4",
						children: [chat.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: cn("max-w-[88%] rounded-lg px-3.5 py-3 text-sm leading-relaxed whitespace-pre-wrap", m.role === "user" ? "ml-auto bg-accent font-medium text-accent-fg" : "border border-line bg-surface-2 text-fg"),
							children: [
								m.text,
								m.role === "ai" && m.source ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-2 text-[9px] font-bold tracking-[0.14em] text-muted uppercase",
									children: m.source
								}) : null,
								m.citations && m.citations.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-2 flex flex-wrap gap-1.5",
									children: m.citations.map((url) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
										href: url,
										target: "_blank",
										rel: "noreferrer",
										className: "rounded-full border border-line bg-bg px-2 py-0.5 text-[10px] font-medium text-soft hover:border-muted",
										children: hostFromUrl(url)
									}, url))
								}) : null,
								m.moves && m.moves.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
									className: "mt-3 space-y-1.5 border-t border-line pt-3",
									children: m.moves.map((move) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
										className: "text-xs text-soft",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "mr-2 text-accent",
											children: "→"
										}), move]
									}, move))
								}) : null,
								m.gigs && m.gigs.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-3 space-y-2 border-t border-line pt-3",
									children: m.gigs.map((g, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "rounded-md border border-line bg-bg p-2.5",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-start justify-between gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-sm font-semibold",
													children: g.name
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-xs text-muted",
													children: [g.venue, g.city].filter(Boolean).join(" · ")
												})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "text-right",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-sm font-bold tabular",
														children: g.fee ? money(g.fee) : "—"
													}), g.status ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: g.status }) : null]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "mt-1.5 text-xs text-soft",
												children: g.reason
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "mt-2 flex items-center justify-between",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-[11px] text-muted",
													children: [
														longDate(g.date),
														" · ",
														Math.round(g.conf * 100),
														"%"
													]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
													size: "sm",
													onClick: () => {
														ingestSuggestedGig(g);
														toast(`Added ${g.venue || g.name}`);
													},
													children: "Add to pipeline"
												})]
											})
										]
									}, `${g.name}-${i}`))
								}) : null,
								m.people && m.people.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-3 space-y-2 border-t border-line pt-3",
									children: m.people.map((p, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between gap-2 rounded-md border border-line bg-bg p-2.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-sm font-semibold",
											children: p.name
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-xs text-muted",
											children: [
												p.role,
												" · ",
												p.city
											]
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											size: "sm",
											variant: "ghost",
											onClick: () => {
												ingestSuggestedPerson(p);
												toast(`Added ${p.name}`);
											},
											children: "Save"
										})]
									}, `${p.name}-${i}`))
								}) : null
							]
						}, m.id)), busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex max-w-[88%] items-center gap-2 rounded-lg border border-line bg-surface-2 px-3.5 py-3 text-sm text-muted",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin text-accent" }), "Searching the live web…"]
						}) : null]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex gap-2 overflow-x-auto px-3 pb-2",
						children: SUGGESTIONS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							disabled: busy,
							onClick: () => send(s.q),
							className: "shrink-0 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[10px] font-semibold text-soft hover:border-muted disabled:opacity-50",
							children: s.label
						}, s.label))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						className: "flex gap-2 border-t border-line bg-bg p-3",
						onSubmit: (e) => {
							e.preventDefault();
							send(input);
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: input,
							onChange: (e) => setInput(e.target.value),
							placeholder: "Ask about growth, rooms, bills, routing…",
							className: "h-11 flex-1 rounded-md border border-line-strong bg-bg px-3 text-sm outline-none placeholder:text-muted focus:border-muted",
							autoComplete: "off"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							size: "icon",
							disabled: busy || !input.trim(),
							"aria-label": "Send",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUp, { className: "size-4" })
						})]
					})
				]
			})
		]
	});
}
//#endregion
export { AdvisorPage as component };
