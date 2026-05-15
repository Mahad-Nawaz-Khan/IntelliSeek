# Feature Specification: Frontend Chat UI

**Feature Branch**: `001-frontend-chat-ui`  
**Created**: 2026-05-15  
**Status**: Draft  
**Input**: User description: "Phase 6: Chat UI & Polish (Next.js Frontend)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ask Questions in a Chat Workspace (Priority: P1)

A student opens IntelliSeek and uses a focused chat workspace to ask a question about their uploaded academic material, then receives a readable assistant response without leaving the page.

**Why this priority**: This is the core value of the phase: turning the existing backend answer service into an interactive academic assistant experience.

**Independent Test**: Can be fully tested by opening the app, typing a question, submitting it, observing a pending state, and confirming that the assistant response appears in the conversation.

**Acceptance Scenarios**:

1. **Given** the chat workspace is open, **When** the student types a question and submits it, **Then** the conversation shows the student's message and a pending assistant state until the answer is available.
2. **Given** the student is typing in the input area, **When** they press Enter without Shift, **Then** the question is submitted.
3. **Given** the student is typing in the input area, **When** they press Shift+Enter, **Then** a new line is inserted without submitting the question.
4. **Given** an answer is returned successfully, **When** the response is displayed, **Then** it appears as an assistant message distinct from the student's message.

---

### User Story 2 - Review Answer Sources (Priority: P2)

A student reviews the source files cited by the assistant so they can trace the answer back to uploaded academic material.

**Why this priority**: Source visibility supports trust, academic verification, and the core citation promise of IntelliSeek.

**Independent Test**: Can be tested with any assistant response that includes at least one source by confirming that source filenames are visible near the answer.

**Acceptance Scenarios**:

1. **Given** an assistant response includes source metadata, **When** the message renders, **Then** each source filename is shown as a clearly visible citation element below or within the assistant message.
2. **Given** multiple sources support an answer, **When** the message renders, **Then** each distinct source is visible without obscuring the answer text.
3. **Given** a source citation is displayed, **When** the student scans the conversation, **Then** the cited filename is easy to associate with the corresponding assistant answer.

---

### User Story 3 - Start From Suggested Questions (Priority: P3)

A student who has not started a conversation can select suggested academic questions to quickly discover how to use the assistant.

**Why this priority**: Suggested prompts reduce cold-start friction but are not required for the basic chat loop.

**Independent Test**: Can be tested from an empty conversation by selecting a suggested question and confirming it submits as the first chat message.

**Acceptance Scenarios**:

1. **Given** the conversation is empty, **When** the chat screen loads, **Then** three to four suggested academic question chips are visible.
2. **Given** the student selects a suggested question, **When** the chip is clicked, **Then** that question is submitted immediately and appears as the student's first message.
3. **Given** at least one message exists in the conversation, **When** the chat screen is displayed, **Then** the cold-start suggestions no longer dominate the main chat area.

---

### User Story 4 - Manage Sources and Uploads From the Workspace (Priority: P4)

A student can view available knowledge sources and access the existing upload capability from a sidebar while continuing to use the chat area.

**Why this priority**: It improves workflow continuity by pairing source awareness with chat, but the chat interaction remains useful without it.

**Independent Test**: Can be tested by opening the chat workspace and confirming a source sidebar is present, can be collapsed or reduced on smaller screens, and includes access to the upload area.

**Acceptance Scenarios**:

1. **Given** the workspace is open, **When** documents are available, **Then** the sidebar shows the available source list in a compact, readable format.
2. **Given** the workspace is open, **When** the student needs to upload material, **Then** the existing upload capability is accessible from the sidebar area.
3. **Given** the screen has limited width, **When** the layout adapts, **Then** the sidebar does not prevent the student from reading and using the chat.

---

### Edge Cases

- If the answer request fails, the student sees a clear failure message and the typed question is not lost from the conversation context.
- If no sources are returned with an assistant response, the message remains readable and indicates that no source metadata is available.
- If the student submits an empty or whitespace-only question, the app prevents submission or shows a clear validation message.
- If the assistant response is long, the chat area remains scrollable and keeps the latest interaction reachable.
- If the source list is unavailable, the chat remains usable and the sidebar communicates that sources could not be loaded.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST present a two-pane workspace with a source/upload area and a primary chat area.
- **FR-002**: The system MUST display student messages and assistant messages with visually distinct styles.
- **FR-003**: Users MUST be able to submit a question from a text input area.
- **FR-004**: The input area MUST submit on Enter and preserve line breaks on Shift+Enter.
- **FR-005**: The system MUST show a visible loading or typing state while an answer is being requested.
- **FR-006**: The system MUST display successful assistant answers in the conversation.
- **FR-007**: The system MUST display source filenames from returned source metadata as citation elements attached to assistant messages.
- **FR-008**: The system MUST show three to four suggested question chips when the conversation is empty.
- **FR-009**: Selecting a suggested question MUST immediately submit that question as a chat request.
- **FR-010**: The system MUST preserve the current session's visible conversation while the page remains open.
- **FR-011**: The system MUST not send previous conversation messages as context for later questions.
- **FR-012**: The system MUST assume a demo user identity for chat submissions in this phase.
- **FR-013**: The system MUST provide clear error feedback for failed answer requests.
- **FR-014**: The visual design MUST use a dark academic aesthetic with translucent, glass-like surfaces where appropriate.
- **FR-015**: The workspace MUST remain usable on common laptop and desktop screen sizes, with sidebar behavior that does not block chat usage.
- **FR-016**: The phase MUST NOT change backend retrieval, generation, storage, or indexing behavior.

### Key Entities *(include if feature involves data)*

- **Chat Message**: A visible conversation item representing either a student question, an assistant answer, a loading placeholder, or an error state; includes message role, text, and optional source citations.
- **Source Citation**: A source reference attached to an assistant message; includes at minimum a filename and may include document and chunk identifiers when available.
- **Suggested Question**: A predefined academic prompt shown only before the student starts a conversation.
- **Knowledge Source**: An uploaded document visible in the sidebar as available study material.

### Assumptions

- A demo user identity is acceptable for this phase because authentication screens are explicitly out of scope.
- The answer service already exists and returns an answer plus source metadata.
- The source list can be displayed from available document data; if live document fetching is not available during implementation, a graceful empty or unavailable state is acceptable until the data source is wired.
- The existing upload capability from the previous frontend phase should be reused rather than redesigned from scratch.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A student can submit a question and see either an assistant answer or a clear error state within one uninterrupted chat workflow.
- **SC-002**: At least one assistant answer with source metadata displays a visible filename citation attached to the answer.
- **SC-003**: From an empty conversation, selecting the "Explain recursion" suggestion submits a first question without additional typing.
- **SC-004**: The main workspace visibly includes both a source/upload area and a chat area on a standard laptop-sized screen.
- **SC-005**: The interface maintains readable contrast and spacing in the default dark theme across the chat, sidebar, and input area.
