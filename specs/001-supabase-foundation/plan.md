# Implementation Plan: Database, Storage & Authentication Foundation

**Branch**: `001-supabase-foundation` | **Date**: 2026-05-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-supabase-foundation/spec.md`

## Summary

Create the Supabase persistence foundation for IntelliSeek by versioning the PostgreSQL schema, defining RLS and storage policies, and adding backend and frontend connectivity checks. The technical approach keeps Supabase PostgreSQL as the source of truth for academic metadata, raw chunk text, and chat history while allowing the Next.js frontend to use public Supabase configuration and the FastAPI backend to use backend-only service configuration.

## Technical Context

**Language/Version**: TypeScript with Next.js 16.2.6 frontend; Python 3.10+ FastAPI backend; SQL for Supabase PostgreSQL  
**Primary Dependencies**: `@supabase/supabase-js`, `supabase`, FastAPI, Uvicorn, `python-dotenv`  
**Storage**: Supabase PostgreSQL tables plus Supabase Storage bucket `academic-documents`  
**Testing**: Manual Supabase SQL/policy verification, FastAPI endpoint check for `/api/db-test`, frontend client connectivity check, secret-boundary review  
**Target Platform**: Local dual-service development with hosted Supabase project  
**Project Type**: Web application monorepo with isolated `frontend/`, `backend/`, and root `database/` artifacts  
**Performance Goals**: Connectivity checks complete within 3 seconds when Supabase credentials and network are valid; schema can be applied and inspected within 10 minutes  
**Constraints**: No backend-only Supabase service key in frontend files; no registration UI, document parsing, embeddings, FAISS indexing, or production upload UX in this phase  
**Scale/Scope**: Foundation for per-user academic documents, chunks, and chat history; diagnostic read/write only for app connectivity

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Retrieval-grounded answers: not directly in scope; the plan preserves chunk text and cited-source fields required by later grounded answers.
- [x] Multi-format ingestion traceability: upload parsing is out of scope, but the plan stores document metadata, allowed file categories, storage paths, and chunk-to-document relationships needed for later traceability.
- [x] DSA visibility: FAISS/vector similarity, heaps, tries, and ranking are out of scope; the plan preserves chunk IDs and metadata needed by later vector-search and top-k ranking phases.
- [x] Secure data boundaries: plan covers env-managed Supabase keys, frontend public-key use, backend service-key isolation, RLS policies, storage bucket policies, and user ownership.
- [x] AI/retrieval quality: AI calls are out of scope; plan supports later source citation and no-source behavior by keeping source text, metadata, and chat source fields.
- [x] Service contracts: plan documents FastAPI `/api/db-test`, frontend Supabase connectivity, Supabase PostgreSQL, and Supabase Storage boundaries touched by this feature.

## Project Structure

### Documentation (this feature)

```text
specs/001-supabase-foundation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
database/
└── schema.sql

backend/
├── main.py
├── requirements.txt
├── .env
└── database/
    └── supabase.py

frontend/
├── app/
│   └── page.tsx
├── lib/
│   └── supabase.ts
├── package.json
└── .env.local
```

**Structure Decision**: Keep Supabase schema and policies in a root `database/schema.sql` artifact because they are shared persistence infrastructure, while client initialization stays inside the service that owns each credential boundary.

## Complexity Tracking

No constitution violations require complexity justification.

## Phase 0: Research

Research resolved the Supabase client and policy approach in [research.md](./research.md):

- Supabase PostgreSQL remains the source of truth for document metadata, chunk text, and chat history.
- FAISS later stores vector mappings and IDs, not the canonical text content.
- Next.js may initialize Supabase directly with the public anon key because RLS enforces row access with the user's JWT.
- FastAPI initializes Supabase with backend-only environment variables for diagnostic and future privileged workflows.
- Storage policies are defined with authenticated uploads and controlled reads, with public reads only if the bucket is intentionally public for document rendering.

## Phase 1: Design & Contracts

Design outputs:

- [data-model.md](./data-model.md): documents, chunks, chat history, storage object, and connectivity-check models.
- [contracts/openapi.yaml](./contracts/openapi.yaml): FastAPI `/api/db-test` contract and frontend diagnostic route expectation.
- [quickstart.md](./quickstart.md): Supabase setup, schema application, and connectivity verification steps.

## Constitution Check (Post-Design)

- [x] Retrieval-grounded answers: preserved through chunk text and source fields for later answer generation.
- [x] Multi-format ingestion traceability: document metadata and storage path strategy allow future PDF/DOCX/TXT/PPTX parsing flows to trace extracted chunks.
- [x] DSA visibility: the schema preserves stable IDs for later vector similarity and top-k retrieval implementations.
- [x] Secure data boundaries: data model and contracts enforce frontend public env values, backend-only service key use, RLS, and user-owned records.
- [x] AI/retrieval quality: no LLM behavior is implemented in this phase; data fields support later source citation and retrieval checks.
- [x] Service contracts: Supabase, backend endpoint, frontend client, and storage boundaries are documented.

## Planned Implementation Boundaries

In scope:

- `database/schema.sql` with tables, relationships, RLS, and storage policy SQL.
- Backend Supabase client utility and `GET /api/db-test` diagnostic endpoint.
- Frontend Supabase client utility and UI connectivity indicator.
- Environment placeholder updates only; no real secrets.

Out of scope:

- Supabase project creation through an external dashboard.
- Registration/login UI.
- Document parsing or text extraction workflows.
- Embeddings, FAISS indexing, vector search, or Groq calls.
- Production-grade upload UI.

## Risk Review

- Placeholder or invalid Supabase credentials can make connectivity checks fail even when code is correct.
- Open local-testing policies must not be mistaken for production-ready multi-user policies.
- Frontend files must never contain `SUPABASE_SERVICE_KEY` or service-role values.

## Acceptance Checks

- [ ] Applying `database/schema.sql` creates `documents`, `chunks`, `chat_history`, and `academic-documents` setup.
- [ ] RLS is enabled and ownership policies exist for all user-owned records.
- [ ] Backend `/api/db-test` returns a clear success or failure response.
- [ ] Frontend Supabase client initializes from `NEXT_PUBLIC_*` values only.
- [ ] Secret-boundary review finds zero backend-only Supabase credentials in frontend-facing files.
