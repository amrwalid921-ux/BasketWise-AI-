#include "store.hpp"
#include "json.hpp"
#include <cstdio>

namespace bw {

static bool readFile(const std::string& path, std::string& out) {
    FILE* f = fopen(path.c_str(), "rb");
    if (!f) return false;
    char buf[65536];
    size_t n;
    out.clear();
    while ((n = fread(buf, 1, sizeof buf, f)) > 0) out.append(buf, n);
    fclose(f);
    return true;
}

bool loadStore(const std::string& path, Store& out, std::string& err) {
    std::string text;
    if (!readFile(path, text)) { err = "cannot read " + path; return false; }
    return loadStoreFromText(text, out, err);
}

bool loadStoreFromText(const std::string& text, Store& s, std::string& err) {
    Json root;
    try { root = Json::parse(text); } catch (const JsonError& e) { err = std::string("store.json: ") + e.what(); return false; }
    const Json* grid = root.get("grid");
    if (!grid) { err = "store.json: missing grid"; return false; }
    s.W = (int)grid->getNum("w", 0);
    s.H = (int)grid->getNum("h", 0);
    const Json* rows = grid->get("cost");
    if (s.W <= 0 || s.H <= 0 || !rows || !rows->isArray() || (int)rows->a.size() != s.H) { err = "store.json: bad grid"; return false; }
    s.cost.assign((size_t)s.W * s.H, 0);
    for (int y = 0; y < s.H; y++) {
        const std::string& r = rows->a[y].s;
        if ((int)r.size() != s.W) { err = "store.json: bad grid row length"; return false; }
        for (int x = 0; x < s.W; x++) s.cost[y * s.W + x] = (uint8_t)(r[x] - '0');
    }
    const Json* e = root.get("entrance");
    const Json* c = root.get("checkout");
    if (!e || !c) { err = "store.json: missing entrance/checkout"; return false; }
    s.entranceX = (int)e->getNum("x", 0); s.entranceY = (int)e->getNum("y", 0);
    s.checkoutX = (int)c->getNum("x", 0); s.checkoutY = (int)c->getNum("y", 0);
    const Json* cats = root.get("categories");
    if (cats) for (size_t i = 0; i < cats->a.size(); i++) {
        const Json& j = cats->a[i];
        Category k; k.id = j.getStr("id", ""); k.en = j.getStr("en", ""); k.ar = j.getStr("ar", ""); k.color = j.getStr("color", "");
        s.categories.push_back(k);
    }
    const Json* prods = root.get("products");
    if (!prods || !prods->isArray()) { err = "store.json: missing products"; return false; }
    int maxId = 0;
    for (size_t i = 0; i < prods->a.size(); i++) {
        const Json& j = prods->a[i];
        Product p;
        p.id = (int)j.getNum("id", 0);
        p.sku = j.getStr("sku", ""); p.category = j.getStr("category", ""); p.slug = j.getStr("slug", "");
        p.en = j.getStr("en", ""); p.ar = j.getStr("ar", "");
        p.price = (int)j.getNum("price", 0);
        p.rating = j.getNum("rating", 0);
        p.popularity = (int)j.getNum("popularity", 0);
        p.discount = (int)j.getNum("discount", 0);
        const Json* tg = j.get("tags");
        if (tg) for (size_t k = 0; k < tg->a.size(); k++) p.tags.push_back(tg->a[k].s);
        const Json* pk = j.get("pickup"); const Json* sh = j.get("shelf");
        if (pk) { p.pickupX = (int)pk->getNum("x", 0); p.pickupY = (int)pk->getNum("y", 0); }
        if (sh) { p.shelfX = (int)sh->getNum("x", 0); p.shelfY = (int)sh->getNum("y", 0); }
        p.fixture = j.getStr("fixture", ""); p.side = j.getStr("side", ""); p.slot = (int)j.getNum("slot", 0);
        if (p.id <= 0 || p.price <= 0) { err = "store.json: bad product"; return false; }
        if (!s.walkable(p.pickupX, p.pickupY)) { err = "store.json: pickup cell blocked for " + p.slug; return false; }
        if (p.id > maxId) maxId = p.id;
        s.products.push_back(p);
    }
    s.idToIndex.assign(maxId + 1, -1);
    for (size_t i = 0; i < s.products.size(); i++) s.idToIndex[s.products[i].id] = (int)i;
    s.rawJson = text;
    return true;
}

}  // namespace bw
