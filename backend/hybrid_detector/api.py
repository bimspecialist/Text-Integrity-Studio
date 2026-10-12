"""Authenticated, bounded FastAPI adapter. No raw user text in logs or storage.

Launch only on a private interface or behind HTTPS/authenticated reverse proxy.
The existing GitHub Pages frontend is static; do NOT put X-API-Key in JavaScript.
"""
from __future__ import annotations

import asyncio
import hmac
import os
import hashlib
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, ConfigDict, Field

from .engine import HybridEngine

BODY_LIMIT = 135_000
TIMEOUT_SECONDS = 30
header_scheme = APIKeyHeader(name="X-API-Key", auto_error=False)


class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=1, max_length=120_000)
    language: Literal["auto", "en", "ar", "mixed"] = "auto"
    domain: str = Field(default="general", min_length=1, max_length=64, pattern=r"^[\w-]+$")
    writing_context: Literal["general", "formal", "non_native", "academic"] = "general"
    segment_by: Literal["paragraph", "sentence"] = "paragraph"
    include_segments: bool = True


@dataclass(frozen=True)
class APISettings:
    api_keys: tuple[str, ...]
    artifact_directory: str | None = None
    allow_calibrated_results: bool = False
    requests_per_minute: int = 30
    concurrency: int = 2

    @staticmethod
    def from_env() -> "APISettings":
        keys = tuple(s.strip() for s in os.getenv("TIS_API_KEYS", "").split(",") if s.strip())
        return APISettings(
            api_keys=keys,
            artifact_directory=os.getenv("TIS_CALIBRATION_DIR") or None,
            allow_calibrated_results=os.getenv("TIS_ENABLE_APPROVED_SCORES", "false").lower() == "true",
            requests_per_minute=int(os.getenv("TIS_REQUESTS_PER_MINUTE", "30")),
            concurrency=int(os.getenv("TIS_CONCURRENCY", "2")),
        )


class SlidingWindowLimiter:
    """Single-process throttle; use shared Redis/gateway quotas across replicas."""
    def __init__(self, rate: int):
        self.rate = rate
        self.events: dict[str, deque[float]] = defaultdict(deque)
        self.lock = threading.Lock()

    def admit(self, token: str) -> bool:
        now = time.monotonic()
        # Token itself remains only in memory; do not log it.
        key = hashlib.sha256(token.encode('utf-8')).hexdigest()
        with self.lock:
            q = self.events[key]
            while q and now - q[0] > 60:
                q.popleft()
            if len(q) >= self.rate:
                return False
            q.append(now)
            if len(self.events) > 10000:
                # Bounded number of accounts expected for initial private deployment.
                self.events = defaultdict(deque, {k:v for k,v in self.events.items() if v and now - v[-1] < 60})
        return True


def _local_adapters() -> dict:
    from .adapters import CausalLanguageModel, LocalEmbeddings, LocalSequenceClassifier
    result = {}
    if path := os.getenv("TIS_LOCAL_CAUSAL_LM_DIR"):
        result["language_model"] = CausalLanguageModel(path)
    if path := os.getenv("TIS_LOCAL_EMBEDDINGS_DIR"):
        result["embeddings"] = LocalEmbeddings(path)
    if path := os.getenv("TIS_LOCAL_CLASSIFIER_DIR"):
        raw_index = os.getenv("TIS_LOCAL_AI_CLASS_INDEX")
        if raw_index not in ("0", "1"):
            raise RuntimeError("Set TIS_LOCAL_AI_CLASS_INDEX to a verified model label index (0 or 1)")
        result["transformer"] = LocalSequenceClassifier(path, ai_class_index=int(raw_index))
    return result


def create_app(settings: APISettings | None = None, engine: HybridEngine | None = None) -> FastAPI:
    config = settings or APISettings.from_env()
    if not config.api_keys or any(len(k) < 32 for k in config.api_keys):
        raise RuntimeError("TIS_API_KEYS must contain at least one 32-character secret")
    if not 1 <= config.requests_per_minute <= 1000 or not 1 <= config.concurrency <= 16:
        raise RuntimeError("Unsafe rate/concurrency configuration")
    if engine is None:
        engine = HybridEngine(
            artifact_directory=config.artifact_directory,
            allow_calibrated_results=config.allow_calibrated_results,
            **_local_adapters(),
        )
    api = FastAPI(
        title="Text Integrity Studio Hybrid Evidence API",
        version="1.0.0", docs_url=None, redoc_url=None,
        description="Evidence-only AI text diagnostics; no authorship adjudications.",
    )
    api.state.engine = engine
    slots = threading.BoundedSemaphore(config.concurrency)
    limiter = SlidingWindowLimiter(config.requests_per_minute)
    router = APIRouter(prefix="/v1", tags=["hybrid"])

    def authorize(key: str | None = Depends(header_scheme)) -> str:
        if not key or not any(hmac.compare_digest(key, secret) for secret in config.api_keys):
            raise HTTPException(status_code=401, detail="Invalid API key")
        if not limiter.admit(key):
            raise HTTPException(status_code=429, detail="Request quota exceeded")
        return key

    @router.post("/analyze")
    async def analyze(request: Request, _key: str = Depends(authorize)):
        length = request.headers.get("content-length")
        if length is not None:
            try:
                if int(length) > BODY_LIMIT:
                    raise HTTPException(status_code=413, detail="JSON body too large")
            except ValueError:
                raise HTTPException(status_code=400, detail="Malformed content length")
        body = bytearray()
        async for chunk in request.stream():
            if len(body) + len(chunk) > BODY_LIMIT:
                raise HTTPException(status_code=413, detail="JSON body too large")
            body.extend(chunk)
        try:
            payload = AnalyzeRequest.model_validate_json(bytes(body))
        except Exception as exc:
            # Never include body or raw Pydantic validation messages, which can echo source text.
            raise HTTPException(status_code=422, detail="Invalid analysis JSON payload") from None

        if not slots.acquire(blocking=False):
            raise HTTPException(status_code=503, detail="All inference workers are busy")
        def compute():
            try:
                return api.state.engine.analyze(
                    payload.text, language=payload.language, domain=payload.domain,
                    writing_context=payload.writing_context, segment_by=payload.segment_by,
                    include_segments=payload.include_segments,
                )
            finally:
                slots.release()
        try:
            result = await asyncio.wait_for(asyncio.to_thread(compute), timeout=TIMEOUT_SECONDS)
            return JSONResponse(result, headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})
        except asyncio.TimeoutError:
            raise HTTPException(status_code=504, detail="Analysis timeout; worker may still be finishing")
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))

    @router.get("/health")
    def health():
        return {
            "service": "hybrid-detector", "ok": True,
            "score_release_enabled": config.allow_calibrated_results,
            "artifact_present": api.state.engine.artifacts["document"] is not None,
            "classifier_conclusion": "INCONCLUSIVE_UNLESS_INDEPENDENTLY_APPROVED",
        }

    api.include_router(router)
    return api


# Public entry point: fail closed at import if server secret is not configured.
# For tests and embedding in an existing FastAPI app, call create_app(settings).
def get_app() -> FastAPI:
    return create_app()


# uvicorn backend.hybrid_detector.api:app --host 127.0.0.1 --port 8000
app = None  # Set to a configured app by hybrid_detector.serve:app
