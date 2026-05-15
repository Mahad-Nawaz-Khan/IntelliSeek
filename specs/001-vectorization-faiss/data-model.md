# Data Model: Vectorization & FAISS Indexing Pipeline

## Document

**Source**: Existing `public.documents` table.

**Fields**:

- `id`: UUID primary key.
- `user_id`: UUID owner reference.
- `filename`: Original uploaded filename.
- `file_type`: Validated MIME/type value.
- `file_size`: Uploaded file size.
- `storage_path`: Supabase Storage object path.
- `created_at`: Creation timestamp.

**Relationships**:

- One Document has many Text Segments.

**Validation rules**:

- Filename and storage path must be non-empty.
- File type must be one of supported document types.
- File size must be non-negative and bounded by upload validation.

## Text Segment

**Source**: Existing `public.chunks` table.

**Fields**:

- `id`: UUID primary key.
- `document_id`: UUID reference to `documents.id`.
- `text_content`: Non-empty chunk text.
- `chunk_index`: Zero-based order within the document.
- `created_at`: Creation timestamp.

**Relationships**:

- Many Text Segments belong to one Document.
- One Text Segment maps to one Searchable Representation in the local FAISS index after successful indexing.

**Validation rules**:

- `text_content` must remain non-empty after trimming.
- `chunk_index` must be >= 0.
- `(document_id, chunk_index)` must be unique.

**State transitions**:

1. Extracted text available.
2. Text normalized and split into ordered chunks.
3. Chunk rows inserted into Supabase.
4. Embeddings generated for inserted chunks.
5. FAISS IDs mapped to inserted chunk UUIDs.
6. FAISS index and mapping persisted.

## Searchable Representation

**Source**: Runtime embedding output added to local FAISS index.

**Fields**:

- `faiss_id`: int64 local vector identifier.
- `embedding`: 384-dimensional float32 vector.
- `chunk_id`: UUID of the corresponding `public.chunks.id` row, stored through Index Entry Mapping.

**Relationships**:

- One Searchable Representation maps to exactly one Text Segment.

**Validation rules**:

- Embedding matrix row count must equal inserted chunk count.
- Embedding dimension must be 384.
- Embedding dtype must be compatible with FAISS float32 indexing.
- FAISS IDs must be unique.

## Index Entry Mapping

**Source**: Local persisted mapping artifact, planned path `faiss_index/id_map.json`.

**Fields**:

- `next_faiss_id`: Next int64 ID to allocate.
- `mappings`: Object or list mapping FAISS int64 IDs to chunk UUID strings.

**Relationships**:

- Each mapping entry links one local FAISS vector to one Supabase chunk row.

**Validation rules**:

- Mapping count must match FAISS index `ntotal` after completed writes.
- Every newly inserted chunk must have exactly one mapping entry after indexing completes.
- Mapping file must be loaded before adding new vectors when it exists.

## Persistent Search Index

**Source**: Local FAISS index file, planned path `faiss_index/intelliseek.index`.

**Fields**:

- `dimension`: 384.
- `metric`: L2 distance.
- `ntotal`: Total indexed vectors.
- `ids`: Stored via FAISS `IndexIDMap`.

**Relationships**:

- Contains Searchable Representations keyed by FAISS IDs.
- Uses Index Entry Mapping to resolve FAISS IDs back to chunk UUIDs.

**Validation rules**:

- Existing index must be loaded if present.
- New index must be initialized if no index file exists.
- Index must be saved after successful vector addition.
- `ntotal` must increase by the number of newly added embeddings per successful parse/index run.
