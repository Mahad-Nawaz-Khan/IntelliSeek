# Implementation Plan: RAG Engine

**Branch**: `001-rag-engine` | **Date**: 2026-05-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-rag-engine/spec.md`

## Summary

Implement a backend Retrieval-Augmented Generation pipeline that accepts a user's academic question, embeds the query with the existing Phase 4 embedding model, searches the persistent local FAISS index for a bounded Top-K set, hydrates matching chunks and filenames from Supabase, builds a strict citation-oriented prompt, calls Groq's Llama model, stores successful interactions in `chat_history`, and returns `{answer, sources}` for frontend consumption.

## Technical Context

**Language/Version**: Python 3.10+ backend; existing environment currently runs Python 3.13-compatible code  
**Primary Dependencies**: FastAPI, Supabase Python client, existing `sentence-transformers`, existing `faiss-cpu`, existing `numpy`, new `groq` Python SDK  
**Storage**: Supabase PostgreSQL for `chunks`, `documents`, and `chat_history`; local filesystem for FAISS index and FAISS-to-chunk mapping  
**Testing**: pytest-style backend unit/integration tests for retrieval, prompt/LLM wrapper behavior, chat endpoint wiring, history logging, and failure paths; manual chat smoke test with Supabase-backed indexed document  
**Target Platform**: Local Windows development and deployable Python backend runtime  
**Project Type**: Web application with Python FastAPI backend and Next.js frontend; Phase 5 scope is backend-only  
**Performance Goals**: 95% of answerable local development chat requests return cited answers in under 3 seconds when the index/model/API are warm  
**Constraints**: Retrieve only 2 to 5 chunks; never send full documents to the LLM; use Groq model `meta-llama/llama-4-scout-17b-16e-instruct`; use retrieved chunks as exclusive factual context; keep endpoint stateless; do not add frontend UI or multi-turn memory  
**Scale/Scope**: Academic-project workload over the existing local Phase 4 FAISS index; no distributed retrieval, streaming responses, reranking, conversation memory, or index rebuild workflow in this phase

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution file currently contains placeholder principles only and does not define enforceable gates. This plan applies the project-level CLAUDE.md and SDD constraints instead:

- Smallest viable change: PASS — scope is limited to backend retrieval, prompt/LLM utility, chat endpoint, dependency, tests, and docs.
- Testable acceptance criteria: PASS — user stories map to retrieval, citation, refusal, and chat-history validation.
- No unrelated refactors: PASS — Phase 5 does not add frontend UI, multi-turn memory, or retrieval beyond bounded Top-K context.
- Security/data handling: PASS — `GROQ_API_KEY` remains environment-based; uploaded document text remains in Supabase chunks and only bounded excerpts are sent to Groq.
- Architecture clarity: PASS — retrieval mapping, Top-K bounds, stateless behavior, and Groq usage are explicit decisions.

## Project Structure

### Documentation (this feature)

```text
specs/001-rag-engine/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── chat.openapi.yaml
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
backend/
├── main.py
├── requirements.txt
├── embeddings/
│   ├── __init__.py
│   └── generator.py
├── vector_store/
│   ├── __init__.py
│   └── faiss_store.py
├── rag/
│   ├── __init__.py
│   ├── chunker.py
│   ├── retriever.py
│   └── llm.py
└── tests/
    ├── conftest.py
    ├── test_retriever.py
    ├── test_llm.py
    └── test_chat_endpoint.py

faiss_index/
├── intelliseek.index
└── id_map.json
```

**Structure Decision**: Keep Phase 5 in backend-owned modules. `backend/rag/retriever.py` owns query embedding, FAISS search, ID mapping, and Supabase hydration. `backend/rag/llm.py` owns prompt assembly and Groq calls. `backend/main.py` wires `POST /api/chat` and history logging because existing FastAPI endpoints live there.

## Complexity Tracking

No constitution violations require justification.

## Phase 0: Research Summary

See [research.md](./research.md).

Key decisions:

- Reuse Phase 4 `embed_texts()` and `FaissVectorStore` state instead of creating a second embedding/index lifecycle.
- Add a `search_vectors()`/retrieval path over the existing FAISS `IndexIDMap`, mapping returned integer IDs through `id_map.json` to Supabase `chunks.id` UUIDs.
- Enforce `k` bounds at the retrieval boundary: minimum 2, maximum 5, default 3.
- Use Groq's official Python SDK with `Groq(api_key=os.environ.get("GROQ_API_KEY"))` and `client.chat.completions.create(...)`.
- Keep each chat request stateless; do not feed `chat_history` back into the LLM context.

## Phase 1: Design Summary

See [data-model.md](./data-model.md), [quickstart.md](./quickstart.md), and [contracts/chat.openapi.yaml](./contracts/chat.openapi.yaml).

Design outputs define:

- Request/response contract for `POST /api/chat`.
- `RetrievedContextChunk`, `SourceCitation`, `GeneratedAnswer`, and `ChatHistoryEntry` entities.
- Failure responses for invalid questions, empty/missing index, retrieval hydration mismatch, missing API key, Groq failure, insufficient context, and history insert failure.
- Manual smoke test for a real indexed document and a cited answer.

## Post-Design Constitution Check

- Smallest viable change: PASS — only additive backend modules, dependency, endpoint, tests, and docs are planned.
- Testable acceptance criteria: PASS — each requirement has unit, integration, contract, or manual validation.
- No unrelated refactors: PASS — no frontend chat UI, streaming, reranking, or multi-turn memory.
- Security/data handling: PASS — secrets stay in environment variables; bounded excerpts avoid sending full documents.
- Architecture clarity: PASS — stateless RAG, bounded Top-K retrieval, and Groq model usage are documented.

## Implementation Order

1. Add `groq` to `backend/requirements.txt`.
2. Extend FAISS store with search/read mapping support if Phase 4 store does not already expose it.
3. Add `backend/rag/retriever.py` and tests for Top-K bounds, FAISS ID mapping, Supabase chunk/document hydration, and empty index behavior.
4. Add `backend/rag/llm.py` and tests for strict prompt assembly, refusal instruction, source formatting, missing API key, and mocked Groq responses.
5. Add `POST /api/chat` request/response models and endpoint in `backend/main.py`.
6. Add chat endpoint tests for success, validation errors, no context, LLM failures, and history logging.
7. Run backend tests and manual chat smoke test against an indexed Supabase-backed document.

## Risks and Mitigations

- **Incorrect FAISS-to-chunk mapping**: Reuse Phase 4 `id_map.json` as the single mapping source and fail closed if any returned FAISS ID cannot be mapped or hydrated.
- **Hallucinated answers**: Use a strict system prompt, bounded context, explicit source metadata, and refusal behavior when context is insufficient.
- **Latency or external API failure**: Keep retrieval Top-K small, reuse warm embedding/index state, and return controlled errors when Groq is unavailable rather than fabricating answers.

## ADR Suggestions

📋 Architectural decision detected: stateless RAG requests instead of conversational memory — Document reasoning and tradeoffs? Run `/sp.adr stateless-rag-requests`

📋 Architectural decision detected: bounded Top-K context retrieval for Phase 5 — Document reasoning and tradeoffs? Run `/sp.adr bounded-rag-top-k`

📋 Architectural decision detected: Groq-hosted Llama inference for academic Q&A — Document reasoning and tradeoffs? Run `/sp.adr groq-llama-rag-inference`
