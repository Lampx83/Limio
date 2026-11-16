# Báo cáo cho nhà xuất bản — Acceptance criteria

> 16/11/2026, **thầy đã duyệt cả 5 câu chốt theo đề xuất mặc định**; đang code. Tiếp nối `docs/tieu-chi/hoc-lieu-nha-xuat-ban-P0.md` (mã theo lô, bảo vệ học liệu, hoàn tiền), `docs/tieu-chi/thanh-toan-vnpay.md` (mua trực tiếp) và thay cho AC5 của `docs/tieu-chi/tu-hoc-ca-nhan-hoa-nxb.md` (tổng hợp ẩn danh, chưa làm). Gắn với A9 (Payment), A3 (Enrollment), B1/B4 (mức nắm vững), B9 (uptake phản hồi); ID chính thức đối chiếu spec khi commit.

## Vì sao làm

Nhà xuất bản hợp tác với Limio cần trả lời bốn câu hỏi sau mỗi đợt phát hành: đã có bao nhiêu mã được kích hoạt, đã bán được bao nhiêu, người mua có thực sự học không, và học liệu có chỗ nào khó. Hiện họ không có chỗ nào để xem, nên catalogue gửi nhà xuất bản (trang 9) đang ghi "tài khoản nhà xuất bản với báo cáo đối soát" và "trang tổng hợp ẩn danh" ở nhóm **Chưa có**.

## Hiện trạng (đã đối chiếu mã ngày 16/11/2026)

| Số liệu | Hiện có ở đâu | Vì sao chưa dùng được cho nhà xuất bản |
|---|---|---|
| Mã kích hoạt theo lô | `AccessCodesPanel` ở trang sửa khoá: đếm Chưa dùng / Đã kích hoạt / Đã thu hồi mỗi lô, tra mã, xuất CSV | Chỉ người **sửa được khoá** mở được; danh sách mã hiện `redeemedBy` (email, tên); không có số theo thời gian |
| Doanh thu | Bảng `Order` (`status`, `amountCents`, `currency`, `provider` stripe/vnpay/momo, `accessPlanId`, `paidAt`, `refundedCents`, `refundedAt`, `gatewayTxnRef`) | **Không có trang nào** liệt kê đơn mua khoá (admin chỉ có trang đơn của ví token AI) |
| Người học | Tab Học viên (`EnrollmentList`), `/instructor/learner-insights` | Lộ tên và email; learner-insights dùng ngưỡng 0,4 / 0,9 khác ngưỡng nhãn học viên thấy |
| Mức nắm vững | `LearnerSkillState.masteryProbability`; ngưỡng nhãn `MASTERY_REVIEW_BELOW = 0.6`, `MASTERY_SOLID_AT = 0.85` ở `shared-types/src/mastery.ts`; mỗi bài một skill `lesson.<lessonId>` khi bật cá nhân hoá | Không có chỗ tổng hợp theo bài |
| Câu bị sai nhiều | `listBankItemAnalytics`, `listExamItemAnalytics` (ngân hàng câu hỏi, đề thi; ngưỡng `ITEM_ANALYTICS_MIN_ATTEMPTS`) | **Chưa có cho quiz trong khoá** |
| Mức dùng phản hồi | `FeedbackDelivery.remediationLessonIds`, sự kiện `feedback.remediation.clicked` | Chỉ nằm trong dữ liệu, không có chỗ xem |
| Vai trò | `CourseInstructor.role`: owner, co-instructor, non-editing-teacher, teaching-assistant; `OrganizationAdmin`; `Course.organizationId` | Không vai trò nào "chỉ xem báo cáo": non-editing-teacher chấm bài nên thấy bài làm và danh tính |

## Phạm vi

- **Có (P0):** AC1–AC7. Một trang chỉ đọc, gồm bốn khối: Phát hành, Doanh thu, Người học, Học liệu.
- **Không làm ở P0:** chia sẻ doanh thu và tính phần của mỗi bên; hoá đơn; gửi báo cáo định kỳ qua email; so sánh giữa các đầu sách; số liệu theo tỉnh hay theo đại lý; dữ liệu học của từng người. Xem "Để P1".
- **Không đổi hành vi** của các trang hiện có (trang sửa khoá, tab Học viên, learner-insights).

## Quyết định cần thầy chốt

