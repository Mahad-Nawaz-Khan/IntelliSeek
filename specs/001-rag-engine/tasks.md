# Tasks: RAG Engine

**Input**: Design documents from `/specs/001-rag-engine/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included because `plan.md` and `quickstart.md` explicitly require pytest-style backend tests for retrieval, prompt/LLM behavior, chat endpoint wiring, history logging, and failure paths.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add Phase 5 dependency and create backend module/test placeholders used by all stories.

- [X] T001 Add `groq` dependency to `backend/requirements.txt`
- [X] T002 [P] Create retrieval module file in `backend/rag/retriever.py`
- [X] T003 [P] Create LLM/prompting module file in `backend/rag/llm.py`
- [X] T004 [P] Create retrieval test file in `backend/tests/test_retriever.py`
- [X] T005 [P] Create LLM test file in `backend/tests/test_llm.py`
- [X] T006 [P] Create chat endpoint test file in `backend/tests/test_chat_endpoint.py`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define shared constants, data shapes, and FAISS search/mapping support needed before user stories.

**Critical**: No user story work can begin until this phase is complete.

- [X] T007 Define retrieval bounds `DEFAULT_TOP_K = 3`, `MIN_TOP_K = 2`, and `MAX_TOP_K = 5` in `backend/rag/retriever.py`
- [X] T008 Define `RetrievedContextChunk` and `SourceCitation` typed structures in `backend/rag/retriever.py`
- [X] T009 Define Groq model constant `GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"` in `backend/rag/llm.py`
- [X] T010 Define strict citation/refusal `SYSTEM_PROMPT` in `backend/rag/llm.py`
- [X] T011 Add read-only FAISS ID lookup helper for `id_map.json` in `backend/vector_store/faiss_store.py`
- [X] T012 Add `search_vectors(query_embedding: np.ndarray, k: int) -> tuple[np.ndarray, np.ndarray]` support in `backend/vector_store/faiss_store.py`
- [X] T013 Inspect existing FastAPI models/routes and identify insertion point for `POST /api/chat` in `backend/main.py`

**Checkpoint**: Foundation ready; retrieval, LLM, and endpoint stories can now be implemented.

---

## Phase 3: User Story 1 - Answer Questions From Uploaded Material (Priority: P1) MVP

**Goal**: A student asks a question about indexed academic material and receives an answer grounded only in relevant retrieved excerpts, or a safe refusal when context is insufficient.

**Independent Test**: Ask a factual question with mocked indexed context and verify the endpoint returns a grounded answer; ask an unsupported question and verify refusal/no-context behavior without hallucination.

### Tests for User Story 1

- [X] T014 [P] [US1] Add retrieval unit tests for Top-K bounds and empty question validation in `backend/tests/test_retriever.py`
- [X] T015 [P] [US1] Add retrieval unit tests for FAISS search result ID mapping and missing mapping failure in `backend/tests/test_retriever.py`
- [X] T016 [P] [US1] Add retrieval integration test with mocked Supabase `chunks` hydration in `backend/tests/test_retriever.py`
- [X] T017 [P] [US1] Add LLM prompt tests for exclusive-context instruction and refusal instruction in `backend/tests/test_llm.py`
- [X] T018 [P] [US1] Add chat endpoint tests for valid question success and empty question 400 response in `backend/tests/test_chat_endpoint.py`
- [X] T019 [P] [US1] Add chat endpoint tests for no-context/retrieval failure without history insert in `backend/tests/test_chat_endpoint.py`

### Implementation for User Story 1

- [X] T020 [US1] Implement `validate_top_k(k: int) -> int` and question validation in `backend/rag/retriever.py`
- [X] T021 [US1] Implement query embedding through existing `embed_texts([query])` in `backend/rag/retriever.py`
- [X] T022 [US1] Implement FAISS search call using `FaissVectorStore` in `backend/rag/retriever.py`
- [X] T023 [US1] Implement FAISS integer ID to chunk UUID mapping in `backend/rag/retriever.py`
- [X] T024 [US1] Implement Supabase chunk hydration by chunk IDs in `backend/rag/retriever.py`
- [X] T025 [US1] Implement `retrieve_context(query: str, k: int = DEFAULT_TOP_K) -> list[RetrievedContextChunk]` in `backend/rag/retriever.py`
- [X] T026 [US1] Implement `build_messages(query: str, context_chunks: list[RetrievedContextChunk]) -> list[dict[str, str]]` in `backend/rag/llm.py`
- [X] T027 [US1] Implement Groq client initialization using `GROQ_API_KEY` in `backend/rag/llm.py`
- [X] T028 [US1] Implement `generate_answer(query: str, context_chunks: list[RetrievedContextChunk]) -> str` in `backend/rag/llm.py`
- [X] T029 [US1] Add `ChatRequest` request model and `POST /api/chat` route skeleton in `backend/main.py`
- [X] T030 [US1] Wire chat endpoint validation, `retrieve_context()`, and `generate_answer()` in `backend/main.py`
- [X] T031 [US1] Return controlled 400/500 chat errors for empty questions, retrieval failures, missing context, and Groq failures in `backend/main.py`

