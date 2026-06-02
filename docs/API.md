# API Reference (quick)

This is a short reference to key API routes in the Next.js app. For full API docs, expand this file with request/response examples.

Routes of interest
------------------

- `/api/documents/upload`: document upload and chunking entrypoint.
- `/api/documents/search`: vector search API (query → embedding → search → top-k)
- `/api/chat`: chat endpoint that uses retrieval to ground LLM responses.

Each route lives under `app/api/` — inspect route handlers for exact parameter names and payload shapes.
