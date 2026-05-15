import os
import tempfile
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from database.supabase import SupabaseConfigurationError, get_supabase_client
from embeddings.generator import embed_texts
from parsers.config import (
    ALLOWED_EXTENSIONS,
    ALLOWED_MIME_TYPES,
    BUCKET_NAME,
    EXTENSION_TO_MIME,
    MAX_FILE_SIZE,
)
from parsers.factory import ParserFactory
from rag.chunker import chunk_text
from rag.llm import generate_answer
from rag.retriever import retrieve_context, to_source_citations, validate_question
from vector_store.faiss_store import FaissVectorStore

load_dotenv()

app = FastAPI(title="IntelliSeek Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class ParseRequest(BaseModel):
    storage_path: str
    filename: str
    file_type: str
    file_size: int
    user_id: str


class ChatRequest(BaseModel):
    question: str
    user_id: str


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

def _validation_failure(status_code: int, error: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "ok": False,
            "status": "Document parsing failed",
            "error": error,
        },
    )


def _validate_parse_request(req: ParseRequest) -> tuple[int, str] | None:
    if not req.storage_path or not req.storage_path.strip():
        return 400, "Missing storage path"
    if not req.filename or not req.filename.strip():
        return 400, "Missing filename"
    if not req.user_id or not req.user_id.strip():
        return 401, "Missing user identity"

    normalized = req.storage_path.replace("\\", "/")
    if normalized.startswith("/") or ".." in normalized.split("/"):
        return 400, "Malformed storage path"

    dot = req.filename.rfind(".")
    ext = req.filename[dot:].lower() if dot != -1 else ""
    if ext not in ALLOWED_EXTENSIONS:
        return 400, f"Unsupported file type: {ext or 'none'}"

    expected_mime = EXTENSION_TO_MIME[ext]
    if req.file_type not in ALLOWED_MIME_TYPES:
        return 400, f"Unsupported MIME type: {req.file_type}"
    if req.file_type != expected_mime:
        return 400, "File extension and MIME type do not match"

    if req.file_size <= 0 or req.file_size > MAX_FILE_SIZE:
        return 400, f"Invalid file size: {req.file_size}"

    if not normalized.startswith(f"{req.user_id}/"):
        return 403, "Storage path does not belong to the requesting user"

    if Path(normalized).name != req.filename:
        return 400, "Filename does not match storage path"

    return None


# ---------------------------------------------------------------------------
# Existing health / db-test endpoints
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "IntelliSeek Backend is healthy"}


@app.get("/api/db-test", response_model=None)
def database_test():
    try:
        supabase = get_supabase_client()
        inserted = (
            supabase.table("chat_history")
            .insert(
                {
                    "question": "IntelliSeek Supabase diagnostic question",
                    "answer": "IntelliSeek Supabase diagnostic answer",
                    "sources_cited": [],
                }
            )
            .execute()
        )
        record = inserted.data[0]
        record_id = record["id"]
        selected = (
            supabase.table("chat_history")
            .select("id")
            .eq("id", record_id)
            .single()
            .execute()
        )

        if not selected.data:
            raise RuntimeError("Diagnostic record was not readable")

        return {
            "ok": True,
            "status": "Supabase database connection verified",
            "record_id": record_id,
            "source": "backend",
        }
    except SupabaseConfigurationError as error:
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "status": "Supabase database connection failed",
                "source": "backend",
                "error": str(error),
            },
        )
    except Exception:
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "status": "Supabase database connection failed",
                "source": "backend",
                "error": "Database diagnostic operation failed",
            },
        )


# ---------------------------------------------------------------------------
# Chat endpoint
# ---------------------------------------------------------------------------

def _chat_failure(status_code: int, error: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "ok": False,
            "status": "Chat request failed",
            "error": error,
        },
    )


