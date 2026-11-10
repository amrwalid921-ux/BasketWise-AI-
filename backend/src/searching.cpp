#include "searching.hpp"
#include "sorting.hpp"
#include "util.hpp"

namespace bw {

// ============================================================ hash table
uint64_t StringHashTable::hash(const std::string& s) {
    uint64_t h = 1469598103934665603ULL;            // FNV-1a, 64 bit
    for (size_t i = 0; i < s.size(); i++) { h ^= (unsigned char)s[i]; h *= 1099511628211ULL; }
    return h;
}

void StringHashTable::grow() {
    std::vector<int> nb(buckets_.size() * 2, -1);
    for (size_t i = 0; i < nodes_.size(); i++) {
        size_t b = (size_t)(hash(nodes_[i].key) & (nb.size() - 1));
        nodes_[i].next = nb[b];
        nb[b] = (int)i;
    }
    buckets_.swap(nb);
}

void StringHashTable::put(const std::string& key, int val) {
    size_t b = (size_t)(hash(key) & (buckets_.size() - 1));
    for (int i = buckets_[b]; i >= 0; i = nodes_[i].next) {
        if (nodes_[i].key == key) {
            for (size_t k = 0; k < nodes_[i].vals.size(); k++) if (nodes_[i].vals[k] == val) return;
            nodes_[i].vals.push_back(val);
            return;
        }
    }
    Node n; n.key = key; n.vals.push_back(val); n.next = buckets_[b];
    nodes_.push_back(n);
    buckets_[b] = (int)nodes_.size() - 1;
    count_++;
    if (count_ * 4 > buckets_.size() * 3) grow();   // keep load factor <= 0.75
}

const std::vector<int>* StringHashTable::get(const std::string& key, long long* probes) const {
    size_t b = (size_t)(hash(key) & (buckets_.size() - 1));
    for (int i = buckets_[b]; i >= 0; i = nodes_[i].next) {
        if (probes) (*probes)++;
        if (nodes_[i].key == key) return &nodes_[i].vals;
    }
    return nullptr;
}

// ============================================================ trie
void Trie::insert(const CodePoints& word, int value) {
    int cur = 0;
    for (size_t i = 0; i < word.size(); i++) {
        int next = -1;
        std::vector<std::pair<uint32_t, int>>& kids = nodes_[cur].kids;
        for (size_t k = 0; k < kids.size(); k++) if (kids[k].first == word[i]) { next = kids[k].second; break; }
        if (next < 0) {
            nodes_.push_back(Node());
            next = (int)nodes_.size() - 1;
            nodes_[cur].kids.push_back(std::make_pair(word[i], next));
        }
        cur = next;
    }
    std::vector<int>& vals = nodes_[cur].values;
    for (size_t k = 0; k < vals.size(); k++) if (vals[k] == value) return;
    vals.push_back(value);
}

void Trie::dfs(int node, std::vector<int>& out, long long* visited) const {
    if (visited) (*visited)++;
    const Node& n = nodes_[node];
    for (size_t k = 0; k < n.values.size(); k++) out.push_back(n.values[k]);
    for (size_t k = 0; k < n.kids.size(); k++) dfs(n.kids[k].second, out, visited);
}

bool Trie::collect(const CodePoints& prefix, std::vector<int>& out, long long* visited) const {
    int cur = 0;
    for (size_t i = 0; i < prefix.size(); i++) {
        int next = -1;
        const std::vector<std::pair<uint32_t, int>>& kids = nodes_[cur].kids;
        for (size_t k = 0; k < kids.size(); k++) if (kids[k].first == prefix[i]) { next = kids[k].second; break; }
        if (visited) (*visited)++;
        if (next < 0) return false;
        cur = next;
    }
    dfs(cur, out, visited);
    return true;
}

// ============================================================ elementary searches
int binarySearchInt(const std::vector<int>& v, int target, long long* comparisons) {
    int lo = 0, hi = (int)v.size() - 1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;
        if (comparisons) (*comparisons)++;
        if (v[mid] == target) return mid;
        if (v[mid] < target) lo = mid + 1; else hi = mid - 1;
    }
    return -1;
}

