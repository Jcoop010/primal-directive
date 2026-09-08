import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { n as cn } from "./store-bUlLR4gB.mjs";
import { n as Card } from "./badge-DaFZM6LH.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/metric-card-DJHENY4Y.js
var import_jsx_runtime = require_jsx_runtime();
function MetricCard({ label, value, hint, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: cn("min-h-28", className),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-[10px] font-semibold uppercase tracking-[0.14em] text-muted",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 font-display text-3xl font-bold tracking-tight tabular",
				children: value
			}),
			hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-1 text-xs text-muted",
				children: hint
			}) : null
		]
	});
}
//#endregion
export { MetricCard as t };
