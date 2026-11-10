#include "json.hpp"
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>

namespace bw {

const Json* Json::get(const std::string& key) const {
    if (type != Object) return nullptr;
    for (size_t i = 0; i < o.size(); i++) if (o[i].first == key) return &o[i].second;
    return nullptr;
}
Json& Json::set(const std::string& key, const Json& v) {
    type = Object;
    for (size_t i = 0; i < o.size(); i++) if (o[i].first == key) { o[i].second = v; return *this; }
    o.push_back(std::make_pair(key, v));
    return *this;
}
double Json::getNum(const std::string& key, double def) const {
    const Json* j = get(key); return (j && j->isNumber()) ? j->n : def;
}
std::string Json::getStr(const std::string& key, const std::string& def) const {
    const Json* j = get(key); return (j && j->isString()) ? j->s : def;
}
bool Json::getBool(const std::string& key, bool def) const {
    const Json* j = get(key); return (j && j->isBool()) ? j->b : def;
}

// ---------------------------------------------------------------- number / string output
void appendNumber(std::string& out, double v) {
    if (!std::isfinite(v)) { out += "null"; return; }
    if (v == std::floor(v) && std::fabs(v) < 1e15) { out += std::to_string((long long)v); return; }
    char buf[40];
    snprintf(buf, sizeof buf, "%.15g", v);
    if (strtod(buf, nullptr) != v) snprintf(buf, sizeof buf, "%.17g", v);  // not round-trippable: more digits
    out += buf;
}
void appendRounded(std::string& out, double v, int decimals) {
    if (!std::isfinite(v)) { out += "null"; return; }
    char buf[64];
    snprintf(buf, sizeof buf, "%.*f", decimals, v);
    size_t len = strlen(buf);
    if (strchr(buf, '.')) {
        while (len > 0 && buf[len - 1] == '0') len--;
        if (len > 0 && buf[len - 1] == '.') len--;
    }
    buf[len] = 0;
    if (strcmp(buf, "-0") == 0) strcpy(buf, "0");
    out += buf;
}
void appendQuoted(std::string& out, const std::string& s) {
    out += '"';
    for (size_t i = 0; i < s.size(); i++) {
        unsigned char c = (unsigned char)s[i];
        switch (c) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            case '\b': out += "\\b"; break;
            case '\f': out += "\\f"; break;
            default:
                if (c < 0x20) { char b[8]; snprintf(b, sizeof b, "\\u%04x", c); out += b; }
                else out += (char)c;  // UTF-8 bytes are copied verbatim
        }
    }
    out += '"';
}

void Json::dumpTo(std::string& out) const {
    switch (type) {
        case Null: out += "null"; break;
        case Bool: out += b ? "true" : "false"; break;
        case Number: appendNumber(out, n); break;
        case String: appendQuoted(out, s); break;
        case Array:
            out += '[';
            for (size_t i = 0; i < a.size(); i++) { if (i) out += ','; a[i].dumpTo(out); }
            out += ']';
            break;
        case Object:
            out += '{';
            for (size_t i = 0; i < o.size(); i++) {
                if (i) out += ',';
                appendQuoted(out, o[i].first); out += ':'; o[i].second.dumpTo(out);
            }
            out += '}';
            break;
    }
}
std::string Json::dump() const { std::string r; dumpTo(r); return r; }

