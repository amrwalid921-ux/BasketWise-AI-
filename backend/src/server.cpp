#include "server.hpp"
#include <arpa/inet.h>
#include <cstdio>
#include <cstring>
#include <netinet/in.h>
#include <signal.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <thread>
#include <unistd.h>

namespace bw {

namespace {

const size_t MAX_BODY = 1 << 20;     // 1 MB
const size_t MAX_HEADER = 64 * 1024;

bool sendAll(int fd, const char* data, size_t len) {
    size_t off = 0;
    while (off < len) {
        ssize_t n = send(fd, data + off, len - off, MSG_NOSIGNAL);
        if (n <= 0) return false;
        off += (size_t)n;
    }
    return true;
}

const char* statusText(int s) {
    switch (s) {
        case 200: return "OK";
        case 204: return "No Content";
        case 400: return "Bad Request";
        case 404: return "Not Found";
        case 405: return "Method Not Allowed";
        case 413: return "Payload Too Large";
        default: return "Internal Server Error";
    }
}

void respond(int fd, const HttpResponse& r) {
    std::string head = "HTTP/1.1 " + std::to_string(r.status) + " " + statusText(r.status) + "\r\n";
    head += "Content-Type: " + r.contentType + "\r\n";
    head += "Content-Length: " + std::to_string(r.body.size()) + "\r\n";
    head += "Access-Control-Allow-Origin: *\r\n";
    head += "Access-Control-Allow-Methods: GET,POST,OPTIONS\r\n";
    head += "Access-Control-Allow-Headers: Content-Type\r\n";
    head += "Connection: close\r\n\r\n";
    if (!sendAll(fd, head.data(), head.size())) return;
    if (!r.body.empty()) sendAll(fd, r.body.data(), r.body.size());
}

HttpResponse errorResponse(int status, const std::string& msg) {
    HttpResponse r;
    r.status = status;
    r.body = "{\"error\":\"" + msg + "\"}";
    return r;
}

std::string lower(std::string s) {
    for (size_t i = 0; i < s.size(); i++) if (s[i] >= 'A' && s[i] <= 'Z') s[i] = (char)(s[i] - 'A' + 'a');
    return s;
}

void handleConnection(Context* ctx, int fd) {
    struct timeval tv; tv.tv_sec = 10; tv.tv_usec = 0;
    setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof tv);
    std::string buf;
    char tmp[8192];
    size_t headEnd = std::string::npos;
    while (headEnd == std::string::npos) {
        ssize_t n = recv(fd, tmp, sizeof tmp, 0);
        if (n <= 0) { close(fd); return; }
        buf.append(tmp, (size_t)n);
        headEnd = buf.find("\r\n\r\n");
        if (buf.size() > MAX_HEADER && headEnd == std::string::npos) { respond(fd, errorResponse(400, "headers too large")); close(fd); return; }
    }
    std::string head = buf.substr(0, headEnd);
    size_t lineEnd = head.find("\r\n");
    std::string reqLine = head.substr(0, lineEnd == std::string::npos ? head.size() : lineEnd);
    HttpRequest req;
    size_t sp1 = reqLine.find(' '), sp2 = reqLine.find(' ', sp1 == std::string::npos ? 0 : sp1 + 1);
    if (sp1 == std::string::npos || sp2 == std::string::npos) { respond(fd, errorResponse(400, "bad request line")); close(fd); return; }
    req.method = reqLine.substr(0, sp1);
    std::string target = reqLine.substr(sp1 + 1, sp2 - sp1 - 1);
    size_t qm = target.find('?');
    req.path = target.substr(0, qm);
    if (qm != std::string::npos) req.query = target.substr(qm + 1);

    size_t contentLength = 0;
    bool expectContinue = false;
    size_t pos = lineEnd == std::string::npos ? head.size() : lineEnd + 2;
    while (pos < head.size()) {
        size_t e = head.find("\r\n", pos);
        if (e == std::string::npos) e = head.size();
        std::string line = head.substr(pos, e - pos);
        size_t colon = line.find(':');
        if (colon != std::string::npos && lower(line.substr(0, colon)) == "content-length") {
            contentLength = (size_t)strtoull(line.c_str() + colon + 1, nullptr, 10);
        }
        if (colon != std::string::npos && lower(line.substr(0, colon)) == "expect" && lower(line).find("100-continue") != std::string::npos) expectContinue = true;
        pos = e + 2;
    }
    if (expectContinue && contentLength <= MAX_BODY && buf.size() - (headEnd + 4) < contentLength) {
        static const char cont[] = "HTTP/1.1 100 Continue\r\n\r\n";
        sendAll(fd, cont, sizeof cont - 1);
    }
    if (contentLength > MAX_BODY) { respond(fd, errorResponse(413, "body too large")); close(fd); return; }
    std::string body = buf.substr(headEnd + 4);
    while (body.size() < contentLength) {
        ssize_t n = recv(fd, tmp, sizeof tmp, 0);
        if (n <= 0) break;
        body.append(tmp, (size_t)n);
    }
    if (body.size() > contentLength) body.resize(contentLength);
    req.body = body;

    HttpResponse res;
    try { res = handleRequest(*ctx, req); }
    catch (const std::exception& ex) { res = errorResponse(500, std::string("internal error: ") + ex.what()); }
    respond(fd, res);
    close(fd);
}

}  // namespace

int runServer(Context& ctx, int port, std::atomic<int>* boundPort, std::atomic<bool>* stop) {
    signal(SIGPIPE, SIG_IGN);
    int lfd = socket(AF_INET, SOCK_STREAM, 0);
    if (lfd < 0) return 1;
    int one = 1;
    setsockopt(lfd, SOL_SOCKET, SO_REUSEADDR, &one, sizeof one);
    sockaddr_in addr;
    memset(&addr, 0, sizeof addr);
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_ANY);
    addr.sin_port = htons((uint16_t)port);
    if (bind(lfd, (sockaddr*)&addr, sizeof addr) != 0) { perror("bind"); close(lfd); return 2; }
    if (listen(lfd, 128) != 0) { perror("listen"); close(lfd); return 3; }
    socklen_t len = sizeof addr;
    getsockname(lfd, (sockaddr*)&addr, &len);
    if (boundPort) boundPort->store(ntohs(addr.sin_port));
    while (!stop || !stop->load()) {
        int cfd = accept(lfd, nullptr, nullptr);
        if (cfd < 0) continue;
        if (stop && stop->load()) { close(cfd); break; }
        std::thread(handleConnection, &ctx, cfd).detach();
    }
    close(lfd);
    return 0;
}

}  // namespace bw
