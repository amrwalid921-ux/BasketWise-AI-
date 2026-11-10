// Sorting, pathfinding, knapsack, TSP.
#include "ai.hpp"
#include "common.hpp"
#include "json.hpp"
#include "pathfinding.hpp"
#include "sorting.hpp"
#include "util.hpp"
#include <algorithm>
#include <numeric>
using namespace bw;

static const char* ALGOS[6] = {"merge", "quick", "heap", "insertion", "bubble", "selection"};

static std::vector<int> makeData(int kind, int n, Rng& r) {
    std::vector<int> v(n);
    for (int i = 0; i < n; i++) v[i] = i;
    if (kind == 0) for (int i = 0; i < n; i++) v[i] = r.below(1000000);     // random
    else if (kind == 2) std::reverse(v.begin(), v.end());                  // reversed
    else if (kind == 3) for (int i = 0; i < n; i++) v[i] = r.below(5);      // many duplicates
    else if (kind == 4) for (int i = 0; i < n; i++) v[i] = 7;               // all equal
    return v;                                                               // kind 1: sorted
}

TEST(sort_all_algos_vs_oracle) {
    Rng r(1);
    int sizes[] = {0, 1, 2, 3, 5, 10, 50, 200};
    for (int ai = 0; ai < 6; ai++)
        for (int kind = 0; kind < 5; kind++)
            for (int si = 0; si < 8; si++) {
                std::vector<int> vals = makeData(kind, sizes[si], r);
                int n = (int)vals.size();
                // sort positions by (value, position) -- the position tie-break makes the result unique
                auto less = [&vals](int a, int b) { return vals[a] != vals[b] ? vals[a] < vals[b] : a < b; };
                std::vector<int> a(n), oracle(n);
                for (int i = 0; i < n; i++) a[i] = oracle[i] = i;
                std::sort(oracle.begin(), oracle.end(), less);      // std::sort allowed as ORACLE in tests
                SortStats st;
                Sorter<decltype(less)> s(less, st, nullptr);
                CHECK(s.run(ALGOS[ai], a));
                CHECK(a == oracle);
                if (n > 1) CHECK(st.comparisons > 0);
            }
    std::vector<int> x; SortStats st; auto lt = [](int a, int b) { return a < b; };
    CHECK(!Sorter<decltype(lt)>(lt, st).run("bogus", x));
    CHECK(isSortAlgo("merge")); CHECK(!isSortAlgo("bogo"));
}

TEST(sort_stats_sanity) {
    Rng r(2);
    int n = 300;
    std::vector<int> vals = makeData(0, n, r);
    auto less = [&vals](int a, int b) { return vals[a] != vals[b] ? vals[a] < vals[b] : a < b; };
    for (int ai = 0; ai < 6; ai++) {
        std::vector<int> a(n); for (int i = 0; i < n; i++) a[i] = i;
        SortStats st; Sorter<decltype(less)> s(less, st); s.run(ALGOS[ai], a);
        std::string al = ALGOS[ai];
        if (al == "merge") { CHECK_EQ(st.swaps, 0LL); CHECK(st.writes >= n); CHECK(st.comparisons < 3000); }
        if (al == "selection") { CHECK_EQ(st.comparisons, (long long)n * (n - 1) / 2); CHECK(st.swaps <= n - 1); }
        if (al == "bubble" || al == "insertion") CHECK(st.comparisons > 20000);
        if (al == "quick" || al == "heap") CHECK(st.comparisons < 6000);
    }
    // already sorted data: bubble and insertion are linear (adaptive)
    std::vector<int> sortedv(n); for (int i = 0; i < n; i++) sortedv[i] = i;
    auto lt = [](int a, int b) { return a < b; };
    SortStats sb; Sorter<decltype(lt)>(lt, sb).bubble(sortedv); CHECK_EQ(sb.comparisons, (long long)n - 1);
    SortStats si; Sorter<decltype(lt)>(lt, si).insertion(sortedv); CHECK_EQ(si.comparisons, (long long)n - 1);
    CHECK_EQ(si.swaps + si.writes, 0LL);
}

