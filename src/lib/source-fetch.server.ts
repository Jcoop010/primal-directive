import { lookup } from "node:dns/promises";
import type { LookupFunction } from "node:net";
import { isIP } from "node:net";
import { Agent, fetch } from "undici";
import type { SourcePage } from "./venue-research";

/** Only globally routable addresses. Reject mixed public/private DNS answers. */
export function isPublicSourceAddress(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0, 2, 168].includes(b)) ||
      (a === 198 && [18, 19, 51].includes(b)) || (a === 203 && b === 0));
  }
  if (isIP(address) === 6) {
    const first = Number.parseInt(address.split(":")[0], 16);
    return first >= 0x2000 && first <= 0x3fff && !/^2002:|^2001:(?:0*:|0*2:|db8:)/i.test(address);
  }
  return false;
}

export function publicSourceUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") ||
      isIP(url.hostname.replace(/^\[|\]$/g, "")) || !url.hostname.includes(".") ||
      /(?:^|\.)(?:localhost|local|internal|invalid|test|example)$/.test(url.hostname)) return null;
    return url;
  } catch { return null; }
}

/** No redirects, credentials, private IPs, DNS rebinding or unbounded bodies. */
type SourceFetchDependencies = { lookup: typeof lookup; fetch: typeof fetch; proxyConfigured: boolean };
export async function fetchSourcePage(value: string, dependencies?: SourceFetchDependencies): Promise<SourcePage | null> {
  const deps = dependencies || { lookup, fetch, proxyConfigured: Boolean(process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY) };
  const url = publicSourceUrl(value);
  if (!url) return null;
  // Do not circumvent managed-network proxies or their destination policies.
  // Live provider research can still return clearly labeled source citations.
  if (deps.proxyConfigured) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let agent: Agent | undefined;
  try {
    const addresses = await Promise.race([
      deps.lookup(url.hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Source DNS timed out")), 3000); }),
    ]);
    clearTimeout(timer);
    if (!addresses.length || addresses.some(item => !isPublicSourceAddress(item.address))) return null;
    const pinned = addresses.find(item => item.family === 4) || addresses[0];
    const pinnedLookup = ((_host, options, callback) => {
      if (typeof options === "object" && options.all) callback(null, [pinned] as never);
      else callback(null, pinned.address, pinned.family);
    }) as LookupFunction;
    agent = new Agent({ connect: { lookup: pinnedLookup, timeout: 5000 } });
    const response = await deps.fetch(url, { dispatcher: agent, redirect: "error", signal: AbortSignal.timeout(8000), headers: { accept: "text/html" } });
    if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) { await response.body?.cancel(); return null; }
    const reader = response.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 1_000_000) { await reader.cancel(); return null; }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    return { url: url.href, html: Buffer.concat(chunks).toString("utf8") };
  } catch { return null; }
  finally { clearTimeout(timer); await agent?.destroy(); }
}
