# Học liệu cho nhà xuất bản (sách điện tử kèm mã) — Acceptance criteria P0

> Bản nháp 31/10/2026. **AC1 đã code (xem "Đã làm" ở mục AC1); AC2–AC4 chờ làm.** Gắn với A9 (Payment) và A3 (Enrollment); ID tính năng chính thức sẽ đối chiếu spec khi commit.

## Vì sao làm

Một nhà xuất bản muốn đưa sách giấy lên Limio dưới dạng sách điện tử. In một mã sau mỗi cuốn; người mua nhập mã để vào học liệu của khoá. Ngoài ra ai cũng mua khoá trực tiếp trên Limio được.

Kiểm tra mã nguồn ngày 31/10/2026 cho thấy hai kênh (nhập mã, mua bằng Stripe) đã chạy, nhưng bốn chỗ sau chặn việc ký:

1. Học liệu tải lên được phục vụ công khai kiểu "ai có link đều tải được" (`/api/lesson-media/*`, `cache-control: public, immutable`). Người chưa mua, hoặc người mua rồi gửi link cho bạn, đều lấy được.
2. Mã kích hoạt luôn cấp quyền **vĩnh viễn**; không đặt được "1 năm" hay "phải kích hoạt trước ngày X".
3. Không quản mã theo **lô** (đợt in): trần 200 mã mỗi lần sinh, danh sách chỉ hiện 300 mã gần nhất, không xuất file cho nhà in.
4. **Hoàn tiền** trên Stripe không thu hồi quyền học (webhook chỉ xử lý `checkout.session.completed` và `expired`; không có đường nào ghi `Order.refunded`).

## Thứ tự làm

AC1 (bảo vệ học liệu) → AC2 (lô mã + xuất file) → AC3 (thời hạn) → AC4 (hoàn tiền). Mỗi AC xong thì dừng để thầy duyệt (CLAUDE.md §6).

## Phạm vi chung

- **Không đổi hành vi** của khoá hiện có, mã đã sinh trước đây, và đơn đã mua. Mọi cột mới nullable hoặc có mặc định giữ nguyên cách chạy cũ.
- Nhập mã vẫn qua `/api/redeem-code` (rate-limit đã có), không thêm đường nhập mới ở P0.
- **Không làm ở P0:** VNPay/Momo, trang kích hoạt `/kich-hoat?code=` và QR, mã nhiều khoá, vai trò nhà xuất bản và báo cáo đối soát, trình đọc kiểu sách (ePub, đánh dấu trang, offline). Xem "Để P1".

---

## AC1 — Học liệu của khoá bản quyền chỉ mở cho người có quyền

**Hướng làm đề xuất** (thầy duyệt hướng này cùng AC):

- Thêm cờ `Course.protectedMedia` (mặc định `false`), nhãn giao diện **"Học liệu có bản quyền"**, bật ở trang sửa khoá, chỉ giảng viên chủ khoá và admin được bật/tắt.
- Khoá đã bật cờ: route `/api/lesson-media/*` kiểm **phiên đăng nhập** của người gọi với ghi danh của khoá chứa file đó. File không thuộc khoá nào bật cờ phục vụ như hiện nay.
- **Đổi hướng khi code (31/10):** bản nháp đầu dùng liên kết ký có hạn 6 giờ. Chuyển sang kiểm theo phiên vì (1) mọi nơi đang nhúng URL file, kể cả ảnh trong HTML văn bản, chạy đúng mà không phải viết lại URL; (2) hoàn tiền / hết hạn có hiệu lực sau tối đa 60 giây thay vì tối đa 6 giờ; (3) phiên là JWT nên không tốn truy vấn. Kết quả nhìn thấy giống nhau, nên các AC dưới đây chỉ đổi chỗ nhắc "liên kết ký".
- Cần một bảng tra "file thuộc khoá nào" (`filename` → `courseId`), vì URL trong DB chỉ mang tên file, không mang id khoá. Bảng này được ghi khi lưu nội dung bài và khi bật cờ (quét nội dung đã có).

**Đã chốt:** opt-in theo khoá, không bật mặc định. Lý do: khoá miễn phí / công khai (`publicAccess`) và hàng nghìn URL đã nhúng trong nội dung hiện có không được vỡ; CDN cache `public` vẫn có ích cho chúng.

### Truy cập

