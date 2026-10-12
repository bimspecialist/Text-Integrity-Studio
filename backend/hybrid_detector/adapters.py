"""Optional signal adapters, all explicit and safely disabled by default.

Install backend/requirements-ml.txt before enabling local Hugging Face checkpoints.
Never trust arbitrary user-supplied model paths or enable trust_remote_code.
Raw specialist logits are *features*; they are NOT calibrated authorship estimates.
"""
from __future__ import annotations

import ipaddress
import json
import math
import threading
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, build_opener, HTTPHandler, HTTPSHandler, ProxyHandler, HTTPRedirectHandler


def _checkpoint(name: str, *, sentence_transformer: bool = False) -> str:
    # No arbitrary Hugging Face repository IDs. Fetch trusted, pinned weights in a
    # separate offline provisioning step and mount the directory read-only.
    directory = Path(name).expanduser().resolve(strict=True)
    if not directory.is_dir():
        raise ValueError("Model checkpoint must be a trusted local directory")
    if not (directory / "config.json").is_file() and not (sentence_transformer and (directory / "modules.json").is_file()):
        raise ValueError("Checkpoint must contain a model configuration")
    return str(directory)


class CausalLanguageModel:
    """Per-sentence causal LM mean token NLL (not a prompt heuristic).

    Longer sentences are truncated and the truncated fraction must be reflected
    in the model's validation corpus. Checkpoint selection is domain-specific.
    """
    def __init__(self, path: str, *, max_tokens: int = 512):
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        self.torch = torch
        self.maximum = max(32, min(int(max_tokens), 1024))
        trusted = _checkpoint(path)
        self.tokenizer = AutoTokenizer.from_pretrained(trusted, local_files_only=True, trust_remote_code=False)
        self.model = AutoModelForCausalLM.from_pretrained(
            trusted, local_files_only=True, trust_remote_code=False
        ).eval()
        self.lock = threading.Lock()

    def mean_nll(self, samples: list[str]) -> list[float | None]:
        result: list[float | None] = []
        with self.lock, self.torch.inference_mode():
            for sample in samples[:64]:
                ids = self.tokenizer(
                    sample, return_tensors="pt", add_special_tokens=True,
                    truncation=True, max_length=self.maximum
                )["input_ids"]
                if ids.shape[-1] < 3:
                    result.append(None)
                    continue
                logits = self.model(input_ids=ids).logits[:, :-1, :]
                targets = ids[:, 1:]
                nll = self.torch.nn.functional.cross_entropy(
                    logits.reshape(-1, logits.shape[-1]), targets.reshape(-1), reduction="mean"
                ).item()
                result.append(float(nll) if math.isfinite(nll) else None)
        return result


class LocalEmbeddings:
    """Sentence cosine similarity via a trusted, locally provisioned checkpoint."""
    def __init__(self, path: str):
        from sentence_transformers import SentenceTransformer

        trusted = _checkpoint(path, sentence_transformer=True)
        self.model = SentenceTransformer(
            trusted, local_files_only=True, trust_remote_code=False, device="cpu"
        )
        self.lock = threading.Lock()

    def encode(self, samples: list[str]) -> list[list[float]]:
        with self.lock:
            encoded = self.model.encode(
                samples[:64], batch_size=8, show_progress_bar=False,
                normalize_embeddings=True, convert_to_numpy=True,
            )
        return [[float(v) for v in row] for row in encoded]


class LocalSequenceClassifier:
    """Classifier output is a raw logit; an external calibration is still required."""
    def __init__(self, path: str, *, ai_class_index: int):
        import torch
        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        if ai_class_index not in (0, 1):
            raise ValueError("AI class index must be explicitly 0 or 1")
        trusted = _checkpoint(path)
        self.torch = torch
        self.ai_class_index = ai_class_index
        self.tokenizer = AutoTokenizer.from_pretrained(
            trusted, local_files_only=True, trust_remote_code=False
        )
        self.model = AutoModelForSequenceClassification.from_pretrained(
            trusted, local_files_only=True, trust_remote_code=False
        ).eval()
        if int(self.model.config.num_labels) != 2:
            raise ValueError("Only independently labeled binary checkpoints are supported")
        self.lock = threading.Lock()

    def logit(self, text: str) -> float:
        with self.lock, self.torch.inference_mode():
            batch = self.tokenizer(
                text, truncation=True, max_length=512, return_tensors="pt"
            )
            logits = self.model(**batch).logits[0]
        return float(logits[self.ai_class_index] - logits[1 - self.ai_class_index])


class LanguageRoutedClassifier:
    """Dispatch English/Arabic to individually reviewed local classifiers.

    Mixed-script text does not silently pick either language's detector and
    therefore retains a missing specialist indicator.
    """
    def __init__(self, *, english=None, arabic=None):
        self.english = english
        self.arabic = arabic

    def logit(self, text: str) -> float | None:
        from .text import detect_language
        language = detect_language(text)
        model = self.english if language == "en" else self.arabic if language == "ar" else None
        return model.logit(text) if model is not None else None


class _RejectRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("External classification provider redirected a request")


class ExternalClassifier:
    """Opt-in HTTPS server-to-server adapter for a vetted provider.

    POST {"text": "..."} -> {"ai_logit": <finite number>}.
    The returned logit is NEVER shown as a probability without a local
    independent meta-classifier and calibration.
    """
    def __init__(self, url: str, *, allowed_host: str, token: str, timeout: float = 5.0):
        uri = urlparse(url)
        if (
            uri.scheme != "https" or uri.hostname != allowed_host or
            uri.username is not None or uri.password is not None or
            uri.port not in (None, 443) or not uri.path.startswith("/") or
            uri.fragment or uri.query or not token
        ):
            raise ValueError("Remote provider must be an explicitly approved HTTPS hostname")
        try:
            ipaddress.ip_address(allowed_host)
        except ValueError:
            if "." not in allowed_host or allowed_host.endswith(".local"):
                raise ValueError("External host must be a registered public DNS name")
        else:
            raise ValueError("Literal remote IP addresses are forbidden")
        self.url = url
        self.token = token
        self.timeout = max(1.0, min(float(timeout), 10.0))
        # Bypass inherited proxies and forbid HTTP redirects.
        self.opener = build_opener(ProxyHandler({}), HTTPSHandler(), _RejectRedirect())

    def logit(self, text: str) -> float:
        data = json.dumps({"text": text}, ensure_ascii=False).encode("utf-8")
        if len(data) > 100_000:
            raise ValueError("External provider payload too large")
        request = Request(
            self.url, data=data, method="POST",
            headers={
                "Authorization": "Bearer " + self.token,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )
        with self.opener.open(request, timeout=self.timeout) as reply:
            if int(reply.status) != 200:
                raise RuntimeError("Specialist provider unavailable")
            body = reply.read(4096)
        value = float(json.loads(body)["ai_logit"])
        if not math.isfinite(value) or abs(value) > 100:
            raise ValueError("Provider returned invalid numeric evidence")
        return value
