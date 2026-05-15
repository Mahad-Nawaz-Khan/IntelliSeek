from abc import ABC, abstractmethod
from pathlib import Path


class DocumentParser(ABC):
    @abstractmethod
    def extract_text(self, file_path: Path) -> str:
        ...
