/**
 * Normalize citation URLs returned by the AI provider before rendering them
 * as clickable sources. Only absolute HTTPS URLs are allowed; model/provider
 * output is untrusted input and must not be used as an arbitrary link target.
 */
export function normalizeCitationUrls(values: unknown[]): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const item of values) {
    const raw = typeof item === "string"
      ? item
      : item && typeof item === "object" && "url" in item
        ? (item as { url?: unknown }).url
        : undefined;

    if (typeof raw !== "string") continue;

    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== "https:") continue;
      if (!parsed.hostname || parsed.username || parsed.password) continue;
      const host = parsed.hostname.toLowerCase();
      if (
        host === "localhost" ||
        host.endsWith(".localhost") ||
        host.endsWith(".local") ||
        host === "127.0.0.1" ||
        host === "::1" ||
        host === "0.0.0.0"
      ) continue;

      parsed.hash = "";
      const normalized = parsed.toString();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      urls.push(normalized);
      if (urls.length === 6) break;
    } catch {
      // Ignore malformed URLs rather than exposing them as citations.
    }
  }

  return urls;
}
