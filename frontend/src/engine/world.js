// Draws the STATIC part of the supermarket (floor, walls, fixtures, trays, price tags, signs, props)
// once into an off-screen canvas. Product icons, highlights, the shopper etc. are drawn per frame on top.
import { T } from './constants.js';

export const RS = 1.5; // render scale of the static layer (crisper when the camera zooms in)

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function vgrad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}
function hgrad(ctx, x0, x1, stops) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}
function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const FONT = '"Cairo","Segoe UI",Tahoma,"DejaVu Sans",Arial,sans-serif';

// -------------------------------------------------------------------------------- floor
function drawFloor(ctx, store, assets) {
  const { w, h } = store.grid;
  const rnd = mulberry(7);
  const costRows = store.grid.cost;
  const zone = (x, y) => {
    if (x >= 27 && x <= 37 && y >= 14 && y <= 20) return 'checkout';
    if (x >= 1 && x <= 5 && y >= 17 && y <= 20) return 'entrance';
    return 'main';
  };
  if (assets && assets.floor) {
    // real porcelain photo, tiled; zones get a light tint on top
    const span = 6 * T;
    for (let y = 0; y < h * T; y += span) for (let x = 0; x < w * T; x += span) ctx.drawImage(assets.floor, x, y, span, span);
    ctx.fillStyle = 'rgba(40,90,200,.07)'; ctx.fillRect(0, 0, w * T, h * T);
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(0, 0, w * T, h * T);
    for (let ty = 0; ty < h; ty += 2) for (let tx = 0; tx < w; tx += 2) {
      const z = zone(tx, ty);
      if (z === 'checkout') { ctx.fillStyle = 'rgba(120,220,200,.22)'; ctx.fillRect(tx * T, ty * T, 2 * T, 2 * T); }
      else if (z === 'entrance') { ctx.fillStyle = 'rgba(23,72,200,.28)'; ctx.fillRect(tx * T, ty * T, 2 * T, 2 * T); }
    }
  }
  // 2x2-cell porcelain tiles (procedural fallback)
  if (!(assets && assets.floor))
  for (let ty = 0; ty < h; ty += 2) {
    for (let tx = 0; tx < w; tx += 2) {
      const z = zone(tx, ty);
      const alt = ((tx + ty) / 2) % 2 === 0;
      let c0, c1;
      if (z === 'checkout') { c0 = alt ? '#DFF7F1' : '#CFF0E8'; c1 = alt ? '#CFF0E8' : '#DFF7F1'; }
      else if (z === 'entrance') { c0 = alt ? '#BFD4FF' : '#A9C4FF'; c1 = alt ? '#A9C4FF' : '#BFD4FF'; }
      else { c0 = alt ? '#E9EDF2' : '#DEE4EB'; c1 = alt ? '#DEE4EB' : '#D2DAE3'; }
      const g = ctx.createLinearGradient(tx * T, ty * T, (tx + 2) * T, (ty + 2) * T);
      g.addColorStop(0, c0); g.addColorStop(1, c1);
      ctx.fillStyle = g;
      ctx.fillRect(tx * T, ty * T, 2 * T, 2 * T);
      // grout
      ctx.strokeStyle = 'rgba(17,17,17,.12)';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(tx * T + 0.8, ty * T + 0.8, 2 * T - 1.6, 2 * T - 1.6);
      // faint speckle
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = 'rgba(17,17,17,0)';
        ctx.fillRect(tx * T + rnd() * 2 * T, ty * T + rnd() * 2 * T, 2 + rnd() * 5, 1 + rnd() * 2);
      }
    }
  }
  // soft glossy streaks (lighting from the top-left)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = -6; i < 14; i++) {
    const x0 = i * 190;
    const g = ctx.createLinearGradient(x0, 0, x0 + 140, 140);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,250,235,0)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, 0); ctx.lineTo(x0 + 120, 0); ctx.lineTo(x0 + 120 + h * T, h * T); ctx.lineTo(x0 + h * T, h * T);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  // slow / costly zones get a visual hint
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = costRows[y].charCodeAt(x) - 48;
      if (c === 6) { // wet floor
        ctx.fillStyle = 'rgba(110,170,225,.28)';
        ctx.fillRect(x * T, y * T, T, T);
      }
    }
  }
}

