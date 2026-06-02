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

- Read the consolidated documentation index: [docs/README.md](docs/README.md)


Contributing
------------

- Create a branch `feature/<name>` and open a PR.
- Update or add a `docs/` page when changing algorithms or parameters.

If you want runnable example notebooks, benchmarks, or CI docs validation, say which ones and I'll add them.
