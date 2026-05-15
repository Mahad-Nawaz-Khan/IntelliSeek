# IntelliSeek

IntelliSeek is a Vercel-deployable academic assistant foundation built with Next.js, Tailwind CSS, JavaScript-compatible retrieval, and Groq-powered answer generation.

## Governed architecture

The current project constitution targets a Vercel-only architecture:

```text
Next.js app
  → API route
  → document parsing
  → chunking
  → embedding generation
  → JSON or Supabase vector store
  → cosine similarity search
  → Top-K context selection
  → Groq LLM
  → cited AI response
```

Core technology choices:

| Layer | Technology |
|---|---|
| Frontend | Next.js App Router |
| Backend | Next.js API routes |
| Styling | Tailwind CSS |
| AI generation | Groq API |
| Embeddings | JavaScript-compatible local/API embeddings |
| Search | Cosine similarity and Top-K retrieval |
| Storage | JSON artifacts and/or Supabase |
| Deployment | Vercel |

Python, FastAPI, FAISS, Railway, Docker, and separate backend services are no longer part of the governed target architecture. Legacy files may remain during migration, but new core work should move backend behavior into Next.js API routes.

## Project structure

```text
frontend/  # Vercel-hosted Next.js application, API routes, UI, retrieval helpers
backend/   # Legacy FastAPI implementation retained only until migration is complete
```

Keep server-only secrets out of client components and public environment variables.

## Prerequisites

- Node.js for the Next.js app
- npm for dependency installation
- A Groq API key for answer generation
- Supabase project values if using Supabase for storage or metadata

## Environment placeholders

Create local environment files before starting the app. Use committed `.env.example` files as templates when present and do not commit real secrets.

`frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
GROQ_API_KEY=your-groq-api-key
SUPABASE_SERVICE_KEY=your-supabase-service-role-or-secret-key
```

Only `NEXT_PUBLIC_*` values are browser-readable. `GROQ_API_KEY` and `SUPABASE_SERVICE_KEY` are server-only and must only be read from API routes or server-side code.

## Start the app locally

From the repository root:

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

The app runs at `http://localhost:3000`.

## Verify locally

Open `http://localhost:3000` and validate the user-facing flow for the feature you are working on. For retrieval features, confirm:

- documents or built-in notes are chunked
- embeddings are generated
- cosine similarity ranks relevant chunks
- Top-K chunks are sent to Groq
- answers include source citations when context exists
- missing-context and provider-error paths are clear

## Deployment: Vercel

Create a Vercel project from this repository.

Recommended Vercel settings:

```text
Root directory: frontend
Build command: npm run build
Install command: npm install
```

Set Vercel environment variables according to the features currently enabled:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
GROQ_API_KEY=your-groq-api-key
SUPABASE_SERVICE_KEY=your-supabase-service-role-or-secret-key
```

Never expose `GROQ_API_KEY` or `SUPABASE_SERVICE_KEY` as `NEXT_PUBLIC_` variables.

## Academic AI + DSA explanation

IntelliSeek combines DSA and AI in one RAG pipeline:

- DSA handles chunk organization, metadata lookup, vector comparison, similarity ranking, and Top-K retrieval.
- AI handles embeddings, semantic understanding, and Groq LLM answer generation.

Viva-safe summary:

> DSA concepts are used for indexing, searching, ranking, and retrieval optimization, while AI concepts are used for semantic understanding, embeddings, and contextual answer generation.

Only claim Trie/autocomplete if that feature is actually implemented in the current code.
