// text.hpp - UTF-8 decoding + query normalisation (English + Arabic).
//
// Normalisation makes "عيش بلدى", "عَيْش بلدي" and "عيش  بلدي" identical, and "Milk" == "milk":
//   * ASCII letters lower-cased, ASCII punctuation (e.g. '-', '(' ) turned into spaces
//   * Arabic diacritics (tashkeel U+064B..U+065F, U+0670) and tatweel (U+0640) removed
//   * alef variants (أ إ آ ٱ) -> ا ; alef maqsura ى -> ي ; ta marbuta ة -> ه
//   * Arabic-Indic digits -> ASCII digits
//   * runs of whitespace collapsed, ends trimmed
#pragma once
#include <cstdint>
#include <string>
#include <vector>

namespace bw {

using CodePoints = std::vector<uint32_t>;

CodePoints decodeUtf8(const std::string& s);
std::string encodeUtf8(const CodePoints& cps);

CodePoints normalizeCps(const std::string& s);   // normalised code points
std::string normalize(const std::string& s);     // normalised UTF-8 string

// Split a normalised code-point sequence on spaces.
std::vector<CodePoints> splitWords(const CodePoints& cps);

// Percent-decoding for URL query strings ('+' -> space).
std::string urlDecode(const std::string& s);

}  // namespace bw
