#!/usr/bin/env bash
# Bản sao ngoài máy cho file upload: MinIO (NAS) → Cloudflare R2.
#
#   feedbackme-nas-to-r2.sh            # sao chép thật
#   feedbackme-nas-to-r2.sh --dry-run  # chỉ liệt kê việc sẽ làm
#
# Vì sao có script này: từ khi upload chuyển sang MinIO trên NAS (S3_ENDPOINT),
# bản mirror volume của feedbackme-backup.sh không còn chứa file mới. NAS là nơi
# duy nhất giữ video/PDF/bài nộp — script này tạo bản thứ hai ở ngoài LAN.
#
# Thiết kế:
#   * `rclone copy` CHỈ thêm/cập nhật, KHÔNG BAO GIỜ xoá ở đích. Lỡ xoá nhầm trên
#     NAS thì bản R2 vẫn còn (cùng tinh thần "mirror chỉ thêm" ở feedbackme-backup.sh).
#   * So sánh theo kích thước (ETag của multipart khác nhau giữa MinIO và R2).
#   * Xác minh sau khi chép: thiếu/khác kích thước là lỗi cứng (exit 1), không
#     phải cảnh báo — bài học từ backup NAS của ScoreUp im lặng hỏng 5 tuần.
#
# Cấu hình:
#   nguồn : S3_* trong /etc/feedbackme/.env.prod (chính là MinIO app đang dùng)
#   đích  : /home/codelab/services/backup/r2.env (chmod 600), gồm
#             R2_ENDPOINT R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET [R2_PREFIX]
#             [R2_MAX_GB]  trần dung lượng (mặc định 9.5) để không vượt 10 GB miễn phí
set -euo pipefail

DRY=""
[[ "${1:-}" == "--dry-run" ]] && DRY="--dry-run"

ENV_FILE="${ENV_FILE:-/etc/feedbackme/.env.prod}"
R2_ENV="${R2_ENV:-/home/codelab/services/backup/r2.env}"
LOG_DIR="${LOG_DIR:-/home/codelab/feedbackme-backup-data}"
RCLONE_IMAGE="rclone/rclone:latest"

mkdir -p "$LOG_DIR"
log() { echo "[$(date '+%F %T')] $*"; }

# Đọc đúng khóa cần thiết, không `source` cả file (tránh chạy nhầm nội dung lạ).
# `|| true`: khoá tùy chọn vắng mặt không được làm chết script (pipefail + set -e).
getv() { { grep -E "^$2=" "$1" || true; } | tail -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/'; }

SRC_ENDPOINT="$(getv "$ENV_FILE" S3_ENDPOINT)"
SRC_KEY="$(getv "$ENV_FILE" S3_ACCESS_KEY_ID)"
SRC_SECRET="$(getv "$ENV_FILE" S3_SECRET_ACCESS_KEY)"
SRC_BUCKET="$(getv "$ENV_FILE" S3_BUCKET)"

DST_ENDPOINT="$(getv "$R2_ENV" R2_ENDPOINT)"
DST_KEY="$(getv "$R2_ENV" R2_ACCESS_KEY_ID)"
DST_SECRET="$(getv "$R2_ENV" R2_SECRET_ACCESS_KEY)"
DST_BUCKET="$(getv "$R2_ENV" R2_BUCKET)"
DST_PREFIX="$(getv "$R2_ENV" R2_PREFIX)"; DST_PREFIX="${DST_PREFIX:-nas-mirror}"
MAX_GB="$(getv "$R2_ENV" R2_MAX_GB)"; MAX_GB="${MAX_GB:-9.5}"

for v in SRC_ENDPOINT SRC_KEY SRC_SECRET SRC_BUCKET DST_ENDPOINT DST_KEY DST_SECRET DST_BUCKET; do
  [[ -n "${!v}" ]] || { log "THIẾU cấu hình: $v"; exit 2; }
done

rc() {
  docker run --rm \
    -e RCLONE_CONFIG_SRC_TYPE=s3 -e RCLONE_CONFIG_SRC_PROVIDER=Minio \
    -e RCLONE_CONFIG_SRC_ENDPOINT="$SRC_ENDPOINT" \
    -e RCLONE_CONFIG_SRC_ACCESS_KEY_ID="$SRC_KEY" \
    -e RCLONE_CONFIG_SRC_SECRET_ACCESS_KEY="$SRC_SECRET" \
    -e RCLONE_CONFIG_DST_TYPE=s3 -e RCLONE_CONFIG_DST_PROVIDER=Cloudflare \
    -e RCLONE_CONFIG_DST_ENDPOINT="$DST_ENDPOINT" \
    -e RCLONE_CONFIG_DST_ACCESS_KEY_ID="$DST_KEY" \
    -e RCLONE_CONFIG_DST_SECRET_ACCESS_KEY="$DST_SECRET" \
    -e RCLONE_CONFIG_DST_NO_CHECK_BUCKET=true \
    "$RCLONE_IMAGE" "$@"
}

SRC="SRC:${SRC_BUCKET}"
DST="DST:${DST_BUCKET}/${DST_PREFIX}"

# Chốt chặn dung lượng: R2 miễn phí 10 GB. Nguồn (NAS) lớn hơn trần ⇒ dừng TRƯỚC
# khi chép, thoát lỗi 3 để cron/log thấy rõ, thay vì lặng lẽ sinh phí hoặc chép dở.
SRC_BYTES="$(rc size "$SRC" --json 2>/dev/null | sed -n 's/.*"bytes":\([0-9]*\).*/\1/p')"
LIMIT_BYTES="$(awk -v g="$MAX_GB" 'BEGIN{printf "%.0f", g*1000000000}')"
if [[ -n "$SRC_BYTES" && "$SRC_BYTES" -gt "$LIMIT_BYTES" ]]; then
  log "DỪNG: nguồn $((SRC_BYTES/1000000)) MB > trần ${MAX_GB} GB của R2 miễn phí."
  log "Chọn: nâng R2_MAX_GB (chấp nhận trả ~\$0.015/GB/tháng) hoặc loại bớt dữ liệu khỏi bản sao."
  exit 3
fi
log "Nguồn ${SRC_BYTES:-?} bytes (trần ${MAX_GB} GB)"

log "== NAS→R2 ${DRY:+(dry-run) }${SRC} → ${DST_BUCKET}/${DST_PREFIX}"
rc copy "$SRC" "$DST" --size-only --transfers 4 --checkers 8 $DRY \
  --stats-one-line --stats 30s -v 2>&1 | tail -n 20

if [[ -n "$DRY" ]]; then log "dry-run xong, chưa ghi gì."; exit 0; fi

log "Xác minh (mọi object nguồn phải có ở đích, cùng kích thước)…"
if rc check "$SRC" "$DST" --size-only --one-way 2>&1 | tail -n 8; then
  log "OK: bản sao R2 khớp NAS."
else
  log "LỖI: bản sao R2 KHÔNG khớp NAS."; exit 1
fi
