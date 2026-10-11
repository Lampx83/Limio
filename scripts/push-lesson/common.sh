#!/usr/bin/env bash
# Dùng chung cho aws.sh / server-224.sh — KHÔNG chạy trực tiếp.
#
# Đẩy nội dung MỘT bài học (manifest → DB) lên một server production qua đường hầm SSH,
# bằng packages/core-lms/scripts/update-lesson.ts (chỉ thêm/sửa, không xoá).
#
# Luôn chạy dry-run trước và dừng lại hỏi; chỉ ghi khi bạn gõ "y".
# Mật khẩu DB lấy thẳng từ container Postgres trên server, ghi vào file env tạm (0600)
# và xoá khi script kết thúc — không in ra màn hình, không lưu vào repo.
#
# Biến do file gọi đặt: LABEL SSH_HOST SSH_PORT SSH_KEY(tuỳ chọn) OWNER LOCAL_PORT EXPECT_ID_PREFIX
# Biến tuỳ chọn:        LESSON (mặc định "Bài 2.5")  MANIFEST (mặc định bai-tap-nhom-manifest.json)

set -euo pipefail

: "${LABEL:?}" "${SSH_HOST:?}" "${SSH_PORT:?}" "${OWNER:?}" "${LOCAL_PORT:?}" "${EXPECT_ID_PREFIX:?}"
LESSON="${LESSON:-Bài 2.5}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MANIFEST="${MANIFEST:-$ROOT/docs/hoc-lieu/thiet-ke-ui-ux/thuc-hanh/bai-tap-nhom-manifest.json}"
[ -f "$MANIFEST" ] || { echo "Không thấy manifest: $MANIFEST" >&2; exit 1; }
[ -d "$ROOT/packages/core-lms/node_modules" ] || { echo "Chưa pnpm install (thiếu packages/core-lms/node_modules)." >&2; exit 1; }

if lsof -nP -iTCP:"$LOCAL_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Cổng $LOCAL_PORT trên máy này đang bị chiếm — đóng đường hầm cũ rồi chạy lại." >&2
  exit 1
fi

CTL="$(mktemp -u /tmp/pushlesson.XXXXXX)"
ENVF="$(mktemp /tmp/pushlesson-env.XXXXXX)"
chmod 600 "$ENVF"

SSH_OPTS=(-p "$SSH_PORT" -o ControlMaster=auto -o "ControlPath=$CTL" -o ControlPersist=300
          -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20)
[ -n "${SSH_KEY:-}" ] && SSH_OPTS+=(-i "$SSH_KEY" -o IdentitiesOnly=yes)

cleanup() {
  ssh "${SSH_OPTS[@]}" -O exit "$SSH_HOST" >/dev/null 2>&1 || true
  rm -f "$ENVF"
}
trap cleanup EXIT

echo "== [$LABEL] Kết nối $SSH_HOST:$SSH_PORT (nhập mật khẩu SSH nếu được hỏi) =="
# Lệnh đầu tiên mở kết nối chủ; các lệnh sau dùng lại, không hỏi mật khẩu nữa.
INFO="$(ssh "${SSH_OPTS[@]}" "$SSH_HOST" '
  c=$(docker ps --format "{{.Names}}" | grep -E "^feedbackme-postgres" | head -1)
  [ -n "$c" ] || { echo "KHONG_THAY_CONTAINER_POSTGRES" >&2; exit 3; }
  ip=$(docker inspect -f "{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}" "$c" | awk "{print \$1}")
  printf "%s\n%s\n%s\n%s\n%s\n" "$c" "$ip" \
    "$(docker exec "$c" printenv POSTGRES_USER)" \
    "$(docker exec "$c" printenv POSTGRES_PASSWORD)" \
    "$(docker exec "$c" printenv POSTGRES_DB)"
')"
{ read -r PG_CTR; read -r PG_IP; read -r PG_USER; read -r PG_PASS; read -r PG_DB; } <<<"$INFO"
[ -n "$PG_IP" ] && [ -n "$PG_PASS" ] || { echo "Không lấy được IP/mật khẩu Postgres từ container $PG_CTR." >&2; exit 1; }
echo "   container: $PG_CTR · ip: $PG_IP · db: $PG_DB · user: $PG_USER"

echo "== [$LABEL] Kiểm đúng DB: bài \"$LESSON\" phải có id bắt đầu bằng $EXPECT_ID_PREFIX =="
FOUND="$(ssh "${SSH_OPTS[@]}" "$SSH_HOST" \
  "docker exec $PG_CTR psql -U '$PG_USER' -d '$PG_DB' -Atc \"select id || ' | ' || title from \\\"Lesson\\\" where title like '${LESSON}%'\"")"
echo "$FOUND" | sed 's/^/   /'
if ! grep -q "^$EXPECT_ID_PREFIX" <<<"$FOUND"; then
  echo "KHÔNG khớp id dự kiến ($EXPECT_ID_PREFIX…). Có thể nhầm server (AWS và 224 dùng chung id khoá) — dừng." >&2
  exit 1
fi

echo "== [$LABEL] Mở đường hầm localhost:$LOCAL_PORT → $PG_IP:5432 =="
ssh "${SSH_OPTS[@]}" -O forward -L "$LOCAL_PORT:$PG_IP:5432" "$SSH_HOST"

ENC="$(python3 -c 'import sys,urllib.parse as u;print(u.quote(sys.argv[1],safe=""))' "$PG_PASS")"
printf 'DATABASE_URL=postgresql://%s:%s@localhost:%s/%s\n' "$PG_USER" "$ENC" "$LOCAL_PORT" "$PG_DB" > "$ENVF"
unset PG_PASS ENC INFO

run_update() {
  ( cd "$ROOT/packages/core-lms" && node --env-file="$ENVF" --import tsx scripts/update-lesson.ts \
      --file "$MANIFEST" --owner "$OWNER" --lesson "$LESSON" "$@" )
}

echo
echo "== [$LABEL] DRY-RUN — chưa ghi gì =="
run_update --dry-run
echo
read -r -p "[$LABEL] Ghi thật vào DB $LABEL? (gõ y để ghi, phím khác để bỏ) " ANS
if [ "$ANS" = "y" ]; then
  echo "== [$LABEL] GHI THẬT =="
  run_update
  echo "== [$LABEL] Xong. =="
else
  echo "Đã bỏ — không ghi gì."
fi
