// Thin client for the C++ backend (see docs/API.md). Vite proxies /api -> http://127.0.0.1:8080
async function j(url, opt) {
  const r = await fetch(url, opt);
  let body = null;
  try { body = await r.json(); } catch { /* ignore */ }
  if (!r.ok) throw new Error((body && body.error) || `HTTP ${r.status}`);
  return body;
}
const post = (url, data) => j(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

export const api = {
  health: () => j('/api/health'),
  store: () => j('/api/store'),
  search: (q, limit = 8) => j(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  sort: (body) => post('/api/sort', body),
  path: (body) => post('/api/path', body),
  plan: (body) => post('/api/plan', body),
  evaluate: (body) => post('/api/evaluate', body),
  benchmark: (seed = 42) => j(`/api/benchmark?seed=${seed}`),
};

// Build the /api/plan request from the setup form state.
export function planRequest(cfg) {
  const catW = {};
  for (const [k, v] of Object.entries(cfg.catWeights || {})) if (v) catW[k] = v;
  return {
    budget: cfg.budget,
    prefs: {
      categoryWeights: catW,
      avoidCategories: cfg.avoid || [],
      likedTags: cfg.liked || [],
      dislikedTags: cfg.disliked || [],
      mustHave: cfg.mustHave || [],
    },
    algos: { knapsack: cfg.knapsack || 'dp', tsp: cfg.tsp || 'auto', path: cfg.path || 'astar' },
  };
}
