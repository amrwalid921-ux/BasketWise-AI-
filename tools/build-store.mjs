// Builds data/store.json: the supermarket layout (grid, fixtures, product slots, pickup cells,
// movement costs) + the product catalog. Both the C++ backend and the React game read this file.
//
//   node tools/build-store.mjs
//
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, PRODUCTS, TAGS } from './catalog.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const W = 42, H = 22, TILE = 36;

// cost grid: 0 = blocked, 1..9 = cost of stepping INTO the cell
const cost = Array.from({ length: H }, () => Array(W).fill(1));
const block = (x, y, w = 1, h = 1) => {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) cost[j][i] = 0;
};
const patch = (x, y, w, h, c) => {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (cost[j][i] > 0) cost[j][i] = c;
};

// outer walls
block(0, 0, W, 1); block(0, H - 1, W, 1); block(0, 0, 1, H); block(W - 1, 0, 1, H);

const byCat = {};
for (const p of PRODUCTS) (byCat[p.category] ||= []).push(p);

const fixtures = [];
const signs = [];
const deco = [];
const cursor = {};          // category -> next product index
const placements = new Map(); // product id -> placement

const catInfo = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
const nextProducts = (cat, n) => {
  const i = cursor[cat] || 0;
  cursor[cat] = i + n;
  return byCat[cat].slice(i, i + n);
};

// ---- wall counters along the back wall (y = 1..2), products on y=2, pickup from y=3
let wx = 1;
const wallPlan = [['bakery', 8], ['dairy', 10], ['meat', 5], ['frozen', 5], ['drinks', 8]];
for (const [cat, n] of wallPlan) {
  const id = `wall-${cat}`;
  fixtures.push({ id, kind: 'wall', category: cat, x: wx, y: 1, w: n, h: 2 });
  signs.push({ fixture: id, category: cat, x: wx, y: 0, w: n, en: catInfo[cat].en, ar: catInfo[cat].ar, color: catInfo[cat].color });
  block(wx, 1, n, 2);
  nextProducts(cat, 0);
  byCat[cat].slice(0, n).forEach((p, i) => {
    placements.set(p.id, { fixture: id, side: 'wall', slot: i, shelf: { x: wx + i, y: 2 }, pickup: { x: wx + i, y: 3 }, facing: 'up' });
  });
  cursor[cat] = n;
  wx += n + 1;
}

// ---- gondolas / islands. y = top row of the 2-tile-thick unit.
function unit(id, kind, x, y, w, topList, botList, signCat, signText) {
  fixtures.push({ id, kind, x, y, w, h: 2, topCount: topList.length, botCount: botList.length, category: signCat });
  block(x, y, w, 2);
  topList.forEach((p, i) => placements.set(p.id, { fixture: id, side: 'top', slot: i, shelf: { x: x + i, y }, pickup: { x: x + i, y: y - 1 }, facing: 'down' }));
  botList.forEach((p, i) => placements.set(p.id, { fixture: id, side: 'bottom', slot: i, shelf: { x: x + i, y: y + 1 }, pickup: { x: x + i, y: y + 2 }, facing: 'up' }));
  const info = catInfo[signCat];
  signs.push({ fixture: id, category: signCat, x, y: y - 1, w, en: signText?.en || info.en, ar: signText?.ar || info.ar, color: info.color, hanging: true });
}

const groc = byCat.grocery, snk = byCat.snacks, hh = byCat.household, prod = byCat.produce;
unit('gondola-grocery-1', 'gondola', 4, 5, 6, groc.slice(0, 6), groc.slice(6, 12), 'grocery');
unit('gondola-grocery-2', 'gondola', 14, 5, 5, groc.slice(12, 17), groc.slice(17, 22), 'grocery');
unit('gondola-snacks',    'gondola', 23, 5, 5, snk.slice(0, 5), snk.slice(5, 10), 'snacks');
unit('gondola-household', 'gondola', 32, 5, 4, hh.slice(0, 4), hh.slice(4, 8), 'household');
unit('island-produce',    'island',  17, 9, 4, prod.slice(0, 4), prod.slice(4, 8), 'produce');

