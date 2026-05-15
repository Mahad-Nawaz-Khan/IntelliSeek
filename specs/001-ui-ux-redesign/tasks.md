# Tasks: UI UX Redesign

**Input**: Design documents from `/specs/001-ui-ux-redesign/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-state.openapi.yaml, quickstart.md

**Tests**: No automated tests were explicitly requested in the feature specification. Validation tasks use `npm --prefix frontend run lint`, `npm --prefix frontend run build`, and manual browser checks from quickstart.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- All tasks include exact file paths

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare shared route structure, visual tokens, and reusable UI primitives for the redesign.

- [X] T001 Audit current frontend component entry points in frontend/app/page.tsx and frontend/components/ChatLayout.tsx before moving UI responsibilities
- [X] T002 [P] Add shared academic dark theme tokens and global surface styles in frontend/app/globals.css
- [X] T003 [P] Configure Geist or Inter font usage and metadata for the redesigned shell in frontend/app/layout.tsx
- [X] T004 [P] Create shared button/card/badge primitives for the redesign in frontend/components/ui/
- [X] T005 [P] Create shared UI state types from the data model in frontend/lib/ui-state.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish reusable layout and state helpers required before user story implementation.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 Create domain component folders frontend/components/chat/, frontend/components/sidebar/, frontend/components/upload/, frontend/components/sources/, and frontend/components/ui/
- [X] T007 Implement reusable source grouping and upload-status sample state helpers in frontend/lib/ui-state.ts
- [X] T008 Implement the main workspace shell layout container in frontend/components/chat/AcademicWorkspace.tsx
- [X] T009 Implement responsive page background and glass surface utilities used by all redesigned pages in frontend/app/globals.css
- [X] T010 Verify existing Trie autocomplete remains available through frontend/lib/trie-autocomplete.ts and is not broken by component migration

**Checkpoint**: Foundation ready - user story implementation can now begin in priority order or in parallel by story.

---

## Phase 3: User Story 1 - Start a premium academic chat (Priority: P1) MVP

**Goal**: Deliver the main assistant experience as a polished academic AI workspace with welcome state, suggested prompts, chat messages, citations support, and sticky input.

**Independent Test**: Open `/chat` with no messages and verify a dark academic workspace with assistant header, welcome prompt, suggested prompt cards, visible sidebar area, sticky input, and clear academic positioning.

### Implementation for User Story 1

- [X] T011 [P] [US1] Create assistant header component with upload, theme, and profile affordances in frontend/components/chat/ChatHeader.tsx
- [X] T012 [P] [US1] Create welcome state and suggested prompt card component in frontend/components/chat/ChatWelcome.tsx
- [X] T013 [P] [US1] Create user and assistant message components with rich text styling hooks in frontend/components/chat/ChatMessage.tsx
- [X] T014 [P] [US1] Create redesigned sticky chat input wrapper that preserves Enter, Shift+Enter, upload action, and Trie autocomplete behavior in frontend/components/chat/ChatComposer.tsx
- [X] T015 [US1] Integrate ChatHeader, ChatWelcome, ChatMessage, and ChatComposer into frontend/components/ChatLayout.tsx without changing existing chat submission behavior
- [X] T016 [US1] Add `/chat` App Router page that renders the existing chat experience through the redesigned shell in frontend/app/chat/page.tsx
- [X] T017 [US1] Update landing route CTA targets to point users toward `/chat` in frontend/app/page.tsx
- [ ] T018 [US1] Manually validate User Story 1 against quickstart.md chat workspace checklist using `npm --prefix frontend run dev`

**Checkpoint**: User Story 1 is independently functional and demoable as the MVP assistant workspace.

---

## Phase 4: User Story 2 - Navigate knowledge and chats from the sidebar (Priority: P2)

**Goal**: Provide a persistent, source-oriented sidebar with logo, new chat, knowledge base, uploads, recent chats, and settings.

**Independent Test**: View the assistant layout and verify the sidebar sections are recognizable, visually separated, responsive to hover/focus, and safe with empty or long-title states.

### Implementation for User Story 2

- [X] T019 [P] [US2] Create sidebar shell with brand area, new chat action, and settings entry in frontend/components/sidebar/AppSidebar.tsx
- [X] T020 [P] [US2] Create source group list component for Knowledge Base and Your Uploads in frontend/components/sidebar/SourceGroups.tsx
- [X] T021 [P] [US2] Create recent chats list with populated and empty states in frontend/components/sidebar/RecentChats.tsx
- [X] T022 [US2] Connect existing Supabase document metadata from frontend/components/ChatLayout.tsx to SourceGroups in frontend/components/sidebar/SourceGroups.tsx
- [X] T023 [US2] Integrate AppSidebar into frontend/components/chat/AcademicWorkspace.tsx and frontend/components/ChatLayout.tsx
- [X] T024 [US2] Add active navigation links for `/chat`, `/library`, and `/settings` in frontend/components/sidebar/AppSidebar.tsx
- [ ] T025 [US2] Manually validate User Story 2 against quickstart.md sidebar checklist using `npm --prefix frontend run dev`

**Checkpoint**: User Story 2 is independently functional while preserving the User Story 1 chat flow.

---

## Phase 5: User Story 3 - Upload files with clear progress and completion feedback (Priority: P3)

**Goal**: Redesign upload into a modern drag-and-drop modal with supported format messaging, progress states, success states, failure states, and retry affordance.

**Independent Test**: Open upload from the chat workspace and verify supported formats, uploading/indexing states, indexed-file feedback, and readable failure feedback.

### Implementation for User Story 3

- [X] T026 [P] [US3] Create upload modal shell with accessible open/close behavior in frontend/components/upload/UploadModal.tsx
- [X] T027 [P] [US3] Create drag-and-drop upload zone with PDF, DOCX, PPTX, and TXT messaging in frontend/components/upload/UploadDropzone.tsx
- [X] T028 [P] [US3] Create upload progress and indexed-file status component in frontend/components/upload/UploadProgress.tsx
- [X] T029 [US3] Adapt existing file upload behavior from frontend/components/FileUpload.tsx into the new upload components without changing accepted file handling
- [X] T030 [US3] Wire upload modal open actions from frontend/components/chat/ChatHeader.tsx and frontend/components/chat/ChatComposer.tsx
- [X] T031 [US3] Add failed upload and retry UI state handling in frontend/components/upload/UploadModal.tsx
- [ ] T032 [US3] Manually validate User Story 3 against quickstart.md upload checklist using `npm --prefix frontend run dev`

**Checkpoint**: User Story 3 is independently functional and upload feedback is clear during idle, uploading, indexing, indexed, and failed states.

---

## Phase 6: User Story 4 - Understand retrieved sources during answer generation (Priority: P4)

**Goal**: Make retrieval progress and source citations visible through compact chips, hover/focus previews, and optional retrieval visualization without changing backend RAG behavior.

**Independent Test**: Ask a sourced question and verify analysis/retrieval feedback, readable citation chips, optional previews, and clear no-source/insufficient-context states.

### Implementation for User Story 4

- [X] T033 [P] [US4] Create compact source citation chip with hover/focus preview support in frontend/components/sources/SourceChip.tsx
- [X] T034 [P] [US4] Create retrieval status visualization for analyzing, retrieving, answering, complete, and error states in frontend/components/sources/RetrievalStatus.tsx
- [X] T035 [P] [US4] Create optional retrieved source preview panel in frontend/components/sources/RetrievalPanel.tsx
- [X] T036 [US4] Replace or wrap existing citation rendering from frontend/components/SourceCitation.tsx with SourceChip in frontend/components/chat/ChatMessage.tsx
- [X] T037 [US4] Surface answer-preparation feedback in frontend/components/ChatLayout.tsx while preserving the existing chat API call flow
- [X] T038 [US4] Add clear no-source and insufficient-context visual states in frontend/components/chat/ChatMessage.tsx
- [ ] T039 [US4] Manually validate User Story 4 against quickstart.md retrieval and citations checklist using `npm --prefix frontend run dev`

**Checkpoint**: User Story 4 is independently functional and sourced answers feel academically grounded.

---

## Phase 7: User Story 5 - Use IntelliSeek comfortably on mobile (Priority: P5)

**Goal**: Ensure the redesigned assistant remains usable on narrow screens with collapsible sidebar access, reachable input, compact citations, and no horizontal overflow.

**Independent Test**: Resize to a mobile viewport and verify the chat remains primary, sidebar is accessible through a compact control, upload remains reachable, and citations wrap without layout breakage.

### Implementation for User Story 5

- [X] T040 [P] [US5] Add mobile sidebar toggle and overlay behavior in frontend/components/chat/AcademicWorkspace.tsx
- [X] T041 [P] [US5] Add compact mobile styling for sidebar sections in frontend/components/sidebar/AppSidebar.tsx
- [X] T042 [P] [US5] Add compact wrapping behavior for citation chips in frontend/components/sources/SourceChip.tsx
- [X] T043 [US5] Ensure sticky composer spacing does not cover the latest message in frontend/components/chat/ChatComposer.tsx
- [ ] T044 [US5] Validate mobile viewport behavior for `/chat` in frontend/app/chat/page.tsx using browser responsive mode
- [ ] T045 [US5] Manually validate User Story 5 against quickstart.md mobile checklist using `npm --prefix frontend run dev`

**Checkpoint**: User Story 5 is independently functional and the assistant is demoable on mobile widths.

---

## Phase 8: Additional Surfaces - Landing, Library, and Settings

**Purpose**: Complete required route surfaces beyond the main chat workspace.

- [X] T046 [P] Create redesigned landing page hero, CTAs, feature grid, and demo preview in frontend/app/page.tsx
- [X] T047 [P] Create library page for uploaded and built-in sources with long filename-safe cards in frontend/app/library/page.tsx
- [X] T048 [P] Create settings page with disabled or coming-soon preference controls in frontend/app/settings/page.tsx
- [X] T049 Connect sidebar navigation and landing CTAs across `/`, `/chat`, `/library`, and `/settings` in frontend/components/sidebar/AppSidebar.tsx and frontend/app/page.tsx
- [ ] T050 Manually validate landing, library, and settings checklists from specs/001-ui-ux-redesign/quickstart.md using `npm --prefix frontend run dev`

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Validate the complete redesign, preserve existing behavior, and ensure Vercel-compatible build quality.

- [X] T051 [P] Add reduced-motion-safe transitions and hover/focus states across frontend/app/globals.css and redesigned components
- [X] T052 [P] Audit long filename, empty source, empty recent chat, upload failure, and no-source states across frontend/components/sidebar/, frontend/components/upload/, and frontend/components/sources/
- [X] T053 Run `npm --prefix frontend run lint` and fix any lint issues in frontend/
- [X] T054 Run `npm --prefix frontend run build` and fix any build issues in frontend/
- [ ] T055 Run full manual quickstart validation from specs/001-ui-ux-redesign/quickstart.md for desktop and mobile
- [X] T056 Review frontend code for server-only secret exposure and confirm no `GROQ_API_KEY` or `SUPABASE_SERVICE_KEY` usage appears in client components
- [X] T057 Mark completed implementation tasks in specs/001-ui-ux-redesign/tasks.md as work is finished during `/sp.implement`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories.
- **User Stories (Phases 3-7)**: Depend on Foundational completion.
- **Additional Surfaces (Phase 8)**: Can start after Foundational, but final navigation integration benefits from US2 sidebar completion.
- **Polish (Phase 9)**: Depends on all desired stories and route surfaces being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundation - MVP and core chat workspace.
- **User Story 2 (P2)**: Starts after Foundation - can integrate with US1 shell but remains testable through sidebar sections.
- **User Story 3 (P3)**: Starts after Foundation and uses US1 header/composer upload entry points.
- **User Story 4 (P4)**: Starts after Foundation and uses US1 message rendering.
- **User Story 5 (P5)**: Starts after Foundation and is easiest after US1 and US2 shell/sidebar exist.

### Within Each User Story

- Build leaf components before integrating them into `ChatLayout.tsx` or App Router pages.
- Preserve existing chat submission, upload, Supabase document metadata loading, and Trie autocomplete behavior while redesigning visuals.
- Complete each story's manual validation checkpoint before moving to the next priority when working sequentially.

### Parallel Opportunities

- T002-T005 can run in parallel after T001.
- T011-T014 can run in parallel before T015.
- T019-T021 can run in parallel before T022-T024.
- T026-T028 can run in parallel before T029-T031.
- T033-T035 can run in parallel before T036-T038.
- T040-T042 can run in parallel before T043-T045.
- T046-T048 can run in parallel after Foundation.
- T051-T052 can run in parallel before final lint/build/manual validation.

---

## Parallel Example: User Story 1

```text
Task: "Create assistant header component with upload, theme, and profile affordances in frontend/components/chat/ChatHeader.tsx"
Task: "Create welcome state and suggested prompt card component in frontend/components/chat/ChatWelcome.tsx"
Task: "Create user and assistant message components with rich text styling hooks in frontend/components/chat/ChatMessage.tsx"
Task: "Create redesigned sticky chat input wrapper that preserves Enter, Shift+Enter, upload action, and Trie autocomplete behavior in frontend/components/chat/ChatComposer.tsx"
```

## Parallel Example: User Story 4

```text
Task: "Create compact source citation chip with hover/focus preview support in frontend/components/sources/SourceChip.tsx"
Task: "Create retrieval status visualization for analyzing, retrieving, answering, complete, and error states in frontend/components/sources/RetrievalStatus.tsx"
Task: "Create optional retrieved source preview panel in frontend/components/sources/RetrievalPanel.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Stop and validate `/chat` against the User Story 1 independent test.
5. Run `npm --prefix frontend run lint` and `npm --prefix frontend run build` before demoing MVP.

### Incremental Delivery

1. Add User Story 1 for the premium chat MVP.
2. Add User Story 2 for workspace/sidebar credibility.
3. Add User Story 3 for upload trust and indexed-file feedback.
4. Add User Story 4 for source-grounded academic differentiation.
5. Add User Story 5 for responsive polish.
6. Add landing, library, and settings routes.
7. Complete polish validation and Vercel-compatible build checks.

### Non-Goals During These Tasks

- Do not change backend retrieval, embeddings, or Groq answer-generation behavior in this UI redesign.
- Do not add Framer Motion unless explicitly approved as a dependency change during implementation.
- Do not remove the existing Trie autocomplete feature.
- Do not expose server-only secrets in client components or `NEXT_PUBLIC_` variables.
