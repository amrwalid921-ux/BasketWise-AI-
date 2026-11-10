// Parametric product templates. All draw into a Doc (128x128) following the style guide:
// top-left light, shadow (+5,+6), darker-tone edges, ambient occlusion bottom-right, specular on shiny things.
import { Path, rrP, ellP, polyP, smoothP, shade, edge, mix, f, rng } from '../svgkit.mjs';
import { pict } from './pictos.mjs';
export { pict };
const K = 0.5523;

// ---------- generic helpers
export function hOverlay(d, clipPath, bbox, l = .28, r = .3) {
  const [x, y, w, h] = bbox;
  const g = d.lgs([[0, '#fff', l], [.3, '#fff', l * .25], [.55, '#fff', 0], [.55, '#2b2118', 0], [1, '#2b2118', r]], 0, 0, 1, 0);
  return d.clip(clipPath, `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${g}"/>`);
}
export function vOverlay(d, clipPath, bbox, t = .22, b = .2) {
  const [x, y, w, h] = bbox;
  const g = d.lgs([[0, '#fff', t], [.4, '#fff', 0], [.6, '#2b2118', 0], [1, '#2b2118', b]], 0, 0, 0, 1);
  return d.clip(clipPath, `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${g}"/>`);
}
export function ball(d, cx, cy, r, color, o = {}) {
  const g = d.rgs([[0, shade(color, .38)], [.5, color], [1, shade(color, -.34)]], .5, .5, .62, .36, .3);
  let s = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${g}" stroke="${edge(color)}" stroke-width="${o.sw ?? 1.1}"/>`;
  if (o.hl !== false) s += d.spec(cx - r * .35, cy - r * .4, r * .32, r * .17, -35, o.hlop ?? .7);
  return s;
}
export const sticker = (d, cx, cy, r, color, pic, pc = '#fff') => d.circ(cx, cy, r, color, { sw: 1 }) + pict(pic, cx, cy, r * .62, pc);

// ---------- upright cylinder (can, tub, jar) with optional taper, bands and clipped decoration
export function cylBodyP(cx, y, rx, ry, h, rxb = rx) {
  const ryb = ry * rxb / rx, yb = y + h;
  return new Path().M(cx - rx, y).L(cx - rxb, yb).C(cx - rxb, yb + ryb * K, cx - rxb * K, yb + ryb, cx, yb + ryb)
    .C(cx + rxb * K, yb + ryb, cx + rxb, yb + ryb * K, cx + rxb, yb).L(cx + rx, y).Z();
}
export function bandP(cx, y0, rx, ry, h, rxb, y1, y2) {
  const at = y => { const t = (y - y0) / h; const r = rx + (rxb - rx) * t; return [r, ry * r / rx]; };
  const [r1, ry1] = at(y1), [r2, ry2] = at(y2);
  return new Path().M(cx - r1, y1).Q(cx, y1 + 2 * ry1, cx + r1, y1).L(cx + r2, y2).Q(cx, y2 + 2 * ry2, cx - r2, y2).Z();
}
export function cyl(d, o) {
  const { cx, y, rx, ry, h, color } = o; const rxb = o.rxb ?? rx; const ryb = ry * rxb / rx;
  const body = cylBodyP(cx, y, rx, ry, h, rxb); const top = ellP(cx, y, rx, ry);
  const bbox = [cx - rx, y - ry, rx * 2, h + ry + ryb];
  if (o.shadow !== false) d.shadow([body, top], { op: o.sop });
  const s = [];
  s.push(d.shape(body, color, { dir: 'h', a: .2, b: .3 }));
  for (const b of o.bands || []) s.push(d.flat(bandP(cx, y, rx, ry, h, rxb, b.y1, b.y2), b.color));
  if (o.deco) s.push(d.clip(body, o.deco));
  s.push(hOverlay(d, body, bbox, o.l ?? .3, o.r ?? .32));
  // lower AO band
  s.push(d.clip(body, `<rect x="${f(cx - rx)}" y="${f(y + h - 4)}" width="${f(rx * 2)}" height="${f(ryb + 5)}" fill="#2b2118" opacity=".14"/>`));
  s.push(`<path d="${body.str()}" fill="none" stroke="${edge(color)}" stroke-width="1.3" stroke-linejoin="round"/>`);
  // top face
  const tc = o.top ?? shade(color, .18);
  const tg = d.lgs([[0, shade(tc, .28)], [1, shade(tc, -.12)]], 0, 0, 1, 1);
  s.push(`<path d="${top.str()}" fill="${tg}" stroke="${edge(tc)}" stroke-width="1.3"/>`);
  if (o.topDeco) s.push(d.clip(top, o.topDeco));
  if (o.rim !== false) s.push(`<path d="${ellP(cx, y, rx - 2.2, ry - 1.2).str()}" fill="none" stroke="${shade(tc, -.22)}" stroke-width=".9" opacity=".7"/>`);
  s.push(`<path d="${ellP(cx, y, rx - 1, ry - .5).str()}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".9" stroke-dasharray="${rx * 1.3} 100" transform="rotate(200 ${cx} ${y})"/>`);
  d.add(s.join(''));
  return { body, top, bbox };
}
// ring-pull on a can top
export function ringPull(d, cx, cy, s = 1, color = '#cfd2d4') {
  return `<g transform="translate(${f(cx)} ${f(cy)}) scale(${s})"><ellipse cx="0" cy="0" rx="5" ry="2.6" fill="none" stroke="${shade(color, -.3)}" stroke-width="1.8"/><ellipse cx="0" cy="-.4" rx="5" ry="2.6" fill="none" stroke="${shade(color, .3)}" stroke-width="1.1"/><rect x="-7" y="-1" width="4.5" height="2" rx="1" fill="${shade(color, -.12)}" stroke="${shade(color, -.4)}" stroke-width=".6"/></g>`;
}

