# Tasks: Multi-Format Parsing Layer & Upload Pipeline

**Input**: Design documents from `/specs/001-upload-parsing/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: No automated test files were explicitly requested. Validation tasks use manual browser checks, FastAPI endpoint checks, parser smoke checks, Supabase storage/database checks, and quickstart.md acceptance checks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task includes exact file paths in the description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare parsing dependencies, shared constants, and directories needed by upload and parser work.

- [X] T001 Add backend parser dependencies `PyPDF2`, `python-docx`, and `python-pptx` to `backend/requirements.txt`
- [X] T002 Create backend parser package marker in `backend/parsers/__init__.py`
- [X] T003 [P] Create frontend components directory for upload UI in `frontend/components/`
- [X] T004 [P] Define shared upload constraints for allowed extensions, MIME types, bucket name, and 10 MB limit in `frontend/lib/upload-config.ts`
- [X] T005 [P] Define backend upload constraints for allowed extensions, MIME types, bucket name, and 10 MB limit in `backend/parsers/config.py`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement shared parser and backend validation foundations before user-story increments.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 Create `DocumentParser` abstract interface in `backend/parsers/base.py`
- [X] T007 [P] Implement `TxtParser` UTF-8 text extraction in `backend/parsers/txt_parser.py`
- [X] T008 [P] Implement `PDFParser` extractable-text parsing with `PyPDF2` in `backend/parsers/pdf_parser.py`
- [X] T009 [P] Implement `DocxParser` paragraph text extraction with `python-docx` in `backend/parsers/docx_parser.py`
- [X] T010 [P] Implement `PptxParser` slide text extraction with `python-pptx` in `backend/parsers/pptx_parser.py`
- [X] T011 Create `ParserFactory` extension and MIME routing in `backend/parsers/factory.py`
- [X] T012 Create parse request validation helpers for storage path, filename, type, size, and user scope in `backend/main.py`
- [X] T013 Update CORS methods to allow frontend parse requests in `backend/main.py`

**Checkpoint**: Parser routing and backend validation foundations are ready for upload and parse stories.

---

## Phase 3: User Story 1 - Upload a valid academic document (Priority: P1) MVP

**Goal**: Let a student select or drag a valid PDF, DOCX, PPTX, or TXT file and block unsupported or oversized files before storage.

**Independent Test**: Try one supported file under 10 MB, one unsupported JPG, and one supported file over 10 MB; confirm only the valid file reaches Supabase Storage and the UI shows clear status.

### Implementation for User Story 1

- [X] T014 [US1] Create `FileUpload` client component with file input and drag-and-drop states in `frontend/components/FileUpload.tsx`
- [X] T015 [US1] Implement client-side extension, MIME type, and 10 MB validation in `frontend/components/FileUpload.tsx`
- [X] T016 [US1] Generate user-aware unique storage paths for accepted files in `frontend/components/FileUpload.tsx`
- [X] T017 [US1] Upload accepted files to Supabase Storage bucket `academic-documents` from `frontend/components/FileUpload.tsx`
- [X] T018 [US1] Render upload accepted, uploading, uploaded, and validation failure states in `frontend/components/FileUpload.tsx`
- [X] T019 [US1] Integrate `FileUpload` into the dashboard in `frontend/app/page.tsx`
- [X] T020 [US1] Validate frontend upload blocking and successful Supabase Storage upload using `specs/001-upload-parsing/quickstart.md`

**Checkpoint**: User Story 1 is independently testable through the browser upload UI and Supabase Storage bucket inspection.

---

## Phase 4: User Story 2 - Extract raw text from uploaded documents (Priority: P2)

**Goal**: Accept a stored file reference, download it temporarily, parse non-empty raw text for supported formats, and delete the temporary file after success or failure.

**Independent Test**: Call the parse endpoint with representative PDF, DOCX, PPTX, and TXT storage objects and confirm each returns extracted text or a clear parsing failure without leaving temporary files behind.

### Implementation for User Story 2

- [X] T021 [US2] Define parse request and response shapes for `POST /api/parse` in `backend/main.py`
- [X] T022 [US2] Implement Supabase Storage download from `academic-documents` to a temporary local file in `backend/main.py`
- [X] T023 [US2] Route downloaded files through `ParserFactory` and reject unsupported parser categories in `backend/main.py`
- [X] T024 [US2] Reject empty or whitespace-only extracted text in `backend/main.py`
- [X] T025 [US2] Return sanitized parsing success and failure responses matching `specs/001-upload-parsing/contracts/openapi.yaml` in `backend/main.py`
- [X] T026 [US2] Ensure temporary local file cleanup runs after successful parsing, parser failure, validation failure, and unexpected errors in `backend/main.py`
- [X] T027 [US2] Log or return a short extracted text preview for validation without durable chunk storage in `backend/main.py`
- [X] T028 [US2] Validate PDF, DOCX, PPTX, TXT, corrupt-file, empty-text, and temporary-cleanup checks using `specs/001-upload-parsing/quickstart.md`

**Checkpoint**: User Story 2 is independently testable through `POST /api/parse` with existing stored files.

---

## Phase 5: User Story 3 - Persist document metadata after parsing (Priority: P3)

**Goal**: Create exactly one `documents` row for each successfully parsed file and create no successful metadata record for failed parsing attempts.

**Independent Test**: Complete a valid upload and parse flow, then confirm one matching document record exists with owner, filename, type, size, storage path, and creation time.

### Implementation for User Story 3

- [X] T029 [US3] Insert a `documents` metadata row after successful text extraction in `backend/main.py`
- [X] T030 [US3] Include `storage_path`, `filename`, `file_type`, `file_size`, and `user_id` in the inserted `documents` row in `backend/main.py`
- [X] T031 [US3] Return the created `document_id` in the parse success response from `backend/main.py`
- [X] T032 [US3] Prevent metadata insertion when parsing fails, extracted text is unusable, or storage ownership validation fails in `backend/main.py`
- [X] T033 [US3] Trigger `POST /api/parse` from the frontend after Supabase upload succeeds in `frontend/components/FileUpload.tsx`
- [X] T034 [US3] Render parsing, parsed-success, and parse-failure states in `frontend/components/FileUpload.tsx`
- [X] T035 [US3] Validate one-row metadata creation and zero-row failure behavior using `specs/001-upload-parsing/quickstart.md`

**Checkpoint**: All user stories should now work together from browser upload through parsing and metadata persistence.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate security boundaries, non-goals, contracts, and readiness across the full upload/parsing pipeline.

- [X] T036 Verify no `SUPABASE_SERVICE_KEY` or backend-only secrets appear in `frontend/`
- [X] T037 Verify `POST /api/parse` behavior matches `specs/001-upload-parsing/contracts/openapi.yaml`
- [X] T038 Run backend syntax/import validation for `backend/main.py` and all files in `backend/parsers/`
- [X] T039 Run frontend lint/build validation for `frontend/`
- [X] T040 Manually exercise the upload UI in a browser and record results in `specs/001-upload-parsing/quickstart.md`
- [X] T041 Verify Phase 3 non-goals by confirming no chunks, embeddings, FAISS updates, or chat UI were added in `backend/`, `frontend/`, and `database/`
- [X] T042 Mark all completed tasks in `specs/001-upload-parsing/tasks.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion and is the MVP.
- **User Story 2 (Phase 4)**: Depends on Foundational completion and can be validated with existing stored files, but end-to-end flow benefits from US1.
- **User Story 3 (Phase 5)**: Depends on US2 parsing success path and integrates with US1 upload success.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 Upload a valid academic document**: Can be completed after Foundational without US2/US3.
- **US2 Extract raw text from uploaded documents**: Can be completed after Foundational using manually prepared storage objects; depends on parser foundation.
- **US3 Persist document metadata after parsing**: Requires US2 parse success and uses US1 end-to-end trigger for full flow.