- **Given** khoá đã bật "Học liệu có bản quyền" và một file PDF của khoá, **When** người chưa đăng nhập (hoặc đã đăng nhập nhưng chưa ghi danh) gọi thẳng URL file, **Then** nhận 403 và không nhận byte nào của file.
- **Given** học viên có ghi danh còn hiệu lực, **When** mở bài chứa PDF / ảnh / video / audio / file đính kèm / HTML, **Then** tất cả tải và chạy bình thường, gồm tua video (range request) và phân trang PDF.
- **Given** ảnh nằm trong nội dung văn bản của bài (chèn bằng trình soạn hoặc nhập từ Word), **Then** ảnh đó cũng được ký như file thường — không để lọt vì nằm trong HTML.
- **Given** học viên A gửi đường dẫn file cho B, **When** B (tài khoản chưa ghi danh) hoặc người ẩn danh mở đường dẫn đó, **Then** 403: quyền gắn với người đăng nhập, không gắn với đường dẫn.
- **Given** ghi danh đã `expired` / `refunded` / `dropped`, **When** mở bài hoặc gọi file, **Then** không vào được bài (như hiện nay) và file trả 403 sau tối đa **60 giây** (thời gian cache quyết định; ghi rõ ở "Giới hạn").
- **Given** giảng viên của khoá (chủ, đồng giảng, trợ giảng được sửa) hoặc admin, **When** xem trước nội dung khoá, **Then** thấy đủ học liệu không cần ghi danh.

### Không hồi quy

- **Given** khoá chưa bật cờ, **Then** mọi route media trả đúng như trước (kể cả `cache-control: public, immutable`), không thêm truy vấn DB.
- **Given** khoá đã bật cờ, **Then** phản hồi media của file được bảo vệ dùng `cache-control: private` (không cho CDN/proxy dùng chung lưu).
- **Given** người xem tua video (nhiều request liên tiếp), **Then** bảng "file thuộc khoá nào" và quyết định quyền được cache trong bộ nhớ (30 giây / 60 giây) nên không truy vấn DB cho từng đoạn; phiên đăng nhập là JWT nên không tốn truy vấn.
- **Given** tra bảng hoặc kiểm quyền gặp lỗi (DB sập), **Then** trả 503, không phục vụ file (đóng còn hơn lộ).
- Ảnh bìa khoá (`coverUrl`), avatar, logo tổ chức **không** bị bảo vệ — chúng hiện ở catalog công khai.

### Bật / tắt cờ

- **Given** giảng viên bật cờ cho khoá đang có nội dung, **When** lưu, **Then** mọi file đang được bài của khoá tham chiếu được đăng ký vào bảng bảo vệ (chạy lại nhiều lần không sinh trùng), và giao diện báo "đã bảo vệ n file".
- **Given** giảng viên tắt cờ, **Then** các file nhả khỏi bảng bảo vệ và phục vụ công khai lại; học viên không phải làm gì.
- **Given** file được tải lên **trước** khi nội dung bài được lưu (đường tải lên hiện tại), **Then** trong khoảng giữa hai bước đó file vẫn ở dạng capability URL. Ghi vào "Giới hạn"; không xử lý ở P0.
- Một file được dùng ở nhiều khoá: file được bảo vệ nếu **bất kỳ** khoá nào tham chiếu nó có bật cờ.

### Sự kiện và nhật ký

- Bật / tắt cờ ghi sự kiện `course.protected_media.enabled` / `.disabled` (chỉ mang `courseId`; không tính là hoạt động học — thêm `course.protected_media.` vào `NON_LEARNER_ACTIVITY_PREFIXES`) và dòng `AuditLog` (§3.1 spec: audit mọi thay đổi quyền).
- Từ chối 403 **không** ghi `LearningEvent` (không phải hành vi học, và sẽ phình bảng khi bị dò); chỉ đếm bằng log máy chủ.

### Đã làm (31/10/2026)

- Cờ `Course.protectedMedia` + bảng `ProtectedMediaFile` (migration `20261031000000_protected_media`); lõi ở `core-lms/courses/protectedMedia.ts`, cổng ở `apps/web/src/lib/lessonMediaGuard.ts`, bọc cả 7 route `lesson-media` (images, videos, audio, pdfs, files, html, transcripts).
- Bảng tra được giữ đúng bằng ba đường: bật / tắt cờ (quét cả khoá), lưu khối nội dung (`createContentItem`, `updateContentItem`), và dựng trang bài cho học viên (lưới an toàn cho nhập Word/Markdown, AI, sao khoá).
- Bật / tắt ở tab Tổng quan của khoá (chỉ chủ khoá và admin); `PUT /api/courses/[id]/protected-media`.
- Đã thử trên dev: người lạ 403, học viên đã ghi danh 200 kèm `cache-control: private`, ảnh trong trang bài hiện đủ, đổi ghi danh sang `refunded` thì file 403 trong vòng 62 giây, khoá tắt cờ vẫn `public, immutable`.
- **Chưa làm ở AC1:** nút "Tải về" của file đính kèm ở khoá bản quyền (câu hỏi Q4: cần cờ riêng, nằm ngoài các AC phía trên); ảnh trong slide tạo từ bài (xem Giới hạn).

