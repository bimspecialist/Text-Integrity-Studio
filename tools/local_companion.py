#!/usr/bin/env python3
"""Text Integrity Studio — optional fully local document companion.

Commands:
  python tools/local_companion.py pdf input.pdf --ocr auto --languages eng+ara
  python tools/local_companion.py proofread document.txt --model qwen2.5:7b
  python tools/local_companion.py serve --port 8765
No paid keys; optional local Ollama at http://127.0.0.1:11434.
Never sends text to any external AI provider.
"""
from __future__ import annotations

import argparse
import difflib
import hmac
import json
import os
import re
from collections import Counter
from pathlib import Path
import secrets
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import URLError
from urllib.request import Request, build_opener, ProxyHandler

MAX_SOURCE = 40000
MAX_FILE = 45 * 1024 * 1024
MAX_REQUEST = 75000
OLLAMA = "http://127.0.0.1:11434/api/generate"


class CompanionError(RuntimeError):
    pass


def read_source(path: Path) -> str:
    if path.stat().st_size > MAX_FILE:
        raise CompanionError("Document exceeds the local file safety limit (45 MB).")
    if path.suffix.lower() in (".txt", ".md"):
        return path.read_text(encoding="utf-8-sig")
    if path.suffix.lower() == ".pdf":
        result = extract_pdf(path, ocr="never")
        return result["text"]
    if path.suffix.lower() == ".docx":
        from zipfile import ZipFile, BadZipFile
        try:
            with ZipFile(path) as f:
                if f.infolist() and sum(x.file_size for x in f.infolist()) > 120 * 1024 * 1024:
                    raise CompanionError("DOCX archive expansion too large.")
                from xml.etree import ElementTree
                xml = f.read("word/document.xml")
                if b"<!DOCTYPE" in xml or b"<!ENTITY" in xml:
                    raise CompanionError("Unsupported XML entity declarations.")
                root = ElementTree.fromstring(xml)
                ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
                paragraphs = []
                for p in root.findall(".//w:p", ns):
                    texts = [n.text or "" for n in p.findall(".//w:t", ns)]
                    if texts: paragraphs.append("".join(texts))
                return "\n".join(paragraphs)
        except (BadZipFile, KeyError) as exc:
            raise CompanionError("Invalid DOCX.") from exc
    raise CompanionError("Only TXT, MD, PDF and DOCX are supported.")


def extract_pdf(path: Path, ocr: str = "auto", languages: str = "eng+ara",
                max_pages: int = 100, dpi_scale: float = 2.0) -> dict:
    if path.stat().st_size > MAX_FILE:
        raise CompanionError("PDF exceeds maximum local file size (45 MB).")
    if path.read_bytes()[:5] != b"%PDF-":
        raise CompanionError("File is not a PDF.")
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise CompanionError("Install local PDF dependencies: pip install -r tools/requirements-local.txt") from exc
    reader = PdfReader(str(path), strict=False)
    if reader.is_encrypted:
        raise CompanionError("Password-protected PDF is not supported.")
    total = len(reader.pages)
    if total > max_pages:
        raise CompanionError(f"Document has {total} pages; limit is {max_pages}.")
    if ocr not in ("never", "auto", "always"):
        raise CompanionError("OCR mode must be never/auto/always.")
    renderer = None
    if ocr != "never":
        try:
            import pypdfium2 as pdfium
            import pytesseract
            renderer = pdfium.PdfDocument(str(path))
        except ImportError as exc:
            raise CompanionError("OCR requires pypdfium2, pytesseract and local Tesseract installation.") from exc
    pages, ocr_used = [], 0
    for index, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        if renderer is not None and (ocr == "always" or len(text.strip()) < 30):
            try:
                import pytesseract
                bitmap = renderer[index].render(scale=dpi_scale)
                image = bitmap.to_pil()
                scanned = pytesseract.image_to_string(image, lang=languages)
                image.close()
                if scanned.strip():
                    text = scanned
                ocr_used += 1
            except Exception as exc:
                raise CompanionError(f"OCR failed at page {index + 1}: {exc}") from exc
        pages.append({"page": index + 1, "text": text, "used_ocr": renderer is not None and (ocr=="always" or len((page.extract_text() or "").strip())<30)})
    if renderer is not None:
        renderer.close()
    content = "\n\n".join(f"[Page {p['page']}]\n{p['text']}" for p in pages)
    return {"text":content, "pages":total, "ocr_pages":ocr_used, "language":languages,
            "warning":"OCR and PDF reading order may be inaccurate; manually check quotes, mathematics and Arabic."}


