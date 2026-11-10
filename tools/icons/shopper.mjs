// Shopper walk cycle (top-down, high angle). 4 directions x 4 frames, pushing a red/chrome cart.
import { Doc, Path, ellP, rrP, shade, edge, f } from '../svgkit.mjs';
import { cart } from './cart.mjs';
const SKIN = '#e8b98f', HAIR = '#2e2420', TEAL = '#25a59e', JEANS = '#3b6db3', SHOE = '#f6f5f0', SOLE = '#c9c4b8';
const L = [0, 1, 0, -1], BOB = [0, 1, 0, 1], SWAY = [0, 1, 0, -1];

export function drawShopper(dir, fr) {
  const d = new Doc(144, 144, { sdx: 5, sdy: 6, sblur: 2.4, sop: .28 });
  const lg = L[fr], bob = BOB[fr], sw = SWAY[fr] * 1.4;
  const mir = dir === 'right'; const X = x => mir ? 144 - x : x;
  const limb = (pts, w, c, edgeC) => { const p = new Path(); pts.forEach(([x, y], i) => i ? p.L(x, y) : p.M(x, y)); return d.stroke(p, edgeC ?? edge(c), w + 2.2) + d.stroke(p, c, w) + d.stroke(p.move(-.8, -1), '#fff', Math.max(1, w * .22), .28); };
  const shoe = (x, y, rx, ry, rot = 0) => `<ellipse cx="${f(x + .8)}" cy="${f(y + 1.8)}" rx="${rx}" ry="${ry}" fill="${SOLE}" stroke="#8d8478" stroke-width="1" transform="rotate(${rot} ${f(x)} ${f(y)})"/>` + d.shape(ellP(x, y, rx, ry, rot), SHOE, { a: .25, b: .18, stroke: '#9a968c', sw: 1.1 }) + `<path d="M${f(x - rx * .3)} ${f(y - ry * .1)}l${f(rx * .5)} ${f(ry * .1)}" stroke="#b9b4a6" stroke-width=".9" transform="rotate(${rot} ${f(x)} ${f(y)})"/>`;
  const head = (hx, hy, kind) => {
    let s = '';
    s += `<ellipse cx="${f(kind === 'side' ? X(hx) : hx)}" cy="${f(hy + 1)}" rx="12.2" ry="12" fill="${SKIN}" stroke="${edge(SKIN)}" stroke-width="1.2"/>`;
    if (kind === 'down') {
      s += `<circle cx="${hx - 12}" cy="${hy + 2}" r="2.8" fill="${SKIN}" stroke="${edge(SKIN)}" stroke-width="1"/><circle cx="${hx + 12}" cy="${hy + 2}" r="2.8" fill="${SKIN}" stroke="${edge(SKIN)}" stroke-width="1"/>`;
      s += d.shape(ellP(hx, hy - 3.5, 12.6, 9.6), HAIR, { dir: 'tl', a: .35, b: .2, stroke: '#14100e', sw: 1.2 });
      s += `<circle cx="${hx - 4.2}" cy="${hy + 6.8}" r="1.15" fill="#2e2420"/><circle cx="${hx + 4.2}" cy="${hy + 6.8}" r="1.15" fill="#2e2420"/><path d="M${hx - 2.4} ${hy + 10.2}q2.4 1.5 4.8 0" stroke="#a8503a" stroke-width="1" fill="none" stroke-linecap="round"/>`;
      s += `<path d="M${hx - 9} ${hy - 3}q5 -6 11 -5" stroke="#fff" stroke-width="1.8" fill="none" opacity=".3" stroke-linecap="round"/>`;
    } else if (kind === 'up') {
      s += `<circle cx="${hx - 12}" cy="${hy + 3}" r="2.8" fill="${SKIN}" stroke="${edge(SKIN)}" stroke-width="1"/><circle cx="${hx + 12}" cy="${hy + 3}" r="2.8" fill="${SKIN}" stroke="${edge(SKIN)}" stroke-width="1"/>`;
      s += d.shape(ellP(hx, hy + 1.2, 12.8, 12.2), HAIR, { dir: 'tl', a: .4, b: .2, stroke: '#14100e', sw: 1.2 });
      s += `<path d="M${hx - 3} ${hy - 6}q6 2 5 9" stroke="#fff" stroke-width="1.4" fill="none" opacity=".18"/><path d="M${hx - 8} ${hy - 5}q4 -5 10 -4" stroke="#fff" stroke-width="1.8" fill="none" opacity=".3" stroke-linecap="round"/>`;
    } else { // side, facing left (x mapped for right)
      s += `<ellipse cx="${f(X(hx + 3))}" cy="${f(hy + 2.5)}" rx="2.4" ry="3.4" fill="${SKIN}" stroke="${edge(SKIN)}" stroke-width="1"/>`;
      s += d.shape(ellP(X(hx + 1.8), hy - .4, 11.2, 11.6), HAIR, { dir: 'tl', a: .4, b: .2, stroke: '#14100e', sw: 1.2 });
      s += `<circle cx="${f(X(hx - 8.4))}" cy="${f(hy + 2.2)}" r="1.1" fill="#2e2420"/>`;
      s += `<path d="${new Path().M(X(hx - 4), hy - 7).Q(X(hx + 2), hy - 10, X(hx + 6), hy - 6).str()}" stroke="#fff" stroke-width="1.8" fill="none" opacity=".3" stroke-linecap="round"/>`;
    }
    return s;
  };
  let basket;
  const sh = [];
  if (dir === 'down' || dir === 'up') {
    const dn = dir === 'down';
    const cy = dn ? 98 : 42, hd = 12, W = 52, H = 42;
    const sy = dn ? 46 : 96; // shoulder y
    const hy = dn ? 30 : 83;
    const handleY = dn ? cy - (H / 2 + hd) : cy + (H / 2 + hd);
    // shadows for the person
    d.shadow([ellP(72, sy, 25, 12.5), ellP(72, hy, 12.5, 12.5), rrP(56, dn ? 50 : 100, 32, 22, 6)]);
    // legs + feet (drawn before cart)
    const fy = dn ? 63 : 115;
    const dirS = dn ? 1 : -1;
    const fl = fy + dirS * 5 * lg, fr_ = fy - dirS * 5 * lg;
    d.add(limb([[62, sy + (dn ? 4 : 2)], [61, dn ? 56 : 108], [61, fl - dirS * 2]], 10.5, JEANS), limb([[82, sy + (dn ? 4 : 2)], [83, dn ? 56 : 108], [83, fr_ - dirS * 2]], 10.5, JEANS));
    d.add(shoe(61, fl + dirS * 3.5, 6.4, 8.2), shoe(83, fr_ + dirS * 3.5, 6.4, 8.2));
    basket = cart(d, { cx: 72, cy: cy + bob, W, H, rot: dn ? 180 : 0, hd });
    const b0 = cart(new Doc(144, 144), { cx: 72, cy, W, H, rot: dn ? 180 : 0, hd, shadow: false }).inner; basket = b0;
    // torso
    const tors = ellP(72, sy, 25, 12.5);
    d.add(d.shape(tors, TEAL, { dir: 'tl', a: .35, b: .3, stroke: '#145f5a', sw: 1.3 }), d.clip(tors, `<ellipse cx="72" cy="${sy + 8}" rx="26" ry="7" fill="#145f5a" opacity=".25"/>`), `<path d="M${72 - 14} ${sy - 7}q14 -4 28 0" stroke="#fff" stroke-width="2" fill="none" opacity=".35" stroke-linecap="round"/>`);
    if (dn) d.add(`<path d="M66 ${sy - 11.5}q6 8 12 0" fill="${SKIN}" stroke="${edge(SKIN)}" stroke-width="1"/>`);
    // arms to handle
    const hy2 = handleY + bob;
    for (const s of [-1, 1]) {
      const sx = 72 + s * 22, hx = 72 + s * 17, ex = 72 + s * 25 + 0, ey = (sy + hy2) / 2 + sw * s * (dn ? 1 : 1);
      d.add(limb([[sx, sy + (dn ? 1 : -1)], [ex, ey]], 8.4, TEAL, '#145f5a'), limb([[ex, ey], [hx, hy2]], 5.6, SKIN), `<circle cx="${hx}" cy="${hy2}" r="3.6" fill="${SKIN}" stroke="${edge(SKIN)}" stroke-width="1"/>`);
    }
    d.add(head(72, hy, dir));
  } else {
    // side views. layout for 'left'; 'right' mirrored through X()
    const cx = X(52), sx = 98, sy = 76, hx = 95, hy = 59;
    const handleX = 52 + 20 + 12; // left layout
    d.shadow([ellP(X(sx), sy, 11.5, 22), ellP(X(hx), hy, 12.2, 12.2), rrP(X(sx) - 11, 90, 22, 22, 6)]);
    const fyA = 106, fyB = 99;
    // feet / legs: legs go down the image, feet shift along x
    const fa = 94 + 7 * lg * 1, fb = 94 - 7 * lg * 1;
    d.add(limb([[X(sx), 92], [X(sx - 1), 100], [X(fb), fyB]], 9.5, JEANS), limb([[X(sx), 96], [X(sx), 104], [X(fa), fyA]], 10.5, JEANS));
    d.add(shoe(X(fb - 3), fyB + 3, 8.2, 5.6), shoe(X(fa - 3), fyA + 3.5, 8.6, 6));
    const b0 = cart(new Doc(144, 144), { cx, cy: 72, W: 46, H: 40, rot: dir === 'left' ? -90 : 90, hd: 12, shadow: false }).inner; basket = b0;
    cart(d, { cx, cy: 72 + bob, W: 46, H: 40, rot: dir === 'left' ? -90 : 90, hd: 12 });
    const tors = ellP(X(sx), sy, 11.5, 22.5);
    d.add(d.shape(tors, TEAL, { dir: 'tl', a: .35, b: .3, stroke: '#145f5a', sw: 1.3 }), d.clip(tors, `<ellipse cx="${X(sx + 9)}" cy="${sy}" rx="7" ry="24" fill="#145f5a" opacity=".28"/>`), `<path d="${new Path().M(X(sx - 6), sy - 14).Q(X(sx - 8), sy - 2, X(sx - 6), sy + 8).str()}" stroke="#fff" stroke-width="2" fill="none" opacity=".3" stroke-linecap="round"/>`);
    // arms (two) towards the handle at x=handleX
    const hxx = handleX + 1;
    for (const [oy, hyy] of [[-17, -8], [17, 8]]) {
      const ex = sx - 8 + sw * 1.2, ey = sy + oy + hyy * .2;
      d.add(limb([[X(sx - 2), sy + oy], [X(ex), ey]], 8.2, TEAL, '#145f5a'), limb([[X(ex), ey], [X(hxx), 72 + hyy + bob]], 5.4, SKIN), `<circle cx="${X(hxx)}" cy="${72 + hyy + bob}" r="3.5" fill="${SKIN}" stroke="${edge(SKIN)}" stroke-width="1"/>`);
    }
    d.add(head(hx, hy, 'side'));
  }
  return { doc: d, basket };
}
