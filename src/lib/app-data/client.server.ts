import { createHash } from "node:crypto";
import { getRequest } from "@tanstack/react-start/server";
import {
  assertSameSiteRequest,
  CrossSiteRequestError,
} from "../auth/isolation.server.ts";
import { assertAppDataServerOnly } from "./server-only.ts";
import {
  CONNECTOR_TOKEN_HEADER,
  ConnectorType,
  type CallToolOptions,
  type CallToolResult,
  type ToolArgs,
} from "./types.ts";

assertAppDataServerOnly("app-data/client.server");

export const CONNECTORS_HOST_STAGING = "connectors.app-builder-testing.com";
export const CONNECTORS_HOST_PROD = "connectors.grok.me";

function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

function isLoopbackHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

type InboundContext = {
  token: string | null;
  publicHost: string | null;
  connectorsBase: string | null;
};

function connectorsBaseFor(publicHost: string | null): string | null {
  const explicit = env("GROK_CONNECTORS_URL");
  if (explicit) return explicit.replace(/\/+$/, "");

  const host = publicHost?.toLowerCase();
  if (!host || isLoopbackHost(host)) return null;
  if (
    host === "app-builder-testing.com" ||
    host.endsWith(".app-builder-testing.com")
  ) {
    return `https://${CONNECTORS_HOST_STAGING}`;
  }
  if (host === "grok.me" || host.endsWith(".grok.me")) {
    return `https://${CONNECTORS_HOST_PROD}`;
  }
  return null;
}

function tryGetRequest(): Request | null {
  try {
    return getRequest() ?? null;
  } catch {
    return null;
  }
}

function inboundContext(): InboundContext {
  const req = tryGetRequest();
  const xf = req?.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const publicHost =
    (xf || req?.headers.get("host") || "").split(":")[0]?.trim() || null;
  const headerToken = req?.headers.get(CONNECTOR_TOKEN_HEADER)?.trim() || null;
  const envToken =
    process.env.NODE_ENV === "production"
      ? null
      : (env("GROK_CONNECTOR_ACCESS_TOKEN") ?? null);
  return {
    token: headerToken ?? envToken,
    publicHost,
    connectorsBase: connectorsBaseFor(publicHost),
  };
}

export function resolveGateAppDataBase(): string | null {
  return inboundContext().connectorsBase;
}

export function getConnectorAccessToken(): string | null {
  return inboundContext().token;
}

type GateJson = {
  ok?: boolean;
  data?: unknown;
  errorMessage?: string;
  loginUrl?: string;
};

async function gatePost(
  ctx: InboundContext,
  body: Record<string, unknown>,
  token: string,
): Promise<{ status: number; json: GateJson }> {
  const base = ctx.connectorsBase;
  if (!base) {
    throw new Error(
      "cannot resolve gate host (missing x-forwarded-host/host on the server request); " +
        "open the app through the gated public URL so the gate can proxy and inject credentials",
    );
  }

  if (!/^https?:\/\//i.test(base)) {
    throw new Error(
      `gate base must be absolute http(s) URL (got ${base}); refusing relative fetch`,
    );
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
    authorization: `Bearer ${token}`,
  };
  if (ctx.publicHost) {
    headers["x-forwarded-host"] = ctx.publicHost;
  }

  const res = await fetch(`${base}/call-tool`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });

  // Reject redirects from the response headers before reading any body.
  // An HTML login redirect must never stall connector calls or masquerade as
  // a completed tool operation.
  if (res.status >= 300 && res.status < 400) {
    void res.body?.cancel().catch(() => undefined);
    return { status: res.status, json: {} };
  }

  let json: GateJson = {};
  // The fetch signal remains active while consuming a streaming response body.
  const maxResponseBytes = 256 * 1024;
  let text = "";
  if (res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let received = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > maxResponseBytes) {
          void reader.cancel().catch(() => undefined);
          throw new Error("Connector response exceeds safety limit");
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
  }
  if (text) {
    try {
      const parsed: unknown = JSON.parse(text);
      json = parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as GateJson
        : { ok: false, errorMessage: `Connector gate returned invalid JSON object (HTTP ${res.status})` };
    } catch {
      json = {
        ok: false,
        errorMessage: `Connector gate returned invalid JSON (HTTP ${res.status})`,
      };
    }
  }

  return { status: res.status, json };
}

function gateSigninUrl(ctx: InboundContext): string | undefined {
  const base = ctx.connectorsBase;
  if (!base) return undefined;
  try {
    const connectorsHost = new URL(base).host.toLowerCase();
    const gateHost = connectorsHost.replace(/^connectors\./, "gate.");
    if (gateHost === connectorsHost) return undefined;
    const publicHost = ctx.publicHost?.toLowerCase();
    const gated =
      publicHost && !isLoopbackHost(publicHost)
        ? `https://${publicHost}`
        : undefined;
    const signin = `https://${gateHost}/__gate/signin`;
    return gated
      ? `${signin}?return_to=${encodeURIComponent(gated)}`
      : signin;
  } catch {
    return undefined;
  }
}

function missingAuthResult(ctx: InboundContext): CallToolResult {
  const loginUrl = gateSigninUrl(ctx);
  return {
    ok: false,
    data: null,
    loginRequired: true,
    errorMessage:
      "missing_connector_token: open this app through the edge gate " +
      "(the server must receive x-connector-access-token on the inbound request)",
    ...(loginUrl ? { loginUrl } : {}),
  };
}

