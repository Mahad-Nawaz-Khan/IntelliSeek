# Data Model: Environment Setup & Infrastructure Foundation

This phase does not create persistent database tables. The entities below describe local
configuration and runtime contract objects needed for planning and verification.

## Frontend Service

**Purpose**: Local user-facing IntelliSeek application shell.

**Fields**:
- `root_path`: `frontend/`
- `runtime_port`: `3000`
- `public_env_keys`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `status_surface`: landing page dashboard
- `backend_test_path`: `/api/test-backend`

**Validation rules**:
- Must remain inside `frontend/`.
- Must not read backend-only secrets.
- Must display frontend running state and backend connectivity state.

**Relationships**:
- Reads public Supabase placeholder values from `frontend/.env.local`.
- Calls Backend Service through the backend test route or direct local health fetch.

## Backend Service

**Purpose**: Local FastAPI foundation exposing service health.

**Fields**:
- `root_path`: `backend/`
- `runtime_port`: `8000`
- `health_path`: `/api/health`
- `allowed_origin`: `http://localhost:3000`
- `private_env_keys`: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `GROQ_API_KEY`

**Validation rules**:
- Must remain inside `backend/`.
- Must not require real Supabase or Groq credentials for `/api/health`.
- Must explicitly allow the frontend local origin through CORS.

**Relationships**:
- Provides Health Status.
- Owns backend-only environment placeholders.

## Environment Placeholder Set

**Purpose**: Defines required configuration names without storing real secrets.

**Fields**:
- `frontend_required_keys`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `backend_required_keys`: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `GROQ_API_KEY`
- `secret_policy`: placeholders only; no real tokens committed

**Validation rules**:
- All five keys must exist in their service-specific environment file.
- Backend service keys must not appear in the frontend environment file.
- Placeholder values must be recognizable as non-production values.

## Health Status

**Purpose**: Standard local service availability response.

**Fields**:
- `status`: exact string `IntelliSeek Backend is healthy`

**Validation rules**:
- `/api/health` returns a JSON object containing `status`.
- Frontend status display must show either this healthy message or a clear connection failure.

## State Transitions

### Backend connectivity visible in frontend

1. `unknown`: frontend page loaded before backend check completes.
2. `healthy`: backend health response returns expected status.
3. `unavailable`: backend fetch fails, times out, or returns an unexpected response.
