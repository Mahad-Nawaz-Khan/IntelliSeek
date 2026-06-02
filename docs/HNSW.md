# HNSW (Hierarchical Navigable Small World) — Deep Dive

Overview
--------

HNSW is an approximate nearest neighbor (ANN) index structure designed for fast, accurate similarity search in high-dimensional vector spaces. It constructs a layered graph of proximity links that supports efficient greedy searches with logarithmic-like performance in practice.

Core ideas
----------

- Multi-layer graph: nodes are vectors; higher layers are sparser and connect long-range neighbors, while the bottom layer contains all nodes and supports fine-grained local search.
- Small-world property: long-range edges connect distant regions, enabling quick traversal across the space.
- Greedy search + ef parameter: start from an entry point at high layers and greedily descend to the bottom layer; `ef` controls the dynamic candidate list size and affects recall vs. latency.

Main parameters and tradeoffs
----------------------------

- M (connectivity): number of bi-directional links per node at each layer. Larger M improves recall but increases memory usage and build time.
- efConstruction: candidate list size during index construction; higher values yield better connectivity (and recall) but slower building.
- ef (search-time): controls the size of the dynamic candidate list when querying. Larger ef → higher recall and more CPU / memory during search.

Memory and complexity
---------------------

- Memory usage grows with `M` and number of vectors; each node stores `M` links per level.
- Build complexity is roughly O(n log n) depending on parameters and insertion ordering; bulk-build strategies can be faster.

When to prefer HNSW
--------------------

- When you need a high-recall ANN index with low latency on CPU.
- When you want incremental index updates (online insertions are supported).

Practical tips
--------------

- Start with M=16, efConstruction=200 for good defaults; tune ef at query time for latency/recall tradeoffs.
- If memory is a constraint, reduce M — but test recall impact.
- Use approximate normalization: for cosine similarity, normalize vectors once at insert/query time to convert to dot-product.

Integration notes
-----------------

IntelliSeek can use either external libraries (FAISS, HNSWLIB) or custom JS/TS bindings for HNSW. When integrating:

- Prefer native binaries (HNSWLIB, FAISS) for large datasets and production performance.
- Use pure-JS implementations for smaller datasets or environments where native builds are not feasible.

References
----------

- M. Malkov, D. Yashunin — "Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs" (2018).
- HNSWLIB: https://github.com/nmslib/hnswlib
- FAISS HNSW support: https://github.com/facebookresearch/faiss
