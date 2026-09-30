import { createReadStream, existsSync, statSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { extname, join, relative, resolve } from 'node:path';

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.wav': 'audio/wav',
  '.webp': 'image/webp',
};

export function localPetPlugin(petRoot) {
  const sourceRoot = join(petRoot, 'src');
  const publicRoot = join(petRoot, 'public');
  const distRoot = join(petRoot, 'dist');
  let server;
  let buildRunning = false;
  let rebuildQueued = false;
  let debounceTimer;

  function runBuild() {
    if (buildRunning) {
      rebuildQueued = true;
      return;
    }

    buildRunning = true;
    const npmCli = process.env.npm_execpath;
    const command = npmCli ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
    const args = npmCli ? [npmCli, 'run', 'build'] : ['run', 'build'];
    const child = spawn(command, args, {
      cwd: petRoot,
      env: process.env,
      shell: false,
      stdio: 'inherit',
    });

    child.on('error', (error) => {
      buildRunning = false;
      console.error('[local-pet] Build could not start:', error);
    });
    child.on('exit', (code) => {
      buildRunning = false;
      if (code === 0) {
        // tsup cleans dist before writing the rebuilt files. If Vite receives
        // a browser request during that short gap, it can cache an empty
        // transformed module for the local package. Invalidate every local
        // dist module before reloading so imports are read again from disk.
        for (const moduleNode of server?.moduleGraph?.idToModuleMap?.values?.() || []) {
          if (moduleNode.file && resolve(moduleNode.file).startsWith(resolve(distRoot))) {
            server.moduleGraph.invalidateModule(moduleNode);
          }
        }
        console.log('[local-pet] Local pet-function rebuilt; refreshing preview.');
        server?.ws.send({ type: 'full-reload' });
      } else {
        console.error(`[local-pet] Build failed with exit code ${code}.`);
      }
      if (rebuildQueued) {
        rebuildQueued = false;
        runBuild();
      }
    });
  }

  function scheduleBuild() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runBuild, 150);
  }

  return {
    name: 'local-pet-function-preview',
    configureServer(viteServer) {
      server = viteServer;
      server.watcher.add([sourceRoot, publicRoot]);
      server.watcher.on('change', (changedPath) => {
        const absolutePath = resolve(changedPath);
        if (absolutePath.startsWith(resolve(sourceRoot))) scheduleBuild();
        else if (absolutePath.startsWith(resolve(publicRoot))) server.ws.send({ type: 'full-reload' });
      });

      server.middlewares.use((request, response, next) => {
        let pathname;
        try {
          pathname = decodeURIComponent((request.url || '').split('?')[0]);
        } catch {
          response.statusCode = 400;
          response.end();
          return;
        }

        if (!pathname.startsWith('/pet-function/') && !pathname.startsWith('/games/')) return next();
        const target = resolve(publicRoot, pathname.slice(1));
        const relativeTarget = relative(publicRoot, target);
        if (relativeTarget.startsWith('..') || !existsSync(target) || !statSync(target).isFile()) return next();

        response.setHeader('Content-Type', mimeTypes[extname(target)] || 'application/octet-stream');
        response.setHeader('Cache-Control', 'no-store');
        createReadStream(target).pipe(response);
      });
    },
  };
}
