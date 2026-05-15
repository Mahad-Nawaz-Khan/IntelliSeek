# Tasks: Frontend Chat UI

**Input**: Design documents from `/specs/001-frontend-chat-ui/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Automated test files are not generated because the feature spec does not explicitly request TDD/unit tests. Validation tasks are included for lint, build, and manual browser checks required by quickstart.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add Phase 6 frontend dependencies and confirm existing Next.js/Tailwind structure.

- [X] T001 Add `lucide-react` and `react-markdown` dependencies in `frontend/package.json`
- [X] T002 Run dependency installation to update `frontend/package-lock.json`
- [X] T003 Verify Tailwind CSS 4 global styles remain available in `frontend/app/globals.css`
- [X] T004 Verify existing upload component import path and exports in `frontend/components/FileUpload.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define shared frontend types and chat API helper before UI stories use them.

**Critical**: No user story work can begin until this phase is complete.

- [X] T005 Create shared chat/source types for `ChatMessage`, `SourceCitation`, `ChatRequest`, and `ChatResponse` in `frontend/lib/chat-api.ts`
- [X] T006 Implement `submitChatQuestion(question: string, userId: string)` using the existing `POST /api/chat` contract in `frontend/lib/chat-api.ts`
- [X] T007 Ensure `submitChatQuestion` sends only `question` and `user_id`, never previous messages, in `frontend/lib/chat-api.ts`
- [X] T008 Implement controlled error normalization for non-OK chat responses and network failures in `frontend/lib/chat-api.ts`

**Checkpoint**: Typed frontend chat API helper is ready for UI integration.

---

## Phase 3: User Story 1 - Ask Questions in a Chat Workspace (Priority: P1) MVP

**Goal**: A student can type a question, submit it, see a loading state, and receive a readable assistant response in the chat workspace.

**Independent Test**: Open the frontend, type a question, submit with Enter, observe the user message and loading state, and confirm an assistant answer or error message appears without leaving the page.

### Implementation for User Story 1

- [X] T009 [P] [US1] Create textarea chat input component with Enter submit and Shift+Enter newline handling in `frontend/components/ChatInput.tsx`
- [X] T010 [P] [US1] Create role-based message bubble component for user, assistant, loading, and error states in `frontend/components/MessageBubble.tsx`
- [X] T011 [US1] Create main client chat layout state for `messages`, `isLoading`, and submit handling in `frontend/components/ChatLayout.tsx`
- [X] T012 [US1] Wire `ChatLayout` submission to `submitChatQuestion` and append user plus assistant messages in `frontend/components/ChatLayout.tsx`
- [X] T013 [US1] Add visible pulsing-dot or skeleton loading indicator through `MessageBubble` usage in `frontend/components/ChatLayout.tsx`
- [X] T014 [US1] Implement simulated assistant typing reveal for successful answers in `frontend/components/ChatLayout.tsx`
- [X] T015 [US1] Replace the current upload-only page with `ChatLayout` route entry in `frontend/app/page.tsx`
- [X] T016 [US1] Validate empty or whitespace-only input is not submitted in `frontend/components/ChatInput.tsx`

**Checkpoint**: User Story 1 is independently functional as a chat loop without source pills or sidebar enhancements.

---

## Phase 4: User Story 2 - Review Answer Sources (Priority: P2)

**Goal**: A student can see source filename citations attached to assistant answers.

**Independent Test**: Use a mocked or live response with source metadata and confirm each source filename appears as a visible citation element on the assistant message.

### Implementation for User Story 2

- [X] T017 [P] [US2] Create source citation pill component for filename, document ID, chunk ID, and chunk index metadata in `frontend/components/SourceCitation.tsx`
- [X] T018 [US2] Render source citation pills inside assistant messages in `frontend/components/MessageBubble.tsx`
- [X] T019 [US2] Pass returned `sources` from `submitChatQuestion` into assistant `ChatMessage` objects in `frontend/components/ChatLayout.tsx`
- [X] T020 [US2] Add no-source fallback display for assistant messages without source metadata in `frontend/components/MessageBubble.tsx`
- [X] T021 [US2] Render assistant markdown content safely with `react-markdown` while keeping citations separate in `frontend/components/MessageBubble.tsx`

**Checkpoint**: User Stories 1 and 2 work independently when answers include citations and source metadata.

---

## Phase 5: User Story 3 - Start From Suggested Questions (Priority: P3)

**Goal**: A student can start from suggested academic prompt chips when the conversation is empty.

**Independent Test**: Load an empty conversation, click `Explain recursion`, and confirm it submits immediately as the first user question.

### Implementation for User Story 3

- [X] T022 [P] [US3] Create suggested query chip component with three to four academic prompts in `frontend/components/SuggestedQueries.tsx`
- [X] T023 [US3] Render `SuggestedQueries` only when the chat message list is empty in `frontend/components/ChatLayout.tsx`
- [X] T024 [US3] Wire suggested query clicks to the same submit path as manual input in `frontend/components/ChatLayout.tsx`
- [X] T025 [US3] Ensure suggested queries are hidden or de-emphasized after the first message appears in `frontend/components/ChatLayout.tsx`

**Checkpoint**: User Stories 1, 2, and 3 work when cold-start chips submit questions and the normal chat flow continues.

---

## Phase 6: User Story 4 - Manage Sources and Uploads From the Workspace (Priority: P4)

**Goal**: A student can view source/upload context in a sidebar while using the main chat area.

**Independent Test**: Open the chat workspace and confirm a responsive sidebar contains upload controls, a source list/empty/unavailable state, and does not block chat usage on smaller screens.

### Implementation for User Story 4

