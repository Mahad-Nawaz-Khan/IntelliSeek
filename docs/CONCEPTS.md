# IntelliSeek — Core Concepts (DSA & AI)

Purpose
-------

This document summarizes the core data-structures, algorithms, and AI concepts used across IntelliSeek. It is a compact reference for engineers, reviewers, and contributors who need a concept-first understanding of how retrieval, indexing, and autocomplete features are designed and tuned.

Retrieval pipeline (high-level)
--------------------------------

1. Ingest: upload documents and files.
2. Chunk: split large documents into semantically useful passages.
3. Embed: convert chunks into fixed-size numeric vectors using an embedding model.
4. Index: store vectors in an index (ANN or exact) for fast nearest-neighbor lookup.
5. Retrieve: given a query, compute its embedding and run an ANN search to return top-k candidate chunks.
6. Re-rank & synthesize: optionally re-rank candidates (cross-encoder or LLM) and generate final responses.

Key concepts covered in this repo
---------------------------------

- Vector search and ANN (approximate nearest neighbor) search
- HNSW (Hierarchical Navigable Small World) indexing
- Chunking strategies and tradeoffs for embeddings
- Trie-based autocomplete for prefix / exact-match suggestions
- Similarity metrics (cosine, dot-product, L2) and normalization
- Index types (flat exact, IVF+PQ, HNSW, Annoy, NMSLIB)
- Retrieval evaluation: recall@k, MRR, NDCG

When to use which structure (short guide)
-----------------------------------------

- Small datasets (<100k vectors): brute-force / flat search (exact) may be fine.
- Medium-to-large collections: HNSW or IVF+PQ for ANN search — HNSW is a great default for low-latency similarity.
- High-throughput read-only deployments: consider building indexes offline with optimized libraries (FAISS, HNSWLIB).
- Autocomplete and prefix search: tries (or compressed tries) are optimal for deterministic prefix queries; add ranking signals (frequency, recency, embeddings) for relevance.

Links
-----

- HNSW deep-dive: [docs/HNSW.md](HNSW.md)
- Vector search fundamentals: [docs/VECTOR_SEARCH.md](VECTOR_SEARCH.md)
- Trie autocomplete: [docs/TRIE_AUTOCOMPLETE.md](TRIE_AUTOCOMPLETE.md)
- Chunking & embedding pipeline: [docs/CHUNKING.md](CHUNKING.md)
- Developer guide & code mapping: [docs/DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)
# IntelliSeek — Concepts & Overview

This document is the central index for conceptual and developer-facing documentation for the IntelliSeek project. It collects short explanations of the key algorithms and system concepts used by the codebase and links to deeper topic pages.

Quick navigation

- HNSW (approximate nearest neighbours): [docs/HNSW.md](docs/HNSW.md)
- Vector search & ANN: [docs/VECTOR_SEARCH.md](docs/VECTOR_SEARCH.md)
- Trie autocomplete: [docs/TRIE_AUTOCOMPLETE.md](docs/TRIE_AUTOCOMPLETE.md)
- Chunking & vectorization: [docs/CHUNKING.md](docs/CHUNKING.md)
- Developer guide + implementation map: [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md)
- Usage & examples: [docs/USAGE.md](docs/USAGE.md)

High-level summary

IntelliSeek combines classic data-structure techniques with modern vector search to support fast, relevant retrieval over uploaded documents and user queries. The main components are:

- Ingest pipeline: file parsing, chunking, metadata extraction, and embedding generation.
- Vector index: an ANN index (HNSW) to enable low-latency nearest-neighbour search over embeddings.
- Reranking / hybrid search: optional lexical or cross-encoder reranking to increase precision.
- Autocomplete / UI helpers: efficient prefix search (trie) and client-side suggestions.

Why these pages matter

The algorithm pages explain the design choices, trade-offs, and tuning knobs you will need when building, tuning, or debugging retrieval features. The developer guide maps concepts to repository files so you can find the code that implements each stage.

Next steps

- Read the HNSW and Vector Search pages when you need to tune search quality or memory/performance trade-offs.
- Read the Chunking page when adjusting how documents are segmented for embedding.
- Read the Trie page for UI search and autocomplete improvements.

If you want runnable examples (index builder, search CLI, benchmark harness), say so and I'll add them under `docs/examples/`.
