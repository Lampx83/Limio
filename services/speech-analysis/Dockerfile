# Dịch vụ phân tích tiếng nói nội bộ. Bản mặc định chạy CPU (thử và máy không có GPU).
# Chạy GPU: xem docs/van-hanh/phan-tich-tieng-noi.md ("Chạy trên máy GPU") — cần thêm thư viện CUDA/cuDNN theo hướng dẫn của faster-whisper.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    HF_HOME=/models
RUN useradd --uid 1001 --create-home speech && mkdir /models && chown speech /models
WORKDIR /srv
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY app ./app
USER speech

# Một tiến trình duy nhất: một việc một lúc (khoá GPU chung đã chặn các tiến trình khác).
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=4).status == 200 else 1)"
CMD ["uvicorn", "app.main:app_from_env", "--factory", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
