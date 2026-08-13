#!/usr/bin/env bash
# FeedBackMe restore — from a backup directory produced by feedbackme-backup.sh.
#
#   feedbackme-restore.sh <backup-dir> [--db-only|--uploads-only] [--yes]
#
# This DROPS AND RECREATES the production database. It refuses to run without
# --yes, and prints what it is about to destroy first.
set -euo pipefail

DIR="${1:-}"
[[ -n "$DIR" && -d "$DIR" ]] || { echo "usage: feedbackme-restore.sh <backup-dir> [--db-only|--uploads-only] [--yes]"; exit 2; }
shift

WHAT="all"; CONFIRM="no"
for a in "$@"; do
  case "$a" in
    --db-only) WHAT="db" ;;
    --uploads-only) WHAT="uploads" ;;
    --yes) CONFIRM="yes" ;;
    *) echo "unknown arg: $a"; exit 2 ;;
  esac
done

PG_CTR="feedbackme-postgres-1"
WEB_CTR="feedbackme-web-1"
UPLOADS_PATH="/app/apps/web/uploads"
COMPOSE="docker compose --env-file /etc/feedbackme/.env.prod -f /home/codelab/feedbackme/docker-compose.prod.yml"

echo "=== Backup ==="
cat "${DIR}/MANIFEST.txt" 2>/dev/null || echo "(no manifest)"
echo
echo "=== Hiện trạng production sẽ bị GHI ĐÈ ==="
docker exec "$PG_CTR" psql -U feedbackme -d feedbackme -At -c "
  SELECT 'User='||(SELECT count(*) FROM \"User\")
      || ' Course='||(SELECT count(*) FROM \"Course\")
      || ' LearningEvent='||(SELECT count(*) FROM \"LearningEvent\")" 2>/dev/null || echo "(db unreachable)"
echo

if [[ "$CONFIRM" != "yes" ]]; then
  echo "Chưa có --yes → dừng lại. Thêm --yes để thực sự restore."
  exit 0
fi

if [[ "$WHAT" == "all" || "$WHAT" == "db" ]]; then
  [[ -s "${DIR}/postgres.dump" ]] || { echo "thiếu postgres.dump"; exit 1; }
  echo "→ dừng web/worker/cron để không có ghi mới trong lúc restore"
  $COMPOSE stop web worker cron || true

  echo "→ restore database"
  # --clean --if-exists drops existing objects; -1 wraps it in one transaction so
  # a mid-way failure leaves the old database intact rather than half-replaced.
  docker exec -i "$PG_CTR" pg_restore -U feedbackme -d feedbackme --clean --if-exists -1 \
    < "${DIR}/postgres.dump"

  echo "→ kiểm tra sau restore"
  docker exec "$PG_CTR" psql -U feedbackme -d feedbackme -At -c "
    SELECT 'User='||(SELECT count(*) FROM \"User\")
        || ' Course='||(SELECT count(*) FROM \"Course\")
        || ' LearningEvent='||(SELECT count(*) FROM \"LearningEvent\")"
fi

if [[ "$WHAT" == "all" || "$WHAT" == "uploads" ]]; then
  # Uploads live in the shared mirror, not per-backup tarballs — see the note in
  # feedbackme-backup.sh. The mirror is always the newest complete copy.
  SRC=""
  MIRROR="$(dirname "$(dirname "$DIR")")/uploads-mirror"
  if [[ -d "$MIRROR" ]]; then
    SRC="$MIRROR"
    echo "→ dùng uploads-mirror: $(find "$SRC" -type f | wc -l) file, $(du -sh "$SRC" | cut -f1)"
  fi
  if [[ -n "$SRC" ]]; then
    docker cp "${SRC}/." "${WEB_CTR}:${UPLOADS_PATH}/"
    docker exec -u 0 "$WEB_CTR" sh -c "chown -R 1001:65533 ${UPLOADS_PATH}"
    echo "→ uploads đã khôi phục ($(find "$SRC" -type f | wc -l) file)"
  else
    echo "→ không tìm thấy nguồn uploads, bỏ qua"
  fi
fi

echo "→ khởi động lại dịch vụ"
$COMPOSE up -d web worker cron
echo "XONG. Kiểm tra https://limio.vn/ trước khi coi là hoàn tất."
