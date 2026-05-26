#!/usr/bin/env bash
# Exam attempt live monitor — production (server 224).
#
# Polls the prod DB every POLL_SEC seconds, captures full raw output to a local
# log file, streams that log to server 224 in near-real-time, and tails error
# lines from the web + worker containers into the same log so post-mortem can
# be done from a single file.
#
# Stdout = curated event stream (suitable for piping to claude Monitor); the
# log file has everything.
#
# Usage:
#   ./scripts/exam-monitor.sh                # auto-pick the exam with most
#                                              attempts in the last 2 hours
#   ./scripts/exam-monitor.sh <exam-id>      # monitor a specific exam
#
# Env overrides:
#   POLL_SEC=20            poll interval seconds
#   SSH_HOST=codelab@101.96.66.224
#   SSH_PORT=8901
#   SSH_KEY=$HOME/.ssh/feedbackme_prod
#   DB_CONTAINER=feedbackme-postgres-1
#   REMOTE_LOG_DIR=~/feedbackme-exam-monitor   on server 224

set -uo pipefail

EXAM_ID="${1:-}"
POLL_SEC="${POLL_SEC:-20}"
SSH_HOST="${SSH_HOST:-codelab@101.96.66.224}"
SSH_PORT="${SSH_PORT:-8901}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/feedbackme_prod}"
DB_CONTAINER="${DB_CONTAINER:-feedbackme-postgres-1}"
DB_USER="${DB_USER:-feedbackme}"
DB_NAME="${DB_NAME:-feedbackme}"
REMOTE_LOG_DIR="${REMOTE_LOG_DIR:-feedbackme-exam-monitor}"
CONTAINERS="${CONTAINERS:-feedbackme-web-1 feedbackme-web-2 feedbackme-web-3 feedbackme-worker-1}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$REPO_ROOT/logs"
mkdir -p "$LOG_DIR"

# --- SSH multiplexing: one TCP connection for query polls, log streaming, and
# --- container tails. Avoids 4-6 fresh SSH handshakes per poll.
SSH_CTRL="/tmp/exam-monitor-ssh-$$.sock"
ssh -M -S "$SSH_CTRL" -fNT \
    -o ConnectTimeout=10 -o ServerAliveInterval=30 \
    -i "$SSH_KEY" -p "$SSH_PORT" "$SSH_HOST" \
    || { echo "FATAL: ssh master failed to start" >&2; exit 1; }

shc() { ssh -S "$SSH_CTRL" "$SSH_HOST" "$@"; }

# --- pick exam if not provided
if [ -z "$EXAM_ID" ]; then
  EXAM_ID=$(shc "docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -tA" <<<"
    SELECT \"examId\" FROM \"ExamAttempt\"
    WHERE \"startedAt\" > NOW() - INTERVAL '2 hours'
    GROUP BY \"examId\" ORDER BY COUNT(*) DESC LIMIT 1;" 2>/dev/null | tr -d ' \r' | head -1)
  if [ -z "$EXAM_ID" ]; then
    echo "ERROR: no active exam in last 2 hours; pass exam-id explicitly" >&2
    ssh -S "$SSH_CTRL" -O exit "$SSH_HOST" 2>/dev/null
    exit 1
  fi
fi

TS=$(date +%Y%m%d-%H%M%S)
LOG_NAME="exam-monitor-${EXAM_ID}-${TS}.log"
LOG="$LOG_DIR/$LOG_NAME"
SEEN=$(mktemp)

cleanup() {
  rm -f "$SEEN"
  # flush any pending log lines to remote, then kill bg jobs
  kill $(jobs -p) 2>/dev/null
  shc "cat >> $REMOTE_LOG_DIR/$LOG_NAME" < "$LOG" 2>/dev/null
  ssh -S "$SSH_CTRL" -O exit "$SSH_HOST" 2>/dev/null
}
trap cleanup EXIT INT TERM

vnts() { TZ=Asia/Ho_Chi_Minh date +%H:%M:%S; }
utcts() { date -u +%FT%TZ; }

# Every line we want recorded goes through `logln`.
# Local file is the canonical sink; a background `tail -F` ships it to server.
logln() { printf '[%s] %s\n' "$(utcts)" "$*" >> "$LOG"; }

# Curated events go to stdout AND the log.
emit() {
  local line="$*"
  printf '%s\n' "$line"
  logln "EMIT $line"
}

