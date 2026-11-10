// sorting.hpp - six comparison sorts written from scratch (no std::sort / std::stable_sort).
//
// All sorts work on a std::vector<int> `a` and a strict-weak-order functor `less(x, y)` meaning
// "element x must come before element y".  Every algorithm counts honestly:
//   comparisons : calls to less()
//   swaps       : exchanges of two array slots
//   writes      : element assignments (insertion shifts, merge-sort aux copies)
// and can optionally record a trace of operations so the UI can replay/animate the algorithm:
//   [0,i,j] compare positions i and j      [1,i,j] swap positions i and j
//   [2,i,v] position i now holds element v (v = the *value* stored there; in /api/sort the values
//           are the original input indices, so replaying on [0..n-1] reproduces the real array)
//
// Complexities (n elements):
//   bubble     O(n^2) compares, O(n^2) swaps, stable, adaptive (stops when a pass has no swap)
//   selection  O(n^2) compares, O(n) swaps, unstable
//   insertion  O(n^2) worst / O(n) when nearly sorted, stable, shifts instead of swaps
//   merge      O(n log n) always, stable, O(n) extra memory
//   quick      O(n log n) average (median-of-three pivot), O(n^2) worst, in place, unstable
//   heap       O(n log n) always, in place, unstable
#pragma once
#include <array>
#include <string>
#include <vector>

namespace bw {

struct SortStats {
    long long comparisons = 0;
    long long swaps = 0;
    long long writes = 0;
};

struct SortTrace {
    bool enabled = false;
    size_t cap = 30000;
    bool truncated = false;
    std::vector<std::array<int, 3>> ops;
    void add(int op, int i, int j) {
        if (!enabled) return;
        if (ops.size() >= cap) { truncated = true; return; }
        ops.push_back({op, i, j});
    }
};

template <class Less>
class Sorter {
public:
    Sorter(Less l, SortStats& s, SortTrace* t = nullptr) : less_(l), st_(s), tr_(t) {}

    void bubble(std::vector<int>& a) {
        int n = (int)a.size();
        for (int pass = 0; pass < n - 1; pass++) {
            bool swapped = false;
            for (int j = 0; j + 1 < n - pass; j++) {
                if (lt(a, j + 1, j)) { doSwap(a, j, j + 1); swapped = true; }
            }
            if (!swapped) break;
        }
    }

    void selection(std::vector<int>& a) {
        int n = (int)a.size();
        for (int i = 0; i + 1 < n; i++) {
            int m = i;
            for (int j = i + 1; j < n; j++) if (lt(a, j, m)) m = j;
            if (m != i) doSwap(a, i, m);
        }
    }

    void insertion(std::vector<int>& a) {
        int n = (int)a.size();
        for (int i = 1; i < n; i++) {
            int key = a[i];
            int j = i - 1;
            while (j >= 0) {
                st_.comparisons++;
                if (tr_) tr_->add(0, j, i);
                if (!less_(key, a[j])) break;
                a[j + 1] = a[j];
                st_.writes++;
                if (tr_) tr_->add(2, j + 1, a[j]);
                j--;
            }
            if (j + 1 != i) {
                a[j + 1] = key;
                st_.writes++;
                if (tr_) tr_->add(2, j + 1, key);
            }
        }
    }

    void merge(std::vector<int>& a) {
        std::vector<int> aux(a.size());
        mergeRec(a, aux, 0, (int)a.size());
    }

    void quick(std::vector<int>& a) { quickRec(a, 0, (int)a.size() - 1); }

    void heap(std::vector<int>& a) {
        int n = (int)a.size();
        for (int i = n / 2 - 1; i >= 0; i--) siftDown(a, i, n);
        for (int end = n - 1; end > 0; end--) {
            doSwap(a, 0, end);
            siftDown(a, 0, end);
        }
    }

    // Dispatch by name: bubble|selection|insertion|merge|quick|heap. Returns false for unknown names.
    bool run(const std::string& algo, std::vector<int>& a) {
        if (algo == "bubble") bubble(a);
        else if (algo == "selection") selection(a);
        else if (algo == "insertion") insertion(a);
        else if (algo == "merge") merge(a);
        else if (algo == "quick") quick(a);
        else if (algo == "heap") heap(a);
        else return false;
        return true;
    }

private:
    Less less_;
    SortStats& st_;
    SortTrace* tr_;

