#include "api.hpp"
#include "ai.hpp"
#include "benchmark.hpp"
#include "json.hpp"
#include "pathfinding.hpp"
#include "sorting.hpp"
#include "text.hpp"
#include <cstdlib>

namespace bw {

bool Context::init(const std::string& path, std::string& err) {
    if (!loadStore(path, store, err)) return false;
    index.reset(new SearchIndex(store));
    return true;
}
bool Context::initFromText(const std::string& text, std::string& err) {
    if (!loadStoreFromText(text, store, err)) return false;
    index.reset(new SearchIndex(store));
    return true;
}

std::string queryParam(const std::string& query, const std::string& key) {
    size_t i = 0;
    while (i <= query.size()) {
        size_t amp = query.find('&', i);
        if (amp == std::string::npos) amp = query.size();
        std::string pair = query.substr(i, amp - i);
        size_t eq = pair.find('=');
        std::string k = eq == std::string::npos ? pair : pair.substr(0, eq);
        if (urlDecode(k) == key) return eq == std::string::npos ? "" : urlDecode(pair.substr(eq + 1));
        i = amp + 1;
    }
    return "";
}

namespace {

HttpResponse jsonOk(const std::string& body) { HttpResponse r; r.body = body; return r; }
HttpResponse jsonError(int status, const std::string& msg) {
    HttpResponse r;
    r.status = status;
    std::string b = "{\"error\":";
    appendQuoted(b, msg);
    b += "}";
    r.body = b;
    return r;
}

bool parseBody(const HttpRequest& req, Json& out, HttpResponse& err) {
    try { out = Json::parse(req.body); }
    catch (const JsonError& e) { err = jsonError(400, std::string("invalid JSON: ") + e.what()); return false; }
    return true;
}

// ------------------------------------------------------------------ /api/search
HttpResponse handleSearch(Context& ctx, const HttpRequest& req) {
    std::string q = queryParam(req.query, "q");
    std::string lim = queryParam(req.query, "limit");
    int limit = lim.empty() ? 8 : atoi(lim.c_str());
    if (limit < 1) limit = 1;
    if (limit > 50) limit = 50;
    SearchOutput o = ctx.index->search(q, limit);
    JsonWriter w;
    w.beginObject();
    w.kv("query", q).kv("mode", o.mode).kvBool("exact", o.exact);
    w.key("results").beginArray();
    for (size_t i = 0; i < o.hits.size(); i++) {
        w.beginObject().kvInt("id", o.hits[i].productId).kv("match", o.hits[i].match);
        if (o.hits[i].match == "fuzzy") w.kvInt("distance", o.hits[i].distance);
        w.endObject();
    }
    w.endArray();
    w.key("suggestion");
    if (o.hasSuggestion) {
        const Product* p = ctx.store.byId(o.suggestion.productId);
        w.beginObject().kvInt("id", p->id).kv("text", p->en).kv("textAr", p->ar).kvInt("distance", o.suggestion.distance).endObject();
    } else w.null();
    w.key("stats").beginObject().kv("algo", o.algo).kvInt("comparisons", o.comparisons).kvInt("timeUs", o.timeUs).endObject();
    w.endObject();
    return jsonOk(w.result());
}

// ------------------------------------------------------------------ /api/sort
HttpResponse handleSort(Context& ctx, const HttpRequest& req) {
    Json j; HttpResponse err;
    if (!parseBody(req, j, err)) return err;
    if (!j.isObject()) return jsonError(400, "body must be an object");
    std::string by = j.getStr("by", "price"), order = j.getStr("order", "asc"), algo = j.getStr("algo", "merge");
    bool wantTrace = j.getBool("trace", false);
    if (by != "price" && by != "rating" && by != "popularity" && by != "deal" && by != "name" && by != "score")
        return jsonError(400, "by must be price|rating|popularity|deal|name|score");
    if (order != "asc" && order != "desc") return jsonError(400, "order must be asc|desc");
    if (algo != "merge" && algo != "quick" && algo != "heap" && algo != "insertion" && algo != "bubble" && algo != "selection")
        return jsonError(400, "unknown algo");
    const Store& s = ctx.store;
    std::vector<int> ids;
    const Json* jids = j.get("ids");
    if (jids && jids->isArray()) {
        for (size_t i = 0; i < jids->a.size(); i++) if (jids->a[i].isNumber() && s.byId((int)jids->a[i].n)) ids.push_back((int)jids->a[i].n);
    } else for (size_t i = 0; i < s.products.size(); i++) ids.push_back(s.products[i].id);
    size_t n = ids.size();
    std::vector<double> key(n, 0);
    std::vector<std::string> names;
    const Json* jscores = j.get("scores");
    for (size_t i = 0; i < n; i++) {
        const Product* p = s.byId(ids[i]);
        if (by == "price") key[i] = p->price;
        else if (by == "rating") key[i] = p->rating;
        else if (by == "popularity") key[i] = p->popularity;
        else if (by == "deal") key[i] = p->rating * (1.0 + p->discount / 50.0) * 100.0 / p->price;
        else if (by == "name") names.push_back(normalize(p->en));
        else if (by == "score") key[i] = jscores ? jscores->getNum(std::to_string(ids[i]), 0) : 0;
    }
    bool desc = order == "desc", byName = by == "name";
    auto less = [&](int a, int b) -> bool {
        if (byName) {
            int c = names[a].compare(names[b]);
            if (c != 0) return desc ? c > 0 : c < 0;
        } else if (key[a] != key[b]) return desc ? key[a] > key[b] : key[a] < key[b];
        return ids[a] < ids[b];
    };
    std::vector<int> a(n);
    for (size_t i = 0; i < n; i++) a[i] = (int)i;
    SortStats st;
    SortTrace tr;
    tr.enabled = wantTrace;
    Sorter<decltype(less)> sorter(less, st, wantTrace ? &tr : nullptr);
    Stopwatch sw;
    sorter.run(algo, a);
    long long us = sw.ns() / 1000;

    JsonWriter w;
    w.beginObject();
    w.key("ids").beginArray();
    for (size_t i = 0; i < n; i++) w.integer(ids[a[i]]);
    w.endArray();
    w.key("stats").beginObject().kv("algo", algo).kvInt("n", (long long)n).kvInt("comparisons", st.comparisons)
     .kvInt("swaps", st.swaps).kvInt("writes", st.writes).kvInt("timeUs", us).endObject();
    if (wantTrace) {
        w.key("trace").beginArray();
        for (size_t i = 0; i < tr.ops.size(); i++) {
            w.beginArray().integer(tr.ops[i][0]).integer(tr.ops[i][1]).integer(tr.ops[i][2]).endArray();
        }
        w.endArray();
        if (tr.truncated) w.kvBool("traceTruncated", true);
    }
    w.endObject();
    return jsonOk(w.result());
}

// ------------------------------------------------------------------ /api/path
void writePathResult(JsonWriter& w, const Store& s, const std::string& algo, const PathResult& p) {
    w.beginObject();
    w.kv("algo", algo);
    w.key("path").beginArray();
    for (size_t i = 0; i < p.path.size(); i++) w.cell(p.path[i] % s.W, p.path[i] / s.W);
    w.endArray();
    w.key("explored").beginArray();
    for (size_t i = 0; i < p.explored.size(); i++) w.integer(p.explored[i]);
    w.endArray();
    w.kvInt("steps", p.steps).kvInt("cost", p.cost).kvInt("expanded", p.expanded).kvInt("timeUs", p.timeUs);
    w.endObject();
}

bool readCell(const Json* j, const Store& s, int& cell) {
    if (!j || !j->isArray() || j->a.size() != 2 || !j->a[0].isNumber() || !j->a[1].isNumber()) return false;
    int x = (int)j->a[0].n, y = (int)j->a[1].n;
    if (!s.inside(x, y)) return false;
    cell = y * s.W + x;
    return true;
}

HttpResponse handlePath(Context& ctx, const HttpRequest& req) {
    Json j; HttpResponse err;
    if (!parseBody(req, j, err)) return err;
    const Store& s = ctx.store;
    int from, to;
    if (!readCell(j.get("from"), s, from) || !readCell(j.get("to"), s, to)) return jsonError(400, "from/to must be [x,y] inside the grid");
    if (s.cost[from] == 0 || s.cost[to] == 0) return jsonError(400, "from/to must be walkable cells");
    std::string algo = j.getStr("algo", "astar");
    if (algo != "bfs" && algo != "dijkstra" && algo != "astar") return jsonError(400, "algo must be bfs|dijkstra|astar");
    JsonWriter w;
    if (j.getBool("all", false)) {
        w.beginObject().key("results").beginObject();
        const char* names[3] = {"bfs", "dijkstra", "astar"};
        for (int k = 0; k < 3; k++) { w.key(names[k]); writePathResult(w, s, names[k], findPath(s, from, to, names[k])); }
        w.endObject().endObject();
    } else writePathResult(w, s, algo, findPath(s, from, to, algo));
    return jsonOk(w.result());
}

// ------------------------------------------------------------------ /api/plan , /api/evaluate
HttpResponse handlePlan(Context& ctx, const HttpRequest& req) {
    Json j; HttpResponse err;
    if (!parseBody(req, j, err)) return err;
    PlanRequest pr; std::string e;
    if (!parsePlanRequest(j, pr, e)) return jsonError(400, e);
    PlanResult r = makePlan(ctx.store, pr);
    return jsonOk(planToJson(ctx.store, r));
}

HttpResponse handleEvaluate(Context& ctx, const HttpRequest& req) {
    Json j; HttpResponse err;
    if (!parseBody(req, j, err)) return err;
    PlanRequest pr; std::string e;
    if (!parsePlanRequest(j, pr, e)) return jsonError(400, e);
    std::vector<int> ids;
    const Json* jids = j.get("ids");
    if (jids && jids->isArray()) for (size_t i = 0; i < jids->a.size(); i++) if (jids->a[i].isNumber()) ids.push_back((int)jids->a[i].n);
    std::string algo = j.getStr("algo", "astar");
    if (algo != "bfs" && algo != "dijkstra" && algo != "astar") return jsonError(400, "algo must be bfs|dijkstra|astar");
    return jsonOk(evalToJson(evaluateChoice(ctx.store, pr, ids, algo)));
}

// ------------------------------------------------------------------ /api/benchmark
HttpResponse handleBenchmark(Context& ctx, const HttpRequest& req) {
    std::string sd = queryParam(req.query, "seed");
    unsigned long long seed = sd.empty() ? 42ULL : strtoull(sd.c_str(), nullptr, 10);
    std::lock_guard<std::mutex> lock(ctx.benchMu);
    if (!ctx.hasBench || ctx.benchSeed != seed) {
        ctx.benchCache = runBenchmark(ctx.store, *ctx.index, seed);
        ctx.benchSeed = seed;
        ctx.hasBench = true;
    }
    return jsonOk(ctx.benchCache);
}

}  // namespace

HttpResponse handleRequest(Context& ctx, const HttpRequest& req) {
    if (req.method == "OPTIONS") { HttpResponse r; r.status = 204; return r; }
    const std::string& p = req.path;
    if (p == "/api/health" && req.method == "GET")
        return jsonOk("{\"ok\":true,\"products\":" + std::to_string(ctx.store.products.size()) + "}");
    if (p == "/api/store" && req.method == "GET") return jsonOk(ctx.store.rawJson);
    if (p == "/api/search" && req.method == "GET") return handleSearch(ctx, req);
    if (p == "/api/benchmark" && req.method == "GET") return handleBenchmark(ctx, req);
    if (req.method == "POST") {
        if (p == "/api/sort") return handleSort(ctx, req);
        if (p == "/api/path") return handlePath(ctx, req);
        if (p == "/api/plan") return handlePlan(ctx, req);
        if (p == "/api/evaluate") return handleEvaluate(ctx, req);
    }
    if (p.compare(0, 5, "/api/") == 0) {
        bool known = p == "/api/health" || p == "/api/store" || p == "/api/search" || p == "/api/benchmark" ||
                     p == "/api/sort" || p == "/api/path" || p == "/api/plan" || p == "/api/evaluate";
        if (known) return jsonError(405, "method not allowed");
    }
    return jsonError(404, "not found");
}

}  // namespace bw
