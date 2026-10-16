import { copyFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Nitro bundles the PGlite JS into _libs; its loader resolves these runtime
// assets relative to that bundle. Include both beside it for the local built
// preview and unconfigured non-production deployments. Production uses Postgres.
const distribution = dirname(fileURLToPath(import.meta.resolve("@electric-sql/pglite")));
const destination = new URL("../.vercel/output/functions/__server.func/_libs/", import.meta.url);
await mkdir(destination, { recursive: true });
for (const asset of (await readdir(distribution)).filter((name) => /\.(data|wasm)$/.test(name))) {
  await copyFile(join(distribution, asset), new URL(asset, destination));
}
console.log("Packaged PGlite runtime assets for the built server.");
