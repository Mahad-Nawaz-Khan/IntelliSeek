import pytest

from rag.chunker import chunk_text, normalize_text


def test_normalize_text_collapses_whitespace() -> None:
    assert normalize_text("  alpha\n\n beta\t gamma  ") == "alpha beta gamma"


def test_chunk_text_returns_empty_for_empty_text() -> None:
    assert chunk_text(" \n\t ") == []


def test_chunk_text_returns_single_short_chunk() -> None:
    assert chunk_text("short text", chunk_size=50, overlap=10) == ["short text"]


def test_chunk_text_creates_overlapping_long_chunks() -> None:
    text = "abcdefghijklmnopqrstuvwxyz"

    chunks = chunk_text(text, chunk_size=10, overlap=3)

    assert chunks == ["abcdefghij", "hijklmnopq", "opqrstuvwx", "vwxyz"]


def test_chunk_text_validates_size_and_overlap() -> None:
    with pytest.raises(ValueError):
        chunk_text("text", chunk_size=0)
    with pytest.raises(ValueError):
        chunk_text("text", chunk_size=10, overlap=-1)
    with pytest.raises(ValueError):
        chunk_text("text", chunk_size=10, overlap=10)
