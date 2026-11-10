// api.hpp - the JSON API (routing + handlers), independent of sockets so it can be unit-tested directly.
#pragma once
#include "searching.hpp"
#include "store.hpp"
#include <memory>
#include <mutex>
#include <string>

namespace bw {

struct HttpRequest {
    std::string method, path, query, body;
};

struct HttpResponse {
    int status = 200;
    std::string body;
    std::string contentType = "application/json; charset=utf-8";
};

struct Context {
    Store store;
    std::unique_ptr<SearchIndex> index;
    std::mutex benchMu;
    std::string benchCache;
    unsigned long long benchSeed = 0;
    bool hasBench = false;

    // Loads the store and builds the search index. Returns false + err on failure.
    bool init(const std::string& storePath, std::string& err);
    bool initFromText(const std::string& storeJson, std::string& err);
};

HttpResponse handleRequest(Context& ctx, const HttpRequest& req);

// value of ?key=... (percent-decoded), or "" if absent
std::string queryParam(const std::string& query, const std::string& key);

}  // namespace bw
