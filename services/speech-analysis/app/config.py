"""Cấu hình từ biến môi trường. Khoá API bắt buộc: thiếu thì không khởi động (không mở dịch vụ không khoá)."""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Mapping, Optional


@dataclass(frozen=True)
class Settings:
    api_key: str
    model: str = "large-v3"
    device: str = "auto"
    compute_type: str = "auto"
    # Tệp khoá GPU dùng chung; rỗng = không dùng khoá.
    lock_file: Optional[str] = None
    lock_wait_sec: float = 30.0
    max_bytes: int = 25 * 1024 * 1024
    # Cùng giới hạn với web: 3 phút + dung sai 10 giây của bộ giải mã.
    max_seconds: float = 180.0
    seconds_tolerance: float = 10.0
    # Gợi ý Whisper giữ chữ đệm ("um", "uh"). Mặc định tắt: chỉ bật sau khi đã thử trên bản ghi thật.
    keep_fillers: bool = False
    # Khe im lặng ngắn nhất (mili giây) để VAD tách hai đoạn nói: bằng ngưỡng "ngừng ngắn" của luật trôi chảy (0,25 giây).
    vad_min_silence_ms: int = 250
    # Đệm hai đầu mỗi đoạn nói (mili giây). Mặc định của faster-whisper là 400 ms, làm khe im 2,2 giây chỉ còn 1,6 giây và khe 0,7 giây biến mất
    # (đo trên giọng mẫu, 16/11/2026) — sai cho việc ĐO chỗ ngừng, nên đặt nhỏ.
    vad_pad_ms: int = 30


def load_settings(env: Optional[Mapping[str, str]] = None) -> Settings:
    e = os.environ if env is None else env
    key = (e.get("SPEECH_API_KEY") or "").strip()
    if not key:
        raise RuntimeError("SPEECH_API_KEY chưa đặt: dịch vụ không khởi động khi không có khoá.")
    return Settings(
        api_key=key,
        model=e.get("SPEECH_MODEL", "large-v3"),
        device=e.get("SPEECH_DEVICE", "auto"),
        compute_type=e.get("SPEECH_COMPUTE_TYPE", "auto"),
        lock_file=(e.get("SPEECH_LOCK_FILE") or None),
        lock_wait_sec=float(e.get("SPEECH_LOCK_WAIT_SEC", "30")),
        keep_fillers=e.get("SPEECH_KEEP_FILLERS", "0") == "1",
        vad_min_silence_ms=int(e.get("SPEECH_VAD_MIN_SILENCE_MS", "250")),
        vad_pad_ms=int(e.get("SPEECH_VAD_PAD_MS", "30")),
    )
