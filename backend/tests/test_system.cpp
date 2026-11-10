// Planner end-to-end, evaluate, benchmark, and HTTP-level tests (real sockets).
#include "ai.hpp"
#include "common.hpp"
#include "json.hpp"
#include "server.hpp"
#include <algorithm>
#include <cstring>
#include <cmath>
#include <arpa/inet.h>
#include <atomic>
#include <netinet/in.h>
#include <sys/socket.h>
#include <thread>
#include <unistd.h>
using namespace bw;

static const char* DEFAULT_PLAN =
    "{\"budget\":600,\"prefs\":{\"categoryWeights\":{\"dairy\":2,\"bakery\":3,\"snacks\":-3},\"avoidCategories\":[\"snacks\"],"
    "\"likedTags\":[\"healthy\",\"egyptian\"],\"mustHave\":[1,17]}}";

static Json planJson(const std::string& body) {
    HttpResponse r = post("/api/plan", body);
    CHECK_EQ(r.status, 200);
    return Json::parse(r.body);
}
static std::vector<int> ints(const Json* a) {
    std::vector<int> v;
    if (a) for (size_t i = 0; i < a->a.size(); i++) v.push_back((int)a->a[i].n);
    return v;
}
static bool has(const std::vector<int>& v, int x) { for (size_t i = 0; i < v.size(); i++) if (v[i] == x) return true; return false; }

static void checkPlanInvariants(const Json& j, int budget) {
    const Store& s = store();
    const Json* basket = j.get("basket");
    std::vector<int> ids = ints(basket->get("ids")), order = ints(j.get("order")->get("ids"));
    int total = 0;
    for (size_t i = 0; i < ids.size(); i++) total += s.byId(ids[i])->price;
    CHECK_EQ((int)basket->getNum("total", -1), total);
    CHECK(total <= budget || !basket->getBool("feasible", true));
    CHECK_EQ((int)basket->getNum("remaining", -999), budget - total);
    // order is a permutation of basket
    std::vector<int> a = ids, b = order;
    std::sort(a.begin(), a.end()); std::sort(b.begin(), b.end());
    CHECK(a == b);
    // visit = entrance, products in order, checkout
    const Json* visit = j.get("visit");
    CHECK_EQ(visit->a.size(), order.size() + 2);
    CHECK_EQ(visit->a.front().getStr("type", ""), std::string("entrance"));
    CHECK_EQ(visit->a.back().getStr("type", ""), std::string("checkout"));
    CHECK_EQ((int)visit->a.front().getNum("x", -1), s.entranceX); CHECK_EQ((int)visit->a.front().getNum("y", -1), s.entranceY);
    CHECK_EQ((int)visit->a.back().getNum("x", -1), s.checkoutX); CHECK_EQ((int)visit->a.back().getNum("y", -1), s.checkoutY);
    for (size_t i = 0; i < order.size(); i++) {
        CHECK_EQ((int)visit->a[i + 1].getNum("id", -1), order[i]);
        CHECK_EQ((int)visit->a[i + 1].getNum("x", -1), s.byId(order[i])->pickupX);
    }
    const char* algos[3] = {"bfs", "dijkstra", "astar"};
    long long dCost = 0;
    for (int k = 0; k < 3; k++) {
        const Json* route = j.get("routes")->get(algos[k]);
        CHECK(route != nullptr);
        const Json* legs = route->get("legs");
        CHECK_EQ(legs->a.size(), visit->a.size() - 1);
        int steps = 0, cost = 0;
        for (size_t i = 0; i < legs->a.size(); i++) {
            const Json& leg = legs->a[i];
            // legs chain together: leg i goes from visit[i] to visit[i+1]
            CHECK_EQ((int)leg.get("from")->a[0].n, (int)visit->a[i].getNum("x", -1));
            CHECK_EQ((int)leg.get("from")->a[1].n, (int)visit->a[i].getNum("y", -1));
            CHECK_EQ((int)leg.get("to")->a[0].n, (int)visit->a[i + 1].getNum("x", -1));
            CHECK_EQ((int)leg.get("to")->a[1].n, (int)visit->a[i + 1].getNum("y", -1));
            const Json* path = leg.get("path");
            CHECK(!path->a.empty());
            CHECK_EQ(path->a.front().a[0].n, leg.get("from")->a[0].n);
            CHECK_EQ(path->a.back().a[1].n, leg.get("to")->a[1].n);
            int c = 0;
            for (size_t p = 1; p < path->a.size(); p++) {
                int x = (int)path->a[p].a[0].n, y = (int)path->a[p].a[1].n, px = (int)path->a[p - 1].a[0].n, py = (int)path->a[p - 1].a[1].n;
                CHECK_EQ(std::abs(x - px) + std::abs(y - py), 1);
                CHECK(s.walkable(x, y));
                c += s.cost[y * s.W + x];
            }
            CHECK_EQ(c, (int)leg.getNum("cost", -1));
            CHECK_EQ((int)path->a.size() - 1, (int)leg.getNum("steps", -1));
            steps += (int)leg.getNum("steps", 0); cost += (int)leg.getNum("cost", 0);
        }
        CHECK_EQ(steps, (int)route->getNum("totalSteps", -1));
        CHECK_EQ(cost, (int)route->getNum("totalCost", -1));
        if (k == 1) dCost = cost;
    }
    CHECK_EQ(j.get("routes")->get("astar")->getNum("totalCost", -1), j.get("routes")->get("dijkstra")->getNum("totalCost", -2));
    CHECK(j.get("routes")->get("bfs")->getNum("totalCost", 0) >= dCost);
    CHECK_EQ(j.get("order")->getNum("cost", -1), (double)dCost);   // TSP cost == Dijkstra route cost
}

