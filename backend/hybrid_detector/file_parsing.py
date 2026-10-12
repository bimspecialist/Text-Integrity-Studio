"""Bounded, no-disk-persistence PDF/DOCX/TXT extraction for private detector API.

OCR is deliberately NOT attempted by the inference server. Image-only PDFs are
reported with OCR_REQUIRED and can use the existing browser-local OCR workflow.
"""
from __future__ import annotations
import io
import os
import zipfile
from dataclasses import dataclass
from pathlib import PurePath

MAX_UPLOAD_BYTES = 6 * 1024 * 1024
MAX_EXTRACTED_CHARS = 120_000
MAX_PDF_PAGES = 60
MAX_DOCX_ENTRIES = 450
MAX_DOCX_TOTAL_EXPANDED = 24 * 1024 * 1024
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


class DocumentParseError(ValueError):
    def __init__(self, code: str, detail: str):
        self.code = code
        super().__init__(detail)


@dataclass(frozen=True)
class Extraction:
    text: str
    extension: str
    page_count: int | None
    warnings: list[str]


def _bounded_text(text: str) -> str:
    text = text.strip()
    if not text:
        raise DocumentParseError("NO_TEXT", "Document has no extractable text.")
    if len(text) > MAX_EXTRACTED_CHARS:
        raise DocumentParseError("TEXT_TOO_LONG", "Extracted text exceeds 120,000 characters.")
    return text


def _text_file(data: bytes) -> Extraction:
    if b"\x00" in data:
        raise DocumentParseError("INVALID_TXT", "NUL bytes are not accepted in UTF-8 TXT.")
    try:
        text = data.decode("utf-8-sig")
    except UnicodeError:
        raise DocumentParseError("INVALID_TXT", "TXT input must use UTF-8 encoding.") from None
    return Extraction(_bounded_text(text), "txt", None, [])


def _docx(data: bytes) -> Extraction:
    from defusedxml import ElementTree

    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zipped:
            entries = zipped.infolist()
            if len(entries) > MAX_DOCX_ENTRIES:
                raise DocumentParseError("DOCX_LIMIT", "Too many Word package entries.")
            expanded = 0
            names = {entry.filename for entry in entries}
            if "[Content_Types].xml" not in names or "word/document.xml" not in names:
                raise DocumentParseError("INVALID_DOCX", "Missing Word document package structure.")
            if any(item.lower().endswith(("vbaproject.bin", ".exe", ".dll")) for item in names):
                raise DocumentParseError("INVALID_DOCX", "Embedded macros/executables are not supported.")
            for entry in entries:
                expanded += entry.file_size
                if expanded > MAX_DOCX_TOTAL_EXPANDED:
                    raise DocumentParseError("DOCX_LIMIT", "Word archive expansion exceeds safe limit.")
                if entry.file_size > 0 and entry.compress_size > 0 and entry.file_size / entry.compress_size > 400:
                    raise DocumentParseError("DOCX_LIMIT", "Suspicious Word archive compression ratio.")
            xml = zipped.read("word/document.xml")
            if len(xml) > 8 * 1024 * 1024:
                raise DocumentParseError("DOCX_LIMIT", "Document XML exceeds safe limit.")
            if b"<!ENTITY" in xml.upper() or b"<!DOCTYPE" in xml.upper():
                raise DocumentParseError("INVALID_DOCX", "XML entity declarations are forbidden.")
            root = ElementTree.fromstring(xml)
            # Text in deleted Word revision runs is in w:delText, never w:t.
            paragraphs = []
            for p in root.iter(W + "p"):
                line = "".join((n.text or "") for n in p.iter(W + "t"))
                if line.strip():
                    paragraphs.append(line)
    except DocumentParseError:
        raise
    except (zipfile.BadZipFile, KeyError, ElementTree.ParseError, OSError, RuntimeError):
        raise DocumentParseError("INVALID_DOCX", "Unable to read a safe Word DOCX document.") from None
    return Extraction(_bounded_text("\n\n".join(paragraphs)), "docx", None,
                      ["Word layout, images, annotations and some fields are not represented by plain text."])


def _pdf(data: bytes) -> Extraction:
    from pypdf import PdfReader

    if not data.startswith(b"%PDF-"):
        raise DocumentParseError("INVALID_PDF", "PDF signature is invalid.")
    try:
        reader = PdfReader(io.BytesIO(data), strict=True)
        if reader.is_encrypted:
            raise DocumentParseError("ENCRYPTED_PDF", "Encrypted PDF files are not supported.")
        count = len(reader.pages)
        if count == 0 or count > MAX_PDF_PAGES:
            raise DocumentParseError("PDF_LIMIT", "PDF must contain 1 to 60 pages.")
        passages = []
        for i in range(count):
            raw = reader.pages[i].extract_text() or ""
            passages.append(raw.strip())
            if sum(map(len, passages)) > MAX_EXTRACTED_CHARS:
                raise DocumentParseError("TEXT_TOO_LONG", "Extracted text exceeds 120,000 characters.")
        result = "\n\n".join(p for p in passages if p)
        if not result.strip():
            raise DocumentParseError("OCR_REQUIRED", "This PDF has no text layer; use the local browser OCR tool.")
        return Extraction(_bounded_text(result), "pdf", count,
                          ["PDF columns, tables, formulas and RTL reading order require manual verification."])
    except DocumentParseError:
        raise
    except Exception:
        # No parser exception contains original source bytes or paths.
        raise DocumentParseError("INVALID_PDF", "PDF could not be safely extracted.") from None


def extract_upload(filename: str, data: bytes) -> Extraction:
    if not isinstance(data, bytes) or len(data) < 1:
        raise DocumentParseError("EMPTY_FILE", "Empty file.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise DocumentParseError("FILE_TOO_LARGE", "Files must not exceed 6 MiB.")
    if not filename or len(filename) > 160 or "/" in filename or "\\" in filename or "\x00" in filename:
        raise DocumentParseError("INVALID_FILENAME", "File name is invalid.")
    extension = PurePath(filename).suffix.lower()
    if extension == ".txt":
        return _text_file(data)
    if extension == ".docx":
        if not data.startswith(b"PK\x03\x04"):
            raise DocumentParseError("INVALID_DOCX", "Word file signature does not match DOCX.")
        return _docx(data)
    if extension == ".pdf":
        return _pdf(data)
    raise DocumentParseError("UNSUPPORTED_FILE", "Only .pdf, .docx and .txt are supported.")
