import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const testFiles = readdirSync(root)
  .filter((name) => name.endsWith(".test.mjs"))
  .filter((name) => name !== "grok-pwa-plugin.test.mjs")
  .map((name) => join(root, name));

const result = spawnSync(process.execPath, ["--test", ...testFiles], {
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