TEST(sort_trace_replay_property) {
    Rng r(3);
    for (int ai = 0; ai < 6; ai++)
        for (int kind = 0; kind < 4; kind++) {
            int n = 60;
            std::vector<int> vals = makeData(kind, n, r);
            auto less = [&vals](int a, int b) { return vals[a] != vals[b] ? vals[a] < vals[b] : a < b; };
            std::vector<int> a(n); for (int i = 0; i < n; i++) a[i] = i;
            SortStats st; SortTrace tr; tr.enabled = true;
            Sorter<decltype(less)> s(less, st, &tr);
            s.run(ALGOS[ai], a);
            CHECK(!tr.truncated);
            CHECK(replayTrace(n, tr.ops) == a);     // replay of [0..n-1] gives the sorted order
            long long cmp = 0, sw = 0;
            for (size_t k = 0; k < tr.ops.size(); k++) { if (tr.ops[k][0] == 0) cmp++; if (tr.ops[k][0] == 1) sw++; }
            CHECK_EQ(cmp, st.comparisons);          // every comparison is traced
            CHECK_EQ(sw, st.swaps);
        }
    SortTrace t; t.enabled = true; t.cap = 5;
    std::vector<int> a = {5, 4, 3, 2, 1, 0}; SortStats st; auto lt = [](int x, int y) { return x < y; };
    Sorter<decltype(lt)>(lt, st, &t).bubble(a);
    CHECK(t.truncated); CHECK_EQ(t.ops.size(), (size_t)5);
}

// ---------- /api/sort : every key, both orders, every algo, ties by id
static double keyOf(const Product& p, const std::string& by) {
    if (by == "price") return p.price;
    if (by == "rating") return p.rating;
    if (by == "popularity") return p.popularity;
    return p.rating * (1.0 + p.discount / 50.0) * 100.0 / p.price;
}
TEST(sort_api_all_keys) {
    const Store& s = store();
    const char* keys[] = {"price", "rating", "popularity", "deal", "name", "score"};
    Json scores = Json::object();
    Rng r(4);
    for (size_t i = 0; i < s.products.size(); i++) scores.set(std::to_string(s.products[i].id), Json::number(r.below(20) * 5.5));
    for (int ki = 0; ki < 6; ki++) for (int desc = 0; desc < 2; desc++) {
        std::string by = keys[ki];
        std::vector<int> oracle;
        for (size_t i = 0; i < s.products.size(); i++) oracle.push_back(s.products[i].id);
        auto k = [&](int id) { return by == "score" ? scores.getNum(std::to_string(id), 0) : keyOf(*s.byId(id), by); };
        std::sort(oracle.begin(), oracle.end(), [&](int a, int b) {
            if (by == "name") {
                std::string na = normalize(s.byId(a)->en), nb = normalize(s.byId(b)->en);
                if (na != nb) return desc ? na > nb : na < nb;
            } else if (k(a) != k(b)) return desc ? k(a) > k(b) : k(a) < k(b);
            return a < b;                                    // tie-break: id ascending, always
        });
        for (int ai = 0; ai < 6; ai++) {
            Json req = Json::object();
            req.set("by", Json::string(by)).set("order", Json::string(desc ? "desc" : "asc")).set("algo", Json::string(ALGOS[ai]));
            if (by == "score") req.set("scores", scores);
            HttpResponse resp = post("/api/sort", req.dump());
            CHECK_EQ(resp.status, 200);
            Json j = Json::parse(resp.body);
            std::vector<int> got;
            for (size_t i = 0; i < j.get("ids")->a.size(); i++) got.push_back((int)j.get("ids")->a[i].n);
            CHECK(got == oracle);
            CHECK_EQ(j.get("stats")->getNum("n", 0), 84.0);
            CHECK_EQ(j.get("stats")->getStr("algo", ""), std::string(ALGOS[ai]));
            CHECK(j.get("trace") == nullptr);
        }
    }
}
TEST(sort_api_subset_and_trace) {
    for (int ai = 0; ai < 6; ai++) {
        HttpResponse resp = post("/api/sort", std::string("{\"by\":\"price\",\"order\":\"desc\",\"algo\":\"") + ALGOS[ai] + "\",\"ids\":[5,1,9,17,3,2,84],\"trace\":true}");
        CHECK_EQ(resp.status, 200);
        Json j = Json::parse(resp.body);
        std::vector<int> inIds = {5, 1, 9, 17, 3, 2, 84}, out;
        for (size_t i = 0; i < j.get("ids")->a.size(); i++) out.push_back((int)j.get("ids")->a[i].n);
        CHECK_EQ(out.size(), (size_t)7);
        // replay the trace on positions of the INPUT list
        std::vector<std::array<int, 3>> ops;
        for (size_t i = 0; i < j.get("trace")->a.size(); i++) {
            const Json& o = j.get("trace")->a[i];
            ops.push_back({(int)o.a[0].n, (int)o.a[1].n, (int)o.a[2].n});
        }
        std::vector<int> a = replayTrace(7, ops), viaTrace;
        for (size_t i = 0; i < a.size(); i++) viaTrace.push_back(inIds[a[i]]);
        CHECK(viaTrace == out);
        for (size_t i = 1; i < out.size(); i++) CHECK(store().byId(out[i - 1])->price >= store().byId(out[i])->price);
    }
    // big trace gets truncated
    Json j = Json::parse(post("/api/sort", "{\"by\":\"price\",\"algo\":\"bubble\",\"trace\":true,\"order\":\"desc\"}").body);
    CHECK(j.get("trace") == nullptr || j.get("trace")->a.size() <= 30000);
    CHECK(j.get("traceTruncated") != nullptr || j.get("trace") != nullptr);
    CHECK_EQ(post("/api/sort", "{\"by\":\"nope\"}").status, 400);
    CHECK_EQ(post("/api/sort", "{\"algo\":\"nope\"}").status, 400);
    CHECK_EQ(post("/api/sort", "{\"order\":\"up\"}").status, 400);
}

