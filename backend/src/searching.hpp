// searching.hpp - search structures written from scratch:
//   StringHashTable  separate-chaining hash table (FNV-1a)       exact lookup      O(1) average
//   Trie             code-point trie (English + Arabic)           prefix lookup     O(len + matches)
//   binary search    over sorted ids / sorted strings                               O(log n)
//   levenshtein      two-row dynamic programming edit distance    typo suggestion   O(|a|*|b|)
//   linear scan      baseline used by the benchmark                                 O(n)
// SearchIndex ties them together into the product search used by GET /api/search.
#pragma once
#include "store.hpp"
#include "text.hpp"
#include <cstdint>
#include <string>
#include <vector>

namespace bw {

// ------------------------------------------------------------------ hash table
class StringHashTable {
public:
    StringHashTable() { buckets_.assign(64, -1); }
    // Associate `val` with `key` (a key may hold several values, e.g. two products sharing a name).
    void put(const std::string& key, int val);
    // Returns the values stored under `key` or nullptr. `probes` (optional) accumulates string comparisons.
    const std::vector<int>* get(const std::string& key, long long* probes = nullptr) const;
    size_t size() const { return count_; }
    static uint64_t hash(const std::string& s);

private:
    struct Node { std::string key; std::vector<int> vals; int next; };
    std::vector<int> buckets_;
    std::vector<Node> nodes_;
    size_t count_ = 0;
    void grow();
};

// ------------------------------------------------------------------ trie
class Trie {
public:
    Trie() { nodes_.push_back(Node()); }
    void insert(const CodePoints& word, int value);
    // Collect every value stored at or below the node reached by `prefix` (deterministic DFS order).
    // `visited` (optional) counts trie nodes touched. Returns false if the prefix does not exist.
    bool collect(const CodePoints& prefix, std::vector<int>& out, long long* visited = nullptr) const;
    size_t nodeCount() const { return nodes_.size(); }

private:
    struct Node { std::vector<std::pair<uint32_t, int>> kids; std::vector<int> values; };
    std::vector<Node> nodes_;
    void dfs(int node, std::vector<int>& out, long long* visited) const;
};

// ------------------------------------------------------------------ elementary searches
// Index of `target` in the ascending vector, or -1. `comparisons` counts probes.
int binarySearchInt(const std::vector<int>& sorted, int target, long long* comparisons = nullptr);
int binarySearchString(const std::vector<std::string>& sorted, const std::string& target, long long* comparisons = nullptr);
int linearSearchString(const std::vector<std::string>& v, const std::string& target, long long* comparisons = nullptr);
int linearSearchInt(const std::vector<int>& v, int target, long long* comparisons = nullptr);
// Classic edit distance (insert / delete / substitute, each cost 1) on code points.
int levenshtein(const CodePoints& a, const CodePoints& b);
// Does `hay` contain `needle` as a contiguous run?
bool containsRun(const CodePoints& hay, const CodePoints& needle);

// ------------------------------------------------------------------ product search
struct SearchHit {
    int productId = 0;
    std::string match;   // "id" | "exact" | "prefix" | "substring" | "fuzzy"
    int distance = 0;    // edit distance for fuzzy hits, else 0
};

struct SearchOutput {
    std::string query;
    std::string mode = "name";   // "id" | "name"
    bool exact = false;
    std::vector<SearchHit> hits;
    bool hasSuggestion = false;
    SearchHit suggestion;
    std::string algo;            // which structure produced the answer
    long long comparisons = 0;
    long long timeUs = 0;
};

class SearchIndex {
public:
    explicit SearchIndex(const Store& store);
    SearchOutput search(const std::string& query, int limit) const;

    // exposed for the benchmark
    const std::vector<std::string>& sortedNames() const { return sortedNames_; }
    const StringHashTable& hashTable() const { return exact_; }
    const Trie& trie() const { return trie_; }
    const std::vector<int>& sortedIds() const { return sortedIds_; }

private:
    struct Entry { CodePoints text; int product; bool word; };
    const Store& store_;
    std::vector<Entry> entries_;      // full names (EN, AR, slug) and every individual word
    StringHashTable exact_;           // normalised full name -> product index
    Trie trie_;                       // every word and every full name -> product index
    std::vector<int> sortedIds_;      // product ids ascending (binary search)
    std::vector<std::string> sortedNames_;  // normalised English names ascending (benchmark)
};

}  // namespace bw
