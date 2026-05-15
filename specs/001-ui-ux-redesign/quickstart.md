# Quickstart: UI UX Redesign Validation

## Goal

Validate that IntelliSeek feels like a clean academic AI workspace where users can upload notes and talk to them with visible source grounding.

## Prerequisites

- Frontend dependencies installed.
- Local frontend environment configured if Supabase-backed source lists are being validated.
- Existing chat backend/API behavior available if live answer validation is included.

## Run locally

From the repository root:

```powershell
npm --prefix frontend run dev
```

Open:

```text
http://localhost:3000
```

## Build validation

```powershell
npm --prefix frontend run lint
npm --prefix frontend run build
```

## Manual validation checklist

### Landing page `/`

- [ ] Hero communicates "Understand Your Notes With AI" or equivalent value.
- [ ] Primary calls to action are visible and route to the assistant/demo path.
- [ ] Feature grid highlights semantic search, multi-format uploads, AI explanations, and source citations.
- [ ] Demo preview looks like the assistant workspace.

### Chat workspace `/chat`

- [ ] Dark academic theme uses the requested visual palette direction: dark slate/background with violet/cyan accents.
- [ ] Desktop layout shows sidebar plus main chat area.
- [ ] Header identifies IntelliSeek AI as a semantic academic assistant.
- [ ] Empty state asks what the user wants to learn and shows suggested prompt cards.
- [ ] Chat input remains reachable near the bottom and supports multi-line text.
- [ ] Existing Trie autocomplete still appears when typing 2+ matching characters.
- [ ] User and assistant messages are visually distinct.
- [ ] Assistant message supports rich text and citations.

### Sidebar

- [ ] Logo/brand area is visible.
- [ ] New Chat action is visible.
- [ ] Knowledge Base and Your Uploads are visually separated.
- [ ] Recent Chats section handles both populated and empty states.
- [ ] Settings entry is visible.
- [ ] Hover/focus states are visible but subtle.

### Upload experience

- [ ] Upload action is easy to find from the chat workspace.
- [ ] Upload UI communicates PDF, DOCX, PPTX, and TXT support.
- [ ] Uploading/indexing states are visible.
- [ ] Success state shows indexed file feedback.
- [ ] Failure state is readable and retryable.

### Retrieval and citations

- [ ] Asking a question shows an analyzing/retrieving state before the final answer when applicable.
- [ ] Retrieved source visualization appears without overwhelming the answer.
- [ ] Citation chips are compact and readable.
- [ ] Citation preview appears on hover/focus when preview text exists.
- [ ] No-source or insufficient-context states are clear.

### Library `/library`

- [ ] Uploaded and built-in sources are listed or an empty state explains what to do next.
- [ ] Long filenames do not break layout.
- [ ] Source status is visible where applicable.

### Settings `/settings`

- [ ] Preferences surface exists and matches the visual system.
- [ ] Unimplemented preferences are presented as disabled/coming-soon rather than broken controls.

### Mobile

- [ ] Sidebar collapses or is accessible through a compact control.
- [ ] Chat remains the primary visible area.
- [ ] Chat input does not cover the latest message.
- [ ] Citation chips wrap or compact without horizontal overflow.
- [ ] Upload action remains accessible.

## Success criteria review

- [ ] A first-time evaluator can identify asking, uploading, and source viewing within 10 seconds.
- [ ] A user can start a chat from a suggested prompt in under 3 interactions.
- [ ] No horizontal overflow is visible across supported viewport widths.
- [ ] Upload status communicates current state clearly.
- [ ] Source citations remain visible for sourced answers.
- [ ] Manual reviewers rate the final presentation as clean, modern, and academic.
