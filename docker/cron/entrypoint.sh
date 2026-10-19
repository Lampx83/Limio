#!/bin/sh
set -eu

: "${WEB_URL:?WEB_URL is required (e.g. http://web:3000)}"
: "${CRON_SECRET:?CRON_SECRET is required}"

# crond chạy job với env tối thiểu — ghi cấu hình ra file để run.sh/alert.sh đọc.
# Bọc giá trị trong '…' (thoát dấu ' bên trong) để URL có & hay ? không vỡ.
env_file=/etc/feedbackme-cron.env
q() { printf "%s" "$1" | sed "s/'/'\\\\''/g"; }
: > "$env_file"
chmod 600 "$env_file"
for var in WEB_URL CRON_SECRET ALERT_WEBHOOK_URL ALERT_HOST_LABEL ALERT_THROTTLE_SEC NEXTAUTH_URL TZ; do
  eval "val=\${$var:-}"
  if [ -n "$val" ]; then printf "export %s='%s'\n" "$var" "$(q "$val")" >> "$env_file"; fi
done

if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
  echo "FeedBackMe cron: cảnh báo job lỗi qua ALERT_WEBHOOK_URL đang BẬT"
else
  echo "FeedBackMe cron: ALERT_WEBHOOK_URL trống — job lỗi chỉ ghi log, không ai được báo"
fi
echo "FeedBackMe cron sidecar starting (TZ=${TZ:-UTC})"
exec crond -f -l 8