# --- background: ship local log to remote in real time
( tail -n0 -F "$LOG" 2>/dev/null \
    | shc "cat >> $REMOTE_LOG_DIR/$LOG_NAME" ) &

# --- background: container error tails (one per container, multiplexed)
for ctn in $CONTAINERS; do
  ( shc "docker logs -f --since 30s --tail 0 $ctn 2>&1" \
      | grep --line-buffered -iE 'error|exception|fail|warn|exam|grade|enqueue|prisma' \
      | while IFS= read -r ln; do logln "CTN[$ctn] $ln"; done ) &
done

emit "[monitor] start exam=$EXAM_ID log=$LOG poll=${POLL_SEC}s"
emit "[monitor] remote=$SSH_HOST:$REMOTE_LOG_DIR/$LOG_NAME"

# --- exam metadata snapshot
META=$(shc "docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -tA" <<EOF 2>&1
SELECT title || ' | dur=' || "durationMin" || 'm | pass=' || "passScore"
       || ' | proctor=' || "proctoringLevel" || ' | attempt=' || "attemptPolicy"
       || ' | shuffleQ=' || "shuffleQuestions" || ' | shuffleO=' || "shuffleOptions"
FROM "Exam" WHERE id = '$EXAM_ID';
EOF
)
emit "[monitor] $(echo "$META" | tr -d '\r' | head -1)"

# --- main poll loop. bash 3.2 (macOS default) has no associative arrays, so we
# --- stash per-attempt prior state in $STATE_DIR/$aid.
PREV_SNAP=""
STATE_DIR=$(mktemp -d)
trap 'rm -rf "$STATE_DIR"; cleanup' EXIT INT TERM
END=0