### Giới hạn (ghi rõ để không hứa quá với nhà xuất bản)

- File vừa được đăng ký bảo vệ có thể còn phục vụ công khai tới **30 giây** trên các bản chạy khác của web (cache bảng tra).
- Người vừa bị thu quyền xem được file thêm tối đa **60 giây**.
- Khoá đã mở công khai (`publicAccess`) và đang xuất bản: file mở cho mọi người, đúng theo cổng của trang bài; cờ bản quyền không có tác dụng với khoá đó.
- Chỉ phủ nội dung bài (khối nội dung và mô tả bài). Ảnh / file trong câu hỏi quiz, bài tập và đề thi dùng route khác, chưa bảo vệ.

- Chặn **chia sẻ liên kết** và **người chưa mua**. **Không** chặn người đã mua tự lưu file về (PDF xem được thì lưu được), và **không** chống chụp màn hình.
- Chưa có watermark theo người xem, chưa giới hạn số thiết bị / phiên, chưa DRM.
- Khoá học là kênh duy nhất được bảo vệ: Limio-Live (`limio-live-resource`), bài giảng slide tạo từ bài học và đề thi dùng route riêng, nằm ngoài P0. Nếu bài giảng slide được tạo từ bài của khoá bản quyền thì ảnh trong slide có thể công khai — cần rà ở AC1 khi code.

---

## AC2 — Mã kích hoạt theo lô, có xuất file cho nhà in

**Dữ liệu:** thêm `CourseAccessCodeBatch` (`id`, `courseId`, `label`, `note`, `count`, `createdBy`, `createdAt`) và `CourseAccessCode.batchId` (nullable). Mã đã có không thuộc lô nào, giữ nguyên.

### Sinh lô

- **Given** giảng viên của khoá (quyền `assertCanEditCourse` như hiện nay), **When** sinh mã với **tên lô** (bắt buộc, ví dụ "Tái bản 2026 — đợt 1") và số lượng, **Then** hệ thống tạo một lô và đúng ngần ấy mã gắn vào lô đó.
- Trần mỗi lô: **10.000 mã**. Trần 200 cũ chỉ còn áp cho đường sinh nhanh không đặt tên lô (giữ tương thích).
- **Given** số lượng trên 500, **Then** việc sinh chạy ở nền (BullMQ) và trang lô hiện "đang sinh: x / n"; làm xong thì báo. Không bao giờ timeout giữa chừng làm lô nửa vời: lô chỉ chuyển sang "sẵn sàng" khi đủ mã.
- Mã trùng khi sinh được bốc lại (như `generateAccessCodes` hiện có), không hỏng cả lô.
- Mỗi lô chốt `priceCentsSnapshot` và `currency` của khoá lúc sinh (như hiện nay), để báo cáo doanh thu không lệch khi đổi giá sau.
- **Given** khoá `invite_only`, **Then** từ chối sinh lô (giữ bất biến hiện có).

### Xem và tra cứu

- **Given** khoá có nhiều lô, **When** mở mục Mã kích hoạt, **Then** thấy danh sách lô, mỗi lô có: tên, ngày sinh, **tổng / đã dùng / chưa dùng / đã thu hồi**.
- **Given** một lô, **When** mở chi tiết, **Then** danh sách mã **phân trang** (50/trang) và lọc được theo trạng thái; không còn cắt cứng ở 300.
- **Given** giảng viên nhập một mã (khách báo lỗi), **When** tra cứu, **Then** thấy trạng thái mã, lô, ai dùng và lúc nào. Tra cứu chỉ trong các khoá giảng viên có quyền sửa.

### Xuất file

