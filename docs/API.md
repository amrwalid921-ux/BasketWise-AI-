# BasketWise AI — Backend contract (C++ ⇄ React)

The backend is a single C++17 binary with **no third-party libraries**. All algorithm code is written from
scratch (see "From scratch" below). The React front-end talks to it through the JSON API below.
This file is the contract: the front-end is written against it.

* Binary: `backend/build/basketwise-server --port 8080 --data ../data/store.json`
* All responses: `Content-Type: application/json; charset=utf-8`, `Access-Control-Allow-Origin: *`,
  `OPTIONS` pre-flight answered with 204 and the usual CORS headers (`Allow-Methods: GET,POST,OPTIONS`, `Allow-Headers: Content-Type`).
* Errors: HTTP 400/404/500 with `{"error":"message"}`.
* Data: `data/store.json` (built by `node tools/build-store.mjs`). Cells are addressed as `[x, y]`;
  flat index = `y * grid.w + x`. `grid.cost` is an array of `h` strings of `w` digit characters:
  `'0'` = blocked, `'1'..'9'` = cost of stepping **into** that cell. Movement is 4-connected.
* `product.pickup` = the walkable cell the shopper stands on to take the product; `product.shelf` = shelf cell.
* Prices are integer EGP. Product `id`s are 1..84.

## From scratch (hard requirement)

Algorithms must not call library algorithms/containers that do the interesting work:
no `std::sort/stable_sort/partial_sort/nth_element`, `std::priority_queue`, `std::make_heap`, `std::unordered_map/map/set`,
`std::find`, `std::lower_bound`, `std::next_permutation`, `std::function` tricks that hide the logic, etc.
`std::vector`, `std::string`, `std::array`, `<chrono>`, `<cstdint>` and plain I/O are fine as plumbing.
Write your own binary heap, hash table, trie, merge/quick/heap/insertion/bubble/selection sort, BFS queue, etc.
(Tests may use `std::sort` etc. as an *oracle* to verify results.)

JSON: write a small JSON parser + writer yourself (objects, arrays, strings with \uXXXX, numbers, true/false/null).
HTTP: minimal HTTP/1.1 server over POSIX sockets (thread-per-connection is fine), keep-alive optional,
must handle `Content-Length` bodies up to 1 MB.

## Endpoints

### `GET /api/health` → `{"ok":true,"products":84}`

### `GET /api/store` → the raw contents of `store.json`

### `GET /api/search?q=<text>&limit=8`

Algorithms: hash table (exact), binary search over sorted IDs/names, trie (prefix, English + Arabic),
Levenshtein DP (typo suggestion), linear scan (used only for comparison counters).

Behaviour:
1. If `q` is an ID (`"12"`, `"#12"`, `"P012"`, `"p12"`): ID lookup (binary search over sorted ids) → `mode:"id"`.
2. Otherwise normalise the query (see Normalisation) and look for: exact name match (hash) → prefix match (trie)
   → substring match → fuzzy match (Levenshtein on code points, accept distance ≤ max(1, len/3)).
   Names searched: English name, Arabic name, the slug (`baladi-bread`), and each word of the names.
3. `results` sorted best-first (exact > prefix > substring > fuzzy; ties by popularity desc).
4. `suggestion` is set (and `exact:false`) when the best hit came from the fuzzy stage — a "Did you mean …?" candidate.

```json
{"query":"mlk","mode":"name","exact":false,
 "results":[{"id":9,"match":"fuzzy","distance":1}],
 "suggestion":{"id":9,"text":"Full Cream Milk 1L","textAr":"لبن كامل الدسم 1 لتر","distance":1},
 "stats":{"algo":"levenshtein","comparisons":84,"timeUs":41}}
```
`match` ∈ `"id" | "exact" | "prefix" | "substring" | "fuzzy"`.

**Normalisation** (UTF-8 aware): ASCII lower-case; Arabic: strip tashkeel (U+064B–U+065F, U+0670), tatweel (U+0640);
أ إ آ ٱ → ا ; ى → ي ; ة → ه; Arabic-Indic digits → ASCII digits; collapse whitespace.

### `POST /api/sort`

Request: `{"by":"price|rating|popularity|deal|name|score","order":"asc|desc","algo":"merge|quick|heap|insertion|bubble|selection","ids":[...optional subset...],"scores":{"9":71.2,...}(for by=score),"trace":true|false}`
* `deal` = `rating * (1 + discount/50) * 100 / price` (higher = better deal).
* `name` sorts by normalised English name.
* Sorts must be **stable-equivalent**: ties broken by `id` ascending (compare `(key, id)` pairs) so all algorithms return the same list.
* `ids` default = all products.