// ---------- pathfinding
static Store allOnes(int w, int h, const std::vector<int>& walls) {
    Store s; s.W = w; s.H = h; s.cost.assign(w * h, 1);
    for (size_t i = 0; i < walls.size(); i++) s.cost[walls[i]] = 0;
    return s;
}
static bool validPath(const Store& s, const PathResult& p, int from, int to) {
    if (p.path.empty() || p.path.front() != from || p.path.back() != to) return false;
    for (size_t i = 0; i < p.path.size(); i++) {
        if (s.cost[p.path[i]] == 0) return false;
        if (i) {
            int dx = std::abs(p.path[i] % s.W - p.path[i - 1] % s.W), dy = std::abs(p.path[i] / s.W - p.path[i - 1] / s.W);
            if (dx + dy != 1) return false;
        }
    }
    return (int)p.path.size() - 1 == p.steps && pathCost(s, p.path) == p.cost && p.expanded == (int)p.explored.size();
}
static std::vector<int> walkableCells(const Store& s) {
    std::vector<int> w;
    for (int i = 0; i < s.W * s.H; i++) if (s.cost[i]) w.push_back(i);
    return w;
}

TEST(path_bfs_is_min_steps_on_unit_grid) {
    Store s = allOnes(12, 9, {14, 15, 16, 26, 38, 50, 62, 63, 64, 40, 41});
    std::vector<int> cells = walkableCells(s);
    Rng r(7);
    for (int t = 0; t < 300; t++) {
        int a = cells[r.below((int)cells.size())], b = cells[r.below((int)cells.size())];
        PathResult bf = bfsPath(s, a, b), dj = dijkstraPath(s, a, b), as = astarPath(s, a, b);
        CHECK_EQ(bf.steps >= 0, dj.steps >= 0);
        CHECK_EQ(bf.steps, dj.steps);          // all-ones: min steps == min cost
        CHECK_EQ(bf.cost, dj.cost);
        CHECK_EQ(as.cost, dj.cost);
        if (bf.steps >= 0) { CHECK(validPath(s, bf, a, b)); CHECK(validPath(s, dj, a, b)); CHECK(validPath(s, as, a, b)); }
    }
}
TEST(path_real_store_dijkstra_equals_astar) {
    const Store& s = store();
    std::vector<int> cells = walkableCells(s);
    Rng r(11);
    int bfsWorse = 0, pairs = 600;
    for (int t = 0; t < pairs; t++) {
        int a = cells[r.below((int)cells.size())], b = cells[r.below((int)cells.size())];
        PathResult bf = bfsPath(s, a, b), dj = dijkstraPath(s, a, b), as = astarPath(s, a, b);
        CHECK(validPath(s, bf, a, b)); CHECK(validPath(s, dj, a, b)); CHECK(validPath(s, as, a, b));
        CHECK_EQ(dj.cost, as.cost);
        CHECK(bf.cost >= dj.cost);
        CHECK(bf.steps <= dj.steps);           // BFS minimises steps
        CHECK(as.expanded <= dj.expanded + 1 || as.expanded < 400);
        CHECK_EQ(dj.explored.front(), a); CHECK_EQ(dj.explored.back(), b);
        CHECK_EQ(as.explored.back(), b);
        if (bf.cost > dj.cost) bfsWorse++;
    }
    printf("    (BFS cost > Dijkstra cost on %d of %d random pairs)\n", bfsWorse, pairs);
    CHECK(bfsWorse > 0);                        // the wet-floor patches make BFS suboptimal
}
TEST(path_dijkstra_all_matches_single) {
    const Store& s = store();
    std::vector<int> dist;
    int src = s.cell(s.entranceX, s.entranceY);
    dijkstraAll(s, src, dist);
    std::vector<int> cells = walkableCells(s);
    for (int t = 0; t < 40; t++) CHECK_EQ(dist[cells[t * 7 % cells.size()]], dijkstraPath(s, src, cells[t * 7 % cells.size()]).cost);
    CHECK_EQ(dist[src], 0);
}
TEST(path_same_cell_and_unreachable) {
    Store s = allOnes(5, 5, {2, 7, 12, 17, 22});      // a wall splitting column 2
    int a = 0, b = 4;
    const char* algos[3] = {"bfs", "dijkstra", "astar"};
    for (int k = 0; k < 3; k++) {
        PathResult same = findPath(s, 6, 6, algos[k]);
        CHECK_EQ(same.steps, 0); CHECK_EQ(same.cost, 0); CHECK_EQ(same.path.size(), (size_t)1);
        PathResult un = findPath(s, a, b, algos[k]);
        CHECK(un.path.empty()); CHECK_EQ(un.steps, -1); CHECK_EQ(un.cost, -1);
        CHECK(!un.explored.empty());                  // it explored the whole left side before giving up
        CHECK(un.explored.size() <= 10);
        PathResult toWall = findPath(s, a, 7, algos[k]);   // target is a blocked cell
        CHECK_EQ(toWall.steps, -1);
    }
    // heap behaves: pops in order with ties by later keys
    MinHeap h; Rng r(1);
    for (int i = 0; i < 500; i++) h.push({r.below(50), r.below(5), i, i});
    HeapItem prev = h.pop();
    while (!h.empty()) { HeapItem c = h.pop(); CHECK(prev.k1 < c.k1 || (prev.k1 == c.k1 && (prev.k2 < c.k2 || (prev.k2 == c.k2 && prev.k3 < c.k3)))); prev = c; }
}
TEST(path_api) {
    HttpResponse r = post("/api/path", "{\"from\":[3,20],\"to\":[30,16],\"algo\":\"astar\"}");
    CHECK_EQ(r.status, 200);
    Json j = Json::parse(r.body);
    CHECK_EQ(j.getStr("algo", ""), std::string("astar"));
    CHECK_EQ(j.get("path")->a.front().a[0].n, 3.0);
    CHECK_EQ(j.get("path")->a.back().a[1].n, 16.0);
    CHECK_EQ((int)j.get("path")->a.size() - 1, (int)j.getNum("steps", -9));
    r = post("/api/path", "{\"from\":[3,20],\"to\":[30,16],\"all\":true}");
    j = Json::parse(r.body);
    CHECK(j.get("results")->get("bfs") && j.get("results")->get("dijkstra") && j.get("results")->get("astar"));
    CHECK_EQ(j.get("results")->get("dijkstra")->getNum("cost", 0), j.get("results")->get("astar")->getNum("cost", -1));
    CHECK_EQ(post("/api/path", "{\"from\":[0,0],\"to\":[3,3]}").status, 400);     // blocked start
    CHECK_EQ(post("/api/path", "{\"from\":[99,0],\"to\":[3,3]}").status, 400);
    CHECK_EQ(post("/api/path", "{\"from\":[3,3]}").status, 400);
    CHECK_EQ(post("/api/path", "{\"from\":[3,3],\"to\":[4,4],\"algo\":\"x\"}").status, 400);
}

