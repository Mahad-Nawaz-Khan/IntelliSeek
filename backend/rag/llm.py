import os
from typing import Any

from rag.retriever import RetrievedContextChunk

GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
SYSTEM_PROMPT = """You are IntelliSeek, an academic retrieval assistant.
Answer only using the provided context chunks.
Every factual claim must be supported by a citation in the format [Source: filename].
If the context does not contain enough information to answer, say that the uploaded material does not contain enough information.
Do not use outside knowledge, do not invent citations, and do not mention sources that are not present in the context."""


def build_messages(query: str, context_chunks: list[RetrievedContextChunk]) -> list[dict[str, str]]:
    context = "\n\n".join(
        f"Source: {chunk['filename']}\nChunk ID: {chunk['chunk_id']}\nExcerpt: {chunk['text_content']}"
        for chunk in context_chunks
    )
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"Context chunks:\n{context}\n\nQuestion: {query.strip()}",
        },
    ]


def get_groq_client() -> Any:
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not configured")

    from groq import Groq

    return Groq(api_key=api_key)


def generate_answer(query: str, context_chunks: list[RetrievedContextChunk]) -> str:
    if not context_chunks:
        raise ValueError("No sufficient context found for this question")

    client = get_groq_client()
    completion = client.chat.completions.create(
        messages=build_messages(query, context_chunks),
        model=GROQ_MODEL,
        temperature=0.2,
        max_tokens=1024,
    )
    answer = completion.choices[0].message.content
    if not answer or not answer.strip():
        raise RuntimeError("Answer generation failed")
    return answer.strip()