- **Given** một lô, **When** bấm **"Xuất CSV"**, **Then** tải file UTF-8 có BOM (mở được trong Excel tiếng Việt) gồm cột `STT`, `Mã`. Mặc định chỉ xuất mã **chưa dùng**; có tuỳ chọn xuất cả lô. Tên file chứa tên lô đã làm sạch ký tự đặc biệt.
- Mã là bí mật tự cấp quyền, nên mỗi lần xuất ghi sự kiện `course.access_batch.exported` (subject là người xuất; payload chỉ `batchId`, `courseId`, số dòng; **không** mang mã). Chỉ người có quyền sửa khoá xuất được; học viên và giảng viên khoá khác nhận 403.
- Xuất không làm đổi trạng thái mã.

### Thu hồi

- **Given** một lô in sai, **When** thu hồi cả lô, **Then** mọi mã `unused` của lô thành `revoked` trong **một** thao tác có xác nhận (nói rõ "n mã chưa dùng sẽ bị thu hồi"). Mã `redeemed` không đổi và không bị rút quyền học viên.
- Thu hồi từng mã đơn lẻ giữ nguyên như hiện nay.

### Sự kiện

- `course.access_batch.created`, `course.access_batch.exported`, `course.access_batch.revoked`; payload chỉ mang id và số lượng. Thêm tiền tố `course.access_batch.` vào `NON_LEARNER_ACTIVITY_PREFIXES`.
- Dùng mã vẫn phát `enrollment.created` như cũ; không phát thêm event mang mã.

---

## AC3 — Mã có thời hạn truy cập và hạn kích hoạt

**Dữ liệu:** `CourseAccessCodeBatch` thêm `accessDurationMonths` (null = vĩnh viễn, như hôm nay) và `activateBefore` (null = không hạn kích hoạt). Hai giá trị đặt **lúc sinh lô**, không sửa sau khi lô có mã đã dùng.

### Thời hạn truy cập

- **Given** lô đặt "truy cập 12 tháng", **When** học viên chưa ghi danh nhập mã hợp lệ, **Then** được ghi danh với `accessExpiresAt` = lúc nhập + 12 tháng (dùng `extendEnrollmentAccess`, không viết lại phép tính tháng).
- **Given** lô không đặt thời hạn (và mọi mã cũ không thuộc lô), **Then** hành vi y như hôm nay: vĩnh viễn.
- **Given** học viên đã ghi danh **còn hạn**, **When** nhập mã có hạn, **Then** gia hạn **cộng dồn** từ hạn hiện có; mã bị tiêu. (Khác hôm nay, khi người đã ghi danh nhập mã thì mã không bị tiêu — xem câu hỏi Q1.)
- **Given** học viên đã có truy cập **vĩnh viễn**, **When** nhập mã có hạn, **Then** không rút ngắn quyền và **mã không bị tiêu** (giữ nguyên ý "nhận nhầm hai mã vẫn dùng được cho người khác").
- **Given** học viên có ghi danh `expired`, **When** nhập mã, **Then** quay lại `active`, hạn tính từ lúc nhập, lịch sử học giữ nguyên.
- **Given** lô vĩnh viễn, **When** học viên đang có hạn nhập mã, **Then** nâng lên vĩnh viễn, mã bị tiêu.
- Sau khi nhập, thông báo thành công nêu rõ hạn: "Truy cập đến dd/mm/yyyy" hoặc "Truy cập vĩnh viễn".
- Cron nhắc hạn và cron thu hồi hết hạn đã có chạy cho ghi danh từ mã như cho ghi danh từ đơn mua; **không viết thêm cron**.

### Hạn kích hoạt

- **Given** lô có `activateBefore` đã qua, **When** nhập mã, **Then** từ chối với lỗi mới `code_expired` ("Mã này đã hết hạn kích hoạt"); mã giữ trạng thái `unused` (không đổi enum), danh sách hiện nhãn dẫn xuất "Hết hạn kích hoạt".
- **Given** `activateBefore` còn hiệu lực, **Then** kích hoạt bình thường. Ngày tính theo giờ Việt Nam (`lib/datetime.ts`), hết hạn vào cuối ngày đã chọn.
- Hạn kích hoạt kiểm **trong cùng transaction** với việc tiêu mã, để mã không thể được tiêu sau mốc hạn do hai request đua nhau.

### Sự kiện

- `enrollment.access.extended` (đã có) thêm trường tuỳ chọn `via: "access_code" | "order"` để phân tích nguồn; **không** ghi mã. Sự kiện cũ không có trường này vẫn hợp lệ.

---

## AC4 — Hoàn tiền trên Stripe thu hồi quyền học

**Dữ liệu:** `Order` thêm `paymentIntentRef` (nullable, unique), ghi khi nhận `checkout.session.completed` (Stripe session mang `payment_intent`). Đơn cũ không có giá trị này: sự kiện hoàn tiền không khớp được đơn cũ thì ghi log cảnh báo và để admin xử lý tay (không đoán).

