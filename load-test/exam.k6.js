// Tintin — k6 load test mô phỏng 5000 SV thi trực tuyến đồng thời.
//
// Mục tiêu pass:
//   • heartbeat p95 < 200ms, p99 < 500ms
//   • answer-save p95 < 500ms, p99 < 1500ms
//   • submit p95 < 1000ms (mark-only — auto-grade async qua BullMQ)
//   • http_req_failed rate < 1%
//   • 0 HTTP 5xx
//   • PgBouncer pool wait p95 < 100ms (đo riêng qua /metrics nếu có)
//
// Chạy:
//   k6 run -e TARGET=https://staging.example.com -e ATTEMPTS_JSON=./attempts.json load-test/exam.k6.js
//
// Yêu cầu setup TRƯỚC khi chạy:
//   1. Trên DB staging: seed 1 exam có ~30 câu hỏi MCQ, accessMode=open_code.
//      (chạy script seed riêng — KHÔNG chạy script này lên prod 224 trực tiếp).
//   2. Sinh 5000 ExamAttempt + ExamCandidate (open_code) — script
//      `packages/db/scripts/seed-load-test.ts` (xem ghi chú cuối file).
//   3. Export ra file JSON dạng:
//        [{ "attemptId": "...", "sessionToken": "...", "questionIds": [...] }, ...]
//      và truyền qua biến môi trường `ATTEMPTS_JSON`.
//   4. Nếu chưa có file thật — script tự sinh dữ liệu giả (fakeMode=true),
//      mọi request sẽ về 401/404 nhưng đo được latency stack network/proxy/web.
//
// Override:
//   k6 run -e TARGET=http://localhost:8004 \
//          -e ATTEMPTS_JSON=./attempts.json \
//          -e HEARTBEAT_VU=5000 \
//          -e ANSWER_VU=1000 \
//          -e DURATION=15m \
//          load-test/exam.k6.js

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";
import { SharedArray } from "k6/data";

const TARGET = __ENV.TARGET || "http://localhost:8004";
const HEARTBEAT_VU = Number(__ENV.HEARTBEAT_VU || "5000");
const ANSWER_VU = Number(__ENV.ANSWER_VU || "1000");
const DASHBOARD_VU = Number(__ENV.DASHBOARD_VU || "20");
const DURATION = __ENV.DURATION || "15m";

const hbLatency = new Trend("hb_latency_ms", true);
const ansLatency = new Trend("ans_latency_ms", true);
const submitLatency = new Trend("submit_latency_ms", true);
const dashBytes = new Counter("dashboard_sse_bytes");

// Load attempt list từ file (1 lần, share across VUs).
const attempts = new SharedArray("attempts", () => {
  const path = __ENV.ATTEMPTS_JSON;
  if (!path) {
    // fakeMode — sinh 5000 attemptId giả; mọi request về 401 nhưng đo network OK
    const fake = [];
    for (let i = 0; i < 5000; i++) {
      fake.push({
        attemptId: `fake-${i.toString(16).padStart(12, "0")}`,
        sessionToken: `tok-${i}`,
        questionIds: ["q-fake-1", "q-fake-2", "q-fake-3"],
      });
    }
    return fake;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return JSON.parse(open(path));
  } catch (e) {
    throw new Error(`Không đọc được ${path}: ${e}`);
  }
});

export const options = {
  scenarios: {
    // Mô phỏng heartbeat: mỗi SV ping mỗi ~10s.
    heartbeat: {
      executor: "constant-vus",
      exec: "heartbeatLoop",
      vus: HEARTBEAT_VU,
      duration: DURATION,
    },
    // Mô phỏng autosave answer: subset VU, mỗi ~30s.
    answer_save: {
      executor: "constant-vus",
      exec: "answerLoop",
      vus: ANSWER_VU,
      duration: DURATION,
      startTime: "30s",
    },
    // Instructor dashboard SSE — 20 instructor mở dashboard.
    dashboard_sse: {
      executor: "constant-vus",
      exec: "dashboardSse",
      vus: DASHBOARD_VU,
      duration: DURATION,
    },
    // Submit storm — tất cả SV cùng submit ở phút cuối (5000 trong 60s).
    submit_storm: {
      executor: "constant-arrival-rate",
      exec: "submitOnce",
      rate: 85, // 85/s × 60s = 5100, đủ cho 5K SV
      timeUnit: "1s",
      duration: "60s",
      preAllocatedVUs: 200,
      maxVUs: 500,
      startTime: durationMinusMinute(DURATION),
    },
  },
  thresholds: {
    "http_req_failed": ["rate<0.01"],
    "hb_latency_ms": ["p(95)<200", "p(99)<500"],
    "ans_latency_ms": ["p(95)<500", "p(99)<1500"],
    "submit_latency_ms": ["p(95)<1000", "p(99)<3000"],
  },
};

