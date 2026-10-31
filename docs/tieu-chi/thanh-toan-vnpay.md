# Thanh toán qua VNPay — Acceptance criteria

> Bản nháp 31/10/2026; **đã code, chưa thử với sandbox VNPay thật** (xem "Đã làm"). Tiếp nối `docs/tieu-chi/hoc-lieu-nha-xuat-ban-P0.md` (kênh "mua trực tiếp" cho nhà xuất bản). Hướng dẫn vận hành: `docs/van-hanh/cong-thanh-toan.md`.
> Đặc tả VNPay lấy từ trang `sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html` (phiên bản 2.1.0) ngày 31/10/2026; trang này có chỗ không nhất quán giữa các ví dụ code (ghi ở "Điểm cần thử với sandbox thật").

## Vì sao làm

Stripe chỉ có thẻ quốc tế và có vẻ không mở được cho pháp nhân Việt Nam. Người mua sách ở Việt Nam trả bằng thẻ ATM nội địa, QR ngân hàng hay app ngân hàng; VNPay phủ các cách đó.

## Phạm vi

- **Có:** tạo thanh toán, nhận kết quả server-to-server (IPN), trang người mua quay về, cấu hình ở Admin → Tích hợp, nút chọn cổng ở trang khoá.
- **Chưa làm (ghi rõ):** hoàn tiền tự động qua API VNPay (hoàn tiền xử lý bằng tay: giảng viên đổi trạng thái ghi danh sang "Đã hoàn tiền"); truy vấn giao dịch chủ động (`querydr`) để đối soát khi IPN không tới; ZaloPay, Momo.
- **Chỉ VND.** Khoá hoặc gói không tính bằng VND thì không cho thanh toán qua VNPay.
- **Mua trực tiếp cần gói truy cập** (`CourseAccessPlan`, admin tạo): trang khoá hiện nút thanh toán chỉ khi khoá có gói. Khoá chỉ có giá phẳng vẫn chỉ nhập mã (hành vi hiện có, không đổi).
- Không đổi hành vi của Stripe và của mã kích hoạt. Khi VNPay **chưa cấu hình**, trang khoá hiện đúng như trước.

## AC1 — Chữ ký

- **Given** một bộ tham số `vnp_*`, **When** ký, **Then** chữ ký là HMAC-SHA512 (hex) của chuỗi `khoá=giá trị` đã sắp xếp theo tên khoá, nối bằng `&`, giá trị mã hoá URL kiểu `encodeURIComponent` đổi `%20` thành `+` (khớp ví dụ Node.js và PHP chính thức), không gồm `vnp_SecureHash` (và `vnp_SecureHashType` nếu có).
- **Given** tham số nhận về (IPN hoặc quay về), **When** kiểm, **Then** hợp lệ chỉ khi chữ ký khớp (so sánh thời gian không đổi, không phân biệt hoa thường của hex) và có mặt `vnp_SecureHash`. Sai một ký tự bất kỳ của bất kỳ tham số nào → không hợp lệ.
- Khoá bí mật không bao giờ xuất hiện trong URL, log hay phản hồi.

## AC2 — Tạo thanh toán

- **Given** học viên đăng nhập, khoá đang xuất bản, gói còn bán (hoặc khoá có giá phẳng), tiền tệ VND, VNPay đã cấu hình, **When** bấm "Thanh toán qua VNPay", **Then** tạo `Order` (`provider = vnpay`, `status = pending`, `amountCents` chốt lúc này, `providerRef` = mã giao dịch của Limio gồm chữ-số, ≤ 100 ký tự) và trả URL chuyển sang trang VNPay đã ký.
- URL mang đủ: `vnp_Version=2.1.0`, `vnp_Command=pay`, `vnp_TmnCode`, `vnp_Amount` = số đồng × 100, `vnp_CurrCode=VND`, `vnp_TxnRef`, `vnp_OrderInfo` (tiếng Việt không dấu, ≤ 255), `vnp_OrderType`, `vnp_Locale=vn`, `vnp_ReturnUrl`, `vnp_IpAddr`, `vnp_CreateDate` và `vnp_ExpireDate` dạng `yyyyMMddHHmmss` **giờ GMT+7** (hết hạn sau 15 phút), `vnp_SecureHash`.
- **Given** khoá miễn phí, chưa xuất bản, gói không thuộc khoá hoặc đã ẩn, tiền tệ khác VND, hoặc VNPay chưa cấu hình, **Then** từ chối với lỗi rõ ràng (400 / 503) và **không tạo `Order`**.
- Chưa đăng nhập → 401. Mỗi lần bấm là một `Order` mới (mã giao dịch không dùng lại).

