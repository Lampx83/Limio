# Combo khoá học — Acceptance criteria

> Bản nháp 24/11/2026. Mục tiêu: bán **trọn bộ nhiều khoá** (vd 5 quyển HSK 4) bằng một lần thanh toán, với giá combo thấp hơn mua lẻ, và dùng được cho **mọi cấp HSK** về sau (mỗi cấp nhiều quyển). Đợt này làm lõi (dữ liệu, thanh toán VNPay, ghi danh nhiều khoá, trang combo); phần ghi "Chưa làm" để đợt sau.

## Vì sao làm

Mỗi đơn hàng hiện chỉ gắn với MỘT khoá (`Order.courseId`). Bán trọn bộ bằng cách mở lại khoá gốc thì tiến độ tách rời các quyển, nội dung phải sửa hai nơi, và cấp sau phải làm lại. Combo thật giữ tiến độ ở đúng từng quyển, nội dung một nơi.

## Quyết định đã chốt (có thể đổi)

| | Quyết định | Vì sao |
|---|---|---|
| D1 | Mỗi combo có **một mức giá và một thời hạn** (`priceCents`, `durationMonths`; null = vĩnh viễn). Không có nhiều gói như `CourseAccessPlan`. | Đủ cho bộ HSK; nhiều gói thêm sau nếu cần. |
| D2 | Thanh toán đợt này chỉ **VNPay (VND)**. Stripe và mã kích hoạt combo: chưa làm. | Combo tính bằng VND; Stripe không dùng cho thị trường này. |
| D3 | Người đã mua lẻ một vài quyển: **không trừ tiền**, quyền cũ không mất, thời hạn **cộng dồn** như `extendEnrollmentAccess` vẫn làm. | Giữ đơn giản đợt đầu; "nâng cấp trừ phần đã trả" là đợt sau. |
| D4 | Hoàn tiền combo **làm tay** (như VNPay hiện nay): admin thu hồi quyền từng khoá. Chưa có API hoàn tự động. | VNPay chưa có hoàn tự động trong hệ thống. |
| D5 | Chỉ **admin nền tảng** tạo/sửa/xuất bản combo. | Đụng giá bán thật, cùng quy tắc với `CourseAccessPlan`. |
| D6 | "Giá gốc" của combo (gạch ngang) là trường **nhập tay** `originalPriceCents`, % giảm tính từ hai giá, không lưu (như khoá). Dòng "Tiết kiệm so với mua lẻ" tính từ **tổng giá bán lẻ hiện hành** của các khoá. | Cùng quy ước với trường giá gốc của khoá. |

## Phạm vi

- **Có:** bảng combo và khoá trong combo; đơn hàng combo; ghi danh cả bộ khi VNPay báo thành công; trang công khai `/combo/<slug>`; nút "Mua trọn bộ"; tạo combo bằng script quản trị.
- **Chưa làm (ghi rõ):** giao diện admin tạo combo (đợt này dùng script); Stripe và mã kích hoạt cho combo; hoàn tiền tự động; nâng cấp từ mua lẻ lên combo có trừ tiền; hiện combo trong trang `/hsk` và thẻ danh mục; báo cáo doanh thu tách riêng combo.
- Không đổi hành vi mua lẻ (Stripe, VNPay một khoá, mã kích hoạt).

## AC1 — Dữ liệu

- **Given** một combo, **Then** có: `slug` duy nhất, `title`, `description`, `coverUrl?`, `currency` (đợt này chỉ `VND`), `priceCents > 0` (đồng), `originalPriceCents?`, `durationMonths?` (1–120, null = vĩnh viễn), `status` (`draft` | `published`), người tạo.
- **Given** combo, **Then** có danh sách khoá theo thứ tự (`CourseBundleItem`), mỗi khoá chỉ xuất hiện một lần trong một combo, **ít nhất 2 khoá**.
- **Given** đơn hàng combo, **Then** `Order.bundleId` có giá trị và `Order.courseId` là null; đơn mua lẻ giữ `bundleId` null và `courseId` có giá trị. Đơn lịch sử không đổi.
- Xoá combo không xoá đơn đã có (đơn giữ lại, `bundleId` về null).

## AC2 — Tạo và xuất bản (admin)

- **Given** admin nền tảng, **When** tạo combo với slug chưa dùng, giá > 0, ≥ 2 khoá tồn tại, **Then** combo ở trạng thái `draft` và ghi `AuditLog` (`course.bundle.created`).
- **Given** người không phải admin, **When** tạo/sửa/xuất bản, **Then** `forbidden`, không ghi gì.
- **Given** slug đã dùng (kể cả slug của khoá — để `/combo/<slug>` và `/catalog/<slug>` không nhầm nhau thì không cần trùng, chỉ cần duy nhất giữa các combo), **Then** `slug_taken`.
- **Given** `originalPriceCents` không lớn hơn `priceCents`, **Then** `validation_failed` (giá gốc chỉ có nghĩa khi lớn hơn giá bán).
- **When** xuất bản, **Then** mọi khoá trong combo phải đang `published`; thiếu thì từ chối `courses_not_published` kèm danh sách khoá. Xuất bản ghi `AuditLog` (`course.bundle.published`), đặt `publishedAt`.
- **Given** combo đã xuất bản, **When** một khoá trong combo bị gỡ khỏi xuất bản, **Then** combo vẫn hiện nhưng nút mua bị từ chối `courses_not_published` (không bán thứ không giao được).