TEST(plan_default_end_to_end) {
    Json j = planJson(DEFAULT_PLAN);
    checkPlanInvariants(j, 600);
    std::vector<int> ids = ints(j.get("basket")->get("ids"));
    CHECK(has(ids, 1) && has(ids, 17));                     // must-haves
    for (size_t i = 0; i < ids.size(); i++) CHECK(store().byId(ids[i])->category != "snacks");   // avoided
    CHECK(j.get("basket")->getBool("feasible", false));
    CHECK(j.get("basket")->get("missingMust")->a.empty());
    CHECK_EQ(j.getStr("primaryPath", ""), std::string("astar"));
    CHECK_EQ(j.get("scores")->a.size(), (size_t)84);
    const Json* s5 = nullptr;
    for (size_t i = 0; i < j.get("scores")->a.size(); i++) if ((int)j.get("scores")->a[i].getNum("id", 0) == 67) s5 = &j.get("scores")->a[i];
    CHECK(s5 && s5->getBool("excluded", false));
    CHECK(j.get("basket")->getNum("total", 0) > 500);       // the budget is really used
    CHECK_EQ(j.get("order")->getStr("algo", ""), std::string(ids.size() <= 15 ? "heldkarp" : "2opt"));
    // DP is at least as good as greedy
    CHECK(j.get("basket")->getNum("scoreSum", 0) + 0.011 >= j.get("basket")->get("stats")->getNum("greedyScoreSum", 1e9));
}
TEST(plan_tight_and_extremes) {
    Json j = planJson("{\"budget\":150}");
    checkPlanInvariants(j, 150);
    CHECK(!ints(j.get("basket")->get("ids")).empty());
    // zero budget -> empty basket, still a valid response with entrance -> checkout and one leg
    j = planJson("{\"budget\":0}");
    CHECK(ints(j.get("basket")->get("ids")).empty());
    CHECK(ints(j.get("order")->get("ids")).empty());
    CHECK_EQ(j.get("visit")->a.size(), (size_t)2);
    CHECK_EQ(j.get("routes")->get("bfs")->get("legs")->a.size(), (size_t)1);
    CHECK(j.get("routes")->get("astar")->get("legs")->a[0].getNum("steps", -1) > 0);
    // everything excluded
    j = planJson("{\"budget\":500,\"prefs\":{\"avoidCategories\":[\"bakery\",\"dairy\",\"meat\",\"frozen\",\"drinks\",\"produce\",\"grocery\",\"snacks\",\"household\"]}}");
    CHECK(ints(j.get("basket")->get("ids")).empty());
    CHECK_EQ(j.get("visit")->a.size(), (size_t)2);
    // huge budget -> everything above minScore, 2-opt path, still consistent
    j = planJson("{\"budget\":100000,\"minScore\":0}");
    CHECK_EQ(ints(j.get("basket")->get("ids")).size(), (size_t)84);
    CHECK_EQ(j.get("order")->getStr("algo", ""), std::string("2opt"));
    checkPlanInvariants(j, 100000);
}
TEST(plan_infeasible_must_have) {
    Json j = planJson("{\"budget\":100,\"prefs\":{\"mustHave\":[20,15,1]}}");   // 210 + 150 + 10 > 100
    CHECK(!j.get("basket")->getBool("feasible", true));
    CHECK(!ints(j.get("basket")->get("missingMust")).empty());
    CHECK(j.get("basket")->getNum("total", 999) <= 100);
    CHECK(has(ints(j.get("basket")->get("ids")), 1));       // the cheap, high score/price one is kept
}
TEST(plan_algo_variants) {
    const char* tsp[4] = {"auto", "heldkarp", "nn", "2opt"};
    for (int i = 0; i < 4; i++) {
        Json j = planJson(std::string("{\"budget\":200,\"algos\":{\"knapsack\":\"greedy\",\"tsp\":\"") + tsp[i] + "\",\"path\":\"bfs\"}}");
        checkPlanInvariants(j, 200);
        CHECK_EQ(j.getStr("primaryPath", ""), std::string("bfs"));
        CHECK_EQ(j.get("basket")->getStr("algo", ""), std::string("greedy"));
        const Json* st = j.get("order")->get("stats");
        CHECK(st->getNum("nnCost", 0) >= st->getNum("twoOptCost", 1e9));
        if (st->getNum("exactCost", -1) >= 0) CHECK(st->getNum("exactCost", 0) <= st->getNum("twoOptCost", 0));
    }
    CHECK_EQ(post("/api/plan", "{\"budget\":200,\"algos\":{\"tsp\":\"zzz\"}}").status, 400);
    CHECK_EQ(post("/api/plan", "{}").status, 400);
    CHECK_EQ(post("/api/plan", "{\"budget\":-5}").status, 400);
    CHECK_EQ(post("/api/plan", "{not json").status, 400);
    CHECK_EQ(post("/api/plan", "[1,2]").status, 400);
}
TEST(plan_scoring_formula) {
    PlanRequest req;
    req.prefs.categoryWeights.push_back(std::make_pair(std::string("bakery"), 3));
    req.prefs.likedTags.push_back("egyptian");
    std::vector<ScoredProduct> sc = scoreProducts(store(), req.prefs, req.weights);
    const Product& p = *store().byId(1);   // bakery, egyptian, rating 4.6, pop 98, discount 0
    const ScoredProduct& s1 = sc[store().indexOf(1)];
    double catN = 1.0, tagN = 0.25;
    double pref = (0.7 * catN + 0.3 * tagN + 1) / 2;
    CHECK_NEAR(s1.pref, pref, 1e-9);
    CHECK_NEAR(s1.popularity, 0.98, 1e-9);
    CHECK_NEAR(s1.discount, 0, 1e-9);
    CHECK_NEAR(s1.score, 100 * (0.55 * pref + 0.20 * s1.value + 0.10 * 0.98 + 0.15 * 0), 1e-6);
    CHECK(p.price == 10);
    double mn = 1e9, mx = -1e9;
    for (size_t i = 0; i < store().products.size(); i++) { const Product& q = store().products[i]; double v = q.rating * 100 / std::sqrt((double)q.price); mn = std::min(mn, v); mx = std::max(mx, v); }
    CHECK_NEAR(s1.value, (4.6 * 100 / std::sqrt(10.0) - mn) / (mx - mn), 1e-9);
    for (size_t i = 0; i < sc.size(); i++) { CHECK(sc[i].score >= 0 && sc[i].score <= 100); CHECK(!sc[i].reason.empty()); }
    // discount saturates at 20 %, weights are normalised, disliked tags hurt
    PlanRequest r2; r2.prefs.dislikedTags.push_back("sweet"); r2.weights.pref = 5.5; r2.weights.value = 2; r2.weights.popularity = 1; r2.weights.discount = 1.5;
    std::vector<ScoredProduct> s2 = scoreProducts(store(), r2.prefs, r2.weights), s0 = scoreProducts(store(), Prefs(), Weights());
    CHECK_NEAR(s2[store().indexOf(2)].score, s0[store().indexOf(2)].score, 1e-9 + 0.0 + 100 * 0.55 * 0);   // not sweet: identical (weights normalise)
    CHECK(s2[store().indexOf(6)].score < s0[store().indexOf(6)].score);
    CHECK_NEAR(s0[store().indexOf(8)].discount, 15 / 20.0, 1e-9);
}
TEST(plan_is_deterministic_and_fast) {
    std::string a = post("/api/plan", DEFAULT_PLAN).body, b = post("/api/plan", DEFAULT_PLAN).body;
    // everything except the timing fields is identical
    Json ja = Json::parse(a), jb = Json::parse(b);
    CHECK(ja.get("basket")->get("ids")->dump() == jb.get("basket")->get("ids")->dump());
    CHECK(ja.get("order")->get("ids")->dump() == jb.get("order")->get("ids")->dump());
    CHECK(ja.get("routes")->get("astar")->get("legs")->dump() == jb.get("routes")->get("astar")->get("legs")->dump());
    Stopwatch sw;
    for (int i = 0; i < 5; i++) post("/api/plan", DEFAULT_PLAN);
    long long ms = sw.ns() / 5000000;
    printf("    (plan: %lld ms per request, %zu bytes)\n", ms, a.size());
    CHECK(ms < 100);
}

