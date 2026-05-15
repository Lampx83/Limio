# Exam module load tests (T5-D6)

## Setup

```bash
# Fixture: published open-code exam with code LOAD01
# (auto-promoted from the analytics fixture in dev)

# k6 binary (one-time)
curl -fsSL -o /tmp/k6.zip "https://github.com/grafana/k6/releases/download/v0.54.0/k6-v0.54.0-macos-arm64.zip"
unzip -o /tmp/k6.zip -d /tmp
alias k6=/tmp/k6-v0.54.0-macos-arm64/k6
```

## Smoke (dev, 100 VU / 20s)

```bash
k6 run scripts/loadtest/exam-claim-page.k6.js \
  -e BASE=http://localhost:3000 -e CODE=LOAD01 --vus 100 --duration 20s
```

## Target (prod build, 500 VU / 30s)

```bash
pnpm --filter @feedbackme/web build && pnpm --filter @feedbackme/web start -p 3001 &
k6 run scripts/loadtest/exam-claim-page.k6.js \
  -e BASE=http://localhost:3001 -e CODE=LOAD01 --vus 500 --duration 30s
```

Threshold: `http_req_duration p(95) < 300ms`, `http_req_failed rate < 1%`.

## Captured dev numbers (T5-D6, 2026-05-13)

Next.js dev mode — per-request compilation overhead, not a real perf baseline.

| VU  | Duration | iters | p95 dur  | failed |
|---:|---:|---:|---:|---:|
| 100 | 20s | 2310 | 1.04s | 0% |
| 500 | 20s | 3144 | 7.28s | 1.74% |

Dev mode is ~10–20× slower than prod due to on-demand bundling and React dev
checks. Prod-build target (`p95 < 300ms`) must be re-verified against the
Docker stack on server 224 once deployed — capture there and update this
table.
