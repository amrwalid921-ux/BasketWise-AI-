// Shopping cart (red plastic basket + chrome frame) drawn top-down with any of 4 orientations.
import { Path, rrP, ellP, polyP, shade, edge, f } from '../svgkit.mjs';
// rot: 0 handle at bottom, 90 handle at left, 180 handle at top, -90 handle at right
export function cart(d, o) {
  const { cx, cy, W, H, rot = 0 } = o; const sh = o.shadow !== false;
  const a = rot * Math.PI / 180, ca = Math.round(Math.cos(a)), sa = Math.round(Math.sin(a));
  const T = (u, v) => [cx + u * ca - v * sa, cy + u * sa + v * ca];
  const P = p => p.map(T);
  const hv = H / 2 + (o.hd ?? 12); // handle v
  const red = '#d6403a', chrome = '#c9d0d6';
  const basket = rrP(-W / 2, -H / 2, W, H, 5), inner = rrP(-W / 2 + 4.2, -H / 2 + 4.2, W - 8.4, H - 8.4, 2.5);
  const bw = P(basket), iw = P(inner);
  const bbox = pts => { const xs = [], ys = []; const q = pts.c; for (const c of q) for (let i = 1; i < c.length; i += 2) { xs.push(c[i]); ys.push(c[i + 1]); } return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
  const [bx0, by0, bx1, by1] = bbox(bw), [ix0, iy0, ix1, iy1] = bbox(iw);
  const rails = [-1, 1].map(s => new Path().M(...T(s * (W / 2 - 6), H / 2 - 3)).L(...T(s * (W / 2 - 8), hv)));
  const bar = rrP(-(W / 2 - 4), hv - 2.6, W - 8, 5.2, 2.6);
  const out = [];
  if (sh) d.shadow([bw, ...rails.map(r => polyP([[0, 0]]) && r), P(bar)].filter(Boolean).map((p, i) => i === 1 || i === 2 ? p : p), { dx: o.sdx, dy: o.sdy });
  // wheels
  const wh = [[-1, -1, 4], [1, -1, 4], [-1, 1, 7], [1, 1, 7]].map(([sx, sy, k]) => T(sx * (W / 2 - 3), sy * (sy < 0 ? H / 2 - 5 : H / 2 + k)));
  for (const [x, y] of wh) out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(W * .1)}" fill="#4a4640" stroke="#2b2620" stroke-width=".8"/><circle cx="${f(x - 0.4)}" cy="${f(y - .4)}" r="${f(W * .04)}" fill="#9a948a"/>`);
  // chrome rails + handle
  for (const r of rails) out.push(d.stroke(r, '#7d868d', 3.6), d.stroke(r, chrome, 2.4), d.stroke(r.move(-.5, -.6), '#fff', .8, .7));
  out.push(d.shape(P(bar), chrome, { dir: 'v', a: .4, b: .3, stroke: '#7d868d', sw: 1 }));
  for (const s of [-1, 1]) { const g = rrP(s > 0 ? W / 2 - 4 - 9 : -(W / 2 - 4), hv - 3.2, 9, 6.4, 3); out.push(d.shape(P(g), red, { a: .3, b: .25 })); }
  // basket: front lip (world +y) then body
  out.push(`<path d="${bw.move(0, 2.4).str()}" fill="${shade(red, -.38)}" stroke="${edge(red)}" stroke-width="1.2"/>`);
  out.push(d.shape(bw, red, { dir: 'tl', a: .28, b: .22, sw: 1.4 }));
  // interior: light wire floor + grid
  out.push(`<path d="${iw.str()}" fill="${d.lgs([[0, '#cfd5d9'], [.3, '#eef1f3'], [1, '#f6f8f9']], 0, 0, 1, 1)}" stroke="${shade(red, -.45)}" stroke-width="1"/>`);
  let grid = ''; const gs = o.grid ?? 4.4;
  for (let u = -W / 2 + 4.2; u <= W / 2 - 4.2; u += gs) { const [x1, y1] = T(u, -H / 2 + 4.2), [x2, y2] = T(u, H / 2 - 4.2); grid += `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`; }
  for (let v = -H / 2 + 4.2; v <= H / 2 - 4.2; v += gs) { const [x1, y1] = T(-W / 2 + 4.2, v), [x2, y2] = T(W / 2 - 4.2, v); grid += `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`; }
  out.push(d.clip(iw, `<path d="${grid}" stroke="#97a1a8" stroke-width=".8" fill="none" opacity=".85"/><path d="${grid}" stroke="#fff" stroke-width=".6" fill="none" opacity=".6" transform="translate(-.5 -.5)"/>`));
  // inner wall shading (top-left walls shadowed), floor AO
  out.push(d.clip(iw, `<path d="M${f(ix0)} ${f(iy0)}H${f(ix1)}V${f(iy0 + 3.4)}H${f(ix0 + 3.4)}V${f(iy1)}H${f(ix0)}Z" fill="#2b2118" opacity=".26"/>`));
  out.push(`<path d="${bw.str()}" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1" transform="translate(-.4 -.4)" clip-path="none"/>`);
  // nose bumper
  const [nx1, ny1] = T(-(W / 2 - 5), -H / 2 - 1.6), [nx2, ny2] = T(W / 2 - 5, -H / 2 - 1.6);
  out.push(d.stroke(new Path().M(nx1, ny1).L(nx2, ny2), '#7d868d', 3), d.stroke(new Path().M(nx1, ny1).L(nx2, ny2), chrome, 1.8));
  d.add(out.join(''));
  return { inner: [ix0, iy0, ix1 - ix0, iy1 - iy0], outer: [bx0, by0, bx1 - bx0, by1 - by0] };
}