**Checkpoint**: User Story 1 is independently functional when questions produce grounded answers from retrieved context or safe refusal/error behavior.

---

## Phase 4: User Story 2 - Show Sources For Answers (Priority: P2)

**Goal**: A student can see which uploaded document filenames support an answer, both in answer text citations and structured source metadata.

**Independent Test**: Ask a question with mocked chunks from known documents and verify the answer includes `[Source: filename]` citations and response `sources` includes document/chunk metadata.

### Tests for User Story 2

- [X] T032 [P] [US2] Add retrieval tests for fetching document filenames from Supabase `documents` rows in `backend/tests/test_retriever.py`
- [X] T033 [P] [US2] Add source metadata formatting tests for `SourceCitation` output in `backend/tests/test_retriever.py`
- [X] T034 [P] [US2] Add LLM tests ensuring prompt context includes filenames beside excerpt text in `backend/tests/test_llm.py`
- [X] T035 [P] [US2] Add chat endpoint test verifying response `sources` array includes `document_id`, `filename`, `chunk_id`, and `chunk_index` in `backend/tests/test_chat_endpoint.py`

### Implementation for User Story 2

- [X] T036 [US2] Extend Supabase hydration to fetch `documents.filename` for each retrieved chunk in `backend/rag/retriever.py`
- [X] T037 [US2] Implement `to_source_citations(context_chunks: list[RetrievedContextChunk]) -> list[SourceCitation]` in `backend/rag/retriever.py`
- [X] T038 [US2] Include filename labels in prompt context assembly in `backend/rag/llm.py`
- [X] T039 [US2] Return `sources` metadata from `POST /api/chat` in `backend/main.py`
- [X] T040 [US2] Preserve source ordering from retrieved context in `backend/main.py`

**Checkpoint**: User Stories 1 and 2 work independently when answers include source citations and structured source metadata.

---

## Phase 5: User Story 3 - Preserve Chat Activity (Priority: P3)

**Goal**: Successful question-answer interactions are saved with the question, answer, user ID, and cited sources for later review.

**Independent Test**: Submit a mocked successful chat request and verify exactly one `chat_history` row is inserted with question, answer, user ID, and `sources_cited`; verify failed generation does not insert a success row.

### Tests for User Story 3

- [X] T041 [P] [US3] Add chat endpoint test verifying successful `chat_history` insert payload in `backend/tests/test_chat_endpoint.py`
- [X] T042 [P] [US3] Add chat endpoint test verifying retrieval failure does not insert `chat_history` in `backend/tests/test_chat_endpoint.py`
- [X] T043 [P] [US3] Add chat endpoint test verifying Groq generation failure does not insert `chat_history` in `backend/tests/test_chat_endpoint.py`
- [X] T044 [P] [US3] Add chat endpoint test for chat history insert failure returning controlled persistence error in `backend/tests/test_chat_endpoint.py`

### Implementation for User Story 3

- [X] T045 [US3] Implement `chat_history` insert payload with `user_id`, `question`, `answer`, and `sources_cited` in `backend/main.py`
- [X] T046 [US3] Ensure `chat_history` insert executes only after successful answer and source assembly in `backend/main.py`
- [X] T047 [US3] Return controlled error when `chat_history` insertion fails in `backend/main.py`
- [X] T048 [US3] Ensure failed retrieval or failed generation paths do not write successful chat history rows in `backend/main.py`

**Checkpoint**: All user stories are independently functional when successful answers are logged and failed attempts do not create misleading history.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate end-to-end behavior, update docs, and ensure Phase 5 does not exceed scope.

