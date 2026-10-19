#!/bin/sh
set -eu

: "${WEB_URL:?WEB_URL is required (e.g. http://web:3000)}"
: "${CRON_SECRET:?CRON_SECRET is required}"

cat > /usr/local/bin/run.sh <<EOF
#!/bin/sh
endpoint="\$1"
ts=\$(date -u '+%Y-%m-%dT%H:%M:%SZ')
echo "[\$ts] cron \$endpoint -> ${WEB_URL}/api/cron/\$endpoint"
curl --fail --show-error --silent --max-time 55 \\
     -H "Authorization: Bearer ${CRON_SECRET}" \\
     "${WEB_URL}/api/cron/\$endpoint" || echo "[\$ts] cron \$endpoint FAILED"
EOF
chmod +x /usr/local/bin/run.sh

echo "FeedBackMe cron sidecar starting (TZ=${TZ:-UTC})"
crond -f -l 8
