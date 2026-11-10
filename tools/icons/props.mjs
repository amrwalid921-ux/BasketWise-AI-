import { Doc, Path, rrP, ellP, polyP, smoothP, shade, edge, mix, f, rng } from '../svgkit.mjs';
import { pict, ball, cyl, boxUp, hOverlay, vOverlay, netLines } from './templates.mjs';
import { cart } from './cart.mjs';
const T = 72;
const mk = (tw, th) => new Doc(tw * T, th * T, { sdx: 3.2, sdy: 3.8, sblur: 1.6, sop: .28 });
const R = (x, y, w, h, c, o = '') => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${c}" ${o}/>`;

export const PROPS = {
  'shopping-cart': { w: 1, h: 1, draw() { const d = mk(1, 1); cart(d, { cx: 36, cy: 30, W: 42, H: 38, rot: 0, hd: 13 }); return d; } },
  'cart-park': { w: 3, h: 2, draw() {
    const d = mk(3, 2);
    d.add(`<rect x="5" y="5" width="206" height="134" rx="8" fill="#b9b2a2" opacity=".18"/><rect x="5" y="5" width="206" height="134" rx="8" fill="none" stroke="#f2c230" stroke-width="3.6"/><rect x="5" y="5" width="206" height="134" rx="8" fill="none" stroke="#fff3b0" stroke-width="1" opacity=".6" transform="translate(-.6 -.6)"/>`);
    d.add(`<path d="M6 72H210" stroke="#f2c230" stroke-width="2" stroke-dasharray="8 6" opacity=".8"/>`);
    for (const cy of [38, 106]) for (let i = 0; i < 5; i++) cart(d, { cx: 164 - i * 24 - (i === 0 ? 0 : 0), cy, W: 36, H: 34, rot: 90, hd: 12, sdx: 2, sdy: 2.4 });
    return d; } },
  'basket-stack': { w: 1, h: 1, draw() {
    const d = mk(1, 1);
    for (let i = 0; i < 4; i++) {
      const x = 12 + i * 2, y = 24 - i * 4 + 8, w = 42, h = 30; const p = rrP(x, y - 8 + 0, w, h, 6);
      const c = ['#c53a34', '#cf403a', '#d9473a', '#e0503f'][i];
      if (i === 0) d.shadow(rrP(12, 24, 42, 30, 6));
      d.add(`<path d="${p.move(0, 2).str()}" fill="${shade(c, -.4)}"/>`, d.shape(p, c, { dir: 'tl', a: .28, b: .22 }), `<path d="${rrP(x + 3.2, y - 8 + 3.2, w - 6.4, h - 6.4, 3.4).str()}" fill="${shade(c, -.22)}" stroke="${edge(c)}" stroke-width=".8"/>`);
      let holes = ''; for (let k = 0; k < 6; k++) holes += `<rect x="${f(x + 4 + k * 6)}" y="${f(y - 8 + h - 3)}" width="3.6" height="1.6" rx=".8" fill="#2b2118" opacity=".35"/>`;
      d.add(holes);
      // folding handle bars at ends
      d.add(d.rect(x - 4.5, y - 8 + h / 2 - 6, 5.5, 12, 2.2, '#b3b8bc', { a: .3, b: .3 }), d.rect(x + w - 1, y - 8 + h / 2 - 6, 5.5, 12, 2.2, '#b3b8bc', { a: .3, b: .3 }));
    }
    return d; } },
  plant: { w: 1, h: 1, draw() {
    const d = mk(1, 1); d.shadow(ellP(36, 38, 27, 27));
    d.add(`<circle cx="36" cy="38.5" r="26" fill="#cfc9bc" stroke="#8d8478" stroke-width="1.2"/>`, d.circ(36, 36, 26, '#faf8f2', { a: .1, b: .2, stroke: '#a89f90' }), d.circ(36, 36, 21, '#5a4030', { dir: 'br', stroke: '#8d8478', sw: 1 }));
    const r = rng(21);
    const leaf = (x, y, ang, len, wd, c) => { const g = `translate(${f(x)} ${f(y)}) rotate(${f(ang)})`; return `<g transform="${g}"><path d="M0 0C${wd} ${-len * .25} ${wd} ${-len * .75} 0 ${-len}C${-wd} ${-len * .75} ${-wd} ${-len * .25} 0 0Z" fill="${d.lgs([[0, shade(c, .3)], [1, shade(c, -.25)]], 0, 0, 1, 1)}" stroke="${edge(c)}" stroke-width=".8"/><path d="M0 -2L0 ${-len * .85}" stroke="${shade(c, .35)}" stroke-width=".8" opacity=".8"/></g>`; };
    let s = ''; [[24, 26, '#2f7a3a', 14], [18, 22, '#3f9a45', 12], [12, 18, '#58b350', 10], [6, 14, '#7ccf5a', 8]].forEach(([len, n, c, wd], li) => { const k = 8 + li * 2; for (let i = 0; i < k; i++) s += leaf(36, 36, i * 360 / k + li * 17 + r() * 8, len + r() * 3, wd * .34 + 1.5, c); });
    d.add(s, d.spec(30, 26, 5, 2.2, -40, .35));
    return d; } },
  pillar: { w: 1, h: 1, draw() {
    const d = mk(1, 1); const o = rrP(9, 9, 54, 54, 4);
    d.shadow(o);
    d.add(`<path d="${o.move(0, 3).str()}" fill="#9d9a92" stroke="#6f6c64" stroke-width="1.2"/>`, d.shape(o, '#dcd9d0', { dir: 'tl', a: .3, b: .2, stroke: '#7c786f' }),
      `<path d="${rrP(12.5, 12.5, 47, 47, 2.5).str()}" fill="none" stroke="#d9473a" stroke-width="3.6" opacity=".92"/><path d="${rrP(12.5, 12.5, 47, 47, 2.5).str()}" fill="none" stroke="#fff" stroke-width="1" stroke-dasharray="6 6" opacity=".75"/>`,
      d.shape(rrP(17, 17, 38, 38, 2), '#eceae3', { dir: 'tl', a: .35, b: .12, stroke: '#a8a498', sw: 1 }), `<path d="M20 22H50M20 26H40" stroke="#fff" stroke-width="1.4" opacity=".7"/>`, d.ao(o, [9, 9, 54, 54], .2));
    let sp = ''; const r = rng(2); for (let i = 0; i < 18; i++) sp += `<circle cx="${f(20 + r() * 32)}" cy="${f(20 + r() * 32)}" r="${f(.5 + r() * .7)}" fill="#a8a498" opacity=".5"/>`;
    d.add(sp);
    return d; } },
  'pallet-water': { w: 4, h: 2, draw() {
    const d = mk(4, 2);
    const base = rrP(8, 8, 272, 128, 5); d.shadow(base);
    d.add(`<path d="${base.move(0, 3).str()}" fill="#7a5a30"/>`, d.shape(base, '#c99a5e', { dir: 'tl', a: .25, b: .22 }));
    let pl = ''; for (let k = 0; k < 9; k++) pl += `<path d="M${8 + k * 30.2} 8V136" stroke="#8a6232" stroke-width="1.2" opacity=".7"/>`; d.add(pl);
    const packs = []; for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) packs.push([16 + i * 66, 16 + j * 60, 60, 54]);
    for (const [x, y, w, h] of packs) {
      const pk = rrP(x, y, w, h, 6); d.add(`<path d="${pk.move(0, 3).str()}" fill="#9cc4d9" stroke="#5d8ca6" stroke-width="1"/>`, d.shape(pk, '#d9ecf5', { dir: 'tl', a: .3, b: .15, stroke: '#7fb0c9' }));
      for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) { const cx = x + 11 + a * 19, cy = y + 14 + b * 26; d.add(`<circle cx="${cx + .8}" cy="${cy + 1.4}" r="8" fill="#5d8ca6" opacity=".45"/>`, ball(d, cx, cy, 8, '#e8f4fa', { hl: false, sw: .8 }), ball(d, cx, cy, 5.2, '#2f7fd0', { hlop: .7 })); }
      d.add(`<path d="${pk.str()}" fill="${d.lgs([[0, '#fff', .42], [.4, '#fff', .05], [.7, '#cfe8f5', .12], [1, '#bfe0ee', .2]], 0, 0, 1, 1)}" stroke="#fff" stroke-opacity=".7" stroke-width="1.2"/>`, d.glint(new Path().M(x + 6, y + 8).Q(x + 12, y + 3, x + 30, y + 3.5), 1.6, .8));
    }
    // blue promo board across the centre
    const pb = rrP(104, 52, 80, 40, 8); d.shadow(pb);
    d.add(d.shape(pb, '#2f7fd0', { dir: 'tl', a: .3, b: .25, stroke: '#1d4f8a', sw: 1.6 }), `<path d="${rrP(108, 56, 72, 32, 5).str()}" fill="none" stroke="#fff" stroke-width="1.4" opacity=".7" stroke-dasharray="5 3"/>`,
      pict('drop', 130, 72, 12, '#fff', '#9fd0f5'), pict('star', 160, 66, 7, '#ffd84a'), `<path d="M146 78h24" stroke="#ffd84a" stroke-width="3" stroke-linecap="round"/>`, d.spec(116, 59, 8, 2.2, -10, .5));
    return d; } },
  'promo-stand': { w: 4, h: 2, draw() {
    const d = mk(4, 2);
    const base = rrP(8, 8, 272, 128, 10); d.shadow(base);
    d.add(`<path d="${base.move(0, 4).str()}" fill="#a82a24" stroke="#701a16" stroke-width="1.2"/>`, d.shape(base, '#d9473a', { dir: 'tl', a: .25, b: .2 }));
    let st = ''; for (let k = -6; k < 24; k++) st += `<path d="M${8 + k * 14} 8l14 0l-14 14z" fill="#fff" opacity="0"/>`; 
    d.add(d.clip(base, Array.from({ length: 40 }, (_, k) => `<path d="M${k * 16 - 20} 8l8 0l-16 128h-8z" fill="#fff" opacity=".9"/>`).join('') ));
    const inner = rrP(18, 18, 252, 108, 6); d.add(d.shape(inner, '#f5eee0', { dir: 'tl', a: .1, b: .15, stroke: '#8a2a24', sw: 1.3 }), d.clip(inner, `<path d="M18 18H270V24H24V126H18Z" fill="#2b2118" opacity=".18"/>`));
    const cols = ['#f2c230', '#2fb5a6', '#f26ca7', '#5da9e9', '#7c6fd6', '#f28a1e', '#6bbf59', '#e0485f'];
    const pics = ['star', 'candy', 'heart', 'drop', 'bolt', 'flame', 'leaf', 'seeds'];
    const dr = (x, y, w, h, c, p, type) => {
      if (type === 'box') boxUp(d, { x, y, w, h, td: 9, inset: 3, color: c, shadow: true, deco: R(x, y + 9, w, 5, '#fff', 'opacity=".5"') + R(x, y + h + 3, w, 4, '#000', 'opacity=".0"') + pict(p, x + w / 2, y + 9 + h * .55, Math.min(w, h) * .26, '#fff') });
      else { cyl(d, { cx: x + w / 2, y: y + 10, rx: w / 2 - 1, ry: 5, h: h - 8, color: c, top: '#e0e4e8', bands: [{ y1: y + 17, y2: y + h - 6, color: '#fff' }], deco: pict(p, x + w / 2, y + h * .58, w * .26, c) }); }
    };
    let k = 0;
    for (let r = 0; r < 2; r++) for (let i = 0; i < 7; i++) { const x = 30 + i * 33, y = 28 + r * 48; dr(x, y, 28, 34, cols[(k + r * 3) % 8], pics[(k + r) % 8], (i + r) % 3 === 2 ? 'can' : 'box'); k++; }
    return d; } },
  'checkout-lane': { w: 6, h: 1, draw() {
    const d = mk(6, 1);
    d.shadow(rrP(4, 6, 424, 60, 5));
    // bagging shelf
    const shelf = rrP(4, 8, 72, 56, 5);
    d.add(`<path d="${shelf.move(0, 2.5).str()}" fill="#7d868d"/>`, d.shape(shelf, '#d7dce0', { dir: 'tl', a: .35, b: .2, stroke: '#7d868d' }));
    let gr = ''; for (let k = 0; k < 7; k++) gr += `<path d="M${10 + k * 9.4} 12V60" stroke="#9aa3aa" stroke-width="1.4"/><path d="M${11 + k * 9.4} 12V60" stroke="#fff" stroke-width=".6" opacity=".7"/>`;
    d.add(d.clip(shelf, gr));
    // plastic bags
    for (const [x, y, r] of [[18, 22, -8], [36, 34, 6], [46, 18, 14]]) d.add(`<g transform="rotate(${r} ${x} ${y})"><path d="M${x - 8} ${y - 10}h16l2 20h-20z" fill="#fff" opacity=".9" stroke="#b9c2c8" stroke-width=".9"/><path d="M${x - 4} ${y - 10}q4 -5 8 0" stroke="#b9c2c8" stroke-width="1" fill="none"/></g>`);
    // rails
    const railT = rrP(80, 6, 346, 9, 3.5), railB = rrP(80, 57, 346, 9, 3.5);
    for (const rl of [railT, railB]) d.add(d.shape(rl, '#cfd5da', { dir: 'v', a: .4, b: .3, stroke: '#7d868d', sw: 1.2 }));
    d.add(d.line(84, 8.4, 422, 8.4, '#fff', 1.2, .8), d.line(84, 59.4, 422, 59.4, '#fff', 1.2, .6));
    // belt
    const belt = rrP(80, 15, 346, 42, 3); d.add(d.shape(belt, '#3c3a38', { dir: 'v', a: .12, b: .1, stroke: '#1f1d1b', sw: 1.2 }));
    let ribs = ''; for (let k = 0; k < 70; k++) ribs += `<path d="M${94 + k * 4.9} 16V56" stroke="#2a2826" stroke-width="1.2" opacity=".8"/><path d="M${95.5 + k * 4.9} 16V56" stroke="#575450" stroke-width=".6" opacity=".7"/>`;
    d.add(d.clip(belt, ribs));
    // rollers
    for (const x of [80, 418]) d.add(d.shape(rrP(x, 15, 8, 42, 3), '#a9b0b6', { dir: 'h', a: .45, b: .35, stroke: '#6a7279' }), d.line(x + 2.2, 17, x + 2.2, 55, '#fff', 1, .6));
    d.add(hOverlay(d, belt, [80, 15, 346, 42], 0, 0), d.clip(belt, `<path d="M80 15H426V22H80z" fill="#2b2118" opacity=".3"/><path d="M80 52H426V57H80z" fill="#fff" opacity=".05"/>`));
    // chevrons showing direction
    d.add(`<g stroke="#8a8680" stroke-width="1.6" fill="none" opacity=".35" stroke-linecap="round">${[150, 190, 330, 370].map(x => `<path d="M${x} 30l7 6l-7 6"/>`).join('')}</g>`);
    // divider bar
    d.shadow(rrP(246, 14, 12, 44, 3));
    d.add(d.shape(rrP(246, 14, 12, 44, 3), '#f2a21e', { dir: 'h', a: .3, b: .25, stroke: '#a8620f', sw: 1.2 }), `<path d="M247 24h10M247 34h10M247 44h10" stroke="#fff" stroke-width="2" opacity=".55"/>`, d.line(248.5, 17, 248.5, 55, '#fff', 1, .5));
    // end sensor
    d.add(d.circ(414, 61.5, 2.3, '#e0485f', { sw: .6 }), d.circ(94, 61.5, 2.3, '#6bbf59', { sw: .6 }));
    return d; } },
  'cashier-kiosk': { w: 1, h: 1, draw() {
    const d = mk(1, 1);
    // register counter
    const ctr = rrP(5, 32, 62, 36, 4); d.shadow(ctr);
    d.add(`<path d="${ctr.move(0, 3).str()}" fill="#8d9298"/>`, d.shape(ctr, '#e3e7ea', { dir: 'tl', a: .35, b: .2, stroke: '#7d868d' }));
    // screen on a stand (seen from above: dark slab, tilted) + keypad
    d.add(d.shape(rrP(10, 36, 30, 16, 2.4), '#2f3a44', { dir: 'tl', a: .3, b: .1, stroke: '#1d252c' }), `<rect x="12.5" y="38.4" width="25" height="9.4" rx="1.2" fill="#4a9fe0"/><path d="M14 40.5h12M14 43h18M14 45.4h8" stroke="#d9f0ff" stroke-width="1" opacity=".85"/><path d="M12.5 38.4h25l-8 9.4h-17z" fill="#fff" opacity=".18"/>`);
    d.add(d.rect(43, 36, 20, 13, 2, '#cfd5da', { a: .3, b: .2 }), [0, 1, 2].map(r => [0, 1, 2, 3].map(c => `<rect x="${45 + c * 4.3}" y="${38 + r * 3.6}" width="3.2" height="2.6" rx=".7" fill="#7d868d"/>`).join('')).join(''));
    // card reader + receipt
    d.add(d.rect(12, 55, 17, 9, 2, '#2f3a44', { a: .3 }), `<rect x="14" y="57" width="8" height="3" rx=".8" fill="#6bd18a"/><rect x="24" y="57" width="3" height="3" rx=".8" fill="#f2c230"/>`, d.rect(34, 55, 10, 9, 1.8, '#f6f6f2', { a: .1, stroke: '#9aa3aa' }), `<path d="M36 55v-3h6v3" fill="#fff" stroke="#9aa3aa" stroke-width=".8"/>`);
    // bag rack (right)
    d.add(`<rect x="51" y="53" width="13" height="12" rx="1.6" fill="none" stroke="#7d868d" stroke-width="1.6"/><path d="M51 57h13M51 61h13M55 53v12M60 53v12" stroke="#b6bec4" stroke-width="1"/>`, `<rect x="52.5" y="54.6" width="10" height="3" rx="1" fill="#fff" opacity=".8"/>`);
    // cashier (above the register, facing down)
    d.shadow([ellP(36, 19, 22, 11), ellP(36, 10, 9.5, 9.5)]);
    d.add(d.shape(ellP(14, 20, 6, 8, 25), '#2e8b57', { a: .2, b: .3 }), d.shape(ellP(58, 20, 6, 8, -25), '#2e8b57', { a: .2, b: .3 }));
    d.add(d.shape(ellP(36, 20, 22, 11), '#2e9a62', { dir: 'tl', a: .3, b: .25 }), `<path d="M30 18q6 6 12 0" stroke="#fff" stroke-width="1.6" fill="none" opacity=".8"/>`, d.circ(14, 26, 3.2, '#e6b48a', { sw: .8 }), d.circ(58, 26, 3.2, '#e6b48a', { sw: .8 }));
    d.add(d.circ(36, 12, 9.4, '#e8b98f', { a: .3, b: .15, stroke: '#a8744a', sw: 1 }), d.shape(new Path().M(26.5, 11).C(26, 1.5, 46, 1.5, 45.5, 11).C(43, 7.5, 38, 6.5, 36, 7.5).C(33, 6, 28, 7.5, 26.5, 11).Z(), '#3a2a22', { a: .3, b: .2 }), `<circle cx="32.2" cy="14" r="1" fill="#3a2a22"/><circle cx="39.8" cy="14" r="1" fill="#3a2a22"/><path d="M33.6 17.4q2.4 1.6 4.8 0" stroke="#a8503a" stroke-width="1" fill="none"/>`, `<path d="M28 9q3 -5 9 -4" stroke="#fff" stroke-width="1.2" opacity=".4" fill="none"/>`);
    d.add(`<circle cx="23" cy="13" r="0" fill="none"/>`);
    return d; } },
  doormat: { w: 3, h: 2, draw() {
    const d = mk(3, 2); const mat = rrP(8, 8, 200, 128, 10); d.shadow(mat);
    d.add(`<path d="${mat.move(0, 2.5).str()}" fill="#1e1c1a"/>`, d.shape(mat, '#d9a82a', { dir: 'tl', a: .25, b: .2, stroke: '#7a5a10' }));
    const inner = rrP(15, 15, 186, 114, 6); d.add(d.shape(inner, '#3a3835', { dir: 'tl', a: .12, b: .1, stroke: '#1a1816' }));
    let dm = ''; for (let k = -10; k < 20; k++) dm += `M${15 + k * 18} 15l${114} ${114}M${15 + k * 18 + 114} 15l${-114} ${114}`;
    d.add(d.clip(inner, `<path d="${dm}" stroke="#171513" stroke-width="3" opacity=".9"/><path d="${dm}" stroke="#5d5a55" stroke-width="1" opacity=".7" transform="translate(1.4 1.4)"/>` + Array.from({ length: 12 }, (_, i) => Array.from({ length: 8 }, (_, j) => `<circle cx="${24 + i * 16.5 + ((j % 2) * 8)}" cy="${24 + j * 15}" r="1.3" fill="#6a6660" opacity=".7"/>`).join('')).join('')));
    d.add(`<path d="M15 15H201V19H19V129H15Z" fill="#2b2118" opacity=".3"/>`, d.line(20, 10.6, 196, 10.6, '#fff3b0', 1.4, .7), d.line(11, 22, 11, 118, '#fff3b0', 1.2, .5));
    const stripes = ''; for (let k = 0; k < 20; k++) d.add(d.clip(mat, `<path d="M${10 + k * 12} 8l6 0l-6 7z" fill="#2b2118" opacity=".18"/>`));
    return d; } },
  'entrance-door': { w: 3, h: 1, draw() {
    const d = mk(3, 1);
    d.shadow(rrP(0, 18, 216, 34, 2));
    // wall segments
    for (const [x, w] of [[0, 22], [194, 22]]) { const wl = rrP(x, 16, w, 38, 1); d.add(`<path d="${wl.move(0, 3).str()}" fill="#8d8478"/>`, d.shape(wl, '#e3dccd', { dir: 'tl', a: .3, b: .2, stroke: '#8d8478' }), d.line(x + 2, 19, x + w - 2, 19, '#fff', 1.2, .6)); }
    // header with sensor
    const hd = rrP(20, 14, 176, 12, 3); d.add(d.shape(hd, '#6a737b', { dir: 'v', a: .35, b: .3, stroke: '#3a4248' }), d.line(24, 16.5, 192, 16.5, '#fff', 1, .5), `<rect x="86" y="18.6" width="44" height="4.8" rx="2.4" fill="#2b3238"/>`, `<circle cx="96" cy="21" r="1.5" fill="#e0485f"/><circle cx="108" cy="21" r="1.5" fill="#6bd18a"/><circle cx="120" cy="21" r="1.5" fill="#6bd18a"/>`);
    // frame track
    d.add(d.shape(rrP(20, 44, 176, 8, 2), '#b9c0c6', { dir: 'v', a: .4, b: .3, stroke: '#6a737b' }));
    // leaves
    for (const [x, w] of [[24, 85], [107, 85]]) {
      const lf = rrP(x, 28, w, 16, 2); const gg = d.lgs([[0, '#bfe9f2', .62], [.5, '#8fd0e4', .5], [1, '#6ab2cc', .55]], 0, 0, 1, 1);
      d.add(`<path d="${lf.str()}" fill="${gg}" stroke="#d9f3f8" stroke-width="1"/>`, d.shape(rrP(x, 28, w, 3.4, 1), '#cfd5da', { dir: 'v', stroke: '#6a737b', sw: .8 }), d.shape(rrP(x, 40.6, w, 3.4, 1), '#cfd5da', { dir: 'v', stroke: '#6a737b', sw: .8 }),
        `<path d="M${x + 10} 44L${x + 30} 30H${x + 40}L${x + 20} 44Z" fill="#fff" opacity=".5"/><path d="M${x + 46} 44L${x + 66} 30H${x + 72}L${x + 52} 44Z" fill="#fff" opacity=".35"/>`);
    }
    d.add(d.shape(rrP(105, 28, 6, 16, 1.5), '#2b3238', { dir: 'h', stroke: '#14181b', sw: .8 }), `<rect x="106.6" y="30" width="1.2" height="12" fill="#6a737b"/>`, d.shape(rrP(100, 33, 3, 6, 1.5), '#cfd5da', { stroke: '#6a737b', sw: .7 }), d.shape(rrP(113, 33, 3, 6, 1.5), '#cfd5da', { stroke: '#6a737b', sw: .7 }));
    return d; } },
  'wet-floor-sign': { w: 1, h: 1, draw() {
    const d = mk(1, 1);
    const top = polyP([[14, 8], [58, 8], [62, 34], [10, 34]]), bot = polyP([[10, 37], [62, 37], [58, 64], [14, 64]]);
    d.shadow([top, bot]);
    d.add(d.shape(top, '#f6d02a', { dir: 'tl', a: .35, b: .12, stroke: '#a88410', sw: 1.4 }), d.shape(bot, '#e8b81a', { dir: 'tl', a: .2, b: .3, stroke: '#a88410', sw: 1.4 }));
    d.add(`<rect x="9" y="33.5" width="54" height="4" rx="2" fill="#f1c21c" stroke="#a88410" stroke-width="1"/><path d="M12 34.8H60" stroke="#fff" stroke-width="1" opacity=".6"/>`);
    // pictogram: slipping person
    const fig = (x, y, s, c) => `<g transform="translate(${x} ${y}) scale(${s})" fill="${c}" stroke="${c}" stroke-linecap="round" stroke-linejoin="round"><circle cx="-5" cy="-9" r="3.2" stroke="none"/><path d="M-3 -4L2 3L8 1M2 3L-4 9M-3 -4L-9 -1M-3 -4L4 -6" fill="none" stroke-width="2.6"/><path d="M-12 11q4 -3 8 0t8 0t8 0" fill="none" stroke-width="1.5"/></g>`;
    d.add(fig(36, 21, 1, '#2f2b26'), `<path d="M24 10H48" stroke="#2f2b26" stroke-width="0"/>`);
    d.add(fig(36, 51, .9, '#7a5d10'));
    d.add(d.spec(22, 14, 7, 2, -8, .45));
    return d; } },
};