// -------------------------------------------------------------------------------- walls
function drawWalls(ctx, store) {
  const { w, h } = store.grid;
  // top wall
  ctx.fillStyle = vgrad(ctx, 0, T, [[0, '#16254A'], [1, '#16254A']]);
  ctx.fillRect(0, 0, w * T, T);
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, T - 5, w * T, 5);
  ctx.fillStyle = '#16254A';
  ctx.fillRect(0, T - 5, w * T, 1.5);
  // side walls
  for (const sx of [0, w - 1]) {
    ctx.fillStyle = hgrad(ctx, sx * T, (sx + 1) * T, sx === 0 ? [[0, '#16254A'], [1, '#16254A']] : [[0, '#16254A'], [1, '#16254A']]);
    ctx.fillRect(sx * T, 0, T, h * T);
    ctx.fillStyle = 'rgba(17,17,17,.12)';
    for (let y = 0; y < h * 2; y++) ctx.fillRect(sx * T, y * (T / 2), T, 1);
    ctx.fillStyle = sx === 0 ? '#111111' : '#111111';
    ctx.fillRect(sx === 0 ? T - 4 : sx * T, 0, 4, h * T);
  }
  // bottom wall = storefront glass
  const by = (h - 1) * T;
  ctx.fillStyle = vgrad(ctx, by, by + T, [[0, '#16254A'], [1, '#16254A']]);
  ctx.fillRect(0, by, w * T, T);
  for (let x = 1; x < w - 1; x++) {
    if (x >= 2 && x <= 4) continue; // entrance
    const gx = x * T + 3;
    const g = ctx.createLinearGradient(gx, by, gx + T - 6, by + T);
    g.addColorStop(0, '#d8eef9'); g.addColorStop(0.5, '#a9d3ec'); g.addColorStop(1, '#8dbddd');
    ctx.fillStyle = g;
    rr(ctx, gx, by + 7, T - 6, T - 14, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.beginPath(); ctx.moveTo(gx + 6, by + 8); ctx.lineTo(gx + 20, by + 8); ctx.lineTo(gx + 8, by + T - 8); ctx.lineTo(gx - 2, by + T - 8); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#16254A';
  ctx.fillRect(0, by, w * T, 6);
}

// -------------------------------------------------------------------------------- fixtures
const WALL_PAL = {
  bakery: { body: ['#c9d0d8', '#aab3bd'], rim: '#111111', tray: '#e9bd78', back: '#d4a05a', lip: '#1748C8', accent: '#9db8ff', glass: false },
  dairy: { body: ['#c9d0d8', '#aab3bd'], rim: '#111111', tray: '#e3f1fb', back: '#cfe4f4', lip: '#1748C8', accent: '#9db8ff', glass: true },
  meat: { body: ['#c9d0d8', '#aab3bd'], rim: '#111111', tray: '#fbf4f2', back: '#f0e2df', lip: '#1748C8', accent: '#9db8ff', glass: true },
  frozen: { body: ['#c9d0d8', '#aab3bd'], rim: '#111111', tray: '#eefbff', back: '#d6f1f9', lip: '#1748C8', accent: '#9db8ff', glass: true },
  drinks: { body: ['#c9d0d8', '#aab3bd'], rim: '#111111', tray: '#e3f6f3', back: '#c4ebe6', lip: '#1748C8', accent: '#9db8ff', glass: true },
};

function softShadow(ctx, x, y, w, h, r = 8) {
  ctx.save();
  ctx.shadowColor = 'rgba(44,30,18,.38)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetX = 5;
  ctx.shadowOffsetY = 9;
  ctx.fillStyle = '#7d756c';
  rr(ctx, x + 2, y + 2, w - 4, h - 4, r); ctx.fill();
  ctx.restore();
}

function priceChip(ctx, cx, cy, price, color = '#2e2a26', bg = '#fffdf6') {
  const txt = String(price);
  ctx.font = `800 10px ${FONT}`;
  const tw = ctx.measureText(txt).width + 8;
  ctx.fillStyle = bg;
  rr(ctx, cx - tw / 2, cy - 5.5, tw, 11, 3); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(txt, cx, cy + 0.5);
}

function drawWallUnit(ctx, fx, store, prodAt) {
  const pal = WALL_PAL[fx.category];
  const px = fx.x * T, py = fx.y * T, w = fx.w * T, h = 2 * T;
  softShadow(ctx, px, py, w, h, 7);
  // body
  ctx.fillStyle = vgrad(ctx, py, py + h, [[0, pal.body[0]], [1, pal.body[1]]]);
  rr(ctx, px, py, w, h, 7); ctx.fill();
  ctx.strokeStyle = pal.rim; ctx.lineWidth = 2; rr(ctx, px + 1, py + 1, w - 2, h - 2, 7); ctx.stroke();
  for (let i = 0; i < fx.w; i++) {
    const cx0 = px + i * T;
    // back row (stock)
    ctx.fillStyle = vgrad(ctx, py + 4, py + T, [[0, shade(pal.back, -0.12)], [1, pal.back]]);
    rr(ctx, cx0 + 3, py + 4, T - 6, T - 5, 4); ctx.fill();
    // front row tray
    ctx.fillStyle = vgrad(ctx, py + T, py + 2 * T - 8, [[0, pal.tray], [1, shade(pal.tray, -0.08)]]);
    rr(ctx, cx0 + 3, py + T + 1, T - 6, T - 10, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.14)'; ctx.lineWidth = 1; rr(ctx, cx0 + 3, py + T + 1, T - 6, T - 10, 4); ctx.stroke();
    // price tag
    const p = prodAt(fx.id, 'wall', i);
    if (p) priceChip(ctx, cx0 + T / 2, py + 2 * T - 15, p.price);
  }
  // lip (front panel) with accent line
  ctx.fillStyle = vgrad(ctx, py + 2 * T - 9, py + 2 * T, [[0, pal.lip], [1, shade(pal.lip, -0.25)]]);
  rr(ctx, px + 1, py + 2 * T - 9, w - 2, 8, 4); ctx.fill();
  ctx.fillStyle = pal.accent; ctx.globalAlpha = 0.85; ctx.fillRect(px + 8, py + 2 * T - 7, w - 16, 1.6); ctx.globalAlpha = 1;
  // glass glare for refrigerated units
  if (pal.glass) {
    ctx.save();
    rr(ctx, px + 2, py + 2, w - 4, h - 12, 6); ctx.clip();
    for (let i = 0; i < fx.w; i += 2) {
      const gx = px + i * T;
      const g = ctx.createLinearGradient(gx, py, gx + T * 1.5, py + h);
      g.addColorStop(0, 'rgba(255,255,255,.34)'); g.addColorStop(0.45, 'rgba(255,255,255,.05)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(gx, py); ctx.lineTo(gx + T * 0.9, py); ctx.lineTo(gx + T * 0.2, py + h); ctx.lineTo(gx - T * 0.7, py + h); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    if (fx.category === 'frozen' || fx.category === 'dairy') {
      // frost sparkles
      const r = mulberry(fx.x * 13 + 5);
      for (let i = 0; i < fx.w * 5; i++) {
        ctx.fillStyle = 'rgba(255,255,255,.8)';
        const sx = px + 6 + r() * (w - 12), sy = py + 6 + r() * (h - 24);
        ctx.fillRect(sx, sy, 1.6, 1.6);
      }
    }
  } else {
    // bakery wooden counter: glass top reflections + wood grain
    ctx.save();
    rr(ctx, px + 2, py + 2, w - 4, h - 12, 6); ctx.clip();
    ctx.strokeStyle = 'rgba(80,45,15,.18)'; ctx.lineWidth = 1;
    for (let y = py + 6; y < py + h; y += 7) { ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px + w, y + 2); ctx.stroke(); }
    const g = ctx.createLinearGradient(px, py, px + w * 0.5, py + h);
    g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(px, py, w, h);
    ctx.restore();
  }
}

function drawGondola(ctx, fx, store, prodAt) {
  const isIsland = fx.kind === 'island';
  const px = fx.x * T, py = fx.y * T, w = fx.w * T, h = 2 * T;
  const body = isIsland ? ['#7a8794', '#66727e'] : ['#c9d0d8', '#aab3bd'];
  const tray = isIsland ? ['#e6edf8', '#c7d4ea'] : ['#f6f8fb', '#dfe5ee'];
  softShadow(ctx, px, py, w, h, 7);
  ctx.fillStyle = vgrad(ctx, py, py + h, [[0, body[0]], [1, body[1]]]);
  rr(ctx, px, py, w, h, 7); ctx.fill();
  ctx.strokeStyle = '#111111'; ctx.lineWidth = 1.6; rr(ctx, px + 0.8, py + 0.8, w - 1.6, h - 1.6, 7); ctx.stroke();
  ctx.fillStyle = '#1748C8'; ctx.fillRect(px + 8, py + 2, w - 16, 3); ctx.fillRect(px + 8, py + h - 5, w - 16, 3);
  const cat = store.categories.find((c) => c.id === fx.category);
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < fx.w; i++) {
      const cx0 = px + i * T, cy0 = py + r * T;
      ctx.fillStyle = vgrad(ctx, cy0 + 3, cy0 + T - 3, [[0, tray[0]], [1, tray[1]]]);
      rr(ctx, cx0 + 3.5, cy0 + 3.5, T - 7, T - 7, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.lineWidth = 1; rr(ctx, cx0 + 3.5, cy0 + 3.5, T - 7, T - 7, 4); ctx.stroke();
      if (isIsland) { // crate slats
        ctx.strokeStyle = 'rgba(23,72,200,.18)';
        for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(cx0 + 5, cy0 + 3.5 + k * 10.5); ctx.lineTo(cx0 + T - 5, cy0 + 3.5 + k * 10.5); ctx.stroke(); }
      }
      // price strip on the aisle edge
      const side = r === 0 ? 'top' : 'bottom';
      const ty = r === 0 ? cy0 + 3.5 : cy0 + T - 3.5 - 12;
      ctx.fillStyle = '#ffffff';
      rr(ctx, cx0 + 5, ty + 0.5, T - 10, 11, 3); ctx.fill();
      ctx.fillStyle = cat.color; ctx.globalAlpha = 0.9;
      ctx.fillRect(cx0 + 5, r === 0 ? ty + 0.5 : ty + 10.5, T - 10, 1.5); ctx.globalAlpha = 1;
      const p = prodAt(fx.id, side, i);
      if (p) priceChip(ctx, cx0 + T / 2, ty + 6, p.price);
    }
  }
  // centre rail
  ctx.fillStyle = vgrad(ctx, py + T - 3, py + T + 3, [[0, isIsland ? '#7f8da3' : '#a9b0b6'], [1, isIsland ? '#55627a' : '#6a7279']]);
  ctx.fillRect(px + 2, py + T - 3, w - 4, 6);
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(px + 2, py + T - 3, w - 4, 1);
  // end caps in category colour
  for (const ex of [px, px + w - 8]) {
    ctx.fillStyle = vgrad(ctx, py, py + h, [[0, '#2F63DB'], [1, '#1748C8']]);
    rr(ctx, ex, py + 2, 8, h - 4, 4); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px + 6, py + 1.5); ctx.lineTo(px + w - 6, py + 1.5); ctx.stroke();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return `rgb(${r},${g},${b})`;
}

