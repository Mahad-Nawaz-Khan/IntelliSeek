# Research: Environment Setup & Infrastructure Foundation

## Decision: Use a root monorepo with isolated frontend and backend service directories

**Rationale**: The feature requires one repository-level foundation where `frontend/` and
`backend/` remain isolated but share SpecKit artifacts, root documentation, and a unified
.gitignore. This supports the user's requested AI context sharing and unified spec
management while preserving service ownership.

**Alternatives considered**:
- Separate repositories: rejected because Phase 1 needs unified local startup guidance and
  future phases benefit from shared specs and coordinated planning.
- Single mixed application directory: rejected because the spec requires strict service
  separation and the constitution requires deployable service boundaries.

## Decision: Use Next.js App Router route handlers for the frontend backend test endpoint

**Rationale**: Current Next.js App Router docs define API endpoints with `route.ts` files
inside the `app` directory, using exported HTTP method functions such as `GET`. The plan
will use `frontend/app/api/test-backend/route.ts` for the local backend health proxy/test
endpoint and `frontend/app/page.tsx` for the visible dashboard.

**Alternatives considered**:
- Pages Router API routes: rejected because the project constraint is App Router.
- Client-only direct fetch from the landing page: viable, but a route handler provides a
  small, testable frontend-owned endpoint while still allowing the UI to surface the result.

## Decision: Keep FastAPI as the backend foundation with explicit local CORS

**Rationale**: FastAPI supports the required Python ecosystem for upcoming FAISS and
SentenceTransformers work. FastAPI documentation uses `CORSMiddleware` with explicit
`allow_origins`, methods, and headers; this plan will allow only `http://localhost:3000`
for Phase 1 local development.

**Alternatives considered**:
- Next.js Server Actions or only Next.js API routes: rejected because future vector search
  and embeddings require Python libraries.
- Wildcard CORS: rejected because explicit local origin is safer and matches the requested
  local development boundary.
- Next.js rewrite/proxy only: rejected because enabling backend CORS makes the dual-service
  architecture directly testable and simpler for local debugging.

## Decision: Use placeholder environment files without real secrets

**Rationale**: The feature requires environment placeholders but external Supabase and Groq
calls are non-goals. Separate `frontend/.env.local` and `backend/.env` templates preserve
public frontend keys and backend-only service keys in separate scopes.

**Alternatives considered**:
- Shared root environment file: rejected because it risks exposing backend secrets to the
  frontend configuration surface.
- Real credentials during setup: rejected because Phase 1 success does not require external
  services and secrets must not be hardcoded.

## Decision: Use pip-compatible `requirements.txt` for the initial Python dependency record

**Rationale**: The user allowed `uv` or `pip`, and `requirements.txt` is the simplest common
format for contributors with Python 3.10+. Developers may still create a virtual
environment with `uv venv` or `python -m venv` before installing requirements.

**Alternatives considered**:
- `pyproject.toml` with uv-first workflow: viable, but adds packaging decisions that are not
  necessary for the Phase 1 skeleton.
