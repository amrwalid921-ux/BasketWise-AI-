// testlib.hpp - a tiny hand-written unit-test framework (no gtest).
//   TEST(name) { CHECK(cond); CHECK_EQ(a, b); CHECK_NEAR(a, b, eps); }
// Tests register themselves at static-initialisation time; run_all() executes them all.
#pragma once
#include <cmath>
#include <cstdio>
#include <functional>
#include <sstream>
#include <string>
#include <vector>

namespace tl {

struct Case { const char* name; void (*fn)(); };
inline std::vector<Case>& cases() { static std::vector<Case> c; return c; }
struct Registrar { Registrar(const char* n, void (*f)()) { cases().push_back({n, f}); } };
inline long long& checks() { static long long c = 0; return c; }
inline long long& failures() { static long long c = 0; return c; }

template <class T> std::string show(const T& v) { std::ostringstream o; o << v; return o.str(); }

inline void fail(const char* file, int line, const std::string& msg) {
    failures()++;
    printf("    FAIL %s:%d  %s\n", file, line, msg.c_str());
}

inline int runAll() {
    int failedTests = 0;
    for (size_t i = 0; i < cases().size(); i++) {
        long long before = failures();
        cases()[i].fn();
        bool ok = failures() == before;
        printf("[%s] %s\n", ok ? " ok " : "FAIL", cases()[i].name);
        if (!ok) failedTests++;
    }
    printf("\n%zu tests, %lld checks, %lld failed checks, %d failed tests\n", cases().size(), checks(), failures(), failedTests);
    return failedTests == 0 ? 0 : 1;
}

}  // namespace tl

#define TEST(name) \
    static void test_##name(); \
    static tl::Registrar reg_##name(#name, test_##name); \
    static void test_##name()

#define CHECK(cond) do { tl::checks()++; if (!(cond)) tl::fail(__FILE__, __LINE__, "CHECK(" #cond ")"); } while (0)
#define CHECK_EQ(a, b) do { tl::checks()++; auto _a = (a); auto _b = (b); \
    if (!(_a == _b)) tl::fail(__FILE__, __LINE__, std::string("CHECK_EQ(" #a ", " #b ") got ") + tl::show(_a) + " vs " + tl::show(_b)); } while (0)
#define CHECK_NEAR(a, b, eps) do { tl::checks()++; double _a = (a), _b = (b); \
    if (!(std::fabs(_a - _b) <= (eps))) tl::fail(__FILE__, __LINE__, std::string("CHECK_NEAR(" #a ", " #b ") got ") + tl::show(_a) + " vs " + tl::show(_b)); } while (0)
