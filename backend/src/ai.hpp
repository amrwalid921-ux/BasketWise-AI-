// ai.hpp - the "AI" part of BasketWise, all from scratch:
//
//   1. Preference scoring   content-based model: category / tag taste of the user + value-for-money,
//                           popularity and discount signals -> a score 0..100 for every product.
//   2. Basket selection     0/1 knapsack: maximise the total score without exceeding the budget
//                           (exact dynamic programming; greedy by score/price and brute force for comparison).
//   3. Visit ordering       travelling-salesman problem on real shortest-path distances inside the store
//                           (Held-Karp exact DP, nearest neighbour, 2-opt local search).
//   4. Routes               shortest paths between consecutive stops with BFS / Dijkstra / A*.
#pragma once
#include "json.hpp"
#include "pathfinding.hpp"
#include "store.hpp"
#include "util.hpp"
#include <string>
#include <vector>

namespace bw {

// ------------------------------------------------------------------ 1. scoring
struct Prefs {
    std::vector<std::pair<std::string, int>> categoryWeights;   // -3..3
    std::vector<std::string> avoidCategories, likedTags, dislikedTags;
    std::vector<int> mustHave;
    int weightOf(const std::string& cat) const;
    bool avoids(const std::string& cat) const;
};

struct Weights { double pref = 0.55, value = 0.20, popularity = 0.10, discount = 0.15; };

struct ScoredProduct {
    int id = 0;
    double score = 0, pref = 0, value = 0, popularity = 0, discount = 0;
    bool excluded = false;
    std::string reason;
};

std::vector<ScoredProduct> scoreProducts(const Store& s, const Prefs& p, const Weights& w);

// ------------------------------------------------------------------ 2. knapsack
struct KnapsackResult {
    std::vector<int> chosen;     // indices into the item arrays
    long long value = 0;
    int weight = 0;
    long long cells = 0;         // DP cells evaluated (or search nodes for brute force)
    long long timeUs = 0;
};
KnapsackResult knapsackDP(const std::vector<int>& weight, const std::vector<long long>& value, int capacity);
KnapsackResult knapsackGreedy(const std::vector<int>& weight, const std::vector<long long>& value, int capacity);
KnapsackResult knapsackBrute(const std::vector<int>& weight, const std::vector<long long>& value, int capacity);  // n <= 24

// ------------------------------------------------------------------ 3. TSP
// D is an (n+2)x(n+2) row-major matrix of costs: node 0 = start, nodes 1..n = items, node n+1 = end.
// A tour visits items 0..n-1 (matrix node = item+1) in some order, starting at 0 and finishing at n+1.
struct TspResult {
    std::vector<int> order;      // item indices 0..n-1 in visiting order
    long long cost = 0;
    long long timeUs = 0;
};
long long tourCost(const std::vector<int>& D, int n, const std::vector<int>& order);
TspResult tspHeldKarp(const std::vector<int>& D, int n);                 // exact, n <= 20
TspResult tspNearestNeighbor(const std::vector<int>& D, int n);
TspResult tsp2Opt(const std::vector<int>& D, int n, const std::vector<int>* start = nullptr);
TspResult tspRandom(const std::vector<int>& D, int n, Rng& rng);
TspResult tspBruteForce(const std::vector<int>& D, int n);               // n <= 9, for tests

// cost matrix between cells (Dijkstra from each cell); unreachable pairs get a huge cost
std::vector<int> buildDistMatrix(const Store& s, const std::vector<int>& cells);

// ------------------------------------------------------------------ 4. whole pipeline
struct PlanRequest {
    int budget = 0;
    Prefs prefs;
    Weights weights;
    double minScore = 40;
    std::string knapsack = "dp", tsp = "auto", path = "astar";
};

struct Basket {
    std::vector<int> ids;            // product ids, ascending
    int total = 0;
    double scoreSum = 0;
    bool feasible = true;
    std::vector<int> mustHave, missingMust;
    std::string algo;
    long long timeUs = 0, cells = 0;
    double greedyScoreSum = 0;
    int greedyTotal = 0;
    double gapPct = 0;
};

struct Visit {
    std::vector<int> productIds;     // visiting order (product ids)
    std::string algo;
    long long cost = 0;
    long long timeUs = 0;
    long long exactCost = -1, nnCost = 0, twoOptCost = 0;
    long long nnTimeUs = 0, twoOptTimeUs = 0;
    std::vector<int> cells;          // entrance, pickups in order, checkout (flat indices)
};

struct LegSet {
    std::vector<PathResult> legs;
    int totalSteps = 0, totalCost = 0, totalExpanded = 0;
    long long timeUs = 0;
};

struct PlanResult {
    std::vector<ScoredProduct> scores;
    int budget = 0;
    Basket basket;
    Visit visit;
    int steps = 0;
    LegSet routes[3];                // bfs, dijkstra, astar
    std::string primaryPath;
};

Basket selectBasket(const Store& s, const std::vector<ScoredProduct>& scores, const PlanRequest& req);
Visit planVisit(const Store& s, const std::vector<int>& basketIds, const std::string& tspAlgo);
LegSet computeLegs(const Store& s, const std::vector<int>& cells, const std::string& algo);
PlanResult makePlan(const Store& s, const PlanRequest& req);

bool parsePlanRequest(const Json& j, PlanRequest& out, std::string& err);
std::string planToJson(const Store& s, const PlanResult& r);

// ------------------------------------------------------------------ challenge mode
struct EvalResult {
    bool valid = false;
    std::string reason;
    int total = 0;
    double scoreSum = 0;
    bool mustHaveOk = true, overBudget = false;
    std::vector<int> avoidedPicked;
    std::vector<int> optimalIds; int optimalTotal = 0; double optimalScoreSum = 0;
    int userSteps = 0, userCost = 0;
    std::vector<int> bestOrder; int bestSteps = 0, bestCost = 0;
    int optSteps = 0, optCost = 0;
    double basketRatio = 0, routeRatio = 0;
    int score = 0, stars = 0;
};
EvalResult evaluateChoice(const Store& s, const PlanRequest& req, const std::vector<int>& ids, const std::string& algo);
std::string evalToJson(const EvalResult& e);

}  // namespace bw
