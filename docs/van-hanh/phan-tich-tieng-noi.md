# Dịch vụ phân tích tiếng nói (nội bộ) — dựng, cấu hình, vận hành

Tiêu chí: `docs/tieu-chi/limio-language-cham-noi-bang-mic.md`, AC1. Mã: `services/speech-analysis/` (Python) và máy khách `packages/core-feedback/src/speaking/speechService.ts`.

> **Trạng thái (16/11/2026):** mã và test tự động xong (Python 23 test, TypeScript 24 test). Đã thử với **thư viện thật** (faster-whisper 1.2.1) phần giải mã âm thanh và VAD trên giọng mẫu; **chưa chạy phần Whisper** (không tải được tệp mô hình từ mạng ở máy dev), chưa chạy trên GPU, chưa triển khai. Phần "Việc chưa kiểm" cuối trang liệt kê đúng những gì còn phải thử.

## Dịch vụ làm gì

Nhận một bản ghi âm của học viên, trả về **chữ**, **mốc thời gian từng từ** và **các đoạn có tiếng nói** (do bộ phát hiện tiếng nói, VAD, cắt ra). Limio dùng các đoạn có tiếng để đo chỗ ngừng chính xác hơn mốc từ của Whisper (mốc từ hay lệch trong im lặng), rồi tính độ trôi chảy như cũ.

- **Giọng nói không rời máy chủ của mình**: giải mã trong bộ nhớ, không ghi đĩa, không ghi chữ hay âm thanh vào log.
- Mỗi lần chỉ chạy **một việc**, và chỉ khi giữ được khoá `GPU.lock` dùng chung với vLLM; chờ tối đa **30 giây** rồi trả `503 busy`.
- Lỗi/bận/quá giờ/phản hồi sai thì web **tự dùng Whisper qua OpenAI như trước** (không chặn nộp bài, không trừ ví phần chưa chạy).

## Hợp đồng

`POST /v1/analyze` — multipart: `audio` (tệp, tối đa 25 MB), `language` (mã như `en`, `zh`; bỏ trống = tự nhận). Khoá: `Authorization: Bearer <khoá>` **hoặc** `x-api-key: <khoá>`.

```json
{
  "version": "1",
  "engine": { "name": "faster-whisper", "model": "large-v3", "version": "1.0.3" },
  "language": "en",
  "durationSec": 12.34,
  "text": "I like to read books.",
  "words": [{ "word": " I", "start": 0.5, "end": 0.7, "probability": 0.91 }],
  "speechSegments": [{ "start": 0.5, "end": 5.9 }]
}
```

Lỗi luôn là `{ "error": "<mã>" }`, không kèm nội dung: `401 unauthorized`, `413 audio_too_large`, `422 audio_empty | audio_undecodable | audio_too_long` (quá 3 phút + 10 giây dung sai), `503 busy`, `500 engine_failed`. `GET /health` (không cần khoá) trả `{status, model, loaded}`.

Máy khách chỉ giữ **mốc** của từng từ, bỏ chữ của từng từ (chữ chỉ lấy từ `text`).

## Biến môi trường của dịch vụ

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `SPEECH_API_KEY` | **bắt buộc** | Thiếu thì dịch vụ **không khởi động** (không mở dịch vụ không khoá) |
| `SPEECH_MODEL` | `large-v3` | Tên mô hình faster-whisper. Thử trên máy thường dùng `tiny` hoặc `base` |
| `SPEECH_DEVICE` / `SPEECH_COMPUTE_TYPE` | `auto` | Chạy GPU: `cuda` và `float16` |
| `SPEECH_LOCK_FILE` | trống (không khoá) | Đường dẫn `GPU.lock` dùng chung; **phải trùng** với tệp các dịch vụ GPU khác đang giữ |
| `SPEECH_LOCK_WAIT_SEC` | `30` | Chờ khoá tối đa ngần này rồi báo `busy` |
| `SPEECH_VAD_MIN_SILENCE_MS` | `250` | Khe im lặng ngắn nhất để tách hai đoạn nói; bằng ngưỡng "ngừng ngắn" của luật trôi chảy |
| `SPEECH_VAD_PAD_MS` | `30` | Đệm hai đầu mỗi đoạn nói. **Đừng để mặc định của faster-whisper (400)**: đo trên giọng mẫu, khe im 2,2 giây chỉ còn 1,6 giây và khe 0,7 giây mất hẳn |
| `SPEECH_KEEP_FILLERS` | `0` | `1` = gợi ý Whisper giữ chữ đệm ("um", "uh"); **chưa thử**, xem cuối trang |

## Chạy thử trên máy dev (CPU)

```bash
cd services/speech-analysis
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt            # cần faster-whisper (kéo theo ctranslate2, onnxruntime)
SPEECH_API_KEY=dev-key SPEECH_MODEL=tiny uvicorn app.main:app_from_env --factory --port 8080
```

Mô hình tải về lần gọi đầu (qua Hugging Face, thư mục `HF_HOME`). Thử bằng một tệp ghi âm bất kỳ:

```bash
curl -s -H "Authorization: Bearer dev-key" -F audio=@ghi-am.webm -F language=en http://127.0.0.1:8080/v1/analyze
```

Chạy test (không cần faster-whisper, dùng bộ máy giả): `pip install -r requirements-dev.txt && python -m pytest`.

## Chạy trên máy GPU

