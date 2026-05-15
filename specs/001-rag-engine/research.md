# Research: RAG Engine

## Decision: Reuse Phase 4 embedding and FAISS lifecycle

**Rationale**: The query embedding must live in the same vector space as indexed chunks. Reusing `all-MiniLM-L6-v2` and the persistent Phase 4 FAISS index keeps search behavior consistent and avoids duplicate model/index state.

**Alternatives considered**:

- Use a separate embedding model for queries: rejected because chunk/query vectors would not be comparable.
- Rebuild the index per request: rejected because it is slow and unnecessary when Phase 4 already persists index state.
- Store full text in FAISS metadata: rejected because Supabase remains the authoritative text store and FAISS should stay vector-focused.

## Decision: Retrieve a bounded Top-K context set, default K=3 with allowed range 2-5

**Rationale**: Small context sets reduce latency and cost, keep prompts focused, and avoid context dilution. Defaulting to 3 provides enough evidence for common academic questions while leaving room for 2-5 tuning.

**Alternatives considered**:

- Retrieve dozens of chunks: rejected because this increases token usage and can reduce answer accuracy.
- Always retrieve one chunk: rejected because many academic answers need multiple supporting excerpts.
- Let callers request arbitrary K: rejected because it can violate performance and context-window constraints.

## Decision: Hydrate FAISS IDs through local mapping and Supabase tables

**Rationale**: FAISS returns integer IDs, while stored chunks use Supabase row IDs. The Phase 4 mapping file connects FAISS integer IDs to exact chunk IDs, and Supabase provides chunk text plus document filenames for citations.

**Alternatives considered**:

- Assume FAISS IDs equal database primary keys: rejected because Supabase chunk IDs are UUIDs in the current design.
- Store filenames in the mapping file: rejected because document metadata in Supabase is the source of truth.
- Return FAISS IDs directly to the client: rejected because clients need source metadata and grounded text, not internal vector IDs.

## Decision: Use Groq Python SDK for answer generation

**Rationale**: The user specified Groq and the `meta-llama/llama-4-scout-17b-16e-instruct` model. Current Groq Python documentation shows synchronous usage through `Groq(api_key=os.environ.get("GROQ_API_KEY"))` and `client.chat.completions.create(messages=[...], model=...)`, which fits the current FastAPI style.

**Alternatives considered**:

- Local Llama inference: rejected because it adds hardware and deployment complexity.
- OpenAI or another hosted provider: rejected because the project architecture explicitly selects Groq.
- Async Groq client first: deferred because the existing backend endpoint style is synchronous and the smallest viable change is a synchronous wrapper.

## Decision: Strict prompt with source citation and refusal behavior

**Rationale**: RAG answers must be grounded in uploaded academic material. The prompt must instruct the model to answer only from provided context, cite filenames, and refuse unsupported questions.

**Alternatives considered**:

- General-purpose assistant prompt: rejected because it permits unsupported outside knowledge.
- Citation post-processing only: rejected because citations should be part of answer generation and source metadata should also be returned structurally.
- Allow answers from model knowledge when context is weak: rejected because it violates accuracy constraints.

## Decision: Stateless chat endpoint for Phase 5

**Rationale**: Treating each question independently keeps token usage low, avoids context dilution, improves response time, and matches the explicit non-goal excluding multi-turn memory.

**Alternatives considered**:

- Include full chat history in every prompt: rejected because it increases token cost and can distract retrieval grounding.
- Summarize prior turns: deferred as future multi-turn memory work.
- Store no history: rejected because Phase 5 requires logging successful interactions.
