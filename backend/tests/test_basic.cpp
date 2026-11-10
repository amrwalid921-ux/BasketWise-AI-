// JSON, text normalisation, hash table, trie, Levenshtein, searching.
#include "common.hpp"
#include "json.hpp"
#include "searching.hpp"
#include "text.hpp"
#include "util.hpp"
using namespace bw;

TEST(json_parse_basic) {
    Json j = Json::parse("{\"a\":[1,2.5,-3e2,true,false,null],\"b\":{\"c\":\"x\"}}");
    CHECK(j.isObject());
    CHECK_EQ(j.get("a")->a.size(), (size_t)6);
    CHECK_NEAR(j.get("a")->a[1].n, 2.5, 1e-12);
    CHECK_NEAR(j.get("a")->a[2].n, -300, 1e-12);
    CHECK(j.get("a")->a[3].b);
    CHECK(j.get("a")->a[5].isNull());
    CHECK_EQ(j.get("b")->getStr("c", ""), std::string("x"));
    CHECK(j.get("zzz") == nullptr);
}
TEST(json_escapes_and_unicode) {
    Json j = Json::parse("\"q\\\"b\\\\s\\/n\\n t\\t \\u0041 \\u0639\\u064A\\u0634 \\ud83d\\ude00\"");
    CHECK_EQ(j.s, std::string("q\"b\\s/n\n t\t A عيش \xF0\x9F\x98\x80"));
    std::string out = j.dump();
    Json k = Json::parse(out);
    CHECK_EQ(k.s, j.s);
    Json c = Json::string(std::string("ctl\x01\x1f"));
    CHECK_EQ(c.dump(), std::string("\"ctl\\u0001\\u001f\""));
    CHECK_EQ(Json::parse(c.dump()).s, c.s);
}
TEST(json_roundtrip) {
    const char* docs[] = {"[]", "{}", "[1,2,3]", "{\"k\":[{\"a\":1},{\"b\":[]}],\"s\":\"é中\"}", "[0.1,1e-7,123456789012,-0.5]", "\"\"", "null", "true"};
    for (int i = 0; i < 8; i++) {
        Json a = Json::parse(docs[i]);
        std::string d1 = a.dump();
        std::string d2 = Json::parse(d1).dump();
        CHECK_EQ(d1, d2);
    }
    CHECK_EQ(Json::parse("{\"x\":1.0,\"y\":2}").dump(), std::string("{\"x\":1,\"y\":2}"));
    // the real store survives a parse/dump/parse cycle
    Json s = Json::parse(store().rawJson);
    CHECK_EQ(Json::parse(s.dump()).dump(), s.dump());
}
TEST(json_errors) {
    const char* bad[] = {"", "{", "[1,]", "{\"a\":}", "{\"a\" 1}", "tru", "01", "1.", "\"abc", "\"\\x\"", "[1] x", "{'a':1}", "\"\\ud800\"", "\"a\nb\"", "-", "[1 2]"};
    for (int i = 0; i < 16; i++) {
        bool threw = false;
        try { Json::parse(bad[i]); } catch (const JsonError&) { threw = true; }
        CHECK(threw);
    }
    std::string deep(500, '[');
    bool threw = false;
    try { Json::parse(deep); } catch (const JsonError&) { threw = true; }
    CHECK(threw);
}
TEST(json_writer) {
    JsonWriter w;
    w.beginObject().kv("a", "x\"y").key("l").beginArray().integer(1).num(2.5).num(3.14159, 2).null().boolean(true).cell(3, 4).endArray()
     .key("o").beginObject().endObject().endObject();
    CHECK_EQ(w.result(), std::string("{\"a\":\"x\\\"y\",\"l\":[1,2.5,3.14,null,true,[3,4]],\"o\":{}}"));
    Json::parse(w.result());
}

TEST(text_normalisation) {
    CHECK_EQ(normalize("  Milk   FULL "), std::string("milk full"));
    CHECK_EQ(normalize("عيش بلدى"), normalize("عيش بلدي"));
    CHECK_EQ(normalize("عَيْش"), normalize("عيش"));
    CHECK_EQ(normalize("عـــيش"), normalize("عيش"));
    CHECK_EQ(normalize("أحمد إبراهيم آدم ٱلله"), normalize("احمد ابراهيم ادم الله"));
    CHECK_EQ(normalize("مدرسة"), normalize("مدرسه"));
    CHECK_EQ(normalize("١٢٣٤٥٦٧٨٩٠"), std::string("1234567890"));
    CHECK_EQ(normalize("Baladi-Bread (5 loaves)"), std::string("baladi bread 5 loaves"));
    CHECK_EQ(normalize(""), std::string(""));
    CHECK_EQ(normalize("   "), std::string(""));
    CHECK_EQ(normalize("لبن"), std::string("لبن"));
    CHECK_EQ(decodeUtf8("a\xD8\xB9\xF0\x9F\x98\x80").size(), (size_t)3);
    CHECK_EQ(encodeUtf8(decodeUtf8("héllo عيش \xF0\x9F\x98\x80")), std::string("héllo عيش \xF0\x9F\x98\x80"));
    CHECK_EQ(urlDecode("a%20b+c%D9%84"), std::string("a b cل"));
}

