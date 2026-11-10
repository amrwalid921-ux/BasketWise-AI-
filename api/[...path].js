// Vercel Function: starts the C++ BasketWise backend (static binary) and proxies /api/* to it.
import { spawn } from 'node:child_process';
import { copyFileSync, chmodSync } from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const PORT = 9123;
const bin = fileURLToPath(new URL('./bin/basketwise-server', import.meta.url));
const data = fileURLToPath(new URL('../data/store.json', import.meta.url));
let ready = null;

function ping() {
  return new Promise((resolve) => {
    const r = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health', timeout: 500 }, (res) => { res.resume(); resolve(res.statusCode === 200); });
    r.on('error', () => resolve(false));
    r.on('timeout', () => { r.destroy(); resolve(false); });
  });
}

function start() {
  if (!ready) {
    ready = (async () => {
      copyFileSync(bin, '/tmp/basketwise-server');
      chmodSync('/tmp/basketwise-server', 0o755);
      const child = spawn('/tmp/basketwise-server', ['--port', String(PORT), '--data', data], { cwd: '/tmp', stdio: 'inherit' });
      child.on('exit', () => { ready = null; });
      for (let i = 0; i < 60; i++) { if (await ping()) return; await new Promise((r) => setTimeout(r, 100)); }
      ready = null;
      throw new Error('backend did not start');
    })();
  }
  return ready;
}

export default async function handler(req, res) {
  try {
    if (!(await ping())) { ready = null; await start(); }
  } catch (e) { res.statusCode = 502; res.end('backend start failed: ' + e.message); return; }
  const headers = { ...req.headers, host: '127.0.0.1:' + PORT };
  const up = http.request({ host: '127.0.0.1', port: PORT, method: req.method, path: req.url, headers }, (r) => {
    res.writeHead(r.statusCode || 502, r.headers);
    r.pipe(res);
  });
  up.on('error', (e) => { res.statusCode = 502; res.end('proxy error: ' + e.message); });
  req.pipe(up);
}
