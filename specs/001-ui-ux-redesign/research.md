# Research: UI UX Redesign

## Decision: Use Next.js App Router pages for landing, chat, library, and settings

**Rationale**: The current project already uses Next.js App Router (`frontend/app/page.tsx`, `frontend/app/layout.tsx`) and the constitution requires a Vercel-compatible Next.js architecture. Next.js documentation confirms App Router pages and `next/link` are the standard path for route-based navigation. The redesign needs distinct user-facing surfaces, so `/`, `/chat`, `/library`, and `/settings` should be represented as app routes.

**Alternatives considered**:
- Keep everything on `/`: faster but fails the spec's page-structure requirement and makes navigation less credible.
- Add a separate router library: unnecessary because App Router already provides route structure.

## Decision: Prioritize Tailwind-only visual polish first

**Rationale**: Tailwind CSS 4 is already installed and the current UI already uses utility classes for dark mode, glassmorphism, spacing, borders, and hover states. Using Tailwind first keeps the implementation small, avoids dependency churn, and matches the constitution's smallest deployable change principle.

**Alternatives considered**:
- Introduce a component library: faster for generic dashboards but likely conflicts with the requested custom ChatGPT + Notion + semantic-search feel.
- Add CSS modules: unnecessary because Tailwind already covers the visual system.

## Decision: Treat Framer Motion as optional enhancement

**Rationale**: The prompt recommends Framer Motion, but `frontend/package.json` does not currently include it. Framer Motion documentation supports `MotionConfig` with `reducedMotion="user"`, `motion.div`, and hover/tap/fade animations. It is appropriate for premium polish, but the initial plan should not require it unless tasks explicitly add and validate the dependency.

**Alternatives considered**:
- Add Framer Motion immediately: improves polish but expands dependency surface and install/build risk.
- Use only CSS transitions: enough for MVP polish and reduced complexity.

## Decision: Use source-oriented UI without changing RAG behavior

**Rationale**: The spec is a UI/UX redesign. Current chat types already support assistant messages with `sources`, and current `MessageBubble`/`SourceCitation` components render citations. The redesign should improve citation chips, preview affordances, retrieval status, and optional source panels while avoiding backend/retrieval changes in this phase.

**Alternatives considered**:
- Modify backend retrieval contracts: out of scope for a UI plan and risks breaking existing chat behavior.
- Fake source data: acceptable only for landing/demo previews, not for actual assistant answers.

## Decision: Model upload progress as UI states, not new storage

**Rationale**: The spec needs upload progress and indexed-file completion feedback. Existing `FileUpload` already has upload/parse status states. The plan should redesign that experience into a modal/dropzone/progress UI while reusing existing upload behavior where possible.

**Alternatives considered**:
- Add persistent upload job tracking: useful later but unnecessary for current student-scale UI polish.
- Make upload purely decorative: would not satisfy functional requirements.

## Decision: Keep recent chats local unless persistence is planned later

**Rationale**: The spec requires recent chats as a visible sidebar section. Current chat history is local session state, and the redesign can display recent local prompts without adding account/history infrastructure. Persistent chat history can be planned separately if needed.

**Alternatives considered**:
- Persist recent chats now: expands storage/auth scope beyond UI redesign.
- Omit recent chats: fails the sidebar requirement.