### Within Each User Story

- Shared constants and parser interfaces before concrete parser routing.
- Client validation before storage upload.
- Backend request validation before storage download.
- Text extraction before metadata insertion.
- Cleanup behavior before endpoint is considered complete.
- UI integration after backend response shapes are stable.

### Parallel Opportunities

- T003, T004, and T005 can run in parallel because they touch separate frontend/backend files.
- T007, T008, T009, and T010 can run in parallel after T006 because each parser lives in a separate file.
- US1 UI work can proceed independently of US2 endpoint implementation after shared constants exist.
- US2 parser endpoint work can proceed independently of US1 if storage objects are prepared manually.
- Polish scans T036, T037, and T041 can run in parallel after implementation is complete.

---

## Parallel Example: Parser Setup

```bash
# After T006 creates the base parser interface, these touch separate parser files:
Task: "Implement TxtParser UTF-8 text extraction in backend/parsers/txt_parser.py"
Task: "Implement PDFParser extractable-text parsing with PyPDF2 in backend/parsers/pdf_parser.py"
Task: "Implement DocxParser paragraph text extraction with python-docx in backend/parsers/docx_parser.py"
Task: "Implement PptxParser slide text extraction with python-pptx in backend/parsers/pptx_parser.py"
```

## Parallel Example: User Stories

```bash
# After Foundational completes and with a manually uploaded storage object available:
Task: "Implement frontend FileUpload validation and storage upload in frontend/components/FileUpload.tsx"
Task: "Implement POST /api/parse download and parser routing in backend/main.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational parser and validation primitives.
3. Complete Phase 3: User Story 1 upload UI and Supabase Storage upload.
4. Stop and validate client file-type/size blocking plus successful bucket upload.
5. Demo the upload flow before adding backend parsing.

### Incremental Delivery

1. Setup + Foundational -> upload constants, parser interface, concrete parsers, and backend validation ready.
2. US1 -> user can select/drag valid files and upload to Supabase Storage.
3. US2 -> backend can parse existing stored files and clean up temporary downloads.
4. US3 -> successful parses create document metadata and frontend shows complete processing status.
5. Polish -> contract, security, browser, and non-goal validation complete.

### Risk Controls

- Do not place `SUPABASE_SERVICE_KEY` in any `frontend/` file.
- Keep backend parse validation independent of frontend validation because `/api/parse` is a trust boundary.
- Treat image-only PDFs, encrypted files, corrupt files, and whitespace-only extraction as explicit parsing failures.
- Keep raw extracted text out of durable chunk storage until Phase 4.
