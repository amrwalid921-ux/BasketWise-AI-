import React, { memo, useState } from 'react';
import { AltList } from './BudgetAlert.jsx';
import { similarCheaper } from './budget.js';
import ProductSearchBox, { ProdIcon } from './ProductSearchBox.jsx';
import { TriangleAlert, Ban, Heart, Plus, ShoppingCart, Star, Tag, ThumbsDown, ThumbsUp, Wallet, X } from 'lucide-react';

const TAG_AR = {
  staple: 'أساسيات', healthy: 'صحي', sweet: 'حلو', protein: 'بروتين', budget: 'اقتصادي', premium: 'فاخر',
  egyptian: 'مصري', breakfast: 'فطار', fresh: 'طازج', frozen: 'مجمد', household: 'منزلي', family: 'عائلي', kids: 'أطفال',
};
const LEVEL = { '-3': ['−3', 'مش عايزه خالص'], '-2': ['−2', 'مش بحبه'], '-1': ['−1', 'أقل'], 0: ['0', 'عادي'], 1: ['+1', 'حلو'], 2: ['+2', 'بحبه'], 3: ['+3', 'أولوية'] };

export const PRESETS = [
  { id: 'default', label: 'متوازن', cfg: { budget: 500, catWeights: { bakery: 3, dairy: 2, snacks: -3 }, avoid: [], liked: ['egyptian', 'healthy'], disliked: [], mustHave: [1, 17] } },
  { id: 'healthy', label: 'صحي', cfg: { budget: 450, catWeights: { produce: 3, dairy: 2, meat: 1, snacks: -3 }, avoid: ['snacks'], liked: ['healthy', 'fresh', 'protein'], disliked: ['sweet'], mustHave: [] } },
  { id: 'tight', label: 'ميزانية ضيقة', cfg: { budget: 150, catWeights: { bakery: 2, grocery: 2, snacks: -2 }, avoid: [], liked: ['budget', 'staple'], disliked: [], mustHave: [1] } },
  { id: 'sweet', label: 'عندي حلو', cfg: { budget: 400, catWeights: { snacks: 3, bakery: 2, dairy: 1, household: -2 }, avoid: [], liked: ['sweet', 'kids'], disliked: [], mustHave: [] } },
];

