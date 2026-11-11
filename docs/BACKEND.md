# BasketWise AI - backend algorithms (C++17, from scratch)

The server (`backend/build/basketwise-server`) uses no third-party code. It does not use `std::sort`, `std::priority_queue`,
`std::map`/`unordered_map`, `std::find`, `std::next_permutation` or similar library algorithms. The only standard parts it relies on
are `std::vector`, `std::string`, `<chrono>` and plain sockets. The test-suite uses `std::sort` and friends only as oracles.

Source map (`backend/src/`): `json` (parser + writer), `text` (UTF-8, Arabic normalisation), `store` (data loader), `sorting`, `searching`
(hash table, trie, binary search, Levenshtein), `pathfinding` (heap, BFS, Dijkstra, A*), `ai` (scoring, knapsack, TSP, planner,
challenge evaluation), `benchmark`, `api` (routing, handlers), `server` (HTTP over POSIX sockets), `main`.

## 1. Sorting (`/api/sort`, `sorting.hpp`)
Six comparison sorts are available: **bubble, selection, insertion, merge, quick, heap**. In the app they order the product list by
price, rating, popularity, deal value, name or AI score. All sorts work on an array of positions and share one comparator
`(key, id)`, so ties are always broken by product id and every algorithm returns the same list.
- *Bubble*: repeated adjacent swaps, stops after a pass without swaps (O(n) on sorted input, O(n^2) otherwise).
- *Selection*: finds the minimum of the unsorted suffix, at most n-1 swaps, always O(n^2) comparisons.
- *Insertion*: shifts larger elements right and drops the key in (writes, not swaps); O(n) on nearly sorted data.
- *Merge*: top-down, uses an aux array, takes the left element on ties (stable); O(n log n) always, O(n) memory.
- *Quick*: median-of-three pivot, Lomuto partition, recursion on the smaller side first (stack depth O(log n)); O(n log n) average.
- *Heap*: builds a max-heap in place (bottom-up, O(n)), then repeatedly swaps the root to the end and sifts down; O(n log n) always.

Counters are honest: `comparisons` = calls of the comparator, `swaps` = slot exchanges, `writes` = element assignments (insertion shifts,
merge copies and merge-back writes). `timeUs` is a `steady_clock` measurement around the sort only.
The **trace** (`trace:true`, max 30 000 ops) records `[0,i,j]` compare, `[1,i,j]` swap, `[2,i,k]` overwrite position i with input element k.
Replaying it on `[0..n-1]` gives exactly the sorted order (tested for every algorithm).

## 2. Searching (`/api/search`, `searching.hpp`)
Index (built once at startup): every product contributes its normalised English name, Arabic name, slug, the names without parentheses
and each word. Pipeline for a query:
1. **Normalisation** (`text.cpp`): lower-case, punctuation to spaces, Arabic tashkeel/tatweel removal, alef variants to ا, ى to ي, ة to ه,
   Arabic-Indic digits to ASCII, whitespace collapsed. "عيش بلدى" and "عَيْش بلدي" become the same string.
2. **ID form** (`12`, `#12`, `P012`, `p12`): **binary search** over the sorted id array, O(log n).
3. **Exact**: own **hash table** (separate chaining, FNV-1a, doubling at load factor 1), O(1) average.
4. **Prefix**: own **trie** keyed on Unicode code points (English and Arabic share the structure), O(len + matches).
5. **Substring**: linear scan with a naive contiguous-run test (queries of at least 2 characters).
6. **Fuzzy**: **Levenshtein** two-row DP on code points, accepted when distance <= max(1, len/3). Runs only when stages 3-5 found nothing,
   and yields the "Did you mean ...?" `suggestion` ("mlk" -> Full Cream Milk, "لبنn" -> لبن).
Results are ranked exact > prefix > substring > fuzzy, then by distance, then popularity (sorted with the merge sort above).
A plain linear scan exists as the comparison baseline in the benchmark.

