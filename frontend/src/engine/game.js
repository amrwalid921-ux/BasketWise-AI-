// The game engine: owns the canvas, the camera, the shopper, and the "director" that plays
// a plan (AI mode) or a hand-picked route (challenge mode) as a sequence of animated scenes.
//
// Everything that happens on screen is driven by the *game clock* (gt) so pause / speed work
// uniformly. Scenes are written as plain async functions: `await this.wait(1.2)`,
// `await this.anim(0.6, p => ...)`.
import { T, ALGO, clamp, lerp, ease, easeOut } from './constants.js';
import { buildStaticLayer } from './world.js';

const CANCEL = Symbol('cancel');
const FONT = '"Cairo","Segoe UI",Tahoma,"DejaVu Sans",Arial,sans-serif';

function scoreColor(t) { // 0..1 -> red / amber / green
  const r = t < 0.5 ? 235 : Math.round(lerp(235, 60, (t - 0.5) * 2));
  const g = t < 0.5 ? Math.round(lerp(70, 200, t * 2)) : 205;
  const b = t < 0.5 ? 60 : Math.round(lerp(60, 90, (t - 0.5) * 2));
  return [r, g, b];
}

export class Game {
  constructor(canvas, store, assets, cb = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.store = store;
    this.assets = assets;
    this.cb = cb;
    this.W = store.grid.w * T;
    this.H = store.grid.h * T;
    this.costRows = store.grid.cost;
    this.byId = new Map(store.products.map((p) => [p.id, p]));
    this.cellProd = new Map(); // "x,y" -> product (shelf cell and, for wall units, the stock cell)
    for (const p of store.products) {
      this.cellProd.set(`${p.shelf.x},${p.shelf.y}`, p);
      if (p.side === 'wall') this.cellProd.set(`${p.shelf.x},${p.shelf.y - 1}`, p);
    }
    this.layer = buildStaticLayer(store, assets);

    this.camOffY = 0; // HUD now sits outside the canvas card, so no vertical shift is needed
    this.gt = 0;
    this.speed = 1;
    this.paused = false;
    this.radarOn = true;
    this.algo = 'astar';
    this.runId = 0;
    this.waiters = [];
    this.anims = [];
    this.fly = [];
    this.floaters = [];
    this.pulses = [];
    this.cam = { x: this.W / 2, y: this.H / 2, z: 0.5, mode: 'overview', tx: this.W / 2, ty: this.H / 2, tz: 0.5 };
    this.view = { w: 800, h: 500, dpr: 1 };
    this.pst = new Map();
    this.shopper = { x: 3, y: 21.2, dir: 'up', frame: 0, dist: 0, visible: false, items: [], bob: 0 };
    this.radar = null;
    this.pathDraw = null;
    this.target = null;
    this.marks = { picked: new Set(), must: new Set() };
    this.phase = 'idle';
    this.hud = this.freshHud();
    this.hudDirty = true;
    this.hudAt = 0;
    this.hover = null;
    this.hoverAt = 0;
    this.hoverPoint = null;
    this.focus = null;
    this.active = true;
    this.renderDirty = true;
    this.lastDrawAt = 0;
    this.raf = null;
    this.resetProducts();
    this.bind();
    this.resize();
    this.fitCamera(true);
    this.last = performance.now();
    this.requestFrame();
  }