int binarySearchString(const std::vector<std::string>& v, const std::string& target, long long* comparisons) {
    int lo = 0, hi = (int)v.size() - 1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;
        if (comparisons) (*comparisons)++;
        int c = v[mid].compare(target);
        if (c == 0) return mid;
        if (c < 0) lo = mid + 1; else hi = mid - 1;
    }
    return -1;
}

int linearSearchString(const std::vector<std::string>& v, const std::string& target, long long* comparisons) {
    for (size_t i = 0; i < v.size(); i++) {
        if (comparisons) (*comparisons)++;
        if (v[i] == target) return (int)i;
    }
    return -1;
}

int linearSearchInt(const std::vector<int>& v, int target, long long* comparisons) {
    for (size_t i = 0; i < v.size(); i++) {
        if (comparisons) (*comparisons)++;
        if (v[i] == target) return (int)i;
    }
    return -1;
}

int levenshtein(const CodePoints& a, const CodePoints& b) {
    // d[j] = distance between the first i chars of a and the first j chars of b (two rolling rows)
    size_t n = a.size(), m = b.size();
    std::vector<int> prev(m + 1), cur(m + 1);
    for (size_t j = 0; j <= m; j++) prev[j] = (int)j;
    for (size_t i = 1; i <= n; i++) {
        cur[0] = (int)i;
        for (size_t j = 1; j <= m; j++) {
            int sub = prev[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1);
            int del = prev[j] + 1;
            int ins = cur[j - 1] + 1;
            int best = sub;
            if (del < best) best = del;
            if (ins < best) best = ins;
            cur[j] = best;
        }
        prev.swap(cur);
    }
    return prev[m];
}

bool containsRun(const CodePoints& hay, const CodePoints& needle) {
    if (needle.empty()) return true;
    if (needle.size() > hay.size()) return false;
    for (size_t i = 0; i + needle.size() <= hay.size(); i++) {
        size_t k = 0;
        while (k < needle.size() && hay[i + k] == needle[k]) k++;
        if (k == needle.size()) return true;
    }
    return false;
}

// ============================================================ product search index
static std::string slugToText(const std::string& slug) {
    std::string r = slug;
    for (size_t i = 0; i < r.size(); i++) if (r[i] == '-') r[i] = ' ';
    return r;
}

SearchIndex::SearchIndex(const Store& store) : store_(store) {
    for (size_t pi = 0; pi < store.products.size(); pi++) {
        const Product& p = store.products[pi];
        std::string names[3] = { p.en, p.ar, slugToText(p.slug) };
        for (int k = 0; k < 3; k++) {
            CodePoints full = normalizeCps(names[k]);
            if (full.empty()) continue;
            exact_.put(encodeUtf8(full), (int)pi);
            trie_.insert(full, (int)pi);
            Entry e; e.text = full; e.product = (int)pi; e.word = false;
            entries_.push_back(e);
            std::vector<CodePoints> words = splitWords(full);
            if (words.size() > 1) for (size_t w = 0; w < words.size(); w++) {
                trie_.insert(words[w], (int)pi);
                Entry we; we.text = words[w]; we.product = (int)pi; we.word = true;
                entries_.push_back(we);
            }
        }
    }
    // sorted ids (insertion sort is enough here: ids are already ascending, and it is our own sort anyway)
    for (size_t i = 0; i < store.products.size(); i++) sortedIds_.push_back(store.products[i].id);
    SortStats st;
    std::vector<int> idx(sortedIds_.size());
    for (size_t i = 0; i < idx.size(); i++) idx[i] = (int)i;
    const std::vector<int>& ids = sortedIds_;
    auto byId = [&ids](int a, int b) { return ids[a] < ids[b]; };
    makeSorter(byId, st).merge(idx);
    std::vector<int> sorted;
    for (size_t i = 0; i < idx.size(); i++) sorted.push_back(ids[idx[i]]);
    sortedIds_ = sorted;

    std::vector<std::string> names;
    for (size_t i = 0; i < store.products.size(); i++) names.push_back(normalize(store.products[i].en));
    std::vector<int> nidx(names.size());
    for (size_t i = 0; i < nidx.size(); i++) nidx[i] = (int)i;
    auto byName = [&names](int a, int b) { return names[a] < names[b]; };
    makeSorter(byName, st).merge(nidx);
    for (size_t i = 0; i < nidx.size(); i++) sortedNames_.push_back(names[nidx[i]]);
}

