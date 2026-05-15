# Tasks: Database, Storage & Authentication Foundation

**Input**: Design documents from `/specs/001-supabase-foundation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: No automated test files were explicitly requested. Validation tasks use manual SQL/policy checks, endpoint checks, frontend UI checks, and secret-boundary review from quickstart.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task includes exact file paths in the description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare shared files, dependencies, and environment placeholders needed by the Supabase foundation work.

- [X] T001 Create root database directory for versioned Supabase artifacts in `database/`
- [X] T002 Ensure backend Supabase dependency is present in `backend/requirements.txt`
- [X] T003 Ensure frontend Supabase dependency is present in `frontend/package.json`
- [X] T004 [P] Add backend Supabase placeholders `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `backend/.env`
- [X] T005 [P] Add frontend public Supabase placeholders `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `frontend/.env.local`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define shared schema/security conventions and credential boundaries before implementing user-story increments.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 Define shared Supabase naming and ownership conventions in `database/schema.sql`
- [X] T007 Define backend-only Supabase configuration boundary in `backend/database/supabase.py`
- [X] T008 Define frontend public Supabase configuration boundary in `frontend/lib/supabase.ts`
- [X] T009 Verify frontend files do not reference `SUPABASE_SERVICE_KEY` in `frontend/`
- [X] T010 Review planned API response shapes against `specs/001-supabase-foundation/contracts/openapi.yaml`

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Prepare academic data persistence (Priority: P1) MVP

**Goal**: Provide a version-controlled schema artifact for documents, chunks, chat history, relationships, ownership fields, timestamps, and RLS policies.

**Independent Test**: Review and apply `database/schema.sql`, then confirm `documents`, `chunks`, and `chat_history` exist with required fields, relationships, timestamps, and row-level security enabled.

### Implementation for User Story 1

- [X] T011 [US1] Create `documents` table SQL with id, user_id, filename, file_type, file_size, storage_path, and created_at in `database/schema.sql`
- [X] T012 [US1] Create `chunks` table SQL with id, document_id, text_content, chunk_index, created_at, and cascade relationship to documents in `database/schema.sql`
- [X] T013 [US1] Create `chat_history` table SQL with id, user_id, question, answer, sources_cited, and created_at in `database/schema.sql`
- [X] T014 [US1] Add check constraints for allowed document types, non-negative file sizes, non-empty chunk text, and non-empty chat fields in `database/schema.sql`
- [X] T015 [US1] Enable row level security for `documents`, `chunks`, and `chat_history` in `database/schema.sql`
- [X] T016 [US1] Add ownership policies for `documents` and `chat_history` using Supabase Auth user identity in `database/schema.sql`
- [X] T017 [US1] Add chunk access policies derived from owning `documents.user_id` in `database/schema.sql`
- [X] T018 [US1] Add schema application verification comments for table, relationship, and RLS checks in `database/schema.sql`

**Checkpoint**: User Story 1 is independently testable by applying `database/schema.sql` and inspecting table/RLS definitions.

---

## Phase 4: User Story 2 - Prepare academic document storage (Priority: P2)

**Goal**: Define the Supabase Storage bucket setup for raw academic files with user-aware upload/read rules and supported file categories.

**Independent Test**: Apply the storage setup from `database/schema.sql`, then confirm the `academic-documents` bucket exists and policies align with authenticated uploads and controlled reads.

### Implementation for User Story 2

- [X] T019 [US2] Add SQL to create the `academic-documents` storage bucket in `database/schema.sql`
- [X] T020 [US2] Add storage upload policy for authenticated users in `database/schema.sql`
- [X] T021 [US2] Add storage read policy for authenticated ownership-aware access or explicitly documented public rendering access in `database/schema.sql`
- [X] T022 [US2] Add storage file category guidance for PDF, DOCX, TXT, and PPTX objects in `database/schema.sql`
- [X] T023 [US2] Add storage verification steps for `academic-documents` to `specs/001-supabase-foundation/quickstart.md`

**Checkpoint**: User Story 2 is independently testable by applying storage SQL and manually checking bucket/policy behavior in Supabase.

---

## Phase 5: User Story 3 - Verify app-to-database connectivity (Priority: P3)

**Goal**: Prove backend and frontend can initialize Supabase clients and report controlled connectivity results without exposing backend-only secrets.

**Independent Test**: Run the backend `/api/db-test` endpoint and the frontend Supabase connectivity UI/route with valid Supabase configuration; confirm success or permission-aware failures match the contract.

### Implementation for User Story 3

- [X] T024 [P] [US3] Create backend package marker for database utilities in `backend/database/__init__.py`
- [X] T025 [US3] Implement `get_supabase_client` using `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `backend/database/supabase.py`
- [X] T026 [US3] Add sanitized missing-configuration error handling for backend Supabase setup in `backend/database/supabase.py`
- [X] T027 [US3] Implement `GET /api/db-test` diagnostic write/read endpoint in `backend/main.py`
- [X] T028 [US3] Ensure `/api/db-test` returns success and failure shapes matching `specs/001-supabase-foundation/contracts/openapi.yaml` in `backend/main.py`
- [X] T029 [US3] Implement frontend Supabase client initialization with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `frontend/lib/supabase.ts`
- [X] T030 [US3] Add frontend Supabase connectivity status state to `frontend/app/page.tsx`
- [X] T031 [US3] Render frontend Supabase success, permission-aware failure, and missing-config states in `frontend/app/page.tsx`
- [X] T032 [US3] Validate backend connectivity with `curl http://localhost:8000/api/db-test` using `specs/001-supabase-foundation/quickstart.md`
- [X] T033 [US3] Validate frontend Supabase connectivity in browser at `http://localhost:3000` using `specs/001-supabase-foundation/quickstart.md`

