#include "ai.hpp"
#include "sorting.hpp"
#include <cmath>

namespace bw {

// ============================================================ 1. preference scoring
int Prefs::weightOf(const std::string& cat) const {
    for (size_t i = 0; i < categoryWeights.size(); i++) if (categoryWeights[i].first == cat) return categoryWeights[i].second;
    return 0;
}
bool Prefs::avoids(const std::string& cat) const {
    for (size_t i = 0; i < avoidCategories.size(); i++) if (avoidCategories[i] == cat) return true;
    return false;
}

static double clampD(double v, double lo, double hi) { return v < lo ? lo : (v > hi ? hi : v); }

static bool hasString(const std::vector<std::string>& v, const std::string& x) {
    for (size_t i = 0; i < v.size(); i++) if (v[i] == x) return true;
    return false;
}

std::vector<ScoredProduct> scoreProducts(const Store& s, const Prefs& p, const Weights& w) {
    size_t n = s.products.size();
    std::vector<double> raw(n);
    double mn = 1e18, mx = -1e18;
    for (size_t i = 0; i < n; i++) {
        const Product& pr = s.products[i];
        raw[i] = pr.rating * 100.0 / std::sqrt((double)pr.price);   // value for money
        if (raw[i] < mn) mn = raw[i];
        if (raw[i] > mx) mx = raw[i];
    }
    double sw = w.pref + w.value + w.popularity + w.discount;
    if (sw <= 0) sw = 1;
    std::vector<ScoredProduct> out(n);
    for (size_t i = 0; i < n; i++) {
        const Product& pr = s.products[i];
        ScoredProduct& sp = out[i];
        sp.id = pr.id;
        int catW = (int)clampD(p.weightOf(pr.category), -3, 3);
        double catN = catW / 3.0;
        int liked = 0, disliked = 0;
        for (size_t t = 0; t < pr.tags.size(); t++) {
            if (hasString(p.likedTags, pr.tags[t])) liked++;
            if (hasString(p.dislikedTags, pr.tags[t])) disliked++;
        }
        double tagN = clampD(0.25 * liked - 0.35 * disliked, -1, 1);
        double prefRaw = clampD(0.7 * catN + 0.3 * tagN, -1, 1);
        sp.pref = (prefRaw + 1) / 2;
        sp.value = mx > mn ? (raw[i] - mn) / (mx - mn) : 0.5;
        sp.popularity = pr.popularity / 100.0;
        sp.discount = (pr.discount > 20 ? 20 : pr.discount) / 20.0;
        sp.score = 100.0 * (w.pref * sp.pref + w.value * sp.value + w.popularity * sp.popularity + w.discount * sp.discount) / sw;
        sp.excluded = p.avoids(pr.category);

        std::string why;
        auto add = [&why](const std::string& t) { if (!why.empty()) why += ", "; why += t; };
        int ci = s.categoryIndex(pr.category);
        std::string cname = ci >= 0 ? s.categories[ci].en : pr.category;
        if (sp.excluded) add("Avoided category (" + cname + ")");
        else if (catW >= 2) add("Loved category (" + cname + ")");
        else if (catW == 1) add("Liked category (" + cname + ")");
        else if (catW < 0) add("Disliked category (" + cname + ")");
        std::string likedList;
        for (size_t t = 0; t < pr.tags.size(); t++) if (hasString(p.likedTags, pr.tags[t])) { if (!likedList.empty()) likedList += "/"; likedList += pr.tags[t]; }
        if (!likedList.empty()) add("matches " + likedList);
        std::string dislikedList;
        for (size_t t = 0; t < pr.tags.size(); t++) if (hasString(p.dislikedTags, pr.tags[t])) { if (!dislikedList.empty()) dislikedList += "/"; dislikedList += pr.tags[t]; }
        if (!dislikedList.empty()) add("disliked " + dislikedList);
        if (pr.rating >= 4.5) add("top rated");
        if (pr.popularity >= 85) add("very popular");
        if (pr.discount > 0) add(std::to_string(pr.discount) + "% off");
        if (sp.value >= 0.75) add("great value");
        sp.reason = why.empty() ? "Balanced pick" : why;
    }
    return out;
}

// ============================================================ 2. knapsack
KnapsackResult knapsackDP(const std::vector<int>& w, const std::vector<long long>& v, int capacity) {
    Stopwatch sw;
    KnapsackResult r;
    int n = (int)w.size();
    if (capacity < 0) capacity = 0;
    size_t C = (size_t)capacity + 1;
    std::vector<long long> dp(C, 0);                 // dp[c] = best value with capacity c using the items seen so far
    std::vector<unsigned char> take((size_t)n * C, 0);
    for (int i = 0; i < n; i++) {
        for (int c = capacity; c >= w[i]; c--) {
            r.cells++;
            long long cand = dp[c - w[i]] + v[i];
            if (cand > dp[c]) { dp[c] = cand; take[(size_t)i * C + c] = 1; }
        }
    }
    int c = capacity;
    for (int i = n - 1; i >= 0; i--) {
        if (take[(size_t)i * C + c]) { r.chosen.push_back(i); c -= w[i]; r.weight += w[i]; r.value += v[i]; }
    }
    // chosen is in descending index order; make it ascending (simple reversal)
    for (size_t a = 0, b = r.chosen.size(); a + 1 < b; a++, b--) { int t = r.chosen[a]; r.chosen[a] = r.chosen[b - 1]; r.chosen[b - 1] = t; }
    r.timeUs = sw.ns() / 1000;
    return r;
}

KnapsackResult knapsackGreedy(const std::vector<int>& w, const std::vector<long long>& v, int capacity) {
    Stopwatch sw;
    KnapsackResult r;
    int n = (int)w.size();
    std::vector<int> idx(n);
    for (int i = 0; i < n; i++) idx[i] = i;
    // best value-per-price first: v[a]/w[a] > v[b]/w[b]  <=>  v[a]*w[b] > v[b]*w[a]
    auto better = [&w, &v](int a, int b) {
        long long l = v[a] * w[b], rgt = v[b] * w[a];
        if (l != rgt) return l > rgt;
        return a < b;
    };
    SortStats st;
    makeSorter(better, st).merge(idx);
    int left = capacity;
    for (int k = 0; k < n; k++) {
        int i = idx[k];
        r.cells++;
        if (w[i] <= left) { left -= w[i]; r.chosen.push_back(i); r.weight += w[i]; r.value += v[i]; }
    }
    // ascending index order
    std::vector<int> asc = r.chosen;
    makeSorter([](int a, int b) { return a < b; }, st).insertion(asc);
    r.chosen = asc;
    r.timeUs = sw.ns() / 1000;
    return r;
}

namespace {
struct BruteCtx {
    const std::vector<int>* w; const std::vector<long long>* v;
    long long best = -1; std::vector<int> bestSet, cur;
    long long nodes = 0;
};
void bruteRec(BruteCtx& c, int i, int left, long long val) {
    c.nodes++;
    int n = (int)c.w->size();
    if (i == n) {
        if (val > c.best) { c.best = val; c.bestSet = c.cur; }
        return;
    }
    if ((*c.w)[i] <= left) {
        c.cur.push_back(i);
        bruteRec(c, i + 1, left - (*c.w)[i], val + (*c.v)[i]);
        c.cur.pop_back();
    }
    bruteRec(c, i + 1, left, val);
}
}  // namespace

KnapsackResult knapsackBrute(const std::vector<int>& w, const std::vector<long long>& v, int capacity) {
    Stopwatch sw;
    KnapsackResult r;
    BruteCtx c; c.w = &w; c.v = &v;
    bruteRec(c, 0, capacity, 0);
    r.chosen = c.bestSet;
    r.value = c.best < 0 ? 0 : c.best;
    for (size_t i = 0; i < r.chosen.size(); i++) r.weight += w[r.chosen[i]];
    r.cells = c.nodes;
    r.timeUs = sw.ns() / 1000;
    return r;
}

// ============================================================ 3. TSP
long long tourCost(const std::vector<int>& D, int n, const std::vector<int>& order) {
    int m = n + 2;
    long long sum = 0;
    int cur = 0;
    for (size_t i = 0; i < order.size(); i++) { sum += D[(size_t)cur * m + (order[i] + 1)]; cur = order[i] + 1; }
    sum += D[(size_t)cur * m + (n + 1)];
    return sum;
}

TspResult tspHeldKarp(const std::vector<int>& D, int n) {
    Stopwatch sw;
    TspResult r;
    if (n > 18) { r = tsp2Opt(D, n); return r; }     // exact DP is only practical for small n
    int m = n + 2;
    if (n == 0) { r.cost = D[(size_t)0 * m + 1]; r.timeUs = sw.ns() / 1000; return r; }
    const int INF = 1000000000;
    size_t full = (size_t)1 << n;
    // dp[mask][j] = cheapest way to leave the start, visit exactly the items in `mask` and stand on item j
    std::vector<int> dp(full * n, INF), parent(full * n, -1);
    for (int j = 0; j < n; j++) dp[((size_t)1 << j) * n + j] = D[(size_t)0 * m + (j + 1)];
    for (size_t mask = 1; mask < full; mask++) {
        for (int j = 0; j < n; j++) {
            if (!(mask & ((size_t)1 << j))) continue;
            int cur = dp[mask * n + j];
            if (cur >= INF) continue;
            for (int k = 0; k < n; k++) {
                if (mask & ((size_t)1 << k)) continue;
                size_t nm = mask | ((size_t)1 << k);
                int c = cur + D[(size_t)(j + 1) * m + (k + 1)];
                if (c < dp[nm * n + k]) { dp[nm * n + k] = c; parent[nm * n + k] = j; }
            }
        }
    }
    int best = INF, bj = 0;
    for (int j = 0; j < n; j++) {
        int c = dp[(full - 1) * n + j] + D[(size_t)(j + 1) * m + (n + 1)];
        if (c < best) { best = c; bj = j; }
    }
    std::vector<int> rev;
    size_t mask = full - 1;
    int j = bj;
    while (j >= 0) {
        rev.push_back(j);
        int pj = parent[mask * n + j];
        mask &= ~((size_t)1 << j);
        j = pj;
    }
    for (size_t i = rev.size(); i > 0; i--) r.order.push_back(rev[i - 1]);
    r.cost = best;
    r.timeUs = sw.ns() / 1000;
    return r;
}

TspResult tspNearestNeighbor(const std::vector<int>& D, int n) {
    Stopwatch sw;
    TspResult r;
    int m = n + 2;
    std::vector<char> used(n, 0);
    int cur = 0;
    for (int step = 0; step < n; step++) {
        int best = -1;
        for (int j = 0; j < n; j++) {
            if (used[j]) continue;
            if (best < 0 || D[(size_t)cur * m + (j + 1)] < D[(size_t)cur * m + (best + 1)]) best = j;
        }
        used[best] = 1;
        r.order.push_back(best);
        cur = best + 1;
    }
    r.cost = tourCost(D, n, r.order);
    r.timeUs = sw.ns() / 1000;
    return r;
}

TspResult tsp2Opt(const std::vector<int>& D, int n, const std::vector<int>* start) {
    Stopwatch sw;
    TspResult r;
    if (start) r.order = *start;
    else { for (int i = 0; i < n; i++) r.order.push_back(i); r.order = tspNearestNeighbor(D, n).order; }
    long long best = tourCost(D, n, r.order);
    bool improved = true;
    int rounds = 0;
    while (improved && rounds++ < 200) {
        improved = false;
        for (int i = 0; i + 1 < n; i++) {
            for (int j = i + 1; j < n; j++) {
                // reverse the segment order[i..j] and keep it if the whole tour got cheaper
                std::vector<int> cand = r.order;
                for (int a = i, b = j; a < b; a++, b--) { int t = cand[a]; cand[a] = cand[b]; cand[b] = t; }
                long long c = tourCost(D, n, cand);
                if (c < best) { best = c; r.order = cand; improved = true; }
            }
        }
    }
    r.cost = best;
    r.timeUs = sw.ns() / 1000;
    return r;
}

TspResult tspRandom(const std::vector<int>& D, int n, Rng& rng) {
    Stopwatch sw;
    TspResult r;
    for (int i = 0; i < n; i++) r.order.push_back(i);
    for (int i = n - 1; i > 0; i--) { int j = rng.below(i + 1); int t = r.order[i]; r.order[i] = r.order[j]; r.order[j] = t; }
    r.cost = tourCost(D, n, r.order);
    r.timeUs = sw.ns() / 1000;
    return r;
}

namespace {
void permRec(const std::vector<int>& D, int n, std::vector<int>& cur, std::vector<char>& used, long long& best, std::vector<int>& bestOrder) {
    if ((int)cur.size() == n) {
        long long c = tourCost(D, n, cur);
        if (best < 0 || c < best) { best = c; bestOrder = cur; }
        return;
    }
    for (int i = 0; i < n; i++) {
        if (used[i]) continue;
        used[i] = 1; cur.push_back(i);
        permRec(D, n, cur, used, best, bestOrder);
        cur.pop_back(); used[i] = 0;
    }
}
}  // namespace

TspResult tspBruteForce(const std::vector<int>& D, int n) {
    Stopwatch sw;
    TspResult r;
    std::vector<int> cur;
    std::vector<char> used(n, 0);
    long long best = -1;
    permRec(D, n, cur, used, best, r.order);
    r.cost = best < 0 ? tourCost(D, n, r.order) : best;
    r.timeUs = sw.ns() / 1000;
    return r;
}

std::vector<int> buildDistMatrix(const Store& s, const std::vector<int>& cells) {
    size_t m = cells.size();
    std::vector<int> D(m * m, 0), dist;
    for (size_t i = 0; i < m; i++) {
        dijkstraAll(s, cells[i], dist);
        for (size_t j = 0; j < m; j++) D[i * m + j] = dist[cells[j]] < 0 ? 1000000 : dist[cells[j]];
    }
    return D;
}

// ============================================================ 4. pipeline
static int cellOf(const Store& s, int x, int y) { return y * s.W + x; }

Basket selectBasket(const Store& s, const std::vector<ScoredProduct>& sc, const PlanRequest& req) {
    Basket b;
    b.algo = req.knapsack == "greedy" ? "greedy" : "dp";
    // must-have products (valid + unique)
    std::vector<int> must;
    for (size_t i = 0; i < req.prefs.mustHave.size(); i++) {
        int id = req.prefs.mustHave[i];
        if (!s.byId(id)) continue;
        bool dup = false;
        for (size_t k = 0; k < must.size(); k++) if (must[k] == id) dup = true;
        if (!dup) must.push_back(id);
    }
    b.mustHave = must;
    int mustCost = 0;
    for (size_t i = 0; i < must.size(); i++) mustCost += s.byId(must[i])->price;

    std::vector<int> forced;   // must-haves that fit
    if (mustCost <= req.budget) forced = must;
    else {
        // not everything fits: keep the best score-per-pound ones
        std::vector<int> idx(must.size());
        for (size_t i = 0; i < idx.size(); i++) idx[i] = (int)i;
        auto better = [&](int a, int c) {
            const Product* pa = s.byId(must[a]); const Product* pc = s.byId(must[c]);
            double ra = sc[s.indexOf(pa->id)].score / pa->price, rc = sc[s.indexOf(pc->id)].score / pc->price;
            if (ra != rc) return ra > rc;
            return a < c;
        };
        SortStats st;
        makeSorter(better, st).merge(idx);
        int left = req.budget;
        std::vector<char> taken(must.size(), 0);
        for (size_t k = 0; k < idx.size(); k++) {
            const Product* p = s.byId(must[idx[k]]);
            if (p->price <= left) { left -= p->price; taken[idx[k]] = 1; }
        }
        for (size_t i = 0; i < must.size(); i++) { if (taken[i]) forced.push_back(must[i]); else b.missingMust.push_back(must[i]); }
        b.feasible = false;
    }
    int forcedCost = 0;
    double forcedScore = 0;
    for (size_t i = 0; i < forced.size(); i++) {
        forcedCost += s.byId(forced[i])->price;
        forcedScore += sc[s.indexOf(forced[i])].score;
    }
    int remaining = req.budget - forcedCost;

    // knapsack candidates
    std::vector<int> candProducts, weights;
    std::vector<long long> values;
    for (size_t i = 0; i < s.products.size(); i++) {
        const Product& p = s.products[i];
        bool isMust = false;
        for (size_t k = 0; k < must.size(); k++) if (must[k] == p.id) isMust = true;
        if (isMust) continue;
        if (sc[i].excluded || sc[i].score < req.minScore || p.price > remaining) continue;
        candProducts.push_back((int)i);
        weights.push_back(p.price);
        values.push_back((long long)std::llround(sc[i].score * 100));
    }
    int sumW = 0;
    for (size_t i = 0; i < weights.size(); i++) sumW += weights[i];
    int cap = remaining < sumW ? remaining : sumW;     // a bigger table could never be used
    KnapsackResult dp = knapsackDP(weights, values, cap);
    KnapsackResult gr = knapsackGreedy(weights, values, cap);
    const KnapsackResult& pick = (b.algo == "greedy") ? gr : dp;

    std::vector<int> ids = forced;
    for (size_t i = 0; i < pick.chosen.size(); i++) ids.push_back(s.products[candProducts[pick.chosen[i]]].id);
    std::vector<int> order(ids.size());
    for (size_t i = 0; i < order.size(); i++) order[i] = (int)i;
    SortStats st;
    makeSorter([&ids](int a, int c) { return ids[a] < ids[c]; }, st).merge(order);
    for (size_t i = 0; i < order.size(); i++) b.ids.push_back(ids[order[i]]);

    for (size_t i = 0; i < b.ids.size(); i++) {
        b.total += s.byId(b.ids[i])->price;
        b.scoreSum += sc[s.indexOf(b.ids[i])].score;
    }
    b.timeUs = pick.timeUs;
    b.cells = pick.cells;
    b.greedyScoreSum = forcedScore + gr.value / 100.0;
    b.greedyTotal = forcedCost + gr.weight;
    b.gapPct = dp.value > 0 ? 100.0 * (double)(dp.value - gr.value) / (double)dp.value : 0;
    return b;
}

Visit planVisit(const Store& s, const std::vector<int>& basketIds, const std::string& tspAlgo) {
    Visit v;
    int n = (int)basketIds.size();
    std::vector<int> cells;
    cells.push_back(cellOf(s, s.entranceX, s.entranceY));
    for (int i = 0; i < n; i++) {
        const Product* p = s.byId(basketIds[i]);
        cells.push_back(cellOf(s, p->pickupX, p->pickupY));
    }
    cells.push_back(cellOf(s, s.checkoutX, s.checkoutY));
    std::vector<int> D = buildDistMatrix(s, cells);

    TspResult nn = tspNearestNeighbor(D, n);
    TspResult two = tsp2Opt(D, n, &nn.order);
    v.nnCost = nn.cost; v.nnTimeUs = nn.timeUs;
    v.twoOptCost = two.cost; v.twoOptTimeUs = two.timeUs;
    TspResult exact;
    bool haveExact = false;
    if (n <= 15) { exact = tspHeldKarp(D, n); haveExact = true; v.exactCost = exact.cost; }

    std::string algo = tspAlgo;
    if (algo == "auto") algo = (n <= 15) ? "heldkarp" : "2opt";
    if (algo == "heldkarp" && !haveExact) { if (n <= 18) { exact = tspHeldKarp(D, n); haveExact = true; v.exactCost = exact.cost; } else algo = "2opt"; }
    const TspResult* chosen = &two;
    if (algo == "heldkarp") chosen = &exact;
    else if (algo == "nn") chosen = &nn;
    v.algo = algo;
    v.cost = chosen->cost;
    v.timeUs = chosen->timeUs;
    for (size_t i = 0; i < chosen->order.size(); i++) {
        v.productIds.push_back(basketIds[chosen->order[i]]);
        v.cells.push_back(cells[chosen->order[i] + 1]);
    }
    v.cells.insert(v.cells.begin(), cells[0]);
    v.cells.push_back(cells[n + 1]);
    return v;
}

LegSet computeLegs(const Store& s, const std::vector<int>& cells, const std::string& algo) {
    LegSet ls;
    Stopwatch sw;
    for (size_t i = 0; i + 1 < cells.size(); i++) {
        PathResult p = findPath(s, cells[i], cells[i + 1], algo);
        if (p.steps > 0) ls.totalSteps += p.steps;
        if (p.cost > 0) ls.totalCost += p.cost;
        ls.totalExpanded += p.expanded;
        ls.legs.push_back(p);
    }
    ls.timeUs = sw.ns() / 1000;
    return ls;
}

PlanResult makePlan(const Store& s, const PlanRequest& req) {
    PlanResult r;
    r.budget = req.budget;
    r.scores = scoreProducts(s, req.prefs, req.weights);
    r.basket = selectBasket(s, r.scores, req);
    r.visit = planVisit(s, r.basket.ids, req.tsp);
    r.routes[0] = computeLegs(s, r.visit.cells, "bfs");
    r.routes[1] = computeLegs(s, r.visit.cells, "dijkstra");
    r.routes[2] = computeLegs(s, r.visit.cells, "astar");
    r.steps = r.routes[1].totalSteps;
    r.primaryPath = req.path;
    return r;
}

// ------------------------------------------------------------------ request parsing
static bool readIntArray(const Json* j, std::vector<int>& out) {
    if (!j) return true;
    if (!j->isArray()) return false;
    for (size_t i = 0; i < j->a.size(); i++) { if (!j->a[i].isNumber()) return false; out.push_back((int)j->a[i].n); }
    return true;
}
static bool readStrArray(const Json* j, std::vector<std::string>& out) {
    if (!j) return true;
    if (!j->isArray()) return false;
    for (size_t i = 0; i < j->a.size(); i++) { if (!j->a[i].isString()) return false; out.push_back(j->a[i].s); }
    return true;
}

bool parsePlanRequest(const Json& j, PlanRequest& r, std::string& err) {
    if (!j.isObject()) { err = "body must be a JSON object"; return false; }
    const Json* b = j.get("budget");
    if (!b || !b->isNumber() || b->n < 0) { err = "budget (number >= 0) is required"; return false; }
    r.budget = (int)(b->n > 200000 ? 200000 : b->n);
    const Json* pr = j.get("prefs");
    if (pr) {
        if (!pr->isObject()) { err = "prefs must be an object"; return false; }
        const Json* cw = pr->get("categoryWeights");
        if (cw) {
            if (!cw->isObject()) { err = "categoryWeights must be an object"; return false; }
            for (size_t i = 0; i < cw->o.size(); i++) {
                if (!cw->o[i].second.isNumber()) { err = "categoryWeights values must be numbers"; return false; }
                int v = (int)std::lround(cw->o[i].second.n);
                r.prefs.categoryWeights.push_back(std::make_pair(cw->o[i].first, v < -3 ? -3 : (v > 3 ? 3 : v)));
            }
        }
        if (!readStrArray(pr->get("avoidCategories"), r.prefs.avoidCategories) ||
            !readStrArray(pr->get("likedTags"), r.prefs.likedTags) ||
            !readStrArray(pr->get("dislikedTags"), r.prefs.dislikedTags) ||
            !readIntArray(pr->get("mustHave"), r.prefs.mustHave)) { err = "bad prefs arrays"; return false; }
    }
    const Json* w = j.get("weights");
    if (w && w->isObject()) {
        r.weights.pref = w->getNum("pref", r.weights.pref);
        r.weights.value = w->getNum("value", r.weights.value);
        r.weights.popularity = w->getNum("popularity", r.weights.popularity);
        r.weights.discount = w->getNum("discount", r.weights.discount);
    }
    r.minScore = j.getNum("minScore", r.minScore);
    const Json* al = j.get("algos");
    if (al && al->isObject()) {
        r.knapsack = al->getStr("knapsack", r.knapsack);
        r.tsp = al->getStr("tsp", r.tsp);
        r.path = al->getStr("path", r.path);
    }
    if (r.knapsack != "dp" && r.knapsack != "greedy") { err = "algos.knapsack must be dp|greedy"; return false; }
    if (r.tsp != "auto" && r.tsp != "heldkarp" && r.tsp != "nn" && r.tsp != "2opt") { err = "algos.tsp must be auto|heldkarp|nn|2opt"; return false; }
    if (r.path != "bfs" && r.path != "dijkstra" && r.path != "astar") { err = "algos.path must be bfs|dijkstra|astar"; return false; }
    return true;
}

// ------------------------------------------------------------------ response writers
static void writeLegSet(JsonWriter& w, const Store& s, const LegSet& ls, const std::vector<int>& cells) {
    (void)cells;
    w.beginObject();
    w.key("legs").beginArray();
    for (size_t i = 0; i < ls.legs.size(); i++) {
        const PathResult& p = ls.legs[i];
        w.beginObject();
        int from = cells[i], to = cells[i + 1];
        w.key("from").cell(from % s.W, from / s.W);
        w.key("to").cell(to % s.W, to / s.W);
        w.key("path").beginArray();
        for (size_t k = 0; k < p.path.size(); k++) w.cell(p.path[k] % s.W, p.path[k] / s.W);
        w.endArray();
        w.key("explored").beginArray();
        for (size_t k = 0; k < p.explored.size(); k++) w.integer(p.explored[k]);
        w.endArray();
        w.kvInt("steps", p.steps).kvInt("cost", p.cost).kvInt("expanded", p.expanded);
        w.endObject();
    }
    w.endArray();
    w.kvInt("totalSteps", ls.totalSteps).kvInt("totalCost", ls.totalCost).kvInt("totalExpanded", ls.totalExpanded).kvInt("timeUs", ls.timeUs);
    w.endObject();
}

static void writeIdArray(JsonWriter& w, const std::vector<int>& v) {
    w.beginArray();
    for (size_t i = 0; i < v.size(); i++) w.integer(v[i]);
    w.endArray();
}

std::string planToJson(const Store& s, const PlanResult& r) {
    JsonWriter w;
    w.beginObject();
    w.key("scores").beginArray();
    for (size_t i = 0; i < r.scores.size(); i++) {
        const ScoredProduct& sp = r.scores[i];
        w.beginObject();
        w.kvInt("id", sp.id).kvNum("score", sp.score, 2).kvNum("pref", sp.pref, 3).kvNum("value", sp.value, 3)
         .kvNum("popularity", sp.popularity, 3).kvNum("discount", sp.discount, 3).kvBool("excluded", sp.excluded).kv("reason", sp.reason);
        w.endObject();
    }
    w.endArray();

    const Basket& b = r.basket;
    w.key("basket").beginObject();
    w.key("ids"); writeIdArray(w, b.ids);
    w.kvInt("total", b.total).kvInt("budget", r.budget).kvInt("remaining", r.budget - b.total).kvNum("scoreSum", b.scoreSum, 2)
     .kvBool("feasible", b.feasible);
    w.key("mustHave"); writeIdArray(w, b.mustHave);
    w.key("missingMust"); writeIdArray(w, b.missingMust);
    w.kv("algo", b.algo);
    w.key("stats").beginObject();
    w.kvInt("timeUs", b.timeUs).kvInt("cells", b.cells).kvNum("greedyScoreSum", b.greedyScoreSum, 2).kvInt("greedyTotal", b.greedyTotal)
     .kvNum("gapVsGreedyPct", b.gapPct, 2);
    w.endObject();
    w.endObject();

    const Visit& v = r.visit;
    w.key("order").beginObject();
    w.key("ids"); writeIdArray(w, v.productIds);
    w.kv("algo", v.algo).kvInt("cost", v.cost).kvInt("steps", r.steps);
    w.key("stats").beginObject();
    w.kvInt("timeUs", v.timeUs).kvInt("exactCost", v.exactCost).kvInt("nnCost", v.nnCost).kvInt("twoOptCost", v.twoOptCost)
     .kvInt("nnTimeUs", v.nnTimeUs).kvInt("twoOptTimeUs", v.twoOptTimeUs);
    w.endObject();
    w.endObject();

    w.key("visit").beginArray();
    for (size_t i = 0; i < v.cells.size(); i++) {
        w.beginObject();
        bool first = (i == 0), last = (i + 1 == v.cells.size());
        w.kv("type", first ? "entrance" : (last ? "checkout" : "product"));
        if (!first && !last) w.kvInt("id", v.productIds[i - 1]);
        w.kvInt("x", v.cells[i] % s.W).kvInt("y", v.cells[i] / s.W);
        w.endObject();
    }
    w.endArray();

    w.key("routes").beginObject();
    w.key("bfs"); writeLegSet(w, s, r.routes[0], v.cells);
    w.key("dijkstra"); writeLegSet(w, s, r.routes[1], v.cells);
    w.key("astar"); writeLegSet(w, s, r.routes[2], v.cells);
    w.endObject();
    w.kv("primaryPath", r.primaryPath);
    w.endObject();
    return w.result();
}

// ============================================================ challenge mode
EvalResult evaluateChoice(const Store& s, const PlanRequest& req, const std::vector<int>& idsIn, const std::string& algo) {
    EvalResult e;
    std::vector<ScoredProduct> sc = scoreProducts(s, req.prefs, req.weights);
    // dedupe, keep the player's order
    std::vector<int> ids;
    bool unknown = false;
    for (size_t i = 0; i < idsIn.size(); i++) {
        if (!s.byId(idsIn[i])) { unknown = true; continue; }
        bool dup = false;
        for (size_t k = 0; k < ids.size(); k++) if (ids[k] == idsIn[i]) dup = true;
        if (!dup) ids.push_back(idsIn[i]);
    }
    for (size_t i = 0; i < ids.size(); i++) {
        e.total += s.byId(ids[i])->price;
        const ScoredProduct& sp = sc[s.indexOf(ids[i])];
        bool isMust = false;
        for (size_t k = 0; k < req.prefs.mustHave.size(); k++) if (req.prefs.mustHave[k] == ids[i]) isMust = true;
        if (sp.excluded && !isMust) e.avoidedPicked.push_back(ids[i]);
        else e.scoreSum += sp.score;
    }
    e.overBudget = e.total > req.budget;
    for (size_t k = 0; k < req.prefs.mustHave.size(); k++) {
        if (!s.byId(req.prefs.mustHave[k])) continue;
        bool found = false;
        for (size_t i = 0; i < ids.size(); i++) if (ids[i] == req.prefs.mustHave[k]) found = true;
        if (!found) e.mustHaveOk = false;
    }
    Basket opt = selectBasket(s, sc, req);
    e.optimalIds = opt.ids; e.optimalTotal = opt.total; e.optimalScoreSum = opt.scoreSum;

    auto cellOfProduct = [&](int id) { const Product* p = s.byId(id); return cellOf(s, p->pickupX, p->pickupY); };
    std::vector<int> cells;
    cells.push_back(cellOf(s, s.entranceX, s.entranceY));
    for (size_t i = 0; i < ids.size(); i++) cells.push_back(cellOfProduct(ids[i]));
    cells.push_back(cellOf(s, s.checkoutX, s.checkoutY));
    LegSet user = computeLegs(s, cells, algo);
    e.userSteps = user.totalSteps; e.userCost = user.totalCost;

    Visit best = planVisit(s, ids, "auto");
    LegSet bestLegs = computeLegs(s, best.cells, algo);
    e.bestOrder = best.productIds; e.bestSteps = bestLegs.totalSteps; e.bestCost = bestLegs.totalCost;

    Visit optV = planVisit(s, opt.ids, "auto");
    LegSet optLegs = computeLegs(s, optV.cells, algo);
    e.optSteps = optLegs.totalSteps; e.optCost = optLegs.totalCost;

    e.valid = !e.overBudget && e.mustHaveOk && !unknown;
    if (!e.valid) {
        e.reason = e.overBudget ? "Over budget" : (!e.mustHaveOk ? "A must-have item is missing" : "Unknown product");
        e.score = 0; e.stars = 0;
    }
    e.basketRatio = e.optimalScoreSum > 0 ? clampD(e.scoreSum / e.optimalScoreSum, 0, 1) : 1.0;
    e.routeRatio = e.userCost > 0 ? clampD((double)e.bestCost / e.userCost, 0, 1) : 1.0;
    double total = 0.7 * e.basketRatio + 0.3 * e.routeRatio;
    if (e.valid) {
        e.score = (int)std::lround(1000 * total);
        e.stars = total >= 0.9 ? 3 : (total >= 0.75 ? 2 : (total >= 0.5 ? 1 : 0));
    }
    return e;
}

std::string evalToJson(const EvalResult& e) {
    JsonWriter w;
    w.beginObject();
    w.kvBool("valid", e.valid).kv("reason", e.reason).kvInt("total", e.total).kvNum("scoreSum", e.scoreSum, 2)
     .kvBool("mustHaveOk", e.mustHaveOk).kvBool("overBudget", e.overBudget);
    w.key("avoidedPicked"); writeIdArray(w, e.avoidedPicked);
    w.key("optimal").beginObject();
    w.key("ids"); writeIdArray(w, e.optimalIds);
    w.kvInt("total", e.optimalTotal).kvNum("scoreSum", e.optimalScoreSum, 2);
    w.endObject();
    w.key("user").beginObject().kvInt("steps", e.userSteps).kvInt("cost", e.userCost).endObject();
    w.key("bestRouteForUserItems").beginObject();
    w.key("order"); writeIdArray(w, e.bestOrder);
    w.kvInt("steps", e.bestSteps).kvInt("cost", e.bestCost);
    w.endObject();
    w.key("optimalFull").beginObject().kvInt("steps", e.optSteps).kvInt("cost", e.optCost).endObject();
    w.kvNum("basketRatio", e.basketRatio, 3).kvNum("routeRatio", e.routeRatio, 3).kvInt("score", e.score).kvInt("stars", e.stars);
    w.endObject();
    return w.result();
}

}  // namespace bw
