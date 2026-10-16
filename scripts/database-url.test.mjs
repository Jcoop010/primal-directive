import assert from "node:assert/strict";
import { test } from "node:test";
import { validateDatabaseUrl } from "./database-url.mjs";
const good = "postgresql://postgres.example:secret@aws-0-us-east-2.pooler.supabase.com:6543/postgres";
test("valid Postgres URL passes through unchanged", () => assert.equal(validateDatabaseUrl(good), good));
for (const [label, input] of [
  ["invalid scheme", "https://example.com/database"],
  ["invalid host from Vercel log", "postgresql://u:secret@base:6543/postgres"],
  ["missing password", "postgresql://u@db.example.com/postgres"],
  ["password placeholder", "postgresql://u:YOUR_PASSWORD@db.example.com/postgres"],
  ["missing database", "postgresql://u:secret@db.example.com/"],
  ["malformed URL", "not a connection string"],
]) {
  test(label + " is rejected without leaking credentials", () => {
    assert.throws(() => validateDatabaseUrl(input), (error) => error instanceof Error && !error.message.includes("secret") && !error.message.includes("YOUR_PASSWORD"));
  });
}
