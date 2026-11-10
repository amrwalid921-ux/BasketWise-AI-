// snacks + household
import { Path, rrP, ellP, polyP, smoothP, shade, edge, mix, f, rng, pict, ball, cyl, boxUp, bottle, bag, pouch, hOverlay, vOverlay, sticker, cylBodyP } from './templates.mjs';
const R = (x, y, w, h, c, o = '') => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${c}" ${o}/>`;
const dots = (x, y, w, h, n, seed, rad, cols) => { const r = rng(seed); let s = ''; for (let i = 0; i < n; i++) { const cx = x + r() * w, cy = y + r() * h; const c = cols[i % cols.length]; s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rad * (.8 + r() * .4))}" fill="${c}" stroke="${shade(c, -.35)}" stroke-width=".5"/><circle cx="${f(cx - rad * .3)}" cy="${f(cy - rad * .3)}" r="${f(rad * .3)}" fill="#fff" opacity=".45"/>`; } return s; };
// horizontal wrapper pack (flat, crimped left/right)
function hpack(d, o) {
  const { x, y, w, h, color } = o; const p = rrP(x, y, w, h, 6); const bb = [x, y, w, h];
  if (o.shadow !== false) d.shadow(p);
  d.add(d.shape(p, color, { dir: 'v', a: .26, b: .25 }));
  if (o.deco) d.add(d.clip(p, o.deco));
  const cc = o.crimpColor ?? shade(color, .1);
  d.add(d.clip(p, d.crimp(x - 1, y, 10, h, cc, 'h') + d.crimp(x + w - 9, y, 10, h, cc, 'h')));
  d.add(hOverlay(d, p, bb, .15, .25), vOverlay(d, p, bb, .3, .3), `<path d="${p.str()}" fill="none" stroke="${edge(color)}" stroke-width="1.3"/>`, d.spec(x + w * .3, y + 5, 10, 2, -2, .55));
  return p;
}
const wafLayers = (x, y, w, h, c, c2) => { let s = ''; const n = 4; for (let i = 0; i < n; i++) s += R(x, y + i * h / n, w, h / n * .62, c) + R(x, y + i * h / n + h / n * .62, w, h / n * .38, c2); return s; };

