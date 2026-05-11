#!/usr/bin/env node
// One-command demo: starts mocks (:5173, :5001), bridge (:4000), UI (:3333).
// Ctrl-C tears them all down. Cross-platform, zero new deps.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const procs = [];

function run(name, color, cwd, cmd, args) {
  const p = spawn(cmd, args, { cwd: join(ROOT, cwd), shell: process.platform === 'win32' });
  const tag = `\x1b[${color}m[${name}]\x1b[0m`;
  p.stdout.on('data', (d) => process.stdout.write(d.toString().split('\n').filter(Boolean).map((l) => `${tag} ${l}\n`).join('')));
  p.stderr.on('data', (d) => process.stderr.write(d.toString().split('\n').filter(Boolean).map((l) => `${tag} ${l}\n`).join('')));
  p.on('exit', (code) => { if (code !== 0 && code !== null) console.error(`${tag} exited ${code}`); });
  procs.push(p);
  return p;
}

function serveUI(port) {
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.svg': 'image/svg+xml' };
  const server = createServer(async (req, res) => {
    const path = req.url === '/' ? '/index.html' : req.url;
    try {
      const buf = await readFile(join(ROOT, 'ui', path));
      res.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
      res.end(buf);
    } catch { res.statusCode = 404; res.end('not found'); }
  });
  server.listen(port, () => console.log(`\x1b[36m[ui]\x1b[0m static server on :${port}`));
  return server;
}

function shutdown() {
  console.log('\n[quickstart] shutting down...');
  for (const p of procs) try { p.kill(); } catch {}
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Sanity checks
if (!existsSync(join(ROOT, 'bridge', 'node_modules'))) {
  console.error('bridge/node_modules missing. Run: npm install --prefix bridge');
  process.exit(1);
}
if (!existsSync(join(ROOT, 'test', 'node_modules'))) {
  console.error('test/node_modules missing. Run: npm install --prefix test');
  process.exit(1);
}

console.log('[quickstart] starting mocks + bridge + UI (Ctrl-C to stop)\n');
run('mocks', '33', '.', 'node', ['test/mock-services.js']);
run('bridge', '32', 'bridge', 'npm', ['start']);
serveUI(3333);
setTimeout(() => {
  console.log('\n\x1b[1m[quickstart] ready:\x1b[0m');
  console.log('  UI:     http://localhost:3333');
  console.log('  bridge: http://localhost:4000');
  console.log('  mocks:  http://localhost:5173 (WM), http://localhost:5001 (MF)');
  console.log('  watch:  bridge/data/watchlist.json\n');
}, 2000);
