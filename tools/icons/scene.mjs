// scene-test composite: 36 px per tile
import path from 'path';
export function scene(root) {
  const U = 'file://' + path.join(root, 'assets') + '/';
  const T = 36, W = 22, H = 14;
  const im = (src, x, y, w, h, extra = '') => `<img src="${U}${src}" style="position:absolute;left:${x * T}px;top:${y * T}px;width:${w}px;height:${h}px;${extra}">`;
  const prop = (n, x, y, tw, th) => im(`props/${n}.svg`, x, y, tw * T, th * T);
  const prod = (s, x, y, px) => im(`products/${s}.svg`, x * T + (T - px) / 2, y * T + (T - px) / 2, px, px);
  const shop = (dir, fr, x, y) => im(`shopper/walk-${dir}-${fr}.svg`, x * T + T / 2 - 29, y * T + T / 2 - 29, 58, 58);
  let h = '';
  // shelf rows (drawn by the game normally): simple wood shelf bands
  const shelf = (x, y, w) => `<div style="position:absolute;left:${x * T}px;top:${y * T}px;width:${w * T}px;height:${T}px;background:linear-gradient(#cdb48c,#a98f64);border:1px solid #7a6440;border-radius:3px;box-shadow:inset 0 -4px 0 rgba(0,0,0,.15)"></div>`;
  h += shelf(1, 1, 8) + shelf(1, 3, 8);
  const row1 = ['milk-full', 'yogurt', 'eggs', 'butter', 'cola', 'chips', 'rice', 'tea'], row2 = ['baladi-bread', 'tomatoes', 'honey', 'fava-beans', 'detergent', 'chocolate', 'olive-oil', 'water-pack'];
  row1.forEach((s, i) => h += prod(s, 1 + i, 1, 40)); row2.forEach((s, i) => h += prod(s, 1 + i, 3, 36));
  h += prop('plant', 0, 0, 1, 1) + prop('plant', 9, 5, 1, 1) + prop('pillar', 10, 1, 1, 1) + prop('pallet-water', 12, 0.5, 4, 2) + prop('promo-stand', 12, 3, 4, 2);
  h += prop('cart-park', 17, 0, 3, 2) + prop('basket-stack', 20, 2, 1, 1) + prop('wet-floor-sign', 5, 5, 1, 1);
  h += prop('checkout-lane', 1, 7, 6, 1) + prop('cashier-kiosk', 0, 7, 1, 1) + prop('checkout-lane', 1, 9, 6, 1) + prop('cashier-kiosk', 0, 9, 1, 1);
  h += prop('doormat', 8, 11, 3, 2) + prop('entrance-door', 8, 13, 3, 1) + prop('shopping-cart', 13, 6, 1, 1);
  h += shop('down', 0, 3, 5) + shop('right', 1, 5, 8) + shop('left', 2, 8, 6) + shop('up', 3, 12, 10) + shop('down', 1, 15, 8);
  return { w: W * T, h: H * T, html: `<body style="margin:0;width:${W * T}px;height:${H * T}px;position:relative;overflow:hidden;background-color:#e9dcc3;background-image:linear-gradient(#d9c9a8 1px,transparent 1px),linear-gradient(90deg,#d9c9a8 1px,transparent 1px);background-size:${T}px ${T}px">${h}</body>` };
}
