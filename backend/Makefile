CXX      ?= g++
CXXFLAGS ?= -O2 -std=c++17 -Wall -Wextra -pthread
SRC_DIR  := src
OBJ_DIR  := build/obj
LIB_SRC  := $(filter-out $(SRC_DIR)/main.cpp,$(wildcard $(SRC_DIR)/*.cpp))
LIB_OBJ  := $(patsubst $(SRC_DIR)/%.cpp,$(OBJ_DIR)/%.o,$(LIB_SRC))
HEADERS  := $(wildcard $(SRC_DIR)/*.hpp)

all: build/basketwise-server build/run_tests

build/basketwise-server: $(LIB_OBJ) $(OBJ_DIR)/main.o
	$(CXX) $(CXXFLAGS) -o $@ $^

build/run_tests: $(LIB_OBJ) $(wildcard tests/*.cpp) $(wildcard tests/*.hpp) $(HEADERS)
	$(CXX) $(CXXFLAGS) -I$(SRC_DIR) -Itests -o $@ $(wildcard tests/*.cpp) $(LIB_OBJ)

$(OBJ_DIR)/%.o: $(SRC_DIR)/%.cpp $(HEADERS)
	@mkdir -p $(OBJ_DIR)
	$(CXX) $(CXXFLAGS) -c -o $@ $<

test: build/run_tests
	cd .. && backend/build/run_tests

run: build/basketwise-server
	cd build && ./basketwise-server --port 8080 --data ../../data/store.json

clean:
	rm -rf build

.PHONY: all test run clean