  // ------------------------------------------------------------------ setup / teardown
  freshHud() {
    return {
      phase: 'idle', budget: 0, spent: 0, remaining: 0, items: [], score: 0, steps: 0, effort: 0, expanded: 0,
      leg: 0, legs: 0, algo: this.algo, text: '', done: false, mode: 'ai',
    };
  }
  resetProducts() {
    this.pst.clear();
    for (const p of this.store.products) {
      this.pst.set(p.id, { dim: 0, dimT: 0, glow: 0, glowT: 0, heat: 0, heatT: 0, heatAt: 0, picked: false, pick: 0, order: 0, score: null });
    }
  }
  destroy() {
    if (this.raf != null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.abort();
    this.unbind();
  }
  requestFrame() {
    if (!this.active || this.raf != null) return;
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }
  invalidate() {
    this.renderDirty = true;
    this.requestFrame();
  }
  setActive(active) {
    if (this.active === active) return;
    this.active = active;
    if (!active) {
      if (this.raf != null) cancelAnimationFrame(this.raf);
      this.raf = null;
      return;
    }
    this.last = performance.now();
    this.invalidate();
  }
  bind() {
    const c = this.canvas;
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(c.parentElement);
    let drag = null;
    this.onDown = (e) => { drag = { x: e.clientX, y: e.clientY, moved: false, cx: this.cam.x, cy: this.cam.y }; c.setPointerCapture(e.pointerId); };
    this.onMove = (e) => {
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
        if (drag.moved) {
          this.cam.mode = 'free';
          this.cam.x = drag.cx - dx / this.cam.z;
          this.cam.y = drag.cy - dy / this.cam.z;
          this.clampCam();
          this.cb.onCamMode && this.cb.onCamMode('free');
          this.invalidate();
        }
      }
      this.updateHover(e);
    };
    this.onUp = (e) => {
      if (drag && !drag.moved) {
        const p = this.productAtEvent(e);
        if (p && this.cb.onProductClick) this.cb.onProductClick(p.id);
      }
      drag = null;
    };
    this.onLeave = () => {
      if (this.hover) this.cb.onHover && this.cb.onHover(null);
      this.hover = null;
      this.hoverPoint = null;
      this.hoverAt = 0;
    };
    this.onWheel = (e) => {
      e.preventDefault();
      const rect = c.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const before = this.screenToWorld(mx, my);
      this.cam.z = clamp(this.cam.z * Math.exp(-e.deltaY * 0.0015), this.fitZ() * 0.95, 3.2);
      this.cam.x += before.x - this.screenToWorld(mx, my).x;
      this.cam.y += before.y - this.screenToWorld(mx, my).y;
      this.cam.mode = 'free';
      this.clampCam();
      this.cb.onCamMode && this.cb.onCamMode('free');
      this.invalidate();
    };
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointerleave', this.onLeave);
    c.addEventListener('wheel', this.onWheel, { passive: false });
  }
  unbind() {
    const c = this.canvas;
    window.removeEventListener('resize', this.onResize);
    this.ro && this.ro.disconnect();
    c.removeEventListener('pointerdown', this.onDown);
    c.removeEventListener('pointermove', this.onMove);
    c.removeEventListener('pointerup', this.onUp);
    c.removeEventListener('pointerleave', this.onLeave);
    c.removeEventListener('wheel', this.onWheel);
  }
  resize() {
    const par = this.canvas.parentElement;
    const w = Math.max(320, par.clientWidth), h = Math.max(240, par.clientHeight);
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    this.view = { w, h, dpr };
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    if (this.cam.mode === 'overview') this.fitCamera(true);
    this.invalidate();
  }

  // ------------------------------------------------------------------ camera
  fitZ() { return Math.min(this.view.w / this.W, this.view.h / this.H) * 0.985; }
  followZ() { return clamp(this.view.w / (17 * T), this.fitZ() * 1.3, 1.9); }
  fitCamera(snap) {
    this.cam.mode = 'overview';
    this.cam.tx = this.W / 2; this.cam.ty = this.H / 2; this.cam.tz = this.fitZ();
    if (snap) { this.cam.x = this.cam.tx; this.cam.y = this.cam.ty; this.cam.z = this.cam.tz; }
  }
  setCameraMode(mode) {
    if (mode === 'overview') this.fitCamera(false);
    else if (mode === 'follow') { this.cam.mode = 'follow'; this.cam.tz = this.followZ(); }
    this.cb.onCamMode && this.cb.onCamMode(this.cam.mode);
    this.invalidate();
  }
  clampCam() {
    const hw = this.view.w / (2 * this.cam.z), hh = this.view.h / (2 * this.cam.z);
    this.cam.x = this.W <= hw * 2 ? this.W / 2 : clamp(this.cam.x, hw, this.W - hw);
    this.cam.y = this.H <= hh * 2 ? this.H / 2 : clamp(this.cam.y, hh, this.H - hh);
  }
  screenToWorld(sx, sy) {
    return { x: (sx - this.view.w / 2) / this.cam.z + this.cam.x, y: (sy - this.view.h / 2 - this.camOffY) / this.cam.z + this.cam.y };
  }
  productAtEvent(e) {
    const rect = this.canvas.getBoundingClientRect();
    const w = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    return this.cellProd.get(`${Math.floor(w.x / T)},${Math.floor(w.y / T)}`) || null;
  }
  updateHover(e) {
    const p = this.productAtEvent(e);
    const id = p ? p.id : null;
    const changed = id !== (this.hover && this.hover.id);
    const now = performance.now();
    const moved = !this.hoverPoint || Math.abs(e.clientX - this.hoverPoint.x) >= 12 || Math.abs(e.clientY - this.hoverPoint.y) >= 12;
    if (changed || (p && moved && now - this.hoverAt >= 50)) {
      this.hover = p ? { id } : null;
      this.hoverAt = now;
      this.hoverPoint = p ? { x: e.clientX, y: e.clientY } : null;
      this.cb.onHover && this.cb.onHover(p ? { id, x: e.clientX, y: e.clientY } : null);
    }
    this.canvas.style.cursor = p && this.cb.onProductClick ? 'pointer' : 'grab';
  }

