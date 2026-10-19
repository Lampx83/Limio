# GlitchTip — nhận lỗi production của Limio

GlitchTip là phần mềm mã nguồn mở, nhận được dữ liệu từ Sentry SDK. Code Limio
(`@sentry/nextjs` trong `apps/web`) giữ nguyên, chỉ cần trỏ `SENTRY_DSN` về đây.
GlitchTip chạy trên **server 224**, dữ liệu lỗi không rời máy chủ của trường.
Server HUST cũng gửi lỗi về đây, mỗi server một project riêng.

Stack này **độc lập** với `docker-compose.prod.yml`: deploy app không đụng tới
GlitchTip. Nếu GlitchTip sập, app vẫn chạy bình thường (SDK chỉ bỏ qua lượt gửi
lỗi). Dung lượng: khoảng 0,5–1 GB RAM. Lỗi được giữ 30 ngày.

## Cài lần đầu (server 224)

1. **DNS**: tạo bản ghi `glitchtip.limio.vn` trỏ về IP server 224. Tên miền khác
   cũng được, nhưng phải khớp với `GLITCHTIP_HOSTNAME`.

2. **Env file**:
   ```bash
   sudo install -d -m 750 /etc/glitchtip
   sudo cp docker/glitchtip/.env.example /etc/glitchtip/.env
   sudo chmod 600 /etc/glitchtip/.env
   # điền GLITCHTIP_SECRET_KEY (openssl rand -hex 32)
   #      GLITCHTIP_POSTGRES_PASSWORD (openssl rand -hex 24)
   # kiểm tra cổng 8010 còn trống: ss -ltn | grep 8010
   ```

3. **Chạy**: nên copy file compose ra chỗ cố định, không chạy trong thư mục làm
   việc của runner (thư mục đó đổi theo mỗi lần checkout).
   ```bash
   sudo install -d /home/codelab/services/glitchtip
   cp docker/glitchtip/compose.yml /home/codelab/services/glitchtip/
   cd /home/codelab/services/glitchtip
   GT="docker compose -f compose.yml --env-file /etc/glitchtip/.env"
   $GT up -d
   $GT ps          # web chuyển "healthy" sau ~1–2 phút (lần đầu phải migrate)
   ```

4. **Reverse proxy** (chung chỗ với proxy đang phục vụ `limio.vn`), cho TLS:
   - Caddy:
     ```
     glitchtip.limio.vn {
         reverse_proxy 127.0.0.1:8010
     }
     ```
   - Nginx: `server_name glitchtip.limio.vn;` + `proxy_pass http://127.0.0.1:8010;`
     + `proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme;`
     + `client_max_body_size 20m;` (event kèm stack trace có thể lớn).

5. **Tạo tài khoản admin.** Đăng ký công khai đã bị tắt.
   ```bash
   $GT exec web ./manage.py createsuperuser
   ```

6. **Tạo project**: đăng nhập `https://glitchtip.limio.vn` → tạo Organization
   `Limio` → tạo 2 project (platform **Next.js**):
   - `limio-224` (limio.vn)
   - `limio-hust` (limio.hust.edu.vn)

   Mỗi project có 1 DSN, tìm trong Settings → Client Keys (DSN).

7. **Cảnh báo**: trong mỗi project → Alerts → thêm recipient Webhook (Slack /
   Discord / Google Chat) hoặc Email. Có thể dùng chung kênh với
   `ALERT_WEBHOOK_URL` của cron/backup.

## Nối Limio vào (làm trên CẢ HAI server)

1. Điền DSN của đúng project vào `/etc/feedbackme/.env.prod`:
   ```
   SENTRY_DSN=https://<key>@glitchtip.limio.vn/<project-id>
   ```
2. **Deploy lại** (push `main` hoặc chạy lại workflow Deploy). Không chỉ
   restart: DSN phía trình duyệt được nhúng vào bản build, nên phải build lại image.
   Biến này dùng chung cho web, worker và trình duyệt.

3. Kiểm tra đường đi. Chạy **trên từng server** để chắc server đó gọi tới được
   GlitchTip:
   ```bash
   curl -sS -X POST "https://glitchtip.limio.vn/api/<project-id>/store/" \
     -H "X-Sentry-Auth: Sentry sentry_version=7, sentry_key=<key>" \
     -H "Content-Type: application/json" \
     -d '{"message":"Limio: test kết nối GlitchTip","level":"info"}'
   ```
   Trả về `{"id":"..."}`, và event hiện trong project → đã thông.

## Vận hành

```bash
$GT logs -f web                 # xem log
$GT pull && $GT up -d           # nâng cấp (đổi tag image trong compose.yml trước)
```

- **Nâng cấp**: sửa tag `glitchtip/glitchtip:<version>` trong `compose.yml`,
  đọc changelog. Không dùng `latest`.
- **Backup**: không bắt buộc. Lỗi chỉ giữ 30 ngày, mất thì cũng không ảnh hưởng
  dữ liệu học tập. Volume `glitchtip_glitchtip-pg` **không** nằm trong
  `feedbackme-backup.sh`.
- **Source map**: chưa upload, nên stack trace phía trình duyệt còn là code đã
  minify. Muốn đọc được thì cần thêm `SENTRY_AUTH_TOKEN` + `SENTRY_URL`
  (trỏ GlitchTip) lúc build. Hiện chưa làm.
