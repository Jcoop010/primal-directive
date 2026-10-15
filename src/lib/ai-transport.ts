type Provider = "gemini";
const inFlight = new Map<string, Promise<{text: string; status: number; headers: Headers}>>();
const cooldowns = new Map<Provider, number>();

export function boundedHistory(history: { role: "user" | "ai"; text: string }[]) {
  let remaining = 3000;
  const result: { role: string; content: string }[] = [];
  for (const item of history.slice(-8).reverse()) {
    if (remaining < 30) break;
    const limit = Math.min(remaining, 1500);
    const content = item.text.length > limit
      ? `${item.text.slice(0, Math.max(0, limit - 30))}\n[Earlier response truncated.]`
      : item.text;
    result.unshift({ role: item.role === "ai" ? "assistant" : "user", content });
    remaining -= content.length;
  }
  return result;
}

export function retryAfterMs(value: string | null, now = Date.now()): number {
  const seconds = value === null ? NaN : Number(value);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value ?? "") - now;
  return Math.min(86_400_000, Math.max(60_000, Number.isFinite(delay) ? delay : 60_000));
}

// At most one request per turn, sharing one deadline including body reads.
// Cooldowns are best-effort per warm server instance, never a distributed guarantee.
export function createAdvisorTransport(options: {
  fetchImpl?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
  cooldowns?: Map<Provider, number>;
  deduplicationScope?: string;
  allowSecondOn404?: boolean;
} = {}) {
  const request = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const blocked = options.cooldowns ?? cooldowns;
  const deadline = now() + (options.timeoutMs ?? 30_000);
  let attempts = 0;
  let lastStatus: number | undefined;
  return async (provider: Provider, endpoint: string, init: RequestInit): Promise<Response> => {
    if ((blocked.get(provider) ?? 0) > now()) {
      return new Response(null, { status: 429, headers: { "Retry-After": String(Math.ceil(((blocked.get(provider) ?? 0) - now()) / 1000)) } });
    }
    if ((attempts >= 1 && !(options.allowSecondOn404 && attempts === 1 && lastStatus === 404)) || now() >= deadline) throw new Error("Advisor request budget exhausted");
    attempts += 1;
    const signal = AbortSignal.timeout(Math.max(1, deadline - now()));
    const scope = options.deduplicationScope;
    const fingerprint = scope ? Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",
      new TextEncoder().encode(JSON.stringify([scope, endpoint, new Headers(init.headers).get("x-goog-api-key"), init.body])))))
      .map(n => n.toString(16).padStart(2, "0")).join("") : undefined;
    let pending = fingerprint ? inFlight.get(fingerprint) : undefined;
    if (!pending) {
      pending = (async () => {
        const response = await request(endpoint, { ...init, signal });
        if (response.status === 429) blocked.set(provider, now() + retryAfterMs(response.headers.get("retry-after"), now()));
        const text = await response.text();
        return {text, status: response.status, headers: response.headers};
      })();
      if (fingerprint && inFlight.size < 100) {
        inFlight.set(fingerprint, pending);
        const current = pending;
        void pending.finally(() => {
          if (inFlight.get(fingerprint) === current) inFlight.delete(fingerprint);
        }).catch(() => {});
      }
    }
    const response = await pending;
    lastStatus = response.status;
    return new Response(response.text || null, {status: response.status, headers: response.headers});
  };
}

export async function readProviderBody(response: Response): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await response.json();
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}
