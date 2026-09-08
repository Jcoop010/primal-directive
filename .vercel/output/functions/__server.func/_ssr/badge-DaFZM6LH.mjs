import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { n as cn } from "./store-bUlLR4gB.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/badge-DaFZM6LH.js
var import_jsx_runtime = require_jsx_runtime();
function Card({ className, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("rounded-xl border border-line bg-surface p-4 shadow-card", className),
		children
	});
}
function Eyebrow({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted",
		children
	});
}
function Badge({ className, tone = "muted", children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]", tone === "muted" && "border-line bg-surface-2 text-muted", tone === "accent" && "border-accent/40 bg-accent/15 text-accent", tone === "live" && "border-live/30 bg-live/10 text-live", tone === "warn" && "border-warn/30 bg-warn/10 text-warn", tone === "info" && "border-info/30 bg-info/10 text-info", tone === "danger" && "border-danger/30 bg-danger/10 text-danger", className),
		children
	});
}
//#endregion
export { Card as n, Eyebrow as r, Badge as t };