| # | Câu hỏi | Đề xuất mặc định | Lý do |
|---|---|---|---|
| Q1 | Báo cáo gắn với **khoá** hay với **tổ chức** (một nhà xuất bản nhiều đầu sách)? | **Tổ chức**: nhà xuất bản là một `Organization`; trang báo cáo liệt kê mọi khoá có `organizationId` của tổ chức đó, chọn từng khoá để xem | Một nhà xuất bản có nhiều sách; dùng lại `Organization` đã có, không cấp quyền từng khoá một |
| Q2 | Ai được xem? | Admin tổ chức (`OrganizationAdmin`), admin nền tảng, và **một quyền mới "Xem báo cáo"** cấp theo tổ chức, không kèm quyền sửa khoá hay quản trị thành viên | Người phụ trách kinh doanh của nhà xuất bản không nên sửa được nội dung |
| Q3 | Nhà xuất bản có được thấy danh tính người mua (tên, email) không? | **Không.** Chỉ số liệu tổng hợp; nhóm nhỏ hơn k người thì không hiện tỉ lệ | Luật BVDLCN 91/2025/QH15; người mua sách không đồng ý chia sẻ danh tính với nhà xuất bản. Nếu hợp đồng cần (hỗ trợ khách hàng), đó là việc riêng có đồng ý của người học |
| Q4 | Ngưỡng k cho nhóm nhỏ | **k = 10** | Đủ để không suy ra từng người khi có ít người mua |
| Q5 | Giảng viên chủ khoá (người sửa được khoá) có thấy trang này không? | Có, cùng nội dung ẩn danh | Một trang duy nhất, không hai phiên bản số liệu |

Các AC dưới đây viết theo các đề xuất mặc định. Thầy đổi câu nào thì AC tương ứng đổi theo.

---

## AC1 — Quyền xem và phạm vi dữ liệu

- **Given** người dùng có quyền "Xem báo cáo" của tổ chức X, **When** mở trang Báo cáo, **Then** thấy danh sách các khoá có `organizationId = X` (kể cả khoá đã lưu trữ), mặc định chọn khoá có hoạt động gần nhất.
- **Given** người đó, **When** gọi bất kỳ route sửa khoá, sửa mã, xem tab Học viên, learner-insights hay xuất danh sách học viên, **Then** bị từ chối như người ngoài (quyền "Xem báo cáo" không ngầm cấp quyền nào khác).
- **Given** người dùng không có quyền với tổ chức X, **When** gọi API báo cáo của một khoá thuộc X (đoán id), **Then** 403, không lộ tên khoá.
- **Given** admin tổ chức X hoặc admin nền tảng, **Then** thấy cùng trang. **Given** giảng viên sửa được khoá (owner, co-instructor), **Then** thấy báo cáo của riêng các khoá đó.
- Cấp và thu quyền "Xem báo cáo" ở trang Thành viên của quản trị tổ chức; mỗi lần cấp hoặc thu ghi `AuditLog` (CLAUDE.md §5.4: audit mọi đổi vai trò).
- **Không hồi quy:** quyền mới không được làm khoá hiện ra trong "Khóa của tôi" của người xem, và không được thoả `canEditCourse`, `canGradeCourse`, `canModerateLiveExam`. Có test cho cả ba hàm.

## AC2 — Khối Phát hành (mã kích hoạt)

- **Given** khoá có các lô mã, **Then** bảng theo lô: tên lô, ngày tạo, số mã, **đã kích hoạt**, chưa dùng, đã thu hồi, tỉ lệ kích hoạt (= đã kích hoạt / (số mã − đã thu hồi)), thời hạn truy cập, hạn kích hoạt.
- **Given** lô có hạn kích hoạt trong vòng 30 ngày tới và còn mã chưa dùng, **Then** dòng lô có nhãn "Sắp hết hạn kích hoạt" kèm ngày.
- Biểu đồ **số mã kích hoạt theo tuần** (tuần bắt đầu thứ Hai, giờ Việt Nam qua `lib/datetime.ts`), lọc được theo lô. Tính từ `CourseAccessCode.redeemedAt`.
- Mã lẻ (không thuộc lô) gom thành một dòng "Mã lẻ".
- **Không bao giờ** hiện mã, email hay tên người kích hoạt ở trang này, kể cả trong dữ liệu trả về của API (test kiểm cả JSON, không chỉ giao diện).

## AC3 — Khối Doanh thu (mua trực tiếp)