// ---------- knapsack
TEST(knapsack_dp_vs_bruteforce) {
    Rng r(21);
    for (int t = 0; t < 400; t++) {
        int n = 1 + r.below(14);
        std::vector<int> w(n); std::vector<long long> v(n);
        for (int i = 0; i < n; i++) { w[i] = 1 + r.below(30); v[i] = r.below(100); }
        int cap = r.below(100);
        KnapsackResult dp = knapsackDP(w, v, cap), br = knapsackBrute(w, v, cap), gr = knapsackGreedy(w, v, cap);
        CHECK_EQ(dp.value, br.value);
        CHECK(dp.value >= gr.value);
        CHECK(dp.weight <= cap); CHECK(gr.weight <= cap); CHECK(br.weight <= cap);
        long long sv = 0; int sw = 0;
        for (size_t i = 0; i < dp.chosen.size(); i++) { sv += v[dp.chosen[i]]; sw += w[dp.chosen[i]]; }
        CHECK_EQ(sv, dp.value); CHECK_EQ(sw, dp.weight);
        for (size_t i = 1; i < dp.chosen.size(); i++) CHECK(dp.chosen[i - 1] < dp.chosen[i]);
    }
    KnapsackResult z = knapsackDP({}, {}, 10); CHECK_EQ(z.value, 0LL);
    KnapsackResult z2 = knapsackDP({5}, {9}, 0); CHECK(z2.chosen.empty());
    // classic greedy trap: greedy picks the dense small item, DP finds the better pair
    KnapsackResult g = knapsackGreedy({10, 6, 6}, {60, 30, 30}, 12), d = knapsackDP({10, 6, 6}, {60, 30, 30}, 12);
    CHECK_EQ(d.value, 60LL); CHECK(d.value >= g.value);
    KnapsackResult g2 = knapsackGreedy({1, 10}, {2, 19}, 10), d2 = knapsackDP({1, 10}, {2, 19}, 10);
    CHECK(d2.value > g2.value);
}