TEST(evaluate_endpoint) {
    Json plan = planJson(DEFAULT_PLAN);
    std::vector<int> opt = ints(plan.get("order")->get("ids"));
    Json req = Json::parse(DEFAULT_PLAN);
    Json ids = Json::array();
    for (size_t i = 0; i < opt.size(); i++) ids.push(Json::number(opt[i]));
    req.set("ids", ids);
    HttpResponse r = post("/api/evaluate", req.dump());
    CHECK_EQ(r.status, 200);
    Json e = Json::parse(r.body);
    CHECK(e.getBool("valid", false)); CHECK(e.getBool("mustHaveOk", false)); CHECK(!e.getBool("overBudget", true));
    CHECK_NEAR(e.getNum("basketRatio", 0), 1.0, 1e-9);
    CHECK_NEAR(e.getNum("routeRatio", 0), 1.0, 1e-9);
    CHECK_EQ(e.getNum("score", 0), 1000.0); CHECK_EQ(e.getNum("stars", 0), 3.0);
    CHECK_EQ(e.get("user")->getNum("cost", -1), e.get("optimalFull")->getNum("cost", -2));
    CHECK(ints(e.get("optimal")->get("ids")) == [&] { std::vector<int> v = opt; std::sort(v.begin(), v.end()); return v; }());

    // reversed order: same basket, worse (or equal) route
    Json rev = Json::array();
    for (size_t i = opt.size(); i > 0; i--) rev.push(Json::number(opt[i - 1]));
    req.set("ids", rev);
    e = Json::parse(post("/api/evaluate", req.dump()).body);
    CHECK(e.getBool("valid", false));
    CHECK(e.get("user")->getNum("cost", 0) >= e.get("bestRouteForUserItems")->getNum("cost", 1e9));
    CHECK(e.getNum("routeRatio", 2) < 1.0);
    CHECK(e.getNum("score", 0) < 1000.0);
    CHECK_NEAR(e.getNum("score", 0), std::round(1000 * (0.7 * e.getNum("basketRatio", 0) + 0.3 * e.getNum("routeRatio", 0))), 1.01);

    // missing must-have, over budget, tiny basket
    e = Json::parse(post("/api/evaluate", "{\"budget\":600,\"prefs\":{\"mustHave\":[1,17]},\"ids\":[1,2,3]}").body);
    CHECK(!e.getBool("valid", true)); CHECK(!e.getBool("mustHaveOk", true));
    CHECK_EQ(e.getNum("score", -1), 0.0); CHECK_EQ(e.getNum("stars", -1), 0.0); CHECK(!e.getStr("reason", "").empty());
    e = Json::parse(post("/api/evaluate", "{\"budget\":50,\"ids\":[20,19]}").body);
    CHECK(!e.getBool("valid", true)); CHECK(e.getBool("overBudget", false)); CHECK_EQ(e.getNum("score", -1), 0.0);
    e = Json::parse(post("/api/evaluate", "{\"budget\":300,\"ids\":[1]}").body);
    CHECK(e.getBool("valid", false)); CHECK(e.getNum("basketRatio", 2) < 0.5); CHECK_EQ(e.getNum("stars", -1), 0.0);
    e = Json::parse(post("/api/evaluate", "{\"budget\":300,\"ids\":[]}").body);
    CHECK(e.getBool("valid", false)); CHECK_EQ(e.get("user")->getNum("cost", -1), e.get("bestRouteForUserItems")->getNum("cost", -2));
    // every path algorithm accepted
    CHECK_EQ(post("/api/evaluate", "{\"budget\":300,\"ids\":[1,9],\"algo\":\"bfs\"}").status, 200);
    CHECK_EQ(post("/api/evaluate", "{\"budget\":300,\"ids\":[1,9],\"algo\":\"zzz\"}").status, 400);
    CHECK_EQ(post("/api/evaluate", "{\"ids\":[1]}").status, 400);
}

