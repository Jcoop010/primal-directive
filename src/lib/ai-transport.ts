type Provider = "xai" | "groq";
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

// At most two requests per turn, sharing one deadline including body reads.
// Cooldowns are best-effort per warm server instance, never a distributed guarantee.
export function createAdvisorTransport(options: {
  fetchImpl?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
  cooldowns?: Map<Provider, number>;
} = {}) {
  const request = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const blocked = options.cooldowns ?? cooldowns;
  const deadline = now() + (options.timeoutMs ?? 30_000);
  let attempts = 0;
  return async (provider: Provider, endpoint: string, init: RequestInit): Promise<Response> => {
    if ((blocked.get(provider) ?? 0) > now()) {
      return new Response(null, { status: 429, headers: { "Retry-After": String(Math.ceil(((blocked.get(provider) ?? 0) - now()) / 1000)) } });
    }
    if (attempts >= 2 || now() >= deadline) throw new Error("Advisor request budget exhausted");
    attempts += 1;
    const signal = AbortSignal.timeout(Math.max(1, deadline - now()));
    const response = await request(endpoint, { ...init, signal });
    if (response.status === 429) {
      blocked.set(provider, now() + retryAfterMs(response.headers.get("retry-after"), now()));
      // Rate-limit bodies contain no Advisor answer. Avoid consuming a slow,
      // broken, or oversized upstream error stream.
      void response.body?.cancel().catch(() => undefined);
      return new Response(null, { status: 429, headers: response.headers });
    }
    // Consume the body while the timeout still applies. A synthetic Response
    // keeps parsing predictable and avoids a hanging stream after fetch resolves.
    // Preserve a rate-limit diagnosis even when the provider response body
    // stream fails after the HTTP 429 status has arrived.
    // Bound upstream response data: a provider must not be able to force the
    // server to buffer an arbitrarily large body before JSON validation.
    const maxBodyBytes = 256 * 1024;
    let text = "";
    try {
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let received = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            received += value.byteLength;
            if (received > maxBodyBytes) {
              void reader.cancel().catch(() => undefined);
              throw new Error("Advisor provider response exceeds safety limit");
            }
            text += decoder.decode(value, { stream: true });
          }
          text += decoder.decode();
        } finally {
          reader.releaseLock();
        }
      }
    } catch (error) {
      if (response.status !== 429) throw error;
      text = "";
    }
    return new Response(text || null, { status: response.status, headers: response.headers });
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

export function providerContent(body: Record<string, unknown>): string {
  if (!Array.isArray(body.choices)) return "";
  const first = body.choices[0];
  if (!first || typeof first !== "object") return "";
  const content = first.message?.content;
  return typeof content === "string" ? content : "";
}
