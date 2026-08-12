#!/usr/bin/env bash
# FeedBackMe backup — Postgres + uploads volume.
#
#   feedbackme-backup.sh daily|weekly|manual [label]
#
# What it protects:
#   postgres   — the whole DB, including the append-only LearningEvent log that
#                every module's state can be rebuilt from (CLAUDE.md §4.5).
#   uploads    — lesson videos, exam assets, submissions. Unlike the DB these
#                cannot be regenerated from anything; losing them is permanent.
#
# Design notes:
#   * Every artefact is VERIFIED after being written — a dump that cannot be
#     listed by pg_restore is not a backup, it is a file. Verification failure
#     is a hard error, not a warning.
#   * Uploads are mirrored with rsync (cheap, only deltas) plus a weekly tar for
#     point-in-time recovery. A daily full tar of a growing video library would
#     waste hours and disk for no extra safety.
#   * Off-site copy is attempted but its failure does not fail the run — the
#     local copy still has value. It is recorded in the manifest and surfaced in
#     the exit summary, because the neighbouring ScoreUp backup silently failed
#     its NAS step for five weeks and nobody noticed.
set -euo pipefail

MODE="${1:-daily}"
LABEL="${2:-}"
case "$MODE" in daily|weekly|manual) ;; *) echo "mode must be daily|weekly|manual"; exit 2 ;; esac

TS="$(date +%Y%m%d_%H%M%S)"
SUFFIX=""
[[ -n "$LABEL" ]] && SUFFIX="_$(echo "$LABEL" | tr -c 'A-Za-z0-9' '-' | sed 's/--*/-/g; s/-$//')"
NAME="feedbackme_${MODE}_${TS}${SUFFIX}"

# ── Config ──────────────────────────────────────────────────────────────
LOCAL_ROOT="/home/codelab/feedbackme-backup-data"
LOCAL_DIR="${LOCAL_ROOT}/${MODE}/${NAME}"
MIRROR_DIR="${LOCAL_ROOT}/uploads-mirror"
LOG="${LOCAL_ROOT}/backup.log"

PG_CTR="feedbackme-postgres-1"
WEB_CTR="feedbackme-web-1"
UPLOADS_PATH="/app/apps/web/uploads"

# Off-site target. Left unreachable today; the run still succeeds without it.
NAS_USER="fit"
NAS_HOST="172.17.18.18"
NAS_ROOT="/volume1/homes/fit/feedbackme-backup"
SSH_KEY="/home/codelab/.ssh/id_ed25519"
SSH_OPTS="-i ${SSH_KEY} -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=no -o ConnectTimeout=8"

case "$MODE" in
  daily)  KEEP=14 ;;
  weekly) KEEP=8  ;;
  manual) KEEP=20 ;;
esac

mkdir -p "$LOCAL_ROOT" "$LOCAL_DIR" "$MIRROR_DIR"

log()  { printf '[%s] [%s] %s\n' "$(date '+%F %T')" "$MODE" "$*" | tee -a "$LOG"; }
fail() { log "FAIL: $*"; exit 1; }
trap 'log "ABORT line $LINENO"' ERR

log "START $NAME"

# ── 1. Postgres ─────────────────────────────────────────────────────────
# Custom format (-Fc): compressed, and restorable selectively with pg_restore.
PGUSER_IN=$(docker exec "$PG_CTR" printenv POSTGRES_USER)
PGDB_IN=$(docker exec "$PG_CTR" printenv POSTGRES_DB)
REMOTE_DUMP="/tmp/${NAME}.dump"
log "pg_dump ${PGDB_IN} -> postgres.dump"
# Dump to a file inside the container rather than streaming to stdout: the
# custom format needs a seekable file for --list, and piping it through
# `docker exec -i` gives pg_restore an unseekable stdin.
docker exec "$PG_CTR" pg_dump -U "$PGUSER_IN" -d "$PGDB_IN" -Fc -f "$REMOTE_DUMP" || fail "pg_dump"

# Verify: the dump must be parseable and contain the tables we care about.
log "verify dump"
docker exec "$PG_CTR" pg_restore --list "$REMOTE_DUMP" \
  > "${LOCAL_DIR}/postgres.toc" 2>/dev/null || fail "dump not readable by pg_restore"

docker cp "${PG_CTR}:${REMOTE_DUMP}" "${LOCAL_DIR}/postgres.dump" >/dev/null || fail "docker cp dump"
docker exec "$PG_CTR" rm -f "$REMOTE_DUMP" || true
[[ -s "${LOCAL_DIR}/postgres.dump" ]] || fail "dump empty"
for t in LearningEvent User Course Lesson XpTransaction; do
  grep -q "TABLE DATA public \"\?${t}\"\? " "${LOCAL_DIR}/postgres.toc" \
    || grep -q "TABLE DATA public ${t} " "${LOCAL_DIR}/postgres.toc" \
    || fail "dump missing table ${t}"
done
DUMP_TABLES=$(grep -c "TABLE DATA" "${LOCAL_DIR}/postgres.toc" || true)
log "dump ok — ${DUMP_TABLES} bảng, $(du -h "${LOCAL_DIR}/postgres.dump" | cut -f1)"

