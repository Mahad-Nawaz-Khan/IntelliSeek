import numpy as np
import pytest

from vector_store.faiss_store import EMBEDDING_DIMENSION, FaissVectorStore, load_index, save_index


def test_add_vectors_allocates_unique_ids_and_updates_counts(tmp_path) -> None:
    store = FaissVectorStore(tmp_path / "index.faiss", tmp_path / "id_map.json")
    embeddings = np.ones((2, EMBEDDING_DIMENSION), dtype=np.float32)

    added = store.add_vectors(embeddings, ["chunk-a", "chunk-b"])

    assert added == 2
    assert store.index_total == 2
    assert store.mapping["mappings"] == {"1": "chunk-a", "2": "chunk-b"}
    assert store.mapping["next_faiss_id"] == 3


def test_faiss_store_persists_and_reloads(tmp_path) -> None:
    index_path = tmp_path / "index.faiss"
    map_path = tmp_path / "id_map.json"
    store = FaissVectorStore(index_path, map_path)
    store.add_vectors(np.ones((1, EMBEDDING_DIMENSION), dtype=np.float32), ["chunk-a"])

    reloaded = FaissVectorStore(index_path, map_path)

    assert reloaded.index_total == 1
    assert reloaded.mapping["mappings"] == {"1": "chunk-a"}


def test_load_index_initializes_missing_index(tmp_path) -> None:
    index = load_index(tmp_path / "missing.faiss")

    assert index.ntotal == 0
    assert index.d == EMBEDDING_DIMENSION


def test_save_and_load_index_round_trip(tmp_path) -> None:
    store = FaissVectorStore(tmp_path / "index.faiss", tmp_path / "id_map.json")
    store.add_vectors(np.ones((1, EMBEDDING_DIMENSION), dtype=np.float32), ["chunk-a"])
    save_index(store.index, tmp_path / "copy.faiss")

    loaded = load_index(tmp_path / "copy.faiss")

    assert loaded.ntotal == 1


def test_faiss_store_detects_mapping_count_mismatch(tmp_path) -> None:
    map_path = tmp_path / "id_map.json"
    map_path.write_text('{"next_faiss_id": 2, "mappings": {"1": "chunk-a"}}', encoding="utf-8")

    with pytest.raises(ValueError):
        FaissVectorStore(tmp_path / "missing.faiss", map_path)
