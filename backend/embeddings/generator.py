from typing import Any

import numpy as np

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIMENSION = 384

_model: Any | None = None


def get_embedding_model() -> Any:
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer(MODEL_NAME)
    return _model


def embed_texts(texts: list[str]) -> np.ndarray:
    if not texts:
        return np.empty((0, EMBEDDING_DIMENSION), dtype=np.float32)

    embeddings = np.asarray(get_embedding_model().encode(texts), dtype=np.float32)
    if embeddings.ndim != 2 or embeddings.shape[1] != EMBEDDING_DIMENSION:
        raise ValueError(f"Expected embeddings with {EMBEDDING_DIMENSION} columns")

    return embeddings
