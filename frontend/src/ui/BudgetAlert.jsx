import React from 'react';
import { TriangleAlert, X } from 'lucide-react';
import { ProdIcon } from './ProductSearchBox.jsx';

export function AltList({ alts, onPick, label = 'استبدل' }) {
  return (
    <ul className="alt-list">
      {alts.map((a) => (
        <li key={a.id}>
          <ProdIcon slug={a.slug} size={34} />
          <span className="alt-name"><b>{a.ar}</b><small>تقييم {a.rating}</small></span>
          <span className="alt-price">{a.price} ج</span>
          <button className="btn" onClick={() => onPick(a)}>{label}</button>
        </li>
      ))}
    </ul>
  );
}

// Modal shown in challenge mode when a pick would push the basket over the budget.
export default function BudgetAlert({ alert, onPickAlt, onClose }) {
  if (!alert) return null;
  const { product, over, remaining, alts } = alert;
  return (
    <div className="budget-backdrop" onClick={onClose}>
      <div className="budget-alert" role="alertdialog" aria-modal="true" aria-labelledby="ba-title" onClick={(e) => e.stopPropagation()}>
        <button className="ba-close" onClick={onClose} aria-label="إغلاق"><X size={18} aria-hidden="true" /></button>
        <h3 id="ba-title"><TriangleAlert size={22} aria-hidden="true" /> تخطّيت الميزانية</h3>
        <p><b>{product.ar}</b> بـ {product.price} ج، والمتبقي معاك {remaining} ج. ناقصك <b>{over} ج</b>.</p>
        {alts.length > 0 ? (
          <>
            <h4>بدائل مشابهة وأرخص بتدخل في ميزانيتك</h4>
            <AltList alts={alts} onPick={onPickAlt} label="ضيف" />
          </>
        ) : (
          <p className="dim">مفيش بديل أرخص في نفس القسم بيدخل في المتبقي. شيل منتج من السلة وجرّب تاني.</p>
        )}
        <button className="linkbtn" onClick={onClose}>إلغاء</button>
      </div>
    </div>
  );
}
