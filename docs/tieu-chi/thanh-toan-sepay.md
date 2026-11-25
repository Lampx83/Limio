# Thanh toán chuyển khoản tự động qua SePay — Acceptance criteria

> Bản nháp 25/11/2026. **Chưa thử với tài khoản SePay thật** (cần thầy/cô tạo tài khoản SePay, gắn ngân hàng, đặt webhook và nhập khoá ở Admin → Tích hợp). Tiếp nối `thanh-toan-vnpay.md` (cùng khuôn: đơn `pending` → cổng báo → cấp quyền) và `combo-khoa-hoc.md` (AC8: bán bằng mã khi chưa có cổng).
> Đặc tả SePay đọc ngày 25/11/2026 ở `docs.sepay.vn/tich-hop-webhooks.html`: webhook POST JSON, xác thực bằng header `Authorization: Apikey <khoá>`, phải trả HTTP 200/201 kèm `{"success": true}`, chống trùng theo `id` giao dịch, gửi lại tối đa 7 lần trong khoảng 33 phút. Những điều chưa đọc được (cách tính HMAC, quy ước trường `code`, địa chỉ ảnh QR chính xác) được thiết kế để **không phụ thuộc**: khớp đơn bằng nội dung chuyển khoản, URL ảnh QR đặt được trong cài đặt.

## Vì sao làm

Chưa có pháp nhân nên chưa đăng ký được VNPay. SePay đọc biến động số dư tài khoản ngân hàng và báo về hệ thống: người mua quét mã VietQR (đã điền sẵn số tiền và nội dung), tiền về là tự cấp quyền, không cần gửi mã bằng tay.

## Phạm vi

- **Có:** tạo đơn chuyển khoản (khoá có gói hoặc combo), hiện QR + thông tin chuyển khoản, nhận webhook SePay, tự cấp quyền, nhật ký giao dịch ngân hàng để đối soát tay, cấu hình ở Admin → Tích hợp, tự cập nhật trạng thái trên trang người mua.
- **Chưa làm (ghi rõ):** xác thực HMAC (đợt này dùng API Key, hợp với tài liệu); hoàn tiền tự động (hoàn bằng tay như VNPay); đối soát bằng API giao dịch của SePay; trang admin xem nhật ký (đợt này xem trong bảng `BankTransaction`); giao dịch chuyển thiếu/thừa tự xử lý (thừa chấp nhận, thiếu để admin xử lý).
- **Chỉ VND, chỉ tiền vào** (`transferType = "in"`).
- Không đổi hành vi Stripe, VNPay, mã kích hoạt.

## AC1 — Cấu hình

- Khoá tích hợp: `sepay.api_key` (bí mật, trùng với khoá khai ở SePay), `sepay.account_number`, `sepay.bank` (mã/tên ngân hàng dùng cho ảnh QR), `sepay.account_holder` (tên hiển thị, tuỳ chọn), `sepay.qr_base_url` (tuỳ chọn; mặc định `https://qr.sepay.vn/img`).
- **Given** đủ `api_key`, `account_number`, `bank`, **Then** "sepay" nằm trong danh sách cổng đã cấu hình và trang khoá/combo hiện nút "Chuyển khoản VietQR". Thiếu một trong ba → không hiện, không báo lỗi.
- Khoá bí mật không bao giờ xuất hiện trong URL, log, phản hồi hay trang người mua.

## AC2 — Tạo đơn chuyển khoản

- **Given** học viên đăng nhập, gói (hoặc combo) đang bán, tiền tệ VND, SePay đã cấu hình, **When** bấm "Chuyển khoản VietQR", **Then** tạo `Order` `pending` (`provider = sepay`, `amountCents` = số đồng, `providerRef` = **mã thanh toán** riêng của đơn) và trả: mã thanh toán, số tiền, ngân hàng, số tài khoản, tên chủ tài khoản (nếu có), ảnh QR.
- **Mã thanh toán**: `LM` + 10 ký tự chữ hoa/số bỏ 0/O/1/I (không dấu gạch, không khoảng trắng — ngân hàng hay xoá hoặc đổi các ký tự này); duy nhất; **là nội dung chuyển khoản** điền sẵn trong QR.
- **Given** cùng người mua, cùng gói/combo, đang có đơn `pending` tạo chưa quá 24 giờ, **Then** dùng lại đơn đó (cùng QR), không tạo thêm.
- **Given** gói không thuộc khoá, gói đã ẩn, khoá/combo chưa xuất bản, tiền tệ khác VND, SePay chưa cấu hình, **Then** từ chối lỗi rõ ràng (400/503), không tạo đơn. Chưa đăng nhập → 401.

