# Architecture

IntelliSeek is a single Next.js application with server-side API routes. There is no separate Python, FastAPI, Docker, Railway, or FAISS runtime in the governed application path.

## High-Level Flow

```text
Browser
  -> Next.js App Router UI
  -> Next.js API routes
  -> Supabase Auth, Storage, Postgres, pgvector
  -> OpenRouter embeddings and chat models
  -> Groq helper/fallback paths
  -> Server-sent streaming response
```

## Main Runtime Areas

| Area | Location | Responsibility |
| --- | --- | --- |
| Workspace shell | `frontend/components/workspace/WorkspaceShell.tsx` | Persistent sidebar/top bar across chat, library, and settings. |
| Chat page | `frontend/app/(workspace)/chat/page.tsx` | Chat route entry. |
| Chat layout | `frontend/components/ChatLayout.tsx` | Chat state, session switching, streaming, queueing, upload coordination. |
| Composer/input | `frontend/components/chat/ChatComposer.tsx`, `frontend/components/ChatInput.tsx` | Input UI, stop button, queued messages, autocomplete, drag-and-drop upload. |
| Messages | `frontend/components/chat/ChatMessage.tsx` | Markdown rendering, assistant/user message presentation, citations. |
| Library | `frontend/app/(workspace)/library/page.tsx` | Real document list, indexing status, user/admin upload target behavior. |
| Settings | `frontend/app/(workspace)/settings/page.tsx` | User-facing settings route inside the persistent workspace. |
| API routes | `frontend/app/api/*` | Chat, parsing, documents, sessions, autocomplete, me, health, Inngest. |
| RAG server logic | `frontend/lib/server/rag/*` | Parsing, chunking, embeddings, vector search, keyword fallback, topics. |
| Agent logic | `frontend/lib/server/agents/chat-agent.ts` | OpenAI Agents SDK prompt/tool orchestration and streaming. |
| Groq helper | `frontend/lib/server/groq.ts` | Groq chat/title helper paths. |

## Document Upload And Indexing Flow

```text
User selects or drops file
  -> frontend/lib/upload-document.ts validates extension, MIME type, size
  -> file uploads to Supabase Storage bucket academic-documents
  -> POST /api/parse validates metadata and stored object content
  -> document row inserted with processing_status = queued
  -> Inngest event document/index.requested is sent
  -> index-document function downloads file
  -> parser extracts text
  -> chunker creates structure-aware chunks
  -> embeddings are generated through OpenRouter
  -> chunks and document topics are stored in Supabase
  -> document row becomes indexed or failed
```

The upload path is always under the signed-in user id:

```text
{userId}/{timestamp}-{safeFilename}
```

Knowledge-base uploads still use the admin user's storage path, but the document row uses `source_scope = 'knowledge_base'`, making it retrievable by all signed-in users.

## Vector Search And HNSW Retrieval

IntelliSeek uses **semantic vector search** to find the most relevant uploaded material for a user question.

1. Uploaded documents are parsed into text.
2. Text is split into overlapping chunks.
3. Each chunk is converted into a **1024-dimensional embedding** through the configured OpenRouter embedding model.
4. Embeddings are stored in Supabase Postgres in the `chunks.embedding` column using `extensions.vector(1024)`.
5. The database creates an **HNSW index** for fast approximate nearest-neighbor search:

```sql
create index if not exists chunks_embedding_hnsw_idx
on public.chunks
using hnsw (embedding extensions.vector_cosine_ops);
```

6. At question time, the question is embedded and compared against stored chunk embeddings with **cosine distance**.
7. The `match_user_chunks` SQL function returns the top matching chunks accessible to the signed-in user.

The SQL similarity score is calculated as:

```sql
1 - (chunks.embedding <=> query_embedding) as similarity
```

The `<=>` operator is pgvector cosine distance when used with `vector_cosine_ops`. The HNSW index speeds up nearest-neighbor lookup so retrieval remains practical as the number of indexed chunks grows.

## Chat Request Flow

```text
Chat input submit
  -> POST /api/chat
  -> authenticate user
  -> rate limit request
  -> validate question and optional chatSessionId
  -> create or load chat session
  -> load recent conversation context
  -> resolve retrieval strategy
  -> stream agent answer over Server-Sent Events
  -> save chat history with normalized source citations
  -> update chat session timestamp/title
```

