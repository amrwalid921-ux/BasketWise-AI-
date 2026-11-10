import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api, planRequest } from '../api.js';
import { ProdIcon } from './ProductSearchBox.jsx';
import { ChartColumnIncreasing, Play, Shuffle, Star, X } from 'lucide-react';

const KEYS = [
  ['price', 'السعر'], ['rating', 'التقييم'], ['popularity', 'الشعبية'], ['deal', 'قوة العرض'], ['name', 'الاسم'], ['score', 'درجة الـ AI'],
];
const ALGOS = [
  ['merge', 'Merge Sort', 'O(n log n)'], ['quick', 'Quick Sort', 'O(n log n) متوسط'], ['heap', 'Heap Sort', 'O(n log n)'],
  ['insertion', 'Insertion Sort', 'O(n²)'], ['selection', 'Selection Sort', 'O(n²)'], ['bubble', 'Bubble Sort', 'O(n²)'],
];
const CARD_W = 78, CARD_H = 92;

// Replays the trace returned by /api/sort (compare / swap / write operations) with animated product cards.
export default function SortOverlay({ store, byId, cfg, planScores, onClose, onShowTop }) {
  const n = store.products.length;
  const ids = useMemo(() => store.products.map((p) => p.id), [store]);
  const [by, setBy] = useState('price');
  const [order, setOrder] = useState('asc');
  const [algo, setAlgo] = useState('merge');
  const [secs, setSecs] = useState(4);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState(null);
  const [table, setTable] = useState(null);
  const [err, setErr] = useState('');
  const [pos, setPos] = useState(() => ids.map((_, i) => i)); // element -> slot
  const [hot, setHot] = useState({ cmp: [], swap: [] });
  const [cols, setCols] = useState(12);
  const wrap = useRef(null);
  const run = useRef(0);
  const scoresRef = useRef(planScores || null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCols(Math.max(4, Math.floor(el.clientWidth / CARD_W))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => () => { run.current++; }, []);

  const keyOf = (p) => {
    if (by === 'price') return p.price + ' ج';
    if (by === 'rating') return '★ ' + p.rating;
    if (by === 'popularity') return p.popularity + '%';
    if (by === 'deal') return (p.rating * (1 + p.discount / 50) * 100 / p.price).toFixed(1);
    if (by === 'name') return p.en.slice(0, 9);
    if (by === 'score') { const s = scoresRef.current && scoresRef.current.get(p.id); return s != null ? Math.round(s) : '?'; }
    return '';
  };

  async function ensureScores() {
    if (by !== 'score') return null;
    if (!scoresRef.current) {
      const pl = await api.plan(planRequest({ ...cfg, budget: cfg.budget }));
      scoresRef.current = new Map(pl.scores.map((s) => [s.id, s.score]));
    }
    const o = {};
    for (const [id, s] of scoresRef.current) o[id] = s;
    return o;
  }

  async function start() {
    const my = ++run.current;
    setBusy(true); setErr(''); setStats(null); setTable(null);
    try {
      const scores = await ensureScores();
      const req = { by, order, algo, ids, trace: true, ...(scores ? { scores } : {}) };
      const r = await api.sort(req);
      if (my !== run.current) return;
      // reset to the input order
      let a = ids.map((_, i) => i);
      let p = ids.map((_, i) => i);
      setPos(p.slice()); setHot({ cmp: [], swap: [] });
      await new Promise((res) => setTimeout(res, 350));
      const trace = r.trace || [];
      const perFrame = Math.max(1, Math.ceil(trace.length / (secs * 60)));
      let i = 0;
      await new Promise((resolve) => {
        const step = () => {
          if (my !== run.current) return resolve();
          const cmp = [], sw = [];
          for (let k = 0; k < perFrame && i < trace.length; k++, i++) {
            const [op, x, y] = trace[i];
            if (op === 0) { cmp.length = 0; cmp.push(a[x], a[y]); }
            else if (op === 1) { const t = a[x]; a[x] = a[y]; a[y] = t; p[a[x]] = x; p[a[y]] = y; sw.push(a[x], a[y]); }
            else { a[x] = y; p[y] = x; sw.push(y); }
          }
          setPos(p.slice()); setHot({ cmp, swap: sw });
          if (i < trace.length) requestAnimationFrame(step); else resolve();
        };
        requestAnimationFrame(step);
      });
      if (my !== run.current) return;
      // final order from the server is authoritative
      const fin = ids.map(() => 0);
      r.ids.forEach((id, slot) => { fin[ids.indexOf(id)] = slot; });
      setPos(fin); setHot({ cmp: [], swap: [] });
      setStats({ ...r.stats, ids: r.ids, traceTruncated: r.traceTruncated });
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      if (my === run.current) setBusy(false);
    }
  }

  async function compareAll() {
    setErr(''); setBusy(true);
    try {
      const scores = await ensureScores();
      const rs = await Promise.all(ALGOS.map(([a]) => api.sort({ by, order, algo: a, ids, ...(scores ? { scores } : {}) })));
      setTable(rs.map((r, i) => ({ algo: ALGOS[i][1], big: ALGOS[i][2], ...r.stats })));
    } catch (e) { setErr(String(e.message || e)); } finally { setBusy(false); }
  }

  const slotXY = (slot) => ({ x: (slot % cols) * CARD_W, y: Math.floor(slot / cols) * CARD_H });
  const rowsN = Math.ceil(n / cols);

  return (
    <div className="overlay sort-overlay">
      <div className="ov-head">
        <h3><Shuffle size={19} aria-hidden="true" /> الترتيب (Sorting) — بتشوف الخوارزمية وهي بتشتغل</h3>
        <button className="btn" onClick={onClose}><X size={17} aria-hidden="true" /> إغلاق</button>
      </div>
      <div className="ov-controls">
        <label>الترتيب حسب
          <select className="input" value={by} onChange={(e) => setBy(e.target.value)} disabled={busy}>
            {KEYS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label>الاتجاه
          <select className="input" value={order} onChange={(e) => setOrder(e.target.value)} disabled={busy}>
            <option value="asc">تصاعدي</option><option value="desc">تنازلي</option>
          </select>
        </label>
        <label>الخوارزمية
          <select className="input" value={algo} onChange={(e) => setAlgo(e.target.value)} disabled={busy}>
            {ALGOS.map(([k, l, c]) => <option key={k} value={k}>{l} — {c}</option>)}
          </select>
        </label>
        <label>مدة العرض: {secs}ث
          <input type="range" min={2} max={14} value={secs} onChange={(e) => setSecs(+e.target.value)} />
        </label>
        <button className="btn primary" onClick={start} disabled={busy}><Play size={17} aria-hidden="true" /> رتّب</button>
        <button className="btn" onClick={compareAll} disabled={busy}><ChartColumnIncreasing size={17} aria-hidden="true" /> قارن الـ 6 خوارزميات</button>
      </div>
      {err && <div className="note warn">{err}</div>}

      <div className="sort-grid" ref={wrap}>
        <div className="sg-inner" style={{ height: rowsN * CARD_H, width: cols * CARD_W }}>
          {ids.map((id, e) => {
            const p = byId.get(id);
            const { x, y } = slotXY(pos[e]);
            const cls = hot.swap.includes(e) ? ' swap' : hot.cmp.includes(e) ? ' cmp' : '';
            return (
              <div key={id} className={'scard' + cls} style={{ transform: `translate(${x}px, ${y}px)`, width: CARD_W - 6, height: CARD_H - 6 }}>
                <ProdIcon slug={p.slug} size={38} />
                <span className="sc-name">{p.ar.length > 12 ? p.ar.slice(0, 11) + '…' : p.ar}</span>
                <b className="sc-key">{keyOf(p)}</b>
              </div>
            );
          })}
        </div>
      </div>

      {stats && (
        <div className="sort-stats">
          <span>الخوارزمية: <b>{stats.algo}</b></span><span>مقارنات: <b>{stats.comparisons}</b></span>
          <span>تبديلات: <b>{stats.swaps}</b></span><span>كتابات: <b>{stats.writes}</b></span><span>وقت: <b>{stats.timeUs} µs</b></span>
          <button className="btn small" onClick={() => onShowTop(stats.ids.slice(0, 10))}><Star size={15} aria-hidden="true" /> أول 10 على الرفوف</button>
        </div>
      )}
      {table && (
        <table className="tbl sort-table">
          <thead><tr><th>الخوارزمية</th><th>التعقيد</th><th>مقارنات</th><th>تبديلات</th><th>كتابات</th><th>وقت (µs)</th></tr></thead>
          <tbody>{table.map((r) => <tr key={r.algo}><td>{r.algo}</td><td className="dim">{r.big}</td><td>{r.comparisons}</td><td>{r.swaps}</td><td>{r.writes}</td><td>{r.timeUs}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  );
}