- **Given** khoá có đơn `paid`, **Then** hiện theo từng **đơn vị tiền tệ riêng** (không cộng VND với USD): số đơn, tổng tiền đã thu, tổng đã hoàn, doanh thu thuần (= đã thu − đã hoàn).
- Bảng theo tháng (giờ Việt Nam, theo `paidAt`) và theo gói truy cập (`accessPlanId`, đơn không còn gói thì ghi "Gói đã xoá"), tách theo cổng (VNPay, thẻ quốc tế).
- Đơn `pending` và `failed` **không** tính vào doanh thu; hiện riêng một con số "Đơn chưa hoàn tất" để nhà xuất bản biết có người bỏ dở thanh toán.
- Đơn `refunded` tính vào "đã hoàn" theo `refundedAt`; hoàn một phần lấy `refundedCents`.
- Nút **"Xuất CSV đối soát"**: mỗi đơn một dòng gồm mã đơn nội bộ, ngày thanh toán, ngày hoàn (nếu có), gói, số tiền, số tiền đã hoàn, tiền tệ, cổng, mã giao dịch của cổng (`gatewayTxnRef` hoặc `paymentIntentRef`), trạng thái. **Không có** tên, email hay mã người mua. Tệp UTF-8 có BOM để Excel đọc đúng tiếng Việt (như CSV lô mã).
- Hiển thị số tiền đúng đơn vị: với VND, `amountCents` lưu **đồng** (`vnpayPayment.ts` lấy `priceCents` của gói và chỉ nhân 100 khi gửi `vnp_Amount` cho VNPay); với USD là cent.
- Khoá chưa có đơn nào: khối hiện "Chưa có đơn mua trực tiếp" thay vì bảng trống.

## AC4 — Khối Người học (ẩn danh)

- Số người đã ghi danh, tách theo nguồn: **nhập mã** (có `CourseAccessCode` redeemed của người đó cho khoá), **mua trực tiếp** (có `Order` paid), **khác** (giảng viên thêm, lớp, khoá miễn phí). Người có cả mã lẫn đơn tính vào cả hai nguồn, tổng không cộng trùng.
- **Đang học**: số người có hoạt động học trong 30 ngày qua, dùng `learnerActivityWhere()` (không đếm sự kiện do giáo viên hay hệ thống tạo).
- Số người đã hoàn thành khoá; số ghi danh đã hết hạn; số đã bị thu hồi do hoàn tiền.
- Biểu đồ ghi danh mới theo tuần.
- Đây là số đếm, không phải tỉ lệ của nhóm nhỏ, nên hiện kể cả khi dưới k; nhưng **không** kèm danh sách người.

## AC5 — Khối Học liệu: mức nắm vững theo bài

- Chỉ hiện khi khoá bật cá nhân hoá (`personalizationEnabled`); khoá tắt thì khối ghi "Khoá chưa bật cá nhân hoá" và một dòng giải thích.
- **Given** bài có từ k người trở lên có `LearnerSkillState` cho skill `lesson.<lessonId>`, **Then** hiện tỉ lệ ba nhãn **Cần ôn / Nên luyện / Vững**, dùng đúng `MASTERY_REVIEW_BELOW` và `MASTERY_SOLID_AT` (không viết lại số).
- **Given** bài có ít hơn k người có dữ liệu, **Then** hiện "Chưa đủ dữ liệu (dưới 10 người)", không hiện tỉ lệ hay số đếm từng nhãn.
- Không hiện xác suất nắm vững trung bình hay bất kỳ con số mastery nào, đồng bộ với nguyên tắc "không hiện %" của lộ trình học viên.
- Bài được sắp theo thứ tự trong khoá; bài có tỉ lệ "Cần ôn" cao nhất được đánh dấu để biên tập viên xem lại nội dung.

## AC6 — Khối Học liệu: câu hỏi bị sai nhiều

- Với mỗi quiz gắn bài: liệt kê tối đa 5 câu có tỉ lệ trả lời đúng thấp nhất, **chỉ tính câu có từ `ITEM_ANALYTICS_MIN_ATTEMPTS` lượt trả lời trở lên và từ k người khác nhau**.
- Mỗi câu: đề rút gọn, tỉ lệ đúng, phương án sai được chọn nhiều nhất và nhầm lẫn gắn với phương án đó (nếu tác giả đã khai báo).
- Chỉ tính **lượt làm đầu tiên** của mỗi người cho mỗi quiz, để người làm lại nhiều lần không kéo lệch số.
- Dùng lại công thức của phân tích câu hỏi ngân hàng nếu áp được; nếu không, ghi rõ trong mã vì sao tách.