TEST(benchmark_endpoint) {
    Stopwatch sw;
    HttpResponse r = get("/api/benchmark", "seed=42");
    double sec = sw.ns() / 1e9;
    printf("    (benchmark took %.2f s)\n", sec);
    CHECK_EQ(r.status, 200);
    CHECK(sec < 5.0);
    Json j = Json::parse(r.body);
    CHECK_EQ(j.getNum("seed", 0), 42.0);
    CHECK(j.get("sorting")->get("results")->a.size() >= 60);
    const Json* ss = j.get("searching");
    CHECK_EQ(ss->getNum("catalogSize", 0), 84.0);
    CHECK(ss->get("results")->a.size() >= 5);
    const Json* pf = j.get("pathfinding")->get("results");
    CHECK_EQ(pf->a.size(), (size_t)3);
    CHECK_NEAR(pf->a[1].getNum("optimalCostPct", 0), 100.0, 1e-9);   // Dijkstra vs itself
    CHECK_NEAR(pf->a[2].getNum("optimalCostPct", 0), 100.0, 1e-9);   // A* is optimal too
    CHECK(pf->a[0].getNum("optimalCostPct", 100) < 100.0);           // BFS is not
    CHECK(pf->a[2].getNum("avgExpanded", 1e9) < pf->a[1].getNum("avgExpanded", 0));
    CHECK(j.get("knapsack")->get("results")->a.size() >= 8);
    CHECK(j.get("tsp")->get("results")->a.size() >= 20);
    // cached: identical text, instant
    Stopwatch sw2; HttpResponse r2 = get("/api/benchmark", "seed=42");
    CHECK(r2.body == r.body); CHECK(sw2.ns() < 50000000);
    // different seed gives different random data
    CHECK(get("/api/benchmark", "seed=7").body != r.body);
}

