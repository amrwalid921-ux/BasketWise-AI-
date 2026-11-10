// Realistic 3D supermarket renderer (Three.js).
// Read-only mirror of the 2D Game: it never changes game state, algorithms or the plan.
// 1 grid cell = 1 world unit (x -> cell x, z -> cell y, y -> up).
import * as THREE from 'three';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const FONT = '"Cairo","Segoe UI",Tahoma,Arial,sans-serif';
const CEIL = 3.9;
const EYE = 1.62;

// ---------------------------------------------------------------- tiny helpers
const rnd = (() => { let s = 1234567; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(canvas, { repeat, aniso = 8, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function shade(hex, k) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return c;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ---------------------------------------------------------------- procedural textures
function floorTexture() {
  const S = 512, c = mkCanvas(S, S), x = c.getContext('2d');
  x.fillStyle = '#d9dadb'; x.fillRect(0, 0, S, S);
  // 2x2 tiles per texture, subtle per-tile tone + speckle
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const v = 214 + Math.floor(rnd() * 14);
    x.fillStyle = `rgb(${v},${v + 1},${v + 3})`;
    x.fillRect(i * 256 + 2, j * 256 + 2, 252, 252);
    const g = x.createLinearGradient(i * 256, j * 256, i * 256 + 256, j * 256 + 256);
    g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.05)');
    x.fillStyle = g; x.fillRect(i * 256 + 2, j * 256 + 2, 252, 252);
  }
  for (let n = 0; n < 2600; n++) { x.fillStyle = `rgba(${rnd() < .5 ? '255,255,255' : '90,95,100'},${0.03 + rnd() * 0.05})`; x.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 2, 1 + rnd() * 2); }
  x.strokeStyle = 'rgba(80,86,92,.55)'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(0, 1); x.lineTo(S, 1); x.moveTo(1, 0); x.lineTo(1, S); x.moveTo(0, 257); x.lineTo(S, 257); x.moveTo(257, 0); x.lineTo(257, S); x.stroke();
  return c;
}
function plasterTexture() {
  const c = mkCanvas(256, 256), x = c.getContext('2d');
  x.fillStyle = '#f3efe6'; x.fillRect(0, 0, 256, 256);
  for (let n = 0; n < 1800; n++) { x.fillStyle = `rgba(${rnd() < .5 ? '255,255,255' : '120,110,95'},${0.02 + rnd() * 0.04})`; x.fillRect(rnd() * 256, rnd() * 256, 2, 2); }
  return c;
}
function ceilingTexture() {
  const c = mkCanvas(256, 256), x = c.getContext('2d');
  x.fillStyle = '#eceff1'; x.fillRect(0, 0, 256, 256);
  for (let n = 0; n < 1400; n++) { x.fillStyle = `rgba(80,90,100,${0.03 + rnd() * 0.05})`; x.fillRect(rnd() * 256, rnd() * 256, 1.5, 1.5); }
  x.strokeStyle = '#b9c0c6'; x.lineWidth = 4; x.strokeRect(2, 2, 252, 252);
  return c;
}
function metalTexture(base = '#c9ced3') {
  const c = mkCanvas(128, 128), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#e2e6ea'); g.addColorStop(0.5, base); g.addColorStop(1, '#a9afb5');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(255,255,255,${rnd() * 0.12})`; x.fillRect(0, rnd() * 128, 128, 1); }
  return c;
}
function bannerTexture(ar, en, color) {
  const W = 1024, H = 256, c = mkCanvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#ffffff'; roundRect(x, 6, 6, W - 12, H - 12, 36); x.fill();
  x.fillStyle = color; roundRect(x, 16, 16, W - 32, H - 32, 28); x.fill();
  x.fillStyle = 'rgba(0,0,0,.14)'; x.fillRect(16, H - 74, W - 32, 58);
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
  x.font = `900 110px ${FONT}`; x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 6; x.shadowOffsetY = 3;
  x.fillText(ar, W / 2, 102);
  x.shadowColor = 'transparent'; x.direction = 'ltr';
  x.font = `800 44px ${FONT}`; x.fillText(String(en).toUpperCase(), W / 2, H - 46);
  return c;
}
function priceTexture(price, discount) {
  const c = mkCanvas(128, 64), x = c.getContext('2d');
  x.fillStyle = discount > 0 ? '#ffd93d' : '#ffffff'; roundRect(x, 2, 2, 124, 60, 8); x.fill();
  x.strokeStyle = '#222'; x.lineWidth = 3; roundRect(x, 2, 2, 124, 60, 8); x.stroke();
  x.fillStyle = '#111'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `900 40px ${FONT}`; x.fillText(`${price}`, 50, 34);
  x.font = `800 22px ${FONT}`; x.fillText('ج', 100, 38);
  return c;
}
function signTexture(lines, bg = '#111', fg = '#ffd93d', w = 512, h = 192) {
  const c = mkCanvas(w, h), x = c.getContext('2d');
  x.fillStyle = bg; roundRect(x, 4, 4, w - 8, h - 8, 22); x.fill();
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  lines.forEach((l, i) => { x.font = `900 ${l.size || 70}px ${FONT}`; x.fillText(l.t, w / 2, l.y || (h / (lines.length + 1)) * (i + 1)); });
  return c;
}

function photoInfo(img) {
  const sm = mkCanvas(24, 24), sx = sm.getContext('2d'); sx.drawImage(img, 0, 0, 24, 24);
  const d = sx.getImageData(0, 0, 24, 24).data; let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 200) continue; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  const c = n ? new THREE.Color(r / n / 255, g / n / 255, b / n / 255) : new THREE.Color('#bbbbbb');
  return { color: c.multiplyScalar(0.72), aspect: img.width / img.height };
}
function packTexture(img, nameAr) {
  // average colour of the icon (ignoring transparent / near-white pixels)
  const sm = mkCanvas(32, 32), sx = sm.getContext('2d'); sx.drawImage(img, 0, 0, 32, 32);
  const d = sx.getImageData(0, 0, 32, 32).data; let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 200) continue; if (d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235) continue; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  const avg = n ? new THREE.Color(r / n / 255, g / n / 255, b / n / 255) : new THREE.Color('#d9a66a');
  const hsl = {}; avg.getHSL(hsl);
  const main = new THREE.Color().setHSL(hsl.h, clamp(hsl.s * 0.9 + 0.1, 0.25, 0.85), clamp(hsl.l, 0.32, 0.52));
  const lite = new THREE.Color().setHSL(hsl.h, clamp(hsl.s, 0.2, 0.8), 0.68);
  const W = 256, H = 320, c = mkCanvas(W, H), x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#' + lite.getHexString()); gr.addColorStop(1, '#' + main.getHexString());
  x.fillStyle = gr; x.fillRect(0, 0, W, H);
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, 74);
  x.fillStyle = '#' + main.getHexString(); x.fillRect(0, 74, W, 8);
  x.fillStyle = '#111'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
  let fs = 34; x.font = `900 ${fs}px ${FONT}`;
  const label = String(nameAr || '').replace(/\s*\(.*\)\s*/, '');
  while (x.measureText(label).width > W - 24 && fs > 16) { fs -= 2; x.font = `900 ${fs}px ${FONT}`; }
  x.fillText(label, W / 2, 38);
  x.drawImage(img, 28, 92, 200, 200);
  x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 6; x.strokeRect(3, 3, W - 6, H - 6);
  return { canvas: c, color: main.clone().multiplyScalar(0.82) };
}

