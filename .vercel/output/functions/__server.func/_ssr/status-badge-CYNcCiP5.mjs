import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { n as GIG_STATUS_LABEL } from "./types-C-o5cF1n.mjs";
import { t as Badge } from "./badge-DaFZM6LH.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/status-badge-CYNcCiP5.js
var import_jsx_runtime = require_jsx_runtime();
var tone = {
	lead: "muted",
	outreach: "info",
	negotiating: "warn",
	hold: "accent",
	booked: "live",
	completed: "live",
	passed: "danger"
};
function StatusBadge({ status }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		tone: tone[status],
		children: GIG_STATUS_LABEL[status]
	});
}
//#endregion
export { StatusBadge as t };