// -------------------------------------------------------------------------------- signs
function signPlate(ctx, x, y, w, h, accent, ar, en) {
  const color = '#1748C8';
  ctx.save();
  ctx.shadowColor = 'rgba(10,20,60,.35)'; ctx.shadowBlur = 6; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 4;
  ctx.fillStyle = vgrad(ctx, y, y + h, [[0, shade(color, 0.18)], [1, shade(color, -0.22)]]);
  rr(ctx, x, y, w, h, 7); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.4; rr(ctx, x + 2, y + 2, w - 4, h - 4, 5); ctx.stroke();
  ctx.fillStyle = accent; ctx.fillRect(x + 10, y + h - 7, w - 20, 3);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1;
  if (h > 30) {
    ctx.font = `800 ${Math.min(21, w / 6)}px ${FONT}`;
    ctx.fillText(ar, x + w / 2, y + h * 0.4);
    ctx.font = `700 ${Math.min(11, w / 10)}px ${FONT}`;
    ctx.globalAlpha = 0.92;
    ctx.fillText(en.toUpperCase(), x + w / 2, y + h * 0.77);
    ctx.globalAlpha = 1;
  } else {
    let fs = Math.min(14, h * 0.62);
    let txt = `${ar} · ${en}`;
    ctx.font = `800 ${fs}px ${FONT}`;
    while (ctx.measureText(txt).width > w - 14 && fs > 9) { fs -= 0.5; ctx.font = `800 ${fs}px ${FONT}`; }
    if (ctx.measureText(txt).width > w - 14) { txt = ar; fs = Math.min(14, h * 0.62); ctx.font = `800 ${fs}px ${FONT}`; }
    ctx.fillText(txt, x + w / 2, y + h / 2 + 0.5);
  }
  ctx.shadowColor = 'transparent';
}