## 3. Pathfinding (`/api/path`, `pathfinding.hpp`)
The store is a 42x22 grid, 4-connected; the cost of a move is the cost of the cell entered (the store uses 1 normal, 2 and 3 slower zones, 6 for the wet-floor patch, 0 blocked).
- **BFS**: FIFO queue (array + head index); fewest steps, ignores cell costs, so on weighted cells its path is not cheapest. O(V+E).
- **Dijkstra**: own **binary min-heap** (`MinHeap`, keys `(g, insertion order)`), lazy deletion of stale entries; cheapest path. O((V+E) log V).
- **A\***: Dijkstra ordered by `f = g + h` with `h` = Manhattan distance (admissible and consistent because every cell costs >= 1);
  ties go to the smaller `h`, then the earlier insertion. Same optimal cost as Dijkstra, far fewer expansions.
`explored` lists cells in expansion order (the moment a cell is popped and finalised). Neighbour order is fixed (up, right, down, left), so all
runs are deterministic. Unreachable targets return `steps:-1, cost:-1` with the explored region.

## 4. AI preference model (`/api/plan` step 1, `ai.cpp`)
A transparent content-based scorer: `score = 100 * (w.pref*prefN + w.value*valueN + w.popularity*popN + w.discount*discN)` where
`prefN` mixes the player's category weight (70 %) and liked/disliked tag overlap (30 %), `valueN` is min-max normalised
`rating*100/sqrt(price)`, `popN = popularity/100`, `discN = min(discount,20)/20`. Weights are normalised to sum 1. Each product also returns
its four components and an English `reason`. O(n * tags).

## 5. Basket selection - 0/1 knapsack (step 2)
Value = `round(score*100)`, weight = price (integer EGP), capacity = budget minus the forced must-haves. **Dynamic programming** over
capacity (`dp[c]` = best value with capacity c, iterating c downwards so each item is used once, plus a take-table for reconstruction);
O(n*W) time and memory, exact. **Greedy** sorts by value/price (merge sort) and fills while it fits - fast but can be suboptimal
(`gapVsGreedyPct`). **Brute force** (2^n recursion, n <= 24) validates the DP in the tests and the benchmark.

## 6. Visit order - travelling salesman (step 3)
Open path: fixed start (entrance), all basket pickups, fixed end (checkout). The distance matrix holds the **Dijkstra cost** between
every pair of cells (one single-source run per node). Because costs are charged for the entered cell, the matrix is asymmetric - all TSP
code supports that.
- **Held-Karp**: exact bitmask DP, `dp[mask][last]`, parent table for reconstruction; O(2^n * n^2), used for <= 15 items (about 20 ms at n = 15).
- **Nearest neighbour**: repeatedly walk to the cheapest unvisited item; O(n^2).
- **2-opt**: starting from NN, reverse any segment of the order if the whole tour gets cheaper, until no reversal improves; used for > 15 items.
- **Random**: shuffled order (Fisher-Yates with the xorshift generator), the benchmark baseline.

## 7. Routes and challenge evaluation (step 4, `/api/evaluate`)
For the chosen order, legs between consecutive stops are computed with BFS, Dijkstra and A* (all three always returned).
`/api/evaluate` rebuilds the optimal basket (knapsack DP) and its best route, scores the player's basket (`basketRatio`) and walking
(`routeRatio` = best order for the player's own items / player's order), and combines them as in the API contract.

## 8. Infrastructure
`json.cpp`: recursive-descent parser (surrogate pairs, depth limit 200) and a streaming `JsonWriter` that appends straight into one string
(so large `/api/plan` answers are cheap). `server.cpp`: minimal HTTP/1.1 over POSIX sockets, one thread per connection, exact `Content-Length`,
CORS headers, bodies up to 1 MB (413 beyond), `Expect: 100-continue`. Benchmark answers are cached per seed (`GET /api/benchmark?seed=`).
