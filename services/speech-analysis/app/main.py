"""Dịch vụ phân tích tiếng nói nội bộ (docs/tieu-chi/limio-language-cham-noi-bang-mic.md AC1).

POST /v1/analyze  (multipart: audio, language?)  →  { version, engine, language, durationSec, text, words[], speechSegments[] }
GET  /health

Quy tắc: không lưu gì (âm thanh giải mã trong bộ nhớ, không ghi đĩa), không ghi chữ hay âm thanh vào log, chỉ chạy khi giữ được khoá GPU.
"""
from __future__ import annotations

import hmac
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, Optional

from fastapi import FastAPI, File, Form, Header, UploadFile
from fastapi.responses import JSONResponse

from .config import Settings, load_settings
from .engine import SAMPLE_RATE, Engine, FasterWhisperEngine, decode_audio_bytes
from .gpu_lock import GpuLock, LockTimeout

log = logging.getLogger("speech")
CONTRACT_VERSION = "1"
_CHUNK = 1024 * 1024


def _err(status: int, code: str) -> JSONResponse:
    return JSONResponse({"error": code}, status_code=status)


def create_app(
    settings: Optional[Settings] = None,
    engine: Optional[Engine] = None,
    decode: Optional[Callable[[bytes], Any]] = None,
) -> FastAPI:
    s = settings or load_settings()
    eng: Engine = engine or FasterWhisperEngine(s.model, s.device, s.compute_type, s.vad_min_silence_ms, s.keep_fillers, s.vad_pad_ms)
    dec = decode or decode_audio_bytes
    # Một việc một lúc trong tiến trình: GPU nhỏ, và khoá GPU chung đã chặn các tiến trình khác.
    pool = ThreadPoolExecutor(max_workers=1)
    app = FastAPI(title="speech-analysis", docs_url=None, redoc_url=None, openapi_url=None)

    def authorized(authorization: Optional[str], x_api_key: Optional[str]) -> bool:
        presented = x_api_key or ""
        if authorization and authorization.lower().startswith("bearer "):
            presented = authorization[7:].strip() or presented
        return bool(presented) and hmac.compare_digest(presented.encode(), s.api_key.encode())

    def run(audio: Any, language: Optional[str]):
        with GpuLock(s.lock_file, s.lock_wait_sec):
            return eng.analyze(audio, language)

    @app.get("/health")
    def health():
        return {"status": "ok", "model": eng.model, "loaded": eng.is_loaded()}

    @app.post("/v1/analyze")
    async def analyze(
        audio: UploadFile = File(...),
        language: Optional[str] = Form(None),
        authorization: Optional[str] = Header(None),
        x_api_key: Optional[str] = Header(None),
    ):
        if not authorized(authorization, x_api_key):
            return _err(401, "unauthorized")

        data = bytearray()
        while True:
            chunk = await audio.read(_CHUNK)
            if not chunk:
                break
            data.extend(chunk)
            if len(data) > s.max_bytes:
                return _err(413, "audio_too_large")
        if not data:
            return _err(422, "audio_empty")

        try:
            samples = dec(bytes(data))
        except Exception:
            return _err(422, "audio_undecodable")
        seconds = len(samples) / SAMPLE_RATE
        if seconds > s.max_seconds + s.seconds_tolerance:
            return _err(422, "audio_too_long")

        lang = (language or "").strip().lower() or None
        started = time.monotonic()
        try:
            result = await _in_pool(pool, run, samples, lang)
        except LockTimeout:
            log.warning("busy: không giữ được khoá GPU sau %.0f giây", s.lock_wait_sec)
            return _err(503, "busy")
        except Exception:
            # Không ghi nội dung lỗi (có thể chứa đường dẫn/chữ); chỉ ghi loại lỗi.
            log.exception("engine_failed")
            return _err(500, "engine_failed")

        log.info("analyzed duration=%.1fs elapsed=%.1fs words=%d", seconds, time.monotonic() - started, len(result.words))
        return {
            "version": CONTRACT_VERSION,
            "engine": {"name": eng.name, "model": eng.model, "version": eng.version},
            "language": result.language,
            "durationSec": round(result.duration, 3),
            "text": result.text,
            "words": [{"word": w.word, "start": round(w.start, 3), "end": round(w.end, 3), "probability": round(w.probability, 3)} for w in result.words],
            "speechSegments": [{"start": round(g.start, 3), "end": round(g.end, 3)} for g in result.speech_segments],
        }

    return app


async def _in_pool(pool: ThreadPoolExecutor, fn, *args):
    import asyncio

    return await asyncio.get_running_loop().run_in_executor(pool, fn, *args)


def app_from_env() -> FastAPI:  # `uvicorn app.main:app_from_env --factory`
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    return create_app()
