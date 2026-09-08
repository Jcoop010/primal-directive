import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { _ as createRootRoute, d as useRouterState, g as createFileRoute, h as lazyRouteComponent, l as Scripts, m as Outlet, p as createRouter, u as HeadContent, v as Link, y as useRouter } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { l as Slot } from "../_libs/@radix-ui/react-dialog+[...].mjs";
import { a as PERSON_ROLES, i as MONEY_TYPE_LABEL, n as GIG_STATUS_LABEL, o as PERSON_ROLE_LABEL, r as MONEY_TYPES, t as GIG_STATUSES } from "./types-C-o5cF1n.mjs";
import { a as object, i as number, o as string, r as literal, s as union } from "../_libs/zod.mjs";
import { t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { d as toIsoDay, f as todayLabel, n as cn, p as useMusician } from "./store-bUlLR4gB.mjs";
import { a as Plus, c as LayoutGrid, d as CalendarDays, f as Banknote, i as Sparkles, n as UserRound, o as Music2, r as TriangleAlert, t as Users } from "../_libs/lucide-react.mjs";
import { n as toast, t as Toaster } from "../_libs/sonner.mjs";
import { t as Drawer } from "../_libs/vaul.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-DehgPuxk.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: error.message || "An unexpected error occurred. Try reloading the page."
			})
		]
	});
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	if (typeof window === "undefined") return () => {};
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	const parentOrigin = resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		if (envelope.data.type === "hello") {
			if (!HelloSchema.safeParse(event.data).success) return;
			announce();
			return;
		}
		if (envelope.data.type === "navigate") {
			const parsed = NavigateSchema.safeParse(event.data);
			if (!parsed.success) return;
			navigate(parsed.data.path);
			queueMicrotask(reportLocation);
			return;
		}
		if (envelope.data.type === "history") {
			const parsed = HistorySchema.safeParse(event.data);
			if (!parsed.success) return;
			if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
			window.history.go(parsed.data.delta);
		}
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors transition-transform duration-150 ease-out disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 active:scale-[0.98]", {
	variants: {
		variant: {
			default: "bg-accent text-accent-fg hover:bg-accent/90",
			ghost: "border border-line bg-transparent text-fg hover:bg-surface-2 hover:border-line-strong",
			subtle: "bg-surface-2 text-soft hover:bg-line",
			danger: "bg-danger text-accent-fg hover:bg-danger/90"
		},
		size: {
			default: "h-11 px-4",
			sm: "h-9 px-3 text-xs",
			lg: "h-12 px-5",
			icon: "size-11"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
function Button({ className, variant, size, asChild = false, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size,
			className
		})),
		...props
	});
}
function Drawer$1({ open, onOpenChange, title, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Drawer.Root, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Drawer.Portal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Drawer.Overlay, { className: "fixed inset-0 z-50 bg-bg/70" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Drawer.Content, {
			className: cn("fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-xl border border-line bg-surface outline-none", "md:inset-auto md:top-1/2 md:left-1/2 md:max-h-[85dvh] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl"),
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mx-auto mt-3 h-1 w-10 rounded-full bg-line-strong md:hidden" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Drawer.Title, {
					className: "px-5 pt-4 pb-2 font-display text-lg font-semibold tracking-tight",
					children: title
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "overflow-y-auto px-5 pb-6",
					children
				})
			]
		})] })
	});
}
function Input({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		className: cn("h-11 w-full rounded-md border border-line-strong bg-bg px-3 text-sm text-fg outline-none transition-colors placeholder:text-muted focus:border-muted", className),
		...props
	});
}
function Textarea({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
		className: cn("min-h-24 w-full rounded-md border border-line-strong bg-bg px-3 py-2.5 text-sm text-fg outline-none transition-colors placeholder:text-muted focus:border-muted", className),
		...props
	});
}
function NativeSelect({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
		className: cn("h-11 w-full rounded-md border border-line-strong bg-bg px-3 text-sm text-fg outline-none transition-colors focus:border-muted", className),
		...props
	});
}
function Field({ label, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "block space-y-1.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted",
			children: label
		}), children]
	});
}
function todayIso() {
	return toIsoDay(/* @__PURE__ */ new Date());
}
function GigDrawer() {
	const { composer, gigs, setComposer, addGig, updateGig, removeGig } = useMusician();
	const editing = gigs.find((g) => g.id === composer.editingGigId);
	const open = composer.gigOpen;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Drawer$1, {
		open,
		onOpenChange: (v) => setComposer({
			gigOpen: v,
			editingGigId: v ? composer.editingGigId : void 0
		}),
		title: editing ? "Edit gig" : "Add gig",
		children: open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GigForm, {
			initial: editing,
			onSave: (data) => {
				if (editing) {
					updateGig(editing.id, data);
					toast("Gig updated");
				} else {
					addGig(data);
					toast("Gig added to pipeline");
				}
				setComposer({
					gigOpen: false,
					editingGigId: void 0
				});
			},
			onDelete: editing ? () => {
				removeGig(editing.id);
				toast("Gig removed");
				setComposer({
					gigOpen: false,
					editingGigId: void 0
				});
			} : void 0
		}, editing?.id ?? "new") : null
	});
}
function GigForm({ initial, onSave, onDelete }) {
	const [name, setName] = (0, import_react.useState)(initial?.name ?? "");
	const [venue, setVenue] = (0, import_react.useState)(initial?.venue ?? "");
	const [city, setCity] = (0, import_react.useState)(initial?.city ?? "");
	const [date, setDate] = (0, import_react.useState)(initial?.date ?? "");
	const [fee, setFee] = (0, import_react.useState)(String(initial?.fee ?? ""));
	const [conf, setConf] = (0, import_react.useState)(String(Math.round((initial?.conf ?? .5) * 100)));
	const [status, setStatus] = (0, import_react.useState)(initial?.status ?? "lead");
	const [notes, setNotes] = (0, import_react.useState)(initial?.notes ?? "");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		className: "space-y-3",
		onSubmit: (e) => {
			e.preventDefault();
			if (!name.trim()) return;
			onSave({
				name: name.trim(),
				venue: venue.trim(),
				city: city.trim(),
				date,
				fee: Number(fee) || 0,
				conf: Math.min(1, Math.max(0, (Number(conf) || 0) / 100)),
				status,
				notes: notes.trim()
			});
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
				label: "Opportunity",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: name,
					onChange: (e) => setName(e.target.value),
					placeholder: "Saturday support, festival hold…",
					required: true
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Venue",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: venue,
						onChange: (e) => setVenue(e.target.value),
						placeholder: "Room"
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "City",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: city,
						onChange: (e) => setCity(e.target.value),
						placeholder: "City, ST"
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Date",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "date",
						value: date,
						onChange: (e) => setDate(e.target.value)
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Fee",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "number",
						min: 0,
						value: fee,
						onChange: (e) => setFee(e.target.value),
						placeholder: "0"
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Status",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NativeSelect, {
						value: status,
						onChange: (e) => setStatus(e.target.value),
						children: GIG_STATUSES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: s,
							children: GIG_STATUS_LABEL[s]
						}, s))
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Confidence %",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "number",
						min: 0,
						max: 100,
						value: conf,
						onChange: (e) => setConf(e.target.value)
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
				label: "Notes",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
					value: notes,
					onChange: (e) => setNotes(e.target.value),
					placeholder: "Load-in, bill, follow-up…"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex gap-2 pt-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					className: "flex-1",
					children: "Save gig"
				}), onDelete ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					variant: "ghost",
					onClick: onDelete,
					children: "Delete"
				}) : null]
			})
		]
	});
}
function PersonDrawer() {
	const { composer, people, setComposer, addPerson, updatePerson, removePerson } = useMusician();
	const editing = people.find((p) => p.id === composer.editingPersonId);
	const open = composer.personOpen;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Drawer$1, {
		open,
		onOpenChange: (v) => setComposer({
			personOpen: v,
			editingPersonId: v ? composer.editingPersonId : void 0
		}),
		title: editing ? "Edit contact" : "Add contact",
		children: open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PersonForm, {
			initial: editing,
			onSave: (data) => {
				if (editing) {
					updatePerson(editing.id, data);
					toast("Contact updated");
				} else {
					addPerson(data);
					toast("Contact added");
				}
				setComposer({
					personOpen: false,
					editingPersonId: void 0
				});
			},
			onDelete: editing ? () => {
				removePerson(editing.id);
				toast("Contact removed");
				setComposer({
					personOpen: false,
					editingPersonId: void 0
				});
			} : void 0
		}, editing?.id ?? "new") : null
	});
}
function PersonForm({ initial, onSave, onDelete }) {
	const [name, setName] = (0, import_react.useState)(initial?.name ?? "");
	const [role, setRole] = (0, import_react.useState)(initial?.role ?? "band");
	const [city, setCity] = (0, import_react.useState)(initial?.city ?? "");
	const [contact, setContact] = (0, import_react.useState)(initial?.contact ?? "");
	const [notes, setNotes] = (0, import_react.useState)(initial?.notes ?? "");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		className: "space-y-3",
		onSubmit: (e) => {
			e.preventDefault();
			if (!name.trim()) return;
			onSave({
				name: name.trim(),
				role,
				city: city.trim(),
				contact: contact.trim(),
				notes: notes.trim()
			});
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
				label: "Name",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: name,
					onChange: (e) => setName(e.target.value),
					required: true,
					placeholder: "Band or person"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Role",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NativeSelect, {
						value: role,
						onChange: (e) => setRole(e.target.value),
						children: PERSON_ROLES.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: r,
							children: PERSON_ROLE_LABEL[r]
						}, r))
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "City",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: city,
						onChange: (e) => setCity(e.target.value)
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
				label: "Contact",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: contact,
					onChange: (e) => setContact(e.target.value),
					placeholder: "Email, IG, site…"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
				label: "Notes",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
					value: notes,
					onChange: (e) => setNotes(e.target.value)
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex gap-2 pt-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					className: "flex-1",
					children: "Save contact"
				}), onDelete ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					variant: "ghost",
					onClick: onDelete,
					children: "Delete"
				}) : null]
			})
		]
	});
}
function MoneyDrawer() {
	const { composer, money, gigs, setComposer, addMoney, updateMoney, removeMoney } = useMusician();
	const editing = money.find((m) => m.id === composer.editingMoneyId);
	const open = composer.moneyOpen;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Drawer$1, {
		open,
		onOpenChange: (v) => setComposer({
			moneyOpen: v,
			editingMoneyId: v ? composer.editingMoneyId : void 0
		}),
		title: editing ? "Edit entry" : "Add money",
		children: open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MoneyForm, {
			initial: editing,
			gigs,
			onSave: (data) => {
				if (editing) {
					updateMoney(editing.id, data);
					toast("Entry updated");
				} else {
					addMoney(data);
					toast("Money logged");
				}
				setComposer({
					moneyOpen: false,
					editingMoneyId: void 0
				});
			},
			onDelete: editing ? () => {
				removeMoney(editing.id);
				toast("Entry removed");
				setComposer({
					moneyOpen: false,
					editingMoneyId: void 0
				});
			} : void 0
		}, editing?.id ?? "new") : null
	});
}
function MoneyForm({ initial, gigs, onSave, onDelete }) {
	const [type, setType] = (0, import_react.useState)(initial?.type ?? "collected");
	const [amount, setAmount] = (0, import_react.useState)(String(initial?.amount ?? ""));
	const [label, setLabel] = (0, import_react.useState)(initial?.label ?? "");
	const [date, setDate] = (0, import_react.useState)(initial?.date ?? todayIso());
	const [gigId, setGigId] = (0, import_react.useState)(initial?.gigId ?? "");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		className: "space-y-3",
		onSubmit: (e) => {
			e.preventDefault();
			if (!label.trim()) return;
			onSave({
				type,
				amount: Number(amount) || 0,
				label: label.trim(),
				date,
				gigId: gigId || void 0
			});
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Type",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NativeSelect, {
						value: type,
						onChange: (e) => setType(e.target.value),
						children: MONEY_TYPES.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: t,
							children: MONEY_TYPE_LABEL[t]
						}, t))
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Amount",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "number",
						min: 0,
						step: "1",
						value: amount,
						onChange: (e) => setAmount(e.target.value),
						required: true
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
				label: "Label",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: label,
					onChange: (e) => setLabel(e.target.value),
					placeholder: "Guarantee, merch, gas…",
					required: true
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Date",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "date",
						value: date,
						onChange: (e) => setDate(e.target.value)
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Linked gig",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(NativeSelect, {
						value: gigId,
						onChange: (e) => setGigId(e.target.value),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "",
							children: "None"
						}), gigs.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: g.id,
							children: g.venue || g.name
						}, g.id))]
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex gap-2 pt-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					className: "flex-1",
					children: "Save"
				}), onDelete ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					variant: "ghost",
					onClick: onDelete,
					children: "Delete"
				}) : null]
			})
		]
	});
}
function ProfileDrawer() {
	const { composer, profile, setComposer, updateProfile, resetSample, clearAll } = useMusician();
	const [draft, setDraft] = (0, import_react.useState)(profile);
	const open = composer.profileOpen;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Drawer$1, {
		open,
		onOpenChange: (v) => {
			if (v) setDraft(useMusician.getState().profile);
			setComposer({ profileOpen: v });
		},
		title: "Artist profile",
		children: open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "space-y-3",
			onSubmit: (e) => {
				e.preventDefault();
				updateProfile(draft);
				toast("Profile saved");
				setComposer({ profileOpen: false });
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Artist / band",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: draft.artistName,
						onChange: (e) => setDraft({
							...draft,
							artistName: e.target.value
						})
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-2 gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Home city",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: draft.city,
							onChange: (e) => setDraft({
								...draft,
								city: e.target.value
							})
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Genre",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: draft.genre,
							onChange: (e) => setDraft({
								...draft,
								genre: e.target.value
							})
						})
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-2 gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Typical draw",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: draft.draw,
							onChange: (e) => setDraft({
								...draft,
								draw: e.target.value
							})
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Fee target",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							type: "number",
							min: 0,
							value: draft.feeTarget,
							onChange: (e) => setDraft({
								...draft,
								feeTarget: Number(e.target.value) || 0
							})
						})
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Growth notes",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
						value: draft.notes,
						onChange: (e) => setDraft({
							...draft,
							notes: e.target.value
						})
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					className: "w-full",
					children: "Save profile"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-2 pt-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						variant: "ghost",
						className: "flex-1",
						onClick: () => {
							resetSample();
							toast("Sample scene loaded");
							setComposer({ profileOpen: false });
						},
						children: "Load sample"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						variant: "ghost",
						className: "flex-1",
						onClick: () => {
							clearAll();
							toast("Cleared local data");
							setComposer({ profileOpen: false });
						},
						children: "Clear data"
					})]
				})
			]
		}) : null
	});
}
function CommandDrawer() {
	const { composer, setComposer, openGig, openPerson, openMoney } = useMusician();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Drawer$1, {
		open: composer.commandOpen,
		onOpenChange: (v) => setComposer({ commandOpen: v }),
		title: "Quick add",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "ghost",
					className: "h-12 justify-start",
					onClick: () => openGig(),
					children: "Add gig"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "ghost",
					className: "h-12 justify-start",
					onClick: () => openPerson(),
					children: "Add contact"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "ghost",
					className: "h-12 justify-start",
					onClick: () => openMoney(),
					children: "Log money"
				})
			]
		})
	});
}
var NAV = [
	{
		to: "/",
		label: "Advisor",
		icon: Sparkles
	},
	{
		to: "/board",
		label: "Board",
		icon: LayoutGrid
	},
	{
		to: "/gigs",
		label: "Gigs",
		icon: Music2
	},
	{
		to: "/people",
		label: "People",
		icon: Users
	},
	{
		to: "/calendar",
		label: "Calendar",
		icon: CalendarDays
	},
	{
		to: "/money",
		label: "Money",
		icon: Banknote
	}
];
function AppShell({ children }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const profile = useMusician((s) => s.profile);
	const setComposer = useMusician((s) => s.setComposer);
	const openGig = useMusician((s) => s.openGig);
	const openPerson = useMusician((s) => s.openPerson);
	const openMoney = useMusician((s) => s.openMoney);
	const pageTitle = NAV.find((n) => n.to === "/" ? pathname === "/" : pathname.startsWith(n.to))?.label ?? "Command";
	function onFab() {
		if (pathname.startsWith("/gigs") || pathname.startsWith("/calendar")) openGig();
		else if (pathname.startsWith("/people")) openPerson();
		else if (pathname.startsWith("/money")) openMoney();
		else setComposer({ commandOpen: true });
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh md:flex",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "hidden w-56 shrink-0 flex-col border-r border-line bg-bg/80 md:flex",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "px-5 pt-6 pb-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[11px] font-bold tracking-[0.22em]",
							children: "MUSICIAN OS"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-1 text-xs text-muted",
							children: "Artist Command Center"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
						className: "flex flex-1 flex-col gap-1 px-3",
						children: NAV.map((item) => {
							const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: item.to,
								className: cn("flex h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors", active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface hover:text-fg"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(item.icon, {
									className: "size-4",
									strokeWidth: 1.75
								}), item.label]
							}, item.to);
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setComposer({ profileOpen: true }),
						className: "m-3 flex items-center gap-3 rounded-md border border-line px-3 py-2.5 text-left hover:bg-surface-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserRound, { className: "size-4 text-muted" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block truncate text-sm font-semibold",
								children: profile.artistName
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block truncate text-[11px] text-muted",
								children: profile.city
							})]
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-h-dvh min-w-0 flex-1 flex-col",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
					className: "px-4 pt-5 pb-2 md:px-8 md:pt-7",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mx-auto flex max-w-3xl items-end justify-between gap-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[11px] font-bold tracking-[0.22em] md:hidden",
								children: "MUSICIAN OS"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-1 text-xs text-muted md:hidden",
								children: "Artist Command Center"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "mt-4 font-display text-3xl font-extrabold tracking-tight md:mt-0",
								children: pathname === "/" ? "Command Center" : pageTitle
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-1 text-xs text-muted",
								children: todayLabel()
							})
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "hidden items-center gap-2 rounded-full border border-line bg-bg px-3 py-1.5 text-[10px] font-bold tracking-[0.12em] text-muted sm:flex",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-1.5 rounded-full bg-live shadow-[0_0_10px_var(--color-live)]" }), "SCENE INTEL"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setComposer({ profileOpen: true }),
								className: "flex size-11 items-center justify-center rounded-full border border-line bg-surface md:hidden",
								"aria-label": "Artist profile",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserRound, { className: "size-4" })
							})]
						})]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
					className: cn("mx-auto w-full max-w-3xl flex-1 px-3.5 pb-28 md:px-8 md:pb-10", pathname === "/" && "flex flex-col pb-24 md:pb-8"),
					children
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				className: "fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/90 backdrop-blur-md md:hidden",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mx-auto grid max-w-3xl grid-cols-6 px-1 pb-[env(safe-area-inset-bottom)]",
					children: NAV.map((item) => {
						const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: item.to,
							className: cn("flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-semibold", active ? "text-fg" : "text-muted"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(item.icon, {
								className: "size-4",
								strokeWidth: 1.75
							}), item.label]
						}, item.to);
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: onFab,
				className: cn("fixed right-4 bottom-[4.75rem] z-30 size-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-[0_10px_30px_#0009] md:right-8 md:bottom-8", pathname === "/" ? "hidden md:flex" : "flex"),
				"aria-label": "Add",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {
					className: "size-7",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GigDrawer, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PersonDrawer, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MoneyDrawer, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileDrawer, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommandDrawer, {})
		]
	});
}
var styles_default = "/assets/styles-7QDqrbES.css";
var APP_NAME = "Musician OS";
var Route$6 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1, viewport-fit=cover"
			},
			{ title: APP_NAME },
			{
				name: "theme-color",
				content: "#07090c"
			},
			{
				name: "description",
				content: "Artist command center — growth advisor, gig pipeline, people, calendar, and real gig economics."
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/__grok/icon-180.png"
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Syne:wght@600;700;800&display=swap"
			}
		]
	}),
	component: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		className: "antialiased",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", {
			className: "bg-bg text-fg",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AuthProvider, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
					theme: "dark",
					position: "bottom-center",
					toastOptions: { className: "bg-fg text-accent-fg border-0 font-semibold text-xs tracking-wide" }
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
			]
		})]
	})
});
var $$splitComponentImporter$5 = () => import("./routes-fI5ETZ8c.mjs");
var Route$5 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter$5, "component") });
var $$splitComponentImporter$4 = () => import("./board-D8mSvH-n.mjs");
var Route$4 = createFileRoute("/board")({ component: lazyRouteComponent($$splitComponentImporter$4, "component") });
var $$splitComponentImporter$3 = () => import("./calendar-BMftKGiY.mjs");
var Route$3 = createFileRoute("/calendar")({ component: lazyRouteComponent($$splitComponentImporter$3, "component") });
var $$splitComponentImporter$2 = () => import("./gigs-9A6Y2ERy.mjs");
var Route$2 = createFileRoute("/gigs")({ component: lazyRouteComponent($$splitComponentImporter$2, "component") });
var $$splitComponentImporter$1 = () => import("./money-BRHhBydc.mjs");
var Route$1 = createFileRoute("/money")({ component: lazyRouteComponent($$splitComponentImporter$1, "component") });
var $$splitComponentImporter = () => import("./people-BW5DGE4C.mjs");
var Route = createFileRoute("/people")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
var rootRouteChildren = {
	IndexRoute: Route$5.update({
		id: "/",
		path: "/",
		getParentRoute: () => Route$6
	}),
	BoardRoute: Route$4.update({
		id: "/board",
		path: "/board",
		getParentRoute: () => Route$6
	}),
	CalendarRoute: Route$3.update({
		id: "/calendar",
		path: "/calendar",
		getParentRoute: () => Route$6
	}),
	GigsRoute: Route$2.update({
		id: "/gigs",
		path: "/gigs",
		getParentRoute: () => Route$6
	}),
	MoneyRoute: Route$1.update({
		id: "/money",
		path: "/money",
		getParentRoute: () => Route$6
	}),
	PeopleRoute: Route.update({
		id: "/people",
		path: "/people",
		getParentRoute: () => Route$6
	})
};
var routeTree = Route$6._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { Button as n, router_exports as t };