- [X] T026 [US4] Build responsive two-pane layout shell with sidebar and main chat area in `frontend/components/ChatLayout.tsx`
- [X] T027 [US4] Integrate existing `FileUpload` into the sidebar in `frontend/components/ChatLayout.tsx`
- [X] T028 [US4] Add knowledge source loading from the existing Supabase `documents` table in `frontend/components/ChatLayout.tsx`
- [X] T029 [US4] Render compact source list, empty state, and unavailable state in the sidebar in `frontend/components/ChatLayout.tsx`
- [X] T030 [US4] Apply dark academic glassmorphism styling to sidebar, header, chat surface, and input shell in `frontend/components/ChatLayout.tsx`
- [X] T031 [US4] Ensure responsive sidebar behavior preserves chat usability on reduced viewport widths in `frontend/components/ChatLayout.tsx`

**Checkpoint**: All user stories are independently functional in the full two-pane workspace.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate end-to-end behavior, polish UX, and confirm Phase 6 boundaries.

- [X] T032 Add auto-scroll to latest message after send, load, and typing updates in `frontend/components/ChatLayout.tsx`
- [X] T033 [P] Polish hover states, transitions, and focus-visible styling in `frontend/components/ChatInput.tsx`
- [X] T034 [P] Polish hover states, transitions, and spacing in `frontend/components/MessageBubble.tsx`
- [X] T035 [P] Polish hover states and transitions in `frontend/components/SuggestedQueries.tsx`
- [X] T036 [P] Polish citation pill contrast and wrapping in `frontend/components/SourceCitation.tsx`
- [X] T037 Run `npm run lint` from `frontend/` and record results in `specs/001-frontend-chat-ui/quickstart.md`
- [X] T038 Run `npm run build` from `frontend/` and record results in `specs/001-frontend-chat-ui/quickstart.md`
- [ ] T039 Run manual browser validation for layout, chat flow, keyboard behavior, suggested queries, citations, and error paths, then record results in `specs/001-frontend-chat-ui/quickstart.md`
- [X] T040 Review changed files to confirm no backend, RAG, FAISS, Groq prompt, or chat history persistence logic was modified in `backend/main.py`
- [X] T041 Review `frontend/components/ChatLayout.tsx` and `frontend/lib/chat-api.ts` to confirm previous chat messages are never sent to `POST /api/chat`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational; MVP scope.
- **User Story 2 (Phase 4)**: Depends on US1 message rendering and chat response handling.
- **User Story 3 (Phase 5)**: Depends on US1 submit path.
- **User Story 4 (Phase 6)**: Depends on US1 route/layout integration and existing FileUpload.
- **Polish (Phase 7)**: Depends on selected user stories being complete.

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories after Foundation; delivers the core chat loop.
- **US2 (P2)**: Requires assistant message rendering from US1 to attach citation UI.
- **US3 (P3)**: Requires US1 submit handler to reuse the same path for chips.
- **US4 (P4)**: Requires US1 layout entry and existing upload component; source list can be tested independently with empty/unavailable states.

### Within Each User Story

- Shared types and API helper before component integration.
- Presentational components before parent layout wiring where possible.
- Route replacement after the main `ChatLayout` can render.
- Validation after each story checkpoint before moving to lower-priority stories.

## Parallel Opportunities

- T003 and T004 can run in parallel after dependency setup.
- T009 and T010 can run in parallel for US1 component creation.
- T017 can run in parallel with US1 completion review once source type shape is stable.
- T022 can run in parallel after the US1 submit handler signature is known.
- T033 through T036 can run in parallel during polish because they affect different component files.

## Parallel Example: User Story 1

```text
Task: "T009 [P] [US1] Create textarea chat input component with Enter submit and Shift+Enter newline handling in frontend/components/ChatInput.tsx"
Task: "T010 [P] [US1] Create role-based message bubble component for user, assistant, loading, and error states in frontend/components/MessageBubble.tsx"
```

## Parallel Example: Polish

```text
Task: "T033 [P] Polish hover states, transitions, and focus-visible styling in frontend/components/ChatInput.tsx"
Task: "T034 [P] Polish hover states, transitions, and spacing in frontend/components/MessageBubble.tsx"
Task: "T035 [P] Polish hover states and transitions in frontend/components/SuggestedQueries.tsx"
Task: "T036 [P] Polish citation pill contrast and wrapping in frontend/components/SourceCitation.tsx"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational chat API helper.
3. Complete Phase 3: User Story 1.
4. Stop and validate that typing a question produces user/loading/assistant or user/error messages.
5. Demo the chat loop before adding citations, suggestions, and sidebar polish.

### Incremental Delivery

1. Setup + Foundation -> dependency and typed API helper ready.
2. US1 -> core chat loop with local state and stateless backend request.
3. US2 -> assistant messages include markdown and citation pills.
4. US3 -> empty chat screen includes suggested query chips.
5. US4 -> full two-pane workspace with FileUpload and source list.
6. Polish -> auto-scroll, visual polish, lint/build, and manual browser validation.

### Parallel Team Strategy

1. One developer handles setup, dependencies, and `frontend/lib/chat-api.ts`.
2. After foundation, separate developers can build `ChatInput`, `MessageBubble`, `SourceCitation`, and `SuggestedQueries` in parallel.
3. `ChatLayout.tsx` edits should be serialized because most integration tasks touch the same file.
4. Final lint/build/manual validation should run after all selected UI stories are integrated.

## Format Validation

- All tasks use markdown checkbox format.
- All tasks have sequential IDs from T001 to T041.
- All user story phase tasks include `[US1]`, `[US2]`, `[US3]`, or `[US4]` labels.
- Setup, foundational, and polish tasks omit story labels.
- All tasks include exact file paths.