// ---------- upright box (cereal box, tea box...), front face + top face
export function boxUp(d, o) {
  const { x, y, w, h, color } = o; const td = o.td ?? 12, i = o.inset ?? 4;
  const front = rrP(x, y + td, w, h, o.r ?? 2.5, 2.5);
  const topP = polyP([[x + i, y], [x + w - i, y], [x + w, y + td], [x, y + td]]);
  if (o.shadow !== false) d.shadow([front, topP]);
  const s = [];
  s.push(d.shape(front, color, { dir: 'h', a: .12, b: .22 }));
  if (o.deco) s.push(d.clip(front, o.deco));
  s.push(hOverlay(d, front, [x, y + td, w, h], .24, .3));
  s.push(d.clip(front, `<rect x="${x}" y="${y + td + h - 6}" width="${w}" height="6" fill="#2b2118" opacity=".18"/>`));
  s.push(`<path d="${front.str()}" fill="none" stroke="${edge(color)}" stroke-width="1.4" stroke-linejoin="round"/>`);
  const tc = o.top ?? shade(color, .3);
  s.push(d.shape(topP, tc, { dir: 'v', a: .22, b: .08 }));
  if (o.topDeco) s.push(d.clip(topP, o.topDeco));
  s.push(d.line(x + i + 2, y + 1.8, x + w - i - 2, y + 1.8, '#fff', 1, .5));
  d.add(s.join(''));
  return { front, top: topP };
}

