// json.hpp - a small from-scratch JSON library.
//   * Json        : DOM value + recursive-descent parser (RFC 8259: \uXXXX incl. surrogate pairs).
//   * JsonWriter  : streaming writer used for big responses (no intermediate DOM, appends to one string).
#pragma once
#include <string>
#include <utility>
#include <vector>
#include <stdexcept>

namespace bw {

struct JsonError : std::runtime_error {
    explicit JsonError(const std::string& m) : std::runtime_error(m) {}
};

struct Json {
    enum Type { Null, Bool, Number, String, Array, Object };
    Type type = Null;
    bool b = false;
    double n = 0;
    std::string s;
    std::vector<Json> a;
    std::vector<std::pair<std::string, Json>> o;  // insertion ordered

    Json() {}
    static Json null() { return Json(); }
    static Json boolean(bool v) { Json j; j.type = Bool; j.b = v; return j; }
    static Json number(double v) { Json j; j.type = Number; j.n = v; return j; }
    static Json string(const std::string& v) { Json j; j.type = String; j.s = v; return j; }
    static Json array() { Json j; j.type = Array; return j; }
    static Json object() { Json j; j.type = Object; return j; }

    bool isNull() const { return type == Null; }
    bool isBool() const { return type == Bool; }
    bool isNumber() const { return type == Number; }
    bool isString() const { return type == String; }
    bool isArray() const { return type == Array; }
    bool isObject() const { return type == Object; }

    // Object access. get() returns nullptr when missing / not an object.
    const Json* get(const std::string& key) const;
    // Insert or replace a key (objects only).
    Json& set(const std::string& key, const Json& v);
    // Append (arrays only).
    Json& push(const Json& v) { a.push_back(v); return *this; }

    // Convenience getters with defaults (wrong type => default).
    double getNum(const std::string& key, double def) const;
    std::string getStr(const std::string& key, const std::string& def) const;
    bool getBool(const std::string& key, bool def) const;

    static Json parse(const std::string& text);  // throws JsonError
    std::string dump() const;                    // compact serialisation
    void dumpTo(std::string& out) const;
};

// Number formatting used by both dump() and JsonWriter (integers without ".0", shortest round-trip doubles).
void appendNumber(std::string& out, double v);
// Fixed number of decimals, trailing zeros trimmed (e.g. 71.20 -> 71.2).
void appendRounded(std::string& out, double v, int decimals);
// JSON string literal with escaping.
void appendQuoted(std::string& out, const std::string& s);

class JsonWriter {
public:
    JsonWriter() { out.reserve(4096); }
    JsonWriter& beginObject() { sep(); out += '{'; stack.push_back(true); return *this; }
    JsonWriter& endObject() { out += '}'; stack.pop_back(); return *this; }
    JsonWriter& beginArray() { sep(); out += '['; stack.push_back(true); return *this; }
    JsonWriter& endArray() { out += ']'; stack.pop_back(); return *this; }
    JsonWriter& key(const std::string& k) { sep(); appendQuoted(out, k); out += ':'; afterKey = true; return *this; }
    JsonWriter& str(const std::string& v) { sep(); appendQuoted(out, v); return *this; }
    JsonWriter& num(double v) { sep(); appendNumber(out, v); return *this; }
    JsonWriter& num(double v, int decimals) { sep(); appendRounded(out, v, decimals); return *this; }
    JsonWriter& integer(long long v) { sep(); out += std::to_string(v); return *this; }
    JsonWriter& boolean(bool v) { sep(); out += v ? "true" : "false"; return *this; }
    JsonWriter& null() { sep(); out += "null"; return *this; }
    JsonWriter& raw(const std::string& pre) { sep(); out += pre; return *this; }
    // key + value shortcuts
    JsonWriter& kv(const std::string& k, const std::string& v) { return key(k).str(v); }
    JsonWriter& kv(const std::string& k, const char* v) { return key(k).str(v); }
    JsonWriter& kvInt(const std::string& k, long long v) { return key(k).integer(v); }
    JsonWriter& kvNum(const std::string& k, double v, int decimals) { return key(k).num(v, decimals); }
    JsonWriter& kvBool(const std::string& k, bool v) { return key(k).boolean(v); }
    // [x,y]
    JsonWriter& cell(int x, int y) { beginArray(); integer(x); integer(y); return endArray(); }
    std::string& result() { return out; }

private:
    std::string out;
    std::vector<bool> stack;  // per open container: true = no element written yet
    bool afterKey = false;
    void sep() {
        if (afterKey) { afterKey = false; return; }
        if (!stack.empty()) {
            if (stack.back()) stack.back() = false; else out += ',';
        }
    }
};

}  // namespace bw
