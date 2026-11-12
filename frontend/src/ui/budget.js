// Budget helpers: find cheaper, similar products (same category, shared tags) for a product that doesn't fit.
export function similarCheaper(product, products, { exclude = new Set(), maxPrice = Infinity, limit = 3 } = {}) {
  const tags = new Set(product.tags || []);
  return products
    .filter((p) => p.id !== product.id && !exclude.has(p.id) && p.category === product.category && p.price < product.price && p.price <= maxPrice)
    .map((p) => {
      const shared = (p.tags || []).filter((t) => tags.has(t)).length;
      const union = new Set([...tags, ...(p.tags || [])]).size || 1;
      return { p, sim: shared / union + p.rating / 20 };
    })
    .sort((a, b) => b.sim - a.sim || a.p.price - b.p.price)
    .slice(0, limit)
    .map((x) => x.p);
}
