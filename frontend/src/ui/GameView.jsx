import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Game } from '../engine/game.js';
import { ALGO } from '../engine/constants.js';
import { api, planRequest } from '../api.js';
import SetupPanel, { PRESETS } from './SetupPanel.jsx';
import CartPanel from './CartPanel.jsx';
import ChallengePanel from './ChallengePanel.jsx';
import MiniAlgoCompare from './MiniAlgoCompare.jsx';
import SortOverlay from './SortOverlay.jsx';
import ProductSearchBox, { ProdIcon } from './ProductSearchBox.jsx';
import { BadgeCheck, CircleDollarSign, Footprints, ListOrdered, Map as MapIcon, MapPin, Microscope, Pause, Play, Radar, ReceiptText, RefreshCw, Search, ShoppingCart, SlidersHorizontal, Star, Trophy, Video } from 'lucide-react';

const PHASE_LABEL = {
  idle: 'جاهز', scoring: 'الـ AI بيقيّم', basket: 'اختيار السلة', order: 'ترتيب الزيارة', thinking: 'البحث عن مسار',
  walking: 'ماشي', picking: 'بيحط في العربية', checkout: 'الكاشير', done: 'خلصنا', pick: 'اختار المنتجات',
};

function Stat({ icon, label, value, sub }) {
  return <div className="stat"><span className="si">{icon}</span><div><small>{label}</small><b>{value}</b>{sub && <em>{sub}</em>}</div></div>;
}

