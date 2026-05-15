# Quickstart: Database, Storage & Authentication Foundation

## Prerequisites

- Active Supabase project with project URL, anon/public key, and service-role key available.
- Backend dependencies installed from `backend/requirements.txt`.
- Frontend dependencies installed in `frontend/`.
- No real secrets committed to git.

## 1. Configure environment placeholders

Backend `backend/.env` must contain backend-only values:

```env
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-supabase-service-key
GROQ_API_KEY=your-groq-api-key
```

Frontend `frontend/.env.local` must contain only public Supabase values:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Acceptance check:

- [x] `SUPABASE_SERVICE_KEY` appears only in backend-facing files or docs, never in frontend runtime files.

## 2. Apply schema and policies

1. Open the Supabase SQL editor for the active project.
2. Run the SQL from `database/schema.sql`.
3. Confirm these tables exist:
   - `documents`
   - `chunks`
   - `chat_history`
4. Confirm RLS is enabled for all three tables.
5. Confirm storage bucket `academic-documents` exists.

Acceptance check:

- [x] Schema and storage setup is versioned in `database/schema.sql`; manual Supabase application still requires active project credentials.

## 3. Verify backend database connectivity

Start the backend from `backend/`:

```bash
uvicorn main:app --reload
```

Call the diagnostic endpoint:

```bash
curl http://localhost:8000/api/db-test
```

Expected success shape:

```json
{
  "ok": true,
  "status": "Supabase database connection verified",
  "record_id": "<uuid>",
  "source": "backend"
}
```

Expected failure shape:

```json
{
  "ok": false,
  "status": "Supabase database connection failed",
  "source": "backend",
  "error": "<sanitized summary>"
}
```

Acceptance check:

- [x] Backend returns a sanitized missing-configuration failure with placeholder Supabase config; write/read success requires active Supabase credentials.

## 4. Verify frontend public-client connectivity

Start the frontend from `frontend/`:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

The page should show a Supabase connectivity status that either:

- confirms public client initialization and permitted access, or
- reports a permission-aware failure when RLS blocks unauthenticated reads.

Acceptance check:

- [x] Frontend connectivity uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` only.
- [x] No backend-only Supabase service key is present in frontend-facing code.

## 5. Storage verification

In Supabase Storage, confirm bucket `academic-documents` exists and policy behavior matches the selected mode:

- Authenticated uploads are allowed for valid academic files.
- Reads are authenticated and ownership-aware unless public reads were explicitly enabled for rendering.
- Unsupported file categories are rejected by policy or application validation during future upload implementation.
- The bucket has a 10 MB file size limit and allows only PDF, DOCX, TXT, and PPTX MIME types.

Acceptance check:

- [x] PDF, DOCX, TXT, and PPTX are the only intended document categories for this bucket in `database/schema.sql`.
- [x] Storage policies named `academic_documents_authenticated_upload` and `academic_documents_authenticated_read` exist for `storage.objects` in `database/schema.sql`.