// ---------------------------------------------------------------- the scene
export class Scene3D {
  constructor(container, game, store, assets, opts = {}) {
    this.container = container;
    this.game = game;
    this.store = store;
    this.assets = assets;
    this.opts = opts;
    this.mode = opts.mode || 'first'; // 'first' | 'aerial'
    this.alive = true;
    this.t = 0;
    this.last = performance.now();
    this.yaw = Math.PI; // facing -z (north) is rotation.y = 0 ; we set properly below
    this.pos = new THREE.Vector3(3.5, EYE, 21.2);
    this.cartItems = new Map();
    this.heroes = new Map();
    this.pathKey = null;
    this.aerial = { yaw: 0.35, pitch: 0.82, dist: 36, tx: 21, tz: 11.5 };

    const W = store.grid.w, H = store.grid.h;
    this.W = W; this.H = H;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.canvas = this.renderer.domElement;
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab';
    container.appendChild(this.canvas);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#dfe6ee');
    this.scene.fog = new THREE.Fog('#e9eef3', 34, 78);
    this.camera = new THREE.PerspectiveCamera(68, 1.8, 0.05, 140);

    this.buildLights();
    this.buildMaterials();
    this.buildShell();
    this.buildFixtures();
    this.buildProducts();
    this.buildDeco();
    this.buildSigns();
    this.buildPeople();
    this.buildCart();
    this.buildPathObjects();

    this.bindInput();
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  // ------------------------------------------------------------ lights
  buildLights() {
    const hemi = new THREE.HemisphereLight('#ffffff', '#b9bcc2', 1.25);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff6e6', 1.15);
    sun.position.set(this.W * 0.5 + 8, 22, this.H * 0.5 - 6);
    sun.target.position.set(this.W * 0.5, 0, this.H * 0.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -this.W * 0.62; sc.right = this.W * 0.62; sc.top = this.H * 0.75; sc.bottom = -this.H * 0.75; sc.near = 1; sc.far = 70;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);
    // warm fill that follows the shopper (makes aisles look lit by overhead tubes)
    this.fill = new THREE.PointLight('#fff3df', 14, 14, 1.6);
    this.fill.position.set(3, 3.2, 20);
    this.scene.add(this.fill);
  }

  buildMaterials() {
    const aniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const TI = (this.opts && this.opts.textures) || {};
    const real = (im, rep) => { const t = new THREE.Texture(im); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = aniso; t.needsUpdate = true; return t; };
    this.m = {
      floor: new THREE.MeshStandardMaterial({ map: TI.floor ? real(TI.floor, [this.W / 3, this.H / 3]) : tex(floorTexture(), { repeat: [this.W / 2, this.H / 2], aniso }), roughness: 0.28, metalness: 0.12 }),
      wall: new THREE.MeshStandardMaterial({ map: tex(plasterTexture(), { repeat: [this.W / 4, 1], aniso }), roughness: 0.9 }),
      ceiling: new THREE.MeshStandardMaterial({ map: TI.ceiling ? real(TI.ceiling, [this.W / 4, this.H / 4]) : tex(ceilingTexture(), { repeat: [this.W / 2, this.H / 2], aniso }), roughness: 0.95 }),
      metal: new THREE.MeshStandardMaterial({ map: tex(metalTexture(), { repeat: [1, 1], aniso }), roughness: 0.4, metalness: 0.75 }),
      darkMetal: new THREE.MeshStandardMaterial({ color: '#4a525a', roughness: 0.5, metalness: 0.7 }),
      back: new THREE.MeshStandardMaterial({ color: '#f1f1ee', roughness: 0.85 }),
      white: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }),
      black: new THREE.MeshStandardMaterial({ color: '#16181a', roughness: 0.5, metalness: 0.2 }),
      glass: new THREE.MeshPhysicalMaterial({ color: '#cfe8f5', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
      light: new THREE.MeshBasicMaterial({ color: '#fffdf2' }),
      wood: new THREE.MeshStandardMaterial({ color: '#b58a58', roughness: 0.75 }),
      rubber: new THREE.MeshStandardMaterial({ color: '#23262a', roughness: 0.95 }),
      plastic: (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }),
    };
  }

