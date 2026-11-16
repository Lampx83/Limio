import fcntl
import os
import tempfile
import threading
import time

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, load_settings
from app.engine import Analysis, Segment, Word, join_words, words_within_speech
from app.gpu_lock import GpuLock, LockTimeout
from app.main import create_app

KEY = "test-key-123"
RATE = 16000


class FakeEngine:
    name = "fake"
    model = "tiny"
    version = "0.0.1"

    def __init__(self, result=None, error=None, delay=0.0):
        self.result = result
        self.error = error
        self.delay = delay
        self.calls = []

    def is_loaded(self):
        return True

    def analyze(self, audio, language):
        self.calls.append((len(audio), language))
        if self.delay:
            time.sleep(self.delay)
        if self.error:
            raise self.error
        return self.result or Analysis(
            text="I like to read books.",
            language=language or "en",
            duration=len(audio) / RATE,
            words=[Word(" I", 0.5, 0.7, 0.91), Word(" like", 0.8, 1.1, 0.88)],
            speech_segments=[Segment(0.5, 5.9)],
        )


def seconds_of_audio(n):
    """Bộ giải mã giả: n giây im lặng (danh sách rỗng đủ dài; không cần numpy)."""
    return lambda data: [0.0] * int(n * RATE)


def make(engine=None, decode=None, **over):
    s = Settings(api_key=KEY, **over)
    return TestClient(create_app(s, engine or FakeEngine(), decode or seconds_of_audio(6.5))), engine


def post(client, key=KEY, data=b"\x01\x02\x03", lang=None, header="bearer"):
    headers = {}
    if key is not None:
        headers = {"Authorization": f"Bearer {key}"} if header == "bearer" else {"x-api-key": key}
    return client.post("/v1/analyze", files={"audio": ("speech.webm", data, "audio/webm")}, data={"language": lang} if lang else {}, headers=headers)


def test_health_khong_can_khoa_va_khong_lo_gi():
    c, _ = make()
    r = c.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "model": "tiny", "loaded": True}


@pytest.mark.parametrize("key", [None, "", "sai-khoa", KEY + "x"])
def test_thieu_hoac_sai_khoa_thi_401_va_khong_goi_engine(key):
    eng = FakeEngine()
    c, _ = make(eng)
    r = post(c, key=key)
    assert r.status_code == 401
    assert r.json() == {"error": "unauthorized"}
    assert eng.calls == []


def test_nhan_khoa_o_bearer_hoac_x_api_key():
    c, _ = make()
    assert post(c, header="bearer").status_code == 200
    assert post(c, header="x-api-key").status_code == 200


def test_tra_ve_dung_hop_dong():
    c, _ = make()
    r = post(c, lang="EN")
    assert r.status_code == 200
    b = r.json()
    assert b["version"] == "1"
    assert b["engine"] == {"name": "fake", "model": "tiny", "version": "0.0.1"}
    assert b["language"] == "en"
    assert b["durationSec"] == 6.5
    assert b["text"] == "I like to read books."
    assert b["words"] == [
        {"word": " I", "start": 0.5, "end": 0.7, "probability": 0.91},
        {"word": " like", "start": 0.8, "end": 1.1, "probability": 0.88},
    ]
    assert b["speechSegments"] == [{"start": 0.5, "end": 5.9}]


def test_ngon_ngu_duoc_chuan_hoa_va_de_trong_thi_de_may_tu_nhan():
    eng = FakeEngine()
    c, _ = make(eng)
    post(c, lang="  ZH ")
    post(c)
    assert [call[1] for call in eng.calls] == ["zh", None]


def test_qua_25mb_thi_413_chua_giai_ma():
    decoded = []
    c, _ = make(decode=lambda d: decoded.append(1) or [0.0] * RATE, max_bytes=1000)
    r = post(c, data=b"x" * 1001)
    assert r.status_code == 413
    assert r.json() == {"error": "audio_too_large"}
    assert decoded == []


def test_tep_rong_thi_422():
    c, _ = make()
    assert post(c, data=b"").status_code == 422


def test_qua_3_phut_cong_dung_sai_thi_422_audio_too_long():
    c, _ = make(decode=seconds_of_audio(191))
    assert post(c).json() == {"error": "audio_too_long"}
    ok, _ = make(decode=seconds_of_audio(189))
    assert post(ok).status_code == 200


