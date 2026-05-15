# Tasks: Vectorization & FAISS Indexing Pipeline

**Input**: Design documents from `/specs/001-vectorization-faiss/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included because `plan.md` and `quickstart.md` explicitly call for pytest-style backend tests for chunking, embeddings, FAISS persistence, mapping counts, and parse integration.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add dependencies and create backend module/test structure used by all Phase 4 stories.

- [X] T001 Add `sentence-transformers`, `faiss-cpu`, `numpy`, and `pytest` dependencies to `backend/requirements.txt`
- [X] T002 [P] Create RAG package files in `backend/rag/__init__.py` and `backend/rag/chunker.py`
- [X] T003 [P] Create embeddings package files in `backend/embeddings/__init__.py` and `backend/embeddings/generator.py`
- [X] T004 [P] Create vector store package files in `backend/vector_store/__init__.py` and `backend/vector_store/faiss_store.py`
- [X] T005 [P] Create backend test directory and placeholder test files in `backend/tests/test_chunker.py`, `backend/tests/test_embedding_generator.py`, `backend/tests/test_faiss_store.py`, and `backend/tests/test_parse_indexing.py`
- [X] T006 Add `faiss_index/` runtime artifacts to `.gitignore`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define shared defaults, persistence paths, and parse integration seams that MUST be ready before user stories.

**Critical**: No user story work can begin until this phase is complete.

- [X] T007 Define chunking defaults `DEFAULT_CHUNK_SIZE = 1000` and `DEFAULT_CHUNK_OVERLAP = 200` in `backend/rag/chunker.py`
- [X] T008 Define embedding constants `MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"` and `EMBEDDING_DIMENSION = 384` in `backend/embeddings/generator.py`
- [X] T009 Define FAISS persistence defaults for `faiss_index/intelliseek.index` and `faiss_index/id_map.json` in `backend/vector_store/faiss_store.py`
- [X] T010 Inspect `POST /api/parse` response fields and add planned `chunks_created`, `vectors_indexed`, and `index_total` response contract notes in `backend/main.py`

**Checkpoint**: Foundation ready; user story implementation can now begin.

---

## Phase 3: User Story 1 - Prepare uploaded documents for later search (Priority: P1) MVP

**Goal**: Split extracted document text into meaningful overlapping chunks and store ordered non-empty chunks with their source document relationship.

**Independent Test**: Process representative multi-page text and verify multiple stored ordered chunks with overlap; process short/empty text and verify one/no chunks respectively.

### Tests for User Story 1

- [X] T011 [P] [US1] Add chunker unit tests for whitespace normalization, short text, empty text, and overlapping long text in `backend/tests/test_chunker.py`
- [X] T012 [P] [US1] Add parse integration test that mocks Supabase and parser output to verify inserted `chunks` rows include `document_id`, `text_content`, and `chunk_index` in `backend/tests/test_parse_indexing.py`

### Implementation for User Story 1

- [X] T013 [US1] Implement `normalize_text(text: str) -> str` in `backend/rag/chunker.py`
- [X] T014 [US1] Implement `chunk_text(text: str, chunk_size: int = DEFAULT_CHUNK_SIZE, overlap: int = DEFAULT_CHUNK_OVERLAP) -> list[str]` in `backend/rag/chunker.py`
- [X] T015 [US1] Add chunk size and overlap validation errors in `backend/rag/chunker.py`
- [X] T016 [US1] Import `chunk_text` and create chunk records after document insert in `backend/main.py`
- [X] T017 [US1] Insert ordered chunk rows into Supabase `chunks` table and retrieve inserted rows in `backend/main.py`
- [X] T018 [US1] Return `chunks_created` in successful parse response and preserve existing validation failures in `backend/main.py`

**Checkpoint**: User Story 1 is independently functional when chunk rows are created for parsed text and no chunk rows are created for empty text.

---

## Phase 4: User Story 2 - Make document segments searchable-ready (Priority: P2)

**Goal**: Generate one 384-dimensional embedding per stored chunk and add each embedding to a FAISS index with a durable mapping to the chunk UUID.

