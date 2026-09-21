import { createRequire } from 'node:module';
import { readFileSync as readResource } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';

const host = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const packageRoot = dirname(require.resolve('@mrburdeveloperteam/pet-function/package.json'));
const packagePublic = join(packageRoot, 'public');
if (!existsSync(packagePublic)) throw new Error('Installed pet-function package has no public resources: ' + packageRoot);

rmSync(join(host, 'public', 'pets'), { recursive: true, force: true });
rmSync(join(host, 'public', 'molar-experience'), { recursive: true, force: true });
rmSync(join(host, 'public', 'images', 'cat-meow.mp3'), { force: true });
for (const name of ['cat.gif', 'catwalk.gif', 'MolarAI.png']) {
  rmSync(join(host, 'public', 'images', name), { force: true });
}

function copyResources(relative = '') {
  for (const entry of readdirSync(join(packagePublic, relative), { withFileTypes: true })) {
    const name = join(relative, entry.name);
    const parts = name.split(/[\\/]/);
    if (parts[0] === 'games' || parts[0] === 'pets') continue;
    if (entry.isDirectory()) copyResources(name);
    else {
      const target = join(host, 'public', name);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(packagePublic, name), target);
      if (!readResource(join(packagePublic, name)).equals(readResource(target))) throw new Error('Shared resource copy mismatch: ' + target);
    }
  }
}
copyResources();

for (const required of [
  'pet-function/pet/grey_bed.png',
  'pet-function/pet/red_bed.png',
  'pet-function/pet/purple_bed.png',
  'pet-function/pets/mallow-spritesheet.webp',
]) {
  if (!existsSync(join(host, 'public', required))) {
    throw new Error('Missing prepared pet-function resource: public/' + required);
  }
}
console.log('Pet resources prepared from:', packageRoot);