@app.post("/api/chat", response_model=None)
def chat_with_rag(req: ChatRequest):
    try:
        question = validate_question(req.question)
    except ValueError as error:
        return _chat_failure(400, str(error))

    try:
        context_chunks = retrieve_context(question)
    except Exception:
        return _chat_failure(500, "Retrieval failed")

    if not context_chunks:
        return _chat_failure(400, "No sufficient context found for this question")

    try:
        answer = generate_answer(question, context_chunks)
    except ValueError as error:
        return _chat_failure(400, str(error))
    except Exception:
        return _chat_failure(500, "Answer generation failed")

    sources = to_source_citations(context_chunks)
    try:
        inserted = (
            get_supabase_client()
            .table("chat_history")
            .insert(
                {
                    "user_id": req.user_id,
                    "question": question,
                    "answer": answer,
                    "sources_cited": sources,
                }
            )
            .execute()
        )
        if not inserted.data:
            raise RuntimeError("Chat history insert returned no rows")
    except Exception:
        return _chat_failure(500, "Chat history persistence failed")

    return {
        "ok": True,
        "answer": answer,
        "sources": sources,
    }


# ---------------------------------------------------------------------------
# Parse endpoint (US2 + US3)
# ---------------------------------------------------------------------------

@app.post("/api/parse", response_model=None)
def parse_document(req: ParseRequest):
    validation_error = _validate_parse_request(req)
    if validation_error:
        status_code, error = validation_error
        return _validation_failure(status_code, error)

    tmp_path: str | None = None

    try:
        supabase = get_supabase_client()
        # Download from Supabase Storage to a temporary file
        response = supabase.storage.from_(BUCKET_NAME).download(
            req.storage_path.replace("\\", "/")
        )
        if not response:
            return JSONResponse(
                status_code=404,
                content={
                    "ok": False,
                    "status": "Document parsing failed",
                    "error": "Stored file not found",
                },
            )

        dot = req.filename.rfind(".")
        ext = req.filename[dot:] if dot != -1 else ".tmp"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(response)
            tmp_path = tmp.name

        # Parse using factory
        parser = ParserFactory.get_parser(req.filename)
        extracted = parser.extract_text(Path(tmp_path))

        if not extracted or not extracted.strip():
            return JSONResponse(
                status_code=400,
                content={
                    "ok": False,
                    "status": "Document parsing failed",
                    "error": "Extracted text is empty",
                },
            )

        # Persist metadata
        dot2 = req.filename.rfind(".")
        file_ext = req.filename[dot2:].lower().lstrip(".")
        mime = EXTENSION_TO_MIME[f".{file_ext}"]

        inserted = (
            supabase.table("documents")
            .insert(
                {
                    "user_id": req.user_id,
                    "filename": req.filename,
                    "file_type": mime,
                    "file_size": req.file_size,
                    "storage_path": req.storage_path,
                }
            )
            .execute()
        )

        doc = inserted.data[0]
        preview = extracted[:100]
        chunks = chunk_text(extracted)
        if not chunks:
            return JSONResponse(
                status_code=400,
                content={
                    "ok": False,
                    "status": "Document parsing failed",
                    "error": "Extracted text has no indexable content",
                },
            )

        chunk_records = [
            {
                "document_id": doc["id"],
                "text_content": chunk,
                "chunk_index": index,
            }
            for index, chunk in enumerate(chunks)
        ]
        inserted_chunks = supabase.table("chunks").insert(chunk_records).execute()
        stored_chunks = inserted_chunks.data or []
        if len(stored_chunks) != len(chunk_records):
            raise RuntimeError("Inserted chunk count does not match generated chunk count")

        chunk_ids = [str(chunk["id"]) for chunk in stored_chunks]
        embeddings = embed_texts([chunk["text_content"] for chunk in stored_chunks])
        vector_store = FaissVectorStore()
        vectors_indexed = vector_store.add_vectors(embeddings, chunk_ids)

        return {
            "ok": True,
            "status": "Document parsed and indexed successfully",
            "document_id": doc["id"],
            "filename": req.filename,
            "text_preview": preview,
            "chunks_created": len(stored_chunks),
            "vectors_indexed": vectors_indexed,
            "index_total": vector_store.index_total,
        }

    except SupabaseConfigurationError as error:
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "status": "Document parsing failed",
                "error": str(error),
            },
        )
    except ValueError as error:
        return JSONResponse(
            status_code=400,
            content={
                "ok": False,
                "status": "Document parsing failed",
                "error": str(error),
            },
        )
    except Exception as error:
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "status": "Document parsing failed",
                "error": f"Parsing, storage, embedding, or indexing operation failed: {type(error).__name__}",
            },
        )
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
