// bakery, dairy, meat, frozen, drinks
import { Path, rrP, ellP, polyP, smoothP, shade, edge, mix, f, rng, pict, ball, cyl, boxUp, bottle, carton, bag, pouch, tray, ringPull, hOverlay, vOverlay, sticker, cylBodyP } from './templates.mjs';
const R = (x, y, w, h, c, o = '') => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${c}" ${o}/>`;
const DA = '#5DA9E9', ME = '#D9534F', FR = '#6FCBE6', DR = '#2FB5A6', BK = '#E0A458';

// generic doughy surface: gradient ellipse + speckles
function dough(d, cx, cy, rx, ry, color, o = {}) {
  const p = ellP(cx, cy, rx, ry, o.rot || 0); const r = rng(o.seed ?? 3); let sp = '';
  for (let i = 0; i < (o.spots ?? 14); i++) { const a = r() * 6.28, k = Math.sqrt(r()); const x = cx + Math.cos(a) * rx * .8 * k, y = cy + Math.sin(a) * ry * .8 * k; sp += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(2 + r() * 3)}" ry="${f(1.5 + r() * 2)}" fill="${shade(color, -.3)}" opacity=".45"/>`; }
  if (o.shadow !== false) d.shadow(p);
  d.add(d.shape(p, color, { a: .3, b: .28 }), d.clip(p, sp), d.wash(p, [cx - rx, cy - ry, rx * 2, ry * 2], .35), d.ao(p, [cx - rx, cy - ry, rx * 2, ry * 2], .3), d.spec(cx - rx * .4, cy - ry * .45, rx * .22, ry * .12, -30, .5));
  return p;
}
function slicePath(cx, cy, s) { // bread slice
  return new Path().M(cx - s * .5, cy + s * .55).L(cx - s * .5, cy - s * .05).C(cx - s * .72, cy - s * .12, cx - s * .66, cy - s * .62, cx - s * .3, cy - s * .58).C(cx - s * .15, cy - s * .7, cx + s * .15, cy - s * .7, cx + s * .3, cy - s * .58).C(cx + s * .66, cy - s * .62, cx + s * .72, cy - s * .12, cx + s * .5, cy - s * .05).L(cx + s * .5, cy + s * .55).Z();
}

