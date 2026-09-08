import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { n as Button } from "./router-DehgPuxk.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/empty-state-BH5lQUEI.js
var import_jsx_runtime = require_jsx_runtime();
function EmptyState({ title, body, action, onAction }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "px-4 py-10 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-display text-base font-semibold",
				children: title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted",
				children: body
			}),
			action && onAction ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				className: "mt-5",
				onClick: onAction,
				children: action
			}) : null
		]
	});
}
//#endregion
export { EmptyState as t };
