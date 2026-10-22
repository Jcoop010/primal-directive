/**
 * Self-hosted Better Auth for THIS app (server-only).
 *
 * The existing Vercel/Supabase integration may expose the Postgres connection
 * under STORAGE_URL because it was originally installed with the STORAGE
 * prefix. Accept that existing variable as a compatibility alias for
 * DATABASE_URL; do not require a second integration or a copied secret.
 */
import { betterAuth } from "better-auth";
import { bearer, genericOAuth } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { getCookie } from "@tanstack/react-start/server";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { ensureDbReady, getPglite } from "../db";
import { emailAndPasswordEnabled } from "./email-password";
import { GATE_PROVIDER_ID, gateIdentitySessions } from "./gate-session.server";
import { GROK_PROVIDERS } from "./providers";
import { pgliteDialect } from "./pglite-dialect";
import {
  GROK_ISSUER_DEFAULT,
  PREVIEW_ALLOWED_HOSTS,
  PREVIEW_CLIENT_ID,
  PREVIEW_CLIENT_SECRET,
} from "./preview";

void ensureDbReady();

const globalAuthRef = globalThis as typeof globalThis & {
  __grokAuthPreviewSecret__?: string;
};
function previewAuthSecret(): string {
  globalAuthRef.__grokAuthPreviewSecret__ ??= randomBytes(32).toString("hex");
  return globalAuthRef.__grokAuthPreviewSecret__;
}

const env = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
};

const authDisabled = env("VITE_AUTH_ENABLED") === "false";
const grokIssuer = env("GROK_AUTH_ISSUER") ?? GROK_ISSUER_DEFAULT;
const grokClientId = env("GROK_AUTH_CLIENT_ID") ?? PREVIEW_CLIENT_ID;
const grokClientSecret = env("GROK_AUTH_CLIENT_SECRET") ?? PREVIEW_CLIENT_SECRET;

export const authConfigured =
  !authDisabled && Boolean(grokClientId && grokClientSecret);

const explicitBaseURL = env("BETTER_AUTH_URL");
const originForHost = (value: string): string => {
  const normalized = value.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${normalized}`;
};
const deploymentOrigins = [
  env("VERCEL_PROJECT_PRODUCTION_URL"),
  env("VERCEL_URL"),
]
  .filter((host): host is string => Boolean(host))
  .map(originForHost);
const previewAllowedHosts: string[] = [...PREVIEW_ALLOWED_HOSTS];
const LOCAL_DEV_ORIGINS: string[] = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://[::1]:8080",
];
const PRODUCTION_HOST = "primal-directive-loose-ends-co.vercel.app";
const baseURL = explicitBaseURL ?? deploymentOrigins[0] ?? {
  allowedHosts: [
    ...previewAllowedHosts,
    ...deploymentOrigins.map((origin) => origin.replace(/^https?:\/\//, "")),
    "primal-directive-loose-ends-co.vercel.app",
    "localhost",
    "127.0.0.1",
    "[::1]",
  ],
  protocol: "auto" as const,
  fallback: `https://${PRODUCTION_HOST}`,
};

const trustedOrigins: string[] = [
  ...(explicitBaseURL ? [originForHost(explicitBaseURL)] : []),
  ...deploymentOrigins,
  "https://primal-directive-loose-ends-co.vercel.app",
  ...previewAllowedHosts.flatMap((host) => [`https://${host}`, `http://${host}`]),
  ...LOCAL_DEV_ORIGINS,
].filter((origin, index, all) => all.indexOf(origin) === index);

const databaseUrl =
  env("DATABASE_URL") ??
  env("STORAGE_URL") ??
  env("POSTGRES_PRISMA_URL") ??
  env("POSTGRES_URL_NON_POOLING") ??
  env("POSTGRES_URL") ??
  env("database_POSTGRES_PRISMA_URL") ??
  env("database_POSTGRES_URL_NON_POOLING") ??
  env("database_POSTGRES_URL");

const issuerBase = grokIssuer.replace(/\/+$/, "");
const grokAuthorizationUrl = `${issuerBase}/api/auth/oauth2/authorize`;
const grokTokenUrl = `${issuerBase}/api/auth/oauth2/token`;
const grokUserInfoUrl = `${issuerBase}/api/auth/oauth2/userinfo`;