function crossSiteBlockedResult(): CallToolResult | null {
  try {
    assertSameSiteRequest();
    return null;
  } catch (e) {
    if (e instanceof CrossSiteRequestError) {
      return { ok: false, data: null, errorMessage: e.message };
    }
    return null;
  }
}

const FAILURE_MEMO_TTL_MS = 5_000;
const FAILURE_MEMO_MAX_ENTRIES = 1_000;
const failureMemo = new Map<string, { at: number; result: CallToolResult }>();

function tokenIdentityKey(token: string): string {
  // Token claims are not verified here: distinct bearer tokens can declare
  // the same sub/team_id. Cache failures per credential, not per claimed user,
  // so one token cannot poison another credential's short-lived failure cache.
  // Only the digest is stored; never retain or log the raw bearer token.
  return createHash("sha256").update(token).digest("base64url");
}

function memoizedFailure(key: string | null): CallToolResult | null {
  if (!key) return null;
  const hit = failureMemo.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > FAILURE_MEMO_TTL_MS) {
    failureMemo.delete(key);
    return null;
  }
  return hit.result;
}

function memoizeFailure(
  key: string | null,
  result: CallToolResult,
): CallToolResult {
  if (!key) return result;
  const now = Date.now();
  for (const [staleKey, entry] of failureMemo) {
    if (now - entry.at > FAILURE_MEMO_TTL_MS) failureMemo.delete(staleKey);
  }
  // Bound short-lived failures even when every request has a unique cache key.
  // Map iteration preserves insertion order, so evict the oldest entry first.
  failureMemo.delete(key);
  failureMemo.set(key, { at: now, result });
  while (failureMemo.size > FAILURE_MEMO_MAX_ENTRIES) {
    const oldest = failureMemo.keys().next().value;
    if (oldest === undefined) break;
    failureMemo.delete(oldest);
  }
  return result;
}

export function failureMemoSize(): number {
  return failureMemo.size;
}

function safeMemoKey(parts: unknown[]): string | null {
  try {
    return JSON.stringify(parts);
  } catch {
    return null;
  }
}

function nonPostBlockedResult(): CallToolResult | null {
  const req = tryGetRequest();
  if (!req || req.method === "POST") return null;
  return {
    ok: false,
    data: null,
    errorMessage:
      `blocked ${req.method} inbound request: connector calls must run inside ` +
      'a createServerFn({ method: "POST" }) handler',
  };
}

export async function callTool(
  toolName: string,
  args: ToolArgs,
  options: CallToolOptions,
): Promise<CallToolResult> {
  const blocked = crossSiteBlockedResult() ?? nonPostBlockedResult();
  if (blocked) return blocked;

  const ctx = inboundContext();
  const token = options.token ?? ctx.token;
  if (!token) {
    return missingAuthResult(ctx);
  }

  const connectorType = options.connectorType;
  if (!connectorType) {
    return {
      ok: false,
      data: null,
      errorMessage:
        "connectorType is required: pass the connector type granted to this app " +
        "(e.g. { connectorType: ConnectorType.GoogleDrive })",
    };
  }

  const memoKey = safeMemoKey([
    toolName,
    args,
    connectorType,
    options?.connectorCatalogId ?? null,
    tokenIdentityKey(token),
  ]);
  const memoized = memoizedFailure(memoKey);
  if (memoized) {
    return memoized;
  }
  const fail = (errorMessage: string): CallToolResult =>
    memoizeFailure(memoKey, { ok: false, data: null, errorMessage });
  if (connectorType === ConnectorType.Mcp && !options?.connectorCatalogId) {
    return {
      ok: false,
      data: null,
      errorMessage: "connectorCatalogId is required when connectorType is Mcp",
    };
  }

  try {
    const { status, json } = await gatePost(
      ctx,
      {
        host: ctx.publicHost ?? undefined,
        connector_type: connectorType,
        tool_name: toolName,
        arguments: args,
        connector_catalog_id: options.connectorCatalogId,
      },
      token,
    );

    // Redirects are not connector tool results. With redirect: "manual",
    // an authentication redirect must not become a false successful call.
    if (status >= 300 && status < 400) {
      return fail(`Connector gate returned redirect (HTTP ${status})`);
    }
    if (status === 401) {
      const loginUrl =
        gateSigninUrl(ctx) ??
        (typeof json.loginUrl === "string" && json.loginUrl
          ? json.loginUrl
          : undefined);
      return {
        ok: false,
        data: null,
        loginRequired: true,
        errorMessage: json.errorMessage ?? "login required",
        ...(loginUrl ? { loginUrl } : {}),
      };
    }
    if (status === 403) {
      return fail(json.errorMessage ?? "access_denied");
    }
    if (json.errorMessage && json.ok === false) {
      return fail(json.errorMessage);
    }
    if (status >= 400) {
      return fail(json.errorMessage ?? `HTTP ${status}`);
    }
    // An empty/partial 2xx response is not confirmation that a connector
    // tool ran successfully. Require the gateway's explicit success marker.
    if (json.ok !== true) {
      return fail(json.errorMessage ?? "Connector gate returned no success confirmation");
    }
    return { ok: true, data: json.data ?? null };
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

export {
  ConnectorType,
  GoogleDriveTools,
  CONNECTOR_TOKEN_HEADER,
} from "./types.ts";
export type {
  CallToolResult,
  CallToolOptions,
  ToolArgs,
  ConnectorTypeName,
} from "./types.ts";
export { isLoginRequired, redirectToLoginIfRequired } from "./login.ts";
