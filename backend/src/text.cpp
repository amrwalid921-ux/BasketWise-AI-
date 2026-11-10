#include "text.hpp"

namespace bw {

CodePoints decodeUtf8(const std::string& s) {
    CodePoints out;
    out.reserve(s.size());
    size_t i = 0, n = s.size();
    while (i < n) {
        unsigned char c = (unsigned char)s[i];
        uint32_t cp = 0;
        int extra = 0;
        if (c < 0x80) { cp = c; }
        else if ((c >> 5) == 0x6) { cp = c & 0x1F; extra = 1; }
        else if ((c >> 4) == 0xE) { cp = c & 0x0F; extra = 2; }
        else if ((c >> 3) == 0x1E) { cp = c & 0x07; extra = 3; }
        else { cp = 0xFFFD; }
        if (extra && i + extra >= n) { out.push_back(0xFFFD); break; }  // truncated sequence
        for (int k = 1; k <= extra; k++) cp = (cp << 6) | ((unsigned char)s[i + k] & 0x3F);
        out.push_back(cp);
        i += 1 + extra;
    }
    return out;
}

std::string encodeUtf8(const CodePoints& cps) {
    std::string s;
    for (uint32_t cp : cps) {
        if (cp < 0x80) s += (char)cp;
        else if (cp < 0x800) { s += (char)(0xC0 | (cp >> 6)); s += (char)(0x80 | (cp & 0x3F)); }
        else if (cp < 0x10000) { s += (char)(0xE0 | (cp >> 12)); s += (char)(0x80 | ((cp >> 6) & 0x3F)); s += (char)(0x80 | (cp & 0x3F)); }
        else { s += (char)(0xF0 | (cp >> 18)); s += (char)(0x80 | ((cp >> 12) & 0x3F)); s += (char)(0x80 | ((cp >> 6) & 0x3F)); s += (char)(0x80 | (cp & 0x3F)); }
    }
    return s;
}

CodePoints normalizeCps(const std::string& s) {
    CodePoints in = decodeUtf8(s), out;
    out.reserve(in.size());
    bool pendingSpace = false;
    for (uint32_t c : in) {
        // Arabic diacritics / tatweel: drop
        if ((c >= 0x064B && c <= 0x065F) || c == 0x0670 || c == 0x0640) continue;
        if (c >= 'A' && c <= 'Z') c = c - 'A' + 'a';
        else if (c == 0x0623 || c == 0x0625 || c == 0x0622 || c == 0x0671) c = 0x0627;  // alef variants
        else if (c == 0x0649) c = 0x064A;                                              // alef maqsura
        else if (c == 0x0629) c = 0x0647;                                              // ta marbuta
        else if (c >= 0x0660 && c <= 0x0669) c = '0' + (c - 0x0660);                   // Arabic-Indic digits
        else if (c >= 0x06F0 && c <= 0x06F9) c = '0' + (c - 0x06F0);
        bool isSpace = (c == ' ' || c == '\t' || c == '\n' || c == '\r');
        bool isPunct = (c < 0x80) && !(c >= 'a' && c <= 'z') && !(c >= '0' && c <= '9') && !isSpace;
        if (c == 0x060C || c == 0x061F || c == 0x061B) isPunct = true;  // Arabic comma / ? / ;
        if (isSpace || isPunct) { pendingSpace = true; continue; }
        if (pendingSpace && !out.empty()) out.push_back(' ');
        pendingSpace = false;
        out.push_back(c);
    }
    return out;
}

std::string normalize(const std::string& s) { return encodeUtf8(normalizeCps(s)); }

std::vector<CodePoints> splitWords(const CodePoints& cps) {
    std::vector<CodePoints> words;
    CodePoints cur;
    for (uint32_t c : cps) {
        if (c == ' ') { if (!cur.empty()) { words.push_back(cur); cur.clear(); } }
        else cur.push_back(c);
    }
    if (!cur.empty()) words.push_back(cur);
    return words;
}

std::string urlDecode(const std::string& s) {
    std::string out;
    for (size_t i = 0; i < s.size(); i++) {
        char c = s[i];
        if (c == '+') out += ' ';
        else if (c == '%' && i + 2 < s.size()) {
            auto hv = [](char h) -> int {
                if (h >= '0' && h <= '9') return h - '0';
                if (h >= 'a' && h <= 'f') return h - 'a' + 10;
                if (h >= 'A' && h <= 'F') return h - 'A' + 10;
                return -1;
            };
            int a = hv(s[i + 1]), b = hv(s[i + 2]);
            if (a >= 0 && b >= 0) { out += (char)(a * 16 + b); i += 2; }
            else out += c;
        } else out += c;
    }
    return out;
}

}  // namespace bw
