"""Model provisioning, corpus provenance and upload security regression cases."""
from __future__ import annotations
import io
import json
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from hybrid_detector.adapters import LanguageRoutedClassifier
from hybrid_detector.api import APISettings, create_app
from hybrid_detector.baseline_data import assigned_split, compile_pairs, digest, pair_hc3, pair_aya, source_config
from hybrid_detector.engine import HybridEngine
from hybrid_detector.file_parsing import DocumentParseError, extract_upload
from hybrid_detector.provision_models import inspect_label_map


def sample_docx(text: str = "This is my own engineering study. " * 12) -> bytes:
    xml = (
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        '<w:body><w:p><w:r><w:t>' + text + '</w:t></w:r></w:p></w:body></w:document>'
    ).encode()
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", "<Types/>")
        archive.writestr("word/document.xml", xml)
    return out.getvalue()


def test_docx_text_is_extracted_without_html_xml_or_metadata():
    result = extract_upload("example.docx", sample_docx())
    assert result.extension == "docx"
    assert "engineering study" in result.text
    assert "<w:" not in result.text


def test_docx_malformed_rejected_and_macros_rejected():
    with pytest.raises(DocumentParseError) as exc:
        extract_upload("wrong.docx", b"Fake document")
    assert exc.value.code == "INVALID_DOCX"

    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        z.writestr("word/document.xml", b"<w:document/>")
        z.writestr("word/vbaProject.bin", b"malicious")
    with pytest.raises(DocumentParseError) as exc:
        extract_upload("unsafe.docx", out.getvalue())
    assert exc.value.code == "INVALID_DOCX"


def test_no_files_are_persisted_and_text_checks_are_strict():
    result = extract_upload("note.txt", "محتوى عربي للقراءة والاختبار".encode("utf-8"))
    assert result.extension == "txt"
    with pytest.raises(DocumentParseError) as exc:
        extract_upload("note.txt", b"\x00hidden")
    assert exc.value.code == "INVALID_TXT"
    with pytest.raises(DocumentParseError) as exc:
        extract_upload("note.pdf", b"this-is-not-pdf")
    assert exc.value.code == "INVALID_PDF"
    with pytest.raises(DocumentParseError):
        extract_upload("../path.txt", b"some text")


def test_blank_pdf_returns_ocr_required():
    from pypdf import PdfWriter

    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    data = io.BytesIO()
    writer.write(data)
    with pytest.raises(DocumentParseError) as exc:
        extract_upload("scan.pdf", data.getvalue())
    assert exc.value.code == "OCR_REQUIRED"


def test_private_fastapi_file_endpoint():
    app = create_app(APISettings(api_keys=("x" * 40,), requests_per_minute=30),
                     engine=HybridEngine())
    client = TestClient(app)
    docx = sample_docx()
    noauth = client.post("/v1/analyze-file", files={
        "file": ("paper.docx", docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    })
    assert noauth.status_code == 401
    response = client.post(
        "/v1/analyze-file", headers={"X-API-Key": "x" * 40},
        files={"file": ("paper.docx", docx, "application/octet-stream")},
        data={"language": "auto", "segment_by": "paragraph"},
    )
    assert response.status_code == 200, response.text
    answer = response.json()
    assert answer["analysis_status"] == "INCONCLUSIVE"
    assert answer["document"]["ai_probability_percent"] is None
    assert answer["input_file"]["format"] == "docx"
    assert "text" not in answer["input_file"]
    assert response.headers["cache-control"] == "no-store"


def test_upload_unsupported_and_ocr_error():
    from pypdf import PdfWriter

    app = create_app(APISettings(api_keys=("y" * 40,), requests_per_minute=30), engine=HybridEngine())
    client = TestClient(app)
    headers = {"X-API-Key": "y" * 40}
    bad = client.post("/v1/analyze-file", headers=headers,
                      files={"file": ("danger.exe", b"no", "application/octet-stream")})
    assert bad.status_code == 422
    assert bad.json()["detail"]["code"] == "UNSUPPORTED_FILE"

    pdf = PdfWriter()
    pdf.add_blank_page(width=612, height=792)
    buf = io.BytesIO()
    pdf.write(buf)
    response = client.post("/v1/analyze-file", headers=headers,
                           files={"file": ("blank.pdf", buf.getvalue(), "application/pdf")})
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "OCR_REQUIRED"


def test_public_datasets_are_weak_labels_not_ground_truth():
    en = source_config("hc3_en")
    question = "How should I describe the results of this hypothetical engineering simulation?"
    phrase = "We recorded each measurement and explained the engineering interpretation carefully. " * 15
    row = {"question": question, "human_answers": [phrase],
           "chatgpt_answers": [phrase.replace("recorded", "reviewed")]}
    pairs = list(pair_hc3(row, "open_qa.jsonl"))
    assert len(pairs) == 1
    entries, report = compile_pairs(pairs, source=en, limit=3)
    assert len(entries) == 2
    assert report["independently_verified"] is False
    assert all(entry["independent_verified"] is False for entry in entries)
    assert entries[0]["split"] == entries[1]["split"]
    assert assigned_split(pairs[0][0]) == entries[0]["split"]
    assert assigned_split(pairs[0][0]) == assigned_split(pairs[0][0])

    ar = source_config("aya_ar")
    arabic = "لقد قمنا بتنفيذ مراجعة هندسية واختبرنا الفرضيات وشرحنا النتائج بصورة واضحة. " * 15
    arabic_pair = list(pair_aya({"id": 1, "prompt": "سؤال هندسي", "chosen": [
        {"role": "user", "content": arabic}
    ], "rejected": [
        {"role": "assistant", "content": arabic.replace("مراجعة", "دراسة")}
    ]}, "train.parquet"))
    assert len(arabic_pair) == 1
    ar_entries, _ = compile_pairs(arabic_pair, source=ar, limit=3)
    assert len(ar_entries) == 2
    assert ar_entries[0]["label_provenance"] == "UNVERIFIED_PUBLIC_DATASET_CLAIM"


def test_model_label_mappings_explicit():
    assert inspect_label_map({"id2label": {"0": "Human", "1": "AI"}}, "en")["ai_class_index"] == 1
    assert inspect_label_map({"id2label": {"0": "LABEL_0", "1": "LABEL_1"}}, "ar")["ai_class_index"] == 1
    with pytest.raises(ValueError):
        inspect_label_map({"id2label": {"0": "AI", "1": "Human"}}, "en")


def test_transformer_fallback_is_locale_routed_and_mixed_script_abstains():
    class Stub:
        def __init__(self, value):
            self.value = value
        def logit(self, text):
            return self.value

    router = LanguageRoutedClassifier(english=Stub(2.5), arabic=Stub(-0.5))
    assert router.logit("These are long descriptions of documented engineering processes") == 2.5
    assert router.logit("هذه جملة عربية للتجربة الهندسية الموثقة") == -0.5
    assert router.logit("English text ونص عربي مدمج") is None