## AC7 — Khối Học liệu: mức dùng phản hồi

- Tỉ lệ **phản hồi có gợi ý bài nên xem lại** (`FeedbackDelivery` có `remediationLessonIds` khác rỗng) mà người học **đã bấm** (`feedback.remediation.clicked` khớp delivery đó), theo tháng.
- Dưới k người nhận phản hồi trong tháng thì hiện "Chưa đủ dữ liệu".
- Nhãn trên giao diện: "Tỉ lệ người học mở bài nên xem lại sau khi làm sai", kèm một câu giải thích ngắn. Không dùng chữ "uptake".

## AC8 — Gắn khoá vào tổ chức (thêm 16/11/2026)

**Đã chốt:** chỉ **Platform Admin** gắn hoặc gỡ. Gắn khoá vào tổ chức là cho OrgAdmin và người xem báo cáo của tổ chức thấy doanh thu và số liệu học tập tổng hợp, nên đây là quyết định chia sẻ dữ liệu; chủ khoá và OrgAdmin không tự làm được.

- **Given** Platform Admin ở trang "Quản lý khoá học", **When** chọn một tổ chức ở ô "Tổ chức" của một khoá và xác nhận, **Then** `Course.organizationId` đổi theo, người xem báo cáo của tổ chức đó thấy khoá ở trang Báo cáo.
- Chọn "Chưa thuộc tổ chức nào" là gỡ; người xem của tổ chức cũ không còn thấy khoá.
- Trước khi đổi luôn có hộp xác nhận nói rõ ai sẽ thấy số liệu gì.
- Mỗi lần đổi thật ghi `AuditLog` (`course.organization.changed`) và sự kiện cùng tên, payload chỉ `courseId`, tổ chức cũ, tổ chức mới. Lưu lại cùng giá trị thì không ghi gì.
- Chủ khoá, OrgAdmin hay người khác gọi API: 403.

---

## Chung cho mọi khối

- **Khoảng thời gian:** 30 ngày, 90 ngày, từ đầu (mặc định 90 ngày); áp cho biểu đồ và bảng theo thời gian, không áp cho số tích luỹ như "đã kích hoạt" của lô.
- **Hiệu năng:** mỗi khối một route riêng để trang hiện dần; truy vấn dùng index đã có (`Order (courseId, status)`, `CourseAccessCode (batchId, status)`, `LearningEvent (eventType, occurredAt)`); thêm index mới phải khai báo trong `schema.prisma`. Kết quả có thể cache tối đa 10 phút; trang ghi "Cập nhật lúc …".
- **Giao diện:** theo quy ước §4.6 (breakpoints, `.text-h*`, `<EmptyState>`, `<Skeleton*>`); xem được trên điện thoại (bảng cuộn ngang trong khung, trang không cuộn ngang).
- **Sự kiện:** `report.publisher.viewed` (khi mở trang) và `report.publisher.exported` (khi xuất CSV); subject là người xem, payload chỉ `organizationId`, `courseId`, loại tệp. Thêm tiền tố `report.` vào `NON_LEARNER_ACTIVITY_PREFIXES`.
- **Trợ lý Lily** (CLAUDE.md §4.9): trang mới của giảng viên/quản trị tổ chức ⇒ cập nhật `GIAO-DIEN.md`, `teacherAssistantGuide.ts` và `ASSISTANT_DESTINATIONS`; test freshness phải xanh.
- **Kiểm thử:** test quyền (AC1), test không lộ PII trên JSON của mọi route báo cáo, test ngưỡng k ở AC5–AC7, test tiền tệ tách riêng ở AC3, test lượt đầu ở AC6.

## Đã làm (16/11/2026)

- **Dữ liệu:** bảng `OrganizationReportViewer` (migration `20261116120000_org_report_viewer`, chỉ thêm bảng). Đã áp vào DB dev và DB test.
- **Lõi** `packages/core-lms/src/reports/`:
  - `access.ts`: `canViewCourseReport`, `isOrgReportViewerOf`, `listReportCourses`, `hasAnyReportAccess`.
  - `viewers.ts`: cấp, thu, liệt kê người xem; chỉ OrgAdmin hoặc Platform Admin làm được; mỗi lần ghi `AuditLog` và `report.viewer.*`.
  - `publisher.ts`: bốn khối số liệu và CSV đối soát; `REPORT_MIN_GROUP = 10`.
