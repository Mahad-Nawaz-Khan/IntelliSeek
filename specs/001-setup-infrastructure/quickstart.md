# Quickstart: Environment Setup & Infrastructure Foundation

## Prerequisites

- Node.js installed for the frontend service.
- Python 3.10+ installed for the backend service.
- `uv` or `pip` available for Python dependency installation.

## 1. Verify repository layout

Expected root layout after implementation:

```text
frontend/
backend/
README.md
.gitignore
```

## 2. Configure frontend placeholders

Create `frontend/.env.local` with placeholder values only:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## 3. Configure backend placeholders

Create `backend/.env` with placeholder values only:

```env
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-supabase-service-key
GROQ_API_KEY=your-groq-api-key
```

## 4. Start backend

From `backend/`:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Expected health check:

```bash
curl http://localhost:8000/api/health
```

Expected response:

```json
{"status":"IntelliSeek Backend is healthy"}
```

## 5. Start frontend

From `frontend/`:

```bash
npm install
npm run dev
```

Open `http://localhost:3000` and confirm:

- The page indicates the IntelliSeek frontend is running.
- The page displays the backend health result when the backend is running.
- The page displays a clear backend unavailable state when the backend is stopped.

## 6. Verify frontend-owned backend test route

With both services running:

```bash
curl http://localhost:3000/api/test-backend
```

Expected healthy result:

```json
{"status":"IntelliSeek Backend is healthy","ok":true}
```

## Acceptance checks

- [ ] Root guide explains how to start both services.
- [ ] Frontend service starts locally and shows the running dashboard.
- [ ] Backend service starts locally and returns the exact health status.
- [ ] Frontend can display backend health without browser CORS errors.
- [ ] Frontend and backend environment placeholders exist with no real secrets.
