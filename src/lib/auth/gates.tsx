import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { signInCapabilities } from "../auth-capabilities";
import { Navigate } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, signIn, signOut } from "./client";
import { hasGateSessionMarker } from "./gate-session-marker";
import { resolveSignInGateState } from "./sign-in-gate";
import { useCurrentUser, useCurrentUserState } from "./use-current-user";

const subscribeToNothing = () => () => {};
const noGateSessionOnServer = () => false;

export const SIGN_IN_PATH = "/login";

export function SignedIn({ children }: { children: ReactNode }) {
  const { user } = useCurrentUserState();
  return user ? <>{children}</> : null;
}

export function SignedOut({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending || user) return null;
  return <>{children}</>;
}

export function RedirectToSignIn({ to = SIGN_IN_PATH }: { to?: string }) {
  return <Navigate to={to} />;
}

export function SignInGate({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const state = resolveSignInGateState({ isPending, hasUser: user !== null });
  if (state === "pending")
    return (
      <div role="status" aria-live="polite" className="grid min-h-dvh place-items-center px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div
            className="size-10 animate-spin rounded-full border-[3px] border-line-strong border-t-accent"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-muted">Preparing your artist workspace…</p>
        </div>
      </div>
    );
  if (state === "signed_in") return <>{children}</>;
  return <>{fallback ?? <SignInButtons />}</>;
}

function EmailAuthForm() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!email.trim() || password.length < 8 || (mode === "sign-up" && !name.trim())) {
      setError(
        mode === "sign-up"
          ? "Enter your name, email, and an 8+ character password."
          : "Enter your email and an 8+ character password.",
      );
      return;
    }
    setBusy(true);
    try {
      if (mode === "sign-up") {
        const result = await authClient.signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
          callbackURL: "/",
        });
        if (result.error) throw new Error(result.error.message ?? "Could not create account");
      } else {
        const result = await authClient.signIn.email({
          email: email.trim(),
          password,
          callbackURL: "/",
        });
        if (result.error) throw new Error(result.error.message ?? "Could not sign in");
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 border-t border-line pt-5">
      <div className="mb-3 flex rounded-md border border-line p-1">
        {(["sign-in", "sign-up"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={`flex-1 rounded px-3 py-2 text-xs font-semibold ${mode === value ? "bg-surface-2 text-fg" : "text-muted"}`}
          >
            {value === "sign-in" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>
      <form className="space-y-2" onSubmit={submit}>
        {mode === "sign-up" ? (
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="Artist / band name"
            placeholder="Artist / band name"
            autoComplete="name"
            className="h-11 w-full rounded-md border border-line-strong bg-bg px-3 text-sm outline-none focus:border-muted"
          />
        ) : null}
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-label="Email"
          placeholder="Email"
          autoComplete="email"
          className="h-11 w-full rounded-md border border-line-strong bg-bg px-3 text-sm outline-none focus:border-muted"
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-label="Password"
          placeholder="Password (8+ characters)"
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          className="h-11 w-full rounded-md border border-line-strong bg-bg px-3 text-sm outline-none focus:border-muted"
        />
        {error ? <p className="text-xs text-warn">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="h-11 w-full rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-50"
        >
          {busy ? "Working…" : mode === "sign-up" ? "Create account" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export function SignInButtons() {
  const pending = useRef(false);
  const [microsoftReady, setMicrosoftReady] = useState(false);
  useEffect(() => {
    let active = true;
    signInCapabilities()
      .then((c) => {
        if (active) setMicrosoftReady(c.microsoft);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (
      code &&
      ["state_mismatch", "state_security_mismatch", "state_not_found", "state_invalid"].includes(
        code,
      )
    )
      setError(
        "Sign-in expired or another attempt replaced it. Please retry once in this tab with cookies enabled.",
      );
    else if (code === "account_not_linked")
      setError(
        "This email already has an account. Sign in with your existing method, then connect Microsoft or Google from Account.",
      );
    else if (code) setError("Sign-in could not finish. Retry or use your existing email account.");
  }, []);
  async function start(providerId: string) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await signIn(providerId, { callbackURL: "/" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in failed. Please try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      {GROK_PROVIDERS.map((p) => (
        <button
          key={p.providerId}
          type="button"
          disabled={busy}
          onClick={() => void start(p.providerId)}
          className="min-h-11 w-full rounded-md border border-line-strong bg-surface px-4 py-2 text-fg hover:bg-surface-2 disabled:opacity-50"
        >
          Continue with {p.label}
        </button>
      ))}
      <button
        type="button"
        disabled={busy || !microsoftReady}
        onClick={() => void start("microsoft")}
        className="min-h-11 w-full rounded-md border border-line-strong bg-surface px-4 py-2 text-fg hover:bg-surface-2 disabled:opacity-50"
      >
        Continue with Microsoft
      </button>
      {!microsoftReady && (
        <p className="text-xs text-muted">
          Microsoft sign-in is awaiting application configuration.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-warn">
          {error}
        </p>
      )}
      {authEnabled ? <EmailAuthForm /> : null}
    </div>
  );
}

export function UserButton() {
  const user = useCurrentUser();
  const [signingOut, setSigningOut] = useState(false);
  const gateSession = useSyncExternalStore(
    subscribeToNothing,
    hasGateSessionMarker,
    noGateSessionOnServer,
  );
  if (!user) return null;
  const label = user.displayName ?? user.primaryEmail ?? "Account";
  return (
    <div className="flex items-center gap-2">
      {user.profileImageUrl ? (
        <img src={user.profileImageUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
      ) : (
        <span className="grid h-8 w-8 place-items-center rounded-full bg-black/10 text-sm font-medium dark:bg-white/20">
          {label.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
      {authEnabled && !gateSession ? (
        <button
          type="button"
          disabled={signingOut}
          onClick={() => {
            setSigningOut(true);
            void signOut().catch(() => setSigningOut(false));
          }}
          className="cursor-pointer text-sm underline-offset-4 opacity-70 hover:underline disabled:cursor-wait disabled:no-underline"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      ) : null}
    </div>
  );
}
