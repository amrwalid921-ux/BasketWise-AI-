import React from 'react';
import { ProdIcon } from './ProductSearchBox.jsx';
import { ALGO } from '../engine/constants.js';
import { reasonAr } from '../i18n.js';
import { CircleAlert, ListOrdered, Radar, Route, ShoppingBasket } from 'lucide-react';

const ORDER_NAME = { heldkarp: 'Held–Karp (مثالي)', nn: 'Nearest Neighbour', '2opt': 'NN + 2-opt', random: 'عشوائي' };

export default function CartPanel({ plan, hud, byId, store }) {
  if (!plan) return <div className="panel-body"><div className="empty">ابدأ رحلة من تبويب «إعداد» وهتشوف هنا تفاصيل اختيار الـ AI.</div></div>;
  const sc = new Map(plan.scores.map((s) => [s.id, s]));
  const done = new Set(hud.items);
  const b = plan.basket, o = plan.order;
  const routes = ['bfs', 'dijkstra', 'astar'].filter((a) => plan.routes[a]);
  const minCost = Math.min(...routes.map((a) => plan.routes[a].totalCost));
  const minExp = Math.min(...routes.map((a) => plan.routes[a].totalExpanded));
  return (
    <div className="panel-body">
      <section className="cards3">
        <div className="kpi"><span>إجمالي السلة</span><b>{b.total} ج</b><small>من {b.budget} (باقي {b.remaining})</small></div>
        <div className="kpi"><span>عدد المنتجات</span><b>{b.ids.length}</b><small>مجموع الدرجات {Math.round(b.scoreSum)}</small></div>
        <div className="kpi"><span>طول الرحلة</span><b>{o.steps} خطوة</b><small>تكلفة {o.cost}</small></div>
      </section>
      {!b.feasible && <div className="note warn"><CircleAlert size={17} aria-hidden="true" /> الحاجات اللي لازم تتشال أكتر من الميزانية — اتحط اللي ينفع بس.</div>}

      <section>
        <h4><ShoppingBasket size={18} aria-hidden="true" /> اختيار السلة — Knapsack ({b.algo === 'dp' ? 'DP' : 'Greedy'})</h4>
        <div className="statline">
          <span>DP vs Greedy: <b>{Math.round(b.scoreSum)}</b> مقابل <b>{Math.round(b.stats.greedyScoreSum)}</b></span>
          {b.stats.gapVsGreedyPct > 0 && <span className="good">+{b.stats.gapVsGreedyPct}% قيمة</span>}
          <span className="dim">{b.stats.timeUs} µs</span>
        </div>
      </section>
      <section>
        <h4><Route size={18} aria-hidden="true" /> ترتيب الزيارة — {ORDER_NAME[o.algo] || o.algo}</h4>
        <div className="statline">
          {o.stats.exactCost > 0 && <span>مثالي: <b>{o.stats.exactCost}</b></span>}
          <span>NN: <b>{o.stats.nnCost}</b></span>
          <span>2-opt: <b>{o.stats.twoOptCost}</b></span>
          <span className="dim">{o.stats.timeUs} µs</span>
        </div>
      </section>
      <section>
        <h4><Radar size={18} aria-hidden="true" /> مقارنة المسارات (نفس الرحلة)</h4>
        <table className="tbl">
          <thead><tr><th>الخوارزمية</th><th>خلايا اتفحصت</th><th>خطوات</th><th>تكلفة</th><th>وقت</th></tr></thead>
          <tbody>
            {routes.map((a) => {
              const r = plan.routes[a];
              return (
                <tr key={a}>
                  <td><span className="dot" style={{ background: ALGO[a].color }} /> {ALGO[a].name}</td>
                  <td className={r.totalExpanded === minExp ? 'best' : ''}>{r.totalExpanded}</td>
                  <td>{r.totalSteps}</td>
                  <td className={r.totalCost === minCost ? 'best' : ''}>{r.totalCost}</td>
                  <td>{r.timeUs} µs</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section>
        <h4><ListOrdered size={18} aria-hidden="true" /> المنتجات بالترتيب</h4>
        <ol className="items">
          {o.ids.map((id) => {
            const p = byId.get(id), s = sc.get(id);
            return (
              <li key={id} className={done.has(id) ? 'got' : ''} title={s ? reasonAr(s.reason, store) : ''}>
                <span className="cart-category-dot" style={{ background: store.categories.find((category) => category.id === p.category)?.color }} aria-hidden="true" />
                <ProdIcon slug={p.slug} size={30} />
                <span className="pname"><b>{p.ar}</b><small>{s ? reasonAr(s.reason, store) : p.en}</small></span>
                <span className="price">{p.price} ج</span>
                <span className="score">{s ? Math.round(s.score) : ''}</span>
                {done.has(id) && <span className="tick">✓</span>}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
