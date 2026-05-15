# Implementation Plan: Multi-Format Parsing Layer & Upload Pipeline

**Branch**: `001-upload-parsing` | **Date**: 2026-05-13 | **Spec**: `specs/001-upload-parsing/spec.md`
**Input**: Feature specification from `/specs/001-upload-parsing/spec.md`

## Summary

Build the Phase 3 upload and parsing pipeline by adding a Next.js drag-and-drop upload UI, direct Supabase Storage upload to `academic-documents`, and a FastAPI `POST /api/parse` workflow that validates ownership and file constraints, downloads the stored object temporarily, extracts raw text through a parser Factory/Strategy, persists document metadata only after successful parsing, and removes the temporary file in all outcomes.

## Technical Context

**Language/Version**: TypeScript with Next.js 16.2.6 frontend; Python 3.10+ FastAPI backend  
**Primary Dependencies**: `@supabase/supabase-js`, FastAPI, Uvicorn, `python-dotenv`, `supabase`, `PyPDF2`, `python-docx`, `python-pptx`  
**Storage**: Supabase Storage bucket `academic-documents`; Supabase PostgreSQL `documents` table  
**Testing**: Frontend build/lint plus manual browser upload validation; backend `py_compile` and FastAPI TestClient checks; manual Supabase integration with real credentials  
**Target Platform**: Local development with Next.js on `localhost:3000` and FastAPI on `localhost:8000`; later deployable as separate frontend/backend services  
**Project Type**: Web application with separate `frontend/` and `backend/` services  
**Performance Goals**: Valid supported files up to 10 MB upload and hand off to parsing in under 30 seconds on normal local development connection  
**Constraints**: PDF, DOCX, PPTX, and TXT only; 10 MB max file size; validate file type/size on frontend and backend; user-aware storage path; no chunking, embeddings, vector indexing, or chat UI in this phase; temporary files deleted after both success and failure  
**Scale/Scope**: Single-user/local validation path first, while preserving Supabase Auth ownership boundaries for future multi-user deployment

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Retrieval-grounded answers: not directly in scope; plan defers chunking/retrieval/chat and preserves raw text extraction for future source-linked chunks.
- [x] Multi-format ingestion traceability: plan covers PDF, DOCX, TXT, and PPTX parsing, document metadata, parsing failures, and upload validation.
- [x] DSA visibility: no trie, heap, top-k, or vector search behavior is implemented in this phase; metadata lookup uses storage path/user ownership and later DSA retrieval remains explicitly out of scope.
- [x] Secure data boundaries: plan covers extension/MIME and size validation, environment-managed Supabase secrets, authenticated storage paths, backend ownership checks, and user-scoped document metadata.
- [x] AI/retrieval quality: AI is out of scope; the acceptance checks verify parser output quality and explicit failures for unusable text.
- [x] Service contracts: plan documents Next.js upload behavior, FastAPI parse request/response/error behavior, Supabase Storage/PostgreSQL boundaries, and timeout/failure expectations.

## Project Structure

### Documentation (this feature)

```text
specs/001-upload-parsing/
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
backend/
├── main.py
├── requirements.txt
├── database/
│   └── supabase.py
└── parsers/
    ├── __init__.py
    ├── base.py
    ├── factory.py
    ├── pdf_parser.py
    ├── docx_parser.py
    ├── pptx_parser.py
    └── txt_parser.py

frontend/
├── app/
│   └── page.tsx
├── components/
│   └── FileUpload.tsx
└── lib/
    └── supabase.ts
```

**Structure Decision**: Keep the existing two-service layout. The frontend owns user interaction and direct Supabase Storage upload; the backend owns parsing, service-role Supabase access, metadata persistence, and temporary-file cleanup. Parser classes are isolated in `backend/parsers/` so each document format can be validated independently without changing the API route.

## Complexity Tracking

No constitution violations require complexity exceptions.
