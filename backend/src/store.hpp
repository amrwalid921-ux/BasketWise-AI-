// store.hpp - the supermarket data model loaded from data/store.json.
#pragma once
#include <cstdint>
#include <string>
#include <vector>

namespace bw {

struct Category { std::string id, en, ar, color; };

struct Product {
    int id = 0;
    std::string sku, category, slug, en, ar;
    int price = 0;
    double rating = 0;
    int popularity = 0;
    int discount = 0;
    std::vector<std::string> tags;
    int pickupX = 0, pickupY = 0;   // walkable cell the shopper stands on
    int shelfX = 0, shelfY = 0;     // shelf cell
    std::string fixture, side;
    int slot = 0;
    bool hasTag(const std::string& t) const {
        for (size_t i = 0; i < tags.size(); i++) if (tags[i] == t) return true;
        return false;
    }
};

struct Store {
    int W = 0, H = 0;
    std::vector<uint8_t> cost;   // W*H, 0 = blocked, 1..9 = cost of entering the cell
    int entranceX = 0, entranceY = 0, checkoutX = 0, checkoutY = 0;
    std::vector<Category> categories;
    std::vector<Product> products;     // index i holds product with id == products[i].id
    std::vector<int> idToIndex;        // id -> index, -1 if absent (ids are small positive ints)
    std::string rawJson;               // the file, served verbatim by GET /api/store

    int cell(int x, int y) const { return y * W + x; }
    bool inside(int x, int y) const { return x >= 0 && y >= 0 && x < W && y < H; }
    bool walkable(int x, int y) const { return inside(x, y) && cost[y * W + x] != 0; }
    const Product* byId(int id) const {
        if (id < 0 || id >= (int)idToIndex.size() || idToIndex[id] < 0) return nullptr;
        return &products[idToIndex[id]];
    }
    int indexOf(int id) const {
        return (id < 0 || id >= (int)idToIndex.size()) ? -1 : idToIndex[id];
    }
    int categoryIndex(const std::string& id) const {
        for (size_t i = 0; i < categories.size(); i++) if (categories[i].id == id) return (int)i;
        return -1;
    }
};

// Loads and validates the store file. Returns false and fills `err` on failure.
bool loadStore(const std::string& path, Store& out, std::string& err);
bool loadStoreFromText(const std::string& text, Store& out, std::string& err);

}  // namespace bw