**Independent Test**: Process a document and verify every stored chunk has exactly one indexed vector and one FAISS-ID-to-chunk-ID mapping entry.

### Tests for User Story 2

- [X] T019 [P] [US2] Add embedding generator tests for empty input and 384-column output using a mocked SentenceTransformer model in `backend/tests/test_embedding_generator.py`
- [X] T020 [P] [US2] Add FAISS store tests for `add_vectors`, unique ID allocation, mapping count, and `ntotal` count in `backend/tests/test_faiss_store.py`
- [X] T021 [P] [US2] Add parse integration test that mocks embeddings and FAISS store to verify `vectors_indexed == chunks_created` in `backend/tests/test_parse_indexing.py`

### Implementation for User Story 2

- [X] T022 [US2] Implement lazy `get_embedding_model()` loading `SentenceTransformer(MODEL_NAME)` in `backend/embeddings/generator.py`
- [X] T023 [US2] Implement `embed_texts(texts: list[str]) -> np.ndarray` with float32 384-column validation in `backend/embeddings/generator.py`
- [X] T024 [US2] Implement FAISS index creation with `faiss.IndexIDMap(faiss.IndexFlatL2(384))` in `backend/vector_store/faiss_store.py`
- [X] T025 [US2] Implement mapping load/save helpers for `faiss_index/id_map.json` in `backend/vector_store/faiss_store.py`
- [X] T026 [US2] Implement int64 FAISS ID allocation for Supabase UUID chunk IDs in `backend/vector_store/faiss_store.py`
- [X] T027 [US2] Implement `add_vectors(embeddings: np.ndarray, chunk_ids: list[str]) -> int` in `backend/vector_store/faiss_store.py`
- [X] T028 [US2] Integrate `embed_texts` and FAISS `add_vectors` after chunk insertion in `backend/main.py`
- [X] T029 [US2] Return `vectors_indexed` and `index_total` in successful parse response in `backend/main.py`
- [X] T030 [US2] Return a processing failure if embedding generation or vector insertion fails in `backend/main.py`

**Checkpoint**: User Stories 1 and 2 work independently when stored chunks and indexed vectors have matching counts.

---

## Phase 5: User Story 3 - Preserve index state across restarts (Priority: P3)

**Goal**: Persist and reload the FAISS index and mapping state so previously indexed chunks remain available after restart.

**Independent Test**: Index a document, reload the FAISS store from disk, and verify prior `ntotal` and mapping entries remain before adding another document.

### Tests for User Story 3

- [X] T031 [P] [US3] Add FAISS persistence tests for `save_index`, `load_index`, missing index initialization, and reload count in `backend/tests/test_faiss_store.py`
- [X] T032 [P] [US3] Add parse integration test that verifies existing index state is loaded before new vectors are added in `backend/tests/test_parse_indexing.py`

### Implementation for User Story 3

- [X] T033 [US3] Implement `save_index(filepath: str | Path)` using `faiss.write_index` in `backend/vector_store/faiss_store.py`
- [X] T034 [US3] Implement `load_index(filepath: str | Path)` using `faiss.read_index` with new-index fallback in `backend/vector_store/faiss_store.py`
- [X] T035 [US3] Implement a `FaissVectorStore` initializer that loads existing index and mapping paths in `backend/vector_store/faiss_store.py`
- [X] T036 [US3] Save FAISS index and mapping after successful vector insertion in `backend/vector_store/faiss_store.py`
- [X] T037 [US3] Wire parse endpoint to use the persistent `FaissVectorStore` lifecycle in `backend/main.py`
- [X] T038 [US3] Validate `index.ntotal` and mapping count after save and report failure on mismatch in `backend/vector_store/faiss_store.py`

**Checkpoint**: All user stories are independently functional when index files survive restart and counts increase correctly after additional uploads.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate end-to-end behavior, update docs, and ensure no out-of-scope retrieval/chat work was introduced.

