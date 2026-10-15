#!/bin/sh
# Gọi một endpoint cron của web: run.sh <endpoint>. crond không truyền env của
# container xuống job, nên cấu hình đọc từ file entrypoint.sh ghi lúc khởi động.
. /etc/feedbackme-cron.env

endpoint="$1"
ts=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
url="${WEB_URL}/api/cron/${endpoint}"
echo "[$ts] cron $endpoint -> $url"

body=$(mktemp)
err=$(mktemp)
# Không dùng --fail: cần mã HTTP và body lỗi để đưa vào cảnh báo.
code=$(curl --silent --show-error --max-time 55 -o "$body" -w '%{http_code}' \
  -H "Authorization: Bearer ${CRON_SECRET}" "$url" 2>"$err")
rc=$?
cat "$body"
echo

case "$code" in 2??) http_ok=1 ;; *) http_ok=0 ;; esac
if [ "$rc" -eq 0 ] && [ "$http_ok" -eq 1 ]; then
  /usr/local/bin/alert.sh --recovered "cron-$endpoint" "cron $endpoint chạy lại bình thường (HTTP $code)"
else
  echo "[$ts] cron $endpoint FAILED (curl exit $rc, HTTP $code)"
  # Chỉ giữ ASCII in được (0x20-0x7E) rồi mới cắt theo byte, để không làm vỡ ký
  # tự UTF-8. Dải byte tường minh vì `tr [:print:]` của busybox không đáng tin.
  detail=$(cat "$err" "$body" | tr -cd ' -~\n' | head -c 300)
  /usr/local/bin/alert.sh "cron-$endpoint" "cron $endpoint THẤT BẠI — HTTP $code, curl exit $rc
$detail"
fi
rm -f "$body" "$err"
