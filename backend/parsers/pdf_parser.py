from pathlib import Path

from PyPDF2 import PdfReader

from .base import DocumentParser


class PDFParser(DocumentParser):
    def extract_text(self, file_path: Path) -> str:
        reader = PdfReader(str(file_path))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n".join(pages)
