export const T = 48; // world pixels per grid cell

export const ALGO = {
  bfs: { id: 'bfs', name: 'BFS', color: '#3b9dff', soft: 'rgba(59,157,255,', desc: 'أقل عدد خطوات (يتجاهل التكلفة)' },
  dijkstra: { id: 'dijkstra', name: 'Dijkstra', color: '#b06bff', soft: 'rgba(176,107,255,', desc: 'أقل تكلفة (يفحص في كل الاتجاهات)' },
  astar: { id: 'astar', name: 'A*\u200E', color: '#ff8a1f', soft: 'rgba(255,138,31,', desc: 'أقل تكلفة بفحص أقل (بيستخدم Heuristic)' },
};

export const CAT_ICON = {
  bakery: '🥖', dairy: '🥛', meat: '🍗', frozen: '🧊', drinks: '🥤',
  produce: '🍅', grocery: '🌾', snacks: '🍫', household: '🧼',
};

export const fmtEGP = (n) => `${Math.round(n)} ج`;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