// ---- decoration (all blocked cells unless noted)
const addDeco = (type, x, y, w = 1, h = 1, blocked = true, extra = {}) => {
  deco.push({ type, x, y, w, h, ...extra });
  if (blocked) block(x, y, w, h);
};
addDeco('pallet-water', 5, 9, 4, 2);
addDeco('promo-stand', 29, 9, 4, 2);
addDeco('pillar', 12, 13);
addDeco('pillar', 29, 13);
addDeco('plant', 1, 12);
addDeco('plant', 40, 12);
addDeco('plant', 10, 20);
addDeco('cart-park', 6, 19, 3, 2);
addDeco('basket-stack', 9, 20);
addDeco('promo-stand', 12, 16, 4, 2);   // seasonal promo display in the open hall
addDeco('pallet-water', 19, 17, 4, 2);  // water pallet near the checkouts
addDeco('plant', 26, 11);
// checkout lanes: conveyors at x=30..35, kiosk at x=36
for (const ly of [15, 18]) {
  addDeco('checkout-lane', 30, ly, 6, 1);
  addDeco('cashier-kiosk', 36, ly, 1, 1);
}
// entrance (door is drawn in the bottom wall)
deco.push({ type: 'entrance-door', x: 2, y: 21, w: 3, h: 1 });
deco.push({ type: 'doormat', x: 2, y: 19, w: 3, h: 2 });

// ---- movement-cost patches (so Dijkstra / A* differ from BFS)
patch(10, 7, 4, 2, 6);                    // wet floor in the cross aisle
deco.push({ type: 'wet-floor', x: 10, y: 7, w: 4, h: 2 });
patch(1, 17, 5, 4, 2);                    // busy entrance
patch(27, 14, 3, 6, 3);                   // checkout queue
deco.push({ type: 'queue-zone', x: 27, y: 14, w: 3, h: 6 });
patch(17, 11, 4, 1, 3);                   // shoppers crowd the produce island
deco.push({ type: 'crowd-zone', x: 17, y: 11, w: 4, h: 1 });

const entrance = { x: 3, y: 20 };
const checkout = { x: 30, y: 16 };

// ---- validation: every pickup reachable (BFS), no pickup on a blocked cell
const reach = new Set();
{
  const q = [[entrance.x, entrance.y]];
  reach.add(entrance.y * W + entrance.x);
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || cost[ny][nx] === 0 || reach.has(ny * W + nx)) continue;
      reach.add(ny * W + nx);
      q.push([nx, ny]);
    }
  }
}
const problems = [];
for (const p of PRODUCTS) {
  const pl = placements.get(p.id);
  if (!pl) { problems.push(`no placement for ${p.slug}`); continue; }
  if (cost[pl.pickup.y][pl.pickup.x] === 0) problems.push(`pickup blocked for ${p.slug}`);
  else if (!reach.has(pl.pickup.y * W + pl.pickup.x)) problems.push(`pickup unreachable for ${p.slug}`);
}
if (!reach.has(checkout.y * W + checkout.x)) problems.push('checkout unreachable');
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }

const store = {
  name: 'BasketWise Market',
  currency: 'EGP',
  grid: { w: W, h: H, tile: TILE, cost: cost.map((r) => r.join('')) },
  entrance,
  checkout,
  categories: CATEGORIES,
  tags: TAGS,
  fixtures,
  signs,
  deco,
  products: PRODUCTS.map((p) => ({ ...p, ...placements.get(p.id) })),
};

const outDir = path.join(here, '..', 'data');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'store.json'), JSON.stringify(store, null, 1));
fs.writeFileSync(path.join(outDir, 'store.min.json'), JSON.stringify(store));
console.log(`store.json: ${PRODUCTS.length} products, grid ${W}x${H}, ${fixtures.length} fixtures`);
