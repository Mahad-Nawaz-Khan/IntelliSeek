# Implementation Plan: UI UX Redesign

**Branch**: `001-ui-ux-redesign` | **Date**: 2026-05-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-ui-ux-redesign/spec.md`

**Note**: This template is filled in by the `/sp.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Redesign IntelliSeek into a premium academic AI workspace inspired by ChatGPT, Notion, and semantic search tools. The implementation will keep the governed Vercel-only Next.js architecture and focus on UI structure: landing page, chat workspace, library view, settings view, source-oriented chat messages, upload feedback, retrieval visualization, mobile sidebar behavior, and subtle motion.

## Technical Context

**Language/Version**: TypeScript 5 with Next.js 16.2.6 App Router and React 19.2.4  
**Primary Dependencies**: Next.js App Router, Tailwind CSS 4, lucide-react, react-markdown, existing Supabase browser client; optional Framer Motion added only if task planning accepts the dependency  
**Storage**: Existing Supabase document metadata for uploaded sources; local React state for recent chat/session UI; no new persistent data store required for the visual redesign  
**Testing**: `npm --prefix frontend run lint`, `npm --prefix frontend run build`, manual browser validation for desktop and mobile flows  
**Target Platform**: Vercel-hosted Next.js application  
**Project Type**: Next.js web application with App Router pages, React components, and frontend libs  
**Performance Goals**: First meaningful UI visible within normal Vercel static/app load expectations; sidebar/chat interactions feel instant; no horizontal overflow across mobile-to-desktop viewport widths  
**Constraints**: Vercel-compatible runtime; no required Python/FastAPI/FAISS/Railway/Docker services; no server-only secrets exposed to client; clean academic UI over flashy dashboard styling  
**Scale/Scope**: Student/university demo scale; one primary assistant workspace plus landing, library, and settings surfaces; visual retrieval and citation UX without changing core RAG behavior in this feature

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- PASS — Vercel-only architecture preserved: feature targets `frontend/app`, `frontend/components`, and `frontend/lib` only.
- PASS — Retrieval redesign is presentation-focused and does not reintroduce FAISS or Python runtime dependencies.
- PASS — DSA concepts remain accurate: existing Trie autocomplete may be surfaced in the chat input, but no unimplemented DSA feature will be claimed.
- PASS — Server-only secrets remain outside client components and `NEXT_PUBLIC_` variables; feature does not add new secrets.
- PASS — Feature is independently testable through visual/manual browser checks and existing lint/build validation.

## Project Structure

### Documentation (this feature)

```text
specs/001-ui-ux-redesign/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui-state.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
frontend/
├── app/
│   ├── page.tsx              # Landing page
│   ├── chat/page.tsx         # Main assistant workspace
│   ├── library/page.tsx      # Uploaded/built-in source library
│   ├── settings/page.tsx     # Preferences surface
│   ├── layout.tsx            # Global font/theme shell
│   └── globals.css           # Tailwind/global visual tokens
├── components/
│   ├── chat/                 # Chat workspace, message, input, retrieval visualization
│   ├── sidebar/              # Sidebar navigation, source groups, recent chats
│   ├── upload/               # Upload modal/dropzone/progress composition
│   ├── sources/              # Citation chips, source preview, retrieval panel
│   └── ui/                   # Shared cards, buttons, shell primitives
└── lib/
    ├── chat-api.ts           # Existing chat API client types
    ├── supabase.ts           # Existing Supabase browser client
    └── trie-autocomplete.ts  # Existing DSA autocomplete utility
```

**Structure Decision**: Use `frontend/app` for the requested route surfaces and organize new UI components by product domain under `frontend/components/*`. Existing flat components can be migrated incrementally into domain folders during implementation, but behavior should remain working after each story.

## Complexity Tracking

No constitution violations or complexity exceptions are required.
