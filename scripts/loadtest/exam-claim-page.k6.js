/**
 * T5-D6 — Load test: GET /exam/[code]
 *
 * Exercises the open-code claim landing page (Next.js server render + Prisma
 * lookup on Exam by openCode). No rate limit, no auth — closest realistic
 * proxy for "500 candidates simultaneously open the exam URL".
 *
 * Target: p95 < 300ms @ 500 VU on production build.
 * Usage:  k6 run scripts/loadtest/exam-claim-page.k6.js \
 *           -e BASE=http://localhost:3000 -e CODE=LOAD01 --vus 500 --duration 30s
 */
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<300"],
  },
};

const BASE = __ENV.BASE || "http://localhost:3000";
const CODE = __ENV.CODE || "LOAD01";

export default function () {
  const r = http.get(`${BASE}/exam/${CODE}`, { tags: { name: "exam_claim_page" } });
  check(r, {
    "200 OK": (res) => res.status === 200,
    "has claim form": (res) => res.body && res.body.includes('name="_hp"'),
  });
  sleep(0.1);
}
