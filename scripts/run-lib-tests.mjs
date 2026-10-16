import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('../src/lib/', import.meta.url));
const files = readdirSync(root, { recursive: true }).filter(name => String(name).endsWith('.test.ts')).map(name => join(root, String(name)));
const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', ...files], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
