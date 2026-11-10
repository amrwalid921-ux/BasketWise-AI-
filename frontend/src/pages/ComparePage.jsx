import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { ALGO } from '../engine/constants.js';
import { ChartColumnIncreasing, ListOrdered, RefreshCw, Route, Search, ShoppingBasket } from 'lucide-react';

const SORT_COLORS = { merge: '#3b9dff', quick: '#35d07f', heap: '#b06bff', insertion: '#f6c344', selection: '#ff8a1f', bubble: '#ff5a4f' };
const SORT_BIG = { merge: 'O(n log n)', quick: 'O(n log n) متوسط', heap: 'O(n log n)', insertion: 'O(n²)', selection: 'O(n²)', bubble: 'O(n²)' };
const fmt = (v) => (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(v >= 1e4 ? 0 : 1) + 'k' : Number.isInteger(v) ? String(v) : v.toFixed(v < 10 ? 2 : 1));

// Horizontal bar chart (SVG, no library). rows: [{label, value, color, note}]
function Bars({ rows, unit = '', log = false, height = 26 }) {
  const vals = rows.map((r) => r.value);
  const max = Math.max(...vals, 1e-9);
  const w = (v) => {
    if (v <= 0) return 0;
    if (!log) return (v / max) * 100;
    const lo = Math.log10(Math.max(1e-3, Math.min(...vals.filter((x) => x > 0))));
    const hi = Math.log10(max);
    return hi === lo ? 100 : 8 + ((Math.log10(v) - lo) / (hi - lo)) * 92;
  };
  return (
    <div className="bars">
      {rows.map((r) => (
        <div key={r.label} className="brow" style={{ height }}>
          <span className="blabel">{r.label}</span>
          <div className="btrack"><div className="bfill" style={{ width: w(r.value) + '%', background: r.color }} /></div>
          <span className="bval">{fmt(r.value)}{unit}{r.note ? <small> {r.note}</small> : null}</span>
        </div>
      ))}
    </div>
  );
}

function Section({ title, sub, children }) {
  return (
    <section className="cmp-section">
      <h3>{title}</h3>
      {sub && <p className="dim">{sub}</p>}
      {children}
    </section>
  );
}

