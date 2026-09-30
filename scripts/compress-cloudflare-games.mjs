import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIMIT = 25 * 1024 * 1024;
const CHUNK_SIZE = 20 * 1024 * 1024;

export function splitCloudflareGameWasm(gamesRoot) {
  const wasmPath = join(gamesRoot, 'mole-game', 'index.wasm');
  if (!existsSync(wasmPath) || statSync(wasmPath).size <= LIMIT) return false;

  const wasm = readFileSync(wasmPath);
  const partCount = Math.ceil(wasm.length / CHUNK_SIZE);
  for (let part = 0; part < partCount; part += 1) {
    writeFileSync(`${wasmPath}.part${part}`, wasm.subarray(part * CHUNK_SIZE, (part + 1) * CHUNK_SIZE));
  }
  const restored = Buffer.concat(Array.from({ length: partCount }, (_, part) => readFileSync(`${wasmPath}.part${part}`)));
  if (!restored.equals(wasm)) throw new Error('Godot WASM split failed its integrity check.');

  const loaderPath = join(dirname(wasmPath), `${basename(wasmPath, '.wasm')}.js`);
  const source = readFileSync(loaderPath, 'utf8');
  const fetchStatement = 'return fetch(file).then(function (response) {';
  const chunkFetches = Array.from({ length: partCount }, (_, part) => `fetch(\`${'${file}'}.part${part}\`)`).join(', ');
  const replacement = `const responsePromise = file.endsWith('index.wasm')
\t\t\t? Promise.all([${chunkFetches}]).then(async function (responses) {
\t\t\t\tfor (const response of responses) {
\t\t\t\t\tif (!response.ok) throw new Error(\`Failed loading WASM chunk '\${response.url}'\`);
\t\t\t\t}
\t\t\t\tconst chunks = await Promise.all(responses.map(function (response) { return response.arrayBuffer(); }));
\t\t\t\treturn new Response(new Blob(chunks, { type: 'application/wasm' }), { headers: { 'Content-Type': 'application/wasm' } });
\t\t\t})
\t\t\t: fetch(file);
\t\treturn responsePromise.then(function (response) {`;
  if (!source.includes(fetchStatement)) throw new Error(`Unable to patch Godot loader: ${loaderPath}`);
  writeFileSync(loaderPath, source.replace(fetchStatement, replacement));
  rmSync(wasmPath);
  return true;
}

const directRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (directRun) {
  const host = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const gamesRoot = resolve(host, process.argv[2] || 'dist/games');
  console.log(splitCloudflareGameWasm(gamesRoot) ? 'Split oversized Godot WASM into Cloudflare-safe chunks.' : 'No oversized Godot WASM found.');
}
