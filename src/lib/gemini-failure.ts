export type GeminiFailureKind = "rate_limited" | "quota_exhausted" | "quota_unknown" | "authentication" | "unsupported_model" | "invalid_request" | "provider_unavailable";
type Bag = Record<string, unknown>;
const bag = (v: unknown): Bag => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Bag : {};
const identifier = (v: unknown) => typeof v === "string" && /^[a-zA-Z0-9_.:/-]{1,180}$/.test(v) ? v : undefined;

// Never return Google's raw message, project identifiers, request content or credentials.
export function geminiFailure(status: number, body: Bag) {
  const error = bag(body.error);
  const details = Array.isArray(error.details) ? error.details.map(bag) : [];
  const violations = details.flatMap(d => Array.isArray(d.violations) ? d.violations : [])
    .slice(0, 6).map(v => {
      const q = bag(v), dims = bag(q.quotaDimensions);
      const rawLimit = q.quotaValue;
      const limit = typeof rawLimit === "number" && Number.isFinite(rawLimit) && rawLimit >= 0
        ? rawLimit : typeof rawLimit === "string" && /^\d+(?:\.\d+)?$/.test(rawLimit) ? Number(rawLimit) : undefined;
      return {metric: identifier(q.quotaMetric), id: identifier(q.quotaId), model: identifier(dims.model), limit};
    });
  const delay = details.map(d => d.retryDelay).find(v => typeof v === "string" && /^\d+(?:\.\d+)?s$/.test(v));
  const retrySeconds = typeof delay === "string" ? Math.min(86400, Math.ceil(parseFloat(delay))) : undefined;
  const hardQuota = violations.some(v => v.limit === 0 || /per.?day|daily/i.test((v.id ?? "") + (v.metric ?? "")));
  const minuteQuota = violations.some(v => /per.?minute/i.test((v.id ?? "") + (v.metric ?? "")));
  let kind: GeminiFailureKind = "provider_unavailable";
  if (status === 429) kind = hardQuota ? "quota_exhausted" : minuteQuota || retrySeconds !== undefined ? "rate_limited" : "quota_unknown";
  else if (status === 401 || status === 403) kind = "authentication";
  else if (status === 404) kind = "unsupported_model";
  else if (status === 400) kind = "invalid_request";
  const messages: Record<GeminiFailureKind, string> = {
    quota_exhausted: "Google rejected the request because a daily quota or zero available quota applies. Repeated retries will not restore it. The project owner must check this key's model-specific quotas and reset window; no paid upgrade has been enabled.",
    rate_limited: "Google temporarily limited this request. Wait for the indicated quota window before trying again.",
    quota_unknown: "Google returned HTTP 429 without enough quota details to distinguish temporary throttling from exhausted project quota. Check the project associated with the production key before retrying.",
    authentication: "Google rejected access to Gemini. Check the production key's project, API restrictions and permissions.",
    unsupported_model: "Google could not find or grant access to the configured Gemini model. Verify this model against the production key's project.",
    invalid_request: "Google rejected the Gemini request format or configuration. The request needs investigation before retrying.",
    provider_unavailable: "Gemini is temporarily unavailable. Try again later."
  };
  return {kind, violations, retrySeconds, message: messages[kind]};
}