## AC3 — Trang công khai `/combo/<slug>`

- **Given** combo `published`, **When** ai cũng có thể mở (không cần đăng nhập), **Then** thấy: tên, mô tả, bìa, danh sách khoá (bìa, tên, số bài), khối giá (giá gốc gạch ngang nếu có, `-%`, giá combo), "Tiết kiệm x ₫ so với mua lẻ" khi tổng giá lẻ lớn hơn giá combo, thời hạn ("Truy cập 1 năm").
- **Given** combo `draft` hoặc không tồn tại, **Then** 404 (admin xem được bản nháp có nhãn "Nháp").
- **Given** học viên đã có quyền ở một số khoá, **Then** khoá đó hiện nhãn "Đã có"; nút mua vẫn hiện (D3).
- **Given** học viên đã có quyền ở **cả** các khoá còn hạn dài hơn thời hạn combo, **Then** vẫn cho mua (cộng dồn) — không chặn.
- Chưa đăng nhập bấm mua → chuyển tới đăng nhập rồi quay lại trang combo.

## AC4 — Tạo thanh toán combo

- **Given** học viên đăng nhập, combo `published`, mọi khoá `published`, VNPay đã cấu hình, **When** bấm "Mua trọn bộ", **Then** tạo `Order` `pending` (`bundleId`, `courseId = null`, `amountCents = priceCents`, `currency = VND`, `provider = vnpay`, `providerRef` mới) và trả URL VNPay như mua lẻ (cùng chữ ký, `vnp_Amount = đồng × 100`).
- **Given** combo `draft`, khoá chưa xuất bản, combo không phải VND, VNPay chưa cấu hình → từ chối lỗi rõ ràng (400/503), không tạo đơn. Chưa đăng nhập → 401.
- Số tiền lấy từ combo **lúc tạo đơn** và khoá vào đơn: đổi giá combo sau đó không ảnh hưởng đơn đang chờ.

## AC5 — Nhận kết quả (IPN) và ghi danh cả bộ

IPN vẫn là đường **duy nhất** cấp quyền học; mọi mã phản hồi và kiểm tra chữ ký giữ nguyên như `thanh-toan-vnpay.md` AC3.

- **Given** đơn combo `pending`/`failed`, IPN thành công, số tiền khớp, **When** xử lý, **Then** đơn `paid` + `paidAt`, và **mỗi khoá trong combo** được ghi danh/gia hạn bằng đúng `extendEnrollmentAccess` (thời hạn = `durationMonths` của combo, cộng dồn nếu đã còn hạn; vĩnh viễn nếu null) — trong **cùng một giao dịch**: hoặc đủ mọi khoá hoặc không khoá nào.
- **Given** IPN gửi lại hoặc hai bản cùng lúc, **Then** chỉ một lần cấp quyền (điều kiện trạng thái đơn trong `updateMany`), lần sau `already_confirmed`.
- **Given** số tiền khác `Order.amountCents`, **Then** không đổi gì (`amount_mismatch`).
- **Given** IPN báo thất bại, **Then** đơn `failed`, không ghi danh.
- **Given** danh sách khoá của combo thay đổi **sau** khi tạo đơn, **Then** đơn cấp quyền theo danh sách **lúc thanh toán thành công** (không theo lúc tạo đơn) — thêm khoá vào combo thì người mua sau được thêm; người đã mua trước không tự nhận (ghi rõ để người vận hành biết).
- Trang người mua quay về chỉ chuyển hướng (tới `/me` hoặc khoá đầu tiên), không đổi `Order`.

## AC6 — Không làm hỏng mua lẻ

- **Given** đơn mua lẻ (có `courseId`), **Then** mọi đường hiện có (Stripe checkout, VNPay một khoá, IPN, hoàn tiền Stripe, mã kích hoạt, báo cáo nhà xuất bản) chạy như cũ; test hiện có vẫn xanh.
- **Given** đơn combo đi vào đường hoàn tiền Stripe (`processChargeRefund`) hoặc báo cáo theo khoá, **Then** bị bỏ qua an toàn (không lỗi, không tính vào doanh thu của một khoá), vì combo chỉ có VNPay.

## AC7 — Bảo mật và riêng tư

- Danh sách đơn, `providerRef` và số tiền chỉ người mua và admin xem được. Trang `/combo/<slug>` không lộ thông tin học viên.
- Mọi thao tác admin ghi `AuditLog`, payload chỉ mang id, slug và số liệu (không mang mô tả).

## Cách kiểm

- Test core-lms (DB thử): tạo/xuất bản combo (quyền, slug, giá gốc, khoá chưa xuất bản), IPN combo (đủ khoá, cộng dồn, idempotent, sai số tiền, thất bại), mua lẻ không đổi.
- Test web: hàm tính tiết kiệm; khối giá combo.
- Chạy thật trên sandbox VNPay: chưa (như mua lẻ).
