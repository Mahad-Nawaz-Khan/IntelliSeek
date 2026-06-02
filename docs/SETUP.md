See [docs/DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) for local setup and environment variables.

This file supplements the repository's top-level setup by summarizing system prerequisites and recommended versions.

Requirements
------------

- Node.js >= 20
- npm or pnpm
- A modern browser for the Next.js app

Recommended optional tools
-------------------------

- `faiss` or `hnswlib` if running large-scale experiments offline
- `docker` for containerized deployments
# Setup Guide

This guide explains how to run IntelliSeek locally with Supabase, OpenRouter, Groq, and Inngest-compatible indexing.

## Prerequisites

- Node.js 20 or newer.
- npm.
- A Supabase project.
- An OpenRouter API key for embeddings and chat generation.
- A Groq API key if you want Groq fallback/title generation behavior.
- An Inngest account or local Inngest dev server for production-like background indexing.

## Install Dependencies

From the repository root:

```bash
npm --prefix frontend install
```

All application commands are run from `frontend/` or with `npm --prefix frontend ...`.

## Environment Variables

Create `frontend/.env.local`.

```env
# Supabase client values. These are safe for the browser.
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-or-anon-key

# Supabase server values. Keep these private.
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-supabase-service-role-key

# OpenRouter. Used for embeddings and primary agent generation.
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small
OPENROUTER_CHAT_MODEL=openai/gpt-4o-mini
OPENROUTER_HTTP_REFERER=http://localhost:3000
OPENROUTER_APP_TITLE=IntelliSeek

# Groq. Used by Groq-specific server helpers and fallback paths.
GROQ_API_KEY=your-groq-api-key
GROQ_CHAT_MODEL=llama-3.3-70b-versatile

# Optional global rate limiting for Vercel/serverless.
UPSTASH_REDIS_REST_URL=https://your-upstash-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
```

Required for a fully working app:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_KEY`
- `OPENROUTER_API_KEY`

Optional but recommended:

- `GROQ_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

When Upstash variables are missing, the app uses an in-memory rate limiter for local development.

## Supabase Database Setup

1. Open the Supabase project dashboard.
2. Go to **SQL Editor**.
3. Run the full contents of:

```text
database/schema.sql
```

The schema creates:

- `documents`
- `chunks`
- `chat_sessions`
- `chat_history`
- `document_topics`
- pgvector extension and HNSW index
- `match_user_chunks` RPC function
- Row Level Security policies
- `academic-documents` storage bucket

## Supabase Storage

The schema creates or updates a private bucket named `academic-documents` with these MIME types:

- `application/pdf`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `application/vnd.openxmlformats-officedocument.presentationml.presentation`
- `text/plain`
- `text/markdown`

If uploads fail with `Storage bucket "academic-documents" was not found`, rerun `database/schema.sql` or manually create the bucket in Supabase Storage.

## Supabase Auth

Enable the login providers you want in Supabase Dashboard > Authentication > Providers.

For OAuth providers such as Google and GitHub, configure callback URLs:

```text
http://localhost:3000/auth/callback
https://your-vercel-domain.vercel.app/auth/callback
```

OAuth client IDs and secrets belong in Supabase provider settings, not in frontend environment variables.

## Run Locally

```bash
npm --prefix frontend run dev
```

Open:

```text
http://localhost:3000
```

## Validate The App

From `frontend/`:

```bash
npm run lint
npm run build
```

Manual checks:

- Sign up or sign in.
- Upload a `.pdf`, `.docx`, `.pptx`, `.txt`, or `.md` file.
- Confirm the file moves from queued/processing to indexed in the library.
- Ask a question that is answered by the uploaded material.
- Confirm source citations appear for grounded answers.
- Ask a general question and confirm the app can answer without uploaded context.
- Test chat streaming, stop response, queued follow-up messages, and recent chat loading.

## Admin Setup

Admins can upload to the shared knowledge base.

Run this SQL in Supabase, replacing the email:

```sql
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
where email = 'user@example.com';
```

The user must sign out and sign back in after the metadata update.
