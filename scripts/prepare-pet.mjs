import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rmSync } from 'node:fs';

const host = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const packageRoot = dirname(require.resolve('@mrburdeveloperteam/pet-function/package.json'));
const result = spawnSync(process.execPath, [join(packageRoot, 'scripts', 'prepare-host.mjs'), host], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);

rmSync(join(host, 'public', 'pets'), { recursive: true, force: true });
rmSync(join(host, 'public', 'molar-experience'), { recursive: true, force: true });
rmSync(join(host, 'public', 'images', 'cat-meow.mp3'), { force: true });
for (const name of ['cat.gif', 'catwalk.gif', 'MolarAI.png']) {
  rmSync(join(host, 'public', 'images', name), { force: true });
}
