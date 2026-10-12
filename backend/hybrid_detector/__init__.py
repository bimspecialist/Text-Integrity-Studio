"""Text Integrity Studio hybrid NLP inference; calibration and origin claims are gated."""
from .engine import HybridEngine
from .features import Extractor, FEATURE_NAMES, VERSION
from .text import detect_language, sentences, paragraphs

__all__ = ["HybridEngine", "Extractor", "FEATURE_NAMES", "VERSION", "detect_language", "sentences", "paragraphs"]