def test_khong_giai_ma_duoc_thi_422():
    def boom(_):
        raise ValueError("hỏng")

    c, _ = make(decode=boom)
    r = post(c)
    assert r.status_code == 422
    assert r.json() == {"error": "audio_undecodable"}


def test_engine_loi_thi_500_khong_lo_noi_dung_loi():
    c, _ = make(FakeEngine(error=RuntimeError("secret path /home/x/chu-hoc-vien")))
    r = post(c)
    assert r.status_code == 500
    assert r.json() == {"error": "engine_failed"}
    assert "secret" not in r.text


def test_khong_ghi_tep_nao_ra_dia():
    before = set(os.listdir(tempfile.gettempdir()))
    c, _ = make()
    post(c)
    assert set(os.listdir(tempfile.gettempdir())) - before == set()


def test_khoa_gpu_dang_bi_giu_thi_chờ_roi_503_busy(tmp_path):
    lock_path = str(tmp_path / "GPU.lock")
    holder = open(lock_path, "a")
    fcntl.flock(holder, fcntl.LOCK_EX)  # một tiến trình khác (vLLM...) đang giữ GPU
    try:
        eng = FakeEngine()
        c, _ = make(eng, lock_file=lock_path, lock_wait_sec=0.3)
        t0 = time.monotonic()
        r = post(c)
        assert r.status_code == 503
        assert r.json() == {"error": "busy"}
        assert time.monotonic() - t0 >= 0.3
        assert eng.calls == []
    finally:
        fcntl.flock(holder, fcntl.LOCK_UN)
        holder.close()


def test_cho_khoa_roi_chay_khi_khoa_duoc_nha(tmp_path):
    lock_path = str(tmp_path / "GPU.lock")
    holder = open(lock_path, "a")
    fcntl.flock(holder, fcntl.LOCK_EX)
    threading.Timer(0.3, lambda: (fcntl.flock(holder, fcntl.LOCK_UN), holder.close())).start()
    c, _ = make(lock_file=lock_path, lock_wait_sec=5)
    assert post(c).status_code == 200


def test_gpu_lock_nha_khoa_sau_khi_xong(tmp_path):
    p = str(tmp_path / "GPU.lock")
    with GpuLock(p, 1):
        pass
    with GpuLock(p, 0.2):  # lấy lại được ngay
        pass


def test_gpu_lock_khong_cau_hinh_thi_khong_chan():
    with GpuLock(None, 0):
        pass


def test_gpu_lock_timeout_nem_lock_timeout(tmp_path):
    p = str(tmp_path / "GPU.lock")
    holder = open(p, "a")
    fcntl.flock(holder, fcntl.LOCK_EX)
    try:
        with pytest.raises(LockTimeout):
            with GpuLock(p, 0.2):
                pass
    finally:
        holder.close()


def test_thieu_khoa_api_thi_khong_khoi_dong():
    with pytest.raises(RuntimeError):
        load_settings({})
    with pytest.raises(RuntimeError):
        load_settings({"SPEECH_API_KEY": "   "})
    assert load_settings({"SPEECH_API_KEY": "k", "SPEECH_LOCK_FILE": "/x/GPU.lock", "SPEECH_KEEP_FILLERS": "1"}).keep_fillers is True


def test_vad_pad_mac_dinh_nho_de_do_dung_cho_ngung():
    assert load_settings({"SPEECH_API_KEY": "k"}).vad_pad_ms == 30
    assert load_settings({"SPEECH_API_KEY": "k", "SPEECH_VAD_PAD_MS": "100"}).vad_pad_ms == 100


def test_loc_tu_bia_ngoai_doan_co_tieng():
    words = [Word(" ghost", 0.0, 0.3), Word(" hello", 1.0, 1.4), Word(" there", 1.5, 1.9), Word(" ghost2", 8.0, 8.4)]
    segs = [Segment(0.9, 2.0)]
    kept = words_within_speech(words, segs)
    assert [w.word for w in kept] == [" hello", " there"]
    assert join_words(kept) == "hello there"
    assert words_within_speech(words, []) == []


def test_ghep_chu_han_khong_them_dau_cach():
    assert join_words([Word("我", 0, 1), Word("叫", 1, 2), Word("小林", 2, 3)]) == "我叫小林"