namespace {
struct Cand { int product; int rank; int dist; };   // rank: 0 id/exact, 1 prefix, 2 substring, 3 fuzzy

const char* rankName(int r) {
    switch (r) { case 0: return "exact"; case 1: return "prefix"; case 2: return "substring"; default: return "fuzzy"; }
}

// merge a candidate into the list keeping the best (lowest) rank / distance per product
void addCand(std::vector<Cand>& cs, int product, int rank, int dist) {
    for (size_t i = 0; i < cs.size(); i++) {
        if (cs[i].product == product) {
            if (rank < cs[i].rank || (rank == cs[i].rank && dist < cs[i].dist)) { cs[i].rank = rank; cs[i].dist = dist; }
            return;
        }
    }
    Cand c; c.product = product; c.rank = rank; c.dist = dist;
    cs.push_back(c);
}

bool parseIdQuery(const CodePoints& q, int& id) {
    size_t i = 0;
    if (i < q.size() && q[i] == '#') i++;
    if (i < q.size() && (q[i] == 'p') && i + 1 < q.size()) i++;
    if (i >= q.size()) return false;
    long v = 0;
    for (; i < q.size(); i++) {
        if (q[i] < '0' || q[i] > '9') return false;
        v = v * 10 + (q[i] - '0');
        if (v > 100000000) return false;
    }
    id = (int)v;
    return true;
}
}  // namespace