    // compare the elements stored at positions i and j
    bool lt(std::vector<int>& a, int i, int j) {
        st_.comparisons++;
        if (tr_) tr_->add(0, i, j);
        return less_(a[i], a[j]);
    }
    void doSwap(std::vector<int>& a, int i, int j) {
        int t = a[i]; a[i] = a[j]; a[j] = t;
        st_.swaps++;
        if (tr_) tr_->add(1, i, j);
    }

    // ---- merge sort: split, sort halves, merge (taking the left element on ties => stable)
    void mergeRec(std::vector<int>& a, std::vector<int>& aux, int lo, int hi) {  // [lo, hi)
        if (hi - lo < 2) return;
        int mid = lo + (hi - lo) / 2;
        mergeRec(a, aux, lo, mid);
        mergeRec(a, aux, mid, hi);
        for (int k = lo; k < hi; k++) aux[k] = a[k];
        int i = lo, j = mid;
        for (int k = lo; k < hi; k++) {
            int v;
            if (i >= mid) v = aux[j++];
            else if (j >= hi) v = aux[i++];
            else {
                st_.comparisons++;
                if (tr_) tr_->add(0, i, j);
                if (less_(aux[j], aux[i])) v = aux[j++]; else v = aux[i++];
            }
            a[k] = v;
            st_.writes++;
            if (tr_) tr_->add(2, k, v);
        }
    }

    // ---- quicksort: median-of-three pivot, Lomuto partition, recurse on the smaller side first
    void quickRec(std::vector<int>& a, int lo, int hi) {
        while (lo < hi) {
            if (hi - lo == 1) { if (lt(a, hi, lo)) doSwap(a, lo, hi); return; }
            int mid = lo + (hi - lo) / 2;
            // order a[lo], a[mid], a[hi] so the median ends in the middle
            if (lt(a, mid, lo)) doSwap(a, mid, lo);
            if (lt(a, hi, lo)) doSwap(a, hi, lo);
            if (lt(a, hi, mid)) doSwap(a, hi, mid);
            if (hi - lo == 2) return;  // three elements are now sorted
            doSwap(a, mid, hi - 1);   // pivot parked at hi-1
            int pivot = a[hi - 1];
            int i = lo;
            for (int j = lo + 1; j < hi - 1; j++) {
                st_.comparisons++;
                if (tr_) tr_->add(0, j, hi - 1);
                if (less_(a[j], pivot)) {
                    i++;
                    if (i != j) doSwap(a, i, j);
                }
            }
            // a[lo] <= pivot, so the final pivot slot is i+1
            int p = i + 1;
            if (p != hi - 1) doSwap(a, p, hi - 1);
            if (p - lo < hi - p) { quickRec(a, lo, p - 1); lo = p + 1; }
            else { quickRec(a, p + 1, hi); hi = p - 1; }
        }
    }

    // ---- heap sort helpers (max-heap: parent is never "before" its children)
    void siftDown(std::vector<int>& a, int i, int n) {
        while (true) {
            int l = 2 * i + 1, r = l + 1, big = i;
            if (l < n && lt(a, big, l)) big = l;
            if (r < n && lt(a, big, r)) big = r;
            if (big == i) return;
            doSwap(a, i, big);
            i = big;
        }
    }
};

// Convenience: build a Sorter from a functor without spelling the template argument.
template <class Less>
Sorter<Less> makeSorter(Less l, SortStats& s, SortTrace* t = nullptr) { return Sorter<Less>(l, s, t); }

// ---- non-template helpers (sorting.cpp)
// True for bubble|selection|insertion|merge|quick|heap.
bool isSortAlgo(const std::string& name);
// Replays a trace on a = [0..n-1] and returns the final array. In /api/sort the result lists, for every
// output position, the index of the input element that ends up there (so ids[a[i]] is the sorted list).
std::vector<int> replayTrace(int n, const std::vector<std::array<int, 3>>& ops);

}  // namespace bw
