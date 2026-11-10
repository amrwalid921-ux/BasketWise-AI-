import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

export function ProdIcon({ slug, size = 34 }) {
  return <img className="picon" src={`/assets/products/${slug}.svg`} width={size} height={size} alt="" draggable={false} />;
}

const MATCH_LABEL = { id: 'ID', exact: 'تطابق تام', prefix: 'بداية الاسم', substring: 'جزء من الاسم', fuzzy: 'تصحيح إملائي' };

// Search-as-you-type box backed by /api/search (hash / binary search / trie / Levenshtein on the C++ side).
export default function ProductSearchBox({ byId, onPick, onResults, placeholder, pickLabel, compact }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const seq = useRef(0);

  useEffect(() => {
    const text = q.trim();
    if (!text) { setRes(null); setErr(''); onResults && onResults(null); return; }
    const my = ++seq.current;
    const h = setTimeout(async () => {
      try {
        const r = await api.search(text, 8);
        if (my === seq.current) { setRes(r); setErr(''); onResults && onResults(r); }
      } catch (e) { if (my === seq.current) setErr(String(e.message || e)); }
    }, 160);
    return () => clearTimeout(h);
  }, [q]);

  return (
    <div className={'psearch' + (compact ? ' compact' : '')}>
      <input
        className="input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder || 'ابحث بالاسم أو الـ ID… (جرّب: mlk / عيش بلدى / #12)'}
        dir="auto"
        spellCheck={false}
      />
      {err && <div className="note warn">{err}</div>}
      {res && res.suggestion && (
        <button className="suggest" onClick={() => setQ(res.suggestion.textAr || res.suggestion.text)}>
          تقصد: <b>{res.suggestion.textAr}</b> <span className="dim">({res.suggestion.text})</span> ؟
        </button>
      )}
      {res && res.results.length === 0 && <div className="note">مفيش نتيجة مطابقة.</div>}
      {res && res.results.length > 0 && (
        <ul className="plist">
          {res.results.map((r) => {
            const p = byId.get(r.id);
            if (!p) return null;
            return (
              <li key={r.id} onClick={() => onPick && onPick(p, r)}>
                <ProdIcon slug={p.slug} size={30} />
                <span className="pname">
                  <b>{p.ar}</b>
                  <small>{p.en} · #{p.id}</small>
                </span>
                <span className="price">{p.price} ج</span>
                <span className={'tag m-' + r.match}>{MATCH_LABEL[r.match] || r.match}</span>
                {pickLabel && <span className="pick">{pickLabel}</span>}
              </li>
            );
          })}
        </ul>
      )}
      {res && res.stats && (
        <div className="algochip">
          الخوارزمية: <b>{res.mode === 'id' ? 'Binary Search (ID)' : res.stats.algo}</b> · مقارنات: {res.stats.comparisons} · {res.stats.timeUs} µs
        </div>
      )}
    </div>
  );
}