function SetupPanel({ store, byId, cfg, setCfg, onStart, busy, error }) {
  const [adv, setAdv] = useState(false);
  const set = (patch) => setCfg({ ...cfg, ...patch });
  const setCat = (id, v) => set({ catWeights: { ...cfg.catWeights, [id]: v }, avoid: v <= -3 ? cfg.avoid : cfg.avoid.filter((x) => x !== id) });
  const toggleAvoid = (id) => set({ avoid: cfg.avoid.includes(id) ? cfg.avoid.filter((x) => x !== id) : [...cfg.avoid, id] });
  const tagState = (t) => (cfg.liked.includes(t) ? 1 : cfg.disliked.includes(t) ? -1 : 0);
  const cycleTag = (t) => {
    const s = tagState(t);
    const liked = cfg.liked.filter((x) => x !== t), disliked = cfg.disliked.filter((x) => x !== t);
    if (s === 0) liked.push(t); else if (s === 1) disliked.push(t);
    set({ liked, disliked });
  };

  const mustItems = cfg.mustHave.map((id) => byId.get(id)).filter(Boolean);
  const mustTotal = mustItems.reduce((t, p) => t + p.price, 0);
  const over = mustTotal - cfg.budget;
  const worst = over > 0 ? [...mustItems].sort((a, b) => b.price - a.price)[0] : null;
  let alts = [];
  if (worst) {
    const ex = new Set(cfg.mustHave);
    alts = similarCheaper(worst, store.products, { exclude: ex, maxPrice: worst.price - over, limit: 3 });
    if (!alts.length) alts = similarCheaper(worst, store.products, { exclude: ex, limit: 3 });
  }
  const swap = (a) => set({ mustHave: cfg.mustHave.map((id) => (id === worst.id ? a.id : id)) });

  return (
    <div className="panel-body">
      <div className="presets">
        {PRESETS.map((p) => (
          <button key={p.id} className="chip" onClick={() => setCfg({ ...cfg, ...p.cfg })}>{p.label}</button>
        ))}
      </div>

      <section>
        <h4><Wallet size={18} aria-hidden="true" /> معاك كام؟</h4>
        <div className="budget-row">
          <input className="input num" type="number" min={30} max={3000} value={cfg.budget}
            onChange={(e) => set({ budget: Math.max(0, Math.min(3000, +e.target.value || 0)) })} />
          <span>جنيه</span>
        </div>
        <div className="range-shell" style={{ '--range-progress': `${Math.max(0, Math.min(100, ((Math.min(1500, cfg.budget) - 50) / 1450) * 100))}%` }}>
          <input type="range" min={50} max={1500} step={10} value={Math.min(1500, cfg.budget)} onChange={(e) => set({ budget: +e.target.value })} />
        </div>
        <div className="presets small">
          {[150, 300, 600, 1000].map((b) => <button key={b} className={'chip' + (cfg.budget === b ? ' on' : '')} onClick={() => set({ budget: b })}>{b}</button>)}
        </div>
      </section>

      <section>
        <h4><Heart size={18} aria-hidden="true" /> بتحب إيه؟ <small>(بيأثر على درجة كل منتج)</small></h4>
        <div className="cats">
          {store.categories.map((c) => {
            const v = cfg.catWeights[c.id] || 0;
            const avoided = cfg.avoid.includes(c.id);
            return (
              <div key={c.id} className={'cat-row' + (avoided ? ' avoided' : '')}>
                <span className="cdot" style={{ background: c.color }} />
                <span className="cname">{c.ar}</span>
                <div className="range-shell" style={{ '--range-progress': `${((v + 3) / 6) * 100}%`, '--range-accent': c.color }}>
                  <input type="range" min={-3} max={3} step={1} value={v} onChange={(e) => setCat(c.id, +e.target.value)} />
                </div>
                <span className="clevel" title={LEVEL[v][1]}>{LEVEL[v][0]}</span>
                <button className={'mini' + (avoided ? ' on' : '')} title="استبعد القسم نهائيًا" onClick={() => toggleAvoid(c.id)}><Ban size={17} aria-hidden="true" /></button>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h4><Tag size={18} aria-hidden="true" /> مميزات <small>(اختار إعجاب أو عدم تفضيل)</small></h4>
        <div className="tagcloud">
          {store.tags.map((t) => {
            const s = tagState(t);
            return <button key={t} className={'tagbtn' + (s === 1 ? ' like' : s === -1 ? ' dislike' : '')} onClick={() => cycleTag(t)}>{s === 1 ? <ThumbsUp size={14} aria-hidden="true" /> : s === -1 ? <ThumbsDown size={14} aria-hidden="true" /> : null}{TAG_AR[t] || t}</button>;
          })}
        </div>
      </section>

      <section>
        <h4><Star size={18} aria-hidden="true" /> لازم أشتريهم</h4>
        <ProductSearchBox byId={byId} compact placeholder="ابحث وضيف منتج لازم تشتريه…" pickLabel={<Plus size={17} aria-hidden="true" />}
          onPick={(p) => !cfg.mustHave.includes(p.id) && set({ mustHave: [...cfg.mustHave, p.id] })} />
        <div className="musts">
          {cfg.mustHave.map((id) => {
            const p = byId.get(id);
            return p ? (
              <span key={id} className="must">
                <ProdIcon slug={p.slug} size={22} /> {p.ar} <small>{p.price}ج</small>
                <button aria-label={`احذف ${p.ar} من المطلوب`} onClick={() => set({ mustHave: cfg.mustHave.filter((x) => x !== id) })}><X size={15} aria-hidden="true" /></button>
              </span>
            ) : null;
          })}
          {cfg.mustHave.length === 0 && <span className="dim">مفيش — الـ AI هيختار براحته</span>}
        </div>
        {worst && (
          <div className="note warn over-budget" role="alert">
            <b><TriangleAlert size={17} aria-hidden="true" /> تخطّيت الميزانية</b>
            <span>اللي اخترته ({mustTotal} ج) أكتر من ميزانيتك ({cfg.budget} ج) بـ {over} ج. ارفع الميزانية أو شيل منتج، أو بدّل <b>{worst.ar}</b> ببديل مشابه وأرخص:</span>
            {alts.length > 0 ? <AltList alts={alts} onPick={swap} label="بدّل" /> : <span className="dim">مفيش بديل أرخص في نفس القسم.</span>}
          </div>
        )}
      </section>

      <button className="linkbtn" onClick={() => setAdv(!adv)}>{adv ? '▾' : '▸'} اختيار الخوارزميات</button>
      {adv && (
        <section className="adv">
          <label>اختيار السلة
            <select className="input" value={cfg.knapsack} onChange={(e) => set({ knapsack: e.target.value })}>
              <option value="dp">Knapsack – Dynamic Programming (مثالي)</option>
              <option value="greedy">Greedy (سريع، تقريبي)</option>
            </select>
          </label>
          <label>ترتيب الزيارة (TSP)
            <select className="input" value={cfg.tsp} onChange={(e) => set({ tsp: e.target.value })}>
              <option value="auto">تلقائي (Held–Karp لو ≤15 منتج)</option>
              <option value="heldkarp">Held–Karp (مثالي)</option>
              <option value="nn">Nearest Neighbour</option>
              <option value="2opt">NN + 2-opt</option>
            </select>
          </label>
          <label>المسار الأساسي
            <select className="input" value={cfg.path} onChange={(e) => set({ path: e.target.value })}>
              <option value="astar">A*</option>
              <option value="dijkstra">Dijkstra</option>
              <option value="bfs">BFS</option>
            </select>
          </label>
        </section>
      )}

      {error && <div className="note warn">{error}</div>}
      <button className="btn primary big" disabled={busy} onClick={onStart}>{busy ? '… بيحسب' : <>ابدأ الرحلة <ShoppingCart size={19} aria-hidden="true" /></>}</button>
    </div>
  );
}

export default memo(SetupPanel);
