import numpy as np
import pytest

from embeddings import generator


class MockModel:
    def __init__(self, output: np.ndarray) -> None:
        self.output = output

    def encode(self, texts: list[str]) -> np.ndarray:
        return self.output[: len(texts)]


def test_embed_texts_returns_empty_384_column_matrix() -> None:
    embeddings = generator.embed_texts([])

    assert embeddings.shape == (0, generator.EMBEDDING_DIMENSION)
    assert embeddings.dtype == np.float32


def test_embed_texts_returns_float32_384_columns(monkeypatch: pytest.MonkeyPatch) -> None:
    output = np.ones((2, generator.EMBEDDING_DIMENSION), dtype=np.float64)
    monkeypatch.setattr(generator, "get_embedding_model", lambda: MockModel(output))

    embeddings = generator.embed_texts(["first", "second"])

    assert embeddings.shape == (2, generator.EMBEDDING_DIMENSION)
    assert embeddings.dtype == np.float32


def test_embed_texts_rejects_wrong_dimension(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(generator, "get_embedding_model", lambda: MockModel(np.ones((1, 12))))

    with pytest.raises(ValueError):
        generator.embed_texts(["text"])
