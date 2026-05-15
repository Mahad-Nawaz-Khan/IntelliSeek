from typing import TypedDict

import numpy as np

from database.supabase import get_supabase_client
from embeddings.generator import embed_texts
from vector_store.faiss_store import FaissVectorStore

DEFAULT_TOP_K = 3
MIN_TOP_K = 2
MAX_TOP_K = 5


class RetrievedContextChunk(TypedDict):
    chunk_id: str
    document_id: str
    text_content: str
    chunk_index: int
    filename: str
    score: float
    faiss_id: int


class SourceCitation(TypedDict):
    document_id: str
    filename: str
    chunk_id: str
    chunk_index: int


def validate_question(query: str) -> str:
    question = query.strip()
    if not question:
        raise ValueError("Question must not be empty")
    return question


def validate_top_k(k: int) -> int:
    if k < MIN_TOP_K or k > MAX_TOP_K:
        raise ValueError(f"Top-K must be between {MIN_TOP_K} and {MAX_TOP_K}")
    return k


def embed_query(query: str) -> np.ndarray:
    question = validate_question(query)
    return embed_texts([question])


def _fetch_rows_by_ids(supabase, table_name: str, ids: list[str], id_column: str = "id") -> list[dict]:
    if not ids:
        return []
    result = supabase.table(table_name).select("*").in_(id_column, ids).execute()
    return result.data or []


def retrieve_context(query: str, k: int = DEFAULT_TOP_K) -> list[RetrievedContextChunk]:
    question = validate_question(query)
    top_k = validate_top_k(k)
    query_embedding = embed_texts([question])

    vector_store = FaissVectorStore()
    distances, faiss_ids = vector_store.search_vectors(query_embedding, top_k)
    if faiss_ids.size == 0:
        return []

    mappings = vector_store.get_id_mappings()
    requested_ids = [int(faiss_id) for faiss_id in faiss_ids[0].tolist() if int(faiss_id) != -1]
    if not requested_ids:
        return []

    chunk_ids: list[str] = []
    for faiss_id in requested_ids:
        chunk_id = mappings.get(str(faiss_id))
        if chunk_id is None:
            raise RuntimeError(f"Missing chunk mapping for FAISS ID {faiss_id}")
        chunk_ids.append(chunk_id)

    supabase = get_supabase_client()
    chunk_rows = _fetch_rows_by_ids(supabase, "chunks", chunk_ids)
    chunks_by_id = {str(row["id"]): row for row in chunk_rows}
    if len(chunks_by_id) != len(chunk_ids):
        raise RuntimeError("Retrieved chunk count does not match FAISS mapping count")

    document_ids = list({str(row["document_id"]) for row in chunk_rows})
    document_rows = _fetch_rows_by_ids(supabase, "documents", document_ids)
    documents_by_id = {str(row["id"]): row for row in document_rows}

    contexts: list[RetrievedContextChunk] = []
    distance_values = distances[0].tolist() if distances.size else []
    for position, chunk_id in enumerate(chunk_ids):
        row = chunks_by_id[chunk_id]
        document_id = str(row["document_id"])
        document = documents_by_id.get(document_id)
        if document is None:
            raise RuntimeError(f"Missing document metadata for document ID {document_id}")
        contexts.append(
            {
                "chunk_id": chunk_id,
                "document_id": document_id,
                "text_content": str(row["text_content"]),
                "chunk_index": int(row.get("chunk_index", 0)),
                "filename": str(document["filename"]),
                "score": float(distance_values[position]),
                "faiss_id": requested_ids[position],
            }
        )

    return contexts


def to_source_citations(context_chunks: list[RetrievedContextChunk]) -> list[SourceCitation]:
    return [
        {
            "document_id": chunk["document_id"],
            "filename": chunk["filename"],
            "chunk_id": chunk["chunk_id"],
            "chunk_index": chunk["chunk_index"],
        }
        for chunk in context_chunks
    ]