SearchOutput SearchIndex::search(const std::string& query, int limit) const {
    Stopwatch sw;
    SearchOutput out;
    out.query = query;
    if (limit <= 0) limit = 8;
    CodePoints q = normalizeCps(query);
    if (q.empty()) { out.algo = "none"; out.timeUs = sw.ns() / 1000; return out; }

    // ---------------- 1. product id
    int id = 0;
    CodePoints qraw = q;
    // "#12", "P012", "p12", "12": remove inner spaces for the id form ("# 12")
    CodePoints compact;
    for (size_t i = 0; i < qraw.size(); i++) if (qraw[i] != ' ') compact.push_back(qraw[i]);
    if (parseIdQuery(compact, id)) {
        out.mode = "id";
        out.algo = "binary";
        int pos = binarySearchInt(sortedIds_, id, &out.comparisons);
        if (pos >= 0) {
            SearchHit h; h.productId = id; h.match = "id";
            out.hits.push_back(h);
            out.exact = true;
        }
        out.timeUs = sw.ns() / 1000;
        return out;
    }

    std::vector<Cand> cands;
    std::string qs = encodeUtf8(q);
    bool needFuzzy = true;

    // ---------------- 2a. exact full name (hash table)
    const std::vector<int>* ex = exact_.get(qs, &out.comparisons);
    if (ex) {
        for (size_t i = 0; i < ex->size(); i++) addCand(cands, (*ex)[i], 0, 0);
        out.algo = "hash";
    }

    // ---------------- 2b. prefix of a name / of every query word (trie)
    {
        std::vector<CodePoints> qwords = splitWords(q);
        std::vector<int> inter;     // products matching ALL query words as a word-prefix
        bool first = true, ok = true;
        for (size_t w = 0; w < qwords.size() && ok; w++) {
            std::vector<int> found;
            if (!trie_.collect(qwords[w], found, &out.comparisons)) { ok = false; break; }
            // dedupe + keep sorted order of first appearance
            std::vector<int> uniq;
            for (size_t i = 0; i < found.size(); i++) {
                bool dup = false;
                for (size_t k = 0; k < uniq.size(); k++) if (uniq[k] == found[i]) { dup = true; break; }
                if (!dup) uniq.push_back(found[i]);
            }
            if (first) { inter = uniq; first = false; }
            else {
                std::vector<int> keep;
                for (size_t i = 0; i < inter.size(); i++)
                    for (size_t k = 0; k < uniq.size(); k++) if (uniq[k] == inter[i]) { keep.push_back(inter[i]); break; }
                inter = keep;
            }
        }
        if (ok && !first) for (size_t i = 0; i < inter.size(); i++) addCand(cands, inter[i], 1, 0);
        // the whole query as a prefix of a full name ("full cream" -> "full cream milk 1l")
        if (qwords.size() > 1) {
            std::vector<int> found;
            if (trie_.collect(q, found, &out.comparisons)) for (size_t i = 0; i < found.size(); i++) addCand(cands, found[i], 1, 0);
        }
        if (!cands.empty() && out.algo.empty()) out.algo = "trie";
    }

    // ---------------- 2c. substring of any entry (linear scan with our own matcher)
    if (cands.empty() && q.size() >= 2) {
        for (size_t i = 0; i < entries_.size(); i++) {
            out.comparisons++;
            if (containsRun(entries_[i].text, q)) addCand(cands, entries_[i].product, 2, 0);
        }
        if (!cands.empty()) out.algo = "substring";
    }
    if (!cands.empty()) needFuzzy = false;

    // ---------------- 2d. fuzzy: Levenshtein against every entry (typo suggestion)
    if (needFuzzy) {
        int maxd = (int)q.size() / 3;
        if (maxd < 1) maxd = 1;
        for (size_t i = 0; i < entries_.size(); i++) {
            out.comparisons++;
            const CodePoints& t = entries_[i].text;
            int diff = (int)t.size() - (int)q.size();
            if (diff < 0) diff = -diff;
            if (diff > maxd) continue;
            int d = levenshtein(q, t);
            if (d <= maxd) addCand(cands, entries_[i].product, 3, d);
        }
        out.algo = "levenshtein";
    }
    if (out.algo.empty()) out.algo = "none";

    // ---------------- rank: (rank, distance, popularity desc, id) with our merge sort
    const Store& st = store_;
    const std::vector<Cand>& cl = cands;
    auto less = [&cl, &st](int a, int b) {
        const Cand& x = cl[a]; const Cand& y = cl[b];
        if (x.rank != y.rank) return x.rank < y.rank;
        if (x.dist != y.dist) return x.dist < y.dist;
        const Product& px = st.products[x.product]; const Product& py = st.products[y.product];
        if (px.popularity != py.popularity) return px.popularity > py.popularity;
        return px.id < py.id;
    };
    std::vector<int> order(cands.size());
    for (size_t i = 0; i < order.size(); i++) order[i] = (int)i;
    SortStats ss;
    makeSorter(less, ss).merge(order);

    for (size_t i = 0; i < order.size() && (int)out.hits.size() < limit; i++) {
        const Cand& c = cands[order[i]];
        SearchHit h;
        h.productId = store_.products[c.product].id;
        h.match = rankName(c.rank);
        h.distance = c.dist;
        out.hits.push_back(h);
    }
    if (!out.hits.empty()) {
        if (out.hits[0].match == "fuzzy") { out.hasSuggestion = true; out.suggestion = out.hits[0]; out.exact = false; }
        else out.exact = true;
    }
    out.timeUs = sw.ns() / 1000;
    return out;
}

}  // namespace bw
