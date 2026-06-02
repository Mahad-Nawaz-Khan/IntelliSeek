# Vector Search & Approximate Nearest Neighbors (ANN)

Introduction
------------

Vector search retrieves items (documents, chunks, or embeddings) nearest to a query vector according to a similarity metric (e.g., cosine similarity, dot product, or Euclidean distance). Exact nearest neighbor search compares a query against every vector — this is simple but scales poorly. ANN algorithms trade a small amount of accuracy for large improvements in speed and memory.

Similarity metrics
------------------

- Cosine similarity: measures the angle between vectors; effective when only direction matters. To use with dot-product based indexes, normalize vectors.
- Dot product: often used with dense models and can incorporate vector magnitude.
- L2 (Euclidean) distance: sensitive to magnitude and scale.

ANN approaches
--------------

- Graph-based (HNSW): clean trade-off between recall and latency; great default choice.
- IVF + PQ (FAISS): inverted file with product quantization — useful when memory footprint must be minimized for very large corpora.
- Tree-based (Annoy, KD-trees): simpler, useful for read-only indexes and smaller dimensionalities.

Evaluation and metrics
----------------------

- Recall@k: fraction of true nearest neighbors found in top-k results.
- MRR (Mean Reciprocal Rank): average of reciprocal ranks for queries with a single correct answer.
- NDCG: normalized discounted cumulative gain for graded relevance judgments.

Scaling and production
----------------------

- For datasets up to a few hundred thousand vectors, HNSW on CPU is often sufficient.
- For tens of millions of vectors, use FAISS with IVF+PQ on GPU for both speed and compactness.
- Use sharding, replication, and persisted index files for production reliability and fast restarts.

Hybrid retrieval
----------------

Combine lexical (BM25) or term-matching signals with vector search for better precision on short queries or when exact matches are important. Common patterns:

- Score fusion: combine normalized lexical score and vector similarity.
- Reranking: get top-N candidates from ANN, then rerank with a cross-encoder or exact similarity for higher precision.

Practical tips
--------------

- Normalize vectors once at insert time for cosine similarity searches.
- Cache top-k results for hot queries.
- Monitor recall/latency as you tune `ef`, `M`, and quantization levels.
