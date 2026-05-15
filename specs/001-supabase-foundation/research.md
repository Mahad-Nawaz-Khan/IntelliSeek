# Research: Database, Storage & Authentication Foundation

## Decision: Keep PostgreSQL as the source of truth for chunk text

**Rationale**: Supabase PostgreSQL stores canonical academic document metadata, extracted chunk text, ownership, timestamps, and chat citations. Later FAISS integration should store vector index data and stable record identifiers, not the authoritative chunk text or metadata.

**Alternatives considered**:

- Store chunk text only in FAISS metadata: rejected because FAISS is not the project source of truth and is harder to audit with relational ownership and chat history.
- Store chunks in raw files only: rejected because later retrieval, citation, and policy checks need structured records.

## Decision: Use direct Supabase clients in both Next.js and FastAPI

**Rationale**: Supabase documentation supports initializing JavaScript clients with a public publishable/anon key because RLS policies enforce access based on the user's JWT. FastAPI can initialize `supabase-py` with backend-only configuration for diagnostic writes and future privileged processing. This reduces latency for simple frontend reads/auth while keeping AI-heavy and service-key workflows in Python.

**Alternatives considered**:

- Route all Supabase access through FastAPI: rejected because it adds unnecessary latency and duplicates Supabase Auth/RLS behavior for simple frontend operations.
- Use only Next.js API routes for database work: rejected because later FAISS, parsing, and SentenceTransformers workflows belong in the Python service.

## Decision: Version Supabase SQL in root `database/schema.sql`

**Rationale**: The schema is shared infrastructure for both services, so the root-level `database/` directory provides a single version-controlled artifact for table creation, RLS, and storage setup. This also supports manual application through the Supabase SQL editor during student/local development.

**Alternatives considered**:

- Keep schema SQL under `backend/`: rejected because frontend and backend both depend on the same database contract.
- Rely only on Supabase dashboard state: rejected because the project requires version-controlled schema management.

## Decision: Define authenticated ownership policies with an explicit local-testing caveat

**Rationale**: The schema should be structured around `auth.uid()` ownership policies so it can become production-safe without redesign. For local testing, diagnostic backend operations may use the service role and frontend checks may surface permission-aware failures until login UI exists.

**Alternatives considered**:

- Fully open table policies: rejected as the default because it conflicts with secure student data boundaries.
- Block all frontend reads until auth UI exists: rejected because Phase 2 needs a frontend connectivity check; a permission-aware failure is acceptable where no authenticated session exists.

## Decision: Storage bucket policies allow authenticated uploads and controlled reads

**Rationale**: `academic-documents` must accept PDF, DOCX, TXT, and PPTX files for future upload flows while preserving user boundaries. Public reads are acceptable only if intentionally required for document rendering; otherwise reads should use authenticated ownership-aware policies.

**Alternatives considered**:

- Make the bucket public by default: rejected because academic documents may contain sensitive student data.
- Skip storage policies in Phase 2: rejected because storage readiness is a success criterion.

## Decision: Diagnostic records use `chat_history`

**Rationale**: The user requested `/api/db-test` to write a dummy record to `chat_history` and read it back. The diagnostic record should use a recognizable question/source marker so it does not look like user-facing academic content.

**Alternatives considered**:

- Add a separate diagnostics table: rejected because the spec only requires `documents`, `chunks`, and `chat_history`.
- Test read-only access: rejected because the success criteria require controlled read/write verification.
