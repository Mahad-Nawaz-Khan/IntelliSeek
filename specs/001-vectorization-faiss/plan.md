# Implementation Plan: Vectorization & FAISS Indexing Pipeline

**Branch**: `001-vectorization-faiss` | **Date**: 2026-05-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-vectorization-faiss/spec.md`

## Summary

Implement a backend data transformation and indexing pipeline that extends the existing document parse workflow: extracted text is normalized and chunked, chunks are stored in Supabase, chunks are embedded with `all-MiniLM-L6-v2`, embeddings are stored in a persistent local FAISS index, and a durable mapping connects FAISS integer IDs to Supabase `chunks.id` UUID rows.

## Technical Context

**Language/Version**: Python 3.10+ backend; existing environment currently runs Python 3.13-compatible code  
**Primary Dependencies**: FastAPI, Supabase Python client, `sentence-transformers`, `faiss-cpu`, `numpy`, existing parser dependencies  
**Storage**: Supabase PostgreSQL for documents/chunks, Supabase Storage for uploaded files, local filesystem for FAISS index and FAISS-to-chunk mapping  
**Testing**: pytest-style backend tests for chunking, embedding shape, vector store persistence, and parse integration; manual parse smoke test with Supabase-backed upload  
**Target Platform**: Local Windows development and deployable Python backend runtime  
**Project Type**: Web application with Python FastAPI backend and Next.js frontend  
**Performance Goals**: Process a representative 5-page academic document into chunks and indexed vectors without crashing; keep indexing synchronous for Phase 4 and bounded by existing upload size limits  
**Constraints**: Use `all-MiniLM-L6-v2`; use `faiss-cpu`; persist FAISS index to disk; preserve exact FAISS ID to `chunks.id` lookup; do not implement search endpoint, LLM answer generation, or chat UI  
**Scale/Scope**: Phase 4 local index for academic-project workloads; no distributed vector store, index sharding, deletion/rebuild workflow, or multi-instance synchronization in this phase

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution file currently contains placeholder principles only and does not define enforceable gates. This plan therefore applies the project-level CLAUDE.md constraints instead:

- Smallest viable change: PASS — scope is limited to backend pipeline modules, parse integration, dependencies, and local index artifacts.
- Testable acceptance criteria: PASS — plan includes unit/integration/manual validation paths for chunk count, embedding shape, persisted index, and ID mapping.
- No unrelated refactors: PASS — frontend/chat/retrieval work remains out of scope.
- Security/data handling: PASS — Supabase remains the source of truth for text chunks; secrets stay in environment configuration.

## Project Structure

### Documentation (this feature)

```text
specs/001-vectorization-faiss/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── parse-indexing.openapi.yaml
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
backend/
├── main.py
├── requirements.txt
├── rag/
│   ├── __init__.py
│   └── chunker.py
├── embeddings/
│   ├── __init__.py
│   └── generator.py
├── vector_store/
│   ├── __init__.py
│   └── faiss_store.py
└── tests/
    ├── test_chunker.py
    ├── test_embedding_generator.py
    ├── test_faiss_store.py
    └── test_parse_indexing.py

faiss_index/
├── intelliseek.index
└── id_map.json

database/
└── schema.sql
```

**Structure Decision**: Keep the pipeline in backend-owned modules (`rag`, `embeddings`, `vector_store`) and integrate at `backend/main.py` because Phase 4 extends the existing FastAPI parse endpoint rather than adding frontend behavior.

## Complexity Tracking

No constitution violations require justification.

## Phase 0: Research Summary

See [research.md](./research.md).

Key decisions:

- Use a deterministic character chunker with whitespace normalization and overlap.
- Use `SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")`; current docs show `encode(list[str])` returns `(n, 384)` embeddings.
- Use `faiss.IndexIDMap(faiss.IndexFlatL2(384))` because plain `IndexFlatL2` does not support `add_with_ids`.
- Maintain a JSON mapping file from generated int64 FAISS IDs to Supabase UUID chunk IDs because the current `chunks.id` column is UUID, not integer.

## Phase 1: Design Summary

See [data-model.md](./data-model.md), [quickstart.md](./quickstart.md), and [contracts/parse-indexing.openapi.yaml](./contracts/parse-indexing.openapi.yaml).

Design outputs define:

- Existing `documents` and `chunks` tables as the authoritative text store.
- Local `PersistentSearchIndex` and `IndexEntryMapping` artifacts as backend filesystem state.
- Updated `POST /api/parse` response shape with chunk/index counts.
- Failure responses for no text, storage failures, embedding failures, and index persistence failures.

## Post-Design Constitution Check

- Smallest viable change: PASS — modules are additive and only parse endpoint response/workflow changes.
- Testable acceptance criteria: PASS — each success criterion maps to quickstart checks and planned tests.
- No unrelated refactors: PASS — no retrieval endpoint, LLM wiring, or frontend UI included.
- Security/data handling: PASS — chunk text stays in Supabase and local FAISS stores only vectors plus UUID mapping.

## Implementation Order

1. Add dependencies: `sentence-transformers`, `faiss-cpu`, `numpy`.
2. Add chunking module and unit tests.
3. Add embedding generator and embedding shape tests.
4. Add FAISS store with `IndexIDMap`, persistence, and mapping file tests.
5. Integrate chunk storage, embedding, FAISS add/save, and counts into `POST /api/parse`.
6. Run backend tests and manual parse smoke test.

## Risks and Mitigations

- **UUID-to-FAISS mapping mismatch**: Use a single `add_chunks` flow that writes chunks, allocates int64 IDs, adds embeddings, and persists the mapping atomically as much as the local filesystem allows.
- **Model download/runtime cost**: Lazy-load the model once in the embedding module and document first-run download in quickstart.
- **Index corruption or partial write**: Save index and mapping through deterministic paths and verify `index.ntotal` against mapping count after writes.

## ADR Suggestions

📋 Architectural decision detected: local FAISS indexing with Supabase as text source of truth — Document reasoning and tradeoffs? Run `/sp.adr local-faiss-indexing`

📋 Architectural decision detected: UUID chunk rows require explicit FAISS integer ID mapping — Document reasoning and tradeoffs? Run `/sp.adr faiss-chunk-id-mapping`

📋 Architectural decision detected: all-MiniLM-L6-v2 embedding model for Phase 4 — Document reasoning and tradeoffs? Run `/sp.adr mini-lm-embedding-model`