### Hoàn toàn bộ

- **Given** đơn `paid` có `paymentIntentRef`, **When** Stripe gửi `charge.refunded` hoàn **toàn bộ** số tiền, **Then** `Order.status = refunded`, `refundedAt` được ghi, và nếu học viên không còn lý do nào khác để giữ quyền thì `Enrollment.status = refunded`.
- "Còn lý do khác để giữ quyền" nghĩa là có **một trong hai**: (a) đơn `paid` khác cho cùng khoá, chưa hoàn; (b) mã kích hoạt `redeemed` bởi chính học viên này cho khoá này. Khi có, ghi danh **giữ nguyên** và chỉ đơn bị hoàn đổi trạng thái.
- Lịch sử học (`LearningEvent`, tiến độ, bài nộp) giữ nguyên; chỉ quyền vào bị đóng. Học viên mua lại thì `extendEnrollmentAccess` mở lại và đưa trạng thái về `active`.
- Phát một sự kiện thu hồi quyền (`enrollment.refunded`; tên chốt khi code theo `<domain>.<entity>.<verb_past>`) cùng transaction với đổi trạng thái; payload chỉ mang id, không mang số tiền thẻ.

### Hoàn một phần

- **Given** hoàn một phần, **Then** quyền học **không đổi**, đơn vẫn `paid`; ghi log và hiện ở danh sách đơn của admin dưới dạng "đã hoàn một phần" để người vận hành quyết định tay. Thu hồi quyền qua trang ghi danh của giảng viên (đường thủ công đã có).

### An toàn vận hành

- **Idempotent:** Stripe gửi lại cùng sự kiện nhiều lần (hoặc đảo thứ tự) không sinh trạng thái hai lần, không ghi hai sự kiện thu hồi.
- Chữ ký webhook vẫn kiểm như hiện nay; sự kiện không khớp đơn nào trả 200 (để Stripe không gửi lại vô hạn) và ghi log.
- Danh sách sự kiện đăng ký ở Stripe dashboard cần thêm `charge.refunded`; ghi vào `docs/van-hanh/` kèm lệnh kiểm tra, vì thiếu bước này tính năng im lặng không chạy.
- Khoá cấp quyền bằng **mã kích hoạt** không đi qua Stripe nên không có hoàn tiền tự động: thu hồi bằng trang ghi danh (thủ công). Ghi rõ cho nhà xuất bản.

---

## Câu hỏi cần thầy chốt

| # | Câu hỏi | Đề xuất mặc định |
|---|---|---|
| Q1 | Người **đã ghi danh còn hạn** nhập mã có hạn thì gia hạn cộng dồn (mã bị tiêu), hay giữ như nay (mã không tiêu)? | Gia hạn cộng dồn — sách điện tử thuê bao theo năm cần đường này |
| Q2 | ~~Hạn liên kết ký học liệu~~ | Bỏ: AC1 kiểm theo phiên, không còn liên kết ký |
| Q3 | Trần một lô | 10.000 mã |
| Q4 | Khoá bản quyền có cho nút tải PDF (`file` đính kèm) không? Tải về là mất kiểm soát | Cho bật / tắt theo khoá, mặc định **tắt** nút "Tải về" ở khoá bản quyền; PDF vẫn xem trong trình đọc |
| Q5 | Hoàn một phần: giữ quyền, báo admin, hay thu hồi? | Giữ quyền, báo admin |
| Q6 | Nhà xuất bản có cần **tự sinh / xuất mã** mà không phải giảng viên của khoá không? | Để P1 (vai trò nhà xuất bản); P0 vẫn qua tài khoản giảng viên chủ khoá |

## Để P1

- VNPay / Momo / chuyển khoản QR (kênh mua trực tiếp ở Việt Nam).
- Trang kích hoạt `/kich-hoat?code=…` để in QR trên sách; giữ mã qua bước đăng nhập.
- Mã bộ sách mở nhiều khoá.
- Vai trò nhà xuất bản trong `org-admin`: sinh / xuất mã, báo cáo kích hoạt và doanh thu, đối soát chia sẻ doanh thu.
- Trình đọc kiểu sách (mục lục liên tục, đánh dấu trang, tìm trong sách, offline).
- Watermark theo người xem, giới hạn thiết bị.
- Hoá đơn VAT / email biên nhận cho đơn mua trực tiếp (chưa kiểm).
