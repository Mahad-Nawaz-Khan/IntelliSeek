# IntelliSeek

IntelliSeek is a two-service academic assistant foundation with a Next.js frontend and a FastAPI backend.

## Project structure

```text
frontend/  # Next.js App Router application
backend/   # FastAPI service
```

Keep frontend and backend code inside their own folders. Do not place backend-only secrets or Python service code in `frontend/`, and do not place frontend UI code in `backend/`.

## Prerequisites

- Node.js for the frontend service
- Python 3.10+ for the backend service
- `pip` or `uv` for Python dependency installation

## Environment placeholders

Create local placeholder files before starting the services.

`frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

`backend/.env`:

```env
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-supabase-service-key
GROQ_API_KEY=your-groq-api-key
```

Use placeholders only for Phase 1. Do not commit real secrets.

## Start the backend

From `backend/`:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

The backend runs at `http://localhost:8000`.

Health check:

```bash
curl http://localhost:8000/api/health
```

Expected response:

```json
{"status":"IntelliSeek Backend is healthy"}
```

## Start the frontend

From `frontend/`:

```bash
npm install
npm run dev
```

The frontend runs at `http://localhost:3000`.

## Verify service communication

With both services running, open `http://localhost:3000`. The landing page should show that the frontend is running and display the backend health result.

You can also verify the frontend-owned backend test route:

```bash
curl http://localhost:3000/api/test-backend
```

Expected healthy response:

```json
{"status":"IntelliSeek Backend is healthy","ok":true}
```

If the backend is stopped, the frontend should show a clear unavailable state.