Response:
```json
{"ids":[...sorted ids...],"stats":{"algo":"merge","n":84,"comparisons":512,"swaps":0,"writes":600,"timeUs":18},
 "trace":[[0,3,4],[1,3,4],[2,5,9]]}
```
`trace` (only when `trace:true`, max 30 000 entries, otherwise omitted and `"traceTruncated":true`): ops replayed on an
index array `a = [0..n-1]` (positions of the *input* list): `[0,i,j]` compare positions i,j; `[1,i,j]` swap positions i,j;
`[2,i,k]` overwrite position i with the element that started at input index k (merge sort aux-writes). Replaying
all ops must end with `a` giving the sorted order. For `by` keys use the input order = `ids` order (or id order).

### `POST /api/path`

Request: `{"from":[x,y],"to":[x,y],"algo":"bfs|dijkstra|astar","all":false}`
Response (single): `{"algo":"astar","path":[[x,y],...],"explored":[idx,...],"steps":58,"cost":61,"expanded":212,"timeUs":35}`
With `"all":true`: `{"results":{"bfs":{...},"dijkstra":{...},"astar":{...}}}`.

* `path` includes both endpoints; `steps` = number of moves; `cost` = sum of cost of entered cells.
* `explored` = flat cell indices in the order cells were **expanded** (popped from queue / heap and finalised).
* **BFS** ignores costs (minimum number of steps). **Dijkstra** and **A\*** minimise cost
  (A\* heuristic = Manhattan distance × 1, admissible because min cell cost is 1). Tie-breaking must be deterministic.
* Unreachable: `{"path":[],"explored":[...],"steps":-1,"cost":-1,...}`.

### `POST /api/plan` — the whole pipeline

Request:
```json
{
 "budget": 600,
 "prefs": {
   "categoryWeights": {"dairy":2,"bakery":3,"snacks":-3},
   "avoidCategories": ["snacks"],
   "likedTags": ["healthy","egyptian"],
   "dislikedTags": ["sweet"],
   "mustHave": [1,17]
 },
 "weights": {"pref":0.55,"value":0.20,"popularity":0.10,"discount":0.15},
 "minScore": 40,
 "algos": {"knapsack":"dp","tsp":"auto","path":"astar"}
}
```
All fields except `budget` are optional. `categoryWeights` values are integers −3..3 (missing = 0).
`algos.knapsack` ∈ `dp|greedy`, `algos.tsp` ∈ `auto|heldkarp|nn|2opt`, `algos.path` ∈ `bfs|dijkstra|astar` (which path algorithm is the "primary" one; routes for **all three** are always returned).

**Step 1 — preference scoring (AI):** for every product
```
catN   = categoryWeights[category] / 3                      (−1..1)
tagN   = clamp(0.25 * |liked ∩ tags| − 0.35 * |disliked ∩ tags|, −1, 1)
prefN  = (clamp(0.7*catN + 0.3*tagN, −1, 1) + 1) / 2        (0..1)
valueN = min-max normalise over the catalog of  rating*100/sqrt(price)
popN   = popularity/100 ;  discN = min(discount,20)/20
score  = 100 * (w.pref*prefN + w.value*valueN + w.popularity*popN + w.discount*discN)
```
Weights default `{pref:.55,value:.20,popularity:.10,discount:.15}` and are normalised to sum 1. Products in `avoidCategories`
get `excluded:true` (never selected unless listed in `mustHave`). Each score also returns the four components and a short `reason` string (English).

**Step 2 — basket (0/1 knapsack):** must-have items are forced in. Remaining budget = budget − cost(mustHave).
Candidates = not excluded and `score ≥ minScore`. Maximise Σ round(score*100) subject to Σ price ≤ remaining budget
(integer DP over budget; `greedy` = by score/price ratio). If must-haves alone exceed the budget: `feasible:false`, `missingMust` lists those that could
not fit (keep highest score/price first) and the basket contains what fits.

**Step 3 — visit order (TSP):** start = `entrance`, then the basket's pickup cells, end = `checkout`.
Pairwise distances = Dijkstra path cost on the cost grid. `auto` = Held–Karp exact DP when ≤ 15 items else nearest-neighbour + 2-opt.
Always also compute NN and 2-opt (and exact when ≤ 15) for the stats.

**Step 4 — routes:** for the visit order, compute legs with **each** path algorithm (`bfs`, `dijkstra`, `astar`).