// ---------- bottle (upright). returns geometry useful for labels
export function bottle(d, o) {
  const { cx, color } = o; const nw = o.neckW ?? 14, bw = o.bodyW ?? 40, y0 = o.y; // y0 = top of cap
  const capH = o.capH ?? 8, capW = o.capW ?? nw + 4, neckH = o.neckH ?? 8, sh = o.shoulderH ?? 14, bh = o.bodyH ?? 50;
  const yn = y0 + capH + neckH * .6, ys = yn + neckH * .4 + sh, yb = ys + bh, ryb = bw * (o.base ?? .12);
  const hn = nw / 2, hb = bw / 2;
  const sq = o.sq ?? 0; // 0 round shoulder, 1 sharp
  const p = new Path().M(cx - hn, yn).C(cx - hn, yn + sh * .6, cx - hb, ys - sh * .55 * (1 - sq * .5), cx - hb, ys)
    .L(cx - hb, yb).C(cx - hb, yb + ryb * K, cx - hb * K, yb + ryb, cx, yb + ryb).C(cx + hb * K, yb + ryb, cx + hb, yb + ryb * K, cx + hb, yb)
    .L(cx + hb, ys).C(cx + hb, ys - sh * .55 * (1 - sq * .5), cx + hn, yn + sh * .6, cx + hn, yn).Z();
  const neck = rrP(cx - hn, y0 + capH - 2, nw, neckH + 4, 1.5);
  const bbox = [cx - hb, y0, bw, yb + ryb - y0];
  const capRy = capW * .2;
  const capP = cylBodyP(cx, y0 + capRy, capW / 2, capRy, capH - capRy);
  if (o.shadow !== false) d.shadow([p, neck, capP, ellP(cx, y0 + capRy, capW / 2, capRy)]);
  const s = [];
  const bc = o.glass ? color : color;
  s.push(d.shape(neck, shade(bc, -.05), { dir: 'h', a: .1, b: .2 }));
  s.push(d.shape(p, bc, { dir: 'h', a: o.glass ? .12 : .18, b: .28 }));
  if (o.liquid) { const lp = new Path().M(cx - hb + 2, ys + 3).L(cx - hb + 2, yb - 1).Q(cx - hb + 2, yb + ryb - 2, cx, yb + ryb - 2).Q(cx + hb - 2, yb + ryb - 2, cx + hb - 2, yb - 1).L(cx + hb - 2, ys + 3).Z(); s.push(d.clip(p, d.flat(lp, o.liquid, .95))); }
  if (o.deco) s.push(d.clip(p, o.deco));
  s.push(hOverlay(d, p, bbox, .3, .33));
  s.push(d.clip(p, `<rect x="${cx - hb}" y="${yb - 5}" width="${bw}" height="${ryb + 6}" fill="#2b2118" opacity=".15"/>`));
  // ridges at base
  if (o.petBase) s.push(d.clip(p, [-1, 0, 1].map(k => `<path d="M${cx - hb} ${yb - 1}Q${cx + k * hb * .66} ${yb + ryb * 1.2} ${cx + hb} ${yb - 1}" stroke="#2b2118" stroke-opacity=".12" fill="none" stroke-width="1"/>`).join('')));
  s.push(`<path d="${p.str()}" fill="none" stroke="${edge(bc)}" stroke-width="1.3" stroke-linejoin="round"/>`);
  // shoulder highlight
  s.push(d.stroke(new Path().M(cx - hb + 4, ys + 2).Q(cx - hb + 3.5, ys - 5, cx - hn - 1.5, yn + 2), '#fff', 2, .55));
  s.push(d.stroke(new Path().M(cx - hb + 4.5, ys + 6).L(cx - hb + 4.5, yb - 8), '#fff', 1.8, .45));
  // cap
  const cc = o.cap ?? '#e9eef2';
  s.push(d.shape(capP, cc, { dir: 'h', a: .25, b: .3 }));
  for (let k = -3; k <= 3; k++) s.push(d.line(cx + k * capW / 8, y0 + capRy + 2, cx + k * capW / 8, y0 + capH + 1.5, shade(cc, -.3), .8, .55));
  s.push(`<ellipse cx="${cx}" cy="${f(y0 + capRy)}" rx="${capW / 2}" ry="${f(capRy)}" fill="${d.lgs([[0, shade(cc, .35)], [1, shade(cc, -.1)]])}" stroke="${edge(cc)}" stroke-width="1.1"/>`);
  d.add(s.join(''));
  return { p, bbox, ys, yb, ryb, hb, cx, yn };
}

