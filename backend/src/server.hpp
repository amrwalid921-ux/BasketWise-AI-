// server.hpp - a minimal HTTP/1.1 server on POSIX sockets (thread per connection, Connection: close).
#pragma once
#include "api.hpp"
#include <atomic>

namespace bw {

// Listens on `port` (0 = pick a free port). The chosen port is stored in *boundPort as soon as the
// socket is listening (so tests can wait for it). Runs until `stop` becomes true.
// Returns 0 on a clean stop, non-zero if the socket could not be set up.
int runServer(Context& ctx, int port, std::atomic<int>* boundPort, std::atomic<bool>* stop);

}  // namespace bw