TEST(levenshtein_known) {
    auto d = [](const char* a, const char* b) { return levenshtein(decodeUtf8(a), decodeUtf8(b)); };
    CHECK_EQ(d("kitten", "sitting"), 3);
    CHECK_EQ(d("flaw", "lawn"), 2);
    CHECK_EQ(d("", "abc"), 3);
    CHECK_EQ(d("abc", ""), 3);
    CHECK_EQ(d("same", "same"), 0);
    CHECK_EQ(d("mlk", "milk"), 1);
    CHECK_EQ(d("chiken", "chicken"), 1);
    CHECK_EQ(d("لبن", "لبنn"), 1);   // counted on code points, not bytes
    CHECK_EQ(d("لبن", "لين"), 1);
    // symmetry + triangle inequality on random strings
    Rng r(5);
    for (int t = 0; t < 200; t++) {
        std::string a, b, c;
        for (int i = r.below(7); i > 0; i--) a += (char)('a' + r.below(3));
        for (int i = r.below(7); i > 0; i--) b += (char)('a' + r.below(3));
        for (int i = r.below(7); i > 0; i--) c += (char)('a' + r.below(3));
        CHECK_EQ(d(a.c_str(), b.c_str()), d(b.c_str(), a.c_str()));
        CHECK(d(a.c_str(), c.c_str()) <= d(a.c_str(), b.c_str()) + d(b.c_str(), c.c_str()));
    }
}

TEST(hash_table) {
    StringHashTable h;
    Rng r(9);
    std::vector<std::string> keys;
    for (int i = 0; i < 3000; i++) { keys.push_back("key" + std::to_string(i * 7919 % 100003)); h.put(keys.back(), i); }
    for (int i = 0; i < 3000; i++) {
        const std::vector<int>* v = h.get(keys[i]);
        CHECK(v != nullptr);
        bool found = false;
        if (v) for (size_t k = 0; k < v->size(); k++) if ((*v)[k] == i) found = true;
        CHECK(found);
    }
    CHECK(h.get("nope") == nullptr);
    CHECK(h.get("") == nullptr);
    h.put("dup", 1); h.put("dup", 2);
    CHECK_EQ(h.get("dup")->size(), (size_t)2);
    long long probes = 0;
    h.get(keys[10], &probes);
    CHECK(probes >= 1 && probes < 20);   // O(1) average
    h.put("عيش", 5);
    CHECK_EQ((*h.get("عيش"))[0], 5);
}

TEST(trie) {
    Trie t;
    const char* words[] = {"milk", "milkshake", "mild", "mi", "bread", "عيش", "عيشة", "لبن"};
    for (int i = 0; i < 8; i++) t.insert(decodeUtf8(words[i]), i);
    std::vector<int> out;
    CHECK(t.collect(decodeUtf8("mil"), out));
    CHECK_EQ(out.size(), (size_t)3);   // milk, milkshake, mild
    out.clear(); CHECK(t.collect(decodeUtf8("m"), out)); CHECK_EQ(out.size(), (size_t)4);
    out.clear(); CHECK(t.collect(decodeUtf8("عيش"), out)); CHECK_EQ(out.size(), (size_t)2);
    out.clear(); CHECK(!t.collect(decodeUtf8("x"), out)); CHECK(out.empty());
    out.clear(); CHECK(!t.collect(decodeUtf8("milkx"), out));
    out.clear(); CHECK(t.collect(decodeUtf8(""), out)); CHECK_EQ(out.size(), (size_t)8);
    out.clear(); CHECK(t.collect(decodeUtf8("bread"), out)); CHECK_EQ(out.size(), (size_t)1);
}

TEST(binary_and_linear_search) {
    std::vector<int> v;
    for (int i = 0; i < 100; i++) v.push_back(i * 2);
    for (int i = 0; i < 100; i++) CHECK_EQ(binarySearchInt(v, i * 2), i);
    CHECK_EQ(binarySearchInt(v, 7), -1);
    CHECK_EQ(binarySearchInt(v, -5), -1);
    CHECK_EQ(binarySearchInt(v, 1000), -1);
    long long c = 0; binarySearchInt(v, 66, &c);
    CHECK(c <= 8);
    std::vector<int> e; CHECK_EQ(binarySearchInt(e, 1), -1);
    std::vector<std::string> names = {"apple", "banana", "cherry", "date"};
    CHECK_EQ(binarySearchString(names, "cherry"), 2);
    CHECK_EQ(binarySearchString(names, "zzz"), -1);
    CHECK_EQ(linearSearchString(names, "date"), 3);
    c = 0; linearSearchString(names, "date", &c); CHECK_EQ(c, 4LL);
    CHECK_EQ(linearSearchInt(v, 198), 99);
    CHECK_EQ(linearSearchInt(v, 3), -1);
    CHECK(containsRun(decodeUtf8("tomatoes"), decodeUtf8("mat")));
    CHECK(!containsRun(decodeUtf8("tomatoes"), decodeUtf8("mto")));
}