// ---------------------------------------------------------------- parser
namespace {
struct Parser {
    const char* p; const char* end; const char* begin;
    int depth = 0;
    [[noreturn]] void fail(const std::string& m) {
        throw JsonError(m + " at offset " + std::to_string(p - begin));
    }
    void ws() { while (p < end && (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r')) p++; }
    bool lit(const char* w) {
        size_t n = strlen(w);
        if ((size_t)(end - p) >= n && memcmp(p, w, n) == 0) { p += n; return true; }
        return false;
    }
    static void putUtf8(std::string& s, unsigned cp) {
        if (cp < 0x80) s += (char)cp;
        else if (cp < 0x800) { s += (char)(0xC0 | (cp >> 6)); s += (char)(0x80 | (cp & 0x3F)); }
        else if (cp < 0x10000) { s += (char)(0xE0 | (cp >> 12)); s += (char)(0x80 | ((cp >> 6) & 0x3F)); s += (char)(0x80 | (cp & 0x3F)); }
        else { s += (char)(0xF0 | (cp >> 18)); s += (char)(0x80 | ((cp >> 12) & 0x3F)); s += (char)(0x80 | ((cp >> 6) & 0x3F)); s += (char)(0x80 | (cp & 0x3F)); }
    }
    unsigned hex4() {
        if (end - p < 4) fail("bad \\u escape");
        unsigned v = 0;
        for (int i = 0; i < 4; i++) {
            char c = *p++; v <<= 4;
            if (c >= '0' && c <= '9') v |= c - '0';
            else if (c >= 'a' && c <= 'f') v |= c - 'a' + 10;
            else if (c >= 'A' && c <= 'F') v |= c - 'A' + 10;
            else fail("bad hex digit");
        }
        return v;
    }
    std::string str() {  // p is after the opening quote
        std::string r;
        while (true) {
            if (p >= end) fail("unterminated string");
            unsigned char c = (unsigned char)*p++;
            if (c == '"') return r;
            if (c < 0x20) fail("control character in string");
            if (c != '\\') { r += (char)c; continue; }
            if (p >= end) fail("unterminated escape");
            char e = *p++;
            switch (e) {
                case '"': r += '"'; break;
                case '\\': r += '\\'; break;
                case '/': r += '/'; break;
                case 'b': r += '\b'; break;
                case 'f': r += '\f'; break;
                case 'n': r += '\n'; break;
                case 'r': r += '\r'; break;
                case 't': r += '\t'; break;
                case 'u': {
                    unsigned cp = hex4();
                    if (cp >= 0xD800 && cp <= 0xDBFF) {
                        if (end - p >= 6 && p[0] == '\\' && p[1] == 'u') {
                            p += 2;
                            unsigned lo = hex4();
                            if (lo < 0xDC00 || lo > 0xDFFF) fail("bad low surrogate");
                            cp = 0x10000 + ((cp - 0xD800) << 10) + (lo - 0xDC00);
                        } else fail("lone high surrogate");
                    } else if (cp >= 0xDC00 && cp <= 0xDFFF) fail("lone low surrogate");
                    putUtf8(r, cp);
                    break;
                }
                default: fail("bad escape");
            }
        }
    }
    Json value() {
        ws();
        if (p >= end) fail("unexpected end of input");
        if (++depth > 200) fail("nesting too deep");
        Json j;
        char c = *p;
        if (c == '{') {
            p++; j = Json::object(); ws();
            if (p < end && *p == '}') p++;
            else while (true) {
                ws();
                if (p >= end || *p != '"') fail("expected object key");
                p++;
                std::string k = str();
                ws();
                if (p >= end || *p != ':') fail("expected ':'");
                p++;
                Json v = value();
                j.set(k, v);
                ws();
                if (p < end && *p == ',') { p++; continue; }
                if (p < end && *p == '}') { p++; break; }
                fail("expected ',' or '}'");
            }
        } else if (c == '[') {
            p++; j = Json::array(); ws();
            if (p < end && *p == ']') p++;
            else while (true) {
                j.a.push_back(value());
                ws();
                if (p < end && *p == ',') { p++; continue; }
                if (p < end && *p == ']') { p++; break; }
                fail("expected ',' or ']'");
            }
        } else if (c == '"') { p++; j = Json::string(str()); }
        else if (c == 't') { if (!lit("true")) fail("bad literal"); j = Json::boolean(true); }
        else if (c == 'f') { if (!lit("false")) fail("bad literal"); j = Json::boolean(false); }
        else if (c == 'n') { if (!lit("null")) fail("bad literal"); }
        else if (c == '-' || (c >= '0' && c <= '9')) {
            const char* st = p;
            if (*p == '-') p++;
            if (p >= end) fail("bad number");
            if (*p == '0') p++;
            else if (*p >= '1' && *p <= '9') while (p < end && *p >= '0' && *p <= '9') p++;
            else fail("bad number");
            if (p < end && *p == '.') {
                p++;
                if (p >= end || *p < '0' || *p > '9') fail("bad fraction");
                while (p < end && *p >= '0' && *p <= '9') p++;
            }
            if (p < end && (*p == 'e' || *p == 'E')) {
                p++;
                if (p < end && (*p == '+' || *p == '-')) p++;
                if (p >= end || *p < '0' || *p > '9') fail("bad exponent");
                while (p < end && *p >= '0' && *p <= '9') p++;
            }
            j = Json::number(strtod(std::string(st, p).c_str(), nullptr));
        } else fail(std::string("unexpected character '") + c + "'");
        depth--;
        return j;
    }
};
}  // namespace

Json Json::parse(const std::string& text) {
    Parser ps;
    ps.begin = text.data(); ps.p = text.data(); ps.end = text.data() + text.size();
    Json j = ps.value();
    ps.ws();
    if (ps.p != ps.end) ps.fail("trailing characters");
    return j;
}

}  // namespace bw
