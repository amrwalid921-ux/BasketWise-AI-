// svgkit: tiny SVG toolkit (colour math, path builder, gradients, shadows, AO, specular, crimps)
export function hex2rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export const rgb2hex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export function mix(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }
export const shade = (c, amt) => amt >= 0 ? mix(c, '#fff8ea', amt) : mix(c, '#2a1d16', -amt);
export const lighten = (c, a) => shade(c, a);
export const darken = (c, a) => shade(c, -a);
export const edge = c => shade(c, -0.36);
export const f = n => +n.toFixed(2);
export function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

const K = 0.5523;
export class Path {
  constructor(c = []) { this.c = c; }
  M(x, y) { this.c.push(['M', x, y]); return this; }
  L(x, y) { this.c.push(['L', x, y]); return this; }
  Q(a, b, x, y) { this.c.push(['Q', a, b, x, y]); return this; }
  C(a, b, c, d, x, y) { this.c.push(['C', a, b, c, d, x, y]); return this; }
  Z() { this.c.push(['Z']); return this; }
  map(fn) { return new Path(this.c.map(cmd => { const o = [cmd[0]]; for (let i = 1; i < cmd.length; i += 2) { const [x, y] = fn(cmd[i], cmd[i + 1]); o.push(x, y); } return o; })); }
  move(dx, dy) { return this.map((x, y) => [x + dx, y + dy]); }
  rot(deg, cx, cy) { const a = deg * Math.PI / 180, s = Math.sin(a), c = Math.cos(a); return this.map((x, y) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]); }
  scale(sx, sy = sx, cx = 0, cy = 0) { return this.map((x, y) => [cx + (x - cx) * sx, cy + (y - cy) * sy]); }
  str() { return this.c.map(c => c[0] + c.slice(1).map(f).join(' ')).join('') ; }
  join(o) { return new Path([...this.c, ...o.c]); }
}
export function rrP(x, y, w, h, r = 0, r2) {
  const rt = Math.min(r, w / 2, h / 2), rb = Math.min(r2 ?? r, w / 2, h / 2); const p = new Path();
  p.M(x + rt, y).L(x + w - rt, y).C(x + w - rt + rt * K, y, x + w, y + rt - rt * K, x + w, y + rt)
    .L(x + w, y + h - rb).C(x + w, y + h - rb + rb * K, x + w - rb + rb * K, y + h, x + w - rb, y + h)
    .L(x + rb, y + h).C(x + rb - rb * K, y + h, x, y + h - rb + rb * K, x, y + h - rb)
    .L(x, y + rt).C(x, y + rt - rt * K, x + rt - rt * K, y, x + rt, y).Z();
  return p;
}
export function ellP(cx, cy, rx, ry = rx, rot = 0) {
  const p = new Path().M(cx + rx, cy).C(cx + rx, cy + ry * K, cx + rx * K, cy + ry, cx, cy + ry).C(cx - rx * K, cy + ry, cx - rx, cy + ry * K, cx - rx, cy)
    .C(cx - rx, cy - ry * K, cx - rx * K, cy - ry, cx, cy - ry).C(cx + rx * K, cy - ry, cx + rx, cy - ry * K, cx + rx, cy).Z();
  return rot ? p.rot(rot, cx, cy) : p;
}
export function polyP(pts, closed = true) { const p = new Path(); pts.forEach(([x, y], i) => i ? p.L(x, y) : p.M(x, y)); if (closed) p.Z(); return p; }
// smooth closed blob through points (Catmull-Rom -> bezier)
export function smoothP(pts, closed = true) {
  const n = pts.length, p = new Path(); p.M(pts[0][0], pts[0][1]);
  const g = i => pts[(i + n) % n];
  const lim = closed ? n : n - 1;
  for (let i = 0; i < lim; i++) {
    const p0 = closed ? g(i - 1) : pts[Math.max(i - 1, 0)], p1 = g(i), p2 = closed ? g(i + 1) : pts[i + 1], p3 = closed ? g(i + 2) : pts[Math.min(i + 2, n - 1)];
    p.C(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  if (closed) p.Z();
  return p;
}
const dstr = p => typeof p === 'string' ? p : p.str();

export class Doc {
  constructor(w, h, opt = {}) { this.w = w; this.h = h; this.defs = []; this.body = []; this.n = 0; this.cache = new Map(); this.sdx = opt.sdx ?? 5; this.sdy = opt.sdy ?? 6; this.sblur = opt.sblur ?? 2.4; this.sop = opt.sop ?? 0.28; }
  id(p = 'i') { return p + (++this.n); }
  add(...s) { for (const x of s) if (x) this.body.push(Array.isArray(x) ? x.join('') : x); return this; }
  // ---- gradients
  lg(color, o = {}) {
    const a = o.a ?? 0.22, b = o.b ?? 0.26, dir = o.dir ?? 'tl';
    const key = `lg${color}${a}${b}${dir}`; if (this.cache.has(key)) return this.cache.get(key);
    const id = this.id('g'); const [x1, y1, x2, y2] = dir === 'v' ? [0, 0, 0, 1] : dir === 'h' ? [0, 0, 1, 0] : dir === 'vr' ? [0, 1, 0, 0] : [0, 0, 1, 1];
    this.defs.push(`<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${shade(color, a)}"/><stop offset=".5" stop-color="${color}"/><stop offset="1" stop-color="${shade(color, -b)}"/></linearGradient>`);
    const u = `url(#${id})`; this.cache.set(key, u); return u;
  }
  lgs(stops, x1 = 0, y1 = 0, x2 = 1, y2 = 1, userSpace = false) {
    const id = this.id('s');
    this.defs.push(`<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${userSpace ? ' gradientUnits="userSpaceOnUse"' : ''}>${stops.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op !== undefined ? ` stop-opacity="${op}"` : ''}/>`).join('')}</linearGradient>`);
    return `url(#${id})`;
  }
  rgs(stops, cx = .5, cy = .5, r = .5, fx, fy, userSpace = false) {
    const id = this.id('r');
    this.defs.push(`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" fx="${fx ?? cx}" fy="${fy ?? cy}"${userSpace ? ' gradientUnits="userSpaceOnUse"' : ''}>${stops.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op !== undefined ? ` stop-opacity="${op}"` : ''}/>`).join('')}</radialGradient>`);
    return `url(#${id})`;
  }
  // ---- shapes
  shape(path, color, o = {}) {
    const fill = o.fill ?? (o.flat ? color : this.lg(color, o));
    const stroke = o.stroke === undefined ? edge(color) : o.stroke;
    const sw = o.sw ?? 1.4;
    return `<path d="${dstr(path)}" fill="${fill}"${stroke && stroke !== 'none' ? ` stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"` : ''}${o.op !== undefined ? ` opacity="${o.op}"` : ''}${o.extra ? ' ' + o.extra : ''}/>`;
  }
  rect(x, y, w, h, r, color, o = {}) { let p = rrP(x, y, w, h, r, o.r2); if (o.rot) p = p.rot(o.rot, x + w / 2, y + h / 2); return this.shape(p, color, o); }
  circ(cx, cy, r, color, o = {}) { return this.shape(ellP(cx, cy, r, r), color, o); }
  ell(cx, cy, rx, ry, color, o = {}) { return this.shape(ellP(cx, cy, rx, ry, o.rot || 0), color, o); }
  poly(pts, color, o = {}) { return this.shape(polyP(pts), color, o); }
  line(x1, y1, x2, y2, color, w = 1.2, op = 1) { return `<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" fill="none"${op < 1 ? ` opacity="${op}"` : ''}/>`; }
  stroke(path, color, w = 1.2, op = 1, extra = '') { return `<path d="${dstr(path)}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none"${op < 1 ? ` opacity="${op}"` : ''} ${extra}/>`; }
  flat(path, color, op = 1) { return `<path d="${dstr(path)}" fill="${color}"${op < 1 ? ` opacity="${op}"` : ''}/>`; }
  // ---- shadow / lighting
  shadow(paths, o = {}) {
    if (!this.cache.has('shf')) { this.defs.push(`<filter id="shf" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="${this.sblur}"/></filter>`); this.cache.set('shf', 1); }
    const ps = (Array.isArray(paths) ? paths : [paths]).map(p => `<path d="${dstr(p)}"/>`).join('');
    this.add(`<g transform="translate(${o.dx ?? this.sdx} ${o.dy ?? this.sdy})" fill="#2b2118" opacity="${o.op ?? this.sop}" filter="url(#shf)">${ps}</g>`);
  }
  clipId(paths) { const id = this.id('c'); const ps = (Array.isArray(paths) ? paths : [paths]).map(p => `<path d="${dstr(p)}"/>`).join(''); this.defs.push(`<clipPath id="${id}">${ps}</clipPath>`); return id; }
  clip(paths, inner) { return `<g clip-path="url(#${this.clipId(paths)})">${Array.isArray(inner) ? inner.join('') : inner}</g>`; }
  // ambient occlusion: dark inner edge towards bottom-right, clipped to silhouette
  ao(path, bbox, k = 0.24) {
    const [x, y, w, h] = bbox;
    const g = this.lgs([[0, '#2b2118', 0], [.55, '#2b2118', 0], [1, '#2b2118', k]], 0, 0, 1, 1);
    return this.clip(path, `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${g}"/>`);
  }
  // top-left light wash clipped to silhouette
  wash(path, bbox, k = 0.35) {
    const [x, y, w, h] = bbox;
    const g = this.lgs([[0, '#ffffff', k], [.45, '#ffffff', 0], [1, '#ffffff', 0]], 0, 0, 1, 1);
    return this.clip(path, `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${g}"/>`);
  }
  spec(cx, cy, rx, ry, rot = -35, op = 0.85) {
    const g = this.rgs([[0, '#ffffff', op], [1, '#ffffff', 0]], .5, .5, .5);
    return `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" transform="rotate(${rot} ${f(cx)} ${f(cy)})" fill="${g}"/>`;
  }
  // thin white glint line (glossy edge)
  glint(path, w = 1.6, op = .7) { return `<path d="${dstr(path)}" stroke="#fff" stroke-opacity="${op}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`; }
  // extruded thickness (front lip towards the bottom) drawn beneath the top face
  lip(path, color, h = 5) { return this.shape(path.move(0, h), shade(color, -0.3), { flat: true, stroke: edge(color) }); }
  // foil/plastic crimp ribs. dir 'v' = ribs run vertically (seal at top/bottom), 'h' = ribs horizontal (seal at left/right end)
  crimp(x, y, w, h, color, dir = 'v') {
    const out = [`<g>`];
    const step = 2.6; const n = Math.max(2, Math.floor((dir === 'v' ? w : h) / step));
    out.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${shade(color, -0.04)}"/>`);
    for (let i = 0; i < n; i++) {
      const o = i * ((dir === 'v' ? w : h) / n); const sz = ((dir === 'v' ? w : h) / n);
      const c = i % 2 ? shade(color, 0.22) : shade(color, -0.22);
      out.push(dir === 'v' ? `<rect x="${f(x + o)}" y="${f(y)}" width="${f(sz * .55)}" height="${f(h)}" fill="${c}" opacity=".75"/>` : `<rect x="${f(x)}" y="${f(y + o)}" width="${f(w)}" height="${f(sz * .55)}" fill="${c}" opacity=".75"/>`);
    }
    out.push(`</g>`); return out.join('');
  }
  svg(extra = '') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.w} ${this.h}" width="${this.w}" height="${this.h}"${extra}><defs>${this.defs.join('')}</defs>${this.body.join('')}</svg>\n`;
  }
}