The browser consumes these SSE events:

- `delta`: incremental assistant text.
- `sources`: source citation payload.
- `done`: final answer, sources, and chat session id.
- `error`: failure message.

## Retrieval Strategy

The chat API tries targeted retrieval before falling back to general answers.

1. **Retrieval hint** from autocomplete:
   - Document hint loads chunks from specific document ids.
   - Topic hint searches only the hinted documents.

2. **Summary request handling**:
   - Requests like summarize, overview, key points, or topics covered can use representative document chunks.

3. **Hybrid retrieval**:
   - Semantic search through OpenRouter embeddings, pgvector cosine similarity, and the HNSW index.
   - Keyword search through Supabase `ilike` filters.
   - Results are merged, deduplicated, scored, and filtered.

4. **Neighbor expansion**:
   - Relevant chunks are expanded with nearby chunk indexes from the same document.
   - This helps recover context when a topic spans chunk boundaries.

5. **Agent fallback**:
   - If uploaded-material intent is detected but direct context is not found, agent tools can search documents again.

6. **General answer**:
   - If no document context is needed or found, the app streams a general model answer.

## Chunking

Chunking is implemented in `frontend/lib/server/rag/chunker.ts`.

Current behavior:

- Normalizes whitespace and line endings.
- Preserves likely headings such as Markdown headings, numbered headings, chapters, sections, units, modules, and topics.
- Splits oversized blocks around sentence boundaries when possible.
- Uses about 1400 characters per chunk.
- Uses about 300 characters of overlap.
- Keeps minimum chunk size around 350 characters before forcing a split.

The goal is to keep enough local context for academic explanation while avoiding chunks that are too large for precise retrieval.

## Source Citations

Sources are saved as citation objects with document id, filename, chunk id, and chunk index. The UI groups adjacent chunk references so users see useful source ranges instead of a long repeated chunk list.

## Autocomplete

Autocomplete suggestions come from:

- Built-in suggested prompts.
- Recent chat history.
- Indexed uploaded documents.
- Extracted document topics in `document_topics`.
- Fallback topic extraction from chunks if stored topics are missing.

Pressing `Enter` submits the current user text unless a suggestion is explicitly highlighted. Arrow navigation controls highlighted suggestions.

## Chatbot Queue And Stop Control

The chat UI supports streaming response control:

- While the assistant streams, the main send button becomes a stop button.
- The textarea stays enabled so the user can keep typing.
- Pressing `Enter` while the assistant is responding queues the typed message.
- The queue is capped at three pending messages.
- Queued messages are processed sequentially in the same active chat session.
- Stopping a response leaves the partial assistant response visible.
- After stop, completion, or error, the next queued message starts automatically.

Queued messages are client-side only until they are actually submitted.

This queue is a UI-level FIFO queue for chat turns. It is separate from the Inngest background job queue used for document indexing.

## AI Models

The app is model-configurable through environment variables.

| Purpose | Environment variable | Notes |
| --- | --- | --- |
| Embeddings | `OPENROUTER_EMBEDDING_MODEL` | Creates document and question vectors. The current database schema expects 1024-dimensional vectors. |
| Main chat generation | `OPENROUTER_CHAT_MODEL` | Used by the OpenAI Agents SDK client against OpenRouter-compatible APIs. |
| OpenRouter base URL | `OPENROUTER_BASE_URL` | Defaults to OpenRouter's OpenAI-compatible API base URL in server code. |
| Groq chat/title helper | `GROQ_CHAT_MODEL` | Used by Groq helper paths, including generated chat titles when available. |

Recommended local values are documented in [Dev & Deploy Guide](DEV_AND_DEPLOY.md).

## Data Access Model

Users can retrieve:

- Their own `personal` documents.
- All `knowledge_base` documents.

Admins can additionally upload/delete knowledge-base documents through application role checks.

## Deployment Shape

The app is designed for Vercel:

- Vercel serves the Next.js app and API routes.
- Supabase stores auth, documents, chunks, topics, sessions, history, and files.
- Inngest handles document indexing jobs.
- OpenRouter and Groq provide model calls.
- Upstash can provide distributed rate limiting.
