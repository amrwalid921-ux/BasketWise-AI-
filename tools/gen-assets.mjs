#!/usr/bin/env node
// BasketWise AI art department: generates all SVG assets, manifest and review sheets.
//   node tools/gen-assets.mjs            -> assets + manifest + review sheets
//   node tools/gen-assets.mjs --no-review
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { Doc } from './svgkit.mjs';
import { PRODUCTS } from './catalog.mjs';
import { A } from './icons/products-a.mjs';
import { B } from './icons/products-b.mjs';
import { C } from './icons/products-c.mjs';
import { PROPS } from './icons/props.mjs';
import { drawShopper } from './icons/shopper.mjs';
import { review, sceneTest } from './icons/review.mjs';
import { scene } from './icons/scene.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = p => path.join(root, 'assets', p);
for (const d of ['products', 'props', 'shopper', '_review']) fs.mkdirSync(out(d), { recursive: true });
const DRAW = { ...A, ...B, ...C };
const slugs = PRODUCTS.map(p => p.slug);
const missing = slugs.filter(s => !DRAW[s]); if (missing.length) { console.error('missing icons:', missing.join(', ')); process.exit(1); }
const extra = Object.keys(DRAW).filter(s => !slugs.includes(s)); if (extra.length) console.warn('unused icons:', extra.join(', '));
const sizes = [];
for (const s of slugs) {
  const d = new Doc(128, 128); DRAW[s](d); const svg = d.svg();
  fs.writeFileSync(out(`products/${s}.svg`), svg); sizes.push([s, svg.length]);
}
const props = {};
for (const [n, p] of Object.entries(PROPS)) { const d = p.draw(); fs.writeFileSync(out(`props/${n}.svg`), d.svg()); props[n] = { w: p.w, h: p.h }; sizes.push(['prop:' + n, d.svg().length]); }
const dirs = ['down', 'up', 'left', 'right']; const meta = { size: 144, pivot: [72, 72], dirs: {} };
for (const dir of dirs) for (let fr = 0; fr < 4; fr++) {
  const { doc, basket } = drawShopper(dir, fr); const svg = doc.svg(); fs.writeFileSync(out(`shopper/walk-${dir}-${fr}.svg`), svg); sizes.push([`shopper:${dir}-${fr}`, svg.length]);
  if (fr === 0) { const [x, y, w, h] = basket; meta.dirs[dir] = { basket: { x: Math.round(x + 1), y: Math.round(y + 1), w: Math.round(w - 2), h: Math.round(h - 2) } }; }
}
fs.writeFileSync(out('shopper/meta.json'), JSON.stringify(meta));
fs.writeFileSync(out('manifest.json'), JSON.stringify({ products: slugs, props, shopper: { size: 144, dirs, frames: 4 } }, null, 1));
const big = sizes.filter(([n, l]) => (n.startsWith('shopper') ? l > 60000 : !n.startsWith('prop') && l > 40000));
console.log(`products ${slugs.length}, props ${Object.keys(props).length}, shopper ${dirs.length * 4}; largest ${Math.max(...sizes.map(s => s[1]))} bytes`); if (big.length) console.warn('TOO BIG:', big);
console.log(JSON.stringify(meta.dirs));
if (!process.argv.includes('--no-review')) {
  const errs = await review(root, { products: slugs, props, shopper: {} });
  await sceneTest(root, scene(root));
  fs.rmSync(out('_review/_tmp.html'), { force: true });
  console.log(errs.length ? 'REVIEW ERRORS:\n' + errs.join('\n') : 'review sheets OK (no load errors)');
}
