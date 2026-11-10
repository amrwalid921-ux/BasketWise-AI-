#include "benchmark.hpp"
#include "ai.hpp"
#include "json.hpp"
#include "pathfinding.hpp"
#include "sorting.hpp"
#include "util.hpp"

namespace bw {

namespace {

// ---------------------------------------------------------------- sorting
void benchSorting(JsonWriter& w, Rng& rng) {
    const char* algos[6] = {"merge", "quick", "heap", "insertion", "selection", "bubble"};
    const char* datasets[4] = {"random", "sorted", "reversed", "nearly-sorted"};
    const int sizes[4] = {100, 1000, 5000, 20000};
    w.key("sorting").beginObject().key("results").beginArray();
    for (int si = 0; si < 4; si++) {
        int n = sizes[si];
        for (int di = 0; di < 4; di++) {
            std::vector<int> base(n);
            for (int i = 0; i < n; i++) base[i] = i * 3;
            if (di == 0) { for (int i = n - 1; i > 0; i--) { int j = rng.below(i + 1); int t = base[i]; base[i] = base[j]; base[j] = t; } }
            else if (di == 2) { for (int i = 0, j = n - 1; i < j; i++, j--) { int t = base[i]; base[i] = base[j]; base[j] = t; } }
            else if (di == 3) { for (int k = 0; k < n / 50 + 1; k++) { int i = rng.below(n), j = rng.below(n); int t = base[i]; base[i] = base[j]; base[j] = t; } }
            for (int ai = 0; ai < 6; ai++) {
                std::string algo = algos[ai];
                bool quadratic = (algo == "insertion" || algo == "selection" || algo == "bubble");
                if (quadratic && n > 5000) continue;
                std::vector<int> a = base;
                SortStats st;
                auto less = [](int x, int y) { return x < y; };
                Sorter<decltype(less)> sorter(less, st, nullptr);
                Stopwatch sw;
                sorter.run(algo, a);
                long long us = sw.ns() / 1000;
                w.beginObject().kv("algo", algo).kvInt("n", n).kv("dataset", datasets[di])
                 .kvInt("comparisons", st.comparisons).kvInt("swaps", st.swaps).kvInt("writes", st.writes).kvInt("timeUs", us).endObject();
            }
        }
    }
    w.endArray().endObject();
}

// ---------------------------------------------------------------- searching
std::string makeName(Rng& rng, int i) {
    static const char* syl[] = {"ba", "ko", "mi", "ra", "su", "te", "no", "li", "da", "fe", "go", "hu"};
    std::string s;
    for (int k = 0; k < 4; k++) s += syl[rng.below(12)];
    return s + "-" + std::to_string(i);
}

struct SearchRow { const char* algo; double comps; double ns; };

void writeSearchRows(JsonWriter& w, const SearchRow* rows, int n) {
    w.key("results").beginArray();
    for (int i = 0; i < n; i++) {
        w.beginObject().kv("algo", rows[i].algo).kvNum("avgComparisons", rows[i].comps, 1).kvNum("avgTimeNs", rows[i].ns, 0).endObject();
    }
    w.endArray();
}

void benchSearchOn(JsonWriter& w, const std::vector<std::string>& names, int queries, int fuzzyQueries, Rng& rng, const SearchIndex* real) {
    // build the structures under test on `names`
    int n = (int)names.size();
    StringHashTable hash;
    Trie trie;
    for (int i = 0; i < n; i++) { hash.put(names[i], i); trie.insert(decodeUtf8(names[i]), i); }
    std::vector<int> idx(n);
    for (int i = 0; i < n; i++) idx[i] = i;
    SortStats st;
    makeSorter([&names](int a, int b) { return names[a] < names[b]; }, st).merge(idx);
    std::vector<std::string> sorted(n);
    for (int i = 0; i < n; i++) sorted[i] = names[idx[i]];
    (void)real;

    std::vector<std::string> q(queries), prefixes(queries);
    std::vector<CodePoints> typos(fuzzyQueries);
    for (int i = 0; i < queries; i++) {
        q[i] = names[rng.below(n)];
        prefixes[i] = q[i].substr(0, q[i].size() < 4 ? q[i].size() : 4);
    }
    for (int i = 0; i < fuzzyQueries; i++) {
        CodePoints c = decodeUtf8(names[rng.below(n)]);
        if (c.size() > 3) c.erase(c.begin() + 1 + rng.below((int)c.size() - 2));   // one deleted letter = typo
        typos[i] = c;
    }
    SearchRow rows[5];
    volatile long long sink = 0;
    long long comps; int64_t t0;

    comps = 0; t0 = nowNs();
    for (int i = 0; i < queries; i++) sink += linearSearchString(names, q[i], &comps);
    rows[0] = {"linear", (double)comps / queries, (double)(nowNs() - t0) / queries};

    comps = 0; t0 = nowNs();
    for (int i = 0; i < queries; i++) sink += binarySearchString(sorted, q[i], &comps);
    rows[1] = {"binary", (double)comps / queries, (double)(nowNs() - t0) / queries};

    comps = 0; t0 = nowNs();
    for (int i = 0; i < queries; i++) { const std::vector<int>* r = hash.get(q[i], &comps); sink += r ? (*r)[0] : -1; }
    rows[2] = {"hash", (double)comps / queries, (double)(nowNs() - t0) / queries};

    comps = 0; t0 = nowNs();
    for (int i = 0; i < queries; i++) { std::vector<int> out; trie.collect(decodeUtf8(prefixes[i]), out, &comps); sink += (long long)out.size(); }
    rows[3] = {"trie-prefix", (double)comps / queries, (double)(nowNs() - t0) / queries};

    comps = 0; t0 = nowNs();
    std::vector<CodePoints> cps(n);
    for (int i = 0; i < n; i++) cps[i] = decodeUtf8(names[i]);
    int64_t build = nowNs() - t0;
    t0 = nowNs();
    for (int i = 0; i < fuzzyQueries; i++) {
        int best = 1 << 30;
        for (int k = 0; k < n; k++) {
            comps++;
            int diff = (int)cps[k].size() - (int)typos[i].size();
            if (diff < 0) diff = -diff;
            if (diff > 2) continue;
            int d = levenshtein(typos[i], cps[k]);
            if (d < best) best = d;
        }
        sink += best;
    }
    (void)build;
    rows[4] = {"levenshtein", (double)comps / fuzzyQueries, (double)(nowNs() - t0) / fuzzyQueries};
    (void)sink;
    writeSearchRows(w, rows, 5);
}

void benchSearching(JsonWriter& w, const Store& store, const SearchIndex& index, Rng& rng) {
    std::vector<std::string> names;
    for (size_t i = 0; i < store.products.size(); i++) names.push_back(normalize(store.products[i].en));
    w.key("searching").beginObject();
    w.kvInt("catalogSize", (long long)names.size()).kvInt("queries", 2000);
    benchSearchOn(w, names, 2000, 2000, rng, &index);
    // the same experiment on a much bigger synthetic catalog shows how the algorithms scale
    std::vector<std::string> big;
    for (int i = 0; i < 20000; i++) big.push_back(makeName(rng, i));
    w.key("scaled").beginObject().kvInt("catalogSize", (long long)big.size()).kvInt("queries", 2000);
    benchSearchOn(w, big, 2000, 40, rng, nullptr);
    w.endObject();
    w.endObject();
}

// ---------------------------------------------------------------- pathfinding
void benchPaths(JsonWriter& w, const Store& s, Rng& rng) {
    std::vector<int> cells;
    for (int i = 0; i < s.W * s.H; i++) if (s.cost[i] != 0) cells.push_back(i);
    const char* algos[3] = {"bfs", "dijkstra", "astar"};
    const int pairs = 300;
    double expanded[3] = {0, 0, 0}, ns[3] = {0, 0, 0}, steps[3] = {0, 0, 0}, cost[3] = {0, 0, 0};
    int optimal[3] = {0, 0, 0}, valid = 0;
    for (int p = 0; p < pairs; p++) {
        int a = cells[rng.below((int)cells.size())], b = cells[rng.below((int)cells.size())];
        PathResult r[3];
        for (int k = 0; k < 3; k++) r[k] = findPath(s, a, b, algos[k]);
        if (r[1].steps < 0) continue;
        valid++;
        for (int k = 0; k < 3; k++) {
            expanded[k] += r[k].expanded; ns[k] += (double)r[k].timeNs; steps[k] += r[k].steps; cost[k] += r[k].cost;
            if (r[k].cost == r[1].cost) optimal[k]++;
        }
    }
    if (valid == 0) valid = 1;
    w.key("pathfinding").beginObject().kvInt("pairs", valid).key("results").beginArray();
    for (int k = 0; k < 3; k++) {
        w.beginObject().kv("algo", algos[k]).kvNum("avgExpanded", expanded[k] / valid, 1).kvNum("avgTimeUs", ns[k] / valid / 1000.0, 1)
         .kvNum("avgSteps", steps[k] / valid, 2).kvNum("avgCost", cost[k] / valid, 2).kvNum("optimalCostPct", 100.0 * optimal[k] / valid, 1).endObject();
    }
    w.endArray().endObject();
}

// ---------------------------------------------------------------- knapsack
void benchKnapsack(JsonWriter& w, const Store& s) {
    Prefs prefs;
    prefs.categoryWeights.push_back(std::make_pair(std::string("dairy"), 2));
    prefs.categoryWeights.push_back(std::make_pair(std::string("bakery"), 3));
    prefs.categoryWeights.push_back(std::make_pair(std::string("grocery"), 1));
    prefs.categoryWeights.push_back(std::make_pair(std::string("snacks"), -2));
    prefs.likedTags.push_back("healthy");
    std::vector<ScoredProduct> sc = scoreProducts(s, prefs, Weights());
    std::vector<int> w1, w20;
    std::vector<long long> v1, v20;
    for (size_t i = 0; i < s.products.size(); i++) {
        if (sc[i].score < 40) continue;
        w1.push_back(s.products[i].price); v1.push_back((long long)(sc[i].score * 100 + 0.5));
        if (w20.size() < 20) { w20.push_back(s.products[i].price); v20.push_back((long long)(sc[i].score * 100 + 0.5)); }
    }
    const int budgets[4] = {150, 300, 600, 1000};
    w.key("knapsack").beginObject().key("results").beginArray();
    for (int bi = 0; bi < 4; bi++) {
        int B = budgets[bi];
        KnapsackResult dp = knapsackDP(w1, v1, B), gr = knapsackGreedy(w1, v1, B);
        w.beginObject().kv("algo", "dp").kvInt("budget", B).kvInt("n", (long long)w1.size()).kvNum("scoreSum", dp.value / 100.0, 2).kvInt("total", dp.weight).kvInt("timeUs", dp.timeUs).kvInt("work", dp.cells).endObject();
        w.beginObject().kv("algo", "greedy").kvInt("budget", B).kvInt("n", (long long)w1.size()).kvNum("scoreSum", gr.value / 100.0, 2).kvInt("total", gr.weight).kvInt("timeUs", gr.timeUs).kvInt("work", gr.cells).endObject();
        KnapsackResult d2 = knapsackDP(w20, v20, B), g2 = knapsackGreedy(w20, v20, B), b2 = knapsackBrute(w20, v20, B);
        w.beginObject().kv("algo", "dp").kvInt("budget", B).kvInt("n", 20).kvNum("scoreSum", d2.value / 100.0, 2).kvInt("total", d2.weight).kvInt("timeUs", d2.timeUs).kvInt("work", d2.cells).endObject();
        w.beginObject().kv("algo", "greedy").kvInt("budget", B).kvInt("n", 20).kvNum("scoreSum", g2.value / 100.0, 2).kvInt("total", g2.weight).kvInt("timeUs", g2.timeUs).kvInt("work", g2.cells).endObject();
        w.beginObject().kv("algo", "bruteforce").kvInt("budget", B).kvInt("n", 20).kvNum("scoreSum", b2.value / 100.0, 2).kvInt("total", b2.weight).kvInt("timeUs", b2.timeUs).kvInt("work", b2.cells).endObject();
    }
    w.endArray().endObject();
}

// ---------------------------------------------------------------- TSP
void benchTsp(JsonWriter& w, const Store& s, Rng& rng) {
    const int sizes[5] = {6, 8, 10, 12, 14};
    const int trials = 5;
    w.key("tsp").beginObject().kvInt("trials", trials).key("results").beginArray();
    for (int si = 0; si < 5; si++) {
        int n = sizes[si];
        double cost[4] = {0, 0, 0, 0}, us[4] = {0, 0, 0, 0};
        for (int t = 0; t < trials; t++) {
            // random distinct products
            std::vector<int> pool;
            for (size_t i = 0; i < s.products.size(); i++) pool.push_back((int)i);
            for (int i = (int)pool.size() - 1; i > 0; i--) { int j = rng.below(i + 1); int tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp; }
            std::vector<int> cells;
            cells.push_back(s.entranceY * s.W + s.entranceX);
            for (int i = 0; i < n; i++) { const Product& p = s.products[pool[i]]; cells.push_back(p.pickupY * s.W + p.pickupX); }
            cells.push_back(s.checkoutY * s.W + s.checkoutX);
            std::vector<int> D = buildDistMatrix(s, cells);
            TspResult hk = tspHeldKarp(D, n), nn = tspNearestNeighbor(D, n), two = tsp2Opt(D, n, &nn.order), rd = tspRandom(D, n, rng);
            const TspResult* all[4] = {&hk, &nn, &two, &rd};
            for (int k = 0; k < 4; k++) { cost[k] += (double)all[k]->cost; us[k] += (double)all[k]->timeUs; }
        }
        const char* names[4] = {"heldkarp", "nn", "2opt", "random"};
        for (int k = 0; k < 4; k++)
            w.beginObject().kv("algo", names[k]).kvInt("n", n).kvNum("cost", cost[k] / trials, 1).kvNum("timeUs", us[k] / trials, 1).endObject();
    }
    w.endArray().endObject();
}

}  // namespace

std::string runBenchmark(const Store& store, const SearchIndex& index, unsigned long long seed) {
    Rng rng(seed);
    JsonWriter w;
    w.beginObject();
    w.kvInt("seed", (long long)seed);
    benchSorting(w, rng);
    benchSearching(w, store, index, rng);
    benchPaths(w, store, rng);
    benchKnapsack(w, store);
    benchTsp(w, store, rng);
    w.endObject();
    return w.result();
}

}  // namespace bw
