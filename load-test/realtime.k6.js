// k6 load test cho realtime infra (Phase 1.3 AC8).
//
// Mục tiêu: 1000 SSE connection đồng thời + 100 POST/s trong 5 phút.
// Thành công: p95 POST <500ms, p99 <1s, 0 HTTP 5xx, web container <2GB RAM.
//
// Chạy:
//   k6 run load-test/realtime.k6.js
// Override target:
//   k6 run -e TARGET=http://localhost:3000 -e CHANNELS=10 load-test/realtime.k6.js
// Chỉ load POST (bỏ SSE):
//   k6 run -e SKIP_SSE=1 load-test/realtime.k6.js
//
// k6 chưa hỗ trợ EventSource native — dùng xhr-style stream (custom).
// Để đo SSE thực, dùng `sse` extension: xk6-sse. Phiên bản này dùng HTTP GET dài
// chỉ để đo concurrent connection hold + receive bytes, không parse SSE frame.

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

const TARGET = __ENV.TARGET || "http://localhost:3000";
const CHANNELS = Number(__ENV.CHANNELS || "10"); // số board ảo
const SKIP_SSE = __ENV.SKIP_SSE === "1";

const postLatency = new Trend("post_latency_ms", true);
const sseBytesRecv = new Counter("sse_bytes_received");

export const options = {
  scenarios: {
    sse_connections: SKIP_SSE
      ? undefined
      : {
          executor: "ramping-vus",
          exec: "sseHold",
          startVUs: 0,
          stages: [
            { duration: "30s", target: 200 },
            { duration: "30s", target: 1000 },
            { duration: "4m", target: 1000 },
            { duration: "10s", target: 0 },
          ],
        },
    post_events: {
      executor: "constant-arrival-rate",
      exec: "postEvent",
      rate: 100,
      timeUnit: "1s",
      duration: "5m",
      preAllocatedVUs: 50,
      maxVUs: 200,
    },
  },
  thresholds: {
    "http_req_failed": ["rate<0.01"],
    "post_latency_ms": ["p(95)<500", "p(99)<1000"],
  },
};

function channel() {
  return `loadtest-${Math.floor(Math.random() * CHANNELS)}`;
}

export function postEvent() {
  const ch = channel();
  // Mỗi VU = 1 IP từ k6 process → rate limit 5/5s sẽ chặn. Bypass bằng query
  // param ?nort=1 (nếu route hỗ trợ) HOẶC test trên endpoint không rate limit.
  // Demo route hiện đang rate-limit, sẽ thấy 429 spam — đó là điểm cần thấy.
  const url = `${TARGET}/api/realtime-demo/${ch}/event?async=1`;
  const t0 = Date.now();
  const res = http.post(url, JSON.stringify({ vu: __VU, iter: __ITER }), {
    headers: { "Content-Type": "application/json" },
    tags: { name: "POST /event" },
  });
  postLatency.add(Date.now() - t0);
  check(res, {
    "status 202 or 429": (r) => r.status === 202 || r.status === 429,
  });
}

export function sseHold() {
  const ch = channel();
  // k6 http.get block đến khi nhận đủ response hoặc timeout. SSE không close →
  // ta dùng timeout = duration window. Trong stage 4m, hold ~30-60s rồi reconnect.
  const holdSec = 30 + Math.random() * 30;
  const res = http.get(`${TARGET}/api/realtime-demo/${ch}/stream`, {
    headers: { Accept: "text/event-stream" },
    timeout: `${Math.ceil(holdSec)}s`,
    tags: { name: "GET /stream" },
  });
  if (res.body) sseBytesRecv.add(res.body.length);
  sleep(0.1);
}