`services/speech-analysis/docker-compose.yml` (chưa thử trên máy thật). Các điểm phải làm đúng:

1. **Cùng khoá GPU với các dịch vụ khác.** Gắn thư mục chứa `GPU.lock` vào `/locks` (`GPU_LOCK_DIR`), và các dịch vụ khác (vLLM, Ditto…) giữ đúng tệp đó. Khác đường dẫn nghĩa là hai bên không thấy nhau.
2. **Thư viện CUDA/cuDNN** cho faster-whisper: `Dockerfile` mặc định là bản CPU. Bản GPU cần cuBLAS và cuDNN theo hướng dẫn của faster-whisper (tài liệu của thư viện ghi phiên bản khớp với CTranslate2), rồi bỏ dấu `#` ở khối `deploy` để cấp GPU.
3. **Bộ nhớ GPU còn trống** bên cạnh vLLM phải đủ cho mô hình đã chọn. Chưa đo; đo trước khi đặt `SPEECH_MODEL=large-v3` làm mặc định.
4. **Cổng không mở thẳng ra ngoài.** Đặt sau Kong hoặc Caddy như NEU TTS (Kong dùng `x-api-key`; Limio gửi cả hai tiêu đề cùng một khoá).
5. Production Limio (server 224) **phải gọi tới được** máy này. Giảng viên ảo (Ditto trên server 232) từng không gọi được từ 224, nên kiểm đường mạng trước.

## Nối vào Limio

Trang quản trị → **Tích hợp** → "Phân tích tiếng nói": nhập **Địa chỉ dịch vụ** (gốc, không kèm `/v1/analyze`) và **Khoá API** (cùng giá trị `SPEECH_API_KEY`). Hoặc biến môi trường `SPEECH_ANALYSIS_BASE_URL` và `SPEECH_ANALYSIS_API_KEY`.

- Có đủ hai giá trị: bốn đường nói bằng mic (câu mở, hội thoại/đóng vai, xem thử của giảng viên, bài nói nộp giảng viên) gọi dịch vụ trước.
- Thiếu một trong hai, hoặc không cấu hình: dùng Whisper qua OpenAI như trước khi có dịch vụ (thiếu khoá thì có cảnh báo trong log).
- **Tắt nhanh:** xoá "Địa chỉ dịch vụ" trong trang Tích hợp. Không cần triển khai lại.
- Ví token của học viên vẫn trừ theo thời lượng như Whisper (`whisperChargeTokens`); đường lùi cũng trừ như cũ.
- Log của web chỉ ghi MÃ lý do khi rơi về cách cũ: `busy`, `timeout`, `network`, `http_5xx`, `bad_response`. Rơi về thường xuyên nghĩa là dịch vụ đang quá tải hoặc sai cấu hình.

## Việc chưa kiểm (cần làm trước khi tin dịch vụ)

0. **Đã kiểm (16/11/2026, faster-whisper 1.2.1, giọng mẫu 7,5 giây có khe im 2,2 giây và 0,7 giây):** giải mã tệp bằng `decode_audio`, `get_speech_timestamps(audio, VadOptions(min_silence_duration_ms, speech_pad_ms))` và các tham số `language`, `word_timestamps`, `vad_filter`, `condition_on_previous_text`, `initial_prompt` của `transcribe` đều tồn tại đúng tên; `Word` có `start`, `end`, `word`, `probability`. Với đệm 30 ms, VAD đo khe 2,34 và 0,61 giây (thật 2,2 và 0,7).
1. **Chạy phần Whisper (chuyển chữ + mốc từ) với mô hình thật.** Máy dev không tải được tệp `model.bin` từ Hugging Face (máy chủ CDN `us.aws.cdn.hf.co` quá giờ), nên chưa chạy. Mã gọi `faster_whisper.vad.get_speech_timestamps(audio, VadOptions(...))` và `WhisperModel.transcribe(..., word_timestamps=True)`; chữ ký các hàm này đổi giữa các bản của thư viện, nên cần thử đúng bản đã ghim trong `requirements.txt`. Test tự động chỉ dùng bộ máy giả.
2. **Chất lượng đoạn có tiếng (VAD) trên giọng học viên Việt**: ngưỡng im lặng 250 ms và việc bỏ từ nằm ngoài đoạn có tiếng (±0,2 giây) có thể cắt nhầm tiếng nhỏ.
3. **Thời gian trả lời** với bản ghi 3 phút trên GPU đang chia sẻ với vLLM; so với giới hạn chờ khoá 30 giây và hạn 60 giây của máy khách.
4. **Gợi ý giữ chữ đệm** (`SPEECH_KEEP_FILLERS=1`): chưa biết có làm Whisper bịa chữ trong im lặng không. Chỉ bật sau khi thử trên bản ghi thật; luật trôi chảy vẫn đúng khi tắt (chỉ không đếm được chữ đệm).
5. **Đường mạng 224 → máy GPU** và Kong.
6. **Python chưa nằm trong CI**: test của dịch vụ chỉ chạy tay. Thêm một bước `pip install -r requirements-dev.txt && python -m pytest` vào `.github/workflows/ci.yml` khi thầy đồng ý.

## Không làm trong AC1

Canh từ bằng mô hình wav2vec2 (kiểu WhisperX) cần PyTorch và nặng hơn nhiều; bản này dùng mốc từ của chính Whisper cộng đoạn có tiếng của VAD. Phát âm theo âm vị là mốc B.
