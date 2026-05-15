# Research: Frontend Chat UI

## Decision: Use localized React state for chat session history

**Rationale**: The Phase 5 backend intentionally treats each question as stateless. The frontend only needs to preserve visible messages for the current page session, so `useState`, `useRef`, and `useEffect` keep the implementation lightweight and easy to reason about.

**Alternatives considered**:
- Redux or Zustand: rejected because the feature has one local conversation surface and no cross-route state sharing requirement.
- Persisting chat state to browser storage: rejected because Phase 6 only requires current-session chat history and avoids retention/privacy scope expansion.

## Decision: Implement chat UI as Next.js Client Components

**Rationale**: The chat input, loading state, typing effect, auto-scroll, and suggested prompt interactions require browser-side interactivity. Current Next.js 16 guidance requires the `'use client'` directive for components using React state and effects.

**Alternatives considered**:
- Server Components for chat interactions: rejected because the UI needs immediate input handling, local state, and incremental display behavior.
- Server Actions: rejected because the existing backend API already owns RAG processing and Phase 6 must not change backend contracts.

## Decision: Consume existing `POST /api/chat` as the only answer endpoint

**Rationale**: Phase 5 already created the backend RAG endpoint and defined the stateless request/response shape. The frontend should submit one question at a time with a demo user ID and render `answer` plus `sources` without inventing new backend behavior.

**Alternatives considered**:
- Sending full message history: rejected because multi-turn context is explicitly out of scope and would violate the backend stateless design.
- Creating a new frontend API route wrapper: rejected for initial implementation because it adds an extra maintenance layer unless CORS or deployment configuration requires it later.

## Decision: Use Tailwind CSS utilities for dark glassmorphism

**Rationale**: Current Tailwind guidance supports translucent backgrounds and `backdrop-blur-*` utilities for glass effects. Utility classes keep the visual system colocated with components and avoid introducing a parallel CSS module system.

**Alternatives considered**:
- CSS modules: rejected because the feature requests Tailwind-only styling and the existing UI already uses Tailwind utilities.
- Component library: rejected because the required UI is small and custom enough to implement directly.

## Decision: Add `lucide-react` for icons

**Rationale**: The chat UI benefits from lightweight consistent icons for send, bot, user, files, and sidebar affordances. `lucide-react` is a small React icon library and avoids hand-writing SVGs repeatedly.

**Alternatives considered**:
- Inline SVGs: rejected because it creates repetitive component markup.
- No icons: rejected because the design asks for a polished assistant UI and icons improve scanability.

## Decision: Add `react-markdown` for assistant answer rendering

**Rationale**: LLM answers may include Markdown formatting such as lists, emphasis, or code snippets. `react-markdown` renders that output into readable React elements while keeping answer rendering separate from citation pills.

**Alternatives considered**:
- Plain text only: rejected because it degrades readability for structured academic answers.
- Raw HTML rendering: rejected because it is unnecessary and creates avoidable XSS risk.

## Decision: Use simulated typing rather than true streaming

**Rationale**: The existing backend returns a complete JSON response and does not stream tokens. A simulated reveal provides the requested polished experience without changing backend behavior.

**Alternatives considered**:
- Server-sent events or streaming responses: rejected because Phase 6 forbids backend changes.
- No typing effect: rejected because the feature specifically requests a simulated typing or streaming effect.
