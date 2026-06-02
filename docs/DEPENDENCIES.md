# Third‑Party Dependencies — Why they're used

This document explains the main third-party libraries and services used in IntelliSeek, why each was chosen, and where to find related code in the repository.

Core platform services
----------------------

- Supabase: authentication, object storage, Postgres DB, and `pgvector` for storing embeddings. See `frontend/lib/server/*` and the architecture overview (`docs/ARCHITECTURE.md`). Supabase is used because it provides a simple hosted Postgres + Storage + Auth stack and integrates with `pgvector` for server-side similarity search.

- OpenRouter / OpenAI: model calls for embeddings and chat generation. The OpenRouter-compatible client and configuration are used to generate 1024-dim embeddings and to run chat generation. See `frontend/lib/server/agents/chat-agent.ts` and the environment configuration in `frontend/README.md` / `docs/SETUP.md`.

Background jobs & orchestration
-------------------------------

- Inngest: background-job/event orchestration for document indexing and other async tasks.
  - Why: decouples file upload from CPU-bound parsing, chunking and embedding; enables retries, logging and observability for indexing jobs.
  - Where: `frontend/app/api/parse/route.ts` (enqueueing), `frontend/app/api/inngest/route.ts`, `frontend/lib/server/inngest/client.ts`, and `frontend/lib/server/inngest/functions.ts`.

Rate limiting and caching
------------------------

- Upstash (Redis REST): optional distributed rate limiter and small-state store.
  - Why: serverless-friendly Redis interface for global rate limits across stateless server instances (Vercel). When the Upstash environment variables are missing, the app falls back to an in-memory limiter for local development.
  - Where: `frontend/lib/server/rate-limit.ts`, `docs/SETUP.md`, and `frontend/README.md` (env examples).

Vector storage & indexing
-------------------------

- `pgvector` (via Supabase Postgres): stores chunk embeddings in a `vector(1024)` column and supports HNSW indexed approximate nearest-neighbor search in Postgres.
  - Why: keeps data and vector index co-located with user metadata and access controls, reducing operational complexity.
  - Where: DB schema and the HNSW index creation are described in `docs/ARCHITECTURE.md` and `database/schema.sql`.

Document parsing and file helpers
--------------------------------

- `mammoth`: DOCX → HTML/text extraction for `.docx` uploads.
- `pdf-parse`: PDF text extraction.
- `jszip`: handling zip-based formats or extracting files from compound artifacts.
  - Why: these libraries provide robust, well-tested parsers for common upload formats so the ingest pipeline can extract text reliably.
  - Where: the ingest/upload pipeline is implemented in `frontend/lib/upload-document.ts` and `frontend/lib/server/rag/*`.

Model orchestration and agents
-----------------------------

- `@openai/agents` and `openai`: used for agent-style orchestration and model calls (prompt tooling, streaming). The agents SDK is used to structure multi-tool flows and to stream model outputs to clients.
  - Where: `frontend/lib/server/agents/chat-agent.ts` and API routes that call out to model endpoints.

Frontend & UI libraries
-----------------------

- `react`, `react-dom`, `next`: core framework and rendering.
- `lucide-react`: icon components used across the UI.
- `react-markdown`: render markdown content inside messages and document previews.
- `zod`: runtime input validation for API payloads and schema checks.
  - Where: look under `frontend/components/` and `frontend/lib/` for uses of these libraries.

Utilities & developer tooling
-----------------------------

- `@napi-rs/canvas`: native canvas bindings (image/thumbnail generation) for server-side image operations.
- `groq-sdk`: helper/fallback logic for Groq-related tasks (`frontend/lib/server/groq.ts`).
- `jszip`, `mammoth`, `pdf-parse` (already noted) for archive and document processing.

Indexing & ANN (optional tooling)
---------------------------------

- HNSW (pgvector's HNSW index) is used in production via Postgres. For very large corpora, FAISS or HNSWLIB (native binaries) are recommended for offline/off-DB index building.
  - Why: HNSW provides an excellent recall/latency tradeoff; FAISS/HNSWLIB give more tuning and GPU options for very large datasets.

Dev dependencies and build tooling
---------------------------------

- `tailwindcss`, `postcss`, `eslint`, `typescript`: styling, linting and type safety.
  - Why: developer ergonomics, consistent styles, and catching type/syntax issues early.

How this maps to repository files
---------------------------------

- Upload / parse / chunk / ingest: `frontend/lib/upload-document.ts`, `frontend/app/api/parse/route.ts`
- Inngest enqueue + functions: `frontend/lib/server/inngest/*`, `frontend/app/api/inngest/route.ts`
- Rate limiting (Upstash): `frontend/lib/server/rate-limit.ts`
- Model agent orchestration: `frontend/lib/server/agents/chat-agent.ts`
- RAG logic (search, fallback): `frontend/lib/server/rag/*`
- Groq helpers: `frontend/lib/server/groq.ts`

If you want, I will:

- Expand this file with exact code snippets and line links to the most relevant imports/usages.
- Generate a condensed `frontend/DEPENDENCIES.md` listing only the packages present in `frontend/package.json` with version numbers and short justifications.
