// util.hpp - tiny helpers shared by every module: monotonic timer and a deterministic PRNG.
#pragma once
#include <chrono>
#include <cstdint>

namespace bw {

// Monotonic clock in nanoseconds (std::chrono::steady_clock).
inline int64_t nowNs() {
    return std::chrono::duration_cast<std::chrono::nanoseconds>(
               std::chrono::steady_clock::now().time_since_epoch()).count();
}

// Stopwatch used to time one algorithm run.
struct Stopwatch {
    int64_t t0;
    Stopwatch() : t0(nowNs()) {}
    int64_t ns() const { return nowNs() - t0; }
};

// xorshift64* pseudo random generator. Deterministic for a given seed; used by the benchmark,
// the random TSP baseline and the tests (no <random> needed).
struct Rng {
    uint64_t s;
    explicit Rng(uint64_t seed = 1) {
        s = seed * 0x9E3779B97F4A7C15ULL + 0xD1B54A32D192ED03ULL;
        if (s == 0) s = 0x2545F4914F6CDD1DULL;
        for (int i = 0; i < 4; i++) next();  // warm up
    }
    uint64_t next() {
        s ^= s >> 12; s ^= s << 25; s ^= s >> 27;
        return s * 2685821657736338717ULL;
    }
    // uniform integer in [0, n)
    int below(int n) { return n <= 1 ? 0 : (int)((next() >> 11) % (uint64_t)n); }
    // uniform double in [0, 1)
    double unit() { return (double)(next() >> 11) / 9007199254740992.0; }
};

}  // namespace bw
