// BasketWise AI backend: algorithms in C++, exposed as a small JSON API.
//   basketwise-server [--port 8080] [--data ../data/store.json]
#include "api.hpp"
#include "server.hpp"
#include <cstdio>
#include <cstdlib>
#include <cstring>

int main(int argc, char** argv) {
    int port = 8080;
    std::string dataPath;
    for (int i = 1; i < argc; i++) {
        if (!strcmp(argv[i], "--port") && i + 1 < argc) port = atoi(argv[++i]);
        else if (!strcmp(argv[i], "--data") && i + 1 < argc) dataPath = argv[++i];
        else { fprintf(stderr, "usage: %s [--port N] [--data store.json]\n", argv[0]); return 1; }
    }
    static bw::Context ctx;
    std::string err;
    const char* candidates[] = {"../data/store.json", "data/store.json", "../../data/store.json"};
    bool ok = false;
    if (!dataPath.empty()) ok = ctx.init(dataPath, err);
    else {
        for (size_t i = 0; i < 3 && !ok; i++) ok = ctx.init(candidates[i], err);
    }
    if (!ok) { fprintf(stderr, "cannot load store data: %s\n", err.c_str()); return 1; }
    std::atomic<int> bound(0);
    std::atomic<bool> stop(false);
    printf("BasketWise backend: %zu products, grid %dx%d, listening on port %d\n",
           ctx.store.products.size(), ctx.store.W, ctx.store.H, port);
    fflush(stdout);
    return bw::runServer(ctx, port, &bound, &stop);
}
