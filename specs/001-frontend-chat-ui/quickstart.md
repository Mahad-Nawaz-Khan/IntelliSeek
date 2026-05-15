# Quickstart: Frontend Chat UI

## Prerequisites

- Phase 5 backend RAG endpoint is available at `POST /api/chat`.
- At least one document has been uploaded, parsed, chunked, embedded, and indexed for full answer/source validation.
- Frontend public Supabase environment variables are configured if upload and source listing are being validated.
- Backend runtime has Supabase credentials and `GROQ_API_KEY` configured for live chat validation.

## Install dependencies

From `frontend/`, install dependencies after Phase 6 packages are added:

```powershell
npm install
```

Expected new dependencies:

- `lucide-react`
- `react-markdown`

## Start the backend

From the repository root or backend environment:

```powershell
uvicorn backend.main:app --reload
```

## Start the frontend

From `frontend/`:

```powershell
npm run dev
```

Open the local frontend URL shown by Next.js.

## Validate chat layout

Expected checks:

1. The page shows a dark academic workspace.
2. A left/sidebar area shows upload controls and source/document state.
3. A main chat area shows suggested query chips before the first message.
4. The input area is visible and usable.
5. The layout remains usable when the browser width is reduced.

## Validate manual question flow

1. Type `Explain recursion` in the chat input.
2. Press Enter.
3. Confirm the user message appears immediately.
4. Confirm a loading or typing indicator appears while the backend responds.
5. Confirm the assistant answer appears as a distinct message.
6. Confirm returned source filenames appear as citation pills on the assistant message.
7. Confirm the input is available for another stateless question.

## Validate keyboard behavior

1. Type a multi-line question.
2. Press Shift+Enter.
3. Confirm a newline is inserted and no request is sent.
4. Press Enter without Shift.
5. Confirm the question is submitted.

## Validate suggested questions

1. Reload the page or clear the current session conversation.
2. Click the `Explain recursion` suggested chip.
3. Confirm it submits immediately as the first user message.
4. Confirm suggested chips no longer dominate the main chat once messages exist.

## Validate error paths

- Empty or whitespace-only input is not submitted.
- If the backend is unavailable, the assistant message shows a clear error state.
- If the backend returns a no-context or generation error, the error is visible and the user message remains in the chat.
- If no source metadata is returned, the assistant answer still renders cleanly.

## Automated validation

From `frontend/`:

```powershell
npm run lint
npm run build
```

## Regression boundaries

- Phase 6 does not modify FastAPI backend code.
- Phase 6 does not modify retrieval, FAISS, embeddings, Groq prompts, or chat history persistence.
- Phase 6 does not send previous chat messages to the backend.
- Phase 6 does not add login/signup UI.

## Validation results

- `npm --prefix frontend run lint` — PASS.
- `npm --prefix frontend run build` — PASS.
- Manual browser chat smoke test — Not run in this session because no browser automation tool is available; validate layout, keyboard behavior, suggested queries, live chat, citations, and error paths manually in the Next.js dev server.
- Dependency audit — `npm --prefix frontend install` reported 2 moderate severity vulnerabilities in the dependency tree; no automatic audit fix was applied because it may introduce breaking dependency changes.
