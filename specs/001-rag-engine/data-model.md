# Data Model: RAG Engine

## Question

Represents a user's submitted academic query.

| Field | Type | Validation |
|-------|------|------------|
| `question` | string | Required; trimmed length > 0 |
| `user_id` | string | Required; must identify the requesting user |

## RetrievedContextChunk

Represents a stored text excerpt selected as evidence for answering a question.

| Field | Type | Validation |
|-------|------|------------|
| `chunk_id` | string | Required; maps from FAISS integer ID to Supabase chunk row ID |
| `document_id` | string | Required; references source document |
| `text_content` | string | Required; non-empty excerpt text |
| `chunk_index` | integer | Required when available; preserves document order |
| `filename` | string | Required for source citation |
| `score` | number | Optional distance/similarity score from vector search |
| `faiss_id` | integer | Required internally; not required in client response |

## SourceCitation

Represents source metadata returned with an answer and referenced in the answer text.

| Field | Type | Validation |
|-------|------|------------|
| `document_id` | string | Required |
| `filename` | string | Required; displayed in citations |
| `chunk_id` | string | Required |
| `chunk_index` | integer | Required when available |

## GeneratedAnswer

Represents the LLM output and supporting source metadata.

| Field | Type | Validation |
|-------|------|------------|
| `answer` | string | Required; either a grounded answer or refusal |
| `sources` | SourceCitation[] | Required; empty only for refusal/no-context outcomes |

## ChatHistoryEntry

Represents a saved successful interaction.

| Field | Type | Validation |
|-------|------|------------|
| `user_id` | string | Required |
| `question` | string | Required; original trimmed question |
| `answer` | string | Required; generated answer text |
| `sources_cited` | array/object | Required; serialized source citation metadata |
| `created_at` | timestamp | Database-managed when available |

## Relationships

- `RetrievedContextChunk.document_id` references a document metadata row.
- `RetrievedContextChunk.chunk_id` references an exact stored chunk row.
- `SourceCitation` is derived from retrieved chunks and document metadata.
- `ChatHistoryEntry.sources_cited` stores the source citations returned to the user.

## State Transitions

1. `QuestionSubmitted`: question is received and validated.
2. `ContextRetrieved`: FAISS IDs are found and hydrated into context chunks.
3. `AnswerGenerated`: Groq returns a grounded answer or refusal based on context.
4. `HistoryLogged`: successful answer response is stored in chat history.
5. `ResponseReturned`: answer and sources are returned to the client.

Failure transitions:

- Invalid question -> validation error; no retrieval or history write.
- Empty/missing index -> controlled retrieval error; no LLM call or history write.
- Context hydration mismatch -> controlled retrieval error; no LLM call or history write.
- Groq failure -> generation error; no successful history write.
- History write failure -> controlled persistence error; response should not claim history was saved.