// -------------------------------------------------------------------------------- props / zones
function drawDeco(ctx, d, assets) {
  const x = d.x * T, y = d.y * T, w = d.w * T, h = d.h * T;
  const img = assets.propImg[d.type];
  if (img) {
    ctx.drawImage(img, x, y, w, h);
    return;
  }
  if (d.type === 'wet-floor') {
    // glossy puddle sheen + two signs
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, 'rgba(180,220,255,.50)'); g.addColorStop(0.5, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(140,195,240,.45)');
    ctx.fillStyle = g; rr(ctx, x + 3, y + 3, w - 6, h - 6, 18); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; rr(ctx, x + 3, y + 3, w - 6, h - 6, 18); ctx.stroke();
    const s = assets.propImg['wet-floor-sign'];
    if (s) { ctx.drawImage(s, x - 4, y + 2, T, T); ctx.drawImage(s, x + w - T + 4, y + h - T - 2, T, T); }
  } else if (d.type === 'queue-zone') {
    ctx.save();
    ctx.setLineDash([10, 8]); ctx.strokeStyle = 'rgba(240,190,30,.95)'; ctx.lineWidth = 3;
    rr(ctx, x + 4, y + 4, w - 8, h - 8, 6); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(240,190,30,.85)';
    for (let k = 0; k < 3; k++) {
      const cx = x + w / 2, cy = y + 36 + k * 36 * 2.2;
      ctx.beginPath(); ctx.moveTo(cx - 12, cy - 8); ctx.lineTo(cx, cy + 4); ctx.lineTo(cx + 12, cy - 8); ctx.lineTo(cx + 12, cy - 2); ctx.lineTo(cx, cy + 10); ctx.lineTo(cx - 12, cy - 2); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  } else if (d.type === 'crowd-zone') {
    ctx.fillStyle = 'rgba(90,70,40,.16)';
    const r = mulberry(11);
    for (let i = 0; i < 16; i++) {
      const fx = x + 6 + r() * (w - 12), fy = y + 6 + r() * (h - 12);
      ctx.beginPath(); ctx.ellipse(fx, fy, 3.2, 5.2, r() * 3, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(fx + 6, fy + 2, 3.2, 5.2, r() * 3, 0, 7); ctx.fill();
    }
  }
}

export function buildStaticLayer(store, assets) {
  const W = store.grid.w * T, H = store.grid.h * T;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * RS);
  canvas.height = Math.round(H * RS);
  const ctx = canvas.getContext('2d');
  ctx.scale(RS, RS);
  ctx.lineJoin = 'round';

  // product lookup by fixture/side/slot (for price tags)
  const idx = new Map();
  store.products.forEach((p) => idx.set(`${p.fixture}|${p.side}|${p.slot}`, p));
  const prodAt = (f, side, slot) => idx.get(`${f}|${side}|${slot}`);

  drawFloor(ctx, store, assets);
  drawWalls(ctx, store);
  // wall contact shadows + light baseboard so the walls feel like they sit on the floor
  {
    const W = w_ => w_;
    const g1 = ctx.createLinearGradient(0, T, 0, T + 26); g1.addColorStop(0, 'rgba(10,25,70,.30)'); g1.addColorStop(1, 'rgba(10,25,70,0)');
    ctx.fillStyle = g1; ctx.fillRect(T, T, (store.grid.w - 2) * T, 26);
    const g2 = ctx.createLinearGradient(T, 0, T + 22, 0); g2.addColorStop(0, 'rgba(10,25,70,.26)'); g2.addColorStop(1, 'rgba(10,25,70,0)');
    ctx.fillStyle = g2; ctx.fillRect(T, T, 22, (store.grid.h - 2) * T);
    const x2 = (store.grid.w - 1) * T, g3 = ctx.createLinearGradient(x2, 0, x2 - 22, 0); g3.addColorStop(0, 'rgba(10,25,70,.26)'); g3.addColorStop(1, 'rgba(10,25,70,0)');
    ctx.fillStyle = g3; ctx.fillRect(x2 - 22, T, 22, (store.grid.h - 2) * T);
    ctx.fillStyle = '#5B8CFF'; ctx.fillRect(T, T, (store.grid.w - 2) * T, 3);
    void W;
  }

  // zone decorations drawn under fixtures
  for (const d of store.deco) if (['wet-floor', 'queue-zone', 'crowd-zone', 'doormat'].includes(d.type)) drawDeco(ctx, d, assets);

  // fixtures
  for (const fx of store.fixtures) {
    if (fx.kind === 'wall') drawWallUnit(ctx, fx, store, prodAt);
    else drawGondola(ctx, fx, store, prodAt);
  }
  // other props
  for (const d of store.deco) if (!['wet-floor', 'queue-zone', 'crowd-zone', 'doormat'].includes(d.type)) drawDeco(ctx, d, assets);

  // signs
  for (const s of store.signs) {
    if (s.hanging) signPlate(ctx, s.x * T + 4, s.y * T + 3, s.w * T - 8, 22, s.color, s.ar, s.en);
    else signPlate(ctx, s.x * T + 3, 4, s.w * T - 6, T - 12, s.color, s.ar, s.en);
  }
  // store name over the entrance
  {
    const bx = 8 * T, by = (store.grid.h - 1) * T + 8, bw = 8 * T, bh = T - 16;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
    ctx.fillStyle = vgrad(ctx, by, by + bh, [[0, '#2F63DB'], [1, '#1748C8']]);
    rr(ctx, bx, by, bw, bh, 9); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#BFD4FF'; ctx.lineWidth = 1.6; rr(ctx, bx + 3, by + 3, bw - 6, bh - 6, 7); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = `800 17px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('BASKETWISE MARKET · أهلًا بيك', bx + bw / 2, by + bh / 2 + 1);
  }
  // vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(17,17,17,0)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  return canvas;
}
