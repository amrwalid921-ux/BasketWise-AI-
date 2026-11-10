// Arabic labels for the strings the C++ backend returns in English.
export const TAG_AR = {
  staple: 'أساسيات', healthy: 'صحي', sweet: 'حلو', protein: 'بروتين', budget: 'اقتصادي', premium: 'فاخر',
  egyptian: 'مصري', breakfast: 'فطار', fresh: 'طازج', frozen: 'مجمد', household: 'منزلي', family: 'عائلي', kids: 'أطفال',
};

export function reasonAr(reason, store) {
  if (!reason) return '';
  const catAr = (en) => {
    const c = store.categories.find((x) => x.en === en || x.id === en);
    return c ? c.ar : en;
  };
  const tags = (s) => s.split('/').map((t) => TAG_AR[t] || t).join(' و');
  return reason.split(', ').map((part) => {
    let m;
    if ((m = part.match(/^Loved category \((.+)\)$/))) return `قسم بتحبه (${catAr(m[1])})`;
    if ((m = part.match(/^Liked category \((.+)\)$/))) return `قسم كويس (${catAr(m[1])})`;
    if ((m = part.match(/^Disliked category \((.+)\)$/))) return `قسم مش بتحبه (${catAr(m[1])})`;
    if ((m = part.match(/^Avoided category \((.+)\)$/))) return `قسم مستبعد (${catAr(m[1])})`;
    if ((m = part.match(/^matches (.+)$/))) return `بيطابق: ${tags(m[1])}`;
    if ((m = part.match(/^disliked (.+)$/))) return `فيه: ${tags(m[1])} (مش بتحبه)`;
    if (part === 'top rated') return 'تقييم عالي';
    if (part === 'very popular') return 'مشهور جدًا';
    if ((m = part.match(/^(\d+)% off$/))) return `خصم ${m[1]}%`;
    if (part === 'great value') return 'قيمة ممتازة';
    if (part === 'Balanced pick') return 'اختيار متوازن';
    return part;
  }).join('، ');
}
