# Quickstart: RAG Engine

## Prerequisites

- Phase 4 vectorization and FAISS indexing pipeline is complete.
- Backend environment variables for Supabase are configured.
- `GROQ_API_KEY` is configured in the backend runtime environment.
- At least one Supabase-backed document has been parsed, chunked, embedded, and indexed.
- Local FAISS artifacts exist and match stored chunks:
  - `faiss_index/intelliseek.index`
  - `faiss_index/id_map.json`

## Install dependencies

From `backend/`, install requirements after Phase 5 dependencies are added:

```powershell
pip install -r requirements.txt
```

Expected new dependency:

- `groq`

## Run backend tests

```powershell
python -m pytest backend/tests
```

Expected checks:

- Retrieval enforces Top-K bounds between 2 and 5.
- Retrieval maps FAISS integer IDs to exact stored chunk IDs.
- Retrieval hydrates chunk text and filenames from Supabase.
- LLM prompt instructs citation and refusal behavior.
- Groq client wrapper uses `GROQ_API_KEY` from the environment.
- Chat endpoint validates questions, returns answer/sources, and logs successful history.
- Failed retrieval or generation does not create successful chat history.

## Start the backend

```powershell
uvicorn backend.main:app --reload
```

## Ask a question

Send a request to the chat endpoint:

```json
{
  "question": "Explain recursion from my notes",
  "user_id": "<user-id>"
}
```

Expected success response:

```json
{
  "ok": true,
  "answer": "Recursion is ... [Source: notes.pdf]",
  "sources": [
    {
      "document_id": "<document-id>",
      "filename": "notes.pdf",
      "chunk_id": "<chunk-id>",
      "chunk_index": 2
    }
  ]
}
```

## Verify history logging

After a successful response:

1. Confirm a new `chat_history` row exists for the `user_id`.
2. Confirm the row includes the submitted question.
3. Confirm the row includes the generated answer.
4. Confirm `sources_cited` includes the returned source metadata.

## Error-path checks

- Empty question returns a validation error.
- Missing or empty FAISS index returns a retrieval failure.
- Missing FAISS-to-chunk mapping returns a retrieval failure.
- No sufficient context returns a refusal/no-context outcome and does not hallucinate.
- Missing `GROQ_API_KEY` returns a controlled generation configuration error.
- Groq API failure returns a controlled generation error.
- History insert failure does not claim successful persistence.

## Regression boundaries

- Phase 5 does not build the frontend chat UI.
- Phase 5 does not add multi-turn conversational memory.
- Phase 5 does not send full documents to the LLM.
- Phase 5 does not replace Supabase as the source of truth for text chunks and filenames.

## Validation results

- `python -m pytest backend/tests` — PASS, 33 passed, 4 dependency deprecation warnings.
- Manual chat smoke test — Not run in this session because it requires a Supabase-backed indexed document and configured `GROQ_API_KEY`.