function postgresConnectionString(connectionString: string): string {
  // node-postgres/pg-connection-string v2.9+ interprets sslmode=require as
  // certificate verification (verify-full). Existing managed Postgres
  // endpoints using the historical libpq "require" behavior can then fail
  // with SELF_SIGNED_CERT_IN_CHAIN. Keep TLS encryption while restoring the
  // documented libpq-compatible meaning of "require" for that explicit mode.
  try {
    const url = new URL(connectionString);
    if (url.searchParams.get("sslmode") === "require") {
      url.searchParams.set("uselibpqcompat", "true");
    }
    return url.toString();
  } catch {
    return connectionString;
  }
}

const database = databaseUrl
  ? new Pool({ connectionString: postgresConnectionString(databaseUrl) })
  : { dialect: pgliteDialect(() => getPglite()), type: "postgres" as const };

export const SESSION_TOKEN_COOKIE = "__Host-grok-auth.session_token";

const grokOAuthPlugin = authConfigured
  ? genericOAuth({
      config: GROK_PROVIDERS.map(({ providerId, idp }) => ({
        providerId,
        clientId: grokClientId as string,
        clientSecret: grokClientSecret as string,
        authorizationUrl: grokAuthorizationUrl,
        tokenUrl: grokTokenUrl,
        userInfoUrl: grokUserInfoUrl,
        scopes: ["openid", "profile", "email"],
        authorizationUrlParams: { idp, prompt: "login" },
      })),
    })
  : null;

const googleOAuthConfigured = Boolean(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET"));
const microsoftOAuthConfigured = Boolean(env("MICROSOFT_CLIENT_ID") && env("MICROSOFT_CLIENT_SECRET"));

const configuredAuthSecret = env("BETTER_AUTH_SECRET");
if (process.env.VERCEL_ENV === "production" && !configuredAuthSecret) {
  throw new Error("Production authentication requires BETTER_AUTH_SECRET.");
}

export const auth = betterAuth({
  baseURL,
  secret: configuredAuthSecret ?? previewAuthSecret(),
  database,
  trustedOrigins,
  socialProviders: {
    ...(googleOAuthConfigured ? { google: {
      clientId: env("GOOGLE_CLIENT_ID")!,
      clientSecret: env("GOOGLE_CLIENT_SECRET")!,
      // Gmail access is opt-in, distinct from signing in with Google.
      // Only request these permissions after the owner enables the integration.
      ...(env("GMAIL_INTEGRATION_ENABLED") === "true"
        ? {
            scope: ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send"],
            prompt: "consent" as const,
            accessType: "offline" as const,
          }
        : {}),
    } } : {}),
  },
  account: {
    encryptOAuthTokens: true,
    accountLinking: {
      enabled: true,
      trustedProviders: [
        ...GROK_PROVIDERS.map((p) => p.providerId),
        GATE_PROVIDER_ID,
      ],
      requireLocalEmailVerified: false,
    },
  },
  session: { cookieCache: { enabled: true, maxAge: 300 } },
  ...(emailAndPasswordEnabled ? { emailAndPassword: { enabled: true } } : {}),
  advanced: {
    useSecureCookies: false,
    defaultCookieAttributes: { secure: true, sameSite: "lax", path: "/" },
    cookies: {
      // Host-only namespace prevents legacy/path-scoped state cookies from shadowing OAuth.
      // Signature, expiry, and state/nonce validation remain enabled.
      state: { name: "__Host-primal-directive.oauth_state" },
      session_token: { name: SESSION_TOKEN_COOKIE },
      session_data: { name: "__Host-grok-auth.session_data" },
      account_data: { name: "__Host-grok-auth.account_data" },
      dont_remember: { name: "__Host-grok-auth.dont_remember" },
    },
  },
  plugins: [
    gateIdentitySessions(),
    ...(grokOAuthPlugin ? [grokOAuthPlugin] : []),
    bearer(),
    tanstackStartCookies(),
  ],
});

export function readSessionToken(): string | null {
  return getCookie(SESSION_TOKEN_COOKIE) ?? null;
}

export { GROK_PROVIDERS } from "./providers";
