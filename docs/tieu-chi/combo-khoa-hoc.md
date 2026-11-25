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

## AC8 — Bán khi chưa có cổng thanh toán: chuyển khoản + mã kích hoạt

Bổ sung 25/11/2026 (chưa đăng ký pháp nhân nên chưa có VNPay).

- **Mã combo.** Admin sinh mã (`generateBundleCodes`, tối đa 200 mỗi lần, định dạng như mã khoá: 12 ký tự, bỏ 0/O/1/I). **Given** mã chưa dùng, combo `published`, mọi khoá `published`, **When** người học đổi mã, **Then** ghi danh/gia hạn **mọi khoá** của combo trong một giao dịch, thời hạn = `durationMonths` của combo, mã chuyển `redeemed`. Mã nằm ở bảng riêng `BundleAccessCode`, **không bao giờ** có trong `AuditLog`.
- **Một đường đổi mã.** `/api/redeem-code` (`redeemAnyCode`) thử mã khoá trước, không có thì thử mã combo; rate-limit giữ nguyên. Mã sai → `code_not_found`; đã dùng bởi người khác → `code_already_used`; thu hồi → `code_revoked`; combo nháp hoặc còn khoá chưa xuất bản → `course_not_enrollable` và **mã không bị tiêu**. Chính chủ bấm lại mã đã đổi: trả trạng thái hiện tại, không tiêu thêm.
- **Trang khoá/combo khi chưa có cổng nào cấu hình** (thanh toán đã bật): không hiện nút thanh toán (trước đây hiện nút thẻ bị lỗi); hiện khối "Cách mua" lấy từ cài đặt `payment.transfer_instructions` (thiếu thì lời nhắn chung, không bịa thông tin ngân hàng) và ô "Tôi có mã kích hoạt" mở sẵn.
- **Chặn ghi danh miễn phí vào khoá chỉ có gói truy cập.** **Given** khoá có gói đang bán nhưng không có `priceCents`, thanh toán bật, **When** gọi thẳng API ghi danh không qua mã/đơn, **Then** `payment_required` (trước đây ghi danh được miễn phí vì chỉ kiểm `priceCents`).
- Mã khoá lẻ sinh **theo lô** mới mang thời hạn truy cập (mã lẻ cấp vĩnh viễn); mã combo luôn theo thời hạn của combo.


## AC9 — Combo trên trang chủ space (/hsk và các space khác)

Bổ sung 25/11/2026.

- **Khối "Trọn bộ"** nằm **ở cuối trang chủ space** (trên chân trang, như gợi ý "mua cùng nhau"; đã chuyển từ đầu lưới khoá theo yêu cầu 25/11/2026): bìa các khoá, khối giá (giá gốc gạch ngang, `-%`, giá combo, thời hạn), "Tiết kiệm … so với mua lẻ", nút sang `/combo/<slug>`; hai ngôn ngữ vi/en; dùng chung một thành phần (`components/space/SpaceBundles.tsx`) cho giao diện Limio và giao diện space thường, màu theo biến `--sp*` của space.
- **Cấu hình tay** (Admin trường → Space → "Combo trọn bộ trên trang chủ", lưu trong `Organization.space.bundles`): hai chế độ. **Tự động** (mặc định, không có khoá `bundles`): space kiểu Limio (`limioBrand`) hiện mọi combo đã xuất bản có **toàn khoá HSK** (`hsk-<cấp>-…`), space khác không hiện combo. **Chọn tay**: đúng các combo trong danh sách, theo thứ tự đó; danh sách rỗng = chủ động không hiện.
- **Chỉ hiện thứ bán được**: combo chưa xuất bản hoặc còn khoá chưa xuất bản bị bỏ qua dù có trong danh sách (không bán thứ không giao được). Slug lạ trong danh sách bị bỏ im lặng.
- **Không quảng bá sản phẩm của trường khác**: combo chỉ hiện (và chỉ được chọn trong form) khi mọi khoá trong combo thuộc trường đó hoặc chưa có chủ — cùng quy tắc `dropForeignCourses` của danh sách khoá (`bundleAllowedForOrg`).
- Không đổi quyền: chỉ admin nền tảng tạo/sửa/xuất bản combo; admin trường chỉ **chọn** combo nào hiện ở space của mình.
- Giới hạn: tối đa 24 combo mỗi space; chuẩn hoá bỏ trùng và slug sai (`normalizeStored`).
- Test: `lib/space/__tests__/bundles.test.ts`, `hskBundles.test.ts`.