export const C = {
  chips(d) {
    bag(d, { cx: 64, cy: 66, w: 72, h: 94, color: '#f2b52a', crimpColor: '#f6d35e', bulge: 5, seed: 12,
      deco: `<path d="M28 18h80v100h-80z" fill="#fff" opacity="0"/><path d="M24 62q24 -22 48 -6t40 -18v34q-24 22 -48 6t-40 18z" fill="#e2503a"/><path d="M24 64q24 -22 48 -6t40 -18" stroke="#fff" stroke-width="2" fill="none" opacity=".6"/>` + [[50, 58, -20], [76, 68, 25], [62, 82, 5]].map(([x, y, r]) => `<g transform="rotate(${r} ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="16" ry="11" fill="#f6d46a" stroke="#b9801e" stroke-width="1.1"/><path d="M${x - 11} ${y}q4 -5 8 0t8 0t8 0" stroke="#d9a040" stroke-width="1.2" fill="none"/><ellipse cx="${x - 4}" cy="${y - 4}" rx="7" ry="2" fill="#fff" opacity=".5"/></g>`).join('') + pict('star', 38, 34, 6, '#fff') });
  },
  'cheese-puffs'(d) {
    const puff = (x, y, r) => `<g transform="rotate(${r} ${x} ${y})"><path d="M${x - 11} ${y + 2}q2 -9 9 -6q3 -6 9 -1q7 -1 6 7q4 6 -3 8q-3 5 -9 1q-9 3 -10 -4q-6 -3 -1 -5z" fill="#f6a43a" stroke="#b9601a" stroke-width="1"/><ellipse cx="${x - 3}" cy="${y - 3}" rx="5" ry="1.6" fill="#fff" opacity=".5"/></g>`;
    bag(d, { cx: 64, cy: 64, w: 76, h: 88, color: '#e8742a', crimpColor: '#f3a468', bulge: 7, crimp: 10, seed: 3,
      deco: `<circle cx="64" cy="66" r="29" fill="#7c4fa0" stroke="#5a3680" stroke-width="1.4"/><circle cx="64" cy="66" r="29" fill="none" stroke="#fff" stroke-width="1.4" opacity=".4" stroke-dasharray="5 4"/>` + puff(52, 56, -20) + puff(76, 62, 30) + puff(60, 78, 8) + pict('flame', 94, 34, 5.5, '#ffe28a') });
  },
  wafer(d) {
    hpack(d, { x: 12, y: 34, w: 104, h: 52, color: '#b5352a', crimpColor: '#d9644f', deco: R(12, 34, 104, 10, '#f3c14a') + R(12, 76, 104, 10, '#f3c14a') + `<ellipse cx="46" cy="60" rx="22" ry="14" fill="#fff3d9" stroke="#e0a04a" stroke-width="1.2"/>` + pict('wafer', 46, 60, 10.5, '#e9b66b', '#6b3a1d') + `<path d="M76 52h26M76 60h22M76 68h26" stroke="#f3c14a" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>` });
    // loose wafer stick
    d.add(d.shadow(rrP(60, 92, 50, 14, 3)) || '', `<g>${d.rect(58, 92, 50, 14, 3, '#e9b66b', { a: .3, b: .25 })}</g>`, d.clip(rrP(58, 92, 50, 14, 3), wafLayers(58, 92, 50, 14, '#e9b66b', '#6b3a1d')), `<path d="${rrP(58, 92, 50, 14, 3).str()}" fill="none" stroke="#8a5a28" stroke-width="1.2"/>`);
  },
  biscuits(d) {
    hpack(d, { x: 10, y: 22, w: 108, h: 40, color: '#2f6fb0', crimpColor: '#6a9ad0', deco: R(10, 22, 108, 8, '#f2ecd8') + R(10, 54, 108, 8, '#f2ecd8') + `<circle cx="64" cy="42" r="12" fill="#e9c27a" stroke="#a8742a" stroke-width="1"/>` + dots(0, 0, 0, 0, 0, 1, 1, ['#000']) + [[60, 38], [68, 38], [60, 46], [68, 46], [64, 42]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.1" fill="#a8742a"/>`).join('') + pict('wheat', 94, 42, 8, '#f2ecd8') + pict('wheat', 34, 42, 8, '#f2ecd8') });
    for (const [cx, cy] of [[40, 90], [82, 92]]) {
      d.shadow(ellP(cx, cy, 17, 17));
      d.add(d.shape(ellP(cx, cy + 3, 17, 17), '#a8742a', { flat: true, stroke: 'none' }), d.circ(cx, cy, 17, '#e9c27a', { a: .3, b: .3, stroke: '#a8742a' }), d.clip(ellP(cx, cy, 16, 16), [[-7, -7], [0, -7], [7, -7], [-7, 0], [0, 0], [7, 0], [-7, 7], [0, 7], [7, 7]].map(([a, b]) => `<circle cx="${cx + a}" cy="${cy + b}" r="1.2" fill="#a8742a" opacity=".75"/>`).join('') + `<circle cx="${cx}" cy="${cy}" r="13" fill="none" stroke="#c99a4a" stroke-width="1"/>`), d.spec(cx - 7, cy - 8, 5, 2, -35, .5));
    }
  },
  chocolate(d) {
    const bar = rrP(26, 14, 74, 100, 5);
    d.shadow(bar);
    d.add(d.shape(bar, '#6a3a22', { a: .25, b: .3 }));
    let g = ''; for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) { const x = 30 + i * 22.5, y = 18 + j * 19.5; g += `<rect x="${x}" y="${y}" width="20" height="17.5" rx="2" fill="${d.lgs([[0, '#8a5232'], [1, '#5a301c']], 0, 0, 1, 1)}" stroke="#4a2616" stroke-width=".8"/><path d="M${x + 2} ${y + 15}V${y + 2}H${x + 18}" stroke="#b07a52" stroke-width="1" fill="none" opacity=".7"/>`; }
    d.add(d.clip(bar, g));
    // wrapper: silver foil + red paper sleeve with torn diagonal edge
    const foil = polyP([[20, 62], [106, 40], [106, 118], [20, 118]]);
    d.add(d.shape(foil, '#cfd5da', { dir: 'tl', a: .35, b: .25 }), d.clip(foil, `<path d="M20 70L106 48" stroke="#fff" stroke-width="2" opacity=".6"/><path d="M30 110L50 66M60 110L80 58" stroke="#aab2b8" stroke-width="2" opacity=".5"/>`));
    const paper = polyP([[20, 84], [106, 64], [106, 118], [20, 118]]);
    d.add(d.shape(paper, '#c4322c', { dir: 'tl', a: .2, b: .28 }), d.clip(paper, `<path d="M20 88L106 68" stroke="#fff" stroke-width="2" opacity=".35"/>` + pict('heart', 63, 98, 0, '#fff')), `<circle cx="63" cy="98" r="9.5" fill="#f9e8c2" stroke="#e0b35c" stroke-width="1"/>`, pict('cow', 63, 98, 6, '#7a4a2a', '#f9e8c2'));
    d.add(d.stroke(new Path().M(20, 62).L(106, 40), '#fff', 1.6, .5));
  },
  candy(d) {
    const cols = ['#e0485f', '#3fb6a8', '#f2c230', '#7c6fd6', '#f28a1e', '#5da9e9', '#7ccf4a', '#f26ca7'];
    const r = rng(5); let cs = '';
    const spots = [[44, 44], [70, 40], [90, 52], [50, 68], [76, 70], [96, 78], [40, 88], [64, 92], [86, 100], [56, 54]];
    spots.forEach(([x, y], i) => { cs += pict('candy', x, y, 9, cols[i % 8], '#ffffff').replace('<g ', `<g `); });
    bag(d, { cx: 64, cy: 66, w: 78, h: 92, color: '#fbe3ee', crimpColor: '#f6a9cb', bulge: 5, seed: 9, deco: R(20, 20, 90, 90, '#fff', 'opacity=".4"') + cs + R(20, 18, 90, 6, '#f26ca7') });
  },
  nuts(d) {
    const nut = (x, y, k) => k % 3 === 0 ? pict('almond', x, y, 8.5, '#b9792f', '#6b3a1d') : k % 3 === 1 ? `<circle cx="${x}" cy="${y}" r="6.2" fill="#a8683a" stroke="#6b3a1d" stroke-width=".8"/><circle cx="${x - 2}" cy="${y - 2}" r="1.8" fill="#fff" opacity=".45"/>` : `<ellipse cx="${x}" cy="${y}" rx="8" ry="6.2" fill="#d9ab6a" stroke="#8a5a2a" stroke-width=".9"/><path d="M${x - 6} ${y}q3 -4 6 0t6 0" stroke="#8a5a2a" stroke-width="1" fill="none"/>`;
    let ns = ''; const r = rng(2); for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) ns += nut(46 + i * 12 + (j % 2) * 4, 52 + j * 11, i + j * 2);
    pouch(d, { cx: 64, y: 12, w: 72, h: 100, color: '#c99f68', seal: '#e0c08a', deco: `<rect x="38" y="42" width="52" height="50" rx="10" fill="#f6ead0" stroke="#8a5a2a" stroke-width="1.2"/>` + ns + `<path d="M38 42h52v7h-52z" fill="#fff" opacity=".45"/>` + pict('almond', 64, 102, 6.5, '#fff3d6', '#8a5a2a') });
  },
  popcorn(d) {
    const cx = 64; const bw = 40;
    cyl(d, { cx, y: 56, rx: 40, ry: 14, h: 52, rxb: 28, color: '#fffaf0', top: '#8a1f1a', rim: false,
      deco: Array.from({ length: 7 }, (_, i) => R(cx - 46 + i * 14, 50, 7, 70, '#d9473a')).join('') + `<path d="M24 0z" fill="none"/>`, topDeco: '' });
    const r = rng(14); let pc = ''; const pts = []; for (let i = 0; i < 20; i++) { const a = r() * 6.28, k = Math.sqrt(r()); pts.push([cx + Math.cos(a) * 34 * k, 40 + Math.sin(a) * 18 * k - (1 - k) * 8, 8 + r() * 4]); }
    pts.sort((a, b) => a[1] - b[1]);
    for (const [x, y, rad] of pts) { pc += `<circle cx="${f(x + 1)}" cy="${f(y + 2)}" r="${f(rad)}" fill="#2b2118" opacity=".14"/>`; for (let k = 0; k < 3; k++) { const a = k * 2.1 + x, cxx = x + Math.cos(a) * rad * .45, cyy = y + Math.sin(a) * rad * .45; pc += `<circle cx="${f(cxx)}" cy="${f(cyy)}" r="${f(rad * .62)}" fill="${d.rgs([[0, '#fffdf0'], [.7, '#fff0c0'], [1, '#e8c66a']], .4, .35, .7)}" stroke="#c9a040" stroke-width=".6"/>`; } pc += `<circle cx="${f(x + rad * .25)}" cy="${f(y + rad * .2)}" r="${f(rad * .22)}" fill="#f2c14e"/>`; }
    d.add(pc);
  },
  'granola-bar'(d) {
    hpack(d, { x: 12, y: 20, w: 104, h: 38, color: '#6b8e3a', crimpColor: '#a3c46a', deco: R(12, 20, 104, 7, '#f3e6c0') + `<rect x="36" y="30" width="56" height="20" rx="6" fill="#c9a06b" stroke="#6b4423" stroke-width="1"/>` + dots(40, 33, 48, 14, 22, 2, 2, ['#e0b86a', '#a8742a', '#d9a04a']) + pict('wheat', 22, 40, 6, '#f3e6c0') });
    // bar lying out
    const bar = rrP(18, 72, 92, 32, 7); d.shadow(bar);
    d.add(d.shape(bar, '#b98a46', { a: .3, b: .3 }), d.clip(bar, dots(18, 72, 92, 32, 60, 8, 3.4, ['#e0b86a', '#8a5a28', '#d9a04a', '#f1d79a', '#a8742a'])), d.clip(bar, `<path d="M22 84q16 -8 30 0t30 0t26 -2" stroke="#fff3d0" stroke-width="2.6" fill="none" opacity=".7"/>`), d.wash(bar, [18, 72, 92, 32], .3), d.ao(bar, [18, 72, 92, 32], .25), `<path d="${bar.str()}" fill="none" stroke="#6b4423" stroke-width="1.3"/>`);
  },
  'sunflower-seeds'(d) {
    bag(d, { cx: 64, cy: 62, w: 70, h: 86, color: '#f0c43a', crimpColor: '#f6dc78', bulge: 4, seed: 4, deco: `<path d="M20 70L64 44L108 70V120H20z" fill="#4a3a2a" opacity="0"/>` + `<path d="M20 30L64 18L108 30V40L64 28L20 40z" fill="#4a3a2a" opacity=".85"/>` + `<circle cx="64" cy="66" r="25" fill="#fff4c0" stroke="#d9a02a" stroke-width="1.3"/>` + pict('sunflower', 64, 66, 21, '#f2a81c', '#5a3a1c') + R(20, 96, 90, 4, '#4a3a2a', 'opacity=".7"') });
    for (const [x, y, r] of [[28, 108, 20], [44, 112, -30], [100, 110, 35], [88, 114, 0]]) d.add(`<ellipse cx="${x + 1}" cy="${y + 1.5}" rx="5.5" ry="2.8" fill="#2b2118" opacity=".25" transform="rotate(${r} ${x} ${y})"/><ellipse cx="${x}" cy="${y}" rx="5.5" ry="2.8" fill="#e8e0d0" stroke="#4a3a2a" stroke-width=".9" transform="rotate(${r} ${x} ${y})"/><path d="M${x - 4} ${y}h8" stroke="#4a3a2a" stroke-width="1" transform="rotate(${r} ${x} ${y})" opacity=".6"/>`);
  },

  // ---------------- household
  detergent(d) {
    boxUp(d, { x: 20, y: 14, w: 88, h: 88, td: 14, inset: 6, color: '#7C6FD6', top: '#9a8fe6',
      deco: `<path d="M20 60Q42 44 64 60T108 60V84Q86 100 64 84T20 84Z" fill="#fff" opacity=".9"/><path d="M20 60Q42 44 64 60T108 60" stroke="#c5bff0" stroke-width="2" fill="none"/>` + R(20, 28, 88, 12, '#5a4eb8') + pict('bubble', 64, 72, 15, '#7C6FD6') + pict('sparkle', 90, 40, 7, '#ffe28a') + pict('sparkle', 36, 96, 5, '#fff'),
      topDeco: `<rect x="48" y="16" width="32" height="6" rx="3" fill="#4a3f9a"/><rect x="49" y="17" width="30" height="2" rx="1" fill="#000" opacity=".15"/>` });
  },
  'dish-soap'(d) {
    bottle(d, { cx: 64, y: 8, color: '#7bd05a', glass: true, neckW: 16, bodyW: 40, capH: 14, capW: 20, neckH: 12, shoulderH: 14, bodyH: 62, cap: '#f4f6f0', liquid: '#8ad96a', petBase: true, base: .1,
      deco: `<rect x="36" y="52" width="56" height="46" rx="8" fill="#fff9d8" stroke="#d9c54a" stroke-width="1.2"/>` + pict('lemon', 64, 75, 15, '#f2d230', '#fff3a8') + pict('bubble', 84, 58, 5, '#7bd05a') });
    d.add(`<rect x="70" y="10" width="14" height="6" rx="3" fill="#e6ebe0" stroke="#9aa090" stroke-width="1"/><circle cx="82" cy="13" r="1.3" fill="#7a8070"/>`);
  },
  tissue(d) {
    boxUp(d, { x: 16, y: 44, w: 96, h: 56, td: 30, inset: 6, color: '#a99be8', top: '#d9d2f6',
      deco: `<path d="M16 74H112V100H16Z" fill="#a99be8"/>` + [[34, 90], [64, 90], [94, 90]].map(([x, y]) => pict('sparkle', x, y, 7, '#fff')).join('') + R(16, 74, 96, 3, '#fff', 'opacity=".5"') + R(16, 96, 96, 4, '#7C6FD6', 'opacity=".6"'),
      topDeco: `<ellipse cx="64" cy="58" rx="32" ry="8" fill="#6a5cc0"/>` });
    d.add(`<path d="M40 58C36 40 46 28 56 32C60 20 74 22 76 34C88 30 94 44 86 58C74 62 54 62 40 58Z" fill="#fdfdff" stroke="#b9b4d6" stroke-width="1.2"/><path d="M50 52C54 40 60 36 66 42C70 34 78 38 80 50" fill="none" stroke="#d9d6ec" stroke-width="1.6"/><path d="M44 48C50 44 56 46 58 54" stroke="#fff" stroke-width="2" fill="none" opacity=".9"/>`);
  },
  shampoo(d) {
    bottle(d, { cx: 64, y: 28, color: '#cdb8ec', neckW: 16, bodyW: 40, capH: 10, capW: 22, neckH: 6, shoulderH: 14, bodyH: 56, cap: '#8a5ad6', petBase: true, base: .1,
      deco: R(20, 60, 90, 36, '#fdf6ff') + R(20, 58, 90, 3, '#8a5ad6') + R(20, 96, 90, 3, '#8a5ad6') + pict('leaf', 64, 78, 12, '#5aa65a', '#fff') + pict('drop', 50, 70, 4, '#8a5ad6') });
    // pump
    d.add(d.shadow(rrP(56, 4, 30, 8, 3)) || '', d.rect(60, 15, 8, 12, 2, '#efe8f8'), d.rect(54, 8, 34, 9, 4, '#8a5ad6', { a: .3 }), d.rect(84, 10, 14, 5, 2.5, '#8a5ad6', { a: .2 }), d.line(58, 10.5, 82, 10.5, '#fff', 1.2, .5));
  },
  toothpaste(d) {
    const inner = []; const g = (s) => `<g transform="rotate(-24 64 64)">${s}</g>`;
    // use real doc drawing with rotation by wrapping a nested group: draw into scratch Doc body
    const saved = d.body; d.body = [];
    // tube
    const tube = new Path().M(16, 38).L(70, 36).C(84, 36, 88, 40, 90, 44).L(92, 56).C(92, 66, 86, 70, 72, 70).L(16, 68).Z();
    d.shadow(tube);
    d.add(d.shape(tube, '#f6f8fa', { dir: 'v', a: .3, b: .25 }));
    d.add(d.clip(tube, R(16, 44, 76, 7, '#2f8fd0') + R(16, 52, 76, 5, '#d9473a') + pict('tooth', 46, 58, 0, '#fff') + `<circle cx="44" cy="53" r="0" fill="#fff"/>`));
    d.add(d.clip(tube, `<circle cx="48" cy="58" r="0" fill="#000"/>`), pict('tooth', 40, 54, 9, '#2f8fd0', '#2f8fd0'));
    d.add(d.crimp(8, 36, 12, 34, '#dfe5ea', 'h'), hOverlay(d, tube, [16, 36, 76, 34], .15, .2), vOverlay(d, tube, [16, 36, 76, 34], .35, .3), `<path d="${tube.str()}" fill="none" stroke="#7a8a96" stroke-width="1.3"/>`);
    d.add(d.rect(90, 42, 14, 22, 3, '#2f8fd0', { a: .3 }), d.rect(98, 46, 10, 14, 3, '#2f8fd0', { a: .2 }));
    // brush
    d.shadow(rrP(20, 92, 90, 9, 4)); d.add(d.rect(16, 90, 82, 10, 5, '#2fb5a6', { dir: 'v', a: .3 }), d.rect(92, 86, 24, 18, 5, '#2fb5a6'), d.rect(96, 78, 18, 10, 2, '#f3f6f8', { a: .1, b: .1 }), [0, 1, 2, 3, 4].map(i => R(97 + i * 3.4, 74, 2.2, 10, ['#fff', '#7ec8e3'][i % 2], 'rx="1"')).join(''), `<path d="M100 78q8 -3 14 0" stroke="#2f8fd0" stroke-width="3" fill="none" opacity=".0"/>`);
    d.add(`<path d="M96 76q10 -4 18 0" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".9"/><path d="M96 75q10 -4 18 0" stroke="#2f8fd0" stroke-width="2" fill="none" stroke-linecap="round" opacity=".8"/>`);
    const inside = d.body.join(''); d.body = saved; d.add(g(inside));
  },
  bleach(d) {
    const hd = new Path().M(86, 38).C(116, 30, 118, 70, 90, 66);
    d.add(d.stroke(hd, '#2b5aa0', 8.5, 1), d.stroke(hd, '#4f86c6', 5.5, 1), d.stroke(hd.move(-1, -1.4), '#fff', 1.4, .45));
    bottle(d, { cx: 56, y: 16, color: '#eaf3fb', neckW: 22, bodyW: 62, capH: 12, capW: 28, neckH: 8, shoulderH: 16, bodyH: 62, cap: '#2b5aa0', petBase: true, base: .1,
      deco: R(15, 60, 90, 36, '#4f86c6') + R(15, 58, 90, 2.5, '#fff', 'opacity=".6"') + `<circle cx="56" cy="78" r="14" fill="#fff" stroke="#2b5aa0" stroke-width="1.2"/>` + pict('sparkle', 56, 78, 10, '#4f86c6') + R(15, 96, 90, 2, '#2b5aa0', 'opacity=".5"') });
  },
  'hand-soap'(d) {
    const bar = (x, y, w, h, c, wrapped) => {
      const p = rrP(x, y, w, h, 13); d.shadow(p);
      d.add(`<path d="${p.move(0, 5).str()}" fill="${shade(c, -.28)}" stroke="${edge(c)}" stroke-width="1.2"/>`, d.shape(p, c, { dir: 'tl', a: .3, b: .2 }),
        `<path d="${rrP(x + 7, y + 6, w - 14, h - 12, 8).str()}" fill="none" stroke="${shade(c, -.2)}" stroke-width="1.3" opacity=".65"/>`, `<path d="${rrP(x + 7.8, y + 6.8, w - 14, h - 12, 8).str()}" fill="none" stroke="#fff" stroke-width="1" opacity=".6"/>`, pict('leaf', x + w / 2, y + h / 2, 7.5, shade(c, -.25)), d.spec(x + w * .25, y + 7, 9, 2.4, -6, .6));
      if (wrapped) { const wp = rrP(x + w * .38, y - 3, w * .66, h + 7, 5); d.add(d.shape(wp, '#7C6FD6', { dir: 'tl', a: .25, b: .25 }), d.clip(wp, R(x + w * .38, y + 6, w * .7, 6, '#fff', 'opacity=".85"') + `<path d="M${x + w * .4} ${y + h - 6}q9 -5 18 0t18 0" stroke="#fff" stroke-width="2" fill="none"/>`), `<path d="${new Path().M(x + w * .38, y - 3).L(x + w * .36, y + h + 4).str()}" stroke="#fff" stroke-width="1" opacity=".5"/>`); }
    };
    bar(14, 22, 78, 44, '#f7d9c9', false);
    bar(30, 70, 80, 44, '#cfe8d9', true);
    d.add([[98, 28, 6], [108, 44, 4], [104, 60, 3]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" fill-opacity=".3" stroke="#9ac4e0" stroke-width="1"/><ellipse cx="${x - r * .3}" cy="${y - r * .3}" rx="${r * .25}" ry="${r * .15}" fill="#fff" transform="rotate(-40 ${x} ${y})"/>`).join(''));
  },
  'toilet-paper'(d) {
    const rolls = [[38, 38], [90, 38], [38, 84], [90, 84]]; const rr = 24;
    d.shadow(rrP(10, 10, 108, 106, 14));
    for (const [x, y] of rolls) {
      d.add(`<ellipse cx="${x}" cy="${y + 5}" rx="${rr}" ry="${rr}" fill="#c9c2b4" stroke="#8d8478" stroke-width="1.1"/>`, d.circ(x, y, rr, '#fbfaf5', { a: .1, b: .2, stroke: '#a89f90' }),
        `<circle cx="${x}" cy="${y}" r="${rr - 5}" fill="none" stroke="#e1dccf" stroke-width="1.2"/><circle cx="${x}" cy="${y}" r="${rr - 10}" fill="none" stroke="#e1dccf" stroke-width="1"/>`, `<circle cx="${x}" cy="${y}" r="9" fill="#cdb592" stroke="#8d6f46" stroke-width="1"/><circle cx="${x + 1}" cy="${y + 1}" r="6.4" fill="#6a5a46"/><circle cx="${x}" cy="${y}" r="6.4" fill="${d.lgs([[0, '#7a6a54'], [1, '#a89678']])}"/>`,
        `<path d="M${x - rr + 3} ${y - 4}A${rr - 3} ${rr - 3} 0 0 1 ${x - 4} ${y - rr + 3}" stroke="#fff" stroke-width="2.4" fill="none" opacity=".8" stroke-linecap="round"/>`, d.clip(ellP(x, y, rr, rr), `<path d="M${x - rr} ${y + 8}q${rr / 2} 6 ${rr} 0t${rr} 0" stroke="#d6d1c4" stroke-width="1" fill="none" opacity=".7"/>`));
    }
    const wp = rrP(9, 12, 110, 104, 14);
    d.add(`<path d="${wp.str()}" fill="${d.lgs([[0, '#fff', .38], [.4, '#fff', .08], [1, '#cfe0f0', .2]], 0, 0, 1, 1)}" stroke="#fff" stroke-opacity=".7" stroke-width="1.4"/>`, d.glint(new Path().M(16, 24).Q(30, 14, 56, 14), 2, .7), `<path d="M12 62H116" stroke="#7C6FD6" stroke-width="5" opacity=".0"/>`);
    d.add(`<rect x="46" y="58" width="36" height="12" rx="6" fill="#7C6FD6" opacity=".92" stroke="#4a3f9a" stroke-width="1"/>`, pict('sparkle', 64, 64, 4.5, '#fff'));
  },
};
