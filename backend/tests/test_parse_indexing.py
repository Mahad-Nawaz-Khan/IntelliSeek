import numpy as np

from main import ParseRequest, parse_document


class Result:
    def __init__(self, data):
        self.data = data


class Query:
    def __init__(self, table_name: str, client: "SupabaseMock") -> None:
        self.table_name = table_name
        self.client = client
        self.payload = None

    def insert(self, payload):
        self.payload = payload
        return self

    def execute(self):
        if self.table_name == "documents":
            return Result([{"id": "doc-1", **self.payload}])
        if self.table_name == "chunks":
            rows = [{"id": f"chunk-{index}", **row} for index, row in enumerate(self.payload)]
            self.client.inserted_chunks = rows
            return Result(rows)
        raise AssertionError(self.table_name)


class StorageBucket:
    def download(self, path: str) -> bytes:
        return b"file bytes"


class Storage:
    def from_(self, bucket_name: str) -> StorageBucket:
        return StorageBucket()


class SupabaseMock:
    def __init__(self) -> None:
        self.storage = Storage()
        self.inserted_chunks = []

    def table(self, table_name: str) -> Query:
        return Query(table_name, self)


class Parser:
    def extract_text(self, path) -> str:
        return "alpha " * 250


class VectorStoreMock:
    instances: list["VectorStoreMock"] = []

    def __init__(self) -> None:
        self.index_total = 5
        self.added_ids = []
        VectorStoreMock.instances.append(self)

    def add_vectors(self, embeddings: np.ndarray, chunk_ids: list[str]) -> int:
        self.added_ids = chunk_ids
        self.index_total += len(chunk_ids)
        return len(chunk_ids)


def test_parse_document_inserts_chunks_and_indexes_vectors(monkeypatch) -> None:
    supabase = SupabaseMock()
    VectorStoreMock.instances.clear()
    monkeypatch.setattr("main.get_supabase_client", lambda: supabase)
    monkeypatch.setattr("main.ParserFactory.get_parser", lambda filename: Parser())
    monkeypatch.setattr("main.embed_texts", lambda texts: np.ones((len(texts), 384), dtype=np.float32))
    monkeypatch.setattr("main.FaissVectorStore", VectorStoreMock)

    response = parse_document(
        ParseRequest(
            storage_path="user-1/file.pdf",
            filename="file.pdf",
            file_type="application/pdf",
            file_size=100,
            user_id="user-1",
        )
    )

    assert response["ok"] is True
    assert response["chunks_created"] == len(supabase.inserted_chunks)
    assert response["vectors_indexed"] == response["chunks_created"]
    assert response["index_total"] == 5 + response["chunks_created"]
    assert all(row["document_id"] == "doc-1" for row in supabase.inserted_chunks)
    assert [row["chunk_index"] for row in supabase.inserted_chunks] == list(range(len(supabase.inserted_chunks)))
    assert VectorStoreMock.instances[0].added_ids == [row["id"] for row in supabase.inserted_chunks]


def test_parse_document_reports_indexing_failure(monkeypatch) -> None:
    supabase = SupabaseMock()
    monkeypatch.setattr("main.get_supabase_client", lambda: supabase)
    monkeypatch.setattr("main.ParserFactory.get_parser", lambda filename: Parser())
    monkeypatch.setattr("main.embed_texts", lambda texts: (_ for _ in ()).throw(RuntimeError("boom")))

    response = parse_document(
        ParseRequest(
            storage_path="user-1/file.pdf",
            filename="file.pdf",
            file_type="application/pdf",
            file_size=100,
            user_id="user-1",
        )
    )

    assert response.status_code == 500
    assert "embedding" in response.body.decode()
