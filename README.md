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

Create local environment files before starting the services. Use the committed `.env.example` files as templates and do not commit real secrets.

`frontend/.env.local`:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

`backend/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-supabase-service-role-or-secret-key
GROQ_API_KEY=your-groq-api-key
CORS_ORIGINS=http://localhost:3000
```

`SUPABASE_SERVICE_KEY` is server-only. Never add it to `frontend/.env.local` or Vercel public environment variables.

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

## Deployment: Railway backend + Vercel frontend

Deploy the backend first so the frontend has a public API URL to call.

### Railway backend

Create a Railway service from this repository and configure it as a Python service.

Recommended Railway settings:

```text
Root directory: backend
Start command: uvicorn main:app --host 0.0.0.0 --port $PORT
```

Set these Railway environment variables:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-supabase-service-role-or-secret-key
GROQ_API_KEY=your-groq-api-key
CORS_ORIGINS=http://localhost:3000,https://your-vercel-app.vercel.app
```

After deployment, verify the backend health endpoint:

```bash
curl https://your-railway-backend.up.railway.app/api/health
```

Expected response:

```json
{"status":"IntelliSeek Backend is healthy"}
```

### Vercel frontend

Create a Vercel project from this repository.

Recommended Vercel settings:

```text
Root directory: frontend
Build command: npm run build
Install command: npm install
```

Set these Vercel environment variables:

```env
NEXT_PUBLIC_BACKEND_URL=https://your-railway-backend.up.railway.app
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

After Vercel gives you the production URL, add that URL to Railway `CORS_ORIGINS`, redeploy/restart the backend if needed, and test chat plus upload from the Vercel site.

Do not deploy the FastAPI backend to Vercel serverless as-is. It uses FAISS local files, document parsing, and Python ML dependencies that need a persistent backend runtime.
