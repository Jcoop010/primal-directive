#!/usr/bin/env node
/**
 * Deploy-time database migrator (node-postgres, `pg`).
 *
 * Runs during `npm run build` — on every Vercel deploy — applying pending files
 * in ../migrations to the same Postgres connection used by the app. Each file is
 * applied in one transaction and recorded in a `_migrations` table, so it runs
 * once and is safe to re-run.
 *
 * The read is non-recursive, so the opt-in auth schema under migrations/auth/
 * is not applied to an app that never asked for sign-in.
 *
 * Vercel integrations often expose the connection as POSTGRES_PRISMA_URL or
 * POSTGRES_URL instead of DATABASE_URL. Resolve the same aliases as src/lib/db.ts
 * and src/lib/auth/server.ts so production auth tables are actually migrated.
 * If no URL is configured, skip; the PGLite fallback migrates itself.
 */
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
import { pendingMigrations, shouldRunDeployMigrations } from "./migration-plan.mjs";

if (!shouldRunDeployMigrations()) {
  console.log("[migrate] Vercel Preview deployment — skipping shared database migrations.");
  process.exit(0);
}

const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.STORAGE_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.POSTGRES_URL ??
  process.env.database_POSTGRES_PRISMA_URL ??
  process.env.database_POSTGRES_URL_NON_POOLING ??
  process.env.database_POSTGRES_URL;

if (!databaseUrl?.trim()) {
  console.log(
    "[migrate] No Postgres URL configured — skipping (the PGLite fallback migrates itself).",
  );
  process.exit(0);
}

function postgresConnectionString(connectionString) {
  // Match the app's Postgres SSL handling. Newer pg-connection-string releases
  // interpret sslmode=require as verify-full; managed endpoints that rely on
  // libpq's historical "require" semantics otherwise fail certificate checks.
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

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

async function main() {
  let entries;
  try {
    entries = await readdir(migrationsDir);
  } catch {
    console.log("[migrate] no migrations/ directory — nothing to do.");
    return;
  }
  // An app with no schema of its own must not pay for a database connection.
  if (pendingMigrations(entries, []).length === 0) {
    console.log("[migrate] no migrations — nothing to do.");
    return;
  }

  const pool = new pg.Pool({ connectionString: postgresConnectionString(databaseUrl), max: 1 });
  const client = await pool.connect();
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    );
    // Migration history is server-only. Supabase grants public-schema access
    // to API roles by default; they must never alter which migrations run.
    await client.query("ALTER TABLE _migrations ENABLE ROW LEVEL SECURITY");
    await client.query("REVOKE ALL ON TABLE _migrations FROM PUBLIC");
    for (const role of ["anon", "authenticated"]) {
      const exists = await client.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [role]);
      if (exists.rowCount) await client.query(`REVOKE ALL ON TABLE _migrations FROM ${role}`);
    }
    const applied = (await client.query("SELECT name FROM _migrations")).rows.map(
      (r) => r.name,
    );

    let count = 0;
    for (const { name } of pendingMigrations(entries, applied)) {
      const text = await readFile(join(migrationsDir, name), "utf8");
      try {
        await client.query("BEGIN");
        // pg's simple-query protocol runs a whole multi-statement file at once.
        await client.query(text);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [name]);
        await client.query("COMMIT");
      } catch (err) {
        console.error(`[migrate] error applying ${name}`);
        try {
          await client.query("ROLLBACK");
        } catch {
          // ROLLBACK fails when the connection died — keep the original error.
        }
        throw err;
      }
      console.log(`[migrate] applied ${name}`);
      count += 1;
    }
    console.log(count ? `[migrate] done — ${count} migration(s) applied.` : "[migrate] up to date.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[migrate] failed:", err?.message || err);
  // pg errors carry the context needed to debug a bad SQL file.
  for (const key of ["code", "detail", "hint", "position", "where"]) {
    if (err?.[key] != null) console.error(`[migrate]   ${key}: ${err[key]}`);
  }
  process.exit(1);
});
