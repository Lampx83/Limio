#!/bin/sh
# Gửi cảnh báo ngắn ra webhook (Telegram / Slack / generic) — POSIX sh, chạy
# được với busybox.
#
#   alert.sh <key> <message>              cảnh báo lỗi (chống spam theo key)
#   alert.sh --recovered <key> <message>  báo đã chạy lại bình thường
#
# ALERT_WEBHOOK_URL trống → không làm gì (exit 0). Body luôn là {"text": "..."}:
#   - Slack incoming webhook: dùng nguyên URL.
#   - Telegram: https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>
#     (Bot API nhận chat_id từ query string, text từ body JSON).
#   - Discord: thêm /slack vào cuối URL webhook (endpoint tương thích Slack).
#
# Chống spam: cùng một key gửi tối đa 1 lần / ALERT_THROTTLE_SEC (mặc định 1800s).
# Thông báo phục hồi chỉ gửi khi trước đó đã thật sự gửi cảnh báo lỗi, nên job
# chập chờn mỗi phút cũng chỉ tạo tối đa 2 tin / 30 phút.
#
# Không bao giờ trả lỗi: hỏng đường cảnh báo không được làm hỏng job.

recovered=0
if [ "${1:-}" = "--recovered" ]; then recovered=1; shift; fi
key="${1:-}"
msg="${2:-}"
[ -n "${ALERT_WEBHOOK_URL:-}" ] || exit 0
[ -n "$key" ] || exit 0

state_dir="${ALERT_STATE_DIR:-/tmp/feedbackme-alert}"
throttle="${ALERT_THROTTLE_SEC:-1800}"
mkdir -p "$state_dir" 2>/dev/null || exit 0
safe_key=$(printf '%s' "$key" | tr -c 'A-Za-z0-9._-' '_')
last_file="$state_dir/$safe_key.last"
alerted_file="$state_dir/$safe_key.alerted"

# Máy nào: ALERT_HOST_LABEL, không có thì lấy host của NEXTAUTH_URL (limio.vn /
# limio.hust.edu.vn — hostname trong container chỉ là id container), cuối cùng
# mới tới hostname.
label="${ALERT_HOST_LABEL:-}"
if [ -z "$label" ] && [ -n "${NEXTAUTH_URL:-}" ]; then
  label=$(printf '%s' "$NEXTAUTH_URL" | sed -e 's#^[A-Za-z]*://##' -e 's#[/:].*##')
fi
[ -n "$label" ] || label=$(hostname 2>/dev/null || echo unknown)

now=$(date +%s)
if [ "$recovered" -eq 1 ]; then
  [ -f "$alerted_file" ] || exit 0
  rm -f "$alerted_file"
  text="✅ [$label] $msg"
else
  if [ -f "$last_file" ]; then
    last=$(cat "$last_file" 2>/dev/null || echo 0)
    case "$last" in '' | *[!0-9]*) last=0 ;; esac
    [ $((now - last)) -lt "$throttle" ] && exit 0
  fi
  text="🚨 [$label] $msg"
fi

# JSON-escape: \ và ", tab → space, xuống dòng → \n, bỏ ký tự điều khiển khác.
# Không cắt ở đây (cắt theo byte có thể làm vỡ ký tự UTF-8) — caller giữ tin ngắn.
json_text=$(printf '%s' "$text" | tr '\t' ' ' | tr -d '\000-\010\013-\037' |
  sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | awk 'NR > 1 { printf "\\n" } { printf "%s", $0 }')

if curl --silent --show-error --max-time 10 -o /dev/null --fail \
     -H 'Content-Type: application/json' \
     -d "{\"text\":\"$json_text\"}" \
     "$ALERT_WEBHOOK_URL"; then
  if [ "$recovered" -eq 0 ]; then
    echo "$now" > "$last_file"
    : > "$alerted_file"
  fi
else
  echo "alert.sh: gửi webhook thất bại (key=$key)" >&2
fi
exit 0