  // ------------------------------------------------------------ building shell
  buildShell() {
    const { W, H } = this, m = this.m, sc = this.scene;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, H), m.floor);
    floor.rotation.x = -Math.PI / 2; floor.position.set(W / 2, 0, H / 2); floor.receiveShadow = true;
    sc.add(floor);
    // ceiling + light panels
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, H), m.ceiling);
    ceil.rotation.x = Math.PI / 2; ceil.position.set(W / 2, CEIL, H / 2);
    sc.add(ceil);
    const panels = [];
    for (let x = 3; x < W; x += 6) for (let z = 3; z < H; z += 4) {
      const g = new THREE.PlaneGeometry(3.6, 0.55); g.rotateX(Math.PI / 2); g.translate(x, CEIL - 0.02, z); panels.push(g);
    }
    sc.add(new THREE.Mesh(mergeGeometries(panels), m.light));
    // walls
    const wallH = CEIL;
    const mk = (w, x, z, ry) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, wallH), m.wall);
      mesh.position.set(x, wallH / 2, z); mesh.rotation.y = ry; mesh.receiveShadow = true; sc.add(mesh);
      // blue brand stripe
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.28), new THREE.MeshStandardMaterial({ color: '#1f6fe5', roughness: 0.6 }));
      stripe.position.set(x, 3.05, z); stripe.rotation.y = ry;
      stripe.translateZ(ry === 0 || ry === Math.PI ? 0.01 : 0.01); sc.add(stripe);
    };
    mk(W, W / 2, 0.02, 0);                       // north (faces +z)
    mk(H, 0.02, H / 2, Math.PI / 2);             // west
    mk(H, W - 0.02, H / 2, -Math.PI / 2);        // east
    // south wall with the entrance gap (cells 2..5)
    const ent = this.store.deco.find((d) => d.type === 'entrance-door');
    const x0 = ent ? ent.x : 2, x1 = ent ? ent.x + ent.w : 5;
    const south = (a, b) => {
      const w = b - a; if (w <= 0) return;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, wallH), m.wall);
      mesh.position.set((a + b) / 2, wallH / 2, H - 0.02); mesh.rotation.y = Math.PI; sc.add(mesh);
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.28), new THREE.MeshStandardMaterial({ color: '#1f6fe5', roughness: 0.6 }));
      stripe.position.set((a + b) / 2, 3.05, H - 0.03); stripe.rotation.y = Math.PI; sc.add(stripe);
    };
    south(0, x0); south(x1, W);
    // door header + glass doors
    const head = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, wallH - 2.6), m.wall);
    head.position.set((x0 + x1) / 2, 2.6 + (wallH - 2.6) / 2, H - 0.02); head.rotation.y = Math.PI; sc.add(head);
    const doorW = (x1 - x0) / 2;
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.06, 2.5, 0.05), m.glass);
      g.position.set(x0 + doorW * (i + 0.5), 1.25, H - 0.05); sc.add(g);
      const fr = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.02, 0.08, 0.08), m.darkMetal); fr.position.set(x0 + doorW * (i + 0.5), 2.52, H - 0.05); sc.add(fr);
    }
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 6, 6), new THREE.MeshBasicMaterial({ color: '#cfe6ff' }));
    sky.position.set((x0 + x1) / 2, 2.5, H + 1.2); sky.rotation.y = Math.PI; sc.add(sky);
    // skirting
    const skirt = new THREE.MeshStandardMaterial({ color: '#40464c', roughness: 0.6 });
    const sk = (w, d, x, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, d), skirt); b.position.set(x, 0.07, z); sc.add(b); };
    sk(W, 0.06, W / 2, 0.06); sk(0.06, H, 0.06, H / 2); sk(0.06, H, W - 0.06, H / 2);
    // pillars drawn in deco
  }

  // ------------------------------------------------------------ shelving fixtures
  fixtureStyle(f) {
    if (f.kind === 'wall') return { levels: [0.12, 0.62, 1.12, 1.62, 2.12], top: 2.62 };
    if (f.kind === 'island') return { levels: [0.1, 0.5, 0.9], top: 1.25 };
    return { levels: [0.12, 0.54, 0.96, 1.38], top: 1.78 };
  }
  buildFixtures() {
    const sc = this.scene, m = this.m;
    const metal = [], dark = [], backs = [], ends = [];
    this.fixStyle = new Map();
    for (const f of this.store.fixtures) {
      const st = this.fixtureStyle(f); this.fixStyle.set(f.id, st);
      const x0 = f.x, x1 = f.x + f.w;
      if (f.kind === 'wall') {
        // solid body behind the shelf + back panel + top cap
        const body = new THREE.BoxGeometry(f.w, st.top, 1.3); body.translate((x0 + x1) / 2, st.top / 2, 1.25);
        dark.push(body);
        const cap = new THREE.BoxGeometry(f.w + 0.08, 0.1, 0.9); cap.translate((x0 + x1) / 2, st.top + 0.05, 2.1); ends.push(cap);
        for (const lv of st.levels) { const b = new THREE.BoxGeometry(f.w, 0.05, 0.68); b.translate((x0 + x1) / 2, lv, 2.21); metal.push(b); }
        const back = new THREE.BoxGeometry(f.w, st.top, 0.04); back.translate((x0 + x1) / 2, st.top / 2, 1.86); backs.push(back);
        for (let x = x0; x <= x1; x++) { const u = new THREE.BoxGeometry(0.06, st.top, 0.7); u.translate(x, st.top / 2, 2.21); dark.push(u); }
        // kick plate
        const kick = new THREE.BoxGeometry(f.w, 0.1, 0.74); kick.translate((x0 + x1) / 2, 0.05, 2.25); ends.push(kick);
      } else {
        // double sided gondola/island: spine in the middle (z = f.y + 1)
        const zc = f.y + f.h / 2;
        const spine = new THREE.BoxGeometry(f.w, st.top, 0.12); spine.translate((x0 + x1) / 2, st.top / 2, zc); backs.push(spine);
        const foot = new THREE.BoxGeometry(f.w + 0.04, 0.14, 1.34); foot.translate((x0 + x1) / 2, 0.07, zc); ends.push(foot);
        const capb = new THREE.BoxGeometry(f.w + 0.04, 0.08, 1.34); capb.translate((x0 + x1) / 2, st.top + 0.04, zc); ends.push(capb);
        for (const dz of [-1, 1]) {
          for (const lv of st.levels) { const b = new THREE.BoxGeometry(f.w, 0.05, 0.62); b.translate((x0 + x1) / 2, lv, zc + dz * 0.34); metal.push(b); }
          for (let x = x0; x <= x1; x++) { const u = new THREE.BoxGeometry(0.06, st.top, 0.64); u.translate(x, st.top / 2, zc + dz * 0.34); dark.push(u); }
          const lip = new THREE.BoxGeometry(f.w, 0.12, 0.03); lip.translate((x0 + x1) / 2, 0.02, zc + dz * 0.66); ends.push(lip);
        }
        // end-cap boards
        for (const sx of [x0 - 0.01, x1 + 0.01]) { const e = new THREE.BoxGeometry(0.05, st.top, 1.3); e.translate(sx, st.top / 2, zc); dark.push(e); }
      }
    }
    const add = (geoms, mat, cast = true) => { if (!geoms.length) return; const mesh = new THREE.Mesh(mergeGeometries(geoms), mat); mesh.castShadow = cast; mesh.receiveShadow = true; sc.add(mesh); };
    add(metal, m.metal); add(dark, m.darkMetal); add(backs, m.back); add(ends, new THREE.MeshStandardMaterial({ color: '#e9ecef', roughness: 0.5, metalness: 0.2 }));
  }

  // ------------------------------------------------------------ products on shelves
  productKind(p) {
    const s = p.slug + ' ' + p.category;
    if (/water|juice|cola|soda|tea|drink|milk|oil|laban|yogurt|yoghurt|cream|bottle|energy/.test(s) || p.category === 'drinks') return { w: 0.17, h: 0.34, d: 0.17, cols: 4 };
    if (p.category === 'bakery') return { w: 0.3, h: 0.2, d: 0.2, cols: 3 };
    if (p.category === 'produce') return { w: 0.28, h: 0.2, d: 0.28, cols: 3 };
    if (p.category === 'frozen') return { w: 0.26, h: 0.26, d: 0.2, cols: 3 };
    if (p.category === 'household') return { w: 0.22, h: 0.34, d: 0.14, cols: 4 };
    if (p.category === 'meat') return { w: 0.28, h: 0.12, d: 0.24, cols: 3 };
    return { w: 0.22, h: 0.3, d: 0.15, cols: 4 };
  }
  buildProducts() {
    const sc = this.scene;
    this.texCache = new Map();
    this.packColor = new Map();
    const bySlug = new Map(this.store.products.map((q) => [q.slug, q]));
    this.photos = (this.opts && this.opts.photos) || new Map();
    this.photoInfo = new Map();
    const getTex = (slug) => {
      if (this.texCache.has(slug)) return this.texCache.get(slug);
      const ph = this.photos.get(slug);
      if (ph) {
        const info = photoInfo(ph); this.photoInfo.set(slug, info); this.packColor.set(slug, info.color);
        const t = new THREE.Texture(ph); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true;
        this.texCache.set(slug, t); return t;
      }
      const img = this.assets.products[slug];
      const pk = packTexture(img, bySlug.get(slug) && bySlug.get(slug).ar);
      const t = new THREE.CanvasTexture(pk.canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      this.packColor.set(slug, pk.color);
      this.texCache.set(slug, t); return t;
    };
    this.getTex = getTex;
    const catColor = new Map(this.store.categories.map((c) => [c.id, c.color]));
    const fixById = new Map(this.store.fixtures.map((f) => [f.id, f]));
    this.bays = new Map(); // product id -> { x, z, dir, y }
    const priceGeoms = []; const priceMats = [];
    for (const p of this.store.products) {
      const f = fixById.get(p.fixture); const st = this.fixStyle.get(f.id); const kind = this.productKind(p);
      const dir = p.pickup.y > p.shelf.y ? 1 : -1; // +1 = faces south (+z)
      const cx = p.shelf.x + 0.5;
      let frontZ, zc;
      if (f.kind === 'wall') { frontZ = 2.55; zc = frontZ - 0.34; }
      else { const mid = f.y + f.h / 2; frontZ = mid + dir * 0.62; zc = mid + dir * 0.34; }
      this.bays.set(p.id, { x: cx, z: zc, frontZ, dir, topY: st.top, midY: st.levels[1] + 0.2 });
      const bodyGeoms = [], faceGeoms = [];
      getTex(p.slug); const base = this.packColor.get(p.slug).clone();
      const info = this.photoInfo.get(p.slug);
      const gap = st.levels[1] - st.levels[0] - 0.07;
      let ph = kind.h, pw = kind.w, cols = kind.cols, bodyK = 1, dep = kind.d;
      if (info) {
        ph = clamp(kind.h * 1.05, 0.16, gap); pw = ph * info.aspect;
        if (pw > 0.86) { pw = 0.86; ph = pw / info.aspect; }
        cols = clamp(Math.floor(0.96 / (pw + 0.03)), 1, 4);
        dep = clamp(Math.min(pw, ph) * 0.4, 0.09, 0.16);
        bodyK = /oil|cola|water|tea|hibiscus|soap|sparkling|energy|shampoo/.test(p.slug) ? 0.7 : 0.9;
      }
      const rowsN = Math.max(1, Math.min(2, Math.round(0.58 / dep)));
      for (let li = 0; li < st.levels.length; li++) {
        const y0 = st.levels[li] + 0.025;
        for (let c = 0; c < cols; c++) {
          const px = cx - 0.5 + (c + 0.5) * (1 / cols);
          for (let r = 0; r < rowsN; r++) {
            const pz = frontZ - dir * (dep * 0.5 + 0.03 + r * dep);
            const jitter = (rnd() - 0.5) * 0.015;
            const bw = info ? pw * 0.86 : Math.min(kind.w, 0.92 / cols), bh = info ? ph * bodyK : kind.h;
            const g = new THREE.BoxGeometry(bw, bh, dep); g.translate(px + jitter, y0 + bh / 2, pz); bodyGeoms.push(g);
            if (r === 0) {
              const fh = info ? ph : kind.h * 0.94, fw = info ? pw : bw * 0.96;
              const pl = new THREE.PlaneGeometry(fw, fh);
              if (dir < 0) pl.rotateY(Math.PI);
              pl.translate(px + jitter, y0 + fh / 2, pz + dir * (dep / 2 + 0.002)); faceGeoms.push(pl);
            }
          }
        }
        // shelf-edge price tag
        if (li > 0 || f.kind !== 'wall') {
          const tg = new THREE.PlaneGeometry(0.22, 0.11); if (dir < 0) tg.rotateY(Math.PI);
          tg.translate(cx - 0.12, st.levels[li] - 0.0, frontZ + dir * 0.34); priceGeoms.push(tg);
        }
      }
      const body = new THREE.Mesh(mergeGeometries(bodyGeoms), new THREE.MeshStandardMaterial({ color: shade(base, 1.0), roughness: 0.55, metalness: 0.05 }));
      body.castShadow = true; body.receiveShadow = true; sc.add(body);
      const faces = new THREE.Mesh(mergeGeometries(faceGeoms), new THREE.MeshStandardMaterial({ map: getTex(p.slug), roughness: 0.4, alphaTest: info ? 0.4 : 0, polygonOffset: true, polygonOffsetFactor: -2 }));
      faces.receiveShadow = true; sc.add(faces);
      // price label (one per product, near the lowest shelf)
      const pt = tex(priceTexture(p.price, p.discount));
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), new THREE.MeshBasicMaterial({ map: pt, transparent: true }));
      label.position.set(cx, st.levels[f.kind === 'wall' ? 1 : 0] - 0.07, frontZ + dir * 0.37);
      if (dir < 0) label.rotation.y = Math.PI;
      sc.add(label);
      // hero unit that flies into the cart when picked
      const hg = new THREE.Group();
      const hh = 0.3, hw = info ? Math.min(0.5, hh * info.aspect) : 0.26;
      const hb = new THREE.Mesh(new THREE.BoxGeometry(hw * 0.8, hh * (info ? bodyK : 1), 0.12), new THREE.MeshStandardMaterial({ color: shade(base, 1.0), roughness: 0.5 }));
      hb.position.y = info ? -hh * (1 - bodyK) / 2 : 0;
      const hf = new THREE.Mesh(new THREE.PlaneGeometry(info ? hw : 0.25, info ? hh : 0.28), new THREE.MeshStandardMaterial({ map: getTex(p.slug), roughness: 0.4, alphaTest: info ? 0.4 : 0 }));
      hf.position.z = 0.062; hg.add(hb, hf); hg.visible = false; sc.add(hg);
      this.heroes.set(p.id, hg);
      // halo ring for search / highlight
    }
    // highlight beacons
    this.beacons = new Map();
    const ringGeom = new THREE.TorusGeometry(0.52, 0.035, 10, 40); ringGeom.rotateX(Math.PI / 2);
    this.ringGeom = ringGeom;
  }

  // ------------------------------------------------------------ decoration
  buildDeco() {
    const sc = this.scene, m = this.m;
    const box = (w, h, d, x, y, z, mat, cast = true) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, y, z); b.castShadow = cast; b.receiveShadow = true; sc.add(b); return b; };
    for (const d of this.store.deco) {
      const cx = d.x + d.w / 2, cz = d.y + d.h / 2;
      switch (d.type) {
        case 'pillar': {
          const c = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, CEIL, 24), new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.7 }));
          c.position.set(cx, CEIL / 2, cz); c.castShadow = true; sc.add(c);
          const band = new THREE.Mesh(new THREE.CylinderGeometry(0.355, 0.355, 0.5, 24), new THREE.MeshStandardMaterial({ color: '#1f6fe5', roughness: 0.6 })); band.position.set(cx, 1.6, cz); sc.add(band);
          break;
        }
        case 'plant': {
          const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.5, 20), new THREE.MeshStandardMaterial({ color: '#c9ccd0', roughness: 0.6 })); pot.position.set(cx, 0.25, cz); pot.castShadow = true; sc.add(pot);
          const leafM = new THREE.MeshStandardMaterial({ color: '#2f8f3e', roughness: 0.7 });
          for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26 + rnd() * 0.12, 1), leafM); s.position.set(cx + (rnd() - 0.5) * 0.4, 0.75 + rnd() * 0.6, cz + (rnd() - 0.5) * 0.4); s.castShadow = true; sc.add(s); }
          break;
        }
        case 'pallet-water': {
          box(d.w - 0.2, 0.14, d.h - 0.2, cx, 0.07, cz, m.wood);
          const packM = new THREE.MeshStandardMaterial({ color: '#dff1fb', roughness: 0.25, transparent: true, opacity: 0.9 });
          const capM = new THREE.MeshStandardMaterial({ color: '#2f7bff', roughness: 0.5 });
          for (let i = 0; i < d.w - 0; i++) for (let j = 0; j < d.h * 1; j++) for (let k = 0; k < 3; k++) {
            const px = d.x + 0.5 + i, pz = d.y + 0.5 + j;
            box(0.82, 0.3, 0.82, px, 0.14 + 0.16 + k * 0.31, pz, packM);
            box(0.82, 0.04, 0.82, px, 0.14 + 0.32 + k * 0.31, pz, capM, false);
          }
          break;
        }
        case 'promo-stand': {
          box(d.w - 0.2, 0.12, d.h - 0.2, cx, 0.06, cz, m.wood);
          const cols = ['#ffd93d', '#ff8a8a', '#7cc8ff', '#c9f07a', '#ffa8f0', '#ffb86b'];
          for (let i = 0; i < d.w; i++) for (let j = 0; j < d.h; j++) for (let k = 0; k < 2; k++) {
            const bx = box(0.8, 0.38, 0.8, d.x + 0.5 + i, 0.12 + 0.19 + k * 0.4, d.y + 0.5 + j, new THREE.MeshStandardMaterial({ color: cols[(i + j * 2 + k) % cols.length], roughness: 0.6 }));
            bx.rotation.y = (rnd() - 0.5) * 0.08;
          }
          box(d.w - 0.3, 0.9, 0.05, cx, 1.35, cz, new THREE.MeshStandardMaterial({ color: '#d05f3b', roughness: 0.6 }));
          break;
        }
        case 'checkout-lane': {
          box(d.w, 0.85, 0.7, cx, 0.43, cz, new THREE.MeshStandardMaterial({ color: '#e7eaee', roughness: 0.5, metalness: 0.3 }));
          box(d.w - 0.1, 0.06, 0.5, cx, 0.88, cz, m.rubber, false);
          box(d.w, 0.04, 0.78, cx, 0.86, cz, m.metal, false);
          break;
        }
        case 'cashier-kiosk': {
          box(0.9, 1.0, 0.8, cx, 0.5, cz, new THREE.MeshStandardMaterial({ color: '#d9dde1', roughness: 0.45, metalness: 0.35 }));
          const scr = box(0.5, 0.34, 0.05, cx, 1.18, cz - 0.2, m.black); scr.rotation.x = -0.35;
          const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.26), new THREE.MeshBasicMaterial({ color: '#7fd3ff' })); glow.position.set(cx, 1.18, cz - 0.17); glow.rotation.x = -0.35; sc.add(glow);
          // cashier
          this.addPerson(cx + 0.05, cz + 0.55, '#c0392b', Math.PI, true);
          break;
        }
        case 'doormat': box(d.w - 0.2, 0.03, d.h - 0.2, cx, 0.015, cz, m.rubber, false); break;
        case 'cart-park': for (let i = 0; i < 4; i++) { const c = this.makeCart(); c.position.set(d.x + 0.35 + i * 0.22, 0, d.y + 0.9 + (i % 2) * 0.05); c.scale.setScalar(0.92); c.rotation.y = Math.PI / 2; sc.add(c); } break;
        case 'basket-stack': for (let i = 0; i < 5; i++) { const b = box(0.55, 0.2, 0.4, cx, 0.1 + i * 0.16, cz, new THREE.MeshStandardMaterial({ color: '#d63b3b', roughness: 0.55 })); b.rotation.y = (i % 2) * 0.1; } break;
        case 'wet-floor': {
          const d1 = new THREE.Mesh(new THREE.PlaneGeometry(d.w - 0.4, d.h - 0.4), new THREE.MeshStandardMaterial({ color: '#a9d8ff', roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.45 }));
          d1.rotation.x = -Math.PI / 2; d1.position.set(cx, 0.008, cz); sc.add(d1);
          for (const dx of [-1.2, 1.2]) {
            const sign = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 4), new THREE.MeshStandardMaterial({ color: '#ffd400', roughness: 0.5 }));
            sign.position.set(cx + dx, 0.3, cz); sign.rotation.y = Math.PI / 4; sign.castShadow = true; sc.add(sign);
          }
          break;
        }
        case 'queue-zone': {
          const g = new THREE.Mesh(new THREE.PlaneGeometry(d.w, d.h), new THREE.MeshStandardMaterial({ color: '#dff7f1', roughness: 0.35, transparent: true, opacity: 0.8 }));
          g.rotation.x = -Math.PI / 2; g.position.set(cx, 0.006, cz); sc.add(g);
          break;
        }
        default: break;
      }
    }
  }

  buildSigns() {
    const sc = this.scene;
    for (const s of this.store.signs) {
      const f = this.store.fixtures.find((x) => x.id === s.fixture); if (!f) continue;
      const t = tex(bannerTexture(s.ar, s.en, s.color), { aniso: 8 });
      const w = Math.min(f.w, 4.2), h = w * 0.25;
      const mat = new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide, toneMapped: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      if (f.kind === 'wall') mesh.position.set(f.x + f.w / 2, 2.98, 2.58);
      else mesh.position.set(f.x + f.w / 2, 2.55, f.y + f.h / 2);
      sc.add(mesh);
      if (f.kind !== 'wall') {
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, CEIL - 2.55, 6), this.m.darkMetal);
        for (const dx of [-w / 2 + 0.2, w / 2 - 0.2]) { const r = rod.clone(); r.position.set(f.x + f.w / 2 + dx, 2.55 + (CEIL - 2.55) / 2, f.y + f.h / 2); sc.add(r); }
      }
    }
    // entrance + checkout signs
    const ent = this.store.deco.find((d) => d.type === 'entrance-door');
    const wel = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.5), new THREE.MeshBasicMaterial({ map: tex(signTexture([{ t: 'BASKETWISE MARKET', size: 52 }], '#1f6fe5', '#ffffff', 1024, 160)), toneMapped: false }));
    wel.position.set(ent ? ent.x + ent.w / 2 : 3.5, 3.3, this.H - 0.06); wel.rotation.y = Math.PI; sc.add(wel);
    const chk = this.store.deco.filter((d) => d.type === 'checkout-lane');
    chk.forEach((d, i) => {
      const t = tex(signTexture([{ t: `كاشير ${i + 1}`, size: 80 }], '#16181a', '#ffd93d', 512, 160));
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide, toneMapped: false }));
      mesh.position.set(d.x + d.w + 0.4, 2.9, d.y + 0.5); mesh.rotation.y = Math.PI / 2; sc.add(mesh);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, CEIL - 2.9, 6), this.m.darkMetal); rod.position.set(d.x + d.w + 0.4, 2.9 + (CEIL - 2.9) / 2, d.y + 0.5); sc.add(rod);
    });
  }

  // ------------------------------------------------------------ people
  addPerson(x, z, shirt, ry = 0, cashier = false) {
    const ppl = this.opts && this.opts.people;
    if (ppl && ppl.length && !cashier) {
      // photo cut-out shopper: a vertical plane that always turns to face the camera (y-axis billboard)
      this.billboards = this.billboards || [];
      this._pi = ((this._pi == null ? Math.floor(rnd() * ppl.length) : this._pi) + 1 + (this._pi != null && rnd() < 0.5 ? 1 : 0)) % ppl.length; const im = ppl[this._pi];
      const tex = new THREE.Texture(im); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.needsUpdate = true;
      const H = 1.72 + rnd() * 0.1, Wd = H * im.width / im.height;
      const g = new THREE.Group();
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(Wd, H), new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, roughness: 0.8, side: THREE.DoubleSide }));
      pl.position.y = H / 2; pl.castShadow = true; g.add(pl);
      const blob = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.22, depthWrite: false }));
      blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; g.add(blob);
      g.position.set(x, 0, z); this.scene.add(g); this.billboards.push({ g, pl, ph: rnd() * 6.28 }); return g;
    }
    const g = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: ['#e0b08a', '#c68b62', '#f0c8a0', '#a8714a'][Math.floor(rnd() * 4)], roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.62, 6, 14), new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.8 })); body.position.y = 1.05;
    const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.55, 6, 12), new THREE.MeshStandardMaterial({ color: '#2f3b55', roughness: 0.8 })); legs.position.y = 0.42;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 14), skin); head.position.y = 1.72;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.155, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), new THREE.MeshStandardMaterial({ color: '#2a211b', roughness: 0.9 })); hair.position.y = 1.74;
    g.add(legs, body, head, hair);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    g.position.set(x, 0, z); g.rotation.y = ry; this.scene.add(g); return g;
  }
  // real rigged 3D walkers (GLB with a walk cycle) patrolling the open lanes
  buildWalkers() {
    const W = this.opts.walker; this.walkers = [];
    const lanes = [[2, 38, 3.5], [2, 38, 12.5], [2, 24, 14.5], [12, 38, 20.5], [16, 38, 7.5], [4, 30, 4.4]];
    const tints = ['#ffffff', '#e4ecff', '#ffe6d6', '#e6f2e2', '#f1e6ff', '#fff3cf'];
    lanes.forEach(([x1, x2, z], i) => {
      const obj = skClone(W.scene); obj.scale.setScalar(1.02 + (i % 3) * 0.04);
      obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; o.material = o.material.clone(); o.material.color = new THREE.Color(tints[i % tints.length]); o.material.roughness = 0.85; o.material.metalness = 0; } });
      const mixer = new THREE.AnimationMixer(obj);
      const act = mixer.clipAction(W.anim); act.play(); act.time = rnd() * act.getClip().duration;
      const g = new THREE.Group(); g.add(obj); this.scene.add(g);
      const blob = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.2, depthWrite: false }));
      blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; g.add(blob);
      this.walkers.push({ g, obj, mixer, x1, x2, z, p: rnd() * (x2 - x1), dir: i % 2 ? 1 : -1, speed: 0.55 + rnd() * 0.3 });
    });
  }
  updateWalkers(dt) {
    for (const w of this.walkers) {
      w.p += w.dir * w.speed * dt; const L = w.x2 - w.x1;
      if (w.p > L) { w.p = L; w.dir = -1; } else if (w.p < 0) { w.p = 0; w.dir = 1; }
      w.g.position.set(w.x1 + w.p, 0, w.z);
      const ty = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2; w.obj.rotation.y += angDiff(w.obj.rotation.y, ty) * clamp(dt * 5, 0, 1);
      w.mixer.update(dt * w.speed * 1.6);
    }
  }
  buildPeople() {
    if (this.opts && this.opts.walker) { this.buildWalkers(); return; }
    const crowd = this.store.deco.find((d) => d.type === 'crowd-zone');
    if (crowd) {
      const cols = ['#2f7bff', '#e0527a', '#2fa36b', '#f5a623'];
      for (let i = 0; i < 3; i++) this.addPerson(crowd.x + 0.6 + i * 1.2, crowd.y + 0.5 + (rnd() - 0.5) * 0.3, cols[i % cols.length], rnd() * 6.28);
    }
    // a few other shoppers
    const extra = [[30.6, 17.1, '#8e44ad', 0], [33.2, 16.9, '#16a085', Math.PI], [11.5, 14.2, '#d35400', 1.2], [24.8, 12.3, '#2980b9', 2.4], [36.5, 10.5, '#c0392b', 0.4]];
    for (const [x, z, c, r] of extra) this.addPerson(x, z, c, r);
  }

  // ------------------------------------------------------------ cart
  makeCart() {
    const g = new THREE.Group(), m = this.m;
    const wire = new THREE.MeshStandardMaterial({ color: '#c8ccd1', roughness: 0.3, metalness: 0.85 });
    const basket = new THREE.Group();
    // wire basket (grid of thin bars)
    const bars = [];
    const bw = 0.62, bd = 0.9, bh = 0.34;
    for (let i = 0; i <= 8; i++) { const b = new THREE.BoxGeometry(0.012, bh, 0.012); b.translate(-bw / 2 + (bw / 8) * i, 0, -bd / 2); const b2 = b.clone(); b2.translate(0, 0, bd); bars.push(b, b2); }
    for (let i = 0; i <= 10; i++) { const b = new THREE.BoxGeometry(0.012, bh, 0.012); b.translate(-bw / 2, 0, -bd / 2 + (bd / 10) * i); const b2 = b.clone(); b2.translate(bw, 0, 0); bars.push(b, b2); }
    for (const yy of [-bh / 2, 0, bh / 2]) {
      bars.push(new THREE.BoxGeometry(bw, 0.012, 0.012).translate(0, yy, -bd / 2), new THREE.BoxGeometry(bw, 0.012, 0.012).translate(0, yy, bd / 2),
        new THREE.BoxGeometry(0.012, 0.012, bd).translate(-bw / 2, yy, 0), new THREE.BoxGeometry(0.012, 0.012, bd).translate(bw / 2, yy, 0));
    }
    for (let i = 0; i <= 6; i++) for (let j = 0; j <= 9; j += 1) { /* floor grid */ }
    bars.push(new THREE.BoxGeometry(bw, 0.015, bd).translate(0, -bh / 2, 0));
    const bm = new THREE.Mesh(mergeGeometries(bars), wire); bm.castShadow = true; basket.add(bm);
    basket.position.set(0, 0.78, 0); g.add(basket);
    // frame + wheels + handle
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.78), wire); frame.position.set(0, 0.28, 0.02); g.add(frame);
    for (const [x, z] of [[-0.22, -0.34], [0.22, -0.34], [-0.22, 0.38], [0.22, 0.38]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 14), m.rubber); w.rotation.z = Math.PI / 2; w.position.set(x, 0.07, z); g.add(w); (g.userData.wheels = g.userData.wheels || []).push(w);
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.02), wire); st.position.set(x, 0.17, z); g.add(st);
    }
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.04, 0.04), new THREE.MeshStandardMaterial({ color: '#1748C8', roughness: 0.45 }));
    handle.position.set(0, 1.0, 0.5); g.add(handle);
    const rimM = new THREE.MeshStandardMaterial({ color: '#1748C8', roughness: 0.5 }), ry = 0.78 + 0.175;
    for (const [w, d, x, z] of [[0.66, 0.04, 0, -0.45], [0.66, 0.04, 0, 0.45], [0.04, 0.94, -0.31, 0], [0.04, 0.94, 0.31, 0]]) { const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), rimM); r.position.set(x, ry, z); g.add(r); }
    for (const x of [-0.3, 0.3]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.02), wire); p.position.set(x, 0.9, 0.5); p.rotation.x = 0.0; g.add(p); }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  buildCart() {
    this.cart = this.makeCart();
    this.cartRoot = new THREE.Group();
    this.cartRoot.add(this.cart);
    this.cartContent = new THREE.Group(); this.cartContent.position.set(0, 0.78, 0); this.cartRoot.add(this.cartContent);
    this.scene.add(this.cartRoot);
    // a simple shopper body (visible in aerial mode, hidden in first person)
    this.me = this.addPerson(0, 0, '#d05f3b', 0);
    this.me.visible = false;
  }

  // ------------------------------------------------------------ path ribbon, destination beam
  buildPathObjects() {
    const sc = this.scene;
    this.ribbon = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: '#ff8a1f', transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
    this.ribbon.frustumCulled = false; this.ribbon.renderOrder = 5; sc.add(this.ribbon);
    this.ribbonGlow = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: '#ff8a1f', transparent: true, opacity: 0.25, depthWrite: false, toneMapped: false }));
    this.ribbonGlow.frustumCulled = false; this.ribbonGlow.renderOrder = 4; sc.add(this.ribbonGlow);
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 3.4, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#ff8a1f', transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    this.beam.position.y = 1.7; this.beam.visible = false; sc.add(this.beam);
    this.beamRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 40), new THREE.MeshBasicMaterial({ color: '#ff8a1f', toneMapped: false }));
    this.beamRing.rotation.x = Math.PI / 2; this.beamRing.position.y = 0.03; this.beamRing.visible = false; sc.add(this.beamRing);
  }
  buildRibbonGeom(pts, half) {
    const pos = [];
    const P = pts.map(([x, y]) => new THREE.Vector2(x + 0.5, y + 0.5));
    // corner-safe: one quad per segment (extended by half width so corners overlap)
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1];
      const dx = b.x - a.x, dz = b.y - a.y, len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len * half, nz = dx / len * half, ex = dx / len * half, ez = dz / len * half;
      const A = [a.x - ex + nx, a.y - ez + nz], B = [a.x - ex - nx, a.y - ez - nz], C = [b.x + ex - nx, b.y + ez - nz], D = [b.x + ex + nx, b.y + ez + nz];
      pos.push(A[0], 0.03, A[1], B[0], 0.03, B[1], C[0], 0.03, C[1], A[0], 0.03, A[1], C[0], 0.03, C[1], D[0], 0.03, D[1]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }

  // ------------------------------------------------------------ input (aerial orbit)
  bindInput() {
    const c = this.canvas;
    let drag = null;
    this.onDown = (e) => { drag = { x: e.clientX, y: e.clientY, yaw: this.aerial.yaw, pitch: this.aerial.pitch }; c.setPointerCapture(e.pointerId); c.style.cursor = 'grabbing'; };
    this.onMove = (e) => {
      if (!drag || this.mode !== 'aerial') return;
      this.aerial.yaw = drag.yaw - (e.clientX - drag.x) * 0.006;
      this.aerial.pitch = clamp(drag.pitch + (e.clientY - drag.y) * 0.004, 0.25, 1.4);
    };
    this.onUp = (e) => { drag = null; c.style.cursor = 'grab'; try { c.releasePointerCapture(e.pointerId); } catch { /* noop */ } };
    this.onWheel = (e) => { if (this.mode !== 'aerial') return; e.preventDefault(); this.aerial.dist = clamp(this.aerial.dist * (1 + e.deltaY * 0.001), 8, 60); };
    c.addEventListener('pointerdown', this.onDown); c.addEventListener('pointermove', this.onMove); c.addEventListener('pointerup', this.onUp);
    c.addEventListener('wheel', this.onWheel, { passive: false });
  }
  setMode(mode) { this.mode = mode; }

  resize() {
    const w = Math.max(2, this.container.clientWidth), h = Math.max(2, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------ per-frame sync with the 2D game
  dirVec(dir) { return dir === 'up' ? [0, -1] : dir === 'down' ? [0, 1] : dir === 'left' ? [-1, 0] : [1, 0]; }

  syncPath() {
    const g = this.game, pd = g.pathDraw;
    const on = pd && pd.pts && pd.pts.length > 1 && pd.alpha > 0.02;
    this.ribbon.visible = this.ribbonGlow.visible = this.beam.visible = this.beamRing.visible = !!on;
    if (!on) return;
    if (this.pathKey !== pd.pts) {
      this.pathKey = pd.pts;
      this.ribbon.geometry.dispose(); this.ribbonGlow.geometry.dispose();
      this.ribbon.geometry = this.buildRibbonGeom(pd.pts, 0.1);
      this.ribbonGlow.geometry = this.buildRibbonGeom(pd.pts, 0.24);
      this.segCount = pd.pts.length - 1;
    }
    const total = pd.pts.length - 1;
    const upto = Math.max((pd.from || 0) + 1, Math.floor(pd.prog * total));
    const from = pd.from || 0;
    const first = from * 6, count = Math.max(0, Math.min(upto, total) - from) * 6;
    this.ribbon.geometry.setDrawRange(first, count); this.ribbonGlow.geometry.setDrawRange(first, count);
    this.ribbon.material.color.set(pd.color); this.ribbonGlow.material.color.set(pd.color);
    this.beam.material.color.set(pd.color); this.beamRing.material.color.set(pd.color);
    this.ribbon.material.opacity = 0.9 * pd.alpha; this.ribbonGlow.material.opacity = 0.28 * pd.alpha;
    const e = pd.pts[total];
    this.beam.position.set(e[0] + 0.5, 1.7, e[1] + 0.5); this.beamRing.position.set(e[0] + 0.5, 0.04, e[1] + 0.5);
    const pulse = 1 + Math.sin(this.t * 6) * 0.12; this.beamRing.scale.setScalar(pulse);
  }

  syncProducts() {
    const g = this.game;
    // flying hero boxes
    for (const h of this.heroes.values()) h.visible = false;
    const cartPos = this.cartRoot.position, yawC = this.cartRoot.rotation.y;
    for (const f of g.fly || []) {
      const p = this.store.products.find((q) => q.slug === f.slug); if (!p) continue;
      const hero = this.heroes.get(p.id), bay = this.bays.get(p.id); if (!hero || !bay) continue;
      const u = clamp((g.gt - f.t0) / f.dur, 0, 1), e = easeOut(u);
      const sx = bay.x, sy = bay.midY + 0.1, sz = bay.frontZ - bay.dir * 0.1;
      const tx = cartPos.x, ty = 1.0, tz = cartPos.z;
      hero.position.set(lerp(sx, tx, e), lerp(sy, ty, e) + Math.sin(u * Math.PI) * 0.35, lerp(sz, tz, e));
      hero.rotation.y = lerp(bay.dir > 0 ? 0 : Math.PI, yawC, e); hero.rotation.x = u * 0.8;
      hero.scale.setScalar(lerp(1, 0.9, u));
      hero.visible = true;
    }
    // cart contents
    const items = g.shopper.items || [];
    if (this.cartIds !== items.length || this.cartSig !== items.join(',')) {
      this.cartIds = items.length; this.cartSig = items.join(',');
      this.cartContent.clear();
      items.forEach((id, i) => {
        const p = this.store.products.find((q) => q.id === id); if (!p) return;
        const col = i % 3, row = Math.floor(i / 3) % 4, lay = Math.floor(i / 12);
        const grp = new THREE.Group();
        this.getTex(p.slug); const catC = this.packColor.get(p.slug);
        const inf = this.photoInfo.get(p.slug); const cw = inf ? Math.min(0.3, 0.2 * inf.aspect) : 0.16;
        const b = new THREE.Mesh(new THREE.BoxGeometry(cw * 0.82, 0.2 * (inf ? 0.85 : 1), 0.1), new THREE.MeshStandardMaterial({ color: catC, roughness: 0.55 }));
        b.position.y = inf ? -0.015 : 0;
        const fr = new THREE.Mesh(new THREE.PlaneGeometry(inf ? cw : 0.16, inf ? 0.2 : 0.19), new THREE.MeshStandardMaterial({ map: this.getTex(p.slug), roughness: 0.4, alphaTest: inf ? 0.4 : 0 }));
        fr.position.z = 0.052; grp.add(b, fr);
        grp.position.set(-0.19 + col * 0.19, -0.1 + lay * 0.2, -0.33 + row * 0.2);
        grp.rotation.y = (rnd() - 0.5) * 0.5; grp.rotation.x = -0.4;
        this.cartContent.add(grp);
      });
    }
    // glow / search focus beacons
    const want = new Set();
    for (const p of this.store.products) {
      const st = g.pst.get(p.id);
      const focus = g.focus && g.focus.id === p.id;
      const glow = st && !st.picked && ((st.glow || 0) > 0.35 || focus || (g.marks && g.marks.must.has(p.id)));
      if (glow) want.add(p.id);
    }
    for (const id of want) {
      if (!this.beacons.has(id)) {
        const bay = this.bays.get(id);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.018, 8, 36), new THREE.MeshBasicMaterial({ color: '#ffd93d', toneMapped: false }));
        ring.position.set(bay.x, bay.midY + 0.2, bay.frontZ + bay.dir * 0.05); if (true) ring.rotation.x = 0;
        ring.renderOrder = 6; this.scene.add(ring); this.beacons.set(id, ring);
      }
    }
    for (const [id, r] of this.beacons) if (!want.has(id)) { this.scene.remove(r); r.geometry.dispose(); r.material.dispose(); this.beacons.delete(id); }
    for (const r of this.beacons.values()) { const k = 1 + Math.sin(this.t * 6) * 0.1; r.scale.set(k, k, k); }
  }

  loop(ts) {
    if (!this.alive) return;
    this.raf = requestAnimationFrame((t) => this.loop(t));
    const now = performance.now();
    const dt = Math.min(0.06, (now - this.last) / 1000); this.last = now; this.t += dt;
    const g = this.game, sh = g.shopper;
    // ---------------- shopper world position
    const [fx, fz] = this.dirVec(sh.dir || 'up');
    const sx = sh.x + 0.5, sz = sh.y + 0.5;
    const targetYaw = Math.atan2(-fx, -fz);
    if (this.cartYaw == null) this.cartYaw = targetYaw;
    this.cartYaw += angDiff(this.cartYaw, targetYaw) * clamp(dt * 8, 0, 1);
    const cfx = -Math.sin(this.cartYaw), cfz = -Math.cos(this.cartYaw);
    this.cartRoot.visible = sh.visible;
    // speed estimate (cells / s) from the shopper's smooth motion
    const pxp = this._px == null ? sx : this._px, pzp = this._pz == null ? sz : this._pz;
    const inst = Math.hypot(sx - pxp, sz - pzp) / Math.max(dt, 1e-3);
    this.speed = lerp(this.speed || 0, clamp(inst, 0, 12), clamp(dt * 8, 0, 1)); this._px = sx; this._pz = sz;
    const turn = angDiff(this.cartYaw, targetYaw);
    this.lean = lerp(this.lean || 0, clamp(turn * 0.35, -0.12, 0.12), clamp(dt * 6, 0, 1));
    const wheels = this.cart.userData.wheels || [];
    for (const w of wheels) w.rotation.x += this.speed * dt / 0.06;
    const ahead = g.phase === 'picking' ? 0.5 : 0.62;
    this.cartRoot.position.set(sx + cfx * ahead, 0, sz + cfz * ahead);
    this.cartRoot.rotation.y = this.cartYaw + Math.PI; // cart handle faces the shopper
    this.cart.rotation.z = (this.lean || 0) * 0.8; this.cart.position.y = Math.abs(Math.sin((sh.dist || 0) * Math.PI * 2)) * 0.008 * clamp((this.speed || 0) / 3, 0, 1);
    this.me.visible = sh.visible && this.mode === 'aerial';
    this.me.position.set(sx, 0, sz); this.me.rotation.y = this.cartYaw;
    this.fill.position.set(sx, 3.2, sz);

    // ---------------- camera
    const cam = this.camera;
    if (this.mode === 'aerial') {
      const a = this.aerial;
      const tx = sh.visible ? lerp(a.tx, sx, 0.0) : a.tx, tz = a.tz;
      const cx = tx + Math.sin(a.yaw) * Math.cos(a.pitch) * a.dist, cz = tz + Math.cos(a.yaw) * Math.cos(a.pitch) * a.dist, cy = Math.sin(a.pitch) * a.dist;
      cam.position.lerp(new THREE.Vector3(cx, cy, cz), clamp(dt * 6, 0, 1));
      cam.lookAt(tx, 0.4, tz);
      cam.fov = lerp(cam.fov, 48, 0.1);
      this.scene.fog.near = 80; this.scene.fog.far = 200;
    } else {
      this.scene.fog.near = 34; this.scene.fog.far = 78;
      cam.fov = lerp(cam.fov, 66 + clamp(this.speed, 0, 6) * 0.9, clamp(dt * 3, 0, 1));
      let ex, ez, yaw = this.cartYaw, pitch = -0.16;
      const moving = clamp(this.speed / 3, 0, 1) * (g.phase === 'walking' ? 1 : 0);
      const bob = Math.sin((sh.dist || 0) * Math.PI * 2) * 0.022 * moving;
      const sway = Math.sin((sh.dist || 0) * Math.PI) * 0.012 * moving;
      if (sh.visible) {
        ex = sx - cfx * (1.05 + clamp(this.speed, 0, 6) * 0.03); ez = sz - cfz * (1.05 + clamp(this.speed, 0, 6) * 0.03);
        if (g.phase === 'picking') pitch = -0.08;
      } else if (g.focus && this.bays.get(g.focus.id)) {
        // search camera fly-to: stand in the aisle and look at the shelf
        const b = this.bays.get(g.focus.id);
        ex = b.x; ez = b.frontZ + b.dir * 1.9; yaw = Math.atan2(0, b.dir > 0 ? 1 : -1); pitch = -0.05;
        yaw = b.dir > 0 ? Math.PI : 0;
      } else {
        // idle: gentle look around from the entrance
        ex = sx; ez = sz - 0.3; yaw = Math.PI * 0 + Math.sin(this.t * 0.3) * 0.5; pitch = -0.1;
        const [ix, iz] = [sx, sz]; ex = ix; ez = iz;
      }
      const tgt = new THREE.Vector3(ex, EYE + bob, ez);
      cam.position.lerp(tgt, clamp(dt * (sh.visible ? 14 : 3), 0, 1));
      this.yaw = this.yaw == null ? yaw : this.yaw;
      this.yaw += angDiff(this.yaw, yaw) * clamp(dt * 6, 0, 1);
      cam.rotation.order = 'YXZ'; cam.rotation.y = this.yaw; cam.rotation.x = pitch - moving * 0.015; cam.rotation.z = -this.lean + sway;
    }
    cam.updateProjectionMatrix();

    if (this.billboards) for (const b of this.billboards) { b.g.rotation.y = Math.atan2(this.camera.position.x - b.g.position.x, this.camera.position.z - b.g.position.z); b.pl.position.y = b.pl.geometry.parameters.height / 2 + Math.abs(Math.sin(this.t * 1.6 + b.ph)) * 0.006; }
    if (this.walkers) this.updateWalkers(dt);
    this.syncPath();
    this.syncProducts();
    this.renderer.render(this.scene, cam);
  }

  destroy() {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    this.ro && this.ro.disconnect();
    const c = this.canvas;
    c.removeEventListener('pointerdown', this.onDown); c.removeEventListener('pointermove', this.onMove); c.removeEventListener('pointerup', this.onUp); c.removeEventListener('wheel', this.onWheel);
    this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((mm) => { if (mm.map) mm.map.dispose(); mm.dispose(); }); } });
    this.renderer.dispose();
    if (c.parentElement) c.parentElement.removeChild(c);
  }
}
