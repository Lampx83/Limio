# Cổng thanh toán SePay (Payment Gateway) — Acceptance criteria

> Bản nháp 25/11/2026. **Chưa thử với sandbox SePay thật** (thầy/cô có môi trường sandbox: Merchant ID dạng `SP-TEST-…`). Cùng khuôn `thanh-toan-vnpay.md`: đơn `pending` → trình duyệt POST form đã ký sang trang thanh toán của SePay → SePay gọi IPN → cấp quyền. Khác với `thanh-toan-sepay.md` (webhook biến động số dư, khoá API tự đặt): đây là cổng có Merchant ID + Secret Key.
> Nguồn: `developer.sepay.vn/vi/cong-thanh-toan` (bắt đầu, luồng thanh toán, sandbox, IPN) và mã ký trong hai SDK chính thức `sepay-pg-node` 1.0.0, `sepayvn/sepay-pg-php` 1.0.0 (đọc 25/11/2026).

## Phạm vi

- **Có:** tạo đơn và form khởi tạo đã ký, IPN, trang quay về, cấu hình ở Admin → Tích hợp, nút "Thanh toán qua SePay (QR, thẻ)" ở trang khoá (gói) và trang combo. Dùng cho khoá có gói truy cập và combo; chỉ VND.
- **Chưa làm (ghi rõ):** hoàn tiền / huỷ giao dịch qua API (`TRANSACTION_VOID` bị bỏ qua, admin xử lý tay); truy vấn trạng thái đơn qua REST API; thanh toán định kỳ; xác thực chữ ký của redirect.
- Không đổi hành vi Stripe, VNPay, chuyển khoản SePay (webhook), mã kích hoạt.

## AC1 — Cấu hình

- Khoá tích hợp: `sepaypg.merchant_id`, `sepaypg.secret_key` (SePay chỉ hiện một lần), `sepaypg.ipn_secret` (tự đặt, khai cùng ở my.sepay.vn → Cấu hình IPN → xác thực SECRET_KEY), `sepaypg.env` (`sandbox` | `production`; **trống = sandbox**).
- **Given** đủ ba khoá đầu, **Then** "sepay_pg" nằm trong cổng đã cấu hình và nút thanh toán hiện. Thiếu một → không hiện, không báo lỗi.
- Sandbox và production có hai bộ Merchant ID/Secret Key riêng; địa chỉ khởi tạo: `https://pay-sandbox.sepay.vn/v1/checkout/init` và `https://pay.sepay.vn/v1/checkout/init`.
- Secret Key và khoá IPN không bao giờ xuất hiện trong URL, log, phản hồi hay trang người mua.

## AC2 — Tạo thanh toán

- **Given** học viên đăng nhập, gói (hoặc combo) đang bán, VND, cổng đã cấu hình, **When** bấm "Thanh toán qua SePay", **Then** tạo `Order` `pending` (`provider = sepay_pg`, `amountCents` = số đồng, `providerRef` = mã hoá đơn `LM` + 10 ký tự, duy nhất) và trả `{ url, fields }`: danh sách trường **có thứ tự** để trình duyệt POST (`application/x-www-form-urlencoded`): `merchant, operation=PURCHASE, order_amount, currency=VND, order_invoice_number, order_description, success_url, error_url, cancel_url, signature`. Mỗi lần bấm là một đơn mới.
- **Chữ ký** (khớp mã hai SDK chính thức): lấy các trường được ký **theo đúng thứ tự trong form**, bỏ trường rỗng, nối `tên=giá trị` bằng dấu phẩy, HMAC-SHA256 với Secret Key, mã hoá **base64**; `signature` đặt cuối và không tự ký.
- **Given** gói không thuộc khoá/đã ẩn, khoá hoặc combo chưa xuất bản, không phải VND, cổng chưa cấu hình, **Then** từ chối (400/503), không tạo đơn. Chưa đăng nhập → 401.

## AC3 — IPN

SePay POST JSON tới `/api/webhooks/sepaypg`; header `X-Secret-Key` mang khoá IPN; chờ HTTP 200. IPN là đường **duy nhất** cấp quyền.

- **Given** thiếu/sai `X-Secret-Key` (so sánh thời gian không đổi) → 401, không đụng DB. Chưa cấu hình → 503. Thân không đọc được hoặc thiếu trường → 400.
- **Given** `notification_type = ORDER_PAID`, `order.order_status = CAPTURED` (và `transaction_status = APPROVED` nếu có), mã hoá đơn khớp một đơn `sepay_pg` `pending/failed`, số tiền (`order_amount`, chuỗi như `"199000.00"`) bằng số tiền đơn → đơn `paid` + `paidAt`, mã giao dịch lưu `gatewayTxnRef`, cấp quyền đúng đường cũ (`extendEnrollmentAccess` / `grantBundleAccess`). Trả 200.
- **Given** số tiền lệch, đơn lạ, đơn đã `paid`/`refunded` → không đổi gì, vẫn trả 200 (không để SePay gửi lại vô ích). Gửi lại cùng IPN chỉ cấp một lần.
- **Given** `TRANSACTION_VOID`, hoặc trạng thái khác `CAPTURED`/`APPROVED` → bỏ qua, 200, không cấp quyền.
- Lỗi tạm thời khi cấp quyền → 500 (SePay gửi lại; chính sách gửi lại **không có trong tài liệu**).

## AC4 — Trang quay về

- `success_url` / `error_url` / `cancel_url` trỏ `/api/payments/sepaypg/return?order=<id>&status=success|error|cancel`. Trang **chỉ chuyển hướng**: thành công → khoá (hoặc `/me` với combo), lỗi/huỷ → trang khoá/combo. Không bao giờ đổi đơn hay cấp quyền ở đây. IPN có thể đến sau vài giây: nếu vào khoá ngay mà chưa thấy quyền, tải lại.

## AC5 — Điều chưa kiểm chứng (cần thử sandbox)

- Thứ tự trường ký: theo tài liệu và SDK thì ký đúng thứ tự trong form; nếu sandbox báo sai chữ ký, đổi thứ tự trong `buildSepayPgCheckout` (một chỗ).
- Phương thức thanh toán hiện ở trang SePay tuỳ phương thức merchant đã bật (`payment_method` để trống).
- Chạy thật (production) cần kích hoạt tài khoản merchant thật; VietQR kích hoạt online, QR NAPAS và thẻ cần hồ sơ (theo tài liệu SePay).