## AC3 — Nhận webhook

SePay gọi `POST /api/webhooks/sepay` và chờ HTTP 200 kèm `{"success": true}`.

- **Given** thiếu hoặc sai `Authorization: Apikey …` (so sánh thời gian không đổi), **Then** 401, không đụng DB. Chưa cấu hình `api_key` → 503.
- **Given** thân không phải JSON hợp lệ hoặc thiếu `id` / `transferAmount` / `content` → 400.
- **Given** giao dịch đã có (cùng `id`), **Then** trả thành công, không xử lý lại (SePay có thể gửi nhiều lần).
- **Given** `transferType ≠ "in"`, hoặc `accountNumber` khác tài khoản đã cấu hình, **Then** ghi nhật ký `ignored`, trả thành công.
- **Given** nội dung chứa mã thanh toán của một đơn `sepay` `pending`/`failed`, số tiền ≥ số tiền đơn, **Then** đơn `paid` + `paidAt`, mã giao dịch ngân hàng (`referenceCode`, hoặc `id`) lưu ở `gatewayTxnRef`, và **cấp quyền đúng đường cũ**: khoá có gói → `extendEnrollmentAccess`; combo → `grantBundleAccess` mọi khoá. Nhật ký `matched` kèm đơn.
- **Given** số tiền thấp hơn đơn, **Then** đơn **không đổi**, nhật ký `amount_mismatch` (admin xử lý tay); số tiền cao hơn thì vẫn cấp quyền và nhật ký ghi phần chênh.
- **Given** nội dung không có mã nào khớp đơn, **Then** nhật ký `unmatched`, trả thành công (không để SePay gửi lại vô ích).
- **Given** đơn đã `paid`/`refunded`, **Then** nhật ký `duplicate_payment`, không cấp lại.
- **Given** lỗi tạm thời khi cấp quyền (DB), **Then** xoá dòng nhật ký vừa tạo và trả 500 để SePay gửi lại; lần gửi lại xử lý được.
- Mã thanh toán được tìm trong nội dung **sau khi chuẩn hoá** (chữ hoa, bỏ ký tự không phải chữ-số), vì ngân hàng có thể chèn khoảng trắng hoặc đổi dấu.

## AC4 — Trang người mua

- Sau khi tạo đơn, hiện ảnh QR, ngân hàng, số tài khoản, số tiền, **nội dung chuyển khoản (mã thanh toán) có nút sao chép**, và dòng nhắc "giữ nguyên nội dung và số tiền".
- Trang tự hỏi trạng thái đơn mỗi vài giây (chỉ chủ đơn hỏi được); khi `paid`: báo thành công rồi chuyển tới khoá (khoá lẻ) hoặc `/me` (combo).
- Nếu ảnh QR không tải được, thông tin chuyển khoản dạng chữ vẫn đủ để chuyển tay.

## AC5 — Bảo mật và riêng tư

- Nhật ký `BankTransaction` chỉ lưu: id SePay, số tiền, nội dung chuyển khoản, ngân hàng, mã tham chiếu, thời điểm, kết quả khớp. **Không** lưu tên người chuyển (trường `description` của SePay) và **không** lưu nguyên thân webhook.
- Mọi thao tác cấp quyền đi qua `settleGatewayPayment` (idempotent, chống đua bằng điều kiện trạng thái đơn).
- Không có đường nào cấp quyền mà không có giao dịch tiền vào khớp mã và số tiền.

## Cách kiểm

- Test core-lms (DB thử): tách mã từ nội dung; khớp đúng/thừa tiền/thiếu tiền/trùng id/không khớp/chuyển ra/sai tài khoản; combo; lỗi tạm thời rồi gửi lại; đơn đã paid.
- Test web: so sánh khoá thời gian không đổi, dựng URL QR.
- Thử thật: dùng "Gửi thử" / "Giả lập giao dịch" của SePay sau khi cấu hình (chưa làm).