- **API:**
  - `GET /api/reports/courses/[courseId]/[block]`, với block là `activation`, `revenue`, `learners`, `mastery`, `questions` hoặc `remediation`.
  - `GET …/revenue-export`.
  - `GET/POST /api/orgs/[id]/report-viewers` và `DELETE …/[userId]`.
- **Giao diện:**
  - Trang `/bao-cao`: chọn khoá, chọn khoảng thời gian, bốn phần.
  - Phần "Người xem báo cáo" ở "Thành viên trường".
  - Mục "Báo cáo nhà xuất bản" ở thanh trái quản trị trường và ở menu tài khoản.
  - Liên kết "Xem báo cáo phát hành và doanh thu" trong khối "Mã kích hoạt".
- **Lily:** mục `ma-kich-hoat-va-bao-cao` trong `teacherAssistantGuide.ts`, nguồn từ `GIAO-DIEN.md` §18. Không thêm điểm đến vì danh mục điểm đến của Lily chỉ nhận trang trong khu giảng viên, còn `/bao-cao` nằm ngoài để người của nhà xuất bản không phải giảng viên vẫn mở được.
- **Khác bản nháp:**
  - "Đang học" bỏ cả sự kiện `enrollment.*`, vì ghi danh hay gia hạn chưa phải là học. Lỗi này lộ ra khi chạy test.
  - Không cache kết quả ở máy chủ; mỗi khối ghi "Cập nhật lúc …".
  - Câu hỏi bị sai nhiều tự tính trên `AnswerResponse`, vì phân tích câu hỏi sẵn có chỉ chạy trên đề thi.
- **Kiểm thử:**
  - Lõi: 15 test trên DB, gồm quyền và không hồi quy với ba hàm `can*Course`, không lộ PII trong JSON và CSV, ngưỡng k ở AC5–AC7, tiền tệ tách riêng, chỉ tính lượt đầu, mốc tuần theo giờ Việt Nam.
  - Route: 8 test.
  - Đã xem trang trên máy dev ở 1440 px và 390 px bằng tài khoản admin demo: các khối tải đủ, không tràn ngang.
- **Chưa làm / chưa kiểm:**
  - AC8 đã làm: hàm `setCourseOrganization` (`core-lms/src/org/courseOrganization.ts`, 3 test), route `PATCH /api/admin/courses/[courseId]/organization` (4 test), ô "Tổ chức" trong cột "Giá, gói bán & tổ chức" của trang "Quản lý khoá học". Đã xem ô chọn trên dev, chưa bấm đổi khoá nào. Khoá mẫu Toán 10 và Speakout vẫn chưa thuộc tổ chức nào vì chưa có tổ chức nhà xuất bản trên dev.
  - Chưa xem bằng mắt phần "Người xem báo cáo" (tài khoản demo không là quản trị trường nào).
  - Chưa thử với dữ liệu thật đủ 10 người.

## Để P1

- Báo cáo tổng hợp nhiều đầu sách của cùng nhà xuất bản trên một màn hình.
- Gửi báo cáo tháng qua email cho người có quyền xem.
- Tính phần doanh thu theo tỉ lệ hợp đồng và xuất biên bản đối soát.
- Theo dõi lô mã theo đại lý hoặc kênh phân phối (cần thêm trường cho lô).
- Phễu: số mã in → kích hoạt → học bài đầu → hoàn thành chương 1.

## Chưa kiểm khi viết

- `OrganizationAdmin` hiện được làm gì với khoá của tổ chức (`core-lms/src/org/admins.ts` mới có cấp, thu, liệt kê admin); quyền "Xem báo cáo" có thể là một cờ trên bảng này hoặc một bảng riêng, chốt khi code.
- **Đã kiểm:** khoá mẫu Toán 10 và khoá Speakout trên dev đều **chưa gán** `organizationId`. Theo Q1, cần thêm bước gán khoá vào tổ chức nhà xuất bản (ở trang khoá hoặc trang quản trị tổ chức); nếu thiếu bước này, trang báo cáo của nhà xuất bản sẽ trống.
- Công thức của `listBankItemAnalytics` có áp được cho `AnswerResponse` của quiz trong khoá hay không.
