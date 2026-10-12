"""Bilingual segmentation, tokenization, and offset-preserving input analysis.

All normalization is feature-only: the original text and offsets are never changed.
No origin claim is made from script, punctuation, or writing proficiency.
"""
from __future__ import annotations

import math
import re
import unicodedata
from dataclasses import dataclass

WORD = re.compile(
    r"[A-Za-z]+(?:['’\-][A-Za-z]+)*"
    r"|[\u0621-\u064A\u066E-\u06D3](?:[\u064B-\u065F\u0670]*[\u0621-\u064A\u066E-\u06D3])*[\u064B-\u065F\u0670]*"
    r"|[0-9\u0660-\u0669]+(?:[.,٫][0-9\u0660-\u0669]+)*",
    re.UNICODE,
)
SENTENCE_BOUNDARY = re.compile(r"[.!?؟]+(?=\s|$)|[؛;](?=\s|$)")
ARABIC_LETTERS = re.compile(r"[\u0621-\u064A\u066E-\u06D3]")
LATIN_LETTERS = re.compile(r"[a-zA-Z]")
DIACRITICS = re.compile(r"[\u064B-\u065F\u0670]")
TATWEEL = "\u0640"
ARABIC_FOLD = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي"})


@dataclass(frozen=True)
class Span:
    start: int
    end: int
    text: str
    words: int
    language: str


def tokenize(text: str) -> list[str]:
    return [m.group() for m in WORD.finditer(text)]


def feature_normalize(text: str) -> str:
    text = DIACRITICS.sub("", text.lower().translate(ARABIC_FOLD).replace(TATWEEL, ""))
    return unicodedata.normalize("NFKC", text)


def detect_language(text: str) -> str:
    arabic = len(ARABIC_LETTERS.findall(text))
    latin = len(LATIN_LETTERS.findall(text))
    if arabic + latin < 2:
        return "unknown"
    if arabic and latin and min(arabic, latin) / (arabic + latin) >= 0.18:
        return "mixed"
    return "ar" if arabic > latin else "en"


def sentences(text: str, min_words: int = 1) -> list[Span]:
    parts: list[Span] = []
    start = 0
    for match in SENTENCE_BOUNDARY.finditer(text):
        end = match.end()
        chunk = _span(text, start, end)
        if chunk is not None and chunk.words >= min_words:
            parts.append(chunk)
        start = end
    chunk = _span(text, start, len(text))
    if chunk is not None and chunk.words >= min_words:
        parts.append(chunk)
    return parts


def paragraphs(text: str) -> list[Span]:
    result: list[Span] = []
    start = 0
    position = 0
    for line in text.splitlines(keepends=True):
        end = position + len(line)
        if not line.strip():
            span = _span(text, start, position)
            if span is not None:
                result.append(span)
            start = end
        position = end
    tail = _span(text, start, len(text))
    if tail is not None:
        result.append(tail)
    return result


def _span(original: str, start: int, end: int) -> Span | None:
    raw = original[start:end]
    if not raw.strip():
        return None
    leading = len(raw) - len(raw.lstrip())
    stripped = raw.strip()
    real_start = start + leading
    real_end = real_start + len(stripped)
    return Span(real_start, real_end, stripped, len(tokenize(stripped)), detect_language(stripped))


def variation(values: list[float]) -> float | None:
    if len(values) < 3:
        return None
    mean = sum(values) / len(values)
    if mean <= 0:
        return None
    return math.sqrt(sum((x - mean) ** 2 for x in values) / len(values)) / mean