  // ------------------------------------------------------------------ clock helpers
  setSpeed(s) { this.speed = s; this.hudDirty = true; this.invalidate(); }
  setPaused(p) { this.paused = p; this.invalidate(); }
  setRadar(on) { this.radarOn = on; this.invalidate(); }
  setAlgo(a) { this.algo = a; this.hud.algo = a; this.hudDirty = true; this.invalidate(); }
  abort() {
    this.runId++;
    const ws = this.waiters.splice(0), as = this.anims.splice(0);
    ws.forEach((w) => w.reject(CANCEL));
    as.forEach((a) => a.reject(CANCEL));
  }
  wait(sec) {
    return new Promise((resolve, reject) => {
      this.waiters.push({ t: this.gt + sec, resolve, reject });
      this.requestFrame();
    });
  }
  anim(dur, fn) {
    return new Promise((resolve, reject) => {
      this.anims.push({ t0: this.gt, dur: Math.max(0.001, dur), fn, resolve, reject });
      this.requestFrame();
    });
  }
  log(text) { this.hud.text = text; this.hudDirty = true; this.cb.onLog && this.cb.onLog(text); this.invalidate(); }
  emitHud(force) {
    const now = performance.now();
    if (!force && (!this.hudDirty || now - this.hudAt < 120)) return;
    this.hudAt = now; this.hudDirty = false;
    this.cb.onHud && this.cb.onHud({ ...this.hud, items: [...this.hud.items], phase: this.phase, speed: this.speed, paused: this.paused });
  }

  // ------------------------------------------------------------------ main loop
  loop(ts) {
    this.raf = null;
    if (!this.active) return;
    const hadContinuousWork = this.hasContinuousWork();
    const rdt = Math.min(0.05, (ts - this.last) / 1000);
    this.last = ts;
    const dt = this.paused ? 0 : rdt * this.speed;
    this.gt += dt;
    this.update(dt, rdt);
    const continuousWork = this.hasContinuousWork();
    const shouldDraw = !continuousWork || ts - this.lastDrawAt >= 1000 / 30;
    if ((this.renderDirty || hadContinuousWork || continuousWork) && shouldDraw) {
      this.draw();
      this.renderDirty = false;
      this.lastDrawAt = ts;
    }
    this.emitHud(false);
    if (continuousWork) this.requestFrame();
  }
  hasContinuousWork() {
    if (!this.active) return false;
    if (!this.paused && (this.anims.length > 0 || this.waiters.length > 0)) return true;

    const { cam } = this;
    if (cam.mode !== 'free' && (Math.abs(cam.x - cam.tx) > 0.05 || Math.abs(cam.y - cam.ty) > 0.05 || Math.abs(cam.z - cam.tz) > 0.001)) return true;

    if (!this.paused && (this.focus || this.pulses.length || this.floaters.length || this.fly.length)) return true;
    if (!this.paused && this.radar && this.radar.alpha > 0.01 && this.radar.shown < this.radar.cells.length) return true;
    if (!this.paused && this.pathDraw && this.pathDraw.alpha > 0.01) return true;

    for (const s of this.pst.values()) {
      if (Math.abs(s.dim - s.dimT) > 0.01 || Math.abs(s.glow - s.glowT) > 0.01) return true;
      if (s.picked && s.pick < 1) return true;
      if (!this.paused && s.heatT > 0 && this.gt >= s.heatAt && s.heatShown < s.heatT - 0.01) return true;
    }
    return false;
  }
  update(dt, rdt) {
    // timers
    if (this.waiters.length) {
      const due = this.waiters.filter((w) => w.t <= this.gt);
      if (due.length) { this.waiters = this.waiters.filter((w) => w.t > this.gt); due.forEach((w) => w.resolve()); }
    }
    for (const a of [...this.anims]) {
      const p = clamp((this.gt - a.t0) / a.dur, 0, 1);
      a.fn(p);
      if (p >= 1) { this.anims.splice(this.anims.indexOf(a), 1); a.resolve(); }
    }
    // product highlight smoothing (real time so it also eases while paused)
    const k = 1 - Math.exp(-rdt * 7);
    for (const s of this.pst.values()) {
      s.dim += (s.dimT - s.dim) * k;
      s.glow += (s.glowT - s.glow) * k;
      const hs = clamp((this.gt - s.heatAt) / 0.5, 0, 1);
      s.heatShown = s.heatT * hs;
      if (s.picked && s.pick < 1) s.pick = Math.min(1, s.pick + rdt * 5);
    }
    // camera
    if (this.cam.mode === 'follow' && this.shopper.visible) {
      this.cam.tx = (this.shopper.x + 0.5) * T; this.cam.ty = (this.shopper.y + 0.5) * T; this.cam.tz = this.followZ();
    }
    if (this.cam.mode !== 'free') {
      const ck = 1 - Math.exp(-rdt * 3.4);
      this.cam.x += (this.cam.tx - this.cam.x) * ck;
      this.cam.y += (this.cam.ty - this.cam.y) * ck;
      this.cam.z += (this.cam.tz - this.cam.z) * ck;
      this.clampCam();
    }
    // floaters / pulses / fly cleanup
    this.floaters = this.floaters.filter((f) => this.gt - f.t0 < f.life);
    this.pulses = this.pulses.filter((p) => this.gt - p.t0 < 3.6);
    if (this.focus && this.gt > this.focus.until && !this.focus.sticky) this.clearFocus();
  }

