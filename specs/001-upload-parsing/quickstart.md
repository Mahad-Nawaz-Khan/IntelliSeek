# Quickstart: Multi-Format Parsing Layer & Upload Pipeline

## Prerequisites

- Phase 2 Supabase schema and storage setup has been applied.
- `academic-documents` bucket exists with a 10 MB limit and allowed MIME types for PDF, DOCX, PPTX, and TXT.
- Backend `.env` contains real `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` values.
- Frontend `.env.local` contains real `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` values.
- Backend parsing dependencies are installed from `backend/requirements.txt`.
- Representative PDF, DOCX, PPTX, and UTF-8 TXT files are available for manual validation.

## 1. Validate frontend upload blocking

Start the frontend:

```bash
npm run dev --prefix frontend
```

Open:

```text
http://localhost:3000
```

Acceptance checks:

- [ ] Selecting a JPG or other unsupported file shows a clear file-type error and does not upload.
- [ ] Selecting a file larger than 10 MB shows a clear file-size error and does not upload.
- [ ] Selecting a supported file at or below 10 MB enables upload and shows progress/status.

## 2. Validate backend parse endpoint locally

Start the backend:

```bash
uvicorn main:app --reload --app-dir backend
```

After uploading a valid file to Supabase Storage, call the parse endpoint with the returned storage path:

```bash
curl -X POST http://localhost:8000/api/parse \
  -H "Content-Type: application/json" \
  -d '{
    "storage_path": "users/<user-id>/<unique-file-name>.pdf",
    "filename": "notes.pdf",
    "file_type": "application/pdf",
    "file_size": 240000,
    "user_id": "<user-id>"
  }'
```

Expected success shape:

```json
{
  "ok": true,
  "status": "Document parsed successfully",
  "document_id": "<uuid>",
  "filename": "notes.pdf",
  "text_preview": "<first extracted characters>"
}
```

Expected failure shape:

```json
{
  "ok": false,
  "status": "Document parsing failed",
  "error": "<sanitized reason>"
}
```

Acceptance checks:

- [ ] Valid PDF, DOCX, PPTX, and TXT files each produce non-empty extracted text.
- [ ] Corrupt, encrypted, image-only, empty, or whitespace-only files return a clear failure.
- [ ] Unsupported, oversized, missing, malformed, or unauthorized storage references are rejected before parsing.
- [ ] Temporary local files are removed after both success and failure.

## 3. Validate end-to-end upload and parsing

Use the frontend upload UI to upload one supported file.

Acceptance checks:

- [ ] File appears in the `academic-documents` bucket under a user-aware unique path.
- [ ] The frontend triggers `POST /api/parse` after storage upload succeeds.
- [ ] The UI reports accepted, parsing, success, and failure states clearly.
- [ ] A successful parse creates exactly one `documents` row with matching `user_id`, `filename`, `file_type`, `file_size`, `storage_path`, and `created_at`.
- [ ] Failed parsing creates zero successful document metadata rows.

## 4. Validate non-goals

Acceptance checks:

- [ ] No chunks are created in `chunks` during Phase 3 validation.
- [ ] No embeddings are generated.
- [ ] No FAISS/vector index is updated.
- [ ] No chat interface is added.
