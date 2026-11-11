// Copies assets/ (SVG art + manifest) into frontend/public/assets so Vite can serve them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'assets');
const dst = path.join(root, 'frontend', 'public', 'assets');
fs.rmSync(dst, { recursive: true, force: true });
fs.mkdirSync(dst, { recursive: true });
const SKIP = new Set(['scenes', 'people', 'models', 'textures/wall.jpg', 'textures/shelf.jpg', 'textures/ceiling.jpg']);
let n = 0;
(function copy(a, b) {
  for (const e of fs.readdirSync(a, { withFileTypes: true })) {
    if (e.name.startsWith('_')) continue; // skip _review
    if (SKIP.has(path.relative(src, path.join(a, e.name)))) continue; // unused by the 2D game
    const pa = path.join(a, e.name), pb = path.join(b, e.name);
    if (e.isDirectory()) { fs.mkdirSync(pb, { recursive: true }); copy(pa, pb); }
    else {
      try {
        fs.copyFileSync(pa, pb);
      } catch (error) {
        // WSL can reject the native copy-file operation on Windows-mounted drives.
        if (error.code !== 'EPERM' && error.code !== 'EXDEV') throw error;
        fs.writeFileSync(pb, fs.readFileSync(pa));
      }
      n++;
    }
  }
})(src, dst);
console.log(`[sync-assets] copied ${n} files -> frontend/public/assets`);
