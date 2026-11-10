// Review renderer: contact sheets via Playwright chromium + validation
import { createRequire } from 'module';
import fs from 'fs'; import path from 'path';
const require = createRequire('/opt/npm-tools/node_modules/');
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
const FLOOR = `background-color:#e9dcc3;background-image:linear-gradient(#d9c9a8 1px,transparent 1px),linear-gradient(90deg,#d9c9a8 1px,transparent 1px);background-size:72px 72px;`;
export async function review(root, { products, props, shopper }) {
  const { chromium } = require('playwright');
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--no-sandbox'] });
  const A = path.join(root, 'assets'), R = path.join(A, '_review');
  const errors = [];
  const shot = async (name, html, w, h) => {
    const pg = await br.newPage({ viewport: { width: w, height: h } });
    pg.on('console', m => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
    fs.writeFileSync(path.join(R, '_tmp.html'), html);
    await pg.goto('file://' + path.join(R, '_tmp.html')); await pg.waitForTimeout(300);
    const bad = await pg.evaluate(() => [...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.src));
    bad.forEach(b => errors.push('broken image ' + b));
    await pg.screenshot({ path: path.join(R, name), fullPage: false }); await pg.close();
  };
  // product sheets
  const per = 30, cols = 6, cell = 200;
  const sheets = Math.ceil(products.length / per);
  for (let s = 0; s < sheets; s++) {
    const items = products.slice(s * per, (s + 1) * per);
    const rows = Math.ceil(items.length / cols);
    const html = `<body style="margin:0;${FLOOR}font:11px monospace;color:#3a342e"><div style="display:grid;grid-template-columns:repeat(${cols},${cell}px)">${items.map(p => `<div style="width:${cell}px;height:${cell + 28}px;text-align:center"><img src="../products/${p}.svg" width="176" height="176" style="margin-top:6px"><div>${p}</div><img src="../products/${p}.svg" width="40" height="40" style="vertical-align:middle"> <img src="../products/${p}.svg" width="64" height="64" style="vertical-align:middle"></div>`).join('')}</div></body>`;
    await shot(`products-sheet-${s + 1}.png`, html, cols * cell, rows * (cell + 28) + 10);
  }
  // props
  const pe = Object.entries(props);
  await shot('props-sheet.png', `<body style="margin:0;padding:12px;${FLOOR}font:11px monospace"><div style="display:flex;flex-wrap:wrap;gap:20px;width:1250px">${pe.map(([n, v]) => `<div><img src="../props/${n}.svg" width="${v.w * 72 * 1.5}" height="${v.h * 72 * 1.5}"><div>${n}</div></div>`).join('')}</div></body>`, 1280, 1000);
  // shopper
  const dirs = ['down', 'up', 'left', 'right'];
  await shot('shopper-sheet.png', `<body style="margin:0;padding:8px;${FLOOR}font:11px monospace"><div style="display:grid;grid-template-columns:repeat(4,288px)">${dirs.flatMap(dr => [0, 1, 2, 3].map(fr => `<div><img src="../shopper/walk-${dr}-${fr}.svg" width="288" height="288"></div>`)).join('')}</div><div style="margin-top:6px">${dirs.flatMap(dr => [0, 1, 2, 3].map(fr => `<img src="../shopper/walk-${dr}-${fr}.svg" width="58" height="58">`)).join('')}</div></body>`, 1180, 1250);
  await br.close();
  return errors;
}
export async function sceneTest(root, scene) {
  const { chromium } = require('playwright');
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--no-sandbox'] });
  const R = path.join(root, 'assets', '_review');
  const pg = await br.newPage({ viewport: { width: scene.w, height: scene.h } });
  fs.writeFileSync(path.join(R, '_tmp.html'), scene.html);
  await pg.goto('file://' + path.join(R, '_tmp.html')); await pg.waitForTimeout(300);
  await pg.screenshot({ path: path.join(R, 'scene-test.png') }); await br.close();
  fs.rmSync(path.join(R, '_tmp.html'), { force: true });
}