static SearchOutput S(const char* q, int limit = 8) { return ctx().index->search(q, limit); }

TEST(search_id_forms) {
    const char* forms[] = {"12", "#12", "P012", "p12", " 12 ", "١٢"};
    for (int i = 0; i < 6; i++) {
        SearchOutput o = S(forms[i]);
        CHECK_EQ(o.mode, std::string("id"));
        CHECK_EQ(o.hits.size(), (size_t)1);
        if (!o.hits.empty()) { CHECK_EQ(o.hits[0].productId, 12); CHECK_EQ(o.hits[0].match, std::string("id")); }
        CHECK(o.exact);
    }
    SearchOutput o = S("999");
    CHECK_EQ(o.mode, std::string("id")); CHECK(o.hits.empty());
}
TEST(search_exact_prefix_substring) {
    SearchOutput o = S("baladi bread");
    CHECK(!o.hits.empty()); CHECK_EQ(o.hits[0].productId, 1); CHECK_EQ(o.hits[0].match, std::string("exact")); CHECK(o.exact);
    o = S("Baladi-Bread");
    CHECK_EQ(o.hits[0].productId, 1); CHECK_EQ(o.hits[0].match, std::string("exact"));
    o = S("chick");
    CHECK(!o.hits.empty()); CHECK_EQ(o.hits[0].productId, 19); CHECK_EQ(o.hits[0].match, std::string("prefix"));
    o = S("cream");   // substring/exact word
    CHECK(!o.hits.empty());
    bool has9 = false; for (size_t i = 0; i < o.hits.size(); i++) if (o.hits[i].productId == 9) has9 = true;
    CHECK(has9);
    o = S("ato");   // substring of tomatoes / potatoes
    bool has37 = false; for (size_t i = 0; i < o.hits.size(); i++) if (o.hits[i].productId == 37 && o.hits[i].match == "substring") has37 = true;
    CHECK(has37);
    o = S("milk", 3);
    CHECK_EQ(o.hits.size(), (size_t)3);
    // ranking: ties by popularity (milk-full pop 95 first)
    CHECK_EQ(o.hits[0].productId, 9);
    CHECK_EQ(S("milk", 1).hits.size(), (size_t)1);
}
TEST(search_typos_english) {
    struct { const char* q; int id; } cases[] = {{"mlk", 9}, {"chiken", 19}, {"tomatos", 37}, {"bannana", 38}};
    for (int i = 0; i < 4; i++) {
        SearchOutput o = S(cases[i].q);
        CHECK(!o.hits.empty());
        CHECK(o.hasSuggestion);
        CHECK(!o.exact);
        if (!o.hits.empty()) { CHECK_EQ(o.hits[0].match, std::string("fuzzy")); CHECK_EQ(o.hits[0].productId, cases[i].id); }
        if (o.hasSuggestion) CHECK_EQ(o.suggestion.productId, cases[i].id);
    }
    CHECK(S("zzzzqqq").hits.empty());
    CHECK(!S("zzzzqqq").hasSuggestion);
    CHECK(S("").hits.empty());
}
TEST(search_arabic) {
    SearchOutput o = S("لبن");
    CHECK(o.hits.size() >= 3); CHECK_EQ(o.hits[0].productId, 9); CHECK(o.exact);
    o = S("لبنn");
    CHECK(!o.hits.empty()); CHECK_EQ(o.hits[0].match, std::string("fuzzy")); CHECK(o.hasSuggestion);
    CHECK_EQ(o.hits[0].productId, 9);
    o = S("عيش بلدى");   // alef maqsura typed instead of ya
    CHECK(!o.hits.empty()); CHECK_EQ(o.hits[0].productId, 1); CHECK(o.exact);
    o = S("عَيْش بَلَدي");
    CHECK_EQ(o.hits[0].productId, 1);
    o = S("جبنه");   // ta marbuta -> ha: matches جبنة
    CHECK(!o.hits.empty());
    o = S("طماطم");
    CHECK_EQ(o.hits[0].productId, 37);
    o = S("طماطن");   // typo
    CHECK(!o.hits.empty()); CHECK_EQ(o.hits[0].match, std::string("fuzzy"));
}
TEST(search_api_http_layer) {
    HttpResponse r = get("/api/search", "q=mlk&limit=8");
    CHECK_EQ(r.status, 200);
    Json j = Json::parse(r.body);
    CHECK_EQ(j.getStr("mode", ""), std::string("name"));
    CHECK(!j.get("exact")->b);
    CHECK_EQ(j.get("results")->a[0].getNum("id", 0), 9.0);
    CHECK_EQ(j.get("results")->a[0].getStr("match", ""), std::string("fuzzy"));
    CHECK_EQ(j.get("suggestion")->getNum("id", 0), 9.0);
    CHECK(j.get("stats")->getNum("comparisons", 0) > 0);
    r = get("/api/search", "q=%D9%84%D8%A8%D9%86");   // percent-encoded Arabic
    CHECK_EQ(Json::parse(r.body).get("results")->a[0].getNum("id", 0), 9.0);
}
