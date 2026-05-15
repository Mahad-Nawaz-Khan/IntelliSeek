# Data Model: UI UX Redesign

## NavigationItem

Represents a route or sidebar action.

| Field | Type | Required | Notes |
|---|---|---:|---|
| id | string | yes | Stable identifier such as `chat`, `library`, `settings`, `new-chat` |
| label | string | yes | Human-readable text |
| href | string | no | Route for navigational items |
| icon | string | no | Icon name or visual token |
| status | active/inactive/disabled | yes | Current navigation state |
| count | number | no | Optional badge for sources/chats |

**Relationships**: May reference a `KnowledgeSourceGroup` or `ChatSession` list.

**Validation Rules**:
- `label` must be non-empty.
- `href` must be present for route navigation items.
- Disabled items must remain readable and non-interactive.

## KnowledgeSource

Represents a built-in or uploaded academic source shown in the library, sidebar, citations, or retrieval panel.

| Field | Type | Required | Notes |
|---|---|---:|---|
| id | string | yes | Unique source identifier |
| filename | string | yes | Display name for the source |
| sourceType | built-in/uploaded | yes | Determines grouping |
| fileType | pdf/docx/pptx/txt/unknown | no | Used for badges/icons |
| status | available/indexing/indexed/failed | yes | Source readiness state |
| createdAt | string | no | Displayed for uploaded files |
| summary | string | no | Optional preview text |

**Relationships**: Can appear in `KnowledgeSourceGroup`, `Citation`, `UploadItem`, and `RetrievalMatch`.

**Validation Rules**:
- Long filenames must truncate or wrap without layout overflow.
- Failed sources must expose a readable status.

## KnowledgeSourceGroup

Represents a sidebar/library grouping such as Knowledge Base or Your Uploads.

| Field | Type | Required | Notes |
|---|---|---:|---|
| id | string | yes | Stable group identifier |
| title | string | yes | Group heading |
| emptyMessage | string | yes | Message when no sources exist |
| sources | KnowledgeSource[] | yes | Ordered source entries |

## ChatSession

Represents a recent conversation displayed in the sidebar.

| Field | Type | Required | Notes |
|---|---|---:|---|
| id | string | yes | Session identifier |
| title | string | yes | Derived from first or latest prompt |
| lastMessageAt | string | no | Display timestamp |
| status | active/inactive | yes | Current session selection |

**Validation Rules**:
- Empty recent-chat list must show helpful empty state.
- Very long titles must truncate safely.

## ChatMessage

Represents one user or assistant message in the chat stream.

| Field | Type | Required | Notes |
|---|---|---:|---|
| id | string | yes | Message identifier |
| role | user/assistant | yes | Controls alignment and visual treatment |
| content | string | yes | Markdown-capable for assistant messages |
| displayedContent | string | no | Used during typing reveal |
| status | loading/complete/error | yes | Message state |
| citations | Citation[] | no | Assistant source references |
| createdAt | number/string | yes | Ordering |

**State Transitions**:
- User message: `complete` only.
- Assistant message: `loading` → `complete` or `error`.
- Typing reveal may temporarily use `displayedContent` before `complete`.

## Citation

Represents a compact source reference on an assistant answer.

| Field | Type | Required | Notes |
|---|---|---:|---|
| id | string | yes | Citation identifier |
| sourceId | string | yes | Referenced source |
| label | string | yes | Compact chip text, e.g. `DSA.pdf p12` |
| filename | string | yes | Source name |
| locator | string | no | Page, slide, or chunk index |
| preview | string | no | Short snippet for hover/focus preview |

**Validation Rules**:
- Citation chip text must remain readable on mobile.
- Preview must be optional; missing preview must not hide the citation.

## UploadItem

Represents a file in the upload modal/dropzone flow.

| Field | Type | Required | Notes |
|---|---|---:|---|
| id | string | yes | Upload row identifier |
| filename | string | yes | Display name |
| fileType | pdf/docx/pptx/txt/unknown | yes | Used for validation display |
| sizeLabel | string | no | Human-readable size |
| progress | number | no | 0-100 when measurable |
| status | idle/uploading/indexing/indexed/failed | yes | Upload lifecycle |
| errorMessage | string | no | Failure explanation |

**State Transitions**:
- `idle` → `uploading` → `indexing` → `indexed`
- `idle`/`uploading`/`indexing` → `failed`

## RetrievalStatus

Represents visible answer-preparation feedback.

| Field | Type | Required | Notes |
|---|---|---:|---|
| state | idle/analyzing/retrieving/answering/complete/error | yes | Current retrieval UI state |
| message | string | yes | User-facing status text |
| matches | RetrievalMatch[] | no | Sources being shown as retrieved |

## RetrievalMatch

Represents a source shown in the retrieval visualization or right-side source panel.

| Field | Type | Required | Notes |
|---|---|---:|---|
| id | string | yes | Match identifier |
| sourceId | string | yes | Referenced source |
| filename | string | yes | Display source name |
| locator | string | no | Page/slide/chunk indicator |
| snippet | string | no | Short preview text |
| scoreLabel | string | no | Optional human-readable relevance label |

**Validation Rules**:
- Match display must not imply exact confidence if no score is available.
- Snippets must be short enough not to overwhelm the answer.
