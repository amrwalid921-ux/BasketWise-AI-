// benchmark.hpp - measures the algorithms against each other with real timings (GET /api/benchmark).
#pragma once
#include "searching.hpp"
#include "store.hpp"
#include <string>

namespace bw {

// Runs every benchmark section and returns the JSON document described in docs/API.md.
std::string runBenchmark(const Store& store, const SearchIndex& index, unsigned long long seed);

}  // namespace bw
