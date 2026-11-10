import React from 'react';
import { ListOrdered, Radar, Search, SlidersHorizontal, Trophy } from 'lucide-react';

const ROWS = [
  ['Sorting', 'Merge, Quick, Heap, Insertion, Selection and Bubble', 'ترتيب الرفوف حسب السعر، التقييم، الشعبية، قوة العرض، الاسم، أو درجة الـ AI (+ ترتيب الاحتمالات داخل البحث)', 'O(n log n) … O(n²)'],
  ['Searching', 'Hash table, Binary search, Trie and Levenshtein DP', 'إيجاد المنتج بالـ ID أو الاسم (عربي/إنجليزي)، بحث بالبداية، واقتراح التصحيح لو الاسم غلط', 'O(1) · O(log n) · O(L) · O(L²)'],
  ['Shortest Path', '⁦BFS, Dijkstra (heap) and A*⁩', 'أقصر طريق مشي من المدخل لحد كل منتج وبعدين للكاشير، مع مناطق بطيئة (أرضية مبلولة، طابور)', 'O(V+E) · O((V+E) log V)'],
  ['AI — تقييم الذوق', 'Content-based scoring', 'درجة لكل منتج من تفضيلاتك + القيمة + الشعبية + الخصم', 'O(n)'],
  ['AI — اختيار السلة', '0/1 Knapsack (DP) and Greedy', 'أعلى قيمة ممكنة داخل الميزانية', 'O(n·W)'],
  ['AI — ترتيب الزيارة', 'TSP: Held–Karp, Nearest Neighbour and 2-opt', 'أذكى ترتيب لجمع المنتجات بأقصر مشي', 'O(2ⁿ·n²) · O(n²)'],
];

export default function AboutPage() {
  return (
    <div className="page about">
      <h2 className="about-title"><img src="/basketwise-ai-logo.png" alt="BasketWise AI" /> <span>قرارات شراء ذكية في حدود ميزانيتك</span></h2>
      <p className="lead">مشروع لمادتي <b>Algorithms</b> and <b>AI</b>. المستخدم بيقول معاه كام وبيحب إيه، والتطبيق يختار له أحسن سلة داخل الميزانية، يرتّب الزيارة، ويوصله لكل المنتجات بأقصر مسار — كل ده بخوارزميات مكتوبة <b>من الصفر بـ C++</b> وبتشتغل قدامك جوه لعبة سوبر ماركت.</p>
      <div className="pipeline">
        {['تفضيلاتك + الميزانية', 'تقييم كل منتج (AI)', 'Knapsack: أحسن سلة', 'TSP: أذكى ترتيب', '⁦BFS, Dijkstra and A*⁩: المشي', 'الكاشير'].map((s, i, a) => (
          <React.Fragment key={s}><span className="pstep">{s}</span>{i < a.length - 1 && <span className="parrow">←</span>}</React.Fragment>
        ))}
      </div>
      <table className="tbl about-tbl">
        <thead><tr><th>الموضوع</th><th>الخوارزميات</th><th>دورها في التطبيق</th></tr></thead>
        <tbody>{ROWS.map((r) => <tr key={r[0]}>{r.slice(0, 3).map((c, i) => <td key={i}>{i === 0 ? <b>{c}</b> : c}</td>)}</tr>)}</tbody>
      </table>
      <h3>إزاي تلعب</h3>
      <ul className="howto">
        <li><b><SlidersHorizontal size={16} aria-hidden="true" /> إعداد:</b> حدّد الميزانية، ودرجة حبّك لكل قسم، ومميزات بتحبها/مش بتحبها، وحاجات لازم تشتريها، ثم «ابدأ الرحلة».</li>
        <li><b><Radar size={16} aria-hidden="true" /> الرادار:</b> وانت بتتفرج، الخلايا اللي الخوارزمية بتفحصها بتنوّر في الأرضية. بدّل بين ⁦BFS, Dijkstra and A*⁩ وقارن بين الخرائط الصغيرة تحت.</li>
        <li><b><Search size={16} aria-hidden="true" /> بحث:</b> اكتب اسم منتج (حتى لو غلط) والكاميرا هتروح للرف.</li>
        <li><b><ListOrdered size={16} aria-hidden="true" /> ترتيب:</b> اختار معيار وخوارزمية وشوف الكروت بتتحرك مع كل مقارنة وتبديل.</li>
        <li><b><Trophy size={16} aria-hidden="true" /> تحدّي:</b> اختار المنتجات بإيدك داخل ميزانية صعبة، وشوف نتيجتك مقابل الحل المثالي.</li>
      </ul>
    </div>
  );
}
