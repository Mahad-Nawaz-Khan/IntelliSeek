# Tasks: Environment Setup & Infrastructure Foundation

**Input**: Design documents from `/specs/001-setup-infrastructure/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: No separate automated test tasks are generated because the feature specification requests manual quickstart verification and endpoint checks, not TDD.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the root service boundaries and shared repository guidance.

- [X] T001 Create root service directories `frontend/` and `backend/`
- [X] T002 Create combined Python, Node, Next.js, virtualenv, build output, and environment ignore rules in `.gitignore`
- [X] T003 Create root development guide with frontend and backend startup overview in `README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add dependency manifests and placeholder environment files required before any user story can run.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Create backend dependency manifest with `fastapi`, `uvicorn`, `python-dotenv`, and `supabase` in `backend/requirements.txt`
- [X] T005 Create backend environment placeholder file with `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and `GROQ_API_KEY` in `backend/.env`
- [X] T006 Create frontend environment placeholder file with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `frontend/.env.local`
- [X] T007 Initialize Next.js App Router TypeScript and Tailwind project files in `frontend/package.json`, `frontend/tsconfig.json`, `frontend/tailwind.config.ts`, `frontend/app/layout.tsx`, and `frontend/app/globals.css`
- [X] T008 Add `@supabase/supabase-js` to frontend dependencies in `frontend/package.json`

**Checkpoint**: Shared structure, dependencies, and environment placeholders are ready for user story implementation.

---

## Phase 3: User Story 1 - Start the IntelliSeek workspace locally (Priority: P1) MVP

**Goal**: A developer can identify the project structure and start each local service from documented instructions.

**Independent Test**: Open the repository, read `README.md`, confirm `frontend/` and `backend/` are separate, and follow the documented service startup commands.

### Implementation for User Story 1

- [X] T009 [US1] Document frontend setup, backend setup, expected ports, and startup order in `README.md`
- [X] T010 [US1] Add backend local run instructions using a virtual environment and `uvicorn main:app --reload` in `README.md`
- [X] T011 [US1] Add frontend local run instructions using `npm install` and `npm run dev` in `README.md`
- [X] T012 [US1] Document service ownership boundaries and no-cross-service-code rule in `README.md`
- [X] T013 [US1] Verify root layout and startup instructions against quickstart acceptance checks in `specs/001-setup-infrastructure/quickstart.md`

**Checkpoint**: User Story 1 is complete when a contributor can locate both services and identify both startup commands from the root guide within 2 minutes.

---

## Phase 4: User Story 2 - Verify backend availability (Priority: P2)

**Goal**: The backend service can start locally and return the exact healthy status without real Supabase or Groq credentials.

**Independent Test**: Start the backend from `backend/`, request `http://localhost:8000/api/health`, and receive `{"status":"IntelliSeek Backend is healthy"}`.

### Implementation for User Story 2

- [X] T014 [US2] Create FastAPI application instance and load local environment placeholders in `backend/main.py`
- [X] T015 [US2] Implement `GET /api/health` returning the exact healthy status JSON in `backend/main.py`
- [X] T016 [US2] Configure FastAPI CORS middleware to allow `http://localhost:3000` in `backend/main.py`
- [X] T017 [US2] Ensure backend startup does not require live Supabase or Groq connections in `backend/main.py`
- [X] T018 [US2] Verify backend health behavior against `specs/001-setup-infrastructure/contracts/openapi.yaml` and document command output expectations in `specs/001-setup-infrastructure/quickstart.md`

**Checkpoint**: User Story 2 is complete when the backend starts locally and `/api/health` returns the exact expected JSON without real external credentials.

---

## Phase 5: User Story 3 - Confirm frontend-to-backend communication (Priority: P3)

**Goal**: The frontend displays its running state and surfaces backend health or unavailable status through the local UI.

**Independent Test**: Start both services, open `http://localhost:3000`, confirm the frontend running dashboard displays backend health, then stop the backend and confirm a clear unavailable state.

### Implementation for User Story 3

