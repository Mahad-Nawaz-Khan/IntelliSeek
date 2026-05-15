import json

from main import ChatRequest, chat_with_rag


CONTEXT = [
    {
        "chunk_id": "chunk-1",
        "document_id": "doc-1",
        "text_content": "Recursion is when a function calls itself.",
        "chunk_index": 0,
        "filename": "notes.pdf",
        "score": 0.1,
        "faiss_id": 10,
    }
]
SOURCES = [{"document_id": "doc-1", "filename": "notes.pdf", "chunk_id": "chunk-1", "chunk_index": 0}]


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
        if self.client.fail_insert:
            return Result([])
        self.client.inserted.append(self.payload)
        return Result([{ "id": "history-1", **self.payload }])


class SupabaseMock:
    def __init__(self, fail_insert: bool = False) -> None:
        self.fail_insert = fail_insert
        self.inserted = []

    def table(self, table_name: str) -> Query:
        assert table_name == "chat_history"
        return Query(table_name, self)


def decode_response(response):
    return json.loads(response.body.decode())


def test_chat_endpoint_returns_answer_sources_and_logs_history(monkeypatch) -> None:
    supabase = SupabaseMock()
    monkeypatch.setattr("main.retrieve_context", lambda question: CONTEXT)
    monkeypatch.setattr("main.generate_answer", lambda question, context: "Recursion calls itself. [Source: notes.pdf]")
    monkeypatch.setattr("main.to_source_citations", lambda context: SOURCES)
    monkeypatch.setattr("main.get_supabase_client", lambda: supabase)

    response = chat_with_rag(ChatRequest(question="Explain recursion", user_id="user-1"))

    assert response["ok"] is True
    assert response["sources"] == SOURCES
    assert supabase.inserted == [
        {
            "user_id": "user-1",
            "question": "Explain recursion",
            "answer": "Recursion calls itself. [Source: notes.pdf]",
            "sources_cited": SOURCES,
        }
    ]


def test_chat_endpoint_rejects_empty_question() -> None:
    response = chat_with_rag(ChatRequest(question="   ", user_id="user-1"))

    assert response.status_code == 400
    assert decode_response(response)["error"] == "Question must not be empty"


def test_chat_endpoint_no_context_does_not_insert_history(monkeypatch) -> None:
    supabase = SupabaseMock()
    monkeypatch.setattr("main.retrieve_context", lambda question: [])
    monkeypatch.setattr("main.get_supabase_client", lambda: supabase)

    response = chat_with_rag(ChatRequest(question="Unsupported?", user_id="user-1"))

    assert response.status_code == 400
    assert "No sufficient context" in decode_response(response)["error"]
    assert supabase.inserted == []


def test_chat_endpoint_retrieval_failure_does_not_insert_history(monkeypatch) -> None:
    supabase = SupabaseMock()
    monkeypatch.setattr("main.retrieve_context", lambda question: (_ for _ in ()).throw(RuntimeError("missing mapping")))
    monkeypatch.setattr("main.get_supabase_client", lambda: supabase)

    response = chat_with_rag(ChatRequest(question="Explain recursion", user_id="user-1"))

    assert response.status_code == 500
    assert decode_response(response)["error"] == "Retrieval failed"
    assert supabase.inserted == []


def test_chat_endpoint_generation_failure_does_not_insert_history(monkeypatch) -> None:
    supabase = SupabaseMock()
    monkeypatch.setattr("main.retrieve_context", lambda question: CONTEXT)
    monkeypatch.setattr("main.generate_answer", lambda question, context: (_ for _ in ()).throw(RuntimeError("groq failed")))
    monkeypatch.setattr("main.get_supabase_client", lambda: supabase)

    response = chat_with_rag(ChatRequest(question="Explain recursion", user_id="user-1"))

    assert response.status_code == 500
    assert decode_response(response)["error"] == "Answer generation failed"
    assert supabase.inserted == []


def test_chat_endpoint_history_insert_failure_returns_error(monkeypatch) -> None:
    monkeypatch.setattr("main.retrieve_context", lambda question: CONTEXT)
    monkeypatch.setattr("main.generate_answer", lambda question, context: "Recursion calls itself. [Source: notes.pdf]")
    monkeypatch.setattr("main.to_source_citations", lambda context: SOURCES)
    monkeypatch.setattr("main.get_supabase_client", lambda: SupabaseMock(fail_insert=True))

    response = chat_with_rag(ChatRequest(question="Explain recursion", user_id="user-1"))

    assert response.status_code == 500
    assert decode_response(response)["error"] == "Chat history persistence failed"