export default function ComparePage() {
  const [seed, setSeed] = useState(42);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [n, setN] = useState(5000);
  const [dataset, setDataset] = useState('random');
  const [metric, setMetric] = useState('timeUs');
  const [scaled, setScaled] = useState(false);

  async function load(s = seed) {
    setBusy(true); setErr('');
    try { setData(await api.benchmark(s)); } catch (e) { setErr(String(e.message || e)); } finally { setBusy(false); }
  }
  useEffect(() => { load(42); }, []);

  const sortRows = useMemo(() => {
    if (!data) return [];
    return data.sorting.results.filter((r) => r.n === n && r.dataset === dataset).map((r) => ({
      label: r.algo, value: metric === 'timeUs' ? r.timeUs : r[metric], color: SORT_COLORS[r.algo], note: SORT_BIG[r.algo],
    }));
  }, [data, n, dataset, metric]);
  const sortNs = data ? [...new Set(data.sorting.results.map((r) => r.n))].sort((a, b) => a - b) : [];
  const sortDs = data ? [...new Set(data.sorting.results.map((r) => r.dataset))] : [];

  if (err) return <div className="page"><div className="note warn">{err}</div></div>;
  if (!data) return <div className="page"><div className="loading-inline">… بيشغّل الـ benchmark على الـ C++ backend</div></div>;

  const search = scaled && data.searching.scaled ? data.searching.scaled : data.searching;
  const pf = data.pathfinding.results;
  const knap = data.knapsack.results;
  const tsp = data.tsp.results;
  const knapBudgets = [...new Set(knap.map((r) => r.budget))];
  const tspNs = [...new Set(tsp.map((r) => r.n))];

  return (
    <div className="page compare">
      <div className="page-head">
        <div>
          <h2><ChartColumnIncreasing size={24} aria-hidden="true" /> مقارنة الخوارزميات بأرقام حقيقية</h2>
          <p className="dim">كل الأرقام دي اتقاسّت دلوقتي على الـ backend (C++، <code>steady_clock</code>) — مش أرقام ثابتة. seed = {data.seed}.</p>
        </div>
        <div className="row">
          <input className="input num" type="number" value={seed} onChange={(e) => setSeed(+e.target.value)} />
          <button className="btn primary" disabled={busy} onClick={() => load(seed)}>{busy ? '…' : <><RefreshCw size={17} aria-hidden="true" /> شغّل تاني</>}</button>
        </div>
      </div>

      <Section title={<><ListOrdered size={18} aria-hidden="true" /> Sorting</>} sub="ترتيب المنتجات حسب السعر/التقييم/الشعبية. مقارنات وتبديلات وكتابات بتتعدّ بالظبط جوه الكود.">
        <div className="filters">
          <label>حجم البيانات <select className="input" value={n} onChange={(e) => setN(+e.target.value)}>{sortNs.map((v) => <option key={v} value={v}>{v.toLocaleString()}</option>)}</select></label>
          <label>نوع البيانات <select className="input" value={dataset} onChange={(e) => setDataset(e.target.value)}>{sortDs.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
          <label>المقياس <select className="input" value={metric} onChange={(e) => setMetric(e.target.value)}>
            <option value="timeUs">الوقت (µs)</option><option value="comparisons">المقارنات</option><option value="swaps">التبديلات</option><option value="writes">الكتابات</option></select></label>
        </div>
        <Bars rows={sortRows} unit={metric === 'timeUs' ? ' µs' : ''} log />
        <p className="hint">الشريط بمقياس لوغاريتمي. لاحظ إن Bubble/Selection/Insertion (O(n²)) بتبعد كتير عن Merge/Quick/Heap مع كبر n، وإن Insertion بيبقى سريع جدًا على <b>sorted / nearly-sorted</b>.</p>
      </Section>

      <Section title={<><Search size={18} aria-hidden="true" /> Searching</>} sub={`${search.queries} استعلام على كتالوج من ${search.catalogSize.toLocaleString()} منتج.`}>
        <div className="filters">
          <label className="inline"><input type="checkbox" checked={scaled} onChange={(e) => setScaled(e.target.checked)} /> اعرض كتالوج مكبّر (20,000 منتج) عشان الفرق يبان</label>
        </div>
        <div className="two">
          <div><h5>متوسط الوقت للاستعلام (ns)</h5><Bars log rows={search.results.map((r) => ({ label: r.algo, value: r.avgTimeNs, color: '#3b9dff' }))} unit=" ns" /></div>
          <div><h5>متوسط عدد المقارنات</h5><Bars log rows={search.results.map((r) => ({ label: r.algo, value: r.avgComparisons, color: '#35d07f' }))} /></div>
        </div>
        <p className="hint">Hash ≈ O(1)، Binary ≈ O(log n)، Linear = O(n). الـ Trie بيدّي بحث بالبداية، وLevenshtein (DP) هو اللي بيصحّح الأخطاء الإملائية لكنه الأغلى.</p>
      </Section>

      <Section title={<><Route size={18} aria-hidden="true" /> Shortest Path</>} sub={`${data.pathfinding.pairs} زوج نقط عشوائي على خريطة المتجر (فيه أرضية مبلولة وطابور تكلفتهم أعلى).`}>
        <div className="two">
          <div><h5>متوسط الخلايا اللي اتفحصت</h5><Bars rows={pf.map((r) => ({ label: ALGO[r.algo].name, value: r.avgExpanded, color: ALGO[r.algo].color }))} /></div>
          <div><h5>متوسط تكلفة المسار (أقل = أحسن)</h5><Bars rows={pf.map((r) => ({ label: ALGO[r.algo].name, value: r.avgCost, color: ALGO[r.algo].color }))} /></div>
        </div>
        <table className="tbl">
          <thead><tr><th>الخوارزمية</th><th>خلايا مفحوصة</th><th>خطوات</th><th>تكلفة</th><th>وقت (µs)</th><th>% مسارات مثالية</th></tr></thead>
          <tbody>{pf.map((r) => (
            <tr key={r.algo}><td><span className="dot" style={{ background: ALGO[r.algo].color }} /> {ALGO[r.algo].name}</td><td>{r.avgExpanded}</td><td>{r.avgSteps}</td><td>{r.avgCost}</td><td>{r.avgTimeUs}</td><td className={r.optimalCostPct === 100 ? 'best' : ''}>{r.optimalCostPct}%</td></tr>
          ))}</tbody>
        </table>
        <p className="hint">BFS بيقلّل <i>عدد الخطوات</i> بس بيتجاهل التكلفة (الأرضية المبلولة) فبيطلّع مسارات أغلى. Dijkstra وA* دايمًا مثاليين، لكن A* بيفحص عدد أقل بكتير من الخلايا بفضل الـ Heuristic.</p>
      </Section>

      <Section title={<><ShoppingBasket size={18} aria-hidden="true" /> Knapsack (اختيار السلة)</>} sub="Dynamic Programming (مثالي) مقابل Greedy بنسبة القيمة/السعر، وBrute force على 20 منتج للتأكد.">
        <table className="tbl">
          <thead><tr><th>الميزانية</th><th>n</th><th>الخوارزمية</th><th>مجموع الدرجات</th><th>إجمالي السعر</th><th>وقت (µs)</th><th>عمل</th></tr></thead>
          <tbody>{knapBudgets.flatMap((b) => knap.filter((r) => r.budget === b).map((r, i) => {
            const best = Math.max(...knap.filter((x) => x.budget === b && x.n === r.n).map((x) => x.scoreSum));
            return <tr key={b + r.algo + r.n}><td>{i === 0 ? b : ''}</td><td>{r.n}</td><td>{r.algo}</td><td className={r.scoreSum >= best - 1e-6 ? 'best' : ''}>{r.scoreSum.toFixed(1)}</td><td>{r.total}</td><td>{r.timeUs}</td><td>{r.work.toLocaleString()}</td></tr>;
          }))}</tbody>
        </table>
      </Section>

      <Section title="TSP (ترتيب الزيارة)" sub="تكلفة أقصر مسار يمر على n منتج (متوسط 5 محاولات): Held–Karp مثالي، وNN وNN+2-opt هيوريستك، وعشوائي للمقارنة.">
        <div className="two">
          {tspNs.map((k) => (
            <div key={k}><h5>n = {k}</h5>
              <Bars rows={tsp.filter((r) => r.n === k).map((r) => ({ label: r.algo, value: r.cost, color: r.algo === 'heldkarp' ? '#35d07f' : r.algo === 'random' ? '#ff5a4f' : '#3b9dff', note: `${r.timeUs}µs` }))} height={22} />
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
