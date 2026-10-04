# Chụp ảnh giao diện cho khoá "Hướng dẫn sử dụng Limio"

Ảnh trong bài là **ảnh chụp thật** từ ứng dụng đang chạy, kèm vòng số đánh dấu. Khi giao diện đổi, chụp lại
bằng bộ công cụ này thay vì chụp tay.

## Cách chạy

```bash
# 1. dev DB + web đang chạy (docker compose của checkout gốc; web ở http://localhost:3000)
# 2. dữ liệu giả (chỉ cần một lần, chạy lại không tạo trùng)
cd packages/db && DEMO_PASSWORD='...' pnpm exec tsx src/seed-demo-instructor.ts
cd packages/core-lms && DEMO_PASSWORD='...' node --env-file=../db/.env --import tsx scripts/seed-demo-course.ts
# 3. chụp (giảng viên mẫu dùng mật khẩu dev dùng chung của màn hình đăng nhập; học viên mẫu dùng DEMO_PASSWORD)
DEMO_PASSWORD='...' docs/hoc-lieu/huong-dan-limio/capture/run.sh 1-2-bieu-mau-tao-khoa 4-1-han-theo-lop
```

Không có tên ảnh thì chụp tất cả ảnh khai báo trong `shots.mjs`. Ảnh ghi vào `apps/web/public/huong-dan-limio/`.
Đặt `OUT_DIR=<thư mục>` để ghi chỗ khác (dùng cho thăm dò, ví dụ `xu:/đường/dẫn` hay `xc:<tên tab>`).

## Thành phần

- `shoot.mjs` — điều khiển Chrome đã cài sẵn qua giao thức gỡ lỗi (không tải thêm gì): đăng nhập, mở trang,
  vẽ số lên phần tử (`marks`), chụp vùng, đổi chữ `localhost` thành tên miền giả (`rewrite`).
- `shots.mjs` — cách chụp từng ảnh. Tên khoá = tên ảnh trong `shot(name, …)` của bài; mảng `marks` ở đây quyết định
  số 1, 2, 3… trỏ vào đâu và **`legend([...])` trong bài phải khớp đúng thứ tự đó**.
- `run.sh` — chạy một lượt có giới hạn thời gian và dọn Chrome còn sót.

## Lưu ý đã trả giá

- Chỉ chụp bằng tài khoản **mẫu** (`giangvien.mau@…`, `sv.demo.NN@…`). Ảnh sẽ công khai, đừng chụp dữ liệu người thật.
- Máy thiếu RAM thì Chrome rất chậm; đừng chụp trang quá dài ở khung cao hàng nghìn px.
- Chrome headless từng treo mọi trang http cho tới khi thoát hẳn Chrome (Cmd+Q) rồi chạy lại.
- Menu chuột phải của ghi chú chỉ mở khi bắn `contextmenu` thẳng lên `document` (xem `selectAndRightClick`).
- Nhãn tiếng Anh còn trên giao diện (Publish, Assignment, Quiz, Forum Q&A, Level, Category…) sẽ hiện trong ảnh.
  Khi giao diện được đổi sang tiếng Việt thì chụp lại.