// ---------- gabled carton (milk / juice)
export function carton(d, o) {
  const { cx, color } = o; const w = o.w ?? 50, h = o.h ?? 62, bottom = o.bottom ?? 113, x = cx - w / 2;
  const roofH = o.roofH ?? 15, fin = o.finH ?? 8, yb0 = bottom - h, ri = 7;
  const body = rrP(x, yb0, w, h, 2.5, 3.5);
  const roof = polyP([[x, yb0], [x + w, yb0], [x + w - ri, yb0 - roofH], [x + ri, yb0 - roofH]]);
  const finP = rrP(x + ri, yb0 - roofH - fin, w - 2 * ri, fin + 1, 1.5);
  if (o.shadow !== false) d.shadow([body, roof, finP]);
  const s = [];
  s.push(d.shape(body, color, { dir: 'h', a: .14, b: .22 }));
  if (o.deco) s.push(d.clip(body, o.deco));
  s.push(hOverlay(d, body, [x, yb0, w, h], .26, .3));
  s.push(d.clip(body, `<rect x="${x}" y="${bottom - 6}" width="${w}" height="6" fill="#2b2118" opacity=".18"/>`));
  s.push(`<path d="${body.str()}" fill="none" stroke="${edge(color)}" stroke-width="1.4"/>`);
  const rc = o.roof ?? shade(color, .12);
  s.push(d.shape(roof, rc, { dir: 'v', a: .3, b: .05 }));
  if (o.roofDeco) s.push(d.clip(roof, o.roofDeco));
  s.push(d.line(x + 1, yb0 - .5, x + w - 1, yb0 - .5, shade(rc, -.3), .9, .7));
  // fin with crimp
  s.push(d.shape(finP, rc, { dir: 'v', a: .3, b: .1 }));
  for (let k = 0; k < 7; k++) s.push(d.line(x + ri + 3 + k * (w - 2 * ri - 6) / 6, yb0 - roofH - fin + 1.5, x + ri + 3 + k * (w - 2 * ri - 6) / 6, yb0 - roofH + .5, shade(rc, -.28), .8, .6));
  // cap on roof
  if (o.cap !== false) { const cc = o.cap ?? '#e9eef2', cxp = x + w * .7, cyp = yb0 - roofH * .5; s.push(`<ellipse cx="${f(cxp)}" cy="${f(cyp + 1.3)}" rx="4.6" ry="3" fill="${shade(cc, -.35)}"/><ellipse cx="${f(cxp)}" cy="${f(cyp)}" rx="4.6" ry="3" fill="${d.lgs([[0, shade(cc, .35)], [1, shade(cc, -.1)]])}" stroke="${edge(cc)}" stroke-width=".9"/>`); }
  s.push(d.stroke(new Path().M(x + 3.5, yb0 + 5).L(x + 3.5, bottom - 8), '#fff', 1.8, .4));
  d.add(s.join(''));
  return { body, yb0, x, w, h, bottom };
}

