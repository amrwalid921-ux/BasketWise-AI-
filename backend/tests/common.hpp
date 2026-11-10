// common.hpp - shared fixture: the real store loaded once.
#pragma once
#include "api.hpp"
#include "testlib.hpp"

inline bw::Context& ctx() {
    static bw::Context* c = nullptr;
    if (!c) {
        c = new bw::Context();
        const char* paths[] = {"data/store.json", "../data/store.json", "../../data/store.json", "../../../data/store.json"};
        std::string err; bool ok = false;
        for (int i = 0; i < 4 && !ok; i++) ok = c->init(paths[i], err);
        if (!ok) { printf("cannot load store: %s\n", err.c_str()); exit(2); }
    }
    return *c;
}
inline const bw::Store& store() { return ctx().store; }

inline bw::HttpResponse post(const std::string& path, const std::string& body) {
    bw::HttpRequest r; r.method = "POST"; r.path = path; r.body = body; return bw::handleRequest(ctx(), r);
}
inline bw::HttpResponse get(const std::string& path, const std::string& query = "") {
    bw::HttpRequest r; r.method = "GET"; r.path = path; r.query = query; return bw::handleRequest(ctx(), r);
}
