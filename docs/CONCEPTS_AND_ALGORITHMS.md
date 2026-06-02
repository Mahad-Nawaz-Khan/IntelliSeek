# IntelliSeek — Concepts & Algorithms

This consolidated document collects the core data-structure, algorithmic, and math concepts used in IntelliSeek. It replaces smaller topic fragments and groups retrieval, indexing, chunking, and autocomplete material into a single reference.

1. Retrieval pipeline (high-level)
---------------------------------

1. Ingest: upload documents and files.
2. Chunk: split large documents into semantically useful passages.
3. Embed: convert chunks into fixed-size numeric vectors using an embedding model.
4. Index: store vectors in an ANN or exact index for fast nearest-neighbor lookup.
5. Retrieve: given a query, compute its embedding and run a nearest-neighbor search to return top-k candidate chunks.
6. Re-rank & synthesize: optionally re-rank candidates (cross-encoder or LLM) and generate final responses.

2. Vector Search & ANN
-----------------------

Vector search retrieves items nearest to a query vector according to a similarity metric (cosine, dot product, or L2). Exact search compares a query against every vector; ANN algorithms trade a small amount of accuracy for large improvements in speed and memory.

Common ANN approaches

- Graph-based (HNSW): excellent default for balanced recall/latency.
- IVF + PQ (FAISS): compressed indexes for very large corpora.
- Tree-based (Annoy, KD-trees): simple, read-only indexes for small-medium sizes.

Similarity metrics

- Cosine similarity: use with normalized vectors.
- Dot product: often used by model vendors.
- L2 distance: Euclidean distance.

Evaluation metrics

- Recall@k, MRR, and NDCG are common retrieval metrics.

3. HNSW (Hierarchical Navigable Small World)
-------------------------------------------

HNSW is a graph-based ANN index that uses layered small-world graphs to support efficient greedy search. Key parameters:

- `M` — connectivity per node. Higher `M` → better recall, higher memory.
- `efConstruction` — candidate list size during indexing; higher values improve index quality.
- `ef` — search-time candidate list size; tune for latency vs recall.

Practical defaults: `M=16`, `efConstruction=200`; tune `ef` at query time.

4. Chunking & Vectorization
---------------------------

Chunking splits text into passages appropriate for embedding. Strategies:

- Fixed-size windows with overlap (stride).
- Sentence/paragraph-aware splits.
- Hybrid: paragraph-aware with windowing on long blocks.

Tradeoffs:

- Short chunks: better precision, more vectors (higher cost).
- Long chunks: fewer vectors, more context but lower precision.

Overlap is recommended (10–50%). Store provenance metadata (document id, offsets, chunk index) for reconstruction and citations.

5. Trie Autocomplete & Prefix Search
-----------------------------------

Tries store prefixes for O(m) search (m = prefix length). Variants: compressed/radix tries, ternary search trees. Tries are deterministic; attach frequency/recency signals or rerank by embedding similarity for relevance.

6. Algorithms & Math Notes
--------------------------

Cosine similarity:

$$
\text{cosine}(a, b) = \frac{a \cdot b}{\|a\| \, \|b\|}
$$

For normalized vectors, maximizing dot product equals maximizing cosine similarity.

Dot product: $a \cdot b$.

L2 distance: $\|a - b\|_2$.

Evaluation metrics recap:

- Recall@k: fraction of true neighbors in top-k.
- MRR: $\frac{1}{Q} \sum_{i=1}^Q \frac{1}{\text{rank}_i}$.

7. Deployment and Scaling Notes
-------------------------------

- For small datasets (<100k vectors) brute-force may suffice.
- For production-scale datasets, prefer optimized native index libraries (FAISS, HNSWLIB) and sharding/replication.
- Co-locating vectors with metadata (e.g., `pgvector`) simplifies access control and simplifies QA of results.

8. Glossary
-----------

- ANN: Approximate Nearest Neighbor
- HNSW: Hierarchical Navigable Small World
- ef: HNSW search-time candidate list parameter
- M: HNSW connectivity
- PQ: Product Quantization

References and further reading
------------------------------

- Malkov & Yashunin — Efficient and robust ANN using HNSW (2018)
- HNSWLIB: https://github.com/nmslib/hnswlib
- FAISS: https://github.com/facebookresearch/faiss