export default function GameView({ store, assets, active = true }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const byId = useMemo(() => new Map(store.products.map((p) => [p.id, p])), [store]);
  const [cfg, setCfg] = useState({ ...PRESETS[0].cfg, knapsack: 'dp', tsp: 'auto', path: 'astar' });
  const [tab, setTab] = useState('setup');
  const [hud, setHud] = useState({ phase: 'idle', budget: 0, spent: 0, remaining: 0, items: [], score: 0, steps: 0, effort: 0, expanded: 0, leg: 0, legs: 0, algo: 'astar', text: 'اضبط الإعداد من اليمين واضغط «ابدأ الرحلة».', speed: 1, paused: false });
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [legInfo, setLegInfo] = useState(null);
  const [hover, setHover] = useState(null);
  const [camMode, setCamMode] = useState('overview');
  const [radar, setRadar] = useState(true);
  const [showSort, setShowSort] = useState(false);
  const [showMini, setShowMini] = useState(true);
  const [summary, setSummary] = useState(null);
  const [ch, setCh] = useState(null);
  const chRef = useRef(null);
  chRef.current = ch;
  const planScores = useMemo(() => (plan ? new Map(plan.scores.map((s) => [s.id, s.score])) : null), [plan]);
  const scoresRef = useRef(null);
  scoresRef.current = planScores;

  // ------------------------------------------------------------ engine lifecycle
  useEffect(() => {
    const g = new Game(canvasRef.current, store, assets, {
      onHud: setHud,
      onHover: (h) => setHover(h),
      onLeg: setLegInfo,
      onCamMode: setCamMode,
      onDone: (h) => {
        if (chRef.current && chRef.current.stage === 'walking') finishChallengeEval(h);
        else setSummary(h);
      },
      onProductClick: (id) => onProductClick(id),
    });
    gameRef.current = g;
    window.__game = g; // handy for debugging / screenshots
    return () => g.destroy();
  }, [store, assets]);

  useEffect(() => {
    const syncActivity = () => gameRef.current?.setActive(active && document.visibilityState === 'visible');
    syncActivity();
    document.addEventListener('visibilitychange', syncActivity);
    return () => document.removeEventListener('visibilitychange', syncActivity);
  }, [active]);

  const onProductClick = (id) => {
    const g = gameRef.current, c = chRef.current;
    if (c && c.stage === 'pick') {
      const p = byId.get(id);
      const picks = c.picks.includes(id) ? c.picks.filter((x) => x !== id) : [...c.picks, id];
      const spent = picks.reduce((s, x) => s + byId.get(x).price, 0);
      if (!c.picks.includes(id) && spent > c.preset.budget) {
        g.floater(`مفيش ميزانية! (${p.price} ج)`, (p.shelf.x + 0.5) * 48, (p.shelf.y) * 48, '#ff7b6b', 15);
        return;
      }
      setCh({ ...c, picks }); applyPicks(picks, c.preset);
    } else {
      g.focusProduct(id);
    }
  };
  function applyPicks(picks, preset) {
    const g = gameRef.current;
    g.setMarks(picks, preset.mustHave);
    g.hud.spent = picks.reduce((s, x) => s + byId.get(x).price, 0);
    g.hud.remaining = preset.budget - g.hud.spent;
    g.hud.items = picks; g.hud.score = Math.round(picks.reduce((s, x) => s + ((chRef.current && chRef.current.scoreById.get(x)) || 0), 0));
    g.hudDirty = true;
  }

  // ------------------------------------------------------------ AI mode
  const startAI = useCallback(async () => {
    setBusy(true); setError(''); setSummary(null); setCh(null);
    try {
      const p = await api.plan(planRequest(cfg));
      const full = { ...p, budget: cfg.budget, mode: 'ai' };
      setPlan(full); setTab('cart');
      gameRef.current.setRadar(radar);
      gameRef.current.play(full, { algo: cfg.path });
    } catch (e) {
      setError(String(e.message || e));
    } finally { setBusy(false); }
  }, [cfg, radar]);
  function replay(algo, skipScoring = true) {
    if (!plan) return;
    setSummary(null);
    gameRef.current.play(plan, { algo: algo || hud.algo, skipScoring });
  }

  // ------------------------------------------------------------ challenge mode
  async function startChallenge(preset) {
    setBusy(true); setError(''); setSummary(null);
    try {
      const p = await api.plan({
        budget: preset.budget,
        prefs: { categoryWeights: preset.catWeights, avoidCategories: preset.avoid, likedTags: preset.liked, dislikedTags: preset.disliked, mustHave: preset.mustHave },
      });
      const scoreById = new Map(p.scores.map((s) => [s.id, s.score]));
      const c = { preset, picks: [], stage: 'pick', optimalPlan: { ...p, budget: preset.budget, mode: 'ai' }, scoreById, result: null };
      setCh(c); chRef.current = c; setTab('challenge');
      gameRef.current.startPick({ budget: preset.budget, mustHave: preset.mustHave, scores: p.scores });
    } catch (e) { setError(String(e.message || e)); } finally { setBusy(false); }
  }
  async function finishChallenge() {
    const c = chRef.current;
    const missing = c.preset.mustHave.filter((id) => !c.picks.includes(id));
    if (missing.length) { setError('لازم تشتري كل المنتجات اللي عليها ⭐ الأول: ' + missing.map((id) => byId.get(id).ar).join('، ')); return; }
    setBusy(true); setError('');
    try {
      const ent = store.entrance, chk = store.checkout;
      const stops = [ent, ...c.picks.map((id) => byId.get(id).pickup), chk];
      const res = await Promise.all(stops.slice(0, -1).map((s, i) => api.path({ from: [s.x, s.y], to: [stops[i + 1].x, stops[i + 1].y], all: true })));
      const routes = { bfs: { legs: [] }, dijkstra: { legs: [] }, astar: { legs: [] } };
      res.forEach((r) => { for (const a of ['bfs', 'dijkstra', 'astar']) routes[a].legs.push(r.results[a]); });
      const visit = [{ type: 'entrance', x: ent.x, y: ent.y }, ...c.picks.map((id) => ({ type: 'product', id, ...byId.get(id).pickup })), { type: 'checkout', x: chk.x, y: chk.y }];
      const nc = { ...c, stage: 'walking' };
      setCh(nc); chRef.current = nc;
      gameRef.current.hud.mode = 'challenge';
      gameRef.current.play({ visit, routes, budget: c.preset.budget, mode: 'challenge', scores: null }, { algo: cfg.path, skipScoring: true });
      gameRef.current.scoreById = c.scoreById;
    } catch (e) { setError(String(e.message || e)); } finally { setBusy(false); }
  }
  async function finishChallengeEval() {
    const c = chRef.current;
    try {
      const r = await api.evaluate({
        budget: c.preset.budget,
        prefs: { categoryWeights: c.preset.catWeights, avoidCategories: c.preset.avoid, likedTags: c.preset.liked, dislikedTags: c.preset.disliked, mustHave: c.preset.mustHave },
        ids: c.picks, algo: 'astar',
      });
      const nc = { ...c, stage: 'result', result: r };
      setCh(nc); chRef.current = nc;
    } catch (e) { setError(String(e.message || e)); }
  }
  function quitChallenge() { setCh(null); chRef.current = null; gameRef.current.reset(); setTab('setup'); }
  function playOptimal() {
    const c = chRef.current;
    setPlan(c.optimalPlan); setTab('cart');
    gameRef.current.play(c.optimalPlan, { algo: cfg.path });
    setCh({ ...c, stage: 'result' });
  }
  function removePick(id) {
    const c = chRef.current;
    const picks = c.picks.filter((x) => x !== id);
    setCh({ ...c, picks }); applyPicks(picks, c.preset);
  }

  // ------------------------------------------------------------ controls
  const g = gameRef.current;
  const setSpeed = (s) => g && g.setSpeed(s);
  const togglePause = () => g && (g.setPaused(!hud.paused), setHud({ ...hud, paused: !hud.paused }));
  const toggleRadar = () => { setRadar(!radar); g && g.setRadar(!radar); };
  const camToggle = () => g && g.setCameraMode(camMode === 'follow' ? 'overview' : 'follow');
  const switchAlgo = (a) => {
    if (!g) return;
    g.setAlgo(a);
  };

  const pct = hud.budget ? Math.max(0, Math.min(100, (hud.remaining / hud.budget) * 100)) : 100;
  const barColor = pct > 55 ? '#35d07f' : pct > 25 ? '#f6c344' : '#ff5a4f';
  const hp = hover && byId.get(hover.id);
  const hoverScore = hp && planScores && planScores.get(hp.id);
  const running = !['idle', 'done', 'pick'].includes(hud.phase);

  return (
    <div className="game-layout">
      <aside className="sidebar">
        <div className="tabs">
          {[['setup', 'إعداد', SlidersHorizontal], ['cart', 'السلة', ReceiptText], ['search', 'بحث', Search], ['challenge', 'تحدّي', Trophy]].map(([k, l, Icon]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><Icon size={17} strokeWidth={2.2} aria-hidden="true" />{l}</button>
          ))}
        </div>
        {tab === 'setup' && <SetupPanel store={store} byId={byId} cfg={cfg} setCfg={setCfg} onStart={startAI} busy={busy} error={error} />}
        {tab === 'cart' && <CartPanel plan={plan} hud={hud} byId={byId} store={store} />}
        {tab === 'search' && (
          <div className="panel-body">
            <p className="lead">اكتب اسم منتج وهتروح الكاميرا للرف بتاعه وتنوّره. لو كتبت غلط هيقترحلك الصح (Levenshtein).</p>
            <ProductSearchBox byId={byId} pickLabel={<MapPin size={18} strokeWidth={2.2} aria-hidden="true" />} onPick={(p) => gameRef.current.focusProduct(p.id)} />
          </div>
        )}
        {tab === 'challenge' && (
          <ChallengePanel ch={ch} byId={byId} hud={hud} busy={busy} error={error}
            onStart={startChallenge} onFinish={finishChallenge} onRemove={removePick} onOptimal={playOptimal} onQuit={quitChallenge} />
        )}
      </aside>

      <section className="stage">
        <div className="hud">
          <div className="hud-budget">
            <div className="hl"><span><CircleDollarSign size={16} strokeWidth={2.2} aria-hidden="true" /> الميزانية</span><b>{Math.round(hud.remaining)} <small>/ {hud.budget} ج</small></b></div>
            <div className="bar"><div className="fill" style={{ width: pct + '%', background: barColor }} /></div>
          </div>
          <Stat icon={<ShoppingCart size={20} strokeWidth={2.2} />} label="العناصر" value={hud.items.length} />
          <Stat icon={<Star size={20} strokeWidth={2.2} />} label="النقاط" value={hud.score} />
          <Stat icon={<Footprints size={20} strokeWidth={2.2} />} label="الخطوات" value={hud.steps} sub={`جهد ${Math.round(hud.effort)}`} />
          <Stat icon={<Radar size={20} strokeWidth={2.2} />} label="خلايا المحصلة" value={hud.expanded} sub={ALGO[hud.algo] ? ALGO[hud.algo].name : ''} />
        </div>

        <div className="map-card">
          <div className={'canvas-frame'}>
            <canvas ref={canvasRef} />
          </div>
          <div className="map-legend" aria-label="ألوان أقسام المتجر">
            {store.categories.map((category) => <span className="legend-chip" key={category.id}><i style={{ background: category.color }} />{category.ar}</span>)}
          </div>
          <div className="phase">{PHASE_LABEL[hud.phase] || hud.phase}{hud.legs > 0 && running ? ` · ${hud.leg}/${hud.legs}` : ''}</div>
          <div className="ticker">{hud.text}</div>
          {showMini && legInfo && hud.phase !== 'idle' && hud.phase !== 'pick' && (
            <MiniAlgoCompare store={store} legInfo={legInfo} algo={hud.algo} onPick={switchAlgo} />
          )}
        </div>

        <div className="controls">
          <button className="cbtn" onClick={togglePause} title="إيقاف مؤقت">{hud.paused ? <Play size={18} /> : <Pause size={18} />}</button>
          <div className="control-group"><span className="control-label">السرعة</span><div className="seg">{[0.5, 1, 2, 4].map((s) => <button key={s} className={hud.speed === s ? 'on' : ''} onClick={() => setSpeed(s)}>{s}x</button>)}</div></div>
          <div className="control-group"><span className="control-label">الخوارزمية</span><div className="seg algo">{['bfs', 'dijkstra', 'astar'].map((a) => (
            <button key={a} className={hud.algo === a ? 'on' : ''} style={hud.algo === a ? { background: ALGO[a].color } : null} onClick={() => switchAlgo(a)} title={ALGO[a].desc}>{ALGO[a].name}</button>
          ))}</div></div>
          <button className="cbtn wide" onClick={() => replay(hud.algo)} disabled={!plan} title="أعد نفس الرحلة بالخوارزمية المختارة"><RefreshCw size={17} /> نفس الرحلة</button>
          <button className={'cbtn wide' + (radar ? ' on' : '')} onClick={toggleRadar} title="شوف الخوارزمية بتفكر"><Radar size={17} /> رادار</button>
          <button className="cbtn wide" onClick={camToggle}>{camMode === 'follow' ? <><MapIcon size={17} /> عرض كامل</> : <><Video size={17} /> تتبّع</>}</button>
          <button className={'cbtn wide' + (showMini ? ' on' : '')} onClick={() => setShowMini(!showMini)}><Microscope size={17} /> مقارنة</button>
          <button className="cbtn wide" onClick={() => setShowSort(true)}><ListOrdered size={17} /> ترتيب</button>
          <button className="cbtn wide" onClick={() => { setSummary(null); gameRef.current.reset(); setLegInfo(null); }}><RefreshCw size={17} /> إعادة</button>
        </div>

        {hp && hover && (
          <div className="tip" style={{ left: Math.min(hover.x + 14, window.innerWidth - 270), top: Math.min(hover.y + 14, window.innerHeight - 150) }}>
            <ProdIcon slug={hp.slug} size={46} />
            <div>
              <b>{hp.ar}</b><small>{hp.en}</small>
              <div className="tl"><span>{hp.price} ج</span><span>★ {hp.rating}</span><span>شعبية {hp.popularity}%</span>{hp.discount > 0 && <span className="good">خصم {hp.discount}%</span>}</div>
              {hoverScore != null && <div className="tl"><span className="good">درجة الـ AI: {Math.round(hoverScore)}</span></div>}
            </div>
          </div>
        )}

        {summary && (
          <div className="modal">
            <div className="card">
              <h2><BadgeCheck size={24} /> خلصت الرحلة!</h2>
              <div className="grid2">
                <Stat icon={<ShoppingCart size={20} />} label="منتجات" value={summary.items.length} />
                <Stat icon={<CircleDollarSign size={20} />} label="صرفت" value={`${Math.round(summary.spent)} ج`} sub={`وفّرت ${Math.round(summary.remaining)} ج`} />
                <Stat icon={<Star size={20} />} label="نقاط التفضيل" value={summary.score} />
                <Stat icon={<Footprints size={20} />} label="خطوات" value={summary.steps} sub={`جهد ${Math.round(summary.effort)}`} />
                <Stat icon={<Radar size={20} />} label={`خلايا فحصها ${ALGO[summary.algo].name}`} value={summary.expanded} />
              </div>
              <div className="row">
                <button className="btn primary" onClick={() => replay('bfs')}>جرّب BFS</button>
                <button className="btn primary" onClick={() => replay('dijkstra')}>جرّب Dijkstra</button>
                <button className="btn primary" onClick={() => replay('astar')}>جرّب A*</button>
              </div>
              <button className="btn" onClick={() => { setSummary(null); setTab('cart'); }}>تفاصيل السلة</button>
              <button className="linkbtn" onClick={() => setSummary(null)}>إغلاق</button>
            </div>
          </div>
        )}

        {showSort && (
          <SortOverlay store={store} byId={byId} cfg={cfg} planScores={planScores} onClose={() => setShowSort(false)}
            onShowTop={(ids) => { setShowSort(false); gameRef.current.highlightIds(ids, { dimOthers: true }); }} />
        )}
      </section>
    </div>
  );
}
