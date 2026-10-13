import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCitationUrls } from "./ai-citations.ts";

test("keeps valid HTTPS source URLs and normalizes fragments", () => {
  assert.deepEqual(
    normalizeCitationUrls([
      "https://example.com/research#section",
      "https://venue.example/events",
    ]),
    [
      "https://example.com/research",
      "https://venue.example/events",
    ],
  );
});

test("rejects insecure, malformed, credentialed, and local citation URLs", () => {
  assert.deepEqual(
    normalizeCitationUrls([
      "http://example.com/page",
      "javascript:alert(1)",
      "not a URL",
      "https://user:password@example.com/private",
      "https://localhost/admin",
      "https://service.local/path",
    ]),
    [],
  );
});

test("accepts provider citation objects, deduplicates, and caps source lists", () => {
  assert.deepEqual(
    normalizeCitationUrls([
      { url: "https://example.com/" },
      "https://example.com/",
      { url: "https://second.example/" },
      "https://third.example/",
      "https://fourth.example/",
      "https://fifth.example/",
      "https://sixth.example/",
      "https://seventh.example/",
    ]),
    [
      "https://example.com/",
      "https://second.example/",
      "https://third.example/",
      "https://fourth.example/",
      "https://fifth.example/",
      "https://sixth.example/",
    ],
  );
});
