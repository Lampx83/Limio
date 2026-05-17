# Hướng dẫn deploy Tintin lên server 224

> Gửi cho admin server 224. Mục tiêu: deploy bản tối ưu Tintin để hệ thống chịu được 5000 SV thi đồng thời.

## 0. Bối cảnh trong 30 giây

Code mới đổi 4 thứ lớn:
- Scale web container **1 → 3 replica** (thêm Caddy LB internal đứng trước).
- Thêm **BullMQ auto-grade worker** — chấm điểm chạy async sau submit (không block request).
- Bump PgBouncer pool và Prisma `connection_limit`.
- exam-live-bus + rate-limit chuyển sang Redis (multi-replica safe).

Yêu cầu: phải có 2 biến môi trường mới trong `.env.prod`.

## 1. Trước khi anh deploy — kiểm tra PR đã merge

PR sẽ được merge vào `main` qua GitHub UI bởi người chịu trách nhiệm code (không phải anh).

Sau khi PR merge → GitHub Actions workflow `deploy.yml` sẽ **TỰ ĐỘNG** chạy trên self-hosted runner của 224.

→ Anh chỉ cần làm 1 việc thủ công **TRƯỚC** khi push merge: thêm 2 dòng env. Xem bước 2.

## 2. Thêm 2 dòng vào `.env.prod` (BẮT BUỘC)

```bash
sudo nano /etc/feedbackme/.env.prod
```

Thêm vào cuối file (hoặc bất kỳ chỗ nào):

```bash
# Tintin — số web replica chạy sau Caddy LB. 3 đủ cho 5000 SV thi đồng thời.
WEB_REPLICAS=3

# Tintin — BullMQ auto-grade worker concurrency. 10 an toàn với pool 50.
AUTO_GRADE_CONCURRENCY=10
```

Lưu file (`Ctrl+O`, `Enter`, `Ctrl+X`).

Verify đã đúng:
```bash
sudo grep -E "WEB_REPLICAS|AUTO_GRADE_CONCURRENCY" /etc/feedbackme/.env.prod
```

Phải thấy đúng 2 dòng anh vừa thêm.

## 3. Trigger deploy

Có 2 cách:

**Cách A (khuyến nghị) — chờ PR merge tự deploy:**
- Người code bấm merge PR trên GitHub → workflow tự chạy → anh chỉ cần xem log.
- Theo dõi: https://github.com/Lampx83/FeedBackMe/actions

**Cách B — deploy thủ công ngay từ branch `Tintin`** (nếu cần test trước khi merge):
```bash
cd /opt/feedbackme   # hoặc đường dẫn repo trên 224
git fetch origin
git checkout Tintin
git pull origin Tintin

ENV=/etc/feedbackme/.env.prod
COMPOSE="docker compose --env-file $ENV -f docker-compose.prod.yml"

WEB_REPLICAS=3 $COMPOSE build --pull
$COMPOSE run --rm migrate
WEB_REPLICAS=3 $COMPOSE up -d --remove-orphans --scale web=3 \
  postgres redis pgbouncer web web-proxy worker cron
```

## 4. Verify sau khi deploy xong (5 phút)

### 4.1. Container đều healthy

```bash
docker compose --env-file /etc/feedbackme/.env.prod -f docker-compose.prod.yml ps
```

Phải thấy đủ:
- `postgres` (healthy)
- `redis` (healthy)
- `pgbouncer` (healthy)
- `web` **× 3 instance** (đều healthy)
- `web-proxy` (healthy) — Caddy LB **mới**
- `worker` (running) — **mới**
- `cron` (running)

Nếu thấy `web × 1` thay vì 3 → biến `WEB_REPLICAS` chưa được load, kiểm tra lại bước 2.

### 4.2. Caddy LB nghe đúng port

```bash
curl -fsS http://127.0.0.1:8004/caddy-healthz && echo OK
```