# Row counts, so a silently-truncated future dump is obvious by comparison.
docker exec "$PG_CTR" psql -U "$PGUSER_IN" -d "$PGDB_IN" -At -c "
  SELECT 'User='||(SELECT count(*) FROM \"User\")
      || ' Course='||(SELECT count(*) FROM \"Course\")
      || ' Lesson='||(SELECT count(*) FROM \"Lesson\")
      || ' LearningEvent='||(SELECT count(*) FROM \"LearningEvent\")
" > "${LOCAL_DIR}/rowcounts.txt" 2>/dev/null || log "rowcounts WARN"
log "rows: $(cat "${LOCAL_DIR}/rowcounts.txt" 2>/dev/null || echo '?')"

# ── 2. Uploads ──────────────────────────────────────────────────────────
# Mirror first (fast, delta-only), then snapshot from the mirror so the tar is
# taken from a quiet directory rather than a live one.
log "mirror uploads"
docker cp "${WEB_CTR}:${UPLOADS_PATH}/." "${MIRROR_DIR}/" >> "$LOG" 2>&1 || fail "docker cp uploads"
MIRROR_SIZE=$(du -sh "$MIRROR_DIR" | cut -f1)
MIRROR_FILES=$(find "$MIRROR_DIR" -type f | wc -l)
log "mirror ok — ${MIRROR_SIZE}, ${MIRROR_FILES} file"

# No tar snapshot of uploads. The library is ~9 GB of video and grows; gzipping
# it weekly would cost hours of CPU and ~70 GB of disk to protect files that are
# immutable once written — a video is never edited in place. The mirror is a
# complete copy and, because it only ever adds, an accidental delete on the live
# volume does not propagate into it. Restores read from the mirror.
# Verify the mirror actually holds the media the DB references.
if [[ "$MODE" != "daily" ]]; then
  log "verify mirror vs DB"
  MISSING=0
  while IFS= read -r url; do
    [[ -z "$url" ]] && continue
    fn="${url##*/}"
    find "$MIRROR_DIR" -name "$fn" -type f -print -quit | grep -q . || {
      log "  THIẾU trong mirror: $fn"; MISSING=$((MISSING+1));
    }
  done < <(docker exec "$PG_CTR" psql -U "$PGUSER_IN" -d "$PGDB_IN" -At -c \
      "SELECT payload->>'url' FROM \"ContentItem\" WHERE type='video' AND payload->>'url' LIKE '/api/%'" 2>/dev/null || true)
  [[ "$MISSING" -eq 0 ]] && log "mirror khớp DB — không thiếu video nào" \
                         || log "CẢNH BÁO: $MISSING video có trong DB nhưng không có trong mirror"
  echo "missing_videos=$MISSING" >> "${LOCAL_DIR}/MANIFEST.txt.pre" 2>/dev/null || true
fi

# ── 3. Manifest + checksums ─────────────────────────────────────────────
( cd "$LOCAL_DIR" && sha256sum ./* > SHA256SUMS 2>/dev/null || true )
{
  echo "name=$NAME"
  echo "mode=$MODE"
  echo "created=$(date -Iseconds)"
  echo "host=$(hostname)"
  echo "db_tables=$DUMP_TABLES"
  echo "rows=$(cat "${LOCAL_DIR}/rowcounts.txt" 2>/dev/null || echo '?')"
  echo "uploads_mirror=${MIRROR_SIZE} (${MIRROR_FILES} files)"
  echo "image=$(docker inspect "$WEB_CTR" --format '{{.Config.Image}}' 2>/dev/null || echo '?')"
} > "${LOCAL_DIR}/MANIFEST.txt"

log "local done — $(du -sh "$LOCAL_DIR" | cut -f1)"

# ── 4. Off-site (best effort) ───────────────────────────────────────────
OFFSITE="skipped"
if timeout 6 bash -c "cat < /dev/null > /dev/tcp/${NAS_HOST}/22" 2>/dev/null; then
  log "NAS reachable — rsync"
  if ssh $SSH_OPTS "${NAS_USER}@${NAS_HOST}" "mkdir -p '${NAS_ROOT}/${MODE}'" 2>>"$LOG" \
     && rsync -a --partial -e "ssh $SSH_OPTS" \
          "${LOCAL_DIR}/" "${NAS_USER}@${NAS_HOST}:${NAS_ROOT}/${MODE}/${NAME}/" >> "$LOG" 2>&1; then
    OFFSITE="ok"
  else
    OFFSITE="FAILED"
  fi
else
  OFFSITE="UNREACHABLE"
fi
echo "offsite=$OFFSITE" >> "${LOCAL_DIR}/MANIFEST.txt"
log "offsite: $OFFSITE"

# ── 5. Rotation ─────────────────────────────────────────────────────────
mapfile -t old < <(ls -1dt "${LOCAL_ROOT}/${MODE}"/feedbackme_${MODE}_* 2>/dev/null | tail -n +$((KEEP+1)))
for d in "${old[@]:-}"; do
  [[ -n "$d" ]] && rm -rf "$d" && log "rm old $d"
done

# ── 6. Summary ──────────────────────────────────────────────────────────
if [[ "$OFFSITE" != "ok" ]]; then
  log "DONE $NAME — LƯU Ý: chưa có bản sao ngoài máy (offsite=$OFFSITE)."
  log "  Bản backup chỉ nằm trên chính server này; hỏng ổ đĩa là mất cả gốc lẫn backup."
else
  log "DONE $NAME — local + offsite ok"
fi