while true; do
  TS_VN=$(vnts)

  RAW=$(shc "docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -tA" <<EOF 2>&1
\echo === SNAP ===
SELECT
  COUNT(*) FILTER (WHERE status='in_progress')    || ',' ||
  COUNT(*) FILTER (WHERE status='submitted')      || ',' ||
  COUNT(*) FILTER (WHERE status='auto_submitted') || ',' ||
  COUNT(*) FILTER (WHERE status='graded')         || ',' ||
  COUNT(*) FILTER (WHERE status='flagged')
FROM "ExamAttempt" WHERE "examId"='$EXAM_ID';

\echo === DETAIL ===
SELECT
  a.id || '|' ||
  COALESCE(a."candidateDisplayName", c."displayName", 'unknown') || '|' ||
  a.status || '|' ||
  COALESCE(ROUND(a."scorePct"::numeric,1)::text, '?') || '|' ||
  COALESCE(EXTRACT(EPOCH FROM (a."submittedAt"-a."startedAt"))::int::text, '-') || '|' ||
  COALESCE(EXTRACT(EPOCH FROM (NOW()-a."lastHeartbeatAt"))::int::text, '-') || '|' ||
  a."resumeCount" || '|' ||
  (SELECT COUNT(*) FROM "ExamIncident" WHERE "attemptId"=a.id)
FROM "ExamAttempt" a
LEFT JOIN "ExamCandidate" c ON c.id = a."candidateId"
WHERE a."examId"='$EXAM_ID'
ORDER BY a.id;

\echo === INCIDENTS ===
SELECT
  i.id || '|' || i."attemptId" || '|' || i.type || '|' ||
  to_char(timezone('Asia/Ho_Chi_Minh', timezone('UTC', i."occurredAt")), 'HH24:MI:SS')
FROM "ExamIncident" i
JOIN "ExamAttempt" a ON a.id = i."attemptId"
WHERE a."examId"='$EXAM_ID'
ORDER BY i."occurredAt";
EOF
)
  RC=$?

  if [ $RC -ne 0 ] || [ -z "$RAW" ]; then
    emit "[$TS_VN VN] ERR rc=$RC head=$(echo "$RAW" | head -3 | tr '\n' '⏎')"
    logln "RAW_ERR <<<$RAW>>>"
    sleep "$POLL_SEC"; continue
  fi

  # psql -tA emits trailing \r on each row under some terminal configs; strip
  # once so IFS='|' read stays aligned. Without this, fields off-by-one and
  # arithmetic ops like `[ "$nin" -ge 10 ]` blow up with octal parse errors.
  RAW=$(echo "$RAW" | tr -d '\r')

  # full raw to log (one big multi-line block, preserved)
  {
    printf '[%s] RAW_POLL_BEGIN\n' "$(utcts)"
    printf '%s\n' "$RAW"
    printf '[%s] RAW_POLL_END\n'   "$(utcts)"
  } >> "$LOG"

  # ---- parse SNAP
  SNAP=$(echo "$RAW" | awk '/^=== SNAP ===/{flag=1;next}/^=== /{flag=0}flag' | grep -v '^$' | head -1 | tr -d ' \r')
  if [ -n "$SNAP" ] && [ "$SNAP" != "$PREV_SNAP" ]; then
    IFS=',' read -r inP sub auto grd flg <<<"$SNAP"
    emit "[$TS_VN VN] SNAP in_progress=$inP submitted=$sub auto=$auto graded=$grd flagged=$flg"
    PREV_SNAP="$SNAP"
  fi

  # ---- parse DETAIL → emit per-attempt transitions
  DETAIL=$(echo "$RAW" | awk '/^=== DETAIL ===/{flag=1;next}/^=== /{flag=0}flag' | grep -v '^$')
  while IFS='|' read -r aid who st sc took hb resume nin; do
    [ -z "$aid" ] && continue
    SF="$STATE_DIR/$aid"
    if [ -f "$SF" ]; then
      OLD_ST=$(cut -d'|' -f1 "$SF")
      OLD_SC=$(cut -d'|' -f2 "$SF")
      if [ "$OLD_ST" != "$st" ]; then
        emit "[$TS_VN VN] STATE $who: $OLD_ST → $st (điểm=$sc% viol=$nin)"
      elif [ "$OLD_SC" != "$sc" ] && [ "$sc" != "?" ]; then
        emit "[$TS_VN VN] SCORE $who: → $sc%"
      fi
    else
      logln "DETAIL_INIT $aid $who $st score=$sc viol=$nin"
    fi
    printf '%s|%s\n' "$st" "$sc" > "$SF"
  done <<<"$DETAIL"

  # ---- parse INCIDENTS → log all, emit critical/cumulative-suspicious
  INCIDENTS=$(echo "$RAW" | awk '/^=== INCIDENTS ===/{flag=1;next}flag' | grep -v '^$')
  while IFS='|' read -r iid aid typ tm; do
    [ -z "$iid" ] && continue
    iid=$(echo "$iid" | tr -d ' \r')
    if ! grep -qxF "$iid" "$SEEN"; then
      WHO=$(echo "$DETAIL" | awk -F'|' -v a="$aid" '$1==a{print $2}' | head -1)
      logln "INCIDENT $WHO $typ at $tm aid=$aid"
      case "$typ" in
        multi_face|multi_tab|paste|network_lost)
          emit "[$TS_VN VN] 🚨 CRITICAL $typ — $WHO at $tm"
          ;;
      esac
      echo "$iid" >> "$SEEN"
    fi
  done <<<"$INCIDENTS"

  # ---- per-attempt suspicious threshold (cumulative, emit once per nin bump)
  while IFS='|' read -r aid who st sc took hb resume nin; do
    [ -z "$aid" ] && continue
    # only treat fully-numeric nin as a count; anything else means parsing skewed
    case "$nin" in
      ''|*[!0-9]*) continue ;;
    esac
    if [ "$nin" -ge 10 ]; then
      KEY="SUS:${aid}:${nin}"
      if ! grep -qxF "$KEY" "$SEEN"; then
        emit "[$TS_VN VN] 🚨 SUSPICIOUS $who | status=$st | điểm=$sc% | viol=$nin"
        echo "$KEY" >> "$SEEN"
      fi
    fi
  done <<<"$DETAIL"

  # ---- exit condition: nothing in flight for 3 consecutive polls
  IFS=',' read -r inP sub auto _ _ <<<"$SNAP"
  if [ "${inP:-1}" = "0" ] && [ "${sub:-1}" = "0" ] && [ "${auto:-1}" = "0" ]; then
    END=$((END+1))
    if [ $END -ge 3 ]; then
      emit "[$TS_VN VN] ✅ DONE — log: $LOG"
      emit "[$TS_VN VN] ✅ Remote: $SSH_HOST:$REMOTE_LOG_DIR/$LOG_NAME"
      break
    fi
  else
    END=0
  fi

  sleep "$POLL_SEC"
done
