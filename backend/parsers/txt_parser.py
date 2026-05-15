from pathlib import Path

from .base import DocumentParser


class TxtParser(DocumentParser):
    def extract_text(self, file_path: Path) -> str:
        return file_path.read_text(encoding="utf-8")
