# IntelliSeek

IntelliSeek is a document ingestion and semantic search project that combines classical data structures and modern vector search techniques to provide fast, relevant retrieval over user-uploaded documents.

Highlights
----------

- Ingest pipeline: parsing, chunking, metadata extraction, and embedding generation.
- Vector search: ANN indexing (HNSW) for low-latency similarity search.
- Autocomplete: trie-based prefix lookup for fast UI suggestions.
- Hybrid retrieval: combine lexical and semantic signals for improved precision.

Quick start
-----------

1. Start the frontend (Next.js):

```bash
cd frontend
npm install
npm run dev
```

2. See `docs/` for conceptual pages, API reference, and developer instructions.

Documentation
-------------

- **Concepts**: [docs/CONCEPTS.md](docs/CONCEPTS.md)
- **HNSW deep-dive**: [docs/HNSW.md](docs/HNSW.md)
- **Vector search**: [docs/VECTOR_SEARCH.md](docs/VECTOR_SEARCH.md)
- **Trie autocomplete**: [docs/TRIE_AUTOCOMPLETE.md](docs/TRIE_AUTOCOMPLETE.md)
- **Chunking & vectorization**: [docs/CHUNKING.md](docs/CHUNKING.md)
- **Developer guide**: [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md)
- **API reference**: [docs/API.md](docs/API.md)
- **Algorithms & math**: [docs/ALGORITHMS.md](docs/ALGORITHMS.md)
- **Usage examples**: [docs/USAGE.md](docs/USAGE.md) and [docs/EXAMPLES.md](docs/EXAMPLES.md)

Contributing
------------

- Create a branch `feature/<name>` and open a PR.
- Update or add a `docs/` page when changing algorithms or parameters.

If you want runnable example notebooks, benchmarks, or CI docs validation, say which ones and I'll add them.