TEST(router_basics) {
    CHECK_EQ(get("/api/health").body, std::string("{\"ok\":true,\"products\":84}"));
    CHECK_EQ(get("/api/nope").status, 404);
    CHECK_EQ(get("/").status, 404);
    CHECK_EQ(get("/api/plan").status, 405);
    HttpRequest o; o.method = "OPTIONS"; o.path = "/api/plan";
    CHECK_EQ(handleRequest(ctx(), o).status, 204);
    CHECK(get("/api/store").body == store().rawJson);
    CHECK_EQ(Json::parse(get("/api/store").body).get("products")->a.size(), (size_t)84);
    CHECK_EQ(queryParam("a=1&q=hello%20w&z", "q"), std::string("hello w"));
    CHECK_EQ(queryParam("a=1", "q"), std::string(""));
}

// ---------------------------------------------------------------- HTTP over real sockets
namespace {
struct Raw { int status = 0; std::string head, body; };

Raw rawRequest(int port, const std::string& req) {
    Raw out;
    int fd = socket(AF_INET, SOCK_STREAM, 0);
    sockaddr_in a; memset(&a, 0, sizeof a);
    a.sin_family = AF_INET; a.sin_port = htons((uint16_t)port); inet_pton(AF_INET, "127.0.0.1", &a.sin_addr);
    if (connect(fd, (sockaddr*)&a, sizeof a) != 0) { close(fd); return out; }
    size_t off = 0;
    while (off < req.size()) { ssize_t n = send(fd, req.data() + off, req.size() - off, MSG_NOSIGNAL); if (n <= 0) break; off += (size_t)n; }
    std::string resp; char buf[65536]; ssize_t n;
    while ((n = recv(fd, buf, sizeof buf, 0)) > 0) resp.append(buf, (size_t)n);
    close(fd);
    size_t he = resp.find("\r\n\r\n");
    if (he == std::string::npos) return out;
    out.head = resp.substr(0, he); out.body = resp.substr(he + 4);
    out.status = atoi(out.head.c_str() + 9);
    return out;
}
std::string httpPost(const std::string& path, const std::string& body) {
    return "POST " + path + " HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: " + std::to_string(body.size()) + "\r\n\r\n" + body;
}
long contentLength(const std::string& head) {
    size_t p = head.find("Content-Length: ");
    return p == std::string::npos ? -1 : atol(head.c_str() + p + 16);
}
}  // namespace