- [X] T039 [P] Update Phase 4 dependency and first-run model download notes in `specs/001-vectorization-faiss/quickstart.md`
- [X] T040 [P] Add no-search/no-LLM regression note to `specs/001-vectorization-faiss/quickstart.md`
- [X] T041 Run `pytest backend/tests` and record results in `specs/001-vectorization-faiss/quickstart.md`
- [ ] T042 Run manual parse-and-index smoke test and record created `chunks_created`, `vectors_indexed`, and `index_total` values in `specs/001-vectorization-faiss/quickstart.md`
- [X] T043 Review `backend/main.py`, `backend/rag/chunker.py`, `backend/embeddings/generator.py`, and `backend/vector_store/faiss_store.py` to confirm no semantic retrieval endpoint, Groq LLM wiring, or chat UI was added

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational; MVP scope.
- **User Story 2 (Phase 4)**: Depends on Foundational and benefits from US1 chunk rows; can use mocks for independent test but full integration follows US1.
- **User Story 3 (Phase 5)**: Depends on Foundational and FAISS store work from US2.
- **Polish (Phase 6)**: Depends on selected user stories being complete.

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories after Foundation; delivers chunk storage MVP.
- **US2 (P2)**: Requires chunk text inputs and chunk IDs; can be unit-tested independently with fake chunk IDs, then integrated after US1.
- **US3 (P3)**: Requires FAISS store from US2; persistence can be unit-tested independently with temporary files.

### Within Each User Story

- Tests before implementation.
- Lower-level modules before `backend/main.py` integration.
- Count/mapping validation before successful response updates.
- Story checkpoint validation before next priority story.

## Parallel Opportunities

- T002, T003, T004, and T005 can run in parallel after T001.
- T011 and T012 can run in parallel for US1.
- T019, T020, and T021 can run in parallel for US2.
- T031 and T032 can run in parallel for US3.
- T039 and T040 can run in parallel during polish.

## Parallel Example: User Story 1

```text
Task: "T011 [P] [US1] Add chunker unit tests for whitespace normalization, short text, empty text, and overlapping long text in backend/tests/test_chunker.py"
Task: "T012 [P] [US1] Add parse integration test that mocks Supabase and parser output to verify inserted chunks rows include document_id, text_content, and chunk_index in backend/tests/test_parse_indexing.py"
```

## Parallel Example: User Story 2

```text
Task: "T019 [P] [US2] Add embedding generator tests for empty input and 384-column output using a mocked SentenceTransformer model in backend/tests/test_embedding_generator.py"
Task: "T020 [P] [US2] Add FAISS store tests for add_vectors, unique ID allocation, mapping count, and ntotal count in backend/tests/test_faiss_store.py"
Task: "T021 [P] [US2] Add parse integration test that mocks embeddings and FAISS store to verify vectors_indexed == chunks_created in backend/tests/test_parse_indexing.py"
```

## Parallel Example: User Story 3

```text
Task: "T031 [P] [US3] Add FAISS persistence tests for save_index, load_index, missing index initialization, and reload count in backend/tests/test_faiss_store.py"
Task: "T032 [P] [US3] Add parse integration test that verifies existing index state is loaded before new vectors are added in backend/tests/test_parse_indexing.py"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Stop and validate chunk creation independently using tests and a mocked parse flow.
5. Demo that parsed text becomes ordered stored chunks.

### Incremental Delivery

1. Setup + Foundation -> module paths and constants ready.
2. US1 -> text becomes stored chunks.
3. US2 -> stored chunks become indexed vectors with mapping.
4. US3 -> index and mapping persist across restarts.
5. Polish -> run tests, smoke test, update quickstart notes.

### Parallel Team Strategy

1. One developer handles setup/foundation.
2. After foundation, test tasks for each story can be written in parallel.
3. US1 and US2 module work can proceed with mocks, but final `backend/main.py` integration should be serialized to avoid same-file conflicts.

## Format Validation

- All tasks use markdown checkbox format.
- All tasks have sequential IDs from T001 to T043.
- All user story phase tasks include `[US1]`, `[US2]`, or `[US3]` labels.
- Setup, foundational, and polish tasks omit story labels.
- All tasks include exact file paths.
