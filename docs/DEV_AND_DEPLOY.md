# Developer Guide & Dev/Deploy Reference

This file consolidates developer setup, architecture pointers, API references, and third-party dependency rationale.

Repository layout (short)
-------------------------

- `frontend/`: Next.js app and UI.
- `frontend/app/api/`: server routes (chat, documents, parse, inngest, health).
- `frontend/lib/server/`: server helpers (rag, agents, ingress, rate limiting).
- `components/`, `lib/`: client and server helpers.
- `database/`: SQL schema and migrations.

Local development
-----------------

1. Install and run the frontend:

```bash
cd frontend
npm install
npm run dev
```

2. Environment variables (examples)

- `OPENROUTER_EMBEDDING_MODEL` — embedding model (1024-dim expected)
- `OPENROUTER_CHAT_MODEL` — chat model
- `OPENROUTER_BASE_URL` — OpenRouter base URL
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase client
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — optional Upstash rate-limiter
- `INNGEST_CLIENT_KEY` / `INNGEST_CLIENT_SECRET` — optional Inngest config

If Upstash variables are missing the app falls back to an in-memory rate limiter for local development.

Key code mappings
-----------------

- Chunking & upload: `frontend/lib/upload-document.ts` and `frontend/lib/server/rag/*`.
- Inngest: `frontend/lib/server/inngest/*` and `frontend/app/api/inngest/route.ts`.
- Rate limiter (Upstash): `frontend/lib/server/rate-limit.ts`.
- Agent orchestration: `frontend/lib/server/agents/chat-agent.ts`.
- Vector search integration / SQL: `database/schema.sql` and `frontend/lib/server/rag/*`.

API Reference (short)
---------------------

- `POST /api/documents/upload` — uploads a document and enqueues indexing.
- `POST /api/parse` — parse/validate uploaded object and queue indexing via Inngest.
- `POST /api/documents/search` — query → embedding → search (pgvector/HNSW).
- `POST /api/chat` — chat with retrieval grounding and streaming responses.

Third-party services rationale
-----------------------------

- Supabase: stores auth, files, Postgres, and `pgvector` for embeddings — reduces operational surface area.
- OpenRouter/OpenAI: model calls for embeddings and chat.
- Inngest: background job orchestration for decoupling uploads from indexing; supports retries and observability.
- Upstash: serverless Redis for distributed rate limiting across stateless server instances (Vercel). Fallback to in-memory limiter locally.

Dependency checklist
-------------------

- Parsing: `mammoth` (DOCX), `pdf-parse` (PDF), `jszip` (archive handling).
- Frontend: `react`, `next`, `react-markdown`, `lucide-react`.
- Agents/model: `@openai/agents`, `openai`.

Contribution workflow
---------------------

- Branch from `main` as `feature/<name>`.
- Add docs updates for algorithmic or API changes.
- Run local tests (add tests) and open a PR with description and relevant `specs/` links.
