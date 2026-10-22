import { spawnSync } from "node:child_process";
// Preview/local builds never migrate a production-connected database implicitly.
if (process.env.VERCEL_ENV === "production") {
  if (
    ![
      "DATABASE_URL",
      "STORAGE_URL",
      "POSTGRES_PRISMA_URL",
      "POSTGRES_URL_NON_POOLING",
      "POSTGRES_URL",
      "database_POSTGRES_PRISMA_URL",
      "database_POSTGRES_URL_NON_POOLING",
      "database_POSTGRES_URL",
    ].some((k) => process.env[k]?.trim())
  )
    throw new Error("Production migration requires persistent Postgres");
  const result = spawnSync(process.execPath, ["scripts/migrate.mjs"], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
