# Góp ý qua Feedback Hub

Limio có thể dùng **Feedback Hub** (https://github.com/Lampx83/FeedbackHub) làm hộp góp ý: nút "Góp ý" nổi ở góc dưới-trái cho người đã đăng nhập, góp ý về hub để đội phát triển đọc, trả lời và theo dõi. Mặc định **TẮT** — không đặt biến môi trường thì trang chạy y như trước.

## Bật

1. Dựng hub (docker compose, xem README của Feedback Hub) rồi tạo dự án `limio` từ [`feedback-hub.project.json`](feedback-hub.project.json). Dự án đặt `mode: collect` (chỉ thu nhận, **không** cho AI tự sửa mã) và `deliver: branch`:
   ```bash
   HUB_URL=https://<hub> HUB_ADMIN_EMAIL=… HUB_ADMIN_PASSWORD=… \
     node scripts/setup-project.mjs docs/feedback-hub.project.json --print-secret
   ```
   (script nằm trong repo Feedback Hub). Lệnh in **khoá ký token** — lưu vào kho bí mật.
2. Thêm vào `.env.prod` (đã có dòng trống trong `.env.prod.example`; compose truyền sẵn vào container web):
   ```
   FEEDBACK_HUB_URL=https://<hub>
   FEEDBACK_HUB_PROJECT=limio
   FEEDBACK_HUB_SECRET=<khoá ký token>
   ```
3. Tạo lại container web (`docker compose up -d web`). Không cần build lại image — các biến đọc lúc chạy.

## Hành vi

- Chỉ người **đã đăng nhập** thấy nút. Khách vãng lai không thấy (hub đặt `anonymousSubmit=false`).
- **Ẩn khi làm bài thi** (`/thi`, `/exam-take`, `/play`, `/join`) để không xao nhãng thí sinh.
- Khi admin đang "đăng nhập thay" một học viên, góp ý vẫn đứng tên **admin thật**, không phải học viên.
- Quyền **quản trị dự án trên hub** lấy từ `isAdmin()` trong DB lúc cấp token (không tin vai trò trong JWT). Các vai trò khác là người gửi thường, chỉ thấy góp ý của mình.
- Token HS256 sống 10 phút, ký ở máy chủ; khoá ký không bao giờ xuống trình duyệt.

## Tắt / quay lại

Bỏ `FEEDBACK_HUB_URL` hoặc `FEEDBACK_HUB_SECRET` rồi tạo lại container: nút biến mất, route `/api/feedback-token` trả 404. Không có dữ liệu nào của Limio bị đụng tới.

## Mã liên quan

- `apps/web/src/lib/feedback-hub.ts` — cấu hình, ký token, danh sách trang thi.
- `apps/web/src/app/api/feedback-token/route.ts` — cấp token cho người đã đăng nhập.
- `apps/web/src/components/FeedbackHubWidget.tsx` — nạp `widget.js`, ẩn nút ở trang thi.
- `apps/web/src/app/layout.tsx` — quyết định hiện widget.

## Muốn AI xử lý góp ý?

Đổi `mode` sang `execute` trên hub và chạy worker của Feedback Hub trên máy có bản làm việc của Limio — xem README của hub. Với Limio (có thi trực tuyến, dữ liệu học viên) nên giữ `deliver: branch` để người duyệt rồi mới triển khai.