function durationMinusMinute(d) {
  // "15m" → "14m" cho startTime của submit storm
  const m = /^(\d+)m$/.exec(d);
  if (m) return `${Math.max(1, Number(m[1]) - 1)}m`;
  return "10m";
}

function pickAttempt() {
  return attempts[Math.floor(Math.random() * attempts.length)];
}

export function heartbeatLoop() {
  const a = pickAttempt();
  const url = `${TARGET}/api/exam-attempts/${a.attemptId}/heartbeat`;
  const t0 = Date.now();
  const res = http.post(url, null, {
    tags: { name: "POST /heartbeat" },
    // Pass exam_session cookie nếu có (open/assigned code mode).
    cookies: a.sessionToken ? { exam_session: a.sessionToken } : undefined,
  });
  hbLatency.add(Date.now() - t0);
  check(res, {
    "hb 2xx/401": (r) => r.status < 500,
  });
  // Heartbeat interval ~10s với jitter ±2s
  sleep(8 + Math.random() * 4);
}

export function answerLoop() {
  const a = pickAttempt();
  if (!a.questionIds || a.questionIds.length === 0) {
    sleep(30);
    return;
  }
  const qid = a.questionIds[Math.floor(Math.random() * a.questionIds.length)];
  const url = `${TARGET}/api/exam-attempts/${a.attemptId}/answers/${qid}`;
  const body = JSON.stringify({
    sessionToken: a.sessionToken,
    answerJson: { choice: Math.floor(Math.random() * 4) },
  });
  const t0 = Date.now();
  const res = http.patch(url, body, {
    headers: { "Content-Type": "application/json" },
    tags: { name: "PATCH /answers" },
    cookies: a.sessionToken ? { exam_session: a.sessionToken } : undefined,
  });
  ansLatency.add(Date.now() - t0);
  check(res, {
    "ans 2xx/401": (r) => r.status < 500,
  });
  sleep(25 + Math.random() * 10);
}

export function submitOnce() {
  const a = pickAttempt();
  const url = `${TARGET}/api/exam-attempts/${a.attemptId}/submit`;
  const t0 = Date.now();
  const res = http.post(url, null, {
    tags: { name: "POST /submit" },
    cookies: a.sessionToken ? { exam_session: a.sessionToken } : undefined,
  });
  submitLatency.add(Date.now() - t0);
  check(res, {
    "submit 2xx/401/4xx": (r) => r.status < 500,
  });
}

export function dashboardSse() {
  // Open SSE và hold 30-60s rồi reconnect (mô phỏng instructor mở tab).
  const examId = __ENV.EXAM_ID || "fake-exam-id";
  const holdSec = 30 + Math.random() * 30;
  const res = http.get(`${TARGET}/api/exams/${examId}/live`, {
    headers: { Accept: "text/event-stream" },
    timeout: `${Math.ceil(holdSec)}s`,
    tags: { name: "GET /exams/live" },
  });
  if (res.body) dashBytes.add(res.body.length);
  sleep(0.5);
}

// =============================================================================
// Ghi chú vận hành:
//
// 1. KHÔNG chạy script này lên production server 224. Dùng staging mirror.
//
// 2. Seed dữ liệu test (tạo file `packages/db/scripts/seed-load-test.ts`):
//      - 1 User instructor
//      - 1 Course
//      - 1 Exam openCode="LOADTEST", 30 câu MCQ
//      - 5000 ExamCandidate accessCode duy nhất
//      - 5000 ExamAttempt status=in_progress, startedAt=now, durationSec=3600
//      - Export sessionToken + questionIds ra `./attempts.json`
//
// 3. Theo dõi server-side khi chạy:
//      - PgBouncer: `docker compose exec pgbouncer psql -p 6432 -U feedbackme pgbouncer -c "SHOW POOLS;"`
//      - Redis: `docker compose exec redis redis-cli --stat`
//      - Web replicas: `docker stats $(docker compose ps -q web)`
//      - BullMQ queue depth: gọi /api/admin/queue-status (nếu có) hoặc Redis ZCARD bull:auto-grade:wait
//
// 4. Sau test, dọn dữ liệu: DROP các attempt loadtest qua SQL trực tiếp
//    (LearningEvent append-only — KHÔNG xoá, tag bằng eventKey prefix
//    "loadtest:" để filter khi cần).
// =============================================================================