Response:
```json
{
 "scores":[{"id":1,"score":87.5,"pref":0.9,"value":0.6,"popularity":0.98,"discount":0,"excluded":false,"reason":"Loved category (Bakery +3), staple"}],
 "basket":{"ids":[1,9,...],"total":574,"budget":600,"remaining":26,"scoreSum":1234.5,"feasible":true,"mustHave":[1,17],
           "missingMust":[],"algo":"dp",
           "stats":{"timeUs":210,"cells":96000,"greedyScoreSum":1200.1,"greedyTotal":590,"gapVsGreedyPct":2.9}},
 "order":{"ids":[...visit order...],"algo":"heldkarp","cost":210,"steps":195,
          "stats":{"timeUs":950,"exactCost":210,"nnCost":238,"twoOptCost":214,"nnTimeUs":4,"twoOptTimeUs":30}},
 "visit":[{"type":"entrance","x":3,"y":20},{"type":"product","id":9,"x":..,"y":..},{"type":"checkout","x":30,"y":16}],
 "routes":{
   "bfs":{"legs":[{"from":[3,20],"to":[..],"path":[[x,y],...],"explored":[idx,...],"steps":12,"cost":14,"expanded":80}],
          "totalSteps":..,"totalCost":..,"totalExpanded":..,"timeUs":..},
   "dijkstra":{...},"astar":{...}},
 "primaryPath":"astar"
}
```
`legs[i]` goes from `visit[i]` to `visit[i+1]`.

### `POST /api/evaluate` — challenge mode scoring

Request: `{"budget":350,"prefs":{...},"weights":{...},"minScore":40,"ids":[ids in the order the player collected them],"algo":"astar"}`.
The player's route = entrance → ids in given order → checkout, using `algo`.
Response:
```json
{"valid":true,"reason":"","total":340,"scoreSum":910.4,"mustHaveOk":true,"overBudget":false,
 "optimal":{"ids":[...],"total":349,"scoreSum":1002.2},
 "user":{"steps":210,"cost":230},
 "bestRouteForUserItems":{"order":[...],"steps":160,"cost":170},
 "optimalFull":{"steps":175,"cost":190},
 "basketRatio":0.91,"routeRatio":0.74,"score":855,"stars":2}
```
`valid=false` when over budget or a must-have is missing (then `score:0,stars:0`, `reason` says why).
`basketRatio = min(1, scoreSum/optimal.scoreSum)`; `routeRatio = min(1, bestRouteForUserItems.cost / user.cost)`;
`score = round(1000*(0.7*basketRatio + 0.3*routeRatio))`; `stars = 3 if ratio_total ≥ .9, 2 if ≥ .75, 1 if ≥ .5 else 0`
where `ratio_total = 0.7*basketRatio+0.3*routeRatio`.

### `GET /api/benchmark?seed=42`

Runs (≈ ≤ 4 s total, cached per seed) and returns real measured numbers (`std::chrono::steady_clock`):
```json
{"seed":42,
 "sorting":{"results":[{"algo":"merge","n":1000,"dataset":"random","comparisons":8700,"swaps":0,"writes":9976,"timeUs":120}]},
 "searching":{"catalogSize":84,"queries":2000,"results":[{"algo":"linear","avgComparisons":42,"avgTimeNs":900},{"algo":"binary",...},{"algo":"hash",...},{"algo":"trie-prefix",...},{"algo":"levenshtein",...}]},
 "pathfinding":{"pairs":300,"results":[{"algo":"bfs","avgExpanded":..,"avgTimeUs":..,"avgSteps":..,"avgCost":..,"optimalCostPct":62.0},{"algo":"dijkstra",...},{"algo":"astar",...}]},
 "knapsack":{"results":[{"algo":"dp","budget":300,"scoreSum":..,"total":..,"timeUs":..},{"algo":"greedy","budget":300,...},{"algo":"bruteforce","budget":..,"n":20,...}]},
 "tsp":{"results":[{"algo":"heldkarp","n":10,"cost":..,"timeUs":..},{"algo":"nn","n":10,...},{"algo":"2opt","n":10,...},{"algo":"random","n":10,...}]}}
```
Sorting: sizes 100, 1 000, 5 000, 20 000 (bubble/selection/insertion only up to 5 000) × datasets `random|sorted|reversed|nearly-sorted`
for algos merge, quick, heap, insertion, selection, bubble. Pathfinding: 300 random pairs of walkable cells from the store grid.
`optimalCostPct` = percentage of pairs where the algorithm's path cost equals the Dijkstra cost. Knapsack: budgets 150, 300, 600, 1000
on the real catalog (brute-force only on a 20-item subset). TSP: random subsets of product pickups, n = 6, 8, 10, 12, 14.
