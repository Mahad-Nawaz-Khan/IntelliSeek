# Quickstart: Vectorization & FAISS Indexing Pipeline

## Prerequisites

- Backend environment variables for Supabase are configured as in previous phases.
- A Supabase document upload exists in the `academic-documents` bucket.
- The uploaded file has a matching `storage_path`, `filename`, `file_type`, `file_size`, and `user_id`.

## Install dependencies

From `backend/`, install requirements after Phase 4 dependencies are added:

```powershell
pip install -r requirements.txt
```

Expected new dependencies:

- `sentence-transformers`
- `faiss-cpu`
- `numpy`
- `pytest`

On first embedding use, `sentence-transformers/all-MiniLM-L6-v2` downloads automatically and may take longer than later runs.

## Run backend tests

```powershell
pytest backend/tests
```

Expected checks:

- Chunker creates overlapping non-empty chunks.
- Short text produces one chunk.
- Empty text produces no chunks.
- Embedding generator returns a matrix with 384 columns.
- FAISS store persists and reloads index state.
- Mapping count matches FAISS `ntotal`.

## Start the backend

```powershell
uvicorn backend.main:app --reload
```

On first embedding use, the model may download automatically. This can take longer than later runs.

## Parse and index a document

Send a request to the existing parse endpoint:

```json
{
  "storage_path": "<user-id>/<filename.pdf>",
  "filename": "<filename.pdf>",
  "file_type": "application/pdf",
  "file_size": 524288,
  "user_id": "<user-id>"
}
```

Expected success response includes:

```json
{
  "ok": true,
  "status": "Document parsed and indexed successfully",
  "document_id": "<uuid>",
  "filename": "<filename.pdf>",
  "text_preview": "...",
  "chunks_created": 7,
  "vectors_indexed": 7,
  "index_total": 7
}
```

## Verify persistence

After a successful parse/index run:

1. Confirm `faiss_index/intelliseek.index` exists.
2. Confirm `faiss_index/id_map.json` exists.
3. Restart the backend.
4. Confirm the index loads without overwriting previous state.
5. Index another document and verify `index_total` increases by `vectors_indexed`.

## Error-path checks

- Empty extracted text returns a 400-style no-content outcome and creates no chunks/vectors.
- Unsupported file types keep the existing validation failure behavior.
- Index persistence failures return a processing failure rather than reporting success.
- If embedding generation fails, the response reports indexing failure and does not claim vectors were indexed.

## Regression boundaries

- Phase 4 does not add a semantic retrieval endpoint.
- Phase 4 does not connect Groq or any LLM answer-generation flow.
- Phase 4 does not add a frontend chat/question-answer UI.

## Validation results

- `python -m pytest backend/tests` — PASS, 15 passed, 4 dependency deprecation warnings.
- Manual parse-and-index smoke test — Not run in this session because it requires a Supabase-backed uploaded document and configured runtime credentials.