def prompt_for_proofread(text: str, language: str) -> str:
    return (
        "You are a careful editorial proofreader working entirely on the user's device. "
        "Return ONLY a proposed revised text, with no intro or meta commentary. "
        "Preserve all factual claims, amounts, engineering units, dates, names, citations, headings, "
        "numbers, quoted words, argument structure and intended meaning. "
        "Do not fabricate sources or add stylistic errors. Do not attempt AI-detector evasion. "
        "Use natural, readable writing and fix grammar, typos, unclear phrasing where safe. "
        "Keep the original language/dialect when it is intentional. "
        "If unclear, preserve original phrasing rather than invent facts. "
        f"Document language preference: {language}.\n\n"
        "<BEGIN_USER_DOCUMENT>\n" + text + "\n<END_USER_DOCUMENT>"
    )


def local_proofread(text: str, model: str = "qwen2.5:7b", language: str = "auto",
                    model_endpoint: str = OLLAMA) -> str:
    if len(text)>MAX_SOURCE:
        raise CompanionError(f"Request exceeds {MAX_SOURCE} characters. Split by sections.")
    if not text.strip():
        raise CompanionError("Nothing to proofread.")
    if model_endpoint != OLLAMA:
        raise CompanionError("Non-loopback Ollama endpoint is forbidden.")
    if len(model)>90 or any(c not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:._-/" for c in model):
        raise CompanionError("Invalid local model name.")
    payload = json.dumps({"model": model, "stream": False,
                          "prompt": prompt_for_proofread(text,language),
                          "options": {"temperature": 0.15, "num_predict": 10000}},
                         ensure_ascii=False).encode("utf8")
    request = Request(OLLAMA, data=payload, headers={"Content-Type":"application/json"},method="POST")
    try:
        # Explicitly disable proxies to ensure data only goes to local loopback.
        opener=build_opener(ProxyHandler({}))
        with opener.open(request,timeout=150) as response:
            message=json.loads(response.read(3*1024*1024).decode("utf8"))
    except (URLError, OSError, TimeoutError) as exc:
        raise CompanionError("Local Ollama unavailable. Install Ollama and download a local model first.") from exc
    proposed = str(message.get("response","")).strip()
    if not proposed:
        raise CompanionError("Local model returned an empty suggestion.")
    return proposed


PROTECTED_FACTS = re.compile(
    r"\b(?:ISO|SBC|ASTM|ASCE|IEC)\s*[- ]?\d{2,6}(?:[-:]\d+)?\b"
    r"|\b\d+(?:[.,]\d+)*(?:\s*(?:%|mm|cm|m²|m³|km|kPa|MPa|Pa|kW|kWh|Hz|°C|SAR|BHD))?\b"
    r"|\[[0-9,\s;-]+\]"
    r"|\b(?:https?://|doi:)\S+",
    flags=re.IGNORECASE,
)


def check_factual_tokens(original: str, proposed: str) -> dict:
    """Deterministic editorial guardrail; not a proof of meaning preservation."""
    before = Counter(x.group(0).strip() for x in PROTECTED_FACTS.finditer(original))
    after = Counter(x.group(0).strip() for x in PROTECTED_FACTS.finditer(proposed))
    lost = list((before - after).elements())
    added = list((after - before).elements())
    return {
        "risk": "HIGH" if lost or added else "NO_TOKEN_DIFFERENCE_DETECTED",
        "missing_original_numbers_or_references": lost[:30],
        "unexpected_numbers_or_references": added[:30],
        "caveat": "Additional human review is still required for names, quotations, citations and meaning."
    }


def save_review(input_path: Path, original: str, proposed: str, output_path: Path) -> dict:
    if output_path.resolve()==input_path.resolve():
        raise CompanionError("Never overwrite the source.")
    output_path.write_text(proposed,encoding="utf-8")
    diff="".join(difflib.unified_diff(original.splitlines(keepends=True),proposed.splitlines(keepends=True),
                                    fromfile=input_path.name,tofile=output_path.name))
    output_path.with_suffix(output_path.suffix+".diff").write_text(diff,encoding="utf-8")
    guard = check_factual_tokens(original, proposed)
    return {"status":"HIGH_RISK_REVIEW_REQUIRED" if guard["risk"]=="HIGH" else "DRAFT_REQUIRES_REVIEW",
            "output":str(output_path),"diff":str(output_path)+".diff",
            "factual_token_guard":guard,
            "meaning_preservation":"NOT AUTOMATICALLY VERIFIED",
            "warning":"Confirm citations, numbers, technical terms and meaningful author voice before using a proposal."}


def make_handler(token: str, model: str):
    # Local proofreading can be CPU/GPU expensive; prevent request floods from parallel clients.
    inference_slot=threading.BoundedSemaphore(1)
    class Handler(BaseHTTPRequestHandler):
        server_version="TIS-local/1"
        def log_message(self, fmt, *args):
            # Deliberately never log user paths or request bodies.
            return
        def response(self,code:int, data:dict):
            body=json.dumps(data,ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type","application/json; charset=utf-8")
            self.send_header("Cache-Control","no-store")
            self.send_header("X-Content-Type-Options","nosniff")
            self.send_header("Content-Length",str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        def do_GET(self):
            if self.path=="/health":
                return self.response(200,{"service":"Text Integrity local companion","status":"ready",
                    "bound_to":"127.0.0.1","classifier":"NOT VALIDATED","model":model})
            return self.response(404,{"error":"Not found"})
        def do_POST(self):
            raw_length=self.headers.get("Content-Length","0")
            try:
                length=int(raw_length)
            except (TypeError, ValueError):
                return self.response(400,{"error":"Invalid Content-Length"})
            provided=self.headers.get("Authorization","")
            if not hmac.compare_digest(provided, "Bearer "+token):
                return self.response(401,{"error":"Bearer token required"})
            origin=self.headers.get("Origin")
            if origin: # Forbid browser CORS use until origin/private-network approval.
                return self.response(403,{"error":"Browser origins are not authorized"})
            if length<=0 or length>MAX_REQUEST:
                return self.response(413,{"error":"Request body size out of range"})
            try:
                obj=json.loads(self.rfile.read(length).decode("utf8"))
            except (ValueError,UnicodeDecodeError):
                return self.response(400,{"error":"Invalid JSON"})
            if self.path=="/v1/detector":
                return self.response(503,{"status":"INCONCLUSIVE",
                    "reason":"No independently validated, calibrated AI classifier has been approved."})
            if self.path!="/v1/proofread":
                return self.response(404,{"error":"Unknown endpoint"})
            if not isinstance(obj,dict) or not isinstance(obj.get("text"),str):
                return self.response(422,{"error":"text string required"})
            if not inference_slot.acquire(blocking=False):
                return self.response(503,{"status":"BUSY","error":"Only one local proofreading request at a time."})
            try:
                improved=local_proofread(obj["text"],model,language=str(obj.get("language","auto")))
                return self.response(200,{"status":"DRAFT_REQUIRES_REVIEW",
                    "proposed_text":improved,"disclaimer":"Meaning, citations and reference accuracy must be human-reviewed."})
            except CompanionError as exc:
                return self.response(503,{"error":str(exc)})
            finally:
                inference_slot.release()
    return Handler


def serve(port: int, model: str):
    if port<1024 or port>65535:
        raise CompanionError("Choose a local port between 1024 and 65535.")
    token=os.environ.get("TIS_LOCAL_TOKEN") or secrets.token_urlsafe(32)
    server=ThreadingHTTPServer(("127.0.0.1",port),make_handler(token,model))
    print(f"Text Integrity Studio local API on http://127.0.0.1:{port}")
    print("Authorization: Bearer "+token)
    print("No document logs. Endpoint only bound to loopback. Stop with Ctrl+C.")
    try:server.serve_forever()
    finally:server.server_close()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    sub=parser.add_subparsers(dest="command",required=True)
    pdf=sub.add_parser("pdf",help="Extract local PDF text and optionally OCR scanned pages")
    pdf.add_argument("source",type=Path)
    pdf.add_argument("--ocr",choices=["never","auto","always"],default="auto")
    pdf.add_argument("--languages",default="eng+ara")
    pdf.add_argument("--out",type=Path)
    pdf.add_argument("--max-pages",type=int,default=100)
    proof=sub.add_parser("proofread",help="Review writing with local Ollama only")
    proof.add_argument("source",type=Path)
    proof.add_argument("--model",default="qwen2.5:7b")
    proof.add_argument("--language",default="auto")
    proof.add_argument("--out",type=Path)
    api=sub.add_parser("serve",help="Start restricted loopback-only API")
    api.add_argument("--port",type=int,default=8765)
    api.add_argument("--model",default="qwen2.5:7b")
    args=parser.parse_args()
    try:
        if args.command=="pdf":
            result=extract_pdf(args.source,args.ocr,args.languages,args.max_pages)
            output=args.out or args.source.with_suffix(".extracted.txt")
            if output.resolve()==args.source.resolve():raise CompanionError("Cannot overwrite source.")
            output.write_text(result["text"],encoding="utf-8")
            print(json.dumps({k:v for k,v in result.items() if k!="text"}|{"output":str(output)},ensure_ascii=False,indent=2))
        elif args.command=="proofread":
            original=read_source(args.source)
            improved=local_proofread(original,args.model,args.language)
            output=args.out or args.source.with_suffix(".review.txt")
            print(json.dumps(save_review(args.source,original,improved,output),ensure_ascii=False,indent=2))
        elif args.command=="serve":
            serve(args.port,args.model)
    except CompanionError as exc:
        print("ERROR: "+str(exc),file=sys.stderr);sys.exit(2)


if __name__=="__main__":
    main()
