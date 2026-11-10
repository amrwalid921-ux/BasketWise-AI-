#include "sorting.hpp"

namespace bw {

bool isSortAlgo(const std::string& n) {
    return n == "bubble" || n == "selection" || n == "insertion" || n == "merge" || n == "quick" || n == "heap";
}

std::vector<int> replayTrace(int n, const std::vector<std::array<int, 3>>& ops) {
    std::vector<int> a(n);
    for (int i = 0; i < n; i++) a[i] = i;
    for (size_t k = 0; k < ops.size(); k++) {
        int op = ops[k][0], i = ops[k][1], j = ops[k][2];
        if (op == 1) { int t = a[i]; a[i] = a[j]; a[j] = t; }   // swap positions i, j
        else if (op == 2) a[i] = j;                              // overwrite position i with element j
        // op 0 (compare) does not change the array
    }
    return a;
}

}  // namespace bw
