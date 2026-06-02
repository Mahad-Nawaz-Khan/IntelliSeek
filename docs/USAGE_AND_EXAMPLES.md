# Usage & Examples

This consolidated page contains runnable examples, CLI snippets, and experiment ideas.

Index builder example
---------------------

Create a simple script under `scripts/` to generate embeddings and build an index:

```bash
# from repository root
node scripts/build-index.js --input ./data --out ./indexes/main.index
```

Search CLI example
------------------

```bash
node scripts/search.js --index ./indexes/main.index --query "What is HNSW?" --k 10
```

Benchmark ideas
---------------

- Parameter sweep for `ef` and `M` to measure recall@k and latency.
- Compare `pgvector` + HNSW against a local FAISS index for the same data sample.

Notebooks and experiments
-------------------------

- Add `notebooks/benchmark.ipynb` for plots and metric analyses.

Planned scripts
---------------

- `scripts/build-index.js` — build index from local files.
- `scripts/search.js` — simple CLI search against an index.
- `scripts/benchmark.js` — run recall/latency experiments.