## AC10 — /catalog dẫn sang mọi space

Bổ sung 25/11/2026 (không riêng combo, ghi ở đây vì cùng đợt với AC9).

- **Dải "Không gian học liệu"** ở đầu `/catalog` (trên bộ lọc): mỗi space đang bật là một thẻ gồm logo (space kiểu Limio dùng lát chanh), tên, "N khoá đang mở" và dẫn tới trang chủ của space (`/hsk`, `/micro4asia`, `/s/<slug>`).
- **Tự động, không cấu hình thêm**: space nào được bật (`Organization.spaceEnabled` với slug hợp lệ, hoặc space dựng sẵn) tự có mặt; tắt space thì thẻ biến mất. Xếp theo tên.
- **Ẩn khi đang lọc/tìm kiếm** để kết quả không bị đẩy xuống. Không có space nào hoặc lỗi DB thì không vẽ gì, danh mục không bị hỏng.
- Hai ngôn ngữ giao diện (vi/en); đếm khoá chỉ tính khoá đã xuất bản.
- Test: `lib/space/__tests__/catalogSpaces.test.ts`.

## AC11 — Bấm khối cấp HSK mở popup danh sách quyển

Bổ sung 25/11/2026, trang `/hsk` (space kiểu Limio). Đổi từ khung mở rộng trong trang sang **popup** theo yêu cầu cùng ngày.

- **Given** cấp N có khoá `hsk-N-quyen-<k>` đã xuất bản, **Then** khối cấp N ở lưới hiện "Xem n quyển" và, khi bấm (hoặc Enter/Space), mở **popup** ngay tại chỗ (không tải lại trang), không còn dẫn thẳng vào khoá `hsk-N-goc`; khối ở trạng thái "Đang mở" dù khoá gốc chưa xuất bản.
- **Popup "HSK N: n quyển"**: mỗi quyển một thẻ (bìa, "Quyển k", số bài, giá gốc gạch ngang + `-%` + giá bán, nút vào khoá `/catalog/<slug>`); có liên kết "Xem gói trọn bộ, tiết kiệm hơn" nhảy tới khối combo cuối trang khi trang có combo.
- **Hành vi hộp thoại**: `role="dialog"` `aria-modal`; đóng bằng Esc, bấm nền tối hoặc nút ×; khoá cuộn nền khi mở; giữ tiêu điểm trong hộp (Tab xoay vòng); đóng xong trả tiêu điểm về khối cấp; trên điện thoại popup bám đáy màn hình, cuộn được.
- **Địa chỉ**: mở popup đặt `?level=N` (replaceState, không thêm mục lịch sử), đóng thì bỏ; mở thẳng `/hsk?level=N` thì popup tự mở khi tải trang (chia sẻ được).
- Quyển xếp theo số quyển; chỉ khoá đã xuất bản; `level` ngoài 1–9 hoặc cấp không có quyển thì không mở gì.
- Cấp không có quyển giữ cách cũ (dẫn vào khoá `hsk-N-goc`).
- Khoá gốc `hsk-4-goc` vẫn tồn tại và vào được bằng đường dẫn trực tiếp; chỉ không còn lối vào từ landing khi cấp đó đã có quyển.
- Test: `parseHskBookSlug` ở `lib/space/__tests__/hskBundles.test.ts`; hành vi popup xem bằng mắt (chưa có test giao diện).
