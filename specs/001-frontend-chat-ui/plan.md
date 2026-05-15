# Implementation Plan: Frontend Chat UI

**Branch**: `001-frontend-chat-ui` | **Date**: 2026-05-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-frontend-chat-ui/spec.md`

## Summary

Build a frontend-only academic chat workspace in the existing Next.js app. The implementation will replace the current upload-focused landing page with a responsive two-pane UI: a glassmorphic source/upload sidebar and a main chat area that stores the current session's messages in local React state, sends each question independently to the existing `POST /api/chat` backend, renders assistant answers with source filename citations, supports suggested query chips, and preserves the Phase 5 stateless RAG contract by never sending previous messages back to the backend.

## Technical Context

**Language/Version**: TypeScript 5, React 19.2.4, Next.js 16.2.6  
**Primary Dependencies**: Next.js App Router, React client components, Tailwind CSS 4, existing Supabase browser client, existing `FileUpload`, new `lucide-react`, new `react-markdown`  
**Storage**: Client memory only for chat messages; Supabase is read-only from the frontend for source listing and upload support through existing utilities  
**Testing**: `npm run lint`, `npm run build`, manual browser validation of chat flow and responsive layout  
**Target Platform**: Browser frontend served by Next.js local dev server  
**Project Type**: Web application with `frontend/app`, `frontend/components`, and `frontend/lib`  
**Performance Goals**: Chat input remains responsive during requests; loading state appears immediately; simulated typing does not block interaction  
**Constraints**: Frontend-only; no backend, RAG, FAISS, Groq prompt, or Supabase schema changes; local session state only; no auth UI; Tailwind styling only unless existing global CSS is already required  
**Scale/Scope**: One primary chat page, four to six focused components, one existing upload component reused in sidebar

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The repository constitution file is still a placeholder, so effective gates are derived from project instructions, the feature spec, and current frontend guidance:

- **Frontend-only scope**: PASS — plan confines changes to `frontend/` plus spec artifacts; backend endpoints and RAG logic are consumed as-is.
- **Smallest viable change**: PASS — reuse existing `frontend/app/page.tsx`, `frontend/components/FileUpload.tsx`, and existing Supabase helpers; add only focused chat components.
- **No invented backend contracts**: PASS — chat request/response follows existing Phase 5 `POST /api/chat` contract; document listing uses existing Supabase `documents` data with graceful unavailable state.
- **State locality**: PASS — current-session chat history lives in component state and is not sent to the backend.
- **Security/secrets**: PASS — no frontend secrets are added; only public Supabase config and existing backend URL patterns are used.
- **Next.js 16 verification**: PASS — current docs confirm interactive stateful UI should use Client Components with `'use client'`.
- **Tailwind glassmorphism verification**: PASS — current docs confirm `backdrop-blur-*` should be paired with translucent backgrounds such as `bg-slate-900/50`.

## Project Structure

### Documentation (this feature)

```text
specs/001-frontend-chat-ui/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── frontend-chat.yaml
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
frontend/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ChatInput.tsx
│   ├── ChatLayout.tsx
│   ├── FileUpload.tsx
│   ├── MessageBubble.tsx
│   ├── SourceCitation.tsx
│   └── SuggestedQueries.tsx
├── lib/
│   ├── chat-api.ts
│   ├── supabase.ts
│   └── upload-config.ts
├── package.json
└── tsconfig.json
```

**Structure Decision**: Use the existing Next.js App Router frontend. Keep `frontend/app/page.tsx` as the route entry and move feature complexity into focused `frontend/components/*` and `frontend/lib/chat-api.ts` helpers. This avoids backend changes and keeps the route file small enough to validate manually.

## Complexity Tracking

No constitution violations require justification.

## Phase 0: Research

Research decisions are captured in [research.md](./research.md). The key outcomes are:

- Use a single Client Component chat layout with localized React state rather than global state.
- Use Tailwind utilities for dark academic glassmorphism.
- Add `lucide-react` for icons and `react-markdown` for safe markdown rendering of model output.
- Preserve the stateless Phase 5 backend contract by sending only `{ question, user_id }` per request.

## Phase 1: Design & Contracts

Design outputs:

- [data-model.md](./data-model.md) defines frontend message, citation, source, and interaction states.
- [contracts/frontend-chat.yaml](./contracts/frontend-chat.yaml) records the frontend-facing backend contract consumed by the UI.
- [quickstart.md](./quickstart.md) defines setup and manual validation for the chat workspace.

## Implementation Approach

1. Add dependencies `lucide-react` and `react-markdown` to the frontend package.
2. Add `frontend/lib/chat-api.ts` for typed chat request/response handling against `POST /api/chat`.
3. Create presentational chat components: `SourceCitation`, `MessageBubble`, `SuggestedQueries`, and `ChatInput`.
4. Create `ChatLayout` as the main client component that owns `messages`, `isLoading`, input submission, simulated typing, and auto-scroll refs.
5. Replace `frontend/app/page.tsx` content with the chat layout while preserving backend/Supabase status checks if useful in the sidebar/header.
6. Reuse `FileUpload` inside the sidebar and add a compact source list/empty state from available `documents` data.
7. Validate with lint/build and manual browser checks for chat submission, loading, citations, suggested queries, Enter/Shift+Enter, and responsive layout.

## Post-Design Constitution Check

- **Scope**: PASS — generated design artifacts do not require backend or schema modifications.
- **Contracts**: PASS — frontend contract matches existing Phase 5 chat endpoint shape.
- **Testing**: PASS — quickstart includes lint/build plus browser-level UI validation.
- **Security**: PASS — demo user ID is scoped to this phase and no secrets are embedded.
- **Simplicity**: PASS — no global store, no complex routing, and no custom CSS system are introduced.