// ---------- flat pillow bag (top-down, crimped ends)
export function bag(d, o) {
  const { cx, cy, w, h, color } = o; const x = cx - w / 2, y = cy - h / 2; const ch = o.crimp ?? 9, bu = o.bulge ?? 3;
  const zig = (xa, xb, ya, dir) => { const pts = []; const n = Math.max(6, Math.round((xb - xa) / 3)); for (let i = 0; i <= n; i++) pts.push([xa + (xb - xa) * i / n, ya + (i % 2 ? dir * 1.2 : 0)]); return pts; };
  const p = new Path(); const top = zig(x + 2, x + w - 2, y, 1), bot = zig(x + w - 2, x + 2, y + h, -1);
  p.M(top[0][0], top[0][1]); top.slice(1).forEach(q => p.L(q[0], q[1]));
  p.Q(x + w + bu, y + h * .5, bot[0][0], bot[0][1]); bot.slice(1).forEach(q => p.L(q[0], q[1]));
  p.Q(x - bu, y + h * .5, top[0][0], top[0][1]).Z();
  const bb = [x - bu, y, w + bu * 2, h];
  if (o.shadow !== false) d.shadow(p);
  const s = [];
  s.push(d.shape(p, color, { dir: 'tl', a: .2, b: .26 }));
  if (o.deco) s.push(d.clip(p, o.deco));
  const cc = o.crimpColor ?? shade(color, .05);
  s.push(d.clip(p, d.crimp(x - 2, y - 1, w + 4, ch + 1, cc, 'v') + d.crimp(x - 2, y + h - ch, w + 4, ch + 1, cc, 'v')));
  s.push(d.clip(p, `<path d="M${f(x)} ${f(y + ch)}L${f(x + w)} ${f(y + ch)}M${f(x)} ${f(y + h - ch)}L${f(x + w)} ${f(y + h - ch)}" stroke="${shade(cc, -.3)}" stroke-width="1" opacity=".6"/>`));
  s.push(hOverlay(d, p, bb, .3, .3));
  s.push(vOverlay(d, p, bb, .12, .22));
  // plastic wrinkles
  const r = rng(o.seed ?? 7);
  s.push(d.clip(p, [0, 1, 2, 3].map(k => { const yy = y + ch + 4 + r() * (h - 2 * ch - 8); const xx = x + 3 + r() * (w - 10); return `<path d="M${f(xx)} ${f(yy)}q${f(4 + r() * 6)} ${f(-2 + r() * 4)} ${f(8 + r() * 6)} ${f(-3 + r() * 6)}" stroke="#fff" stroke-opacity=".28" stroke-width="1.1" fill="none" stroke-linecap="round"/>`; }).join('')));
  s.push(`<path d="${p.str()}" fill="none" stroke="${edge(color)}" stroke-width="1.3" stroke-linejoin="round"/>`);
  s.push(d.spec(x + w * .22, y + ch + 9, 5, 2.4, -50, .6));
  d.add(s.join(''));
  return { p, x, y, w, h, ch, cx, cy };
}

// ---------- stand-up pouch (flat, zip top, flares to the bottom)
export function pouch(d, o) {
  const { cx, w, color } = o; const top = o.y, h = o.h; const wt = w * .92, x0 = cx - wt / 2, x1 = cx + wt / 2, xb0 = cx - w / 2, xb1 = cx + w / 2, yb = top + h;
  const p = new Path().M(x0 + 3, top).L(x1 - 3, top).Q(x1, top, x1, top + 3).C(x1 + 1, top + h * .5, xb1, top + h * .7, xb1, yb - 9).Q(xb1, yb, xb1 - 9, yb)
    .L(xb0 + 9, yb).Q(xb0, yb, xb0, yb - 9).C(xb0, top + h * .7, x0 - 1, top + h * .5, x0, top + 3).Q(x0, top, x0 + 3, top).Z();
  const bb = [xb0, top, w, h];
  if (o.shadow !== false) d.shadow(p);
  const s = [];
  s.push(d.shape(p, color, { dir: 'tl', a: .18, b: .26 }));
  if (o.deco) s.push(d.clip(p, o.deco));
  // top seal + zip
  const sc = o.seal ?? shade(color, .08);
  s.push(d.clip(p, d.crimp(x0, top, wt, 7, sc, 'v') + `<rect x="${f(x0)}" y="${f(top + 11)}" width="${f(wt)}" height="2.4" fill="${shade(color, -.25)}" opacity=".55"/><rect x="${f(x0)}" y="${f(top + 10)}" width="${f(wt)}" height="1" fill="#fff" opacity=".4"/>`));
  s.push(d.clip(p, `<path d="M${f(xb0 + 3)} ${f(yb - 7)}Q${cx} ${f(yb - 14)} ${f(xb1 - 3)} ${f(yb - 7)}" stroke="${shade(color, -.3)}" stroke-width="1.2" fill="none" opacity=".6"/>`));
  s.push(hOverlay(d, p, bb, .3, .3)); s.push(vOverlay(d, p, bb, .1, .2));
  s.push(`<path d="${p.str()}" fill="none" stroke="${edge(color)}" stroke-width="1.3" stroke-linejoin="round"/>`);
  s.push(d.spec(xb0 + 9, top + 22, 4.5, 2.2, -60, .55));
  d.add(s.join(''));
  return { p, y1: top + 14, y2: yb - 14, cx, w };
}