**Checkpoint**: User Story 3 is independently testable by running both services and verifying backend/frontend Supabase connectivity outcomes.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate security boundaries, documentation consistency, and implementation readiness across all stories.

- [X] T034 Verify no real Supabase keys or backend-only secrets are committed in `.gitignore`, `backend/.env`, `frontend/.env.local`, `backend/`, and `frontend/`
- [X] T035 Validate `database/schema.sql` against requirements FR-001 through FR-010 in `specs/001-supabase-foundation/spec.md`
- [X] T036 Validate backend and frontend connectivity requirements FR-011 through FR-014 against `specs/001-supabase-foundation/spec.md`
- [X] T037 Update quickstart validation results for schema, storage, backend, frontend, and secret-boundary checks in `specs/001-supabase-foundation/quickstart.md`
- [X] T038 Run frontend build validation with `npm run build --prefix frontend` after Supabase UI changes
- [X] T039 Run backend import/health validation from `backend/main.py`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion and is the MVP.
- **User Story 2 (Phase 4)**: Depends on Foundational completion; can be implemented after or alongside US1 but storage verification is clearer after schema conventions exist.
- **User Story 3 (Phase 5)**: Depends on Foundational completion and benefits from US1 because `/api/db-test` writes to `chat_history`.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 Prepare academic data persistence**: No dependency on other user stories after Foundational.
- **US2 Prepare academic document storage**: No dependency on US3; shares schema artifact with US1.
- **US3 Verify app-to-database connectivity**: Requires `chat_history` from US1 for the requested diagnostic write/read.

### Within Each User Story

- Schema definitions before policies.
- Backend/client utilities before endpoints or UI checks.
- Contract shape review before endpoint response implementation.
- Core implementation before quickstart validation.

### Parallel Opportunities

- T004 and T005 can run in parallel because they touch separate env files.
- US3 task T024 can run in parallel with frontend task T029 after Foundational is complete.
- US1 and US2 can be implemented in parallel only with careful coordination because both edit `database/schema.sql`; otherwise do them sequentially.
- Polish review tasks T034, T035, and T036 can be split after implementation is complete.

---

## Parallel Example: User Story 3

```bash
# After Foundational tasks complete, these touch different files and can start together:
Task: "Create backend package marker for database utilities in backend/database/__init__.py"
Task: "Implement frontend Supabase client initialization with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in frontend/lib/supabase.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Stop and validate `database/schema.sql` creates the required records and policies.
5. Demo the schema artifact before adding storage or connectivity work.

### Incremental Delivery

1. Setup + Foundational -> credential boundaries and shared conventions ready.
2. US1 -> persistence schema ready.
3. US2 -> storage bucket and policy setup ready.
4. US3 -> backend/frontend Supabase connectivity verified.
5. Polish -> secret-boundary, build, and quickstart validation complete.

### Risk Controls

- Do not place `SUPABASE_SERVICE_KEY` in any `frontend/` file.
- Keep any local-testing policy caveat explicit in `database/schema.sql`.
- Treat Supabase dashboard/project creation as a manual prerequisite, not an implemented code task.