// ---------- TSP
static std::vector<int> randomMatrix(int n, Rng& r, bool asym) {
    int m = n + 2;
    std::vector<int> D(m * m, 0);
    for (int i = 0; i < m; i++) for (int j = 0; j < m; j++) if (i != j) D[i * m + j] = 1 + r.below(50);
    if (!asym) for (int i = 0; i < m; i++) for (int j = 0; j < i; j++) D[i * m + j] = D[j * m + i];
    return D;
}
static bool isPerm(const std::vector<int>& o, int n) {
    std::vector<int> c = o; std::sort(c.begin(), c.end());
    if ((int)c.size() != n) return false;
    for (int i = 0; i < n; i++) if (c[i] != i) return false;
    return true;
}
TEST(tsp_heldkarp_vs_bruteforce) {
    Rng r(31);
    for (int t = 0; t < 120; t++) {
        int n = 1 + r.below(8);
        std::vector<int> D = randomMatrix(n, r, t % 2 == 0);
        TspResult hk = tspHeldKarp(D, n), br = tspBruteForce(D, n), nn = tspNearestNeighbor(D, n);
        TspResult two = tsp2Opt(D, n, &nn.order), rnd = tspRandom(D, n, r);
        CHECK_EQ(hk.cost, br.cost);
        CHECK_EQ(tourCost(D, n, hk.order), hk.cost);
        CHECK(isPerm(hk.order, n)); CHECK(isPerm(nn.order, n)); CHECK(isPerm(two.order, n)); CHECK(isPerm(rnd.order, n));
        CHECK(hk.cost <= two.cost);
        CHECK(two.cost <= nn.cost);              // 2-opt only ever accepts improvements
        CHECK(hk.cost <= rnd.cost);
        CHECK_EQ(tourCost(D, n, two.order), two.cost);
        CHECK_EQ(tourCost(D, n, nn.order), nn.cost);
    }
    std::vector<int> D0 = {0, 7, 0, 0};            // n = 0: start -> end directly
    CHECK_EQ(tspHeldKarp(D0, 0).cost, 7LL);
}
TEST(tsp_heldkarp_15_is_fast_and_beats_heuristics) {
    Rng r(41);
    std::vector<int> D = randomMatrix(15, r, true);
    TspResult hk = tspHeldKarp(D, 15);
    CHECK(isPerm(hk.order, 15));
    CHECK_EQ(tourCost(D, 15, hk.order), hk.cost);
    printf("    (Held-Karp n=15 took %lld us)\n", hk.timeUs);
    CHECK(hk.timeUs < 300000);
    TspResult nn = tspNearestNeighbor(D, 15), two = tsp2Opt(D, 15, &nn.order);
    CHECK(hk.cost <= two.cost && two.cost <= nn.cost);
}
TEST(tsp_on_store_distance_matrix) {
    const Store& s = store();
    std::vector<int> cells = {s.cell(s.entranceX, s.entranceY)};
    int ids[] = {1, 9, 17, 29, 45, 60, 70};
    for (int i = 0; i < 7; i++) cells.push_back(s.cell(s.byId(ids[i])->pickupX, s.byId(ids[i])->pickupY));
    cells.push_back(s.cell(s.checkoutX, s.checkoutY));
    std::vector<int> D = buildDistMatrix(s, cells);
    int m = (int)cells.size();
    for (int i = 0; i < m; i++) { CHECK_EQ(D[i * m + i], 0); for (int j = 0; j < m; j++) CHECK_EQ(D[i * m + j], dijkstraPath(s, cells[i], cells[j]).cost); }
    TspResult hk = tspHeldKarp(D, 7), br = tspBruteForce(D, 7);
    CHECK_EQ(hk.cost, br.cost);
}