TEST(http_server_end_to_end) {
    std::atomic<int> port(0); std::atomic<bool> stop(false);
    std::thread srv([&] { runServer(ctx(), 0, &port, &stop); });
    for (int i = 0; i < 200 && port.load() == 0; i++) usleep(10000);
    CHECK(port.load() > 0);
    int p = port.load();

    Raw r = rawRequest(p, "GET /api/health HTTP/1.1\r\nHost: x\r\n\r\n");
    CHECK_EQ(r.status, 200);
    CHECK_EQ(r.body, std::string("{\"ok\":true,\"products\":84}"));
    CHECK(r.head.find("Access-Control-Allow-Origin: *") != std::string::npos);
    CHECK(r.head.find("application/json; charset=utf-8") != std::string::npos);

    r = rawRequest(p, "GET /api/search?q=mlk&limit=8 HTTP/1.1\r\nHost: x\r\n\r\n");
    CHECK_EQ(r.status, 200);
    Json j = Json::parse(r.body);
    CHECK_EQ(j.get("suggestion")->getNum("id", 0), 9.0);

    r = rawRequest(p, "GET /api/search?q=%D9%84%D8%A8%D9%86%6E HTTP/1.1\r\nHost: x\r\n\r\n");   // لبنn
    CHECK_EQ(r.status, 200);
    CHECK_EQ(Json::parse(r.body).get("results")->a[0].getStr("match", ""), std::string("fuzzy"));

    r = rawRequest(p, httpPost("/api/plan", DEFAULT_PLAN));
    CHECK_EQ(r.status, 200);
    CHECK_EQ(contentLength(r.head), (long)r.body.size());      // Content-Length present and exact: nothing truncated
    CHECK(r.body.size() > 20000);
    checkPlanInvariants(Json::parse(r.body), 600);
    r = rawRequest(p, httpPost("/api/plan", "{\"budget\":1500,\"minScore\":0}"));   // large response: many legs
    CHECK_EQ(r.status, 200);
    CHECK(r.body.size() > 40000);
    CHECK_EQ(contentLength(r.head), (long)r.body.size());
    checkPlanInvariants(Json::parse(r.body), 1500);

    r = rawRequest(p, httpPost("/api/plan", "{broken"));
    CHECK_EQ(r.status, 400); CHECK(r.body.find("\"error\"") != std::string::npos);
    r = rawRequest(p, "GET /api/unknown HTTP/1.1\r\nHost: x\r\n\r\n");
    CHECK_EQ(r.status, 404);
    r = rawRequest(p, "OPTIONS /api/plan HTTP/1.1\r\nHost: x\r\nOrigin: http://localhost:5173\r\nAccess-Control-Request-Method: POST\r\n\r\n");
    CHECK_EQ(r.status, 204);
    CHECK(r.head.find("Access-Control-Allow-Methods: GET,POST,OPTIONS") != std::string::npos);
    CHECK(r.head.find("Access-Control-Allow-Headers: Content-Type") != std::string::npos);
    r = rawRequest(p, "garbage\r\n\r\n");
    CHECK_EQ(r.status, 400);

    // body limits: ~1 MB accepted (valid JSON padded with spaces), > 1 MB rejected
    std::string big = "{\"budget\":100,\"pad\":\"" + std::string(1000000, 'x') + "\"}";
    CHECK(big.size() < (1u << 20));
    r = rawRequest(p, httpPost("/api/plan", big));
    CHECK_EQ(r.status, 200);
    r = rawRequest(p, "POST /api/plan HTTP/1.1\r\nHost: x\r\nContent-Length: 2000000\r\n\r\n{}");
    CHECK_EQ(r.status, 413);

    // concurrency: 24 clients at once, every answer correct
    std::atomic<int> okCount(0);
    std::vector<std::thread> ts;
    for (int t = 0; t < 24; t++) ts.push_back(std::thread([&, t] {
        Raw a = (t % 2) ? rawRequest(p, httpPost("/api/plan", "{\"budget\":300}")) : rawRequest(p, "GET /api/search?q=chiken HTTP/1.1\r\nHost: x\r\n\r\n");
        if (a.status == 200 && contentLength(a.head) == (long)a.body.size() && Json::parse(a.body).isObject()) okCount++;
    }));
    for (size_t t = 0; t < ts.size(); t++) ts[t].join();
    CHECK_EQ(okCount.load(), 24);

    stop = true;
    rawRequest(p, "GET /api/health HTTP/1.1\r\n\r\n");   // wake the accept loop
    srv.join();
}
