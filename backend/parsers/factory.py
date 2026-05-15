from .base import DocumentParser
from .docx_parser import DocxParser
from .pdf_parser import PDFParser
from .pptx_parser import PptxParser
from .txt_parser import TxtParser

_PARSERS: dict[str, type[DocumentParser]] = {
    ".pdf": PDFParser,
    ".docx": DocxParser,
    ".pptx": PptxParser,
    ".txt": TxtParser,
}


class ParserFactory:
    @staticmethod
    def get_parser(filename: str) -> DocumentParser:
        dot = filename.rfind(".")
        ext = filename[dot:].lower() if dot != -1 else ""
        if ext not in _PARSERS:
            raise ValueError(f"Unsupported file type: {ext or 'none'}")
        return _PARSERS[ext]()
