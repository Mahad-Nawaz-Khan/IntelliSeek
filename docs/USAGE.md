# Usage Examples & Tutorials

This page contains short tutorials and commands for running common tasks locally and understanding the system's behavior.

Index builder (example)
-----------------------

An example script to build a vector index from local files:

```bash
# from repository root
node scripts/build-index.js --input ./data --out ./indexes/main.index
```

Search CLI (example)
---------------------

```bash
node scripts/search.js --index ./indexes/main.index --query "What is HNSW?" --k 10
```

Notebook and experiments
------------------------

- Use small-scale experiments to measure recall@k for different `ef`/`M` combinations.
- Run offline benchmarks by sampling queries and comparing results to an exact brute-force index.

If you'd like, I can add runnable example scripts under `scripts/` and a minimal `notebooks/` folder with starter analyses.
