import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { callTool, failureMemoSize } from "./client.server.ts";
import { ConnectorType } from "./types.ts";
import type { ToolArgs } from "./types.ts";
import { isLoginRequired, redirectToLoginIfRequired } from "./login.ts";
import { classifyCallToolError } from "./errors.ts";
import type { CallToolResult } from "./types.ts";

type WindowStub = {
  location: { assign: (url: string) => void; href: string };
  self?: unknown;
  top?: unknown;
  open?: (url: string, target: string) => unknown;
};

function withWindow<T>(stub: WindowStub, fn: () => T): T {
  (globalThis as { window?: unknown }).window = stub;
  try {
    return fn();
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
}

function fakeJwt(claims: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(claims)}.sig`;
}

async function withStubbedGate(
  status: number,
  body: Record<string, unknown>,
  run: (calls: () => number) => Promise<void>,
): Promise<void> {
  process.env.GROK_CONNECTORS_URL = "https://connectors.invalid.example";
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  try {
    await run(() => calls);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.GROK_CONNECTORS_URL;
  }
}

describe("callTool failure memo", () => {
  it("replays an identical failure within the memo window without refetching", async () => {
    await withStubbedGate(500, { ok: false, errorMessage: "boom" }, async (calls) => {
      const options = {
        connectorType: ConnectorType.GoogleDrive,
        token: fakeJwt({ sub: "memo-user-1", iat: 1000, exp: 2000 }),
      };
      const first = await callTool("google_drive_search", { q: "memo" }, options);
      const second = await callTool("google_drive_search", { q: "memo" }, options);
      assert.equal(first.ok, false);
      assert.equal(first.errorMessage, "boom");
      assert.deepEqual(second, first);
      assert.equal(calls(), 1);
    });
  });

  it("isolates failure cache by bearer token even for identical unverified user claims", async () => {
    await withStubbedGate(500, { ok: false, errorMessage: "boom" }, async (calls) => {
      const first = await callTool(
        "google_drive_search",
        { q: "remint" },
        {
          connectorType: ConnectorType.GoogleDrive,
          token: fakeJwt({ sub: "memo-user-2", iat: 1000, exp: 2000 }),
        },
      );
      const second = await callTool(
        "google_drive_search",
        { q: "remint" },
        {
          connectorType: ConnectorType.GoogleDrive,
          token: fakeJwt({ sub: "memo-user-2", iat: 1001, exp: 2001 }),
        },
      );
      assert.equal(first.ok, false);
      assert.deepEqual(second, first);
      assert.equal(calls(), 2);

      const other = await callTool(
        "google_drive_search",
        { q: "remint" },
        {
          connectorType: ConnectorType.GoogleDrive,
          token: fakeJwt({ sub: "memo-user-3", iat: 1000, exp: 2000 }),
        },
      );
      assert.equal(other.ok, false);
      assert.equal(calls(), 3);
    });
  });

  it("sweeps expired entries on write so unique keys do not accumulate", async () => {
    await withStubbedGate(500, { ok: false, errorMessage: "boom" }, async () => {
      mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
      try {
        const sizeBefore = failureMemoSize();
        const options = {
          connectorType: ConnectorType.GoogleDrive,
          token: fakeJwt({ sub: "memo-user-5", iat: 1000, exp: 2000 }),
        };
        await callTool("google_drive_search", { q: "sweep-a" }, options);
        await callTool("google_drive_search", { q: "sweep-b" }, options);
        assert.equal(failureMemoSize(), sizeBefore + 2);

        mock.timers.setTime(1_000_000 + 5_001);
        await callTool("google_drive_search", { q: "sweep-c" }, options);
        assert.equal(
          failureMemoSize(),
          sizeBefore + 1,
          "expired sweep-a/sweep-b entries must be removed on the sweep-c write",
        );
      } finally {
        mock.timers.reset();
      }
    });
  });

  it("bounds the number of cached failures under distinct requests", async () => {
    await withStubbedGate(500, { ok: false, errorMessage: "boom" }, async () => {
      const options = {
        connectorType: ConnectorType.GoogleDrive,
        token: "bounded-failure-memo-token",
      };
      for (let i = 0; i < 1_010; i += 1) {
        const result = await callTool("google_drive_search", { q: `bounded-${i}` }, options);
        assert.equal(result.ok, false);
      }
      assert.ok(failureMemoSize() <= 1_000);
    });
  });

  it("does not cache failures using oversized argument keys", async () => {
    await withStubbedGate(500, { ok: false, errorMessage: "boom" }, async (calls) => {
      const before = failureMemoSize();
      const options = {
        connectorType: ConnectorType.GoogleDrive,
        token: "oversized-memo-key-token",
      };
      const args = { q: "x".repeat(20_000) };
      assert.equal((await callTool("google_drive_search", args, options)).ok, false);
      assert.equal((await callTool("google_drive_search", args, options)).ok, false);
      assert.equal(calls(), 2, "large keys must not be memoized");
      assert.equal(failureMemoSize(), before);
    });
  });

  it("never memoizes login-required 401s", async () => {
    await withStubbedGate(401, { errorMessage: "login required" }, async (calls) => {
      const options = {
        connectorType: ConnectorType.GoogleDrive,
        token: fakeJwt({ sub: "memo-user-4", iat: 1000, exp: 2000 }),
      };
      const first = await callTool("google_drive_search", { q: "auth" }, options);
      const second = await callTool("google_drive_search", { q: "auth" }, options);
      assert.equal(first.ok, false);
      assert.equal(first.loginRequired, true);
      assert.equal(second.loginRequired, true);
      assert.equal(calls(), 2);
    });
  });
});

describe("connector request deadline", () => {
  it("passes a 15-second abort signal to outbound gate calls", async () => {
    const signalTimeout = mock.method(AbortSignal, "timeout", (ms: number) => {
      assert.equal(ms, 15_000);
      return AbortSignal.abort(new DOMException("deadline", "TimeoutError"));
    });
    try {
      await withStubbedGate(500, { ok: false, errorMessage: "boom" }, async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = (async (_url, init) => {
          assert.ok(init?.signal instanceof AbortSignal);
          assert.equal(init.signal.aborted, true);
          throw init.signal.reason;
        }) as typeof fetch;
        try {
          const result = await callTool("google_drive_search", { q: "deadline-case" }, {
            connectorType: ConnectorType.GoogleDrive, token: "deadline-credential",
          });
          assert.equal(result.ok, false);
          assert.match(result.errorMessage ?? "", /deadline/);
        } finally {
          globalThis.fetch = originalFetch;
        }
      });
    } finally {
      signalTimeout.mock.restore();
    }
  });
});

describe("connector response safety", () => {
  it("rejects oversized upstream responses without parsing them", async () => {
    process.env.GROK_CONNECTORS_URL = "https://connectors.invalid.example";
    const saved = globalThis.fetch;
    globalThis.fetch = (async () => new Response("x".repeat(257 * 1024), { status: 200 })) as typeof fetch;
    try {
      const result = await callTool("google_drive_search", { q: "oversize-response-test" }, {
        connectorType: ConnectorType.GoogleDrive,
        token: "oversize-response-test-token",
      });
      assert.equal(result.ok, false);
      assert.match(result.errorMessage ?? "", /Connector response exceeds safety limit/);
    } finally {
      globalThis.fetch = saved;
      delete process.env.GROK_CONNECTORS_URL;
    }
  });
});

describe("connector redirect safety", () => {
  it("treats a gateway redirect as failure rather than a successful tool result", async () => {
    await withStubbedGate(302, {}, async (calls) => {
      const result = await callTool("google_drive_search", { q: "redirect-case" }, {
        connectorType: ConnectorType.GoogleDrive,
        token: "connector-redirect-test-token",
      });
      assert.equal(result.ok, false);
      assert.match(result.errorMessage ?? "", /redirect.*HTTP 302/);
      assert.equal(calls(), 1);
    });
  });
});

describe("connector gateway success validation", () => {
  it("rejects HTTP 200 with missing success confirmation", async () => {
    await withStubbedGate(200, {}, async (calls) => {
      const result = await callTool("google_drive_search", { q: "empty-success-marker" }, {
        connectorType: ConnectorType.GoogleDrive,
        token: "missing-success-marker-test-token",
      });
      assert.equal(result.ok, false);
      assert.match(result.errorMessage ?? "", /no success confirmation/);
      assert.equal(calls(), 1);
    });
  });

  it("never treats HTTP 500 as success even with ok true in the body", async () => {
    await withStubbedGate(500, { ok: true, data: { misleading: true } }, async (calls) => {
      const result = await callTool("google_drive_search", { q: "error-status-success-body" }, {
        connectorType: ConnectorType.GoogleDrive,
        token: "http-error-success-body-token",
      });
      assert.equal(result.ok, false);
      assert.match(result.errorMessage ?? "", /HTTP 500/);
      assert.equal(calls(), 1);
    });
  });

  it("preserves confirmed successful tool responses", async () => {
    await withStubbedGate(200, { ok: true, data: { items: [1] } }, async (calls) => {
      const result = await callTool("google_drive_search", { q: "confirmed-success" }, {
        connectorType: ConnectorType.GoogleDrive,
        token: "confirmed-success-test-token",
      });
      assert.deepEqual(result, { ok: true, data: { items: [1] } });
      assert.equal(calls(), 1);
    });
  });
});

describe("connector error confidentiality", () => {
  it("does not echo untrusted non-JSON gateway response contents", async () => {
    process.env.GROK_CONNECTORS_URL = "https://connectors.invalid.example";
    const originalFetch = globalThis.fetch;
    const secret = "SENSITIVE_GATEWAY_BODY_DO_NOT_ECHO";
    globalThis.fetch = (async () => new Response(`Gateway broke: ${secret}`, { status: 502 })) as typeof fetch;
    try {
      const result = await callTool("google_drive_search", { q: "redaction-case" }, {
        connectorType: ConnectorType.GoogleDrive,
        token: "redaction-test-token",
      });
      assert.equal(result.ok, false);
      assert.match(result.errorMessage ?? "", /invalid JSON.*HTTP 502/);
      assert.doesNotMatch(result.errorMessage ?? "", /SENSITIVE_GATEWAY_BODY_DO_NOT_ECHO/);
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.GROK_CONNECTORS_URL;
    }
  });
});

describe("connector JSON shape validation", () => {
  it("rejects JSON null and arrays without throwing or reporting success", async () => {
    process.env.GROK_CONNECTORS_URL = "https://connectors.invalid.example";
    const saved = globalThis.fetch;
    try {
      for (const [i, body] of ["null", "[]", "42"].entries()) {
        globalThis.fetch = (async () => new Response(body, { status: 200 })) as typeof fetch;
        const result = await callTool("google_drive_search", { q: `json-shape-${i}` }, {
          connectorType: ConnectorType.GoogleDrive,
          token: "invalid-json-shape-test-token",
        });
        assert.equal(result.ok, false);
        assert.match(result.errorMessage ?? "", /invalid JSON object/);
      }
    } finally {
      globalThis.fetch = saved;
      delete process.env.GROK_CONNECTORS_URL;
    }
  });
});

describe("connector redirect without response body", () => {
  it("rejects a stalled 302 body without waiting for its contents", async () => {
    process.env.GROK_CONNECTORS_URL = "https://connectors.invalid.example";
    const saved = globalThis.fetch;
    globalThis.fetch = (async () => new Response(new ReadableStream({ start() {} }), {
      status: 302, headers: { location: "https://example.invalid/signin" },
    })) as typeof fetch;
    try {
      const result = await callTool("google_drive_search", { q: "stalled-redirect-test" }, {
        connectorType: ConnectorType.GoogleDrive, token: "stalled-redirect-test-token",
      });
      assert.equal(result.ok, false);
      assert.match(result.errorMessage ?? "", /redirect.*HTTP 302/);
    } finally {
      globalThis.fetch = saved;
      delete process.env.GROK_CONNECTORS_URL;
    }
  });
});

describe("callTool", () => {
  it("resolves ok:false for non-serializable args instead of rejecting", async () => {
    process.env.GROK_CONNECTORS_URL = "https://connectors.invalid.example";
    try {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      const result = await callTool(
        "google_drive_search",
        circular as ToolArgs,
        {
          connectorType: ConnectorType.GoogleDrive,
          token: "opaque-token",
        },
      );
      assert.equal(result.ok, false);
      assert.match(result.errorMessage ?? "", /circular/i);
    } finally {
      delete process.env.GROK_CONNECTORS_URL;
    }
  });
});

describe("isLoginRequired", () => {
  it("is true only for login-required failures", () => {
    assert.equal(
      isLoginRequired({ ok: false, data: null, loginRequired: true }),
      true,
    );
    assert.equal(isLoginRequired({ ok: false, data: null }), false);
    assert.equal(
      isLoginRequired({ ok: false, data: null, errorMessage: "access_denied" }),
      false,
    );
    assert.equal(
      isLoginRequired({
        ok: true,
        data: {},
        loginRequired: true,
      } as CallToolResult),
      false,
    );
  });
});

describe("redirectToLoginIfRequired", () => {
  it("no-ops when login is not required", () => {
    let target = "";
    const did = withWindow(
      {
        location: {
          assign: (u) => {
            target = u;
          },
          href: "https://my-app.grok.me/current",
        },
      },
      () =>
        redirectToLoginIfRequired({
          ok: false,
          data: null,
          errorMessage: "tool error",
        }),
    );
    assert.equal(did, false);
    assert.equal(target, "");
  });

  it("navigates to the server-built loginUrl in the browser", () => {
    let target = "";
    const did = withWindow(
      {
        location: {
          assign: (u) => {
            target = u;
          },
          href: "https://my-app.grok.me/current",
        },
      },
      () =>
        redirectToLoginIfRequired({
          ok: false,
          data: null,
          loginRequired: true,
          loginUrl: "https://gate.grok.me/__gate/signin?return_to=x",
        }),
    );
    assert.equal(did, true);
    assert.equal(target, "https://gate.grok.me/__gate/signin?return_to=x");
  });

  it("opens a new tab instead of navigating when framed", () => {
    let assigned = "";
    let opened = "";
    const openedTab: { opener?: unknown } = { opener: "parent" };
    const did = withWindow(
      {
        self: "frame",
        top: "host",
        open: (url) => {
          opened = url;
          return openedTab;
        },
        location: {
          assign: (u) => {
            assigned = u;
          },
          href: "https://my-app.grok.me/current",
        },
      },
      () =>
        redirectToLoginIfRequired({
          ok: false,
          data: null,
          loginRequired: true,
          loginUrl: "https://gate.grok.me/__gate/signin?return_to=x",
        }),
    );
    assert.equal(did, true);
    assert.equal(opened, "https://gate.grok.me/__gate/signin?return_to=x");
    assert.equal(openedTab.opener, null);
    assert.equal(assigned, "");
  });

  it("falls back to navigation when framed and the popup is blocked", () => {
    let assigned = "";
    const did = withWindow(
      {
        self: "frame",
        top: "host",
        open: () => null,
        location: {
          assign: (u) => {
            assigned = u;
          },
          href: "https://my-app.grok.me/current",
        },
      },
      () =>
        redirectToLoginIfRequired({
          ok: false,
          data: null,
          loginRequired: true,
          loginUrl: "https://gate.grok.me/__gate/signin?return_to=x",
        }),
    );
    assert.equal(did, true);
    assert.equal(assigned, "https://gate.grok.me/__gate/signin?return_to=x");
  });

  it("returns false when the result has no loginUrl", () => {
    let target = "";
    const did = withWindow(
      {
        location: {
          assign: (u) => {
            target = u;
          },
          href: "https://my-app.grok.me/current",
        },
      },
      () =>
        redirectToLoginIfRequired({ ok: false, data: null, loginRequired: true }),
    );
    assert.equal(did, false);
    assert.equal(target, "");
  });

  it("returns false on the server (no window)", () => {
    const did = redirectToLoginIfRequired({
      ok: false,
      data: null,
      loginRequired: true,
      loginUrl: "https://gate.grok.me/__gate/signin?return_to=x",
    });
    assert.equal(did, false);
  });
});

describe("classifyCallToolError", () => {
  it("returns null for successful results", () => {
    assert.equal(classifyCallToolError({ ok: true, data: {} }), null);
  });

  it("classifies login-required before message matching", () => {
    const state = classifyCallToolError({
      ok: false,
      data: null,
      loginRequired: true,
      errorMessage: "missing_connector_token",
    });
    assert.equal(state?.kind, "login");
    assert.equal(state?.detail, "missing_connector_token");
  });

  it("classifies not_connected and failed_precondition", () => {
    assert.equal(
      classifyCallToolError({
        ok: false,
        data: null,
        errorMessage: "connector_not_connected: Notion",
      })?.kind,
      "not_connected",
    );
    assert.equal(
      classifyCallToolError({
        ok: false,
        data: null,
        errorMessage: "FAILED_PRECONDITION: no connector",
      })?.kind,
      "not_connected",
    );
  });

  it("classifies scope_denied without claiming a missing grant", () => {
    const state = classifyCallToolError({
      ok: false,
      data: null,
      errorMessage: "scope_denied: tool notion-list-recent-pages not in grant scopes",
    });
    assert.equal(state?.kind, "scope_denied");
    assert.match(state?.message ?? "", /tool outside its grant/);
    assert.match(state?.detail ?? "", /notion-list-recent-pages/);
  });

  it("classifies access_denied", () => {
    assert.equal(
      classifyCallToolError({
        ok: false,
        data: null,
        errorMessage: "access_denied",
      })?.kind,
      "access_denied",
    );
  });

  it("falls back to a generic error with the raw message", () => {
    const state = classifyCallToolError({
      ok: false,
      data: null,
      errorMessage: "boom",
    });
    assert.equal(state?.kind, "error");
    assert.equal(state?.message, "boom");
    const empty = classifyCallToolError({ ok: false, data: null });
    assert.equal(empty?.kind, "error");
    assert.equal(empty?.message, "Something went wrong. Try again.");
    assert.equal(empty?.detail, undefined);
  });
});
