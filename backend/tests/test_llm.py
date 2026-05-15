import pytest

from rag import llm


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


class Message:
    content = "Recursion is when a function calls itself. [Source: notes.pdf]"


class Choice:
    message = Message()


class Completion:
    choices = [Choice()]


class Completions:
    def __init__(self) -> None:
        self.kwargs = None

    def create(self, **kwargs):
        self.kwargs = kwargs
        return Completion()


class Chat:
    def __init__(self) -> None:
        self.completions = Completions()


class Client:
    def __init__(self) -> None:
        self.chat = Chat()


def test_build_messages_instructs_context_only_and_refusal() -> None:
    messages = llm.build_messages("Explain recursion", CONTEXT)

    assert messages[0]["role"] == "system"
    assert "Answer only using the provided context chunks" in messages[0]["content"]
    assert "does not contain enough information" in messages[0]["content"]


def test_build_messages_includes_filename_and_excerpt() -> None:
    messages = llm.build_messages("Explain recursion", CONTEXT)

    assert "Source: notes.pdf" in messages[1]["content"]
    assert "Recursion is when a function calls itself." in messages[1]["content"]


def test_get_groq_client_requires_api_key(monkeypatch) -> None:
    monkeypatch.delenv("GROQ_API_KEY", raising=False)

    with pytest.raises(RuntimeError, match="GROQ_API_KEY"):
        llm.get_groq_client()


def test_generate_answer_calls_groq_with_model(monkeypatch) -> None:
    client = Client()
    monkeypatch.setattr(llm, "get_groq_client", lambda: client)

    answer = llm.generate_answer("Explain recursion", CONTEXT)

    assert answer == "Recursion is when a function calls itself. [Source: notes.pdf]"
    assert client.chat.completions.kwargs["model"] == llm.GROQ_MODEL
    assert client.chat.completions.kwargs["messages"][0]["role"] == "system"


def test_generate_answer_rejects_empty_context() -> None:
    with pytest.raises(ValueError, match="No sufficient context"):
        llm.generate_answer("Explain recursion", [])
