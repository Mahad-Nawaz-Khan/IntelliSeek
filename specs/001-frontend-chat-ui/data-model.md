# Data Model: Frontend Chat UI

## ChatMessage

Represents one visible item in the current browser-session conversation.

**Fields**:
- `id`: Client-generated unique string.
- `role`: `user` or `assistant`.
- `content`: Message text displayed to the student.
- `displayedContent`: Optional progressively revealed assistant text for simulated typing.
- `sources`: Optional list of `SourceCitation` values attached to assistant messages.
- `status`: `complete`, `loading`, or `error`.
- `createdAt`: Client-side timestamp for ordering.

**Validation rules**:
- User messages require non-empty trimmed content.
- Assistant messages may temporarily have empty displayed content while loading or typing.
- Source citations attach only to assistant messages.

**State transitions**:
- User message: created as `complete` immediately on submit.
- Assistant placeholder: `loading` while request is in flight.
- Assistant success: `loading` -> `complete` after answer is received and typing reveal finishes.
- Assistant failure: `loading` -> `error` when request fails or response is invalid.

## SourceCitation

Represents one cited source returned with an assistant answer.

**Fields**:
- `document_id`: Document identifier when returned by the backend.
- `filename`: Human-readable source filename.
- `chunk_id`: Chunk identifier when returned by the backend.
- `chunk_index`: Chunk position within the source document.

**Validation rules**:
- `filename` is required for display.
- Missing IDs should not prevent filename rendering if the backend returns partial source metadata.
- Duplicate filenames may be visually de-duplicated only if doing so does not hide distinct chunk references required by the response.

## ChatRequest

Represents the payload sent for one stateless answer request.

**Fields**:
- `question`: Trimmed student question.
- `user_id`: Demo user identity for this frontend phase.

**Validation rules**:
- `question` must not be empty.
- `user_id` must be present.
- Previous chat messages must not be included.

## ChatResponse

Represents a successful backend answer response.

**Fields**:
- `ok`: Boolean success marker.
- `answer`: Assistant answer text.
- `sources`: List of `SourceCitation` values.

**Validation rules**:
- Successful responses require a non-empty `answer`.
- Empty `sources` is allowed but must render a clear no-source state if appropriate.

## SuggestedQuery

Represents a cold-start prompt chip.

**Fields**:
- `id`: Stable string key.
- `label`: Prompt text shown to the student and submitted when selected.

**Validation rules**:
- Label must be non-empty.
- Selecting a suggestion follows the same validation and submit path as manual entry.

## KnowledgeSource

Represents one uploaded document shown in the sidebar.

**Fields**:
- `id`: Document identifier.
- `filename`: Display name.
- `createdAt`: Optional upload timestamp.

**Validation rules**:
- If source loading fails, the sidebar must show an unavailable state without blocking chat.
- If no sources exist, the sidebar must show an empty state and keep upload access visible.