- [X] T049 [P] Update Phase 5 dependency and `GROQ_API_KEY` notes in `specs/001-rag-engine/quickstart.md`
- [X] T050 [P] Add validation results placeholder for automated tests and manual chat smoke test in `specs/001-rag-engine/quickstart.md`
- [X] T051 Run `python -m pytest backend/tests` and record results in `specs/001-rag-engine/quickstart.md`
- [ ] T052 Run manual chat smoke test with a Supabase-backed indexed document and record answer/source/history results in `specs/001-rag-engine/quickstart.md`
- [X] T053 Review `backend/main.py`, `backend/rag/retriever.py`, and `backend/rag/llm.py` to confirm no frontend UI, multi-turn memory, full-document prompting, streaming, or reranking was added
- [X] T054 Review `backend/rag/llm.py` to confirm no Groq API key or secret value is hardcoded

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational; MVP scope.
- **User Story 2 (Phase 4)**: Depends on Foundational and benefits from US1 retrieval context; can test source formatting independently with mocked context.
- **User Story 3 (Phase 5)**: Depends on endpoint response assembly from US1 and source metadata from US2.
- **Polish (Phase 6)**: Depends on selected user stories being complete.

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories after Foundation; delivers answer/refusal behavior.
- **US2 (P2)**: Requires retrieved context shape from US1 or mocks of that shape; adds citations/source metadata.
- **US3 (P3)**: Requires answer and source metadata payloads from US1/US2 to log useful history.

### Within Each User Story

- Tests before implementation.
- Lower-level modules before `backend/main.py` integration.
- Retrieval and prompt behavior before endpoint wiring.
- Story checkpoint validation before next priority story.

## Parallel Opportunities

- T002, T003, T004, T005, and T006 can run in parallel after T001.
- T014 through T019 can run in parallel for US1 tests.
- T032 through T035 can run in parallel for US2 tests.
- T041 through T044 can run in parallel for US3 tests.
- T049 and T050 can run in parallel during polish.

## Parallel Example: User Story 1

```text
Task: "T014 [P] [US1] Add retrieval unit tests for Top-K bounds and empty question validation in backend/tests/test_retriever.py"
Task: "T017 [P] [US1] Add LLM prompt tests for exclusive-context instruction and refusal instruction in backend/tests/test_llm.py"
Task: "T018 [P] [US1] Add chat endpoint tests for valid question success and empty question 400 response in backend/tests/test_chat_endpoint.py"
```

## Parallel Example: User Story 2

```text
Task: "T032 [P] [US2] Add retrieval tests for fetching document filenames from Supabase documents rows in backend/tests/test_retriever.py"
Task: "T034 [P] [US2] Add LLM tests ensuring prompt context includes filenames beside excerpt text in backend/tests/test_llm.py"
Task: "T035 [P] [US2] Add chat endpoint test verifying response sources array includes document_id, filename, chunk_id, and chunk_index in backend/tests/test_chat_endpoint.py"
```

## Parallel Example: User Story 3

```text
Task: "T041 [P] [US3] Add chat endpoint test verifying successful chat_history insert payload in backend/tests/test_chat_endpoint.py"
Task: "T042 [P] [US3] Add chat endpoint test verifying retrieval failure does not insert chat_history in backend/tests/test_chat_endpoint.py"
Task: "T043 [P] [US3] Add chat endpoint test verifying Groq generation failure does not insert chat_history in backend/tests/test_chat_endpoint.py"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Stop and validate that a question can produce a grounded answer or safe refusal with mocked retrieval/LLM dependencies.
5. Demo the backend-only chat endpoint response shape.

### Incremental Delivery

1. Setup + Foundation -> dependency, module files, constants, search/mapping seams.
2. US1 -> question becomes retrieved context and answer/refusal.
3. US2 -> answers include citations and source metadata.
4. US3 -> successful interactions are stored in chat history.
5. Polish -> tests, manual smoke test, docs, and regression-boundary review.

### Parallel Team Strategy

1. One developer handles setup/foundation and shared FAISS search/mapping support.
2. After foundation, test tasks for each story can be written in parallel.
3. `backend/main.py` endpoint edits should be serialized to avoid same-file conflicts.
4. Retrieval and LLM module work can proceed in parallel once shared data shapes are defined.

## Format Validation

- All tasks use markdown checkbox format.
- All tasks have sequential IDs from T001 to T054.
- All user story phase tasks include `[US1]`, `[US2]`, or `[US3]` labels.
- Setup, foundational, and polish tasks omit story labels.
- All tasks include exact file paths.