## AC3 — Nhận kết quả (IPN)

IPN là đường **duy nhất** cấp quyền học. VNPay gọi `GET` và chờ JSON `{RspCode, Message}`.

- **Given** chữ ký sai hoặc thiếu → `97`, không đụng DB.
- **Given** `vnp_TmnCode` khác mã đã cấu hình → `99`.
- **Given** không có đơn `vnpay` nào có `providerRef = vnp_TxnRef` → `01`.
- **Given** `vnp_Amount ≠ Order.amountCents × 100` → `04`; đơn **không** đổi trạng thái.
- **Given** đơn đã `paid` hoặc `refunded` → `02`, không đổi gì.
- **Given** `vnp_ResponseCode = 00` **và** `vnp_TransactionStatus = 00`, đơn `pending` hoặc `failed` → đơn `paid` + `paidAt`, lưu `vnp_TransactionNo` vào `Order.gatewayTxnRef`, cấp / gia hạn quyền qua `extendEnrollmentAccess` (đúng gói; `via: "order"`) trong **cùng transaction**; trả `00`.
- `failed` vẫn nhận được thanh toán thành công: tiền đã về thì quyền phải được cấp dù đơn từng bị đánh dấu thất bại.
- **Given** mã phản hồi không phải thành công (người mua huỷ, hết hạn, thiếu số dư…) → đơn `pending` chuyển `failed`; trả `00` (đã nhận kết quả; VNPay không gửi lại).
- **Given** VNPay gửi lại cùng IPN hoặc hai bản đồng thời → chỉ một bản cấp quyền, bản còn lại `02`; không cấp hai lần, không gia hạn hai lần.
- **Given** lỗi hệ thống giữa chừng → `99` (VNPay gửi lại tới 10 lần, cách 5 phút); không để đơn nửa vời (đổi trạng thái và cấp quyền cùng nhau hoặc không gì cả).

## AC4 — Trang người mua quay về

- Chỉ để hiển thị: kiểm chữ ký rồi chuyển hướng; **không bao giờ đổi `Order` hay cấp quyền** ở đây.
- Chữ ký hợp lệ + `vnp_ResponseCode = 00` → `/learn/<slug>?paid=1` (cùng điểm đến với Stripe). Hợp lệ nhưng không thành công → `/catalog/<slug>?cancelled=1`. Chữ ký sai hoặc không tìm thấy đơn → trang chủ, không lộ thông tin đơn.

## AC5 — Cấu hình và giao diện

- Admin → Tích hợp thêm hai khoá `vnpay.tmn_code` (mã website) và `vnpay.payment_url` (địa chỉ thanh toán; trống = sandbox `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html`); `vnpay.secret` đã có (khoá bí mật).
- VNPay "đã cấu hình" khi có cả mã website và khoá bí mật. Không cấu hình → không hiện lựa chọn.
- Trang khoá, khi khoá có gói: có VNPay → hiện nút "Thanh toán qua VNPay (ATM, QR, thẻ)"; có cả Stripe → hai nút, Stripe ghi "thẻ quốc tế"; chỉ Stripe hoặc không có → như hôm nay.
- Lỗi cấu hình / thanh toán hiện câu tiếng Việt; không hiện thông số kỹ thuật cho học viên.

