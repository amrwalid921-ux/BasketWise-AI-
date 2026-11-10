#include "pathfinding.hpp"
#include "util.hpp"

namespace bw {

// ============================================================ binary heap
void MinHeap::push(const HeapItem& it) {
    a_.push_back(it);
    size_t i = a_.size() - 1;
    while (i > 0) {                       // sift up
        size_t p = (i - 1) / 2;
        if (!before(a_[i], a_[p])) break;
        HeapItem t = a_[i]; a_[i] = a_[p]; a_[p] = t;
        i = p;
    }
}

HeapItem MinHeap::pop() {
    HeapItem top = a_[0];
    a_[0] = a_.back();
    a_.pop_back();
    size_t i = 0, n = a_.size();
    while (true) {                        // sift down
        size_t l = 2 * i + 1, r = l + 1, m = i;
        if (l < n && before(a_[l], a_[m])) m = l;
        if (r < n && before(a_[r], a_[m])) m = r;
        if (m == i) break;
        HeapItem t = a_[i]; a_[i] = a_[m]; a_[m] = t;
        i = m;
    }
    return top;
}

namespace {
const int DX[4] = {0, 1, 0, -1};   // up, right, down, left
const int DY[4] = {-1, 0, 1, 0};

void rebuild(const Store& s, const std::vector<int>& parent, int from, int to, PathResult& r) {
    std::vector<int> rev;
    for (int c = to; c != -1; c = parent[c]) {
        rev.push_back(c);
        if (c == from) break;
    }
    r.path.assign(rev.rbegin(), rev.rend());
    r.steps = (int)r.path.size() - 1;
    r.cost = pathCost(s, r.path);
}
}  // namespace

int pathCost(const Store& s, const std::vector<int>& path) {
    int c = 0;
    for (size_t i = 1; i < path.size(); i++) c += s.cost[path[i]];
    return c;
}

// ============================================================ BFS
PathResult bfsPath(const Store& s, int from, int to) {
    Stopwatch sw;
    PathResult r;
    int N = s.W * s.H;
    std::vector<int> parent(N, -2);       // -2 = unseen, -1 = start
    std::vector<int> queue;
    queue.reserve(N);
    parent[from] = -1;
    queue.push_back(from);
    size_t head = 0;
    bool found = false;
    while (head < queue.size()) {
        int cur = queue[head++];
        r.explored.push_back(cur);
        if (cur == to) { found = true; break; }
        int cx = cur % s.W, cy = cur / s.W;
        for (int d = 0; d < 4; d++) {
            int nx = cx + DX[d], ny = cy + DY[d];
            if (!s.walkable(nx, ny)) continue;
            int nc = ny * s.W + nx;
            if (parent[nc] != -2) continue;
            parent[nc] = cur;
            queue.push_back(nc);
        }
    }
    r.expanded = (int)r.explored.size();
    if (found) rebuild(s, parent, from, to, r);
    r.timeNs = sw.ns(); r.timeUs = r.timeNs / 1000;
    return r;
}

// ============================================================ Dijkstra
static PathResult dijkstraCore(const Store& s, int from, int to, std::vector<int>* distOut) {
    Stopwatch sw;
    PathResult r;
    int N = s.W * s.H;
    const int INF = 1 << 29;
    std::vector<int> dist(N, INF), parent(N, -2);
    std::vector<char> done(N, 0);
    MinHeap heap;
    long long seq = 0;
    dist[from] = 0; parent[from] = -1;
    heap.push({0, seq++, 0, from});
    bool found = false;
    while (!heap.empty()) {
        HeapItem it = heap.pop();
        int cur = it.node;
        if (done[cur]) continue;           // stale heap entry (lazy deletion)
        done[cur] = 1;
        if (distOut == nullptr) r.explored.push_back(cur);
        if (cur == to) { found = true; break; }
        int cx = cur % s.W, cy = cur / s.W;
        for (int d = 0; d < 4; d++) {
            int nx = cx + DX[d], ny = cy + DY[d];
            if (!s.walkable(nx, ny)) continue;
            int nc = ny * s.W + nx;
            if (done[nc]) continue;
            int nd = dist[cur] + s.cost[nc];
            if (nd < dist[nc]) {
                dist[nc] = nd; parent[nc] = cur;
                heap.push({nd, seq++, 0, nc});
            }
        }
    }
    if (distOut) {
        distOut->assign(N, -1);
        for (int i = 0; i < N; i++) if (dist[i] < INF && done[i]) (*distOut)[i] = dist[i];
    }
    r.expanded = (int)r.explored.size();
    if (found) rebuild(s, parent, from, to, r);
    r.timeNs = sw.ns(); r.timeUs = r.timeNs / 1000;
    return r;
}

PathResult dijkstraPath(const Store& s, int from, int to) { return dijkstraCore(s, from, to, nullptr); }

void dijkstraAll(const Store& s, int from, std::vector<int>& dist) { dijkstraCore(s, from, -1, &dist); }

// ============================================================ A*
PathResult astarPath(const Store& s, int from, int to) {
    Stopwatch sw;
    PathResult r;
    int N = s.W * s.H;
    const int INF = 1 << 29;
    int tx = to % s.W, ty = to / s.W;
    auto h = [&](int c) {                  // Manhattan distance (min cell cost is 1 => admissible + consistent)
        int dx = c % s.W - tx, dy = c / s.W - ty;
        return (dx < 0 ? -dx : dx) + (dy < 0 ? -dy : dy);
    };
    std::vector<int> g(N, INF), parent(N, -2);
    std::vector<char> done(N, 0);
    MinHeap heap;
    long long seq = 0;
    g[from] = 0; parent[from] = -1;
    heap.push({h(from), h(from), seq++, from});   // keys: f, h (prefer closer to goal on ties), insertion order
    bool found = false;
    while (!heap.empty()) {
        HeapItem it = heap.pop();
        int cur = it.node;
        if (done[cur]) continue;
        done[cur] = 1;
        r.explored.push_back(cur);
        if (cur == to) { found = true; break; }
        int cx = cur % s.W, cy = cur / s.W;
        for (int d = 0; d < 4; d++) {
            int nx = cx + DX[d], ny = cy + DY[d];
            if (!s.walkable(nx, ny)) continue;
            int nc = ny * s.W + nx;
            if (done[nc]) continue;
            int ng = g[cur] + s.cost[nc];
            if (ng < g[nc]) {
                g[nc] = ng; parent[nc] = cur;
                int hn = h(nc);
                heap.push({ng + hn, hn, seq++, nc});
            }
        }
    }
    r.expanded = (int)r.explored.size();
    if (found) rebuild(s, parent, from, to, r);
    r.timeNs = sw.ns(); r.timeUs = r.timeNs / 1000;
    return r;
}

PathResult findPath(const Store& s, int from, int to, const std::string& algo) {
    if (algo == "bfs") return bfsPath(s, from, to);
    if (algo == "dijkstra") return dijkstraPath(s, from, to);
    return astarPath(s, from, to);
}

}  // namespace bw
