// pathfinding.hpp - shortest paths on the store grid (4-connected), written from scratch.
//
//   BFS       queue-based, finds the path with the FEWEST STEPS. It ignores the cost of cells, so on a
//             weighted grid (wet floor, crowds) its path can be more expensive than the optimum.
//   Dijkstra  binary-heap priority queue, finds the path with the LOWEST COST on the weighted grid.
//   A*        Dijkstra guided by the Manhattan-distance heuristic (admissible and consistent because the
//             cheapest cell costs 1). Same optimal cost as Dijkstra but expands far fewer cells.
//
// Cost model: the cost of a path is the sum of the costs of the cells it ENTERS (the start is free).
// `explored` is the order in which cells were expanded (removed from the queue / heap and finalised);
// the front-end shows it as the "radar" while the algorithm thinks.
//
// Deterministic tie-breaking: neighbours are visited in the fixed order up, right, down, left and every
// heap entry carries an insertion sequence number as its last key.
#pragma once
#include "store.hpp"
#include <string>
#include <vector>

namespace bw {

struct PathResult {
    std::vector<int> path;       // flat cell indices from start to goal (inclusive); empty if unreachable
    std::vector<int> explored;   // expansion order (flat indices)
    int steps = -1;              // number of moves, -1 if unreachable
    int cost = -1;               // sum of entered-cell costs, -1 if unreachable
    int expanded = 0;            // == explored.size()
    long long timeUs = 0;
    long long timeNs = 0;
};

// A binary min-heap with three lexicographic keys, used by Dijkstra and A*. Written from scratch.
struct HeapItem { long long k1, k2, k3; int node; };

class MinHeap {
public:
    bool empty() const { return a_.empty(); }
    size_t size() const { return a_.size(); }
    void clear() { a_.clear(); }
    void push(const HeapItem& it);
    HeapItem pop();
private:
    std::vector<HeapItem> a_;
    static bool before(const HeapItem& x, const HeapItem& y) {
        if (x.k1 != y.k1) return x.k1 < y.k1;
        if (x.k2 != y.k2) return x.k2 < y.k2;
        return x.k3 < y.k3;
    }
};

PathResult bfsPath(const Store& s, int from, int to);
PathResult dijkstraPath(const Store& s, int from, int to);
PathResult astarPath(const Store& s, int from, int to);
// algo = "bfs" | "dijkstra" | "astar" (anything else behaves like "astar")
PathResult findPath(const Store& s, int from, int to, const std::string& algo);

// Single-source minimum cost to every cell (Dijkstra without a target). -1 = unreachable.
void dijkstraAll(const Store& s, int from, std::vector<int>& dist);

// Cost of walking an already computed cell path (sum of entered cells).
int pathCost(const Store& s, const std::vector<int>& path);

}  // namespace bw
