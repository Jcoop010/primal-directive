#!/usr/bin/env node
/**
 * Band & live-music opportunity scout pusher for POST /api/intake/agent-signal.
 * - Loads AGENT_WEBHOOK_SECRET from process.env or local gitignored .env.local (never printed).
 * - Strictly bans x.com / twitter.com URLs.
 * - Enforces deterministic idempotencyKey so retries deduplicate cleanly (HTTP 200).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_ENDPOINT =
  "https://primal-directive-loose-ends-co.vercel.app/api/intake/agent-signal";
const BLOCKED_HOSTS = new Set([
  "x.com",
  "www.x.com",
  "twitter.com",
  "www.twitter.com",
  "mobile.twitter.com",
]);
const VALID_SEGMENTS = new Set([
  "venue_booking",
  "tour_support",
  "festival_slot",
  "promoter_bill",
  "regional_routing",
  "studio_merch",
]);
const VALID_URGENCIES = new Set(["urgent", "high", "normal", "low"]);

export function isAllowedLeadSourceUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const host = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTS.has(host) || host.endsWith(".x.com") || host.endsWith(".twitter.com")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function buildLeadIdempotencyKey(venueOrTitle, isoDay = new Date().toISOString().slice(0, 10)) {
  const slug = slugify(venueOrTitle) || "signal";
  return `band-scout-${isoDay}-${slug}`;
}

export function validateLeadSignal(raw, isoDay = new Date().toISOString().slice(0, 10)) {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Signal must be an object" };
  }
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
  const sourceUrl = typeof raw.sourceUrl === "string" ? raw.sourceUrl.trim() : "";
  const payload = raw.payload && typeof raw.payload === "object" ? raw.payload : null;

  if (!title) return { ok: false, error: "Missing title" };
  if (!summary) return { ok: false, error: "Missing summary" };
  if (!isAllowedLeadSourceUrl(sourceUrl)) {
    return { ok: false, error: "sourceUrl must be a valid non-X/Twitter http(s) URL" };
  }
  if (!payload) return { ok: false, error: "Missing payload object" };

  const venue = typeof payload.venue === "string" ? payload.venue.trim() : "";
  const city = typeof payload.city === "string" ? payload.city.trim() : "";
  const segment = typeof payload.segment === "string" ? payload.segment.trim() : "";
  const billType = typeof payload.billType === "string" ? payload.billType.trim() : "";
  const recommendedAngle =
    typeof payload.recommendedAngle === "string" ? payload.recommendedAngle.trim() : "";
  const rawUrgency =
    typeof raw.urgency === "string" && raw.urgency.trim()
      ? raw.urgency.trim()
      : typeof payload.urgency === "string"
        ? payload.urgency.trim()
        : "normal";
  const urgency = rawUrgency === "medium" ? "normal" : rawUrgency;

  if (!venue) return { ok: false, error: "Missing payload.venue" };
  if (!city) return { ok: false, error: "Missing payload.city" };
  if (!VALID_SEGMENTS.has(segment)) {
    return { ok: false, error: `Invalid payload.segment: ${segment}` };
  }
  if (!billType) return { ok: false, error: "Missing payload.billType" };
  if (!recommendedAngle) return { ok: false, error: "Missing payload.recommendedAngle" };
  if (!VALID_URGENCIES.has(urgency)) {
    return { ok: false, error: `Invalid urgency: ${urgency}` };
  }

  const idempotencyKey =
    typeof raw.idempotencyKey === "string" && raw.idempotencyKey.trim()
      ? raw.idempotencyKey.trim()
      : buildLeadIdempotencyKey(`${venue}-${city}`, isoDay);

  return {
    ok: true,
    signal: {
      idempotencyKey,
      sourceAgent:
        typeof raw.sourceAgent === "string" && raw.sourceAgent.trim()
          ? raw.sourceAgent.trim()
          : "band-scout-bot",
      signalType:
        typeof raw.signalType === "string" && raw.signalType.trim()
          ? raw.signalType.trim()
          : "venue_lead",
      title,
      summary,
      sourceUrl,
      urgency,
      recommendedAction:
        typeof raw.recommendedAction === "string" && raw.recommendedAction.trim()
          ? raw.recommendedAction.trim()
          : recommendedAngle,
      payload: {
        ...payload,
        venue,
        city,
        segment,
        billType,
        recommendedAngle,
      },
    },
  };
}

export function resolveWebhookSecret(env = process.env, cwd = process.cwd()) {
  const fromEnv = env.AGENT_WEBHOOK_SECRET?.trim();
  if (fromEnv) return fromEnv;
  const envLocalPath = resolve(cwd, ".env.local");
  if (!existsSync(envLocalPath)) return "";
  const raw = readFileSync(envLocalPath, "utf8");
  const match = /^AGENT_WEBHOOK_SECRET=(.+)$/m.exec(raw);
  return match ? match[1].trim().replace(/^["']|["']$/g, "") : "";
}

export async function pushLeadSignals(
  candidates,
  {
    endpoint = process.env.AGENT_SIGNAL_ENDPOINT || DEFAULT_ENDPOINT,
    secret,
    fetchImpl = fetch,
    dryRun = false,
  } = {},
) {
  const results = { inserted: 0, deduplicated: 0, rejected: 0, failed: 0, items: [] };
  if (!dryRun && !secret) {
    throw new Error("AGENT_WEBHOOK_SECRET is required unless --dry-run is set.");
  }

  for (const raw of candidates) {
    const checked = validateLeadSignal(raw);
    if (!checked.ok) {
      results.rejected += 1;
      results.items.push({ status: "rejected", reason: checked.error });
      continue;
    }

    if (dryRun) {
      results.items.push({
        status: "dry_run",
        idempotencyKey: checked.signal.idempotencyKey,
        venue: checked.signal.payload.venue,
      });
      continue;
    }

    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(checked.signal),
    });

    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (response.status === 201 && body?.ok) {
      results.inserted += 1;
      results.items.push({
        status: "inserted",
        httpStatus: 201,
        id: body.id,
        fitScore: body.fitScore,
        priorityTier: body.priorityTier,
        idempotencyKey: checked.signal.idempotencyKey,
        venue: checked.signal.payload.venue,
      });
    } else if (response.status === 200 && body?.deduplicated) {
      results.deduplicated += 1;
      results.items.push({
        status: "deduplicated",
        httpStatus: 200,
        idempotencyKey: checked.signal.idempotencyKey,
        venue: checked.signal.payload.venue,
      });
    } else {
      results.failed += 1;
      results.items.push({
        status: "failed",
        httpStatus: response.status,
        idempotencyKey: checked.signal.idempotencyKey,
        error: body?.error ?? `HTTP ${response.status}`,
      });
    }
  }

  return results;
}

async function main(argv) {
  const inputIdx = argv.indexOf("--input");
  const inputPath = inputIdx !== -1 ? argv[inputIdx + 1] : "data/lead-scout-queue.json";
  const endpointIdx = argv.indexOf("--endpoint");
  const endpoint =
    endpointIdx !== -1
      ? argv[endpointIdx + 1]
      : process.env.AGENT_SIGNAL_ENDPOINT || DEFAULT_ENDPOINT;
  const dryRun = argv.includes("--dry-run");

  const candidates = JSON.parse(readFileSync(resolve(process.cwd(), inputPath), "utf8"));
  if (!Array.isArray(candidates)) {
    throw new Error("Input JSON must be an array of band signal objects.");
  }

  const secret = resolveWebhookSecret();
  const summary = await pushLeadSignals(candidates, { endpoint, secret, dryRun });
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed > 0) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main(process.argv.slice(2));
}
