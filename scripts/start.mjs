// One command to run everything:  npm start   (or: node scripts/start.mjs)
//  1. builds the C++ backend (make) if needed
//  2. regenerates data/store.json + SVG assets if missing
//  3. installs frontend deps if missing
//  4. starts the C++ API server (port 8080) and the Vite dev server (port 5173)
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: root, shell: process.platform === 'win32', ...opts });
  if (r.status !== 0) { console.error(`\n✖ failed: ${cmd} ${args.join(' ')}`); process.exit(r.status || 1); }
};
const step = (m) => console.log(`\n\x1b[33m▶ ${m}\x1b[0m`);

if (!fs.existsSync(path.join(root, 'data', 'store.json'))) { step('Building store data'); run('node', ['tools/build-store.mjs']); }
if (!fs.existsSync(path.join(root, 'assets', 'manifest.json'))) { step('Generating SVG art'); run('node', ['tools/gen-assets.mjs']); }
step('Building C++ backend'); run('make', ['-C', 'backend', 'all']);
if (!fs.existsSync(path.join(root, 'frontend', 'node_modules', 'three')) || !fs.existsSync(path.join(root, 'frontend', 'node_modules', 'react'))) { step('Installing frontend dependencies'); run('npm', ['install', '--no-audit', '--no-fund'], { cwd: path.join(root, 'frontend') }); }

const port = process.env.API_PORT || '8080';
const bin = path.join(root, 'backend', 'build', process.platform === 'win32' ? 'basketwise-server.exe' : 'basketwise-server');
step(`Starting API server on :${port}`);
const server = spawn(bin, ['--port', port, '--data', path.join(root, 'data', 'store.json')], { stdio: 'inherit', cwd: path.join(root, 'backend') });
step('Starting web app on :5173');
const web = spawn('npm', ['run', 'dev'], { stdio: 'inherit', cwd: path.join(root, 'frontend'), shell: process.platform === 'win32', env: { ...process.env, BASKETWISE_API: `http://127.0.0.1:${port}` } });

console.log('\n\x1b[32m✔ BasketWise AI → http://localhost:5173\x1b[0m\n');
const stop = () => { server.kill(); web.kill(); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
server.on('exit', (c) => { console.error(`API server exited (${c})`); web.kill(); process.exit(c || 1); });
web.on('exit', () => { server.kill(); process.exit(0); });
