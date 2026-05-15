import json
from pathlib import Path
from typing import Any

import faiss
import numpy as np

FAISS_INDEX_PATH = Path("faiss_index/intelliseek.index")
FAISS_ID_MAP_PATH = Path("faiss_index/id_map.json")
EMBEDDING_DIMENSION = 384


def create_index() -> Any:
    return faiss.IndexIDMap(faiss.IndexFlatL2(EMBEDDING_DIMENSION))


def load_index(filepath: str | Path) -> Any:
    path = Path(filepath)
    if not path.exists():
        return create_index()

    index = faiss.read_index(str(path))
    if index.d != EMBEDDING_DIMENSION:
        raise ValueError(f"Expected FAISS index dimension {EMBEDDING_DIMENSION}")
    return index


def save_index(index: Any, filepath: str | Path) -> None:
    path = Path(filepath)
    path.parent.mkdir(parents=True, exist_ok=True)
    faiss.write_index(index, str(path))


class FaissVectorStore:
    def __init__(
        self,
        index_path: str | Path = FAISS_INDEX_PATH,
        id_map_path: str | Path = FAISS_ID_MAP_PATH,
    ) -> None:
        self.index_path = Path(index_path)
        self.id_map_path = Path(id_map_path)
        self.index = load_index(self.index_path)
        self.mapping = self._load_mapping()
        self._validate_counts()

    @property
    def index_total(self) -> int:
        return int(self.index.ntotal)

    def get_id_mappings(self) -> dict[str, str]:
        return dict(self.mapping["mappings"])

    def search_vectors(self, query_embedding: np.ndarray, k: int) -> tuple[np.ndarray, np.ndarray]:
        if query_embedding.ndim != 2 or query_embedding.shape[1] != EMBEDDING_DIMENSION:
            raise ValueError(f"Expected query embedding with {EMBEDDING_DIMENSION} columns")
        if k <= 0:
            raise ValueError("k must be greater than 0")
        if self.index_total == 0:
            return np.empty((1, 0), dtype=np.float32), np.empty((1, 0), dtype=np.int64)

        limit = min(k, self.index_total)
        distances, ids = self.index.search(np.asarray(query_embedding, dtype=np.float32), limit)
        return distances, ids

    def _load_mapping(self) -> dict[str, Any]:
        if not self.id_map_path.exists():
            return {"next_faiss_id": 1, "mappings": {}}

        with self.id_map_path.open("r", encoding="utf-8") as file:
            data = json.load(file)

        mappings = {str(key): str(value) for key, value in data.get("mappings", {}).items()}
        next_faiss_id = int(data.get("next_faiss_id", 1))
        return {"next_faiss_id": next_faiss_id, "mappings": mappings}

    def _save_mapping(self) -> None:
        self.id_map_path.parent.mkdir(parents=True, exist_ok=True)
        with self.id_map_path.open("w", encoding="utf-8") as file:
            json.dump(self.mapping, file, indent=2, sort_keys=True)

    def _allocate_ids(self, chunk_ids: list[str]) -> np.ndarray:
        start = int(self.mapping["next_faiss_id"])
        faiss_ids = np.arange(start, start + len(chunk_ids), dtype=np.int64)
        mappings = self.mapping["mappings"]
        for faiss_id, chunk_id in zip(faiss_ids.tolist(), chunk_ids, strict=True):
            mappings[str(faiss_id)] = str(chunk_id)
        self.mapping["next_faiss_id"] = start + len(chunk_ids)
        return faiss_ids

    def _validate_counts(self) -> None:
        if int(self.index.ntotal) != len(self.mapping["mappings"]):
            raise ValueError("FAISS index count does not match ID mapping count")

    def add_vectors(self, embeddings: np.ndarray, chunk_ids: list[str]) -> int:
        if embeddings.ndim != 2 or embeddings.shape[1] != EMBEDDING_DIMENSION:
            raise ValueError(f"Expected embeddings with {EMBEDDING_DIMENSION} columns")
        if embeddings.shape[0] != len(chunk_ids):
            raise ValueError("Embedding row count must match chunk ID count")
        if not chunk_ids:
            return 0

        vectors = np.asarray(embeddings, dtype=np.float32)
        faiss_ids = self._allocate_ids(chunk_ids)
        self.index.add_with_ids(vectors, faiss_ids)
        self._validate_counts()
        save_index(self.index, self.index_path)
        self._save_mapping()
        self._validate_counts()
        return len(chunk_ids)
