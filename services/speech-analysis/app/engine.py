"""Bộ máy phân tích: giao diện (`Engine`), phần thuần lọc từ ảo, và bản cài bằng faster-whisper.

Chỉ giao diện và phần thuần được kiểm bằng test tự động; `FasterWhisperEngine` cần mô hình thật nên được thử riêng (docs/van-hanh/phan-tich-tieng-noi.md).
"""
from __future__ import annotations

import io
from dataclasses import dataclass, field
from typing import Any, List, Optional, Protocol, Sequence

SAMPLE_RATE = 16000


@dataclass
class Word:
    word: str
    start: float
    end: float
    probability: float = 1.0


@dataclass
class Segment:
    start: float
    end: float


@dataclass
class Analysis:
    text: str
    language: Optional[str]
    duration: float
    words: List[Word] = field(default_factory=list)
    speech_segments: List[Segment] = field(default_factory=list)


class Engine(Protocol):
    name: str
    model: str
    version: str

    def analyze(self, audio: Any, language: Optional[str]) -> Analysis: ...

    def is_loaded(self) -> bool: ...


# ─── Phần thuần ──────────────────────────────────────────────────────────────

def words_within_speech(words: Sequence[Word], segments: Sequence[Segment], pad: float = 0.2) -> List[Word]:
    """Bỏ các từ nằm ngoài mọi đoạn có tiếng (Whisper hay bịa chữ trong im lặng). Từ được giữ nếu điểm giữa của nó nằm trong một đoạn ± `pad` giây."""
    if not segments:
        return []
    kept: List[Word] = []
    for w in words:
        mid = (w.start + w.end) / 2
        if any(s.start - pad <= mid <= s.end + pad for s in segments):
            kept.append(w)
    return kept


def join_words(words: Sequence[Word]) -> str:
    """Ghép chữ từ các từ (từ của Whisper đã mang dấu cách đầu; chữ Hán/kana không có dấu cách)."""
    return "".join(w.word for w in words).strip()


# ─── faster-whisper ──────────────────────────────────────────────────────────

FILLER_PROMPT = "Umm, let me think, like, hmm... Okay, uh, so, er, here is what I think."


class FasterWhisperEngine:
    name = "faster-whisper"

    def __init__(self, model: str, device: str, compute_type: str, vad_min_silence_ms: int, keep_fillers: bool = False, vad_pad_ms: int = 30):
        self.model = model
        self._device = device
        self._compute_type = compute_type
        self._vad_min_silence_ms = vad_min_silence_ms
        self._vad_pad_ms = vad_pad_ms
        self._keep_fillers = keep_fillers
        self._whisper = None
        try:
            from importlib.metadata import version

            self.version = version("faster-whisper")
        except Exception:  # pragma: no cover
            self.version = "unknown"

    def is_loaded(self) -> bool:
        return self._whisper is not None

    def _load(self):
        if self._whisper is None:
            from faster_whisper import WhisperModel

            self._whisper = WhisperModel(self.model, device=self._device, compute_type=self._compute_type)
        return self._whisper

    def analyze(self, audio: Any, language: Optional[str]) -> Analysis:
        from faster_whisper.vad import VadOptions, get_speech_timestamps

        duration = float(len(audio)) / SAMPLE_RATE
        vad = VadOptions(min_silence_duration_ms=self._vad_min_silence_ms, speech_pad_ms=self._vad_pad_ms)
        raw = get_speech_timestamps(audio, vad)
        segments = [Segment(start=s["start"] / SAMPLE_RATE, end=s["end"] / SAMPLE_RATE) for s in raw]
        if not segments:
            return Analysis(text="", language=language, duration=duration)

        whisper = self._load()
        seg_iter, info = whisper.transcribe(
            audio,
            language=language,
            word_timestamps=True,
            vad_filter=False,  # đoạn có tiếng đã do VAD ở trên cắt; ở đây chỉ cần chữ và mốc từ
            condition_on_previous_text=False,
            initial_prompt=FILLER_PROMPT if (self._keep_fillers and (language in (None, "en"))) else None,
        )
        words: List[Word] = []
        for seg in seg_iter:
            for w in seg.words or []:
                words.append(Word(word=w.word, start=float(w.start), end=float(w.end), probability=float(getattr(w, "probability", 1.0))))
        kept = words_within_speech(words, segments)
        return Analysis(
            text=join_words(kept),
            language=getattr(info, "language", language),
            duration=duration,
            words=kept,
            speech_segments=segments,
        )


def decode_audio_bytes(data: bytes):
    """Giải mã tệp âm thanh trong bộ nhớ thành mẫu 16 kHz đơn kênh. Không ghi đĩa."""
    from faster_whisper.audio import decode_audio

    return decode_audio(io.BytesIO(data), sampling_rate=SAMPLE_RATE)
