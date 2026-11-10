// produce + grocery
import { Path, rrP, ellP, polyP, smoothP, shade, edge, mix, f, rng, pict, ball, cyl, boxUp, bottle, carton, bag, pouch, tray, crate, ringPull, hOverlay, vOverlay, sticker, jar, lid, gingham, netLines, cylBodyP } from './templates.mjs';
const R = (x, y, w, h, c, o = '') => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${c}" ${o}/>`;
const star5 = (cx, cy, r, c) => { const pts = []; for (let i = 0; i < 10; i++) { const a = (-90 + i * 36) * Math.PI / 180, rr = i % 2 ? r * .4 : r; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } return `<path d="${polyP(pts).str()}" fill="${c}"/>`; };
function pile(d, balls, color, o = {}) {
  return balls.slice().sort((a, b) => a[1] - b[1]).map(([x, y, r], i) => `<ellipse cx="${x + 1.5}" cy="${y + 2.5}" rx="${r}" ry="${r}" fill="#2b2118" opacity=".22"/>` + ball(d, x, y, r, Array.isArray(color) ? color[i % color.length] : color) + (o.calyx ? star5(x, y - r * .62, r * .34, '#3f8f2f') : '')).join('');
}
const rice = (x, y, w, h, n, seed, c = '#fffdf2') => { const r = rng(seed); let s = ''; for (let i = 0; i < n; i++) { const px = x + r() * w, py = y + r() * h; s += `<ellipse cx="${f(px)}" cy="${f(py)}" rx="2.8" ry="1.2" fill="${c}" stroke="#c8b98a" stroke-width=".4" transform="rotate(${f(r() * 180)} ${f(px)} ${f(py)})"/>`; } return s; };
const dots = (x, y, w, h, n, seed, rad, cols) => { const r = rng(seed); let s = ''; for (let i = 0; i < n; i++) { const cx = x + r() * w, cy = y + r() * h; const c = cols[i % cols.length]; s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rad * (.8 + r() * .4))}" fill="${c}" stroke="${shade(c, -.35)}" stroke-width=".5"/><circle cx="${f(cx - rad * .3)}" cy="${f(cy - rad * .3)}" r="${f(rad * .3)}" fill="#fff" opacity=".45"/>`; } return s; };

