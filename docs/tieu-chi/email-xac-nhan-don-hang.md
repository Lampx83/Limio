# Email xác nhận đơn hàng và kích hoạt mã — Acceptance criteria

> Bản nháp 25/11/2026. Trước đây thanh toán xong chỉ cấp quyền, không gửi email nào (email chào mừng chỉ có ở đường ghi danh trực tiếp). Người mua tiền thật cần một biên nhận để lưu, và email là cách chắc nhất để họ biết đơn đã thành công khi trang thanh toán bị đóng giữa chừng. Người gửi: địa chỉ gửi mặc định của Limio (cùng email xác thực tài khoản).

## AC1 — Xác nhận đơn hàng (đã thanh toán)

- **Given** đơn chuyển `pending/failed → paid` qua `settleGatewayPayment` (VNPay IPN, SePay cổng thanh toán, SePay chuyển khoản) và caller truyền `baseUrl`, **Then** sau khi cấp quyền xong, gửi **một** email `order.confirmation` tới email người mua gồm: lời cảm ơn; mã đơn hàng (`providerRef`); nội dung (tên khoá, hoặc "tên combo (n khoá)"); số tiền; hình thức thanh toán; thời điểm (giờ Việt Nam); **Hạn sử dụng** ("dd/mm/yyyy" theo hạn SỚM nhất của các khoá, hoặc "Không giới hạn thời gian"); nút **Vào học** (khoá lẻ → `/learn/<slug>`; combo → `/me`).
- **Given** IPN gửi lại (đơn đã `paid`), số tiền lệch, thanh toán thất bại, hoặc đơn không tồn tại, **Then** không gửi thêm email.
- **Given** gửi email lỗi (nhà cung cấp, mạng) hoặc đơn thiếu email người dùng, **Then** việc cấp quyền và phản hồi cho cổng thanh toán **không bị ảnh hưởng** (lỗi ghi log `[purchase-email]`, không throw, không bắt cổng gửi lại).
- Email không chứa dữ liệu thẻ hay tài khoản ngân hàng.

## AC2 — Kích hoạt bằng mã

- **Given** người học đổi mã khoá hoặc mã combo thành công và mã bị tiêu (`codeConsumed`), **Then** gửi **một** email `course.activated`: "Kích hoạt thành công", nội dung đã kích hoạt, hạn sử dụng, nút **Vào học**. **Không** in lại mã, **không** có số tiền.
- Đổi mã khoá không còn gửi thêm email chào mừng (`course.welcome`) để người học không nhận hai thư cho một việc.
- Bấm lại mã đã đổi của chính mình (không tiêu thêm), mã sai/đã dùng/thu hồi → không gửi.

## AC3 — Quản trị nội dung

- Hai mẫu `order.confirmation` và `course.activated` có sẵn trong mã (production bảng `EmailTemplate` đang trống, dùng bản dựng sẵn) và trong seed (`seed-email-templates.ts`) để admin sửa chữ ở trang quản lý mẫu email; mọi biến có ví dụ.

## Chưa làm

- Email hoàn tiền; email thanh toán thất bại; thanh toán Stripe (không dùng ở thị trường này, đường Stripe chưa gắn hook); hoá đơn VAT.

## Cách kiểm

- Test core-lms (`learning/__tests__/purchaseEmail.test.ts`): gửi đúng một lần, IPN gửi lại không gửi thêm, không có baseUrl / sai số tiền / thất bại → không gửi, email lỗi không hỏng cấp quyền, email kích hoạt không chứa mã, định dạng tiền và hạn.
- `email/__tests__/templates.test.ts`: hai mẫu render được khi DB rỗng và được bọc khung thương hiệu.
- Thử thật: một đơn nhỏ trên Production, kiểm hộp thư.