export const A = {
  'baladi-bread'(d) {
    const loaves = [[46, 46, 1], [80, 56, 2], [56, 84, 3], [90, 90, 4]].slice(0, 3);
    for (const [x, y, s] of [[44, 44, 1], [82, 52, 2], [58, 86, 3]]) dough(d, x, y, 29, 25, ['#e3b676', '#dba868', '#e8c083'][s - 1], { seed: s * 5, spots: 22, rot: s * 20 });
    // top loaf details: pocket fold line
    d.add(d.stroke(new Path().M(40, 88).Q(56, 76, 76, 86), '#a97334', 1.4, .6));
  },
  'fino-bread'(d) {
    for (const [i, cy] of [[0, 34], [1, 62], [2, 90]]) {
      const cx = 64 + (i - 1) * 2; const p = ellP(cx, cy, 44, 13, -12);
      d.shadow(p);
      d.add(d.shape(p, '#e2a554', { dir: 'v', a: .3, b: .3 }), d.wash(p, [cx - 44, cy - 20, 88, 40], .4));
      let sl = ''; for (let k = -2; k <= 2; k++) sl += `<path d="M${cx + k * 14 - 3} ${cy - 5 - k * 3 + 1}q3 -7 6 -1l-3 7z" fill="#f4dca8" stroke="${shade('#e2a554', -.3)}" stroke-width=".8"/>`;
      d.add(d.clip(p, ''), `<g transform="rotate(-12 ${cx} ${cy})">${[-24, -8, 8, 24].map(k => `<path d="M${cx + k - 2} ${cy - 7}q4 7 0 14" stroke="#f6e0b0" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M${cx + k - 2} ${cy - 7}q4 7 0 14" stroke="${shade('#e2a554', -.3)}" stroke-width=".8" fill="none" opacity=".6" transform="translate(1 1)"/>`).join('')}</g>`);
      d.add(d.ao(p, [cx - 44, cy - 20, 88, 40], .22), d.spec(cx - 22, cy - 8, 9, 2.4, -14, .5));
    }
  },
  'toast-bread'(d) {
    d.shadow(polyP([[26, 118], [100, 118], [106, 30], [34, 20]]));
    for (const [rot, c, crust] of [[-14, '#e9cf98', '#a8672a'], [-3, '#f0d9a6', '#b0702e'], [9, '#f6e4b8', '#b9772f']]) {
      const outer = slicePath(64, 66, 80).rot(rot, 64, 108), inner = slicePath(64, 67, 68).rot(rot, 64, 108);
      d.add(d.shape(outer, crust, { a: .2, b: .3 }), d.shape(inner, c, { a: .2, b: .15, stroke: shade(c, -.3), sw: .9 }));
    }
    const o = slicePath(64, 66, 80).rot(9, 64, 108);
    const r = rng(5); let holes = ''; for (let i = 0; i < 16; i++) holes += `<circle cx="${f(44 + r() * 40)}" cy="${f(40 + r() * 50)}" r="${f(.6 + r() * 1.1)}" fill="#d2ad6a" opacity=".6"/>`;
    d.add(d.clip(slicePath(64, 67, 68).rot(9, 64, 108), holes), d.spec(52, 40, 8, 3, -20, .5));
    // bag clip
    d.add(d.rect(50, 104, 28, 9, 3, '#d9473a', { a: .3, b: .25 }), d.line(54, 108, 74, 108, '#fff', 1, .5));
  },
  croissant(d) {
    const segs = [[-60, 7, 12], [-40, 10, 16], [-20, 13, 20], [0, 15, 23], [20, 13, 20], [40, 10, 16], [60, 7, 12]]; // angle, rx(along), ry
    const cx = 64, cy = 40, R0 = 48; const items = segs.map(([a, rx, ry], i) => { const t = a * Math.PI / 180; return { x: cx + Math.sin(t) * R0 * 1.0, y: cy + Math.cos(t) * R0 * .62 + 20 + (Math.abs(a) > 40 ? -4 : 0), a, rx: ry * 1.1, ry: rx * 1.2 + 4, i }; });
    const order = [0, 6, 1, 5, 2, 4, 3];
    d.shadow(items.map(s => ellP(s.x, s.y, s.rx, s.ry, s.a * 1.0)));
    for (const k of order) { const s = items[k]; const c = k === 3 ? '#e2a14a' : ['#d9923f', '#dd9a44', '#e0a04a'][k % 3]; const p = ellP(s.x, s.y, s.rx, s.ry, s.a); d.add(d.shape(p, c, { dir: 'v', a: .3, b: .3 }), d.wash(p, [s.x - 20, s.y - 20, 40, 40], .3), d.spec(s.x - s.rx * .3, s.y - s.ry * .4, s.rx * .35, 2, s.a - 20, .55)); }
    d.add(`<g fill="#b9732c" opacity=".35">${items.map(s => `<ellipse cx="${f(s.x + 2)}" cy="${f(s.y + s.ry * .55)}" rx="${f(s.rx * .6)}" ry="1.3" transform="rotate(${s.a} ${f(s.x)} ${f(s.y)})"/>`).join('')}</g>`);
  },
  'cake-slice'(d) {
    d.shadow(ellP(64, 94, 52, 22));
    d.add(d.ell(64, 92, 52, 22, '#f4ede0', { dir: 'v', a: .2, b: .15 }), d.ell(64, 90, 38, 15, '#ffffff', { a: .1, b: .1, stroke: '#d9cdb6', sw: .8 }));
    const front = polyP([[28, 62], [100, 62], [100, 90], [28, 90]]);
    const top = polyP([[28, 62], [100, 62], [64, 32]]);
    d.add(d.shadow([front, top]) || '');
    d.add(d.shape(front, '#f0cf84', { dir: 'v', a: .15, b: .2 }),
      d.clip(front, R(28, 72, 72, 5, '#f8e8e0') + R(28, 79, 72, 3, '#d9544f', 'opacity=".85"') + R(28, 83, 72, 7, '#e9bf6d') + R(28, 60, 72, 3, '#a0603a', 'opacity=".25"')),
      hOverlay(d, front, [28, 62, 72, 28], .15, .28));
    d.add(d.shape(top, '#f8c9d4', { dir: 'v', a: .3, b: .1 }), d.stroke(new Path().M(40, 60).Q(64, 40, 88, 60), '#fff', 2, .55));
    d.add(ball(d, 64, 54, 8, '#d9344f', {}), pict('leaf', 64, 46.5, 4, '#4c9a3a'));
  },
  basbousa(d) {
    const t = tray(d, { x: 12, y: 22, w: 104, h: 84, r: 8, color: '#c8cdd2', innerColor: '#e9a93a', rim: 5 });
    let g = R(12, 22, 104, 84, '#e8a838'); let cells = '', almonds = '';
    for (let i = -6; i < 12; i++) for (let j = -2; j < 8; j++) { const x = 17 + i * 17 + (j % 2 ? 8.5 : 0), y = 27 + j * 10; }
    let lines = '';
    for (let k = -10; k < 14; k++) { lines += `M${17 + k * 15} 27l${84} ${84}M${17 + k * 15 + 84} 27l${-84} ${84}`; }
    d.add(d.clip(t.inner, R(17, 27, 94, 74, '#eab045') + `<path d="${lines}" stroke="#a9701c" stroke-width="2.2" opacity=".6" fill="none"/><path d="${lines}" stroke="#fbd98a" stroke-width=".8" opacity=".5" fill="none" transform="translate(-1 -1)"/>`
      + [[64, 64], [64, 41], [64, 87], [41, 64], [87, 64], [41, 41], [87, 41], [41, 87], [87, 87], [26, 64], [102, 64], [64, 29], [64, 99]].map(([x, y]) => pict('almond', x, y, 5.2, '#f3e3c0', '#8a5a2a')).join('')
      + `<ellipse cx="44" cy="40" rx="24" ry="9" fill="#fff" opacity=".22" transform="rotate(-18 44 40)"/>`));
  },
  'sesame-ring'(d) {
    const ring = (cx, cy, R1, r1, seed) => {
      const p = ellP(cx, cy, R1, R1).join(ellP(cx, cy, r1, r1)); const ps = p.str();
      d.shadow(p);
      const g = d.lg('#d9a04d', { a: .3, b: .3 });
      const rr = rng(seed); let sd = ''; for (let i = 0; i < 46; i++) { const a = rr() * 6.28, k = r1 + 3 + rr() * (R1 - r1 - 6); sd += `<ellipse cx="${f(cx + Math.cos(a) * k)}" cy="${f(cy + Math.sin(a) * k)}" rx="1.9" ry="1.1" fill="#fff3d0" stroke="#9a6a2a" stroke-width=".35" transform="rotate(${f(rr() * 180)} ${f(cx + Math.cos(a) * k)} ${f(cy + Math.sin(a) * k)})"/>`; }
      d.add(`<path d="${ps}" fill="${g}" fill-rule="evenodd" stroke="#8a5a22" stroke-width="1.3"/>`, d.clip(ellP(cx, cy, R1, R1), sd),
        `<circle cx="${cx}" cy="${cy}" r="${r1}" fill="none" stroke="#7a4d1e" stroke-opacity=".45" stroke-width="2.2"/>`, d.spec(cx - R1 * .5, cy - R1 * .5, 7, 2.6, -40, .55));
    };
    ring(46, 46, 30, 11, 4); ring(80, 80, 30, 11, 9);
  },
  maamoul(d) {
    for (const [x, y, s] of [[64, 38, 1], [38, 80, 2], [90, 80, 3]]) {
      const p = ellP(x, y, 24, 24); d.shadow(p);
      d.add(`<path d="${ellP(x, y + 3.5, 24, 24).str()}" fill="#b17a3a"/>`, d.shape(p, '#e0b36a', { a: .3, b: .3 }));
      let pat = ''; for (let k = 0; k < 8; k++) pat += `<path d="M${x} ${y}L${f(x + Math.cos(k * .785) * 21)} ${f(y + Math.sin(k * .785) * 21)}" stroke="#a9742f" stroke-width="1.2" opacity=".6"/>`;
      d.add(d.clip(p, pat), `<circle cx="${x}" cy="${y}" r="12" fill="none" stroke="#a9742f" stroke-width="1.2" opacity=".7"/>`, `<circle cx="${x}" cy="${y}" r="5" fill="#f4d9a0" stroke="#a9742f" stroke-width="1"/>`, d.wash(p, [x - 24, y - 24, 48, 48], .5), d.spec(x - 11, y - 12, 6, 2.4, -40, .6));
      d.add(`<ellipse cx="${x - 6}" cy="${y - 14}" rx="9" ry="4" fill="#fff" opacity=".28" transform="rotate(-30 ${x - 6} ${y - 14})"/>`);
    }
  },

  // ------------ dairy
  'milk-full'(d) {
    carton(d, { cx: 64, color: '#f4f7fb', w: 50, h: 62, roof: '#e6eef7', cap: DA, deco: R(39, 51, 50, 11, DA) + R(39, 100, 50, 13, DA) + R(39, 62, 50, 2, '#fff', 'opacity=".6"') + d_(sticker, d, 64, 81, 16, DA, 'cow', '#fff') });
  },
  'milk-skim'(d) {
    carton(d, { cx: 64, color: '#eaf6f2', w: 46, h: 68, roof: '#d6eee8', cap: '#3fa58b', deco: R(41, 45, 46, 8, '#3fa58b') + R(41, 107, 46, 6, '#3fa58b') + `<circle cx="64" cy="78" r="15" fill="#fff" stroke="#9fd6c6" stroke-width="1.4"/>` + pict('drop', 64, 78, 9.5, '#5DA9E9') + R(41, 98, 46, 2, '#3fa58b', 'opacity=".5"') + `<path d="M41 62L87 62" stroke="#3fa58b" stroke-width="1" opacity=".5"/>` });
  },
  'milk-choco'(d) {
    d.add(d.stroke(new Path().M(78, 40).L(86, 14).Q(88, 8, 96, 8).L(102, 8), '#e9e2d4', 4.4, 1), d.stroke(new Path().M(78, 40).L(86, 14).Q(88, 8, 96, 8).L(102, 8), '#d9473a', 1.6, .9, 'stroke-dasharray="3 3"'));
    boxUp(d, { x: 26, y: 38, w: 70, h: 62, td: 14, color: '#8a5230', top: '#a86a3f', deco: R(26, 52, 70, 14, '#f3e5cc') + R(26, 52, 70, 2, '#fff', 'opacity=".5"') + `<path d="M26 66q8 -6 17 0t17 0t17 0t17 0" fill="#f3e5cc"/>` + R(48, 78, 26, 18, '#5a3220') + [[56, 78], [65, 78], [48, 87], [57, 87], [66, 87]].map(([x, y]) => `<path d="M${x} ${y}v9M${x - 9} ${y + 9}h26" stroke="#8a5230" stroke-width="1"/>`).join('') });
    d.add(`<ellipse cx="66" cy="42" rx="4.5" ry="1.8" fill="#4a2a18"/>`);
  },
  yogurt(d) {
    for (const [cx, y] of [[64, 28], [37, 62], [91, 62]]) {
      cyl(d, { cx, y, rx: 19, ry: 7.5, h: 28, rxb: 14, color: '#f7f9fc', top: '#e2eaf2', bands: [{ y1: y + 10, y2: y + 24, color: DA }],
        deco: pict('drop', cx, y + 17, 5, '#fff'), topDeco: `<ellipse cx="${cx - 4}" cy="${y - 1}" rx="12" ry="4" fill="#fff" opacity=".6"/>` });
      d.add(`<path d="M${cx + 10} ${y + 2}q4 -1 5 -4" stroke="#aebdcb" stroke-width="2.2" fill="none" stroke-linecap="round"/>`);
    }
  },
  'yogurt-fruit'(d) {
    cyl(d, { cx: 64, y: 38, rx: 34, ry: 13, h: 50, rxb: 25, color: '#f9dde5', top: '#fbe8ee',
      bands: [{ y1: 52, y2: 82, color: '#e0587f' }], deco: R(30, 52, 70, 3, '#f9b8c9', 'opacity=".6"') + pict('strawberry', 64, 66, 10, '#fff', '#7ccf63'),
      topDeco: `<ellipse cx="64" cy="38" rx="25" ry="8.5" fill="#f4b5c6"/>` + pict('strawberry', 52, 37, 6, '#d9344f', '#4c9a3a') + pict('strawberry', 74, 38, 5, '#d9344f', '#4c9a3a') + `<ellipse cx="54" cy="33" rx="12" ry="2.4" fill="#fff" opacity=".4"/>` });
    d.add(`<g transform="rotate(-24 94 30)"><rect x="82" y="26" width="30" height="5" rx="2.5" fill="#d8dde2" stroke="#8d949b" stroke-width=".9"/><ellipse cx="116" cy="28.5" rx="7" ry="4.5" fill="#e6eaee" stroke="#8d949b" stroke-width=".9"/></g>`);
  },
  'white-cheese'(d) {
    let cubes = ''; for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) cubes += `<rect x="${24 + i * 20}" y="${27 + j * 12}" width="18" height="11" rx="2" fill="#fffdf7" stroke="#ddd5c0" stroke-width=".8"/>`;
    boxUp(d, { x: 18, y: 28, w: 92, h: 38, td: 32, inset: 6, color: '#eef3f8', top: '#dbe9f6',
      deco: R(18, 60, 92, 10, DA) + R(18, 72, 92, 2, '#fff', 'opacity=".6"') + pict('cheese', 64, 87, 11, '#fff7de', '#e4cf8c') + `<path d="M18 94h92" stroke="${DA}" stroke-width="3"/>`,
      topDeco: R(18, 28, 92, 32, '#b9d7f1') + cubes + `<path d="M24 29L60 29L40 58L24 58Z" fill="#fff" opacity=".28"/>` });
    d.add(`<path d="M22 31H106" stroke="#fff" stroke-width="1.2" opacity=".6"/>`);
  },
  'rumi-cheese'(d) {
    const cx = 64, y = 54;
    cyl(d, { cx, y, rx: 46, ry: 26, h: 30, color: '#d6902f', top: '#f3cd68', rim: false,
      deco: R(cx - 50, y + 4, 100, 3, '#f7d980', 'opacity=".4"') + R(cx - 50, y + 20, 100, 3, '#b0702a', 'opacity=".35"'),
      topDeco: `<path d="M64 54L110 70L110 90L64 90Z" fill="#fff" opacity="0"/>` + `<path d="M64 54L102 76L84 84Z" fill="#fff8cd"/>` + [[78, 70], [86, 76], [72, 73]].map(([a, b]) => `<circle cx="${a}" cy="${b}" r="1.8" fill="#d9a43a"/>`).join('') + `<ellipse cx="46" cy="42" rx="18" ry="6" fill="#fff" opacity=".35" transform="rotate(-14 46 42)"/>` });
    d.add(`<path d="M64 54L103 77L84 86L66 62Z" fill="none" stroke="#a3631f" stroke-width="1.2" opacity=".5"/>`);
    // wedge cut face
    const w = polyP([[64, 54], [101, 76], [101, 91], [66, 69]]); d.add(d.shape(w, '#f7dc7c', { dir: 'v', a: .2, b: .15, stroke: '#a3631f' }), `<circle cx="78" cy="72" r="1.8" fill="#d9a43a"/><circle cx="90" cy="80" r="2.2" fill="#d9a43a"/><circle cx="71" cy="66" r="1.3" fill="#d9a43a"/>`);
  },
  butter(d) {
    boxUp(d, { x: 14, y: 30, w: 100, h: 36, td: 36, inset: 5, color: '#f4d35e', top: '#fff0b3', r: 4,
      deco: R(14, 66, 100, 36, '#f4d35e') + R(14, 74, 100, 7, '#e6b92f', 'opacity=".7"') + R(14, 90, 100, 3, '#fff', 'opacity=".35"') + `<circle cx="38" cy="86" r="13" fill="#fff" stroke="#e6b92f" stroke-width="1.2"/>` + pict('cow', 38, 86, 8.4, '#5DA9E9', '#f4d35e'),
      topDeco: R(14, 30, 100, 36, '#ffe58e') + `<path d="M14 30H70L58 66H14Z" fill="#f2ecdb"/>` + `<path d="M14 40H64M14 50H61M14 58H58" stroke="${DA}" stroke-width="2" opacity=".5"/>` + `<path d="M70 30L58 66" stroke="#c9bfa0" stroke-width="1.2"/><path d="M80 32L74 62M94 32L90 62" stroke="#e9c75c" stroke-width="1.2" opacity=".6"/>` });
    d.add(`<path d="M18 33H64" stroke="#fff" stroke-width="1.2" opacity=".7"/>`);
  },
  eggs(d) {
    const t = tray(d, { x: 12, y: 18, w: 104, h: 92, r: 8, color: '#bfae8d', innerColor: '#cdbd9c', rim: 5, lip: 4 });
    let g = ''; const cols = 4, rows = 3, cw = 94 / cols, rh = 80 / rows; const r = rng(2);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = 17 + cw * (i + .5), y = 23 + rh * (j + .5), brown = (i * 2 + j) % 3 === 1;
      g += `<ellipse cx="${f(x)}" cy="${f(y + 1.5)}" rx="11" ry="10.5" fill="#8a7a5a" opacity=".5"/>`;
      const c = brown ? '#d9a56b' : '#f8efe0'; const gg = d.rgs([[0, shade(c, .4)], [.55, c], [1, shade(c, -.3)]], .5, .5, .65, .35, .3);
      g += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="8.6" ry="10.4" fill="${gg}" stroke="${edge(c)}" stroke-width="1" transform="rotate(${f(-14 + r() * 28)} ${f(x)} ${f(y)})"/><ellipse cx="${f(x - 3)}" cy="${f(y - 4)}" rx="2" ry="3.2" fill="#fff" opacity=".65" transform="rotate(25 ${f(x - 3)} ${f(y - 4)})"/>`;
    }
    d.add(d.clip(t.inner, g));
    d.add(`<rect x="12" y="104" width="104" height="6" rx="2" fill="${DA}" opacity=".85"/>`);
  },
  'cheese-triangles'(d) {
    const cx = 64, y = 56;
    let sec = ''; const rx = 41, ry = 19;
    for (let k = 0; k < 6; k++) {
      const a0 = k * 60 * Math.PI / 180 - .3, a1 = (k * 60 + 58) * Math.PI / 180 - .3;
      const p = (a, r = 1) => `${f(cx + Math.cos(a) * rx * r)} ${f(y + Math.sin(a) * ry * r)}`;
      const open = k === 0; sec += `<path d="M${cx} ${y}L${p(a0)}L${p(a1)}Z" fill="${open ? '#fbf2d2' : (k % 2 ? '#c2dcf2' : '#dfeefa')}" stroke="${open ? '#d9c88a' : '#7fa9cc'}" stroke-width="1"/>`;
      if (!open) sec += `<path d="M${cx} ${y}L${p((a0 + a1) / 2, .8)}" stroke="#fff" stroke-width="1.2" opacity=".8"/>`;
    }
    cyl(d, { cx, y, rx, ry, h: 26, color: '#4f98dc', top: '#e5eef6', bands: [{ y1: y + 8, y2: y + 20, color: '#f2f6fa' }], deco: pict('cow', cx - 20, y + 15, 5, DA, '#f2f6fa') + pict('cow', cx + 20, y + 15, 5, DA, '#f2f6fa') + pict('cow', cx, y + 17, 6, DA, '#f2f6fa'), topDeco: sec + `<circle cx="${cx}" cy="${y}" r="3" fill="#fff" stroke="#8aa9c4"/>` });
  },

  // ------------ meat
  chicken(d) {
    tray(d, { x: 12, y: 20, w: 104, h: 88, r: 9, color: '#f0e9db', innerColor: '#f7f2e8', film: true, deco: (() => {
      const sk = '#f1bf8c', hi = '#f9d9b0';
      const leg = (x, y, rot) => `<g transform="rotate(${rot} ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="9" ry="17" fill="${sk}" stroke="#b97c4a" stroke-width="1.2"/><rect x="${x - 2.5}" y="${y + 13}" width="5" height="12" rx="2" fill="#f7ead2" stroke="#c9ab80" stroke-width=".9"/><circle cx="${x - 2}" cy="${y + 26}" r="3" fill="#f7ead2" stroke="#c9ab80" stroke-width=".9"/><circle cx="${x + 2.5}" cy="${y + 26}" r="3" fill="#f7ead2" stroke="#c9ab80" stroke-width=".9"/></g>`;
      return leg(46, 74, 20) + leg(82, 74, -20) + `<ellipse cx="64" cy="54" rx="29" ry="26" fill="${sk}" stroke="#b97c4a" stroke-width="1.3"/>` + `<ellipse cx="55" cy="44" rx="14" ry="10" fill="${hi}" opacity=".7"/>` + `<path d="M36 50q-12 -6 -14 6q4 6 14 0z M92 50q12 -6 14 6q-4 6 -14 0z" fill="${sk}" stroke="#b97c4a" stroke-width="1.1"/>` + [[50, 58], [64, 62], [76, 52], [58, 70], [70, 72], [46, 40]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1" fill="#c78b55" opacity=".7"/>`).join('');
    })() });
    d.add(sticker(d, 100, 94, 9, ME, 'drumstick', '#fff'));
  },
  beef(d) {
    tray(d, { x: 12, y: 20, w: 104, h: 88, r: 9, color: '#f0e9db', innerColor: '#f7f2e8', film: true, deco: (() => {
      const st = (x, y, s, rot, c) => `<g transform="rotate(${rot} ${x} ${y}) translate(${x} ${y}) scale(${s})"><path d="M-28 4C-30 -16 -8 -24 12 -21C32 -18 34 2 26 14C16 26 -22 24 -28 4Z" fill="#f3d9c6" stroke="#caa48a" stroke-width="1.2"/><path d="M-24 4C-25 -12 -6 -19 11 -17C27 -14 29 2 22 11C13 21 -19 19 -24 4Z" fill="${c}"/><path d="M-14 -8C-4 -12 8 -8 16 -2M-12 6C-2 0 10 4 18 8M-4 -14C2 -8 6 0 4 8" stroke="#f7dcd0" stroke-width="1.4" fill="none" opacity=".85" stroke-linecap="round"/><ellipse cx="-8" cy="-9" rx="9" ry="3" fill="#fff" opacity=".28" transform="rotate(-15)"/></g>`;
      return st(42, 46, 1, -12, '#b0272f') + st(78, 76, 1.05, 10, '#a82230');
    })() });
    d.add(sticker(d, 100, 36, 9, ME, 'steak', '#fff'));
  },
  'minced-meat'(d) {
    tray(d, { x: 12, y: 20, w: 104, h: 88, r: 9, color: '#f0e9db', innerColor: '#f7f2e8', film: true, deco: (() => {
      const r = rng(11); let s = `<ellipse cx="64" cy="66" rx="40" ry="30" fill="#8e2a30"/>`;
      for (let i = 0; i < 90; i++) { const a = r() * 6.28, k = Math.sqrt(r()); const x = 64 + Math.cos(a) * 36 * k, y = 66 + Math.sin(a) * 26 * k; const c = ['#b7343b', '#c9474c', '#a02a31', '#d65b5a'][i % 4]; s += `<path d="M${f(x - 3)} ${f(y)}q3 ${f(-3 + r() * 6)} 6 ${f(-1 + r() * 2)}" stroke="${c}" stroke-width="${f(2.6 + r() * 1.6)}" stroke-linecap="round" fill="none"/>`; }
      return s + `<ellipse cx="52" cy="52" rx="14" ry="6" fill="#fff" opacity=".22" transform="rotate(-20 52 52)"/>`;
    })() });
    d.add(sticker(d, 100, 94, 9, ME, 'bone', '#fff'));
  },
  fish(d) {
    tray(d, { x: 12, y: 20, w: 104, h: 88, r: 9, color: '#e6eef0', innerColor: '#eef4f5', film: true, deco: (() => {
      let sc = ''; for (let j = 0; j < 4; j++) for (let i = 0; i < 7; i++) sc += `<path d="M${32 + i * 8 + (j % 2) * 4} ${55 + j * 7}q4 4 0 8" stroke="#6f8791" stroke-width="1" fill="none" opacity=".5"/>`;
      return `<path d="M96 64L114 46L112 82Z" fill="#8fa8b2" stroke="#5d7680" stroke-width="1.2"/><path d="M52 44Q66 30 78 46Z" fill="#8fa8b2" stroke="#5d7680" stroke-width="1.1"/><path d="M52 84Q68 98 80 82Z" fill="#8fa8b2" stroke="#5d7680" stroke-width="1.1"/>` +
        `<path d="M14 64C26 40 60 38 98 62C60 90 28 88 14 64Z" fill="${d.lgs([[0, '#cfdde2'], [.5, '#9fb6bf'], [1, '#6f8c97']], 0, 0, 0, 1)}" stroke="#5d7680" stroke-width="1.3"/>` + d.clip(ellP(0, 0, 0), '') + `<path d="M14 64C26 40 60 38 98 62" fill="none" stroke="#fff" stroke-width="2" opacity=".4"/>` + sc + `<circle cx="30" cy="60" r="4" fill="#fff" stroke="#3a4a50" stroke-width="1"/><circle cx="30" cy="60" r="2" fill="#2a3338"/><path d="M42 54Q38 64 42 74" stroke="#5d7680" stroke-width="1.4" fill="none"/>`;
    })() });
    d.add(sticker(d, 22, 94, 9, '#4a8fc7', 'drop', '#fff'));
  },
  liver(d) {
    tray(d, { x: 12, y: 20, w: 104, h: 88, r: 9, color: '#f0e9db', innerColor: '#f7f2e8', film: true, deco: (() => {
      const g = d.lgs([[0, '#a8473f'], [.5, '#7a2a2c'], [1, '#4f1a20']], 0, 0, 1, 1);
      return `<path d="M20 70C16 46 40 34 66 38C92 40 108 52 104 70C100 90 70 92 52 86C40 98 24 90 20 70Z" fill="${g}" stroke="#3f161b" stroke-width="1.3"/><path d="M34 60C44 50 62 50 78 56M40 72C54 66 72 68 88 74" stroke="#c97a70" stroke-width="1.6" fill="none" opacity=".5" stroke-linecap="round"/><ellipse cx="50" cy="48" rx="20" ry="6" fill="#fff" opacity=".28" transform="rotate(-12 50 48)"/><path d="M66 38C70 30 78 28 82 32" stroke="#6b3a3a" stroke-width="3" fill="none" opacity=".7"/>`;
    })() });
    d.add(sticker(d, 100, 94, 9, ME, 'heart', '#fff'));
  },

  // ------------ frozen
  'ice-cream'(d) {
    cyl(d, { cx: 64, y: 38, rx: 38, ry: 15, h: 50, rxb: 31, color: '#f59ab8', top: '#fff2de', bands: [{ y1: 52, y2: 80, color: '#fff3e2' }], deco: pict('cone', 64, 66, 11, '#f59ab8', '#d9a050') + R(20, 52, 90, 2, '#e0587f', 'opacity=".55"') + R(20, 78, 90, 2, '#e0587f', 'opacity=".55"'),
      topDeco: `<ellipse cx="64" cy="38" rx="30" ry="11" fill="#fbd6df"/><path d="M40 40q8 -14 24 -10q14 -8 24 6q-8 12 -24 10q-14 4 -24 -6z" fill="#f59ab8" stroke="#c9648a" stroke-width="1"/><path d="M48 38q10 -8 20 -2" stroke="#fff" stroke-width="2" fill="none" opacity=".7"/>` });
    d.add(pict('snow', 98, 28, 7, '#fff'));
  },
  molokhia(d) {
    for (const [x, y] of [[14, 22], [46, 62]]) boxUp(d, { x, y, w: 66, h: 32, td: 16, color: '#2d7a3e', top: '#4a9a58', inset: 5,
      deco: R(x, y + 16, 66, 32, '#2d7a3e') + `<circle cx="${x + 33}" cy="${y + 33}" r="13" fill="#e8f5d9"/>` + pict('leaf', x + 33, y + 33, 9, '#3f9a45', '#fff') + pict('snow', x + 10, y + 34, 5.5, '#d6f1fa') + pict('snow', x + 56, y + 34, 5.5, '#d6f1fa') + `<path d="M${x} ${y + 18}h66" stroke="#fff" stroke-width="1" opacity=".4"/>`,
      topDeco: `<path d="M${x + 6} ${y + 4}l8 3l4 -4l6 5l8 -3l7 4" stroke="#e9fbff" stroke-width="2" fill="none" opacity=".8"/>` });
  },
  'frozen-peas'(d) {
    bag(d, { cx: 64, cy: 66, w: 70, h: 94, color: '#58b35a', crimpColor: '#8fd28b', bulge: 4, deco: R(30, 28, 70, 70, '#6ec06a', 'opacity=".4"') + `<ellipse cx="64" cy="66" rx="25" ry="24" fill="#f4faf0" stroke="#b6dca8" stroke-width="1.2"/>` + pict('pea', 64, 66, 17, '#3c9a46', '#bfe88c') + pict('snow', 40, 36, 6, '#fff') + pict('snow', 88, 96, 6, '#fff') + R(28, 94, 74, 5, '#e8f6fb', 'opacity=".5"') });
  },
  'french-fries'(d) {
    const pre = [[48, 28, -8], [60, 20, 5], [72, 26, 10], [82, 33, -6], [40, 36, 14], [66, 33, -3]];
    boxUp(d, { x: 22, y: 42, w: 84, h: 58, td: 14, color: '#d9473a', top: '#8a1f1a', inset: 5, deco: R(22, 56, 84, 12, '#f6c944') + `<path d="M22 68q10 -6 21 0t21 0t21 0t21 0V76H22z" fill="#f6c944"/>` + pict('fries', 64, 82, 12, '#f6c944', '#fff') + pict('snow', 34, 90, 5, '#fff') + pict('snow', 94, 90, 5, '#fff'), topDeco: R(22, 42, 84, 14, '#8a1f1a') });
    for (const [x, y, r] of pre) d.add(`<g transform="rotate(${r} ${x} ${y + 12})"><rect x="${x - 3.2}" y="${y}" width="6.4" height="26" rx="2" fill="#f7cf55" stroke="#c9902a" stroke-width="1"/><rect x="${x - 2}" y="${y + 1}" width="1.8" height="22" fill="#fff" opacity=".4"/></g>`);
    d.add(d.line(24, 46, 104, 46, '#e55d4e', 1, .8));
  },
  'frozen-okra'(d) {
    pouch(d, { cx: 64, y: 14, w: 66, h: 98, color: '#2f8f6b', seal: '#7fcfae', deco: R(31, 24, 66, 90, '#2f8f6b') + `<rect x="42" y="44" width="44" height="46" rx="9" fill="#d6efe2" stroke="#8fcab0" stroke-width="1.2"/>` + [[-14, 0], [0, 4], [14, 0]].map(([dx, dy], i) => pict('okra', 64 + dx, 68 + dy, 13, '#5fb54a', '#2d5c1f')).join('') + `<path d="M42 44h44v8h-44z" fill="#fff" opacity=".35"/>` + pict('snow', 64, 100, 6.5, '#e8f6fb') });
  },

  // ------------ drinks
  'water-pack'(d) {
    const bt = (cx, y0) => bottle(d, { cx, y: y0, shadow: false, color: '#cfe9f5', neckW: 10, bodyW: 30, capH: 7, capW: 13, neckH: 6, shoulderH: 12, bodyH: 46, cap: '#2f7fd0', petBase: true,
      deco: R(cx - 16, y0 + 28, 32, 22, '#2f7fd0') + R(cx - 16, y0 + 26, 32, 2, '#fff', 'opacity=".6"') + pict('drop', cx, y0 + 39, 7, '#fff') });
    d.shadow(rrP(14, 30, 100, 82, 10));
    bt(49, 22); bt(79, 22);
    bt(34, 36); bt(64, 36); bt(94, 36);
    const wp = rrP(12, 52, 104, 60, 9);
    d.add(`<path d="${wp.str()}" fill="${d.lgs([[0, '#fff', .4], [.4, '#fff', .12], [1, '#bfe6f5', .22]], 0, 0, 1, 1)}" stroke="#fff" stroke-opacity=".7" stroke-width="1.4"/>`, d.glint(new Path().M(18, 60).Q(40, 54, 70, 55), 2, .7), d.glint(new Path().M(100, 108).Q(110, 100, 112, 84), 1.4, .45));
    d.add(`<path d="M44 34Q64 12 84 34" fill="none" stroke="#2f7fd0" stroke-width="5" stroke-linecap="round" opacity=".0"/>`);
  },
  'orange-juice'(d) {
    carton(d, { cx: 64, color: '#fbf3e4', w: 52, h: 64, roof: '#f6c78a', cap: '#f08a24', deco: R(38, 50, 52, 13, '#f08a24') + R(38, 98, 52, 14, '#f5a43e') + `<circle cx="64" cy="81" r="17" fill="#fff" opacity=".0"/>` + pict('orange', 64, 80, 15, '#f28a22', '#ffd27a') + `<path d="M38 63h52" stroke="#fff" stroke-width="1.5" opacity=".6"/>` });
  },
  'mango-juice'(d) {
    bottle(d, { cx: 64, y: 12, color: '#f3bf3d', neckW: 12, bodyW: 46, capH: 9, capW: 18, neckH: 8, shoulderH: 18, bodyH: 54, cap: '#3f8f2f', petBase: true,
      deco: R(30, 64, 68, 30, '#3f8f2f') + `<path d="M30 64q10 -5 19 0t19 0t19 0t11 0" fill="#fff" opacity=".0"/>` + R(30, 62, 68, 2.5, '#fff', 'opacity=".6"') + pict('mango', 64, 80, 12, '#f5a52a', '#7ccf4a') });
  },
  cola(d) {
    bottle(d, { cx: 64, y: 10, color: '#5a2e22', neckW: 11, bodyW: 40, capH: 9, capW: 16, neckH: 10, shoulderH: 22, bodyH: 54, cap: '#d63a3a', petBase: true, sq: .6,
      deco: R(24, 60, 80, 32, '#d63a3a') + `<path d="M24 60q10 8 20 0t20 0t20 0t20 0V64q-10 8 -20 0t-20 0t-20 0t-20 0z" fill="#fff" opacity="0"/>` + `<path d="M24 74q20 -12 40 0t40 0" stroke="#fff" stroke-width="6" fill="none"/>` + R(24, 58, 80, 2.5, '#fff', 'opacity=".5"') });
  },
  'energy-drink'(d) {
    cyl(d, { cx: 64, y: 22, rx: 21, ry: 8, h: 82, color: '#2e3d4a', top: '#c8ced2', bands: [{ y1: 22, y2: 34, color: '#c9d0d4' }, { y1: 44, y2: 98, color: '#f2c230' }, { y1: 98, y2: 104, color: '#c9d0d4' }],
      deco: `<path d="M20 52L108 48V60L20 64Z" fill="#2fb5a6" opacity="0"/>` + pict('bolt', 64, 71, 17, '#2e3d4a') + R(40, 44, 48, 3, '#2fb5a6') + R(40, 95, 48, 3, '#2fb5a6'),
      topDeco: '' });
    d.add(ringPull(d, 64, 22, 1.05));
  },
  'sparkling-water'(d) {
    bottle(d, { cx: 64, y: 8, color: '#8bd8cb', glass: true, neckW: 11, bodyW: 36, capH: 6, capW: 15, neckH: 14, shoulderH: 24, bodyH: 56, cap: '#b9c0c4', liquid: '#c4efe7', sq: .4,
      deco: `<ellipse cx="64" cy="84" rx="15" ry="19" fill="#fff" opacity=".92" stroke="#58b5a6" stroke-width="1.2"/>` + pict('bubble', 64, 84, 11, '#2fb5a6') + [[44, 66], [84, 62], [48, 100], [80, 98]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#fff" opacity=".7"/>`).join('') });
  },
  'iced-tea'(d) {
    bottle(d, { cx: 64, y: 22, color: '#e0993f', neckW: 16, bodyW: 52, capH: 9, capW: 21, neckH: 6, shoulderH: 16, bodyH: 54, cap: '#d9662b', petBase: true, base: .16,
      deco: R(10, 66, 108, 28, '#fbe3c4') + R(10, 66, 108, 2, '#fff', 'opacity=".6"') + pict('peach', 64, 80, 11, '#f08a5d', '#4c9a3a') + R(10, 94, 108, 2.5, '#d9662b', 'opacity=".7"') });
  },
  hibiscus(d) {
    d.add(d.stroke(new Path().M(82, 48).C(112, 40, 112, 84, 84, 82), '#a8b4bd', 6, .0));
    const hdl = new Path().M(84, 52).C(116, 44, 118, 90, 84, 88);
    d.add(d.stroke(hdl, shade('#8e1f45', -.2), 8, 1), d.stroke(hdl, '#b8305d', 5.2, 1), d.stroke(hdl, '#fff', 1.4, .4, 'transform="translate(-1 -1)"'));
    bottle(d, { cx: 60, y: 10, color: '#9b2350', glass: true, neckW: 14, bodyW: 48, capH: 8, capW: 19, neckH: 8, shoulderH: 18, bodyH: 62, cap: '#e8d9b0', liquid: '#8e1f45', petBase: false,
      deco: `<ellipse cx="60" cy="76" rx="19" ry="20" fill="#fbf1e2" stroke="#d9b88a" stroke-width="1.2"/>` + pict('hibiscus', 60, 76, 12, '#d9344f', '#f5d46a') });
  },
};
function d_(fn, d, ...a) { return fn(d, ...a); }