// ---------- top-down tray with rim (meat tray, baklava, egg carton...)
export function tray(d, o) {
  const { x, y, w, h, color } = o; const r = o.r ?? 8, rim = o.rim ?? 4;
  const outer = rrP(x, y, w, h, r), inner = rrP(x + rim, y + rim, w - 2 * rim, h - 2 * rim, Math.max(2, r - 3));
  if (o.shadow !== false) d.shadow(outer);
  const s = [];
  s.push(`<path d="${outer.move(0, o.lip ?? 3).str()}" fill="${shade(color, -.3)}" stroke="${edge(color)}" stroke-width="1.3"/>`);
  s.push(d.shape(outer, color, { dir: 'tl', a: .25, b: .15 }));
  const ig = d.lgs([[0, shade(o.innerColor ?? color, -.28)], [.25, shade(o.innerColor ?? color, -.05)], [1, shade(o.innerColor ?? color, .1)]], 0, 0, 1, 1);
  s.push(`<path d="${inner.str()}" fill="${ig}" stroke="${edge(color)}" stroke-width="1"/>`);
  if (o.deco) s.push(d.clip(inner, o.deco));
  // inner wall shadow top-left
  s.push(d.clip(inner, `<path d="M${x + rim} ${y + rim}h${w}v3h${-w}zM${x + rim} ${y + rim}v${h}h3v${-h}z" fill="#2b2118" opacity=".22"/>`));
  if (o.film) {
    const fg = d.lgs([[0, '#fff', .5], [.3, '#fff', .12], [.5, '#fff', .02], [.7, '#fff', .14], [1, '#fff', .05]], 0, 0, 1, 1);
    s.push(`<path d="${outer.str()}" fill="${fg}"/>`);
    s.push(d.glint(new Path().M(x + 7, y + h * .35).Q(x + w * .35, y + h * .12, x + w * .55, y + 6), 1.8, .55));
    s.push(d.glint(new Path().M(x + w * .62, y + h - 6).Q(x + w * .8, y + h * .75, x + w - 6, y + h * .6), 1.4, .4));
  }
  s.push(d.ao(outer, [x, y, w, h], .2));
  s.push(`<path d="${outer.str()}" fill="none" stroke="${edge(color)}" stroke-width="1.3"/>`);
  d.add(s.join(''));
  return { outer, inner, x, y, w, h, rim };
}