export const B = {
  // ---------------- produce
  tomatoes(d) {
    const balls = [[34, 50], [58, 48], [82, 50], [104, 52], [45, 68], [70, 66], [94, 68], [32, 82], [58, 84], [84, 84], [106, 80]].map(([x, y]) => [x, y, 13.5]);
    crate(d, { x: 10, y: 28, w: 108, h: 84, deco: pile(d, balls, ['#e0392f', '#d9301f', '#e8483a'], { calyx: true }) });
  },
  bananas(d) {
    const arcs = [[26, 36, 100, 86, 14], [24, 50, 98, 100, 8], [30, 24, 104, 70, 20], [34, 62, 88, 108, 0]];
    const mk = (x0, y0, x1, y1, bend) => new Path().M(x0, y0).Q((x0 + x1) / 2 - 8 + bend, (y0 + y1) / 2 + 30 - bend, x1, y1);
    const ps = arcs.map(a => mk(...a));
    d.shadow(ps.map(p => p.str()).map(s => s));
    ps.forEach((p, i) => {
      const c = ['#f4cf3a', '#f6d845', '#efc62f', '#f7dc50'][i];
      d.add(d.stroke(p, '#8a6a1c', 15.5, 1), d.stroke(p, c, 13.2, 1), d.stroke(p.move(-1.8, -2.4), '#fff7b0', 3.2, .6), d.stroke(p.move(2.2, 3), '#c99a1c', 3, .45));
      const a = arcs[i]; d.add(d.circ(a[2], a[3], 5.2, '#5b4320', { sw: .8 }));
    });
    d.add(d.rect(14, 16, 18, 22, 5, '#7a8a2f', { rot: -28 }), d.rect(16, 20, 12, 5, 2, '#a3b04a', { rot: -28 }));
  },
  oranges(d) {
    const balls = [[40, 82, 15], [68, 86, 15], [94, 80, 14.5], [52, 62, 15], [80, 60, 15], [66, 40, 14.5]];
    const hull = ellP(66, 66, 50, 44);
    d.shadow(hull);
    d.add(pile(d, balls, ['#f28a1e', '#f59a2c', '#ea7b14']));
    d.add(netLines(d, hull, [16, 22, 100, 90], '#ffe0b0', .55, 8));
    d.add(`<path d="${new Path().M(48, 30).Q(66, 22, 84, 30).str()}" stroke="#c8691a" stroke-width="1.4" fill="none"/>`);
    d.add(d.rect(56, 14, 22, 16, 4, '#d9473a', { a: .3 }), d.line(60, 22, 74, 22, '#fff', 1.2, .6), d.circ(67, 14, 3, '#f6eee0'));
    d.add(pict('leaf', 94, 40, 6.5, '#4c9a3a'));
  },
  potatoes(d) {
    d.shadow(rrP(22, 38, 84, 76, 16));
    const sack = new Path().M(26, 56).C(22, 80, 22, 100, 28, 110).Q(64, 118, 100, 110).C(106, 100, 106, 80, 102, 56).Z();
    // potatoes spilling at top
    const rr = rng(8); const pots = [[44, 42, 15, 11, -20], [68, 38, 16, 12, 10], [90, 46, 14, 10, 25], [56, 54, 15, 11, 5], [80, 58, 14, 10, -10]];
    d.add(d.ell(64, 58, 40, 12, '#5e4426', { flat: true }));
    for (const [x, y, rx, ry, r] of pots) d.add(d.ell(x, y, rx, ry, '#c9955a', { rot: r, a: .3, b: .3 }), `<g fill="#7a5530" opacity=".7">${[[-4, -2], [3, 2], [6, -3]].map(([a, b]) => `<circle cx="${x + a}" cy="${y + b}" r="1"/>`).join('')}</g>`, d.spec(x - rx * .4, y - ry * .4, rx * .3, ry * .25, -20, .55));
    d.add(d.shape(sack, '#c9a36a', { dir: 'h', a: .2, b: .28 }));
    let weave = ''; for (let k = 0; k < 14; k++) weave += `M${22} ${60 + k * 4}H108`; for (let k = 0; k < 18; k++) weave += `M${26 + k * 5} 56V116`;
    d.add(d.clip(sack, `<path d="${weave}" stroke="#8d6a3a" stroke-width=".7" opacity=".4"/>` + `<rect x="30" y="76" width="68" height="22" fill="#d9473a" opacity=".0"/>` + `<ellipse cx="64" cy="87" rx="20" ry="13" fill="#f3e6c8" stroke="#a8844a" stroke-width="1"/>`), pict('sprout', 64, 87, 9, '#6aa84f', '#7a5530'));
    d.add(hOverlay(d, sack, [22, 56, 86, 60], .25, .3), `<path d="${sack.str()}" fill="none" stroke="#7a5a2e" stroke-width="1.3"/>`);
    d.add(`<path d="M24 58Q64 70 104 58" stroke="#8d6a3a" stroke-width="3.6" fill="none" stroke-linecap="round"/><path d="M24 56Q64 68 104 56" stroke="#e2c791" stroke-width="2" fill="none" stroke-linecap="round" opacity=".7"/>`);
  },
  cucumbers(d) {
    const cs = [[-24, 0], [-8, -6], [8, 0], [24, 6]]; // offsets along perpendicular
    const pts = cs.map(([o, s], i) => { const a = -50 * Math.PI / 180; return [64 + Math.cos(a + 1.5708) * o * -1 + s, 64 + Math.sin(a + 1.5708) * o * -1 - s * .3, i]; });
    d.shadow(pts.map(([x, y]) => ellP(x, y, 12, 48, 40)));
    const r = rng(3);
    pts.forEach(([x, y, i]) => {
      const c = ['#3f8a3a', '#4a9a42', '#388236', '#4f9f45'][i];
      const p = ellP(x, y, 12, 47, 40);
      let bump = ''; for (let k = 0; k < 18; k++) bump += `<circle cx="${f(x + (r() - .5) * 14)}" cy="${f(y + (r() - .5) * 80)}" r=".9" fill="#b9e08a" opacity=".6"/>`;
      d.add(d.shape(p, c, { a: .3, b: .3 }), `<g transform="rotate(40 ${x} ${y})">${d.clip(ellP(x, y, 12, 47, 0), bump)}</g>`);
      d.add(`<g transform="rotate(40 ${x} ${y})"><ellipse cx="${x - 4}" cy="${y - 8}" rx="2" ry="18" fill="#fff" opacity=".28"/><circle cx="${x}" cy="${y - 46}" r="3.4" fill="#e8d84a" stroke="#8a7f1e" stroke-width=".8"/></g>`);
    });
    d.add(`<g transform="rotate(40 64 64)"><rect x="34" y="58" width="60" height="9" rx="3" fill="#d9473a" stroke="#8a2a24" stroke-width="1" transform="rotate(90 64 62)"/></g>`);
  },
  onions(d) {
    const onion = (cx, cy, s, c, rot) => {
      const p = new Path().M(0, -22).C(5, -20, 7, -14, 14, -8).C(24, 4, 20, 22, 0, 22).C(-20, 22, -24, 4, -14, -8).C(-7, -14, -5, -20, 0, -22).Z().scale(s).move(cx, cy).rot(rot, cx, cy);
      d.shadow(p);
      d.add(d.shape(p, c, { a: .3, b: .3 }));
      let l = ''; for (let k = -3; k <= 3; k++) l += `<path d="M${k * 4.6 * s} ${-18 * s}Q${k * 8.5 * s} ${2 * s} ${k * 4 * s} ${21 * s}" stroke="${shade(c, -.3)}" stroke-width=".9" fill="none" opacity=".6"/>`;
      d.add(`<g transform="translate(${cx} ${cy}) rotate(${rot})">${l}<path d="M${-1.5 * s} ${-22 * s}q${1 * s} ${-6 * s} ${3 * s} ${-8 * s}" stroke="#a8844a" stroke-width="2.4" fill="none" stroke-linecap="round"/><ellipse cx="${-8 * s}" cy="${-4 * s}" rx="${3 * s}" ry="${8 * s}" fill="#fff" opacity=".35" transform="rotate(25 ${-8 * s} ${-4 * s})"/><path d="M${-7 * s} ${22 * s}l${-1} ${4} M${0} ${22 * s}v4 M${6 * s} ${22 * s}l${1} ${4}" stroke="#e6d6b4" stroke-width=".9"/></g>`);
    };
    onion(42, 58, 1.05, '#d99a3a', -8); onion(86, 52, 1, '#e0a84a', 10); onion(64, 88, 1.1, '#cf8a30', 0);
    // half red onion w rings
    d.shadow(ellP(100, 92, 17, 15)); d.add(d.ell(100, 92, 17, 15, '#e8d6e8', { a: .3, b: .1 }), [3, 6.5, 10, 13.5].map((r, i) => `<ellipse cx="100" cy="92" rx="${r}" ry="${r * .88}" fill="none" stroke="#a84a86" stroke-width="1.5"/>`).join(''), d.spec(94, 85, 4, 1.8, -35, .6));
  },
  apples(d) {
    d.shadow(ellP(64, 70, 54, 46));
    d.add(`<ellipse cx="64" cy="74" rx="54" ry="44" fill="#8a5a28" stroke="#5a3a18" stroke-width="1.3"/>`);
    d.add(d.shape(ellP(64, 70, 54, 44), '#c9965a', { a: .3, b: .25 }), `<ellipse cx="64" cy="68" rx="46" ry="36" fill="#5a3a18"/>`);
    let wv = ''; for (let k = 0; k < 40; k++) { const a = k * 9 * Math.PI / 180; wv += `<path d="M${f(64 + Math.cos(a) * 46)} ${f(68 + Math.sin(a) * 37)}L${f(64 + Math.cos(a) * 54)} ${f(70 + Math.sin(a) * 44)}" stroke="${k % 2 ? '#8a5a28' : '#e6bf86'}" stroke-width="1.6" opacity=".8"/>`; }
    d.add(wv);
    const balls = [[44, 58, 15], [74, 52, 15], [90, 72, 14], [56, 80, 15], [34, 78, 12.5], [76, 88, 13]];
    d.add(d.clip(ellP(64, 68, 47, 38), pile(d, balls, ['#d9322f', '#c9242a', '#e0463a', '#76b947', '#d9322f', '#c9242a'])));
    d.add(`<path d="${ellP(64, 68, 47, 38).str()}" fill="none" stroke="#c9965a" stroke-width="1.2" opacity=".0"/>`, pict('leaf', 54, 42, 6, '#4c9a3a'), pict('leaf', 80, 38, 5, '#4c9a3a'));
  },
  lettuce(d) {
    const cx = 64, cy = 66; const r = rng(4);
    const layer = (R0, c, rot, n) => { const pts = []; for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, k = i % 2 ? .82 : 1; pts.push([cx + Math.cos(a) * R0 * k * (.95 + r() * .1), cy + Math.sin(a) * R0 * k * (.95 + r() * .1)]); } return smoothP(pts); };
    const l1 = layer(54, '#4f9f3f', .2, 9); d.shadow(l1);
    d.add(d.shape(l1, '#4f9f3f', { a: .25, b: .3 }));
    const l2 = layer(42, '#78bf52', .5, 8); d.add(d.shape(l2, '#78bf52', { a: .3, b: .25 }));
    const l3 = layer(29, '#a3d46a', .1, 7); d.add(d.shape(l3, '#a3d46a', { a: .3, b: .2 }));
    const l4 = layer(15, '#d4ec8d', .4, 6); d.add(d.shape(l4, '#d4ec8d', { a: .3, b: .15 }));
    let v = ''; for (let i = 0; i < 9; i++) { const a = .2 + i * 2 * Math.PI / 9; v += `<path d="M${f(cx + Math.cos(a) * 12)} ${f(cy + Math.sin(a) * 12)}L${f(cx + Math.cos(a) * 50)} ${f(cy + Math.sin(a) * 50)}" stroke="#e2f2b0" stroke-width="1.3" opacity=".6"/>`; }
    d.add(d.clip(l1, v), d.wash(l1, [10, 12, 108, 108], .3), d.ao(l1, [10, 12, 108, 108], .22));
  },

  // ---------------- grocery
  rice(d) {
    bag(d, { cx: 64, cy: 66, w: 68, h: 94, color: '#f3ecd8', crimpColor: '#cfe6b4', bulge: 3, seed: 3,
      deco: R(28, 18, 76, 22, '#5aa65a') + R(28, 94, 76, 22, '#5aa65a') + `<rect x="36" y="42" width="60" height="42" rx="8" fill="#f9e9bc" stroke="#d9c386" stroke-width="1.2"/>` + rice(40, 46, 52, 34, 40, 2) + `<circle cx="64" cy="82" r="11" fill="#fff" stroke="#9ed08a" stroke-width="1"/>` + pict('wheat', 64, 82, 7, '#d9a444') });
  },
  sugar(d) {
    boxUp(d, { x: 26, y: 20, w: 76, h: 86, td: 10, inset: 6, color: '#f7f9fb', top: '#e9eef3',
      deco: R(26, 30, 76, 20, '#6aa6e0') + R(26, 96, 76, 12, '#6aa6e0') + R(26, 50, 76, 2, '#fff', 'opacity=".6"') + pict('cube', 64, 74, 17, '#9cbbd8', '#dbe9f6') + `<circle cx="38" cy="62" r="1.6" fill="#b9d3ea"/><circle cx="92" cy="86" r="1.6" fill="#b9d3ea"/><circle cx="90" cy="60" r="1.2" fill="#b9d3ea"/>`,
      topDeco: `<path d="M32 22h64M32 26h64" stroke="#c9d6e2" stroke-width="1"/>` });
  },
  flour(d) {
    const body = rrP(22, 40, 84, 72, 18, 12), roll = rrP(30, 26, 68, 22, 8);
    d.shadow([body, roll]);
    d.add(d.shape(body, '#cfa56c', { dir: 'h', a: .2, b: .28 }));
    d.add(d.clip(body, `<ellipse cx="64" cy="82" rx="26" ry="22" fill="#f6ecd4" stroke="#a8844a" stroke-width="1.2"/>`), pict('wheat', 64, 82, 14, '#b4742a'));
    d.add(hOverlay(d, body, [22, 40, 84, 72], .25, .3), vOverlay(d, body, [22, 40, 84, 72], .1, .22), `<path d="${body.str()}" fill="none" stroke="#8a6a38" stroke-width="1.4"/>`);
    d.add(d.shape(roll, '#dcb67e', { dir: 'v', a: .3, b: .2 }), `<path d="M34 37H94" stroke="#7a5a2c" stroke-width="1.6" stroke-dasharray="3 2.2"/>`, d.line(36, 30, 92, 30, '#fff', 1.2, .5));
    d.add(d.stroke(new Path().M(28, 46).Q(20, 70, 28, 104), '#fff', 1.6, .3));
  },
  pasta(d) {
    const mac = (x, y, rot, c) => `<g transform="rotate(${rot} ${x} ${y})"><path d="M${x - 8} ${y + 4}Q${x - 8} ${y - 8} ${x + 2} ${y - 8}Q${x + 9} ${y - 7} ${x + 9} ${y + 2}" stroke="${shade(c, -.35)}" stroke-width="6.6" fill="none" stroke-linecap="round"/><path d="M${x - 8} ${y + 4}Q${x - 8} ${y - 8} ${x + 2} ${y - 8}Q${x + 9} ${y - 7} ${x + 9} ${y + 2}" stroke="${c}" stroke-width="4.8" fill="none" stroke-linecap="round"/><path d="M${x - 8} ${y + 2}Q${x - 8} ${y - 6.5} ${x + 1} ${y - 7}" stroke="#fff" stroke-width="1" fill="none" opacity=".6"/></g>`;
    const r = rng(6); let m = ''; for (let j = 0; j < 6; j++) for (let i = 0; i < 4; i++) m += mac(40 + i * 16 + (j % 2) * 7, 46 + j * 12.5, Math.floor(r() * 360), ['#f0c453', '#f4cf63', '#ebb93f'][(i + j) % 3]);
    bag(d, { cx: 64, cy: 66, w: 66, h: 94, color: '#f5eccc', crimpColor: '#e8d9a6', bulge: 3, seed: 5,
      deco: R(28, 18, 76, 25, '#d9473a') + R(28, 98, 76, 20, '#d9473a') + `<rect x="32" y="44" width="68" height="55" fill="#f9efc7" opacity=".5"/>` + m + R(28, 41, 76, 2.5, '#fff', 'opacity=".6"') });
  },
  lentils(d) {
    pouch(d, { cx: 64, y: 12, w: 70, h: 100, color: '#e0702e', seal: '#f3a468', deco: `<rect x="40" y="44" width="48" height="46" rx="10" fill="#f6d9b4" stroke="#b5521c" stroke-width="1.2"/>` + dots(43, 48, 42, 38, 36, 5, 3, ['#d9622b', '#e8873a', '#c94f1f', '#f0a04a']) + `<path d="M40 44h48v7h-48z" fill="#fff" opacity=".4"/>` + pict('leaf', 64, 101, 7, '#fff3d6', '#e0702e') });
  },
  chickpeas(d) {
    const o = jar(d, { cx: 64, rx: 32, y: 46, h: 62, color: '#e4c892', deco: dots(30, 44, 70, 82, 70, 12, 4.8, ['#e3c57f', '#d8b66a', '#ecd093']) + R(30, 70, 70, 28, '#f7ecd2') + pict('chickpea', 64, 85, 12, '#d8b66a'), });
    lid(d, { ...o, cx: 64, color: '#4c9a3a' });
  },
  salt(d) {
    cyl(d, { cx: 64, y: 30, rx: 24, ry: 9.5, h: 74, color: '#f6f8fa', top: '#4f86c6', bands: [{ y1: 66, y2: 100, color: '#4f86c6' }, { y1: 32, y2: 36, color: '#4f86c6' }], deco: pict('shaker', 64, 82, 13, '#f6f8fa', '#cfd9e3') + `<circle cx="38" cy="50" r="1.2" fill="#c9d6e2"/><circle cx="86" cy="52" r="1.2" fill="#c9d6e2"/>`, topDeco: '' });
    cyl(d, { cx: 64, y: 24, rx: 10, ry: 4, h: 6, color: '#dfe6ec', shadow: false });
    d.add(`<ellipse cx="64" cy="23.5" rx="3.5" ry="1.4" fill="#4a5560"/>`);
  },
  'cooking-oil'(d) {
    d.add(d.stroke(new Path().M(30, 52).C(8, 52, 8, 88, 34, 88), '#c99a1c', 7, 1), d.stroke(new Path().M(30, 52).C(8, 52, 8, 88, 34, 88), '#f2c22e', 4.2, 1));
    bottle(d, { cx: 66, y: 8, color: '#f0c32c', glass: true, neckW: 14, bodyW: 46, capH: 9, capW: 19, neckH: 10, shoulderH: 20, bodyH: 62, cap: '#e0a31a', liquid: '#f6d03a', petBase: true,
      deco: R(20, 70, 90, 30, '#fffbea') + R(20, 70, 90, 2, '#4c9a3a') + R(20, 98, 90, 2, '#4c9a3a') + pict('sunflower', 66, 85, 12, '#f2b82a', '#6b4423') });
  },
  'olive-oil'(d) {
    bottle(d, { cx: 64, y: 8, color: '#35622c', glass: true, neckW: 12, bodyW: 38, capH: 8, capW: 15, neckH: 20, shoulderH: 20, bodyH: 58, cap: '#cdb06a', liquid: '#43762f', sq: .3,
      deco: `<rect x="40" y="62" width="48" height="36" rx="5" fill="#f4ebcf" stroke="#cdb06a" stroke-width="1.4"/>` + pict('olive', 64, 80, 13, '#5a7a2a', '#7a9a3a') + `<path d="M64 38l-4 12M64 38l4 12" stroke="#cdb06a" stroke-width="1" opacity=".0"/>` });
  },
  tea(d) {
    boxUp(d, { x: 28, y: 20, w: 72, h: 86, td: 13, color: '#8d1f26', top: '#b2323a', inset: 5,
      deco: R(28, 33, 72, 3, '#e4bf5a') + R(28, 100, 72, 3, '#e4bf5a') + `<rect x="36" y="46" width="56" height="48" rx="6" fill="none" stroke="#e4bf5a" stroke-width="1.8"/><circle cx="64" cy="70" r="19" fill="#f3e0b0" stroke="#e4bf5a" stroke-width="1.4"/>` + pict('cup', 64, 71, 12, '#8d1f26', '#8d1f26') + pict('leaf', 41, 52, 3.6, '#e4bf5a') + pict('leaf', 87, 88, 3.6, '#e4bf5a'),
      topDeco: `<path d="M40 24h48" stroke="#e4bf5a" stroke-width="1.4" opacity=".8"/>` });
  },
  coffee(d) {
    pouch(d, { cx: 64, y: 12, w: 68, h: 100, color: '#6a4025', seal: '#8a5a38', deco: `<circle cx="64" cy="92" r="4" fill="#e8d6b0" stroke="#3a2210" stroke-width="1"/><rect x="38" y="40" width="52" height="42" rx="21" fill="#f1e2c0" stroke="#d1aa63" stroke-width="1.3"/>` + R(30, 22, 68, 2.5, '#d1aa63') + pict('bean', 64, 61, 13, '#5a3418', '#f1e2c0') });
    d.add(`<rect x="38" y="18" width="52" height="4" rx="2" fill="#d1aa63" stroke="#8a6a2a" stroke-width=".8"/>`);
  },
  'fava-beans'(d) {
    cyl(d, { cx: 64, y: 40, rx: 31, ry: 12, h: 52, color: '#d6b36a', top: '#cdd2d6', bands: [{ y1: 40, y2: 46, color: '#cdd2d6' }, { y1: 88, y2: 94, color: '#cdd2d6' }, { y1: 50, y2: 84, color: '#e3d3a8' }], deco: R(30, 50, 70, 2, '#6b8f3a') + R(30, 82, 70, 2, '#6b8f3a') + `<circle cx="64" cy="67" r="13" fill="#f7efd8" stroke="#a48a50" stroke-width="1"/>` + pict('fava', 64, 67, 9, '#6a9a3a', '#cfe8a0') });
    d.add(ringPull(d, 64, 40, 1.2));
  },
  tuna(d) {
    cyl(d, { cx: 64, y: 62, rx: 42, ry: 17, h: 26, color: '#2f6fb0', top: '#cdd2d6', bands: [{ y1: 62, y2: 67, color: '#cdd2d6' }, { y1: 84, y2: 90, color: '#cdd2d6' }, { y1: 68, y2: 83, color: '#e8f1fa' }], deco: pict('fish', 64, 76, 8.5, '#2f6fb0', '#e8f1fa') });
    d.add(ringPull(d, 64, 62, 1.5));
  },
  'tomato-sauce'(d) {
    cyl(d, { cx: 64, y: 24, rx: 26, ry: 10, h: 80, color: '#d03a30', top: '#cdd2d6', bands: [{ y1: 24, y2: 30, color: '#cdd2d6' }, { y1: 100, y2: 106, color: '#cdd2d6' }, { y1: 52, y2: 92, color: '#fbeee0' }], deco: pict('tomato', 64, 72, 15, '#d9301f', '#3f8f2f') + R(30, 52, 70, 2, '#e8a09a') });
    d.add(ringPull(d, 64, 24, 1));
  },
  tahini(d) {
    const o = jar(d, { cx: 64, rx: 31, y: 42, h: 66, color: '#e6cf9c', deco: R(30, 40, 70, 80, '#e2c78e') + R(30, 60, 70, 40, '#8a5a2a') + R(30, 60, 70, 2.5, '#fff', 'opacity=".5"') + pict('seeds', 64, 80, 13, '#f6ecd0') });
    lid(d, { ...o, cx: 64, color: '#d9a82a' });
  },
  honey(d) {
    const dip = `<g transform="rotate(-24 64 38)"><rect x="26" y="34" width="62" height="6" rx="3" fill="#b9873f" stroke="#7a5a28" stroke-width="1"/><ellipse cx="96" cy="37" rx="12" ry="9" fill="#d9a04a" stroke="#7a5a28" stroke-width="1"/>${[-8, -3, 2, 7].map(x => `<path d="M${96 + x} 29v16" stroke="#7a5a28" stroke-width="1" opacity=".6"/>`).join('')}</g>`;
    const o = jar(d, { cx: 64, rx: 32, y: 46, h: 62, color: '#e8a021', deco: R(30, 40, 70, 80, '#eaa51f') + `<ellipse cx="50" cy="62" rx="10" ry="16" fill="#fff" opacity=".16"/>` + `<rect x="42" y="68" width="44" height="30" rx="6" fill="#fff3d0" stroke="#c98a1a" stroke-width="1.2"/>` + pict('honeycomb', 64, 83, 11, '#e8a021'), lidH: 10 });
    lid(d, { ...o, cx: 64, color: '#7a4a24', top: '#8a5a30' });
    d.add(dip);
  },
  dates(d) {
    const r = rng(9); let dd = ''; for (let i = 0; i < 26; i++) { const x = 24 + (i % 7) * 13 + (Math.floor(i / 7) % 2) * 6 + r() * 3, y = 32 + Math.floor(i / 7) * 7 + r() * 2; dd += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="7.2" ry="4.6" fill="${d.rgs([[0, '#a0643a'], [.6, '#6b3a1d'], [1, '#3f200f']], .4, .3, .7)}" stroke="#3f200f" stroke-width=".7" transform="rotate(${f(-20 + r() * 40)} ${f(x)} ${f(y)})"/><ellipse cx="${f(x - 2)}" cy="${f(y - 1.6)}" rx="2.6" ry="1" fill="#fff" opacity=".4"/>`; }
    boxUp(d, { x: 14, y: 26, w: 100, h: 50, td: 36, inset: 6, color: '#a6733a', top: '#6b4423',
      deco: R(14, 62, 100, 5, '#e2bf6a') + R(14, 96, 100, 3, '#e2bf6a') + `<circle cx="64" cy="82" r="15" fill="#f3e2b4" stroke="#e2bf6a" stroke-width="1.2"/>` + pict('palm', 64, 83, 10, '#4c8a3a', '#7a4a24'),
      topDeco: `<rect x="14" y="26" width="100" height="36" fill="#4a2a14"/>` + dd });
  },
  jam(d) {
    const o = jar(d, { cx: 64, rx: 30, y: 46, h: 60, color: '#c92a42', deco: R(30, 40, 70, 80, '#c0233d') + `<ellipse cx="50" cy="64" rx="8" ry="14" fill="#fff" opacity=".18"/>` + `<rect x="42" y="66" width="44" height="30" rx="6" fill="#fdf2e6" stroke="#d9a0a8" stroke-width="1.2"/>` + pict('strawberry', 64, 81, 11, '#d9344f', '#4c9a3a'), lidH: 9, lidW: 2 });
    const l = lid(d, { ...o, cx: 64, color: '#d9473a', top: '#fff' });
    d.add(gingham(d, ellP(64, o.lidY, o.lrx - .5, o.lry - .5), [30, o.lidY - 12, 70, 24], '#d9473a', '#fff4ec', 12), `<ellipse cx="64" cy="${o.lidY}" rx="${o.lrx - .5}" ry="${o.lry - .5}" fill="none" stroke="#a82a24" stroke-width="1.2"/>`, `<path d="M${64 - o.lrx} ${o.lidY + o.lidH - 2}Q64 ${o.lidY + o.lidH + 2 * o.lry - 2} ${64 + o.lrx} ${o.lidY + o.lidH - 2}" fill="none" stroke="#fff" stroke-opacity=".0"/>`);
  },
  halawa(d) {
    cyl(d, { cx: 64, y: 54, rx: 46, ry: 24, h: 34, color: '#f1e0b8', top: '#d6b078', bands: [{ y1: 66, y2: 90, color: '#d17a2a' }],
      deco: pict('seeds', 64, 80, 11, '#fff0cf') + R(10, 66, 108, 2, '#fff', 'opacity=".5"'),
      topDeco: `<ellipse cx="64" cy="54" rx="40" ry="19" fill="#e0c08a"/><path d="M30 54q10 -14 24 -6t24 -8t22 6M34 62q14 -8 28 -2t26 -4M42 46q12 -6 22 0" stroke="#7a4a22" stroke-width="3.2" fill="none" opacity=".75" stroke-linecap="round"/><path d="M34 52q12 -10 22 -4" stroke="#fff" stroke-width="2" fill="none" opacity=".5"/>` });
  },
  cumin(d) {
    const o = jar(d, { cx: 64, rx: 22, y: 38, h: 66, color: '#d8c08a', deco: R(40, 30, 50, 90, '#a8702a') + dots(42, 38, 46, 70, 28, 3, 1.8, ['#8a5a1c', '#b9843a']) + `<rect x="44" y="62" width="40" height="34" rx="5" fill="#f6ecd0" stroke="#c9a05a" stroke-width="1.2"/>` + pict('seeds', 64, 79, 11, '#a8702a'), lidH: 12, lidW: .5 });
    lid(d, { ...o, cx: 64, color: '#4a423a', top: '#5a5148' });
    d.add(`<ellipse cx="60" cy="${o.lidY - 1}" rx="2" ry="1" fill="#2b2118"/><ellipse cx="68" cy="${o.lidY}" rx="2" ry="1" fill="#2b2118"/>`);
  },
  'corn-flakes'(d) {
    boxUp(d, { x: 28, y: 12, w: 74, h: 96, td: 12, inset: 5, color: '#f4b02a', top: '#ffd25e',
      deco: R(28, 24, 74, 14, '#e8742a') + R(28, 96, 74, 12, '#e8742a') + `<circle cx="64" cy="62" r="25" fill="#fff0b8" stroke="#e8a02a" stroke-width="1.4"/>` + pict('bowl', 64, 62, 20, '#fff', '#f0b43c') + pict('sunflower', 40, 40, 5, '#fff4c0', '#e8742a') });
  },
  oats(d) {
    cyl(d, { cx: 64, y: 22, rx: 33, ry: 12, h: 82, color: '#4f78c4', top: '#e6dcc2', bands: [{ y1: 22, y2: 30, color: '#d9d2c0' }, { y1: 52, y2: 92, color: '#f4ead2' }, { y1: 98, y2: 104, color: '#d9d2c0' }],
      deco: pict('wheat', 64, 72, 16, '#c98a2a') + R(30, 52, 70, 2, '#4f78c4') + R(30, 90, 70, 2, '#4f78c4') });
  },
};