Phải in `OK`. Reverse proxy ngoài host (Caddy/Nginx của 224) vẫn trỏ vào `127.0.0.1:8004` như cũ — **không phải đổi gì**.

### 4.3. Web replica trả request OK

```bash
curl -fsS -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:8004/
```

Phải in `HTTP 200`.

### 4.4. Worker đã subscribe queue auto-grade

```bash
docker compose --env-file /etc/feedbackme/.env.prod -f docker-compose.prod.yml logs worker | tail -20
```

Phải thấy 2 dòng:
```
[worker:realtime-publish] ready (concurrency=50)
[worker:auto-grade] ready (concurrency=10)
```

### 4.5. PgBouncer pool đã bump

```bash
docker compose --env-file /etc/feedbackme/.env.prod -f docker-compose.prod.yml exec pgbouncer \
  psql -h 127.0.0.1 -p 6432 -U feedbackme pgbouncer -c "SHOW CONFIG;" 2>/dev/null | \
  grep -E "max_client_conn|default_pool_size|reserve_pool_size"
```

Phải thấy `max_client_conn = 3000`, `default_pool_size = 50`, `reserve_pool_size = 10`.

(Nếu lệnh `psql` hỏi password thì dùng `POSTGRES_PASSWORD` từ `.env.prod`.)

## 5. Nếu có sự cố — rollback

```bash
cd /opt/feedbackme
git log --oneline -3   # tìm SHA commit cũ ngay trước Tintin
IMAGE_TAG=<sha-cũ> docker compose --env-file /etc/feedbackme/.env.prod \
  -f docker-compose.prod.yml up -d web web-proxy worker
```

(Image cũ phải còn trên local — đừng `docker image prune` ngay sau deploy.)

Nếu muốn về hẳn topology 1 web (như trước Tintin):
```bash
docker compose --env-file /etc/feedbackme/.env.prod -f docker-compose.prod.yml \
  up -d --scale web=1 --remove-orphans \
  postgres redis pgbouncer web worker cron
docker compose --env-file /etc/feedbackme/.env.prod -f docker-compose.prod.yml stop web-proxy
```

→ Sau đó **phải đổi reverse proxy ngoài host** trỏ về `127.0.0.1:3000` của web container thay vì 8004 (Caddy đã stop).

## 6. Theo dõi trong ngày thi

```bash
# RAM/CPU mọi container
docker stats $(docker compose --env-file /etc/feedbackme/.env.prod -f docker-compose.prod.yml ps -q)

# PgBouncer xem có nghẽn không
docker compose --env-file /etc/feedbackme/.env.prod -f docker-compose.prod.yml exec pgbouncer \
  psql -h 127.0.0.1 -p 6432 -U feedbackme pgbouncer -c "SHOW POOLS;"
# → cột cl_waiting nên = 0 hầu hết thời gian

# Redis xem có nóng không
docker compose --env-file /etc/feedbackme/.env.prod -f docker-compose.prod.yml exec redis \
  redis-cli --stat

# Queue auto-grade — nếu sau submit storm mà depth tăng mãi không drain → tăng AUTO_GRADE_CONCURRENCY
docker compose --env-file /etc/feedbackme/.env.prod -f docker-compose.prod.yml exec redis \
  redis-cli ZCARD bull:auto-grade:wait
```

## 7. Liên hệ nếu kẹt

Báo lại cho [TÊN NGƯỜI CHỊU TRÁCH NHIỆM CODE] kèm:
1. Log container nào failing: `docker compose ... logs <service> --tail=200`
2. Output của `docker compose ... ps`
3. Bước nào ở mục 4 đang fail.

---

**TL;DR cho admin nhanh nhất**:
1. Thêm 2 dòng `WEB_REPLICAS=3` + `AUTO_GRADE_CONCURRENCY=10` vào `/etc/feedbackme/.env.prod`.
2. Chờ workflow GitHub Actions chạy xong (sau khi PR merge).
3. `docker compose ps` thấy 3 web + 1 web-proxy + 1 worker đều healthy = xong.
