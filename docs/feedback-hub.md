# Góp ý qua Feedback Hub

Limio có thể dùng **Feedback Hub** (https://github.com/Lampx83/FeedbackHub) làm hộp góp ý: nút "Góp ý" nổi ở góc dưới-trái cho người đã đăng nhập, góp ý về hub để đội phát triển đọc, trả lời và theo dõi. Mặc định **TẮT** — không đặt biến môi trường thì trang chạy y như trước.

## Bật

1. Dựng hub (docker compose, xem README của Feedback Hub) rồi tạo dự án `limio` từ [`feedback-hub.project.json`](feedback-hub.project.json). Dự án đặt `mode: collect` (chỉ thu nhận, **không** cho AI tự sửa mã) và `deliver: branch`:
   ```bash
   HUB_URL=https://<hub> HUB_ADMIN_EMAIL=… HUB_ADMIN_PASSWORD=… \
     node scripts/setup-project.mjs docs/feedback-hub.project.json --print-secret
   ```
   (script nằm trong repo Feedback Hub). Lệnh in **khoá ký token** — lưu vào kho bí mật.
2. Thêm vào `.env.prod` (`docker-compose.prod.yml` đã truyền sẵn vào container web):
   ```
   FEEDBACK_HUB_URL=https://<hub>
   FEEDBACK_HUB_PROJECT=limio
   FEEDBACK_HUB_SECRET=<khoá ký token>
   ```
3. Tạo lại container web (`docker compose up -d web`). Không cần build lại image — các biến đọc lúc chạy.

## Hành vi

- Chỉ người **đã đăng nhập** thấy ba lối vào hộp góp ý. **Không có nút nổi**: các góc màn hình của Limio đã kín nút mở menu và thanh CTA di động.
  - **Biểu tượng 💡 trên header**, cạnh chuông thông báo — widget của hub tự vẽ vào `<span data-feedbackhub-launcher hidden />` trong `AppHeader.tsx` (một dòng), cùng màu với các biểu tượng khác, có số góp ý đang chờ người dùng trả lời.
  - **Bôi đen chữ trong bài học** (hoặc bấm đúp một từ) → menu của Limio hiện ngay dưới đoạn chọn, có mục **"Góp ý đoạn này"** cạnh "Viết annotation" và "Hỏi AI về đoạn này" (`LessonAnnotations.tsx` gọi `FeedbackHub.open()`; widget nhớ đoạn bôi đen gần nhất tối đa 2 phút và đưa vào hộp góp ý). Bong bóng "✏️ Góp ý đoạn này" riêng của hub **phải tắt** ở hub (`features.textSelection: false`), kẻo hai nút chồng nhau.
  - Mục **"Góp ý cho Limio"** trong menu người dùng (góc phải header).
- Cả ba ẩn ở trang làm bài thi (`/thi`, `/exam-take`, `/play`, `/join`); nút header và bong bóng ẩn thêm ở lớp học tương tác và Limio-Live. Danh sách này nằm ở `features.hidePaths` của dự án trên hub (sửa ở bảng điều khiển hub hoặc `feedback-hub.project.json`), không phải trong mã Limio.
- Mỗi góp ý tự kèm ngữ cảnh: đường dẫn, `contentRef` (`lesson:<id>`, `course:<slug>`, `thread:<id>`), khoá học, vai trò đang dùng và cỡ màn hình (`extra`) — người đọc không phải hỏi lại "bài nào, máy nào".
- **Ảnh chụp trang** là tuỳ chọn, **mặc định không đính kèm**: người gửi tự tick "Đính kèm ảnh chụp trang này" và xem trước được (tệp `trang-chup.png`; cấu hình `screenshot: "optional"` trong `feedback-hub.project.json`). Ô mật khẩu luôn bị che. Trang nào hiện dữ liệu nhạy cảm của người khác (bảng điểm, danh sách lớp) thì thêm `data-feedbackhub-mask` vào vùng đó để che trong ảnh.
- Khi admin đang "đăng nhập thay" một học viên, góp ý vẫn đứng tên **admin thật**.
- Quyền **quản trị dự án trên hub** lấy từ `isAdmin()` trong DB lúc cấp token. Vai trò khác chỉ thấy góp ý của mình.
- Token HS256 sống 10 phút, ký ở máy chủ; khoá ký không bao giờ xuống trình duyệt.

## Đọc góp ý (người và AI)

Góp ý nằm ở hub. Chủ dự án xem ở bảng điều khiển hub, hoặc admin Limio bấm 💡 trên header. Để **AI/dòng lệnh** đọc: cấp một **khoá chỉ đọc** (hub → dự án `limio` → *Khoá & nhúng* → *Khoá chỉ đọc*; chỉ đọc được dự án này, không ghi được gì), rồi trên mỗi máy chạy một lần `node scripts/feedback.mjs setup`. Sau đó mọi AI/tài khoản trên máy đó dùng chung: `node scripts/feedback.mjs list | show <id> | attachment <id> <aid>`. Khoá lưu ở `~/.config/feedbackhub/key` (quyền 600), không nằm trong repo. Thu hồi khoá ngay trên hub nếu lộ.

## Tắt / quay lại

Bỏ `FEEDBACK_HUB_URL` hoặc `FEEDBACK_HUB_SECRET` rồi tạo lại container: nút biến mất, route `/api/feedback-token` trả 404. Không có dữ liệu nào của Limio bị đụng tới.

## Mã liên quan (tệp có sẵn chỉ sửa 8 dòng)

Sửa trong tệp có sẵn: `app/layout.tsx` (+2: import và `<FeedbackHub />`), `components/UserMenu.tsx` (+2: import và `<FeedbackMenuItem />`), `docker-compose.prod.yml` (+4: truyền biến).

Tệp mới:
- `lib/feedback-hub.ts` — cấu hình, ký token (chỉ máy chủ).
- `lib/feedback-hub-paths.ts` — phần dùng được ở trình duyệt: trang thi, ngữ cảnh góp ý.
- `app/api/feedback-token/route.ts` — cấp token cho người đã đăng nhập.
- `components/FeedbackHub.tsx` (máy chủ, quyết định hiện hay không), `FeedbackHubWidget.tsx` (nạp `widget.js`), `FeedbackMenuItem.tsx` (mục menu).

## Muốn AI xử lý góp ý?

Đổi `mode` sang `execute` trên hub và chạy worker của Feedback Hub trên máy có bản làm việc của Limio — xem README của hub. Với Limio (có thi trực tuyến, dữ liệu học viên) nên giữ `deliver: branch` để người duyệt rồi mới triển khai.

## Đọc góp ý (dành cho người và AI lập trình)

Xem [feedback-doc-gop-y.md](feedback-doc-gop-y.md): cấp khoá chỉ đọc, `node scripts/feedback.mjs setup`, các lệnh đọc.
