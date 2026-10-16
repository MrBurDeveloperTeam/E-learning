import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { collectCloudflareChunkCounts, patchGodotLoader } from './compress-cloudflare-games.mjs';

const host = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const packageRoot = dirname(require.resolve('@mrburdeveloperteam/pet-function/package.json'));
const installed = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
const declared = JSON.parse(readFileSync(join(host, 'package.json'), 'utf8')).dependencies[installed.name];
assert.equal(declared, `github:mrburdeveloperteam/pet-function#v${installed.version}`);
const manifest = JSON.parse(readFileSync(join(packageRoot, 'resource-manifest.json'), 'utf8'));
assert.equal(manifest.version, installed.version);
const publicRoot = await (await import(pathToFileURL(join(packageRoot, 'scripts/sync-resource-packs.mjs')).href)).ensurePublicResources(packageRoot);
const gamesRoot = join(publicRoot, 'games');
const output = join(host, 'dist/games');
assert.ok(existsSync(output), 'Build E-learning before verifying game resources.');
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
const files = walk(gamesRoot);
const expected = new Set();
const chunkCounts = {};
for (const file of files) {
  const name = relative(gamesRoot, file).split('\\').join('/');
  const target = join(output, name);
  if (/\.(wasm|pck)$/.test(file) && !existsSync(target)) {
    const parts = [];
    for (let index = 0; existsSync(`${target}.part${index}`); index++) {
      parts.push(readFileSync(`${target}.part${index}`));
      expected.add(`${name}.part${index}`);
    }
    assert.ok(parts.length, `Missing game chunks: ${name}`);
    assert.ok(Buffer.concat(parts).equals(readFileSync(file)), `Game chunk content differs: ${name}`);
    chunkCounts[`/games/${name}`] = {
      count: parts.length, size: statSync(file).size,
      mime: file.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream',
    };
  } else expected.add(name);
}
const loaderCounts = collectCloudflareChunkCounts(output);
assert.deepEqual(loaderCounts, chunkCounts);
for (const file of files) {
  const name = relative(gamesRoot, file).split('\\').join('/');
  const target = join(output, name);
  if (!expected.has(name)) continue; // Reconstructed and checked above.
  if (file.endsWith('.js') && Object.keys(chunkCounts).length) {
    const original = readFileSync(file, 'utf8');
    assert.equal(readFileSync(target, 'utf8'), patchGodotLoader(original, loaderCounts), `Unexpected loader changes: ${name}`);
    continue;
  }
  assert.ok(readFileSync(target).equals(readFileSync(file)), `Game resource differs: ${name}`);
}
assert.deepEqual(new Set(walk(output).map(file => relative(output, file).split('\\').join('/'))), expected);
for (const file of walk(join(host, 'dist'))) {
  assert.ok(statSync(file).size <= 25 * 1024 * 1024, `Cloudflare asset exceeds 25 MiB: ${file}`);
}
const gameCount = readdirSync(gamesRoot, { withFileTypes: true }).filter(entry => entry.isDirectory()).length;
console.log(`Verified pet-function ${installed.version}: ${files.length} game files across ${gameCount} games; WASM/PCK reconstruction and 25 MiB asset limits passed.`);
