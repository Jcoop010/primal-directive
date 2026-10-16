export type AdvisorProvider = "anthropic" | "gemini" | "xai";
type Block = { until: number; status: number };
const sharedBlocks = new Map<AdvisorProvider, Block>();

export function retryDelay(headers: Headers, body: unknown, now = Date.now()) {
  const value = headers.get("retry-after");
  let delay =
    value && Number.isFinite(Number(value))
      ? Number(value) * 1000
      : value
        ? Date.parse(value) - now
        : NaN;
  const details = (
    body as {
      error?: { details?: { retryDelay?: string; violations?: { quotaValue?: string }[] }[] };
    }
  )?.error?.details;
  if (!Number.isFinite(delay)) {
    const seconds = details
      ?.map((d) => d.retryDelay)
      .find(Boolean)
      ?.match(/^([\d.]+)s$/);
    if (seconds) delay = Number(seconds[1]) * 1000;
  }
  // A zero configured project quota cannot recover with another immediate request.
  if (details?.some((d) => d.violations?.some((v) => v.quotaValue === "0")))
    delay = Math.max(Number.isFinite(delay) ? delay : 0, 15 * 60_000);
  return Math.max(60_000, Math.min(86_400_000, Number.isFinite(delay) ? delay : 60_000));
}

/** One attempt per provider, a shared deadline including body reads, and independent cooldowns. */
export function createProviderPolicy(
  options: {
    fetchImpl?: typeof fetch;
    now?: () => number;
    blocks?: Map<AdvisorProvider, Block>;
    timeoutMs?: number;
    attemptMs?: number;
  } = {},
) {
  const now = options.now ?? Date.now,
    request = options.fetchImpl ?? fetch,
    blocks = options.blocks ?? sharedBlocks;
  const deadline = now() + (options.timeoutMs ?? 120_000),
    attempted = new Set<AdvisorProvider>();
  return {
    blocked(provider: AdvisorProvider) {
      const block = blocks.get(provider);
      return block && block.until > now()
        ? { status: block.status, seconds: Math.ceil((block.until - now()) / 1000) }
        : null;
    },
    async request(provider: AdvisorProvider, url: string, init: RequestInit): Promise<Response> {
      const block = blocks.get(provider);
      if (block && block.until > now())
        return new Response(null, {
          status: block.status,
          headers: { "Retry-After": String(Math.ceil((block.until - now()) / 1000)) },
        });
      if (attempted.has(provider) || deadline - now() < 1000)
        throw Error("Advisor request budget exhausted");
      attempted.add(provider);
      const response = await request(url, {
        ...init,
        signal: AbortSignal.timeout(
          Math.max(1, Math.min(options.attemptMs ?? 45_000, deadline - now())),
        ),
      });
      const text = await response.text();
      if (response.status === 429) {
        let body: unknown;
        try {
          body = JSON.parse(text);
        } catch {
          body = undefined;
        }
        blocks.set(provider, {
          status: 429,
          until: now() + retryDelay(response.headers, body, now()),
        });
      } else if ([401, 403, 404].includes(response.status))
        blocks.set(provider, { status: response.status, until: now() + 300_000 });
      else if (response.status >= 500)
        blocks.set(provider, { status: response.status, until: now() + 15_000 });
      return new Response(text || null, { status: response.status, headers: response.headers });
    },
  };
}