// ---------- wooden crate (top-down with front lip), contents drawn by deco inside
export function crate(d, o) {
  const { x, y, w, h } = o; const wood = o.wood ?? '#c99a5e';
  const outer = rrP(x, y, w, h, 4); const inner = rrP(x + 6, y + 5, w - 12, h - 12, 3);
  if (o.shadow !== false) d.shadow(outer);
  const s = [];
  s.push(`<path d="${outer.move(0, 4).str()}" fill="${shade(wood, -.34)}" stroke="${edge(wood)}" stroke-width="1.2"/>`);
  s.push(`<path d="${rrP(x, y + h - 1, w, 7, 2).str()}" fill="${shade(wood, -.2)}" stroke="${edge(wood)}" stroke-width="1.2"/>`);
  s.push(d.shape(outer, wood, { dir: 'tl', a: .25, b: .2 }));
  // slat lines
  for (let k = 1; k <= 2; k++) s.push(d.line(x + 2, y + k * 3.6, x + w - 2, y + k * 3.6, shade(wood, -.3), .8, .5));
  s.push(`<path d="${inner.str()}" fill="${shade(wood, -.55)}"/>`);
  s.push(o.deco || '');
  s.push(d.ao(outer, [x, y, w, h], .16));
  // nails
  for (const [nx, ny] of [[x + 3, y + 2.5], [x + w - 3, y + 2.5]]) s.push(`<circle cx="${nx}" cy="${ny}" r="1" fill="${shade(wood, -.5)}"/>`);
  s.push(`<path d="${outer.str()}" fill="none" stroke="${edge(wood)}" stroke-width="1.3"/>`);
  { const fb = rrP(x + 1, y + h - 13, w - 2, 13, 3); const fp = d.clip(fb, ''); s.push(d.shape(fb, wood, { dir: 'v', a: .2, b: .25 })); s.push(d.line(x + 4, y + h - 7, x + w - 4, y + h - 7, shade(wood, -.3), .8, .5)); for (const nx of [x + 4, x + w - 4]) s.push(`<circle cx="${nx}" cy="${y + h - 6.5}" r="1" fill="${shade(wood, -.5)}"/>`); s.push(`<path d="${fb.str()}" fill="none" stroke="${edge(wood)}" stroke-width="1.2"/>`); }
  d.add(s.join(''));
  return { inner, x, y, w, h };
}
export function netLines(d, clipP, bbox, color = '#fff', op = .5, step = 7) {
  const [x, y, w, h] = bbox; let l = '';
  for (let k = -h; k < w + h; k += step) l += `M${f(x + k)} ${f(y)}L${f(x + k + h)} ${f(y + h)}M${f(x + k + h)} ${f(y)}L${f(x + k)} ${f(y + h)}`;
  return d.clip(clipP, `<path d="${l}" stroke="${color}" stroke-width="1" opacity="${op}" fill="none"/>`);
}
export function shine(d, p, bbox, k = .35) { return d.wash(p, bbox, k); }
export function gingham(d, clipP, bbox, c1, c2, n = 6) {
  const [x, y, w, h] = bbox; const s = w / n; let o = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c2}"/>`;
  for (let i = 0; i < n; i++) for (let j = 0; j < Math.ceil(h / s); j++) if ((i + j) % 2 === 0) o += `<rect x="${f(x + i * s)}" y="${f(y + j * s)}" width="${f(s)}" height="${f(s)}" fill="${c1}"/>`;
  return d.clip(clipP, o);
}
// round tub seen from above-ish (foil/flat lid): cylinder with big ry
export function tub(d, o) { return cyl(d, { ry: o.rx * .62, ...o }); }
// glass jar: body with glass look, contents, lid
export function jar(d, o) {
  const { cx, rx, h, color } = o; const ry = o.ry ?? rx * .55; const y = o.y; // y: top of the body ellipse centre
  const body = cylBodyP(cx, y, rx, ry, h);
  const lidH = o.lidH ?? 11, lrx = rx + (o.lidW ?? 1.5), lry = lrx * (ry / rx);
  const lidY = y - lidH + 1;
  if (o.shadow !== false) d.shadow([body, cylBodyP(cx, lidY, lrx, lry, lidH)]);
  const s = [];
  s.push(d.shape(body, color, { dir: 'h', a: .2, b: .3 }));
  if (o.deco) s.push(d.clip(body, o.deco));
  s.push(hOverlay(d, body, [cx - rx, y - ry, rx * 2, h + ry * 2], .34, .3));
  s.push(d.clip(body, `<rect x="${cx - rx}" y="${y + h - 4}" width="${rx * 2}" height="${ry + 5}" fill="#2b2118" opacity=".15"/>`));
  s.push(`<path d="${body.str()}" fill="none" stroke="${edge(color)}" stroke-width="1.3"/>`);
  s.push(d.stroke(new Path().M(cx - rx + 4, y + 6).L(cx - rx + 4, y + h - 8), '#fff', 2.2, .5));
  d.add(s.join(''));
  return { body, y, rx, ry, h, lidY, lrx, lry, lidH };
}
export function lid(d, o) { // lid cylinder on a jar
  const { cx, lidY, lrx, lry, lidH } = o; const c = o.color;
  return cyl(d, { cx, y: lidY, rx: lrx, ry: lry, h: lidH, color: c, top: o.top ?? shade(c, .15), shadow: false, topDeco: o.topDeco, deco: o.deco, bands: o.bands });
}
export { rrP, ellP, polyP, smoothP, Path, shade, edge, mix, f, rng };