  // ------------------------------------------------------------------ drawing
  draw() {
    const { ctx, view, cam } = this;
    const dpr = view.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#E9EDF2';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.save();
    ctx.translate(view.w / 2, view.h / 2 + this.camOffY);
    ctx.scale(cam.z, cam.z);
    ctx.translate(-cam.x, -cam.y);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.layer, 0, 0, this.W, this.H);
    this.drawProducts(ctx);
    this.drawHighlights(ctx);
    this.drawRadar(ctx);
    this.drawPath(ctx);
    this.drawShopper(ctx);
    this.drawFly(ctx);
    this.drawPulses(ctx);
    this.drawFloaters(ctx);
    ctx.restore();
  }

  aisleDir(p) { return p.pickup.y > p.shelf.y ? 1 : -1; }

  drawProducts(ctx) {
    const A = this.assets.products;
    for (const p of this.store.products) {
      const st = this.pst.get(p.id);
      const img = A[p.slug];
      if (!img) continue;
      const cx = p.shelf.x * T + T / 2, cy = p.shelf.y * T + T / 2;
      const dir = this.aisleDir(p);
      if (p.side === 'wall') {
        ctx.globalAlpha = 0.8; ctx.drawImage(img, cx - 13, cy - T - 22, 26, 26);
        ctx.globalAlpha = 1; ctx.drawImage(img, cx - 20, cy - T - 18, 40, 40); // stock row behind
      } else {
        ctx.fillStyle = 'rgba(10,25,70,.16)';
        ctx.beginPath(); ctx.ellipse(cx, cy - dir * 9 + 15, 15, 3.5, 0, 0, 7); ctx.fill();
        ctx.globalAlpha = 0.7; ctx.drawImage(img, cx - 14, cy - dir * 9 - 20, 28, 28);
        ctx.globalAlpha = 1; ctx.drawImage(img, cx - 18, cy - dir * 9 - 17, 36, 36);
      }
      const vis = 1 - easeOut(st.pick);
      if (vis > 0.02) {
        const s = 37 * (0.55 + 0.45 * vis);
        ctx.globalAlpha = vis;
        ctx.drawImage(img, cx - s / 2, cy - dir * 4 - s / 2 - (1 - vis) * 8, s, s);
        ctx.globalAlpha = 1;
      }
    }
  }

  drawHighlights(ctx) {
    for (const p of this.store.products) {
      const st = this.pst.get(p.id);
      const x = p.shelf.x * T, y = p.shelf.y * T;
      const wall = p.side === 'wall';
      const ry = wall ? y - T : y, rh = wall ? 2 * T - 9 : T;
      if (st.heatShown > 0.01 && st.score != null) {
        const [r, g, b] = scoreColor(st.score);
        ctx.fillStyle = `rgba(${r},${g},${b},${0.5 * st.heatShown})`;
        this.rrect(ctx, x + 3, ry + 3, T - 6, rh - (wall ? 2 : 6), 5); ctx.fill();
        if (st.heatShown > 0.9) {
          ctx.font = `800 13px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.fillStyle = '#fff';
          const tx = x + T / 2, ty = y + (wall ? -T * 0.5 : T * 0.5) + (wall ? 0 : -this.aisleDir(p) * -2);
          const txt = String(Math.round(st.rawScore));
          ctx.strokeText(txt, tx, ty); ctx.fillText(txt, tx, ty);
        }
      }
      if (st.dim > 0.01) {
        ctx.fillStyle = `rgba(22,16,10,${0.62 * st.dim})`;
        this.rrect(ctx, x + 2, ry + 2, T - 4, rh - 2, 5); ctx.fill();
      }
      if (st.glow > 0.02) {
        ctx.fillStyle = `rgba(120,255,170,${0.2 * st.glow})`;
        this.rrect(ctx, x + 2, ry + 2, T - 4, rh - 2, 5); ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = `rgba(70,240,140,${0.8 * st.glow})`;
        ctx.shadowColor = 'rgba(70,255,150,.9)'; ctx.shadowBlur = 12 * st.glow;
        this.rrect(ctx, x + 2, ry + 2, T - 4, rh - 2, 5); ctx.stroke();
        ctx.shadowBlur = 0;
      }
      if (st.order > 0 && !st.picked) this.badge(ctx, x + T - 9, (wall ? y - T : y) + 9, String(st.order), '#1c1a17', '#ffd24a');
      if (this.marks.picked.has(p.id)) this.badge(ctx, x + T - 9, ry + 9, '✓', '#fff', '#19a463');
      if (this.marks.must.has(p.id)) this.badge(ctx, x + 9, ry + 9, '★', '#2b2100', '#ffcf3a');
    }
  }
  badge(ctx, x, y, text, fg, bg) {
    ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fillStyle = bg; ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.stroke();
    ctx.fillStyle = fg; ctx.font = `800 ${text.length > 1 ? 9 : 11}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 0.5);
  }
  rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  drawRadar(ctx) {
    const r = this.radar;
    if (!r || !r.cells || r.alpha <= 0.01) return;
    const n = Math.min(r.shown, r.cells.length);
    const w = this.store.grid.w;
    for (let j = 0; j < n; j++) {
      const idx = r.cells[j];
      const x = idx % w, y = (idx / w) | 0;
      const age = n - j;
      const fresh = Math.max(0, 1 - age / 28);
      const a = (0.16 + 0.5 * fresh) * r.alpha;
      ctx.fillStyle = r.rgba + a.toFixed(3) + ')';
      ctx.fillRect(x * T + 1, y * T + 1, T - 2, T - 2);
      if (fresh > 0.82) {
        ctx.strokeStyle = `rgba(255,255,255,${0.9 * r.alpha})`; ctx.lineWidth = 2;
        ctx.strokeRect(x * T + 3, y * T + 3, T - 6, T - 6);
      }
    }
    // scanning ring at the frontier
    if (n > 0 && n < r.cells.length && r.alpha > 0.5) {
      const idx = r.cells[n - 1], x = (idx % w) * T + T / 2, y = ((idx / w) | 0) * T + T / 2;
      const rad = 14 + ((this.gt * 60) % 30);
      ctx.strokeStyle = r.rgba + (0.7 * (1 - (rad - 14) / 30)).toFixed(3) + ')'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.stroke();
    }
  }

  drawPath(ctx) {
    const pd = this.pathDraw;
    if (!pd || !pd.pts || pd.pts.length < 2 || pd.alpha <= 0.01) return;
    const from = pd.from || 0;
    const total = pd.pts.length - 1;
    const upto = Math.max(from + 1, Math.floor(pd.prog * total));
    const pts = [];
    for (let i = from; i <= Math.min(upto, total); i++) pts.push(pd.pts[i]);
    if (pts.length < 2) return;
    const sh = this.shopper;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const trace = () => {
      ctx.beginPath();
      if (from > 0 || this.phase === 'walking') ctx.moveTo((sh.x + 0.5) * T, (sh.y + 0.5) * T);
      else ctx.moveTo((pts[0][0] + 0.5) * T, (pts[0][1] + 0.5) * T);
      for (let i = 1; i < pts.length; i++) ctx.lineTo((pts[i][0] + 0.5) * T, (pts[i][1] + 0.5) * T);
    };
    ctx.globalAlpha = pd.alpha;
    trace(); ctx.strokeStyle = pd.rgba + '0.28)'; ctx.lineWidth = 13; ctx.stroke();
    trace(); ctx.strokeStyle = pd.color; ctx.lineWidth = 5; ctx.stroke();
    trace(); ctx.setLineDash([2, 12]); ctx.lineDashOffset = -this.gt * 26; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.restore();
    // destination marker
    const e = pd.pts[total];
    const pulse = 0.5 + 0.5 * Math.sin(this.gt * 6);
    ctx.save();
    ctx.globalAlpha = pd.alpha;
    ctx.strokeStyle = pd.color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc((e[0] + 0.5) * T, (e[1] + 0.5) * T, 11 + pulse * 5, 0, 7); ctx.stroke();
    ctx.fillStyle = pd.color; ctx.beginPath(); ctx.arc((e[0] + 0.5) * T, (e[1] + 0.5) * T, 6, 0, 7); ctx.fill();
    ctx.restore();
  }

  basketCenterWorld() {
    const sh = this.shopper, m = this.assets.meta.dirs[sh.dir].basket, S = this.spriteSize();
    const k = S / this.assets.meta.size;
    return { x: (sh.x + 0.5) * T + (m.x + m.w / 2 - 72) * k, y: (sh.y + 0.5) * T + (m.y + m.h / 2 - 72) * k + sh.bob };
  }
  spriteSize() { return T * 1.9; }
  drawShopper(ctx) {
    const sh = this.shopper;
    if (!sh.visible) return;
    const S = this.spriteSize();
    const img = this.assets.shopper[sh.dir][sh.frame];
    const cx = (sh.x + 0.5) * T, cy = (sh.y + 0.5) * T + sh.bob;
    ctx.fillStyle = 'rgba(10,25,70,.22)';
    ctx.beginPath(); ctx.ellipse(cx, cy + S * 0.36, S * 0.3, S * 0.07, 0, 0, 7); ctx.fill();
    ctx.drawImage(img, cx - S / 2, cy - S / 2, S, S);
    // cart contents
    const m = this.assets.meta.dirs[sh.dir].basket, k = S / this.assets.meta.size;
    const bx = cx + (m.x - 72) * k, by = cy + (m.y - 72) * k, bw = m.w * k, bh = m.h * k;
    const items = sh.items.slice(-9);
    const n = items.length;
    const cols = bw >= bh ? 3 : 2;
    items.forEach((id, i) => {
      const p = this.byId.get(id);
      const col = i % cols, row = Math.floor(i / cols);
      const rows = Math.ceil(9 / cols);
      const cw = bw / cols, ch = bh / rows;
      const ix = bx + cw * (col + 0.5) + ((id * 7) % 5 - 2) * 0.6;
      const iy = by + ch * (row + 0.5) + ((id * 3) % 5 - 2) * 0.6;
      const s = Math.min(cw, ch) * 1.25;
      ctx.drawImage(this.assets.products[p.slug], ix - s / 2, iy - s / 2, s, s);
    });
    if (n === 0) return;
  }
  drawFly(ctx) {
    for (const f of this.fly) {
      const p = clamp((this.gt - f.t0) / f.dur, 0, 1);
      const e = easeOut(p);
      const dest = this.basketCenterWorld();
      const x = lerp(f.x0, dest.x, e);
      const y = lerp(f.y0, dest.y, e) - Math.sin(p * Math.PI) * 38;
      const s = lerp(40, 17, e);
      ctx.drawImage(this.assets.products[f.slug], x - s / 2, y - s / 2, s, s);
    }
  }
  drawPulses(ctx) {
    for (const p of this.pulses) {
      const age = (this.gt - p.t0);
      for (let k = 0; k < 3; k++) {
        const a = ((age * 0.9 + k / 3) % 1);
        ctx.strokeStyle = `rgba(255,214,64,${(1 - a) * 0.9})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, 12 + a * 46, 0, 7); ctx.stroke();
      }
    }
    if (this.focus) {
      const pr = this.byId.get(this.focus.id);
      if (!pr) return;
      const cx = pr.shelf.x * T + T / 2, top = (pr.side === 'wall' ? pr.shelf.y - 1 : pr.shelf.y) * T;
      const label = `${pr.ar}  ·  ${pr.price} ج`;
      ctx.font = `800 15px ${FONT}`;
      const w = ctx.measureText(label).width + 22;
      const bob = Math.sin(this.gt * 4) * 2;
      const ly = pr.side === 'top' ? top - 38 : top + 2 * T + 6; // wall + bottom rows: label sits in the aisle below the unit
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
      const lx = clamp(cx, w / 2 + 6, this.W - w / 2 - 6);
      ctx.fillStyle = '#ffd24a'; this.rrect(ctx, lx - w / 2, ly + bob, w, 28, 9); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#2b2100'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, lx, ly + 14.5 + bob);
    }
  }
  drawFloaters(ctx) {
    for (const f of this.floaters) {
      const p = (this.gt - f.t0) / f.life;
      ctx.globalAlpha = 1 - p * p;
      ctx.font = `800 ${f.size || 17}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.7)';
      const y = f.y - p * 38;
      ctx.strokeText(f.text, f.x, y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, y);
      ctx.globalAlpha = 1;
    }
  }
  floater(text, x, y, color = '#fff', size) {
    this.floaters.push({ text, x, y, color, size, t0: this.gt, life: 1.5 });
    this.invalidate();
  }

  // ------------------------------------------------------------------ product state helpers
  clearHighlights() {
    for (const s of this.pst.values()) { s.dimT = 0; s.glowT = 0; s.heatT = 0; s.order = 0; }
  }
  setHeat(scores) {
    // scores: [{id, score}] -> heat map normalised to 0..1
    const vals = scores.map((s) => s.score);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const ranked = [...scores].sort((a, b) => b.score - a.score);
    ranked.forEach((s, i) => {
      const st = this.pst.get(s.id);
      st.score = (s.score - lo) / Math.max(1e-6, hi - lo);
      st.rawScore = s.score;
      st.heatT = 1;
      st.heatAt = this.gt + i * 0.014;
    });
    this.invalidate();
  }
  hideHeat() { for (const s of this.pst.values()) s.heatT = 0; this.invalidate(); }
  setMarks(picked, must) { this.marks = { picked: new Set(picked), must: new Set(must || []) }; this.invalidate(); }
  showHeat(scores) { if (scores) this.setHeat(scores); }
  highlightIds(ids, opts = {}) {
    const set = new Set(ids);
    for (const [id, s] of this.pst) {
      s.glowT = set.has(id) ? 1 : 0;
      s.dimT = opts.dimOthers && !set.has(id) ? 0.9 : 0;
    }
    this.invalidate();
  }
  focusProduct(id) {
    const p = this.byId.get(id);
    if (!p) return;
    this.cam.mode = 'focus';
    this.cam.tx = (p.shelf.x + 0.5) * T; this.cam.ty = (p.shelf.y + (p.side === 'wall' ? 0.6 : p.side === 'top' ? -0.9 : 0.1)) * T; this.cam.tz = Math.min(2.4, this.fitZ() * 3.3);
    this.pulses = [{ x: (p.shelf.x + 0.5) * T, y: (p.shelf.y + 0.5) * T, t0: this.gt }];
    this.focus = { id, until: this.gt + 7 };
    this.cb.onCamMode && this.cb.onCamMode('focus');
    this.invalidate();
  }
  clearFocus() { this.focus = null; this.pulses = []; this.invalidate(); }

  // ------------------------------------------------------------------ scenes
  reset() {
    this.abort();
    this.clearFocus();
    this.resetProducts();
    this.shopper = { x: 3, y: 21.2, dir: 'up', frame: 0, dist: 0, visible: false, items: [], bob: 0 };
    this.radar = null; this.pathDraw = null; this.fly = []; this.floaters = [];
    this.phase = 'idle';
    this.hud = this.freshHud();
    this.marks = { picked: new Set(), must: new Set() };
    this.fitCamera(false);
    this.emitHud(true);
    this.invalidate();
  }

  // Play a plan:
  //   {scores?, basket?, visit, routes:{bfs:{legs},dijkstra:{legs},astar:{legs}}, budget, mode:'ai'|'challenge', scoreById}
  async play(plan, opts = {}) {
    this.reset();
    const run = this.runId;
    this.plan = plan;
    if (opts.algo) this.algo = opts.algo;
    this.hud = { ...this.freshHud(), mode: plan.mode || 'ai', budget: plan.budget, remaining: plan.budget, legs: plan.visit.length - 1, algo: this.algo };
    this.scoreById = new Map((plan.scores || []).map((s) => [s.id, s.score]));
    try {
      if (plan.scores && !opts.skipScoring) await this.sceneScoring(plan);
      else if (plan.scores) { this.clearHighlights(); }
      await this.sceneTravel(plan);
    } catch (e) {
      if (e !== CANCEL) throw e;
    }
    return run;
  }

  async sceneScoring(plan) {
    this.phase = 'scoring';
    this.fitCamera(false);
    this.log('🧠 الـ AI بيدّي كل منتج درجة حسب ذوقك (تفضيلاتك + القيمة + الشعبية + الخصم)…');
    this.setHeat(plan.scores);
    await this.wait(2.6);
    this.phase = 'basket';
    this.log(`🎒 اختيار أحسن سلة داخل ${plan.budget} ج (Knapsack – ${plan.basket.algo === 'dp' ? 'Dynamic Programming' : plan.basket.algo})…`);
    const chosen = new Set(plan.basket.ids);
    const scoreOf = new Map(plan.scores.map((s) => [s.id, s]));
    for (const [id, st] of this.pst) {
      st.heatT = 0;
      st.glowT = chosen.has(id) ? 1 : 0;
      st.dimT = chosen.has(id) ? 0 : (scoreOf.get(id) && scoreOf.get(id).excluded ? 0.92 : 0.7);
    }
    await this.wait(2.4);
    this.phase = 'order';
    this.log(`🗺️ ترتيب الزيارة (${plan.order.algo === 'heldkarp' ? 'Held–Karp' : plan.order.algo === '2opt' ? 'NN + 2-opt' : plan.order.algo}) لأقصر رحلة…`);
    plan.order.ids.forEach((id, i) => { this.pst.get(id).order = i + 1; });
    await this.wait(2.0);
  }

  cellCost(x, y) { return this.costRows[y].charCodeAt(x) - 48; }

  async sceneTravel(plan) {
    const nLegs = plan.visit.length - 1;
    this.hud.legs = nLegs;
    this.phase = 'walking';
    // enter through the door
    const ent = plan.visit[0];
    this.shopper = { x: ent.x, y: ent.y + 1.2, dir: 'up', frame: 0, dist: 0, visible: true, items: [], bob: 0 };
    this.setCameraMode(this.followDefault === false ? 'overview' : 'follow');
    this.log('🚪 المتسوّق دخل المتجر…');
    await this.anim(0.7, (p) => { this.shopper.y = lerp(ent.y + 1.2, ent.y, ease(p)); this.shopper.frame = Math.floor(p * 6) % 4; });
    for (let i = 0; i < nLegs; i++) {
      const legs = ['bfs', 'dijkstra', 'astar'].reduce((o, a) => { o[a] = plan.routes[a] ? plan.routes[a].legs[i] : null; return o; }, {});
      const algoId = plan.routes[this.algo] ? this.algo : 'astar';
      const leg = legs[algoId];
      this.hud.leg = i + 1; this.hud.algo = algoId; this.hudDirty = true;
      const stop = plan.visit[i + 1];
      this.target = stop;
      this.cb.onLeg && this.cb.onLeg({ index: i, total: nLegs, legs, algo: algoId, stop });
      await this.thinkLeg(leg, algoId, stop);
      await this.walkLeg(leg);
      if (stop.type === 'product') await this.pickItem(stop.id);
      else await this.sceneCheckout(plan);
    }
  }

  async thinkLeg(leg, algoId, stop) {
    const A = ALGO[algoId];
    const name = stop.type === 'product' ? this.byId.get(stop.id).ar : 'الكاشير';
    this.radar = { cells: leg.explored, shown: 0, rgba: A.soft, alpha: 1 };
    this.pathDraw = { pts: leg.path, prog: 0, from: 0, color: A.color, rgba: A.soft, alpha: 1 };
    if (this.radarOn) {
      this.phase = 'thinking';
      this.log(`📡 ${A.name} بيدوّر على أقصر طريق لـ «${name}» — فحص ${leg.expanded} خلية`);
      await this.anim(clamp(0.4 + leg.explored.length / 420, 0.6, 2.2), (p) => { this.radar.shown = Math.floor(p * leg.explored.length); });
      this.radar.shown = leg.explored.length;
      this.log(`✅ ${A.name}: لقى الطريق (${leg.steps} خطوة، تكلفة ${leg.cost}) بعد فحص ${leg.expanded} خلية`);
      await this.anim(0.55, (p) => { this.pathDraw.prog = p; });
    } else {
      this.radar.alpha = 0;
      this.log(`➡️ رايح لـ «${name}» (${A.name})`);
      await this.anim(0.25, (p) => { this.pathDraw.prog = p; });
    }
    this.pathDraw.prog = 1;
    this.hud.expanded += leg.expanded; this.hudDirty = true;
    this.phase = 'walking';
  }

  async walkLeg(leg) {
    const pts = leg.path;
    if (pts.length < 2) return;
    const sh = this.shopper;
    const dur = [0];
    for (let k = 1; k < pts.length; k++) {
      const c = this.cellCost(pts[k][0], pts[k][1]);
      dur.push(dur[k - 1] + 0.17 * (1 + (c - 1) * 0.42));
    }
    const total = dur[dur.length - 1];
    let k = 1; // index of the cell we are heading to
    const fade = this.radar;
    await this.anim(total, (p) => {
      const t = p * total;
      while (k < pts.length - 1 && dur[k] < t) {
        k++;
        this.hud.steps++; this.hud.effort += this.cellCost(pts[k - 1][0], pts[k - 1][1]); this.hudDirty = true;
      }
      const a = pts[k - 1], b = pts[k];
      const u = clamp((t - dur[k - 1]) / (dur[k] - dur[k - 1]), 0, 1);
      sh.x = lerp(a[0], b[0], u); sh.y = lerp(a[1], b[1], u);
      const dx = b[0] - a[0], dy = b[1] - a[1];
      sh.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      sh.dist = (k - 1) + u;
      sh.frame = Math.floor(sh.dist * 2) % 4;
      sh.bob = Math.sin(sh.dist * Math.PI * 2) * 0.9;
      this.pathDraw.from = k - 1;
      if (fade) fade.alpha = Math.max(0.12, 1 - p * 0.9);
    });
    // account for the final step
    this.hud.steps++; this.hud.effort += this.cellCost(pts[pts.length - 1][0], pts[pts.length - 1][1]); this.hudDirty = true;
    const last = pts[pts.length - 1];
    sh.x = last[0]; sh.y = last[1]; sh.bob = 0; sh.frame = 0;
    this.pathDraw.alpha = 0;
    if (this.radar) this.radar.alpha = 0;
  }

  async pickItem(id) {
    const p = this.byId.get(id), st = this.pst.get(id), sh = this.shopper;
    sh.dir = p.pickup.y > p.shelf.y ? 'up' : 'down';
    this.phase = 'picking';
    await this.wait(0.2);
    st.picked = true; st.pick = 0;
    st.glowT = 0; st.dimT = 0; st.order = 0;
    const f = { slug: p.slug, x0: (p.shelf.x + 0.5) * T, y0: (p.shelf.y + 0.5) * T, t0: this.gt, dur: 0.55 };
    this.fly.push(f);
    this.log(`🛒 ${p.ar} — ${p.price} ج`);
    await this.wait(0.55);
    this.fly = this.fly.filter((x) => x !== f);
    sh.items.push(id);
    const sc = this.scoreById && this.scoreById.get(id);
    this.hud.items.push(id);
    this.hud.spent += p.price; this.hud.remaining = this.hud.budget - this.hud.spent;
    this.hud.score += sc != null ? Math.round(sc) : 0;
    this.hudDirty = true;
    const c = this.basketCenterWorld();
    this.floater(`-${p.price} ج`, c.x, c.y - 16, '#ff7b6b');
    if (sc != null) this.floater(`+${Math.round(sc)} نقطة`, c.x, c.y - 36, '#7dffb0', 14);
    await this.wait(0.35);
    this.phase = 'walking';
  }

  async sceneCheckout(plan) {
    const sh = this.shopper;
    sh.dir = 'up';
    this.phase = 'checkout';
    this.log('💳 وصل للكاشير — الدفع…');
    await this.wait(0.8);
    const c = this.basketCenterWorld();
    this.floater(`${Math.round(this.hud.spent)} ج`, c.x, c.y - 24, '#ffe37a', 22);
    await this.wait(1.1);
    this.phase = 'done';
    this.hud.done = true;
    this.log(`🎉 خلصت الرحلة: ${this.hud.items.length} منتج بـ ${Math.round(this.hud.spent)} ج`);
    this.emitHud(true);
    this.cb.onDone && this.cb.onDone({ ...this.hud, items: [...this.hud.items] });
  }

  // ------------------------------------------------------------------ challenge picking
  startPick(cfg) {
    this.reset();
    this.phase = 'pick';
    this.hud = { ...this.freshHud(), mode: 'challenge', budget: cfg.budget, remaining: cfg.budget, text: 'اختار المنتجات بالدوس على الرفوف' };
    this.setMarks([], cfg.mustHave || []);
    if (cfg.scores) this.setHeat(cfg.scores);
    this.fitCamera(false);
    this.emitHud(true);
    this.invalidate();
  }
}
