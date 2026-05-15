import numpy as np
import pytest

from rag import retriever
from rag.retriever import to_source_citations, validate_question, validate_top_k


class Result:
    def __init__(self, data):
        self.data = data


class Query:
    def __init__(self, table_name: str, client: "SupabaseMock") -> None:
        self.table_name = table_name
        self.client = client
        self.ids = []

    def select(self, columns: str):
        return self

    def in_(self, column: str, ids: list[str]):
        self.ids = ids
        return self

    def execute(self):
        if self.table_name == "chunks":
            return Result([self.client.chunks[chunk_id] for chunk_id in self.ids if chunk_id in self.client.chunks])
        if self.table_name == "documents":
            return Result([self.client.documents[document_id] for document_id in self.ids if document_id in self.client.documents])
        raise AssertionError(self.table_name)


class SupabaseMock:
    def __init__(self) -> None:
        self.chunks = {
            "chunk-1": {"id": "chunk-1", "document_id": "doc-1", "text_content": "Recursion calls itself.", "chunk_index": 0},
            "chunk-2": {"id": "chunk-2", "document_id": "doc-2", "text_content": "Base cases stop recursion.", "chunk_index": 1},
        }
        self.documents = {
            "doc-1": {"id": "doc-1", "filename": "notes.pdf"},
            "doc-2": {"id": "doc-2", "filename": "lecture.pdf"},
        }

    def table(self, table_name: str) -> Query:
        return Query(table_name, self)


class VectorStoreMock:
    def __init__(self) -> None:
        self.index_total = 2

    def search_vectors(self, query_embedding: np.ndarray, k: int):
        return np.array([[0.1, 0.2]], dtype=np.float32), np.array([[10, 11]], dtype=np.int64)

    def get_id_mappings(self):
        return {"10": "chunk-1", "11": "chunk-2"}


class MissingMappingVectorStoreMock(VectorStoreMock):
    def get_id_mappings(self):
        return {"10": "chunk-1"}


def test_validate_top_k_accepts_bounds() -> None:
    assert validate_top_k(2) == 2
    assert validate_top_k(3) == 3
    assert validate_top_k(5) == 5


@pytest.mark.parametrize("top_k", [1, 6])
def test_validate_top_k_rejects_out_of_bounds(top_k: int) -> None:
    with pytest.raises(ValueError, match="Top-K"):
        validate_top_k(top_k)


def test_validate_question_rejects_empty_text() -> None:
    with pytest.raises(ValueError, match="Question must not be empty"):
        validate_question("   ")


def test_retrieve_context_maps_faiss_ids_and_hydrates_chunks(monkeypatch) -> None:
    monkeypatch.setattr(retriever, "embed_texts", lambda texts: np.ones((1, 384), dtype=np.float32))
    monkeypatch.setattr(retriever, "FaissVectorStore", VectorStoreMock)
    monkeypatch.setattr(retriever, "get_supabase_client", lambda: SupabaseMock())

    contexts = retriever.retrieve_context("What is recursion?", 2)

    assert [chunk["chunk_id"] for chunk in contexts] == ["chunk-1", "chunk-2"]
    assert [chunk["faiss_id"] for chunk in contexts] == [10, 11]
    assert [chunk["filename"] for chunk in contexts] == ["notes.pdf", "lecture.pdf"]
    assert contexts[0]["text_content"] == "Recursion calls itself."


def test_retrieve_context_fails_when_mapping_missing(monkeypatch) -> None:
    monkeypatch.setattr(retriever, "embed_texts", lambda texts: np.ones((1, 384), dtype=np.float32))
    monkeypatch.setattr(retriever, "FaissVectorStore", MissingMappingVectorStoreMock)

    with pytest.raises(RuntimeError, match="Missing chunk mapping"):
        retriever.retrieve_context("What is recursion?", 2)


def test_to_source_citations_preserves_retrieved_order() -> None:
    citations = to_source_citations(
        [
            {
                "chunk_id": "chunk-1",
                "document_id": "doc-1",
                "text_content": "Recursion calls itself.",
                "chunk_index": 0,
                "filename": "notes.pdf",
                "score": 0.1,
                "faiss_id": 10,
            },
            {
                "chunk_id": "chunk-2",
                "document_id": "doc-2",
                "text_content": "Base cases stop recursion.",
                "chunk_index": 1,
                "filename": "lecture.pdf",
                "score": 0.2,
                "faiss_id": 11,
            },
        ]
    )

    assert citations == [
        {"document_id": "doc-1", "filename": "notes.pdf", "chunk_id": "chunk-1", "chunk_index": 0},
        {"document_id": "doc-2", "filename": "lecture.pdf", "chunk_id": "chunk-2", "chunk_index": 1},
    ]