- [X] T019 [US3] Implement frontend-owned backend health check route with healthy and unavailable responses in `frontend/app/api/test-backend/route.ts`
- [X] T020 [US3] Create landing status dashboard that shows frontend running state in `frontend/app/page.tsx`
- [X] T021 [US3] Display backend health result from `/api/test-backend` on the landing dashboard in `frontend/app/page.tsx`
- [X] T022 [US3] Display a clear backend unavailable state when the backend check fails in `frontend/app/page.tsx`
- [X] T023 [US3] Verify frontend integration behavior against `specs/001-setup-infrastructure/contracts/openapi.yaml` and manual checks in `specs/001-setup-infrastructure/quickstart.md`

**Checkpoint**: User Story 3 is complete when the frontend displays backend health with both services running and an unavailable state when the backend is stopped.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the whole Phase 1 skeleton and remove setup friction.

- [X] T024 Run backend startup and health check from `backend/` using commands documented in `README.md`
- [X] T025 Run frontend startup from `frontend/` using commands documented in `README.md`
- [X] T026 Validate `http://localhost:3000/api/test-backend` matches `specs/001-setup-infrastructure/contracts/openapi.yaml`
- [X] T027 Validate all quickstart acceptance checks in `specs/001-setup-infrastructure/quickstart.md`
- [X] T028 Review `frontend/.env.local`, `backend/.env`, and `.gitignore` to confirm no real secrets are committed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies; starts immediately.
- **Phase 2 Foundational**: Depends on Phase 1 because service directories must exist first.
- **Phase 3 User Story 1**: Depends on Phase 2 so documentation can reference actual manifests and environment files.
- **Phase 4 User Story 2**: Depends on Phase 2 so backend dependencies and placeholders exist.
- **Phase 5 User Story 3**: Depends on Phase 4 because frontend communication needs backend health behavior.
- **Phase 6 Polish**: Depends on all selected user stories.

### User Story Dependencies

- **US1 (P1)**: Can complete after foundational setup; does not require backend implementation.
- **US2 (P2)**: Can complete after foundational setup; does not require frontend implementation.
- **US3 (P3)**: Requires US2 health endpoint and CORS behavior; integrates with frontend foundation.

### Within Each User Story

- US1: README overview before detailed startup commands; verify against quickstart last.
- US2: FastAPI app before health route; health route before CORS verification.
- US3: API test route before dashboard display; dashboard display before unavailable-state verification.

### Parallel Opportunities

- T004, T005, T006 can run in parallel after `backend/` and `frontend/` exist.
- T009, T010, T011, and T012 touch `README.md` and should be sequential to avoid conflicts.
- T014 through T017 all touch `backend/main.py` and should be sequential.
- T019 and T020 can run in parallel because they touch different frontend files.
- T024 and T025 can run in parallel after implementation is complete.

---

## Parallel Example: Foundational Setup

```bash
Task: "Create backend dependency manifest with fastapi, uvicorn, python-dotenv, and supabase in backend/requirements.txt"
Task: "Create backend environment placeholder file with SUPABASE_URL, SUPABASE_SERVICE_KEY, and GROQ_API_KEY in backend/.env"
Task: "Create frontend environment placeholder file with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in frontend/.env.local"
```

## Parallel Example: User Story 3

```bash
Task: "Implement frontend-owned backend health check route with healthy and unavailable responses in frontend/app/api/test-backend/route.ts"
Task: "Create landing status dashboard that shows frontend running state in frontend/app/page.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Stop and validate that the root layout and README satisfy US1 independent test criteria.

### Incremental Delivery

1. Deliver US1 so contributors can understand and start the workspace.
2. Deliver US2 so backend availability is independently verifiable.
3. Deliver US3 so frontend-to-backend communication is visible in the browser.
4. Complete polish checks to validate quickstart and secret hygiene.

### Manual Verification Focus

- Backend health check: `curl http://localhost:8000/api/health`
- Frontend backend test route: `curl http://localhost:3000/api/test-backend`
- Browser UI: `http://localhost:3000`

---

## Summary

- Total tasks: 28
- Setup tasks: 3
- Foundational tasks: 5
- US1 tasks: 5
- US2 tasks: 5
- US3 tasks: 5
- Polish tasks: 5
- Suggested MVP scope: Phase 1 + Phase 2 + User Story 1
