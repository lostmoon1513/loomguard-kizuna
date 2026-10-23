"""File parsing. Pure Python, no web framework imports so it is easy to test."""
import io
import re
from dataclasses import dataclass


class ParseError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class Page:
    number: int  # 1-based
    text: str


def parse_pdf(data: bytes) -> list[Page]:
    """Extract text per page. Rejects scanned / image-only PDFs."""
    from pypdf import PdfReader
    from pypdf.errors import PyPdfError

    try:
        reader = PdfReader(io.BytesIO(data))
        pages = [Page(i + 1, (p.extract_text() or "").strip()) for i, p in enumerate(reader.pages)]
    except (PyPdfError, ValueError, OSError) as exc:
        raise ParseError("PDF_UNREADABLE", f"Could not read this PDF: {exc}") from exc
    if not pages:
        raise ParseError("PDF_EMPTY", "The PDF has no pages.")
    chars = sum(len(p.text) for p in pages)
    if chars < 40 * len(pages):
        raise ParseError(
            "SCANNED_PDF",
            "This PDF looks scanned or image-only. Upload a text-based PDF (you can select text in it).",
        )
    return pages


def parse_docx(data: bytes) -> str:
    from docx import Document

    try:
        doc = Document(io.BytesIO(data))
    except Exception as exc:  # noqa: BLE001
        raise ParseError("DOCX_UNREADABLE", f"Could not read this DOCX: {exc}") from exc
    text = "\n".join(p.text for p in doc.paragraphs).strip()
    if not text:
        raise ParseError("DOCX_EMPTY", "The DOCX has no text.")
    return text


def parse_draft_file(filename: str, data: bytes) -> str:
    name = filename.lower()
    if name.endswith((".md", ".txt")):
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise ParseError("ENCODING", "Text files must be UTF-8.") from exc
    elif name.endswith(".docx"):
        text = parse_docx(data)
    elif name.endswith(".pdf"):
        text = "\n\n".join(p.text for p in parse_pdf(data))
    else:
        raise ParseError("FILE_UNSUPPORTED", "Only .md, .txt, .docx and text PDFs are supported.")
    text = text.replace("\r\n", "\n").strip()
    if not text:
        raise ParseError("EMPTY_DRAFT", "The draft is empty.")
    return text


def normalise_space(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()
