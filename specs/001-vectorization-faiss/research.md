# Research: Vectorization & FAISS Indexing Pipeline

## Decision: Use deterministic overlapping character chunks

**Rationale**: The feature requires context-preserving text segments and gives a target around 1000 characters with overlap. A deterministic character chunker with whitespace normalization is simple to test, independent from external NLP tooling, and sufficient for Phase 4 indexing.

**Alternatives considered**:

- Sentence-aware splitting: better semantic boundaries but more dependencies and edge cases than needed for Phase 4.
- Token-aware splitting: closer to model limits but requires tokenizer coupling and is unnecessary for the requested 500-1000 character range.
- No overlap: simpler, but fails the context-preservation requirement at boundaries.

## Decision: Use `sentence-transformers/all-MiniLM-L6-v2`

**Rationale**: The user explicitly selected this model. Current SentenceTransformers documentation confirms loading with `SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")` and encoding a list of texts returns a `(n, 384)` array, matching the requested 384-dimensional embedding constraint.

**Alternatives considered**:

- Larger SentenceTransformers models: potentially higher quality but more memory and runtime cost.
- OpenAI or hosted embedding APIs: external service dependency and outside the self-contained academic pipeline goal.
- Custom embeddings: unnecessary and not aligned with the specified dependency.

## Decision: Use FAISS `IndexIDMap(IndexFlatL2(384))`

**Rationale**: FAISS documentation states plain `IndexFlatL2` does not support `add_with_ids`; wrapping it in `IndexIDMap` enables explicit int64 vector IDs. `IndexFlatL2` has no training step, is simple for small academic-project workloads, and satisfies the local FAISS requirement.

**Alternatives considered**:

- Plain `IndexFlatL2`: rejected because it cannot accept explicit IDs.
- `IndexIDMap2`: useful if vector reconstruction is required, but this phase only needs ID lookup to chunk text.
- IVF/PQ indexes: more scalable but require training and extra tuning, which is unnecessary for Phase 4.
- Managed vector database or pgvector: rejected by project goal to demonstrate local DSA indexing concepts with FAISS.

## Decision: Store FAISS index and UUID mapping as local files

**Rationale**: Existing `database/schema.sql` defines `public.chunks.id` as UUID, while FAISS IDs must be int64. Direct mapping `faiss_id == chunks.id` is impossible without changing the schema. The smallest viable approach is to allocate stable int64 FAISS IDs locally and persist a mapping file from FAISS ID to chunk UUID next to the FAISS index.

**Alternatives considered**:

- Change `chunks.id` from UUID to integer: rejected because it would alter an established schema and RLS-linked data model.
- Add an integer `faiss_id` column to `chunks`: possible, but unnecessary for Phase 4 if a local mapping file is acceptable; can be reconsidered if multi-instance or rebuild workflows are required.
- Hash UUIDs into int64 IDs: rejected because collision handling would complicate correctness.

## Decision: Extend existing parse workflow synchronously

**Rationale**: `backend/main.py` already downloads, parses, and stores document metadata in `POST /api/parse`. Extending this workflow with chunk storage, embedding generation, and index persistence gives a clear end-to-end Phase 4 acceptance path without introducing queues or background workers.

**Alternatives considered**:

- Background indexing job: better for large workloads but adds operational complexity not required for the current upload size and phase scope.
- Separate indexing endpoint: easier isolation but increases user/API workflow complexity and risks parsed documents being left unindexed.
