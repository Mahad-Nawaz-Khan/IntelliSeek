# Chunking & Vectorization Guide

Purpose
-------

Chunking is the process of splitting documents into passages (chunks) that are semantically coherent and appropriate for embedding and retrieval. Proper chunking balances context (longer chunks) against focus (shorter chunks) and has a strong impact on retrieval quality.

Common strategies
-----------------

- Fixed-size token/window splits: split by tokens with fixed stride and overlap. Simple and reproducible.
- Sentence/paragraph-aware splits: split along sentence or paragraph boundaries for better semantic integrity.
- Hybrid: split by paragraph but break long paragraphs into fixed windows with overlap.

Overlap
-------

Use overlap (stride) to reduce information loss at chunk boundaries. Typical overlaps are 10–50% depending on chunk size.

Chunk size choices
------------------

- Short chunks (64–256 tokens): better for precise retrieval for short answers; more vectors, higher cost.
- Medium chunks (256–512 tokens): good default for balanced retrieval.
- Long chunks (>512 tokens): fewer vectors, better for long context but may dilute fine-grained relevance.

Metadata and provenance
-----------------------

Keep metadata with each chunk: document id, chunk index, original offsets, filename, and any extracted entities. This is essential for reconstructing answer spans and for attribution.

Embedding model selection
-------------------------

- Choose embedding models that match your retrieval use-case (semantic search vs. topical clustering).
- Monitor embedding dimensionality and memory impacts when choosing storage/indexing backend.

Vectorization pipeline notes
---------------------------

1. Preprocess text (normalize whitespace, optionally remove boilerplate).
2. Chunk (with overlap if needed) preserving offsets.
3. Generate embeddings for each chunk.
4. Store embeddings and metadata in the vector index.

Evaluation
----------

Test different chunking sizes and overlaps by measuring retrieval metrics (recall@k) and downstream task performance (answer accuracy, hallucination rate).
