# Developer Guide & Implementation Map

This guide maps the conceptual components of IntelliSeek to the codebase and provides instructions for local development, running the app, and finding important implementation files.

Repository structure (high level)
--------------------------------

- `frontend/`: Next.js application, UI components, and client-side logic.
- `lib/`: server-side helpers used by the frontend and API routes (embedding, parse-response, chat API).
- `components/`: React components and UI building blocks.
- `docs/`: project documentation and algorithm deep dives.
- `database/`: SQL schema and DB migration artifacts.

Key implementation files
------------------------

- Chunking and upload: `lib/upload-document.ts` and `components/FileUpload.tsx`.
- Embeddings and vector API: `lib/upload-config.ts`, `lib/upload-document.ts`, and `lib/chat-api.ts`.
- Vector index interactions / search API: `app/api/documents/` and `app/api/chat/` routes (look for `vector`, `search`, or `index` references).
- Trie/autocomplete UI: `components/SuggestedQueries.tsx` and `lib/trie-autocomplete.ts` (or similar).

Local development
-----------------

1. Install dependencies (from `frontend/`):

```bash
cd frontend
npm install
npm run dev
```

2. Environment variables

- Copy `.env.example` to `.env.local` and set `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, or any other keys used by the project.

3. Running tests

- There are no test scripts defined in `package.json` by default. Add tests and scripts as needed.

Finding relevant code paths
---------------------------

- To change chunking logic: edit `lib/upload-document.ts`.
- To change embedding model or service: edit `lib/upload-config.ts` and `lib/upload-document.ts`.
- To tune search-time parameters (HNSW `ef`, `M`): look for index creation or search parameter settings in `app/api/documents/*` or `lib/` wrappers around the vector store.

Contribution workflow
---------------------

- Create a branch `feature/<short-description>`.
- Add tests and update `docs/` pages when changing algorithms or parameters.
- Open a PR referencing the relevant spec under `specs/` and add a brief performance/quality note.
