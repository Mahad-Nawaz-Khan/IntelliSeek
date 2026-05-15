from pathlib import Path

from docx import Document

from .base import DocumentParser


class DocxParser(DocumentParser):
    def extract_text(self, file_path: Path) -> str:
        doc = Document(str(file_path))
        return "\n".join(p.text for p in doc.paragraphs)