## Điểm cần thử với sandbox thật

Chưa thể kiểm khi chưa có thông tin sandbox, nên **chưa được coi là xong** cho tới khi chạy các điểm này:

1. ✅ Cách ký (31/10/2026, sandbox thật): đã mã hoá URL được VNPay chấp nhận, ở cả hai chiều (VNPay nhận URL của Limio; Limio kiểm chữ ký VNPay gửi về).
2. ✅ `vnp_OrderType=other` được chấp nhận.
3. ⏳ IPN thật tới được địa chỉ công khai, trả đúng JSON, VNPay ngừng gửi lại sau `00`. **Chưa thử**: sandbox không gọi được `localhost`; cần tên miền công khai và khai IPN URL ở trang quản trị VNPay. Đã thử thay thế: phát lại đúng bộ tham số VNPay gửi về vào IPN cục bộ → `00`, đơn `paid`, `gatewayTxnRef` = `vnp_TransactionNo`, quyền được cấp; gửi lại → `02`; đổi một chữ số của số tiền → `97`.
4. ✅ Số tiền × 100 (199.000 VND hiện đúng) và `vnp_ExpireDate` (đồng hồ 15 phút) được chấp nhận.
5. ⏳ Thanh toán thành công đã đi hết luồng (thẻ NCB thử, OTP, quay về `?paid=1`). **Chưa thử:** thanh toán bị huỷ / hết hạn, và kịch bản SIT của VNPay (cần IPN công khai).

## Đã làm (31/10/2026)

- `Order.gatewayTxnRef` (migration `20261031040000_order_gateway_txn`); hai khoá tích hợp mới `vnpay.tmn_code`, `vnpay.payment_url`; khung "VNPay" ở Admin → Tích hợp.
- `apps/web/src/lib/vnpay.ts` (ký, kiểm, định dạng, cấu hình), `lib/vnpayPayment.ts` (tạo đơn + URL), `lib/paymentProviders.ts` (cổng nào đã cấu hình).
- Lõi `core-lms/learning/orderPayment.ts` (`settleGatewayPayment`): cấp quyền một lần, an toàn khi gửi đồng thời, `failed` vẫn nhận thanh toán thành công, đơn `refunded` không bị mở lại.
- Route: `POST /api/orders/checkout` nhận `provider: "vnpay"`; `GET /api/webhooks/vnpay` (IPN); `GET /api/payments/vnpay/return`.
- `EnrollButton` hiện "Thanh toán qua VNPay (ATM, QR, thẻ)" khi VNPay đã cấu hình (kèm nút thẻ quốc tế nếu có Stripe); chưa cấu hình thì như cũ.
- **Test:** chữ ký đối chiếu với bản tính độc lập bằng Python; lõi trên DB (11 test); IPN, trang quay về, tạo thanh toán (18 test có mock).
- **Đã thử trên dev** (máy chủ thật, khoá thử, người ký IPN là một chương trình Python độc lập): tạo thanh toán trả URL đã ký đúng; IPN sai chữ ký → `97`, mã giao dịch lạ → `01`, số tiền lệch (đã ký) → `04`, thành công → `00` và đơn `paid` + gia hạn cộng dồn 12 tháng, gửi lại → `02`, thất bại đến muộn → `02` (đơn vẫn `paid`); trang quay về chuyển đúng và không đổi đơn.
- **Chưa làm / chưa thử:** mọi "Điểm cần thử với sandbox thật" ở trên; nhìn bằng mắt nút VNPay ở trang khoá (công tắc thanh toán toàn hệ thống đang tắt trên dev và đó là cài đặt chung, không đổi); hoàn tiền tự động; đối soát chủ động.
- Cột `Order.paymentIntentRef` vẫn là của Stripe; VNPay dùng `gatewayTxnRef`. Nếu thêm cổng thứ ba thì gom hai cột thành một khoá giao dịch trung tính.
