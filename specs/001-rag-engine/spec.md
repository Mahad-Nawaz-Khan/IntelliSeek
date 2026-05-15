# Feature Specification: RAG Engine

**Feature Branch**: `001-rag-engine`  
**Created**: 2026-05-15  
**Status**: Draft  
**Input**: User description: "Phase 5: The RAG Engine (Semantic Retrieval & Groq LLM)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Answer Questions From Uploaded Material (Priority: P1)

A student asks a question about previously uploaded academic material and receives an answer grounded in the most relevant document excerpts.

**Why this priority**: This is the core value of the RAG engine: turning indexed course documents into useful question-answer support.

**Independent Test**: Can be tested by asking a factual question whose answer exists in indexed material and verifying that the response is grounded in retrieved context rather than unsupported general knowledge.

**Acceptance Scenarios**:

1. **Given** uploaded and indexed academic documents contain the answer to a user's question, **When** the user submits the question, **Then** the system returns a coherent answer based only on relevant stored excerpts.
2. **Given** no retrieved excerpt contains enough information to answer, **When** the user submits the question, **Then** the system declines to answer instead of inventing information.

---

### User Story 2 - Show Sources For Answers (Priority: P2)

A student reviewing an answer can see which uploaded document filenames support the response.

**Why this priority**: Source attribution makes answers trustworthy and academically usable.

**Independent Test**: Can be tested by asking a question answered by known uploaded documents and verifying that returned source metadata and answer citations include the source filenames.

**Acceptance Scenarios**:

1. **Given** relevant excerpts are retrieved from one or more documents, **When** the answer is returned, **Then** the response includes source citations naming the supporting documents.
2. **Given** multiple supporting documents contribute context, **When** the answer is returned, **Then** the system includes source metadata for each supporting document used.

---

### User Story 3 - Preserve Chat Activity (Priority: P3)

A student's question, generated answer, and cited sources are saved so the interaction can be reviewed later.

**Why this priority**: History logging supports continuity and provides an audit trail of generated academic assistance.

**Independent Test**: Can be tested by submitting a question and verifying that the completed interaction is stored with the question, answer, user association, and cited source details.

**Acceptance Scenarios**:

1. **Given** a user receives an answer, **When** the response is completed, **Then** the question, answer, cited sources, and user association are recorded in chat history.
2. **Given** answer generation fails, **When** the system returns an error, **Then** it does not record a misleading successful chat history entry.

---

### Edge Cases

- The user submits an empty or whitespace-only question.
- The user submits a question before any documents have been indexed.
- The stored search index is missing, empty, or inconsistent with stored document excerpts.
- Relevant excerpts exist but document metadata needed for citations is missing.
- The answer-generation service is unavailable or returns an error.
- More than five excerpts appear relevant; the system still limits context to a small focused set.
- Retrieved excerpts do not contain enough information to answer safely.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to submit a question with their user identity and receive an answer response.
- **FR-002**: The system MUST reject empty or whitespace-only questions with a clear validation error.
- **FR-003**: The system MUST retrieve only a focused set of relevant excerpts for each question, with no fewer than 2 and no more than 5 excerpts considered for answer generation when enough matches exist.
- **FR-004**: The system MUST use retrieved excerpt text as the exclusive factual context for answer generation.
- **FR-005**: The system MUST decline to answer when retrieved excerpts do not contain sufficient information.
- **FR-006**: The system MUST include source citations in generated answers when context is used.
- **FR-007**: The system MUST return source metadata for cited material, including the source filename and document reference.
- **FR-008**: The system MUST map retrieved search results back to the exact stored text excerpts before generating an answer.
- **FR-009**: The system MUST handle missing or inconsistent search-index state as a controlled failure rather than returning unsupported answers.
- **FR-010**: The system MUST save successful chat interactions with the user identity, question, generated answer, and cited source details.
- **FR-011**: The system MUST avoid saving failed answer-generation attempts as successful chat history entries.
- **FR-012**: The system MUST keep this phase limited to backend question answering and history logging, without adding a frontend chat interface or multi-turn conversational memory.

### Key Entities *(include if feature involves data)*

- **Question**: A user's submitted academic query, associated with the user who asked it.
- **Retrieved Excerpt**: A relevant stored document segment selected as potential evidence for answering a question.
- **Source Citation**: Metadata connecting an answer or excerpt to the original uploaded document, including filename and document reference.
- **Generated Answer**: The response produced from retrieved excerpts, including cited support or a refusal when support is insufficient.
- **Chat History Entry**: A stored record of a completed question-answer interaction and its cited sources.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of answerable questions over indexed academic material return a response with source citations in under 3 seconds in a local development environment.
- **SC-002**: 100% of generated factual answers include at least one source filename when supporting context is available.
- **SC-003**: 100% of questions with no sufficient supporting context receive a refusal-style response rather than an unsupported answer.
- **SC-004**: 100% of successful answer responses are saved with their question, answer, user association, and cited source details.
- **SC-005**: No answer-generation request sends full uploaded documents as context; each request uses only a small bounded excerpt set.

## Assumptions

- Phase 4 indexing is complete and provides searchable excerpt vectors with a durable mapping back to stored text excerpts.
- Uploaded document metadata includes filenames suitable for user-facing citations.
- Users are already identified by the existing user identifier passed to backend requests.
- This phase remains stateless per question and does not include previous chat turns in answer generation.
