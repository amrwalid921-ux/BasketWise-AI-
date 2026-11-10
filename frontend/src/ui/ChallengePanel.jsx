import React from 'react';
import { CHALLENGES } from '../challenges.js';
import { ProdIcon } from './ProductSearchBox.jsx';
import { BadgeCheck, Bot, CircleAlert, RotateCcw, ShoppingBasket } from 'lucide-react';

function Stars({ n }) {
  return <span className="stars">{[1, 2, 3].map((i) => <span key={i} className={i <= n ? 'on' : ''}>★</span>)}</span>;
}

export default function ChallengePanel({ ch, byId, hud, onStart, onFinish, onRemove, onOptimal, onQuit, busy, error }) {
  if (!ch) {
    return (
      <div className="panel-body">
        <p className="lead">وضع التحدّي: ميزانية صعبة وحاجات لازم تتشال. انت بتختار المنتجات بإيدك وبعدها اللعبة بتقارن نتيجتك بالحل المثالي اللي حسبه الـ backend.</p>
        {CHALLENGES.map((c) => (
          <button key={c.id} className="challenge-card" disabled={busy} onClick={() => onStart(c)}>
            <span className="ch-emoji"><ShoppingBasket size={23} strokeWidth={2.2} aria-hidden="true" /></span>
            <span className="ch-body"><b>{c.title}</b> <em>{c.level}</em><small>{c.blurb}</small></span>
            <span className="ch-budget">{c.budget} ج</span>
          </button>
        ))}
        {error && <div className="note warn">{error}</div>}
      </div>
    );
  }
  const res = ch.result;
  return (
    <div className="panel-body">
      <h3 className="ch-title"><ShoppingBasket size={20} aria-hidden="true" /> {ch.preset.title}</h3>
      <p className="dim">{ch.preset.blurb}</p>
      {ch.stage === 'pick' && (
        <>
          <div className="note">اضغط على المنتجات في الرفوف (الألوان = تقييم الـ AI لذوقك: أخضر ممتاز، أحمر ضعيف). <b>ترتيب الاختيار هو ترتيب مشيك!</b></div>
          <h4>سلتك ({ch.picks.length}) — {hud.spent}/{ch.preset.budget} ج</h4>
          <ol className="items">
            {ch.picks.map((id) => {
              const p = byId.get(id);
              return (
                <li key={id}>
                  <ProdIcon slug={p.slug} size={28} />
                  <span className="pname"><b>{p.ar}</b>{ch.preset.mustHave.includes(id) && <small><BadgeCheck size={13} aria-hidden="true" /> لازم</small>}</span>
                  <span className="price">{p.price} ج</span>
                  <button className="mini" onClick={() => onRemove(id)}>×</button>
                </li>
              );
            })}
            {ch.picks.length === 0 && <li className="dim">لسه مفيش…</li>}
          </ol>
          <div className="musts">
            {ch.preset.mustHave.map((id) => {
              const p = byId.get(id);
              const ok = ch.picks.includes(id);
              return <span key={id} className={'must' + (ok ? ' ok' : '')}>{ok ? '✓' : '★'} {p.ar}</span>;
            })}
          </div>
          {error && <div className="note warn">{error}</div>}
          <button className="btn primary big" disabled={busy || ch.picks.length === 0} onClick={onFinish}>{busy ? '… بيحسب' : <>خلّصت — ابدأ الجولة <ShoppingBasket size={19} aria-hidden="true" /></>}</button>
          <button className="linkbtn" onClick={onQuit}>خروج من التحدّي</button>
        </>
      )}
      {ch.stage === 'walking' && <div className="note">المتسوّق ماشي بالترتيب اللي اخترته…</div>}
      {ch.stage === 'result' && res && (
        <div className="result">
          <Stars n={res.stars} />
          <div className="big-score">{res.score}<small> / 1000</small></div>
          {!res.valid && <div className="note warn"><CircleAlert size={17} aria-hidden="true" /> {res.reason || 'الحل مش صالح'}</div>}
          <table className="tbl">
            <tbody>
              <tr><td>سلتك</td><td>{res.total} ج · درجات {Math.round(res.scoreSum)}</td></tr>
              <tr><td>السلة المثالية (DP)</td><td>{res.optimal.total} ج · درجات {Math.round(res.optimal.scoreSum)}</td></tr>
              <tr><td>جودة الاختيار</td><td><b>{Math.round(res.basketRatio * 100)}%</b></td></tr>
              <tr><td>مشيك</td><td>{res.user.steps} خطوة · تكلفة {res.user.cost}</td></tr>
              <tr><td>أحسن ترتيب لنفس منتجاتك</td><td>{res.bestRouteForUserItems.steps} خطوة · تكلفة {res.bestRouteForUserItems.cost}</td></tr>
              <tr><td>كفاءة المسار</td><td><b>{Math.round(res.routeRatio * 100)}%</b></td></tr>
            </tbody>
          </table>
          <button className="btn primary" onClick={onOptimal}><Bot size={18} aria-hidden="true" /> شوف الحل المثالي بيتنفذ</button>
          <button className="btn" onClick={() => onStart(ch.preset)}><RotateCcw size={17} aria-hidden="true" /> جرّب تاني</button>
          <button className="linkbtn" onClick={onQuit}>رجوع</button>
        </div>
      )}
    </div>
  );
}
