# Gói tài khoản và hạn mức — thiết kế và tiêu chí nghiệm thu (nháp 26/11/2026)

Liên quan: `docs/kinh-doanh/phuong-an-chao-hang.md` (gói và giá chào hàng), `docs/kinh-doanh/bang-chi-phi-gia-san.md` (số đo prod 17/10/2026).

## 1. Mục đích

Limio chuẩn bị thu tiền ba nhóm khách: cơ sở giáo dục và trung tâm mua **gói tổ chức** theo hợp đồng, giảng viên lẻ tự mua **gói cá nhân**. Hệ thống cần biết mỗi giảng viên đang ở gói nào, gói đó cho dùng gì và tới mức nào, rồi **chặn thật** khi vượt mức (người dùng đã chốt: chặn ngay, không chạy chế độ chỉ ghi nhận). Tài khoản hiện có không bị chặn đột ngột: họ được dùng thử đến hết 28/02/2027.

## 2. Đã chốt với người dùng

| Quyết định | Nội dung |
|---|---|
| Chế độ | Chặn ngay khi lên prod; có trang mua và nút nâng cấp |
| Người đang dùng | Mọi giảng viên và tổ chức hiện có được dùng thử đến hết 28/02/2027; tài khoản đăng ký mới bắt đầu ở Free |
| Cách dựng | Cách A: gói là một tầng trong hệ thống cờ tính năng (`resolveFeatures`), số đã dùng đếm từ dữ liệu thật |
| Ai trả | Tổ chức trả theo hợp đồng (admin gán gói); giảng viên lẻ tự mua qua SePay; học viên không bao giờ trả tiền tài khoản |
| Mức dùng thử | **Không giới hạn**: mọi tính năng bật, mọi hạn mức bằng trần kỹ thuật; không ai bị chặn trước 01/03/2027. Hệ thống ghi lại ai vượt mức Pro hoặc mức Khoa để làm danh sách khách cần chào gói lớn |
| Tính năng trung tâm | **Chỉ gói Trung tâm** (và gói dùng thử) mới có lịch lớp, điểm danh, nhận xét sau buổi; công tắc `centerEnabled` của OrgAdmin chỉ có tác dụng khi gói tổ chức có `center.access` |

## 3. Mục tiêu, ngoài phạm vi, điều cấm

**Mục tiêu**
- Mỗi giảng viên có đúng một bộ quyền hiệu lực, tính từ gói cá nhân và gói của tổ chức mình (lấy mức cao hơn).
- Các hạn mức trong phương án chào hàng được kiểm ở server, có thông báo rõ và đường nâng cấp.
- Admin tạo, sửa gói và gán gói cho tổ chức hay người dùng trên giao diện; mọi thay đổi có `AuditLog`.
- Giảng viên lẻ mua và gia hạn gói qua cổng SePay sẵn có.

**Ngoài phạm vi (lần này)**
- Trừ tiền tự động định kỳ (SePay không có), tính tiền chênh khi đổi gói giữa kỳ, hoàn tiền tự động, xuất hoá đơn VAT.
- Đo lượt của Limio Vấn đáp (`VanDap*`): hiện chưa có mã nào tạo phiên thi, nên chưa có gì để đếm. Khi làm phiên thi thì dùng chung khoá hạn mức vấn đáp.
- Gói cho học viên.

**Điều cấm (dù chạy đúng kỹ thuật vẫn là hỏng)**
- Học viên bị cắt **giữa chừng** một hoạt động đã bắt đầu (lượt thi đang làm, lượt vấn đáp đang chạy, bài đang tải lên) vì gói của giảng viên.
- Hạ gói làm **mất hay khoá nội dung cũ**: khoá học, file, bài giảng, kết quả vẫn xem và dùng được; chỉ chặn tạo mới hay tải thêm.
- Số đã dùng lệch với dữ liệu thật vì một bộ đếm riêng quên cộng.
- Quyền "gói" lọt sang gate chức năng không bán được (vd mở công cụ giảng dạy cho học viên).

## 4. Các cách đã cân nhắc

| Cách | Ưu | Nhược | Kết luận |
|---|---|---|---|
| **A. Gói là một tầng trong `resolveFeatures`**; hạn mức là cờ kiểu `int`; số đã dùng đếm từ bảng thật lúc kiểm | 238 chỗ kiểm quyền tự theo gói; cấp riêng cho người dùng vẫn chạy; không có bộ đếm phải đồng bộ | Phải thêm chiều tổ chức vào hàm tra; chỗ đếm nóng cần đệm | **Người dùng chọn** |
| B. Hệ thống hạn mức riêng với bảng đếm | Đọc nhanh, báo cáo tính tiền dễ | Hai hệ thống cùng trả lời "được dùng không"; bộ đếm lệch khi quên cộng | Loại |
| C. Dịch vụ thuê bao ngoài (Stripe Billing...) | Có sẵn gia hạn tự động | Stripe không mở tài khoản cho pháp nhân Việt Nam | Loại |

## 5. Thiết kế

### 5.1. Dữ liệu (migration mới)

- **`Plan`**: `key` duy nhất (vd `free`, `pro`, `pro_plus`, `trial_individual`, `org_trial`, `org_khoa`, `org_truong`, `center_start`, `center_growth`), `name`, `scope` (`individual` | `organization`), `entitlements` (JSON: `featureKey → giá trị`), `isPublic` (hiện trên trang so sánh gói), `sortOrder`, `active`.
- **`PlanPrice`**: `planId`, `period` (`month` | `year`), `amountVnd`, `active`. Chỉ gói cá nhân có giá; gói tổ chức gán theo hợp đồng.
- **`Subscription`**: `planId`, đúng một trong `userId` / `organizationId`, `source` (`trial` | `purchase` | `contract` | `admin`), `startsAt`, `endsAt` (bắt buộc; gói vĩnh viễn thì đặt xa), `orderId?`, `grantedById?`, `note?`, `cancelledAt?`. Hiệu lực khi `startsAt ≤ now < endsAt` và chưa huỷ. Một chủ thể có thể có nhiều dòng hiệu lực cùng lúc (vd mua Pro+ khi còn Pro); hàm tra gộp theo quy tắc ở 5.2.
- **`Order.planPriceId`** (nullable) cho đơn mua gói, đi chung bảng `Order` và `settleGatewayPayment` (giữ quy tắc "quyền chỉ cấp ở IPN"). `Order.courseId` đã nullable từ khi có combo.
- Cờ tính năng mới (kiểu `int`, `sellable = true`) liệt kê ở 5.3. Bật `sellable = true` cho `ai_oral.access`. Ràng buộc: `Plan.entitlements` **chỉ được chứa khoá `sellable = true`** (kiểm khi lưu, có test).

### 5.2. Thứ tự tra quyền

`resolveFeatures(userId, keys)` thành:

1. Cấp riêng cho người dùng còn hạn (`UserFeatureOverride`) — giữ nguyên, dùng để tặng thêm hoặc xử lý sự cố.
2. **Gói** — chỉ áp cho người có vai trò giảng dạy: có vai trò Instructor, CenterTeacher hoặc OrgAdmin ở bất kỳ phạm vi nào, hoặc là `CourseInstructor` của ít nhất một khoá (Platform Admin coi như không giới hạn). Với khoá `sellable`, gói là nguồn quyết định: giá trị của gói thay cho tầng vai trò và mặc định (bán được nghĩa là gói tắt được). Trước migration, liệt kê mọi `RoleFeatureOverride` đang đặt trên khoá `sellable` để chắc gói dùng thử phủ hết, không ai mất quyền trước 01/03/2027. Lấy mọi `Subscription` hiệu lực của chính người đó và của `User.organizationId`, gộp theo cách đang có: boolean OR, int MAX, mảng UNION. Giảng viên **không có gói hiệu lực nào** thì dùng `entitlements` của gói `free`.
3. Theo vai trò (`RoleFeatureOverride`) — giữ nguyên.
4. Mặc định của cờ — giữ nguyên.

Học viên không bao giờ đi qua tầng 2, nên gói không làm thay đổi gì phía học viên. Kết quả tầng 2 đệm trong Redis theo người dùng khoảng 60 giây, xoá đệm khi gói của người đó hoặc tổ chức của họ đổi.

Thêm hàm `getEffectivePlan(userId)` trả gói "đứng tên" (gói có `sortOrder` cao nhất trong các gói hiệu lực, kèm nguồn: cá nhân hay tổ chức, và `endsAt`) để hiện trên giao diện. Quyền thật vẫn luôn tính bằng phép gộp ở trên.

### 5.3. Hạn mức và nơi kiểm

Một hàm dùng chung `checkQuota(userId, metric)` trả `{ allowed, limit, used, source: "individual" | "organization", planKey }`. Với hạn mức **quỹ chung** (vấn đáp, dung lượng), hai nguồn tính riêng: nguồn cá nhân so số của chính người đó với hạn mức gói cá nhân, nguồn tổ chức so tổng của mọi thành viên với quỹ của tổ chức. Được phép khi một trong hai nguồn còn chỗ; trả về nguồn còn chỗ (ưu tiên cá nhân trước). `/me/goi` hiện cả hai thước đo. "Tổ chức" của một người luôn là `User.organizationId`, không tính tổ chức mà họ chỉ làm quản trị qua `OrganizationAdmin`. `used` đếm từ bảng thật, theo **tháng giờ Việt Nam** (`lib/datetime.ts`) với hạn mức theo tháng. Từ chối trả mã `plan_limit_reached` kèm các trường đó; giao diện hiện `<PlanLimitNotice>` (mục 5.5).

**Quy tắc chung:** chặn ở **lúc tạo** hoặc **lúc mở**. Hạn mức theo quy mô của một hoạt động được **chụp vào hoạt động lúc tạo** (giống `ExamSession.maxCandidates` đang có), nên đổi gói sau đó không làm đổi hoạt động đang chạy. Các trần kỹ thuật cứng hiện có (500 phiếu, 500 lượt word cloud, 2.000 ghi chú, 300 người Gameshow, 5.000 phần tử bảng trắng) giữ nguyên làm trần trên; giá trị gói không vượt các trần này.

| Khoá | Ý nghĩa | Kiểm ở | Đếm từ | Gói tổ chức tính |
|---|---|---|---|---|
| `activity.max_responses` | Số phản hồi tối đa mỗi hoạt động (phiếu bầu, lượt word cloud, ghi chú bảng) — áp cho cả hoạt động nhanh lẫn slide tương tác trong Limio-Live vì dùng chung bảng | Chụp vào hoạt động lúc tạo (`quick-poll/create`, `word-cloud/create`, `teaching-tools/boards`, và route tạo slide runtime của Live); kiểm lúc học viên gửi | `ClassroomPollVote` / `WordCloudSubmission` / `BoardNote` theo hoạt động | Theo người tạo |
| `gameshow.max_participants` | Người mỗi phòng Gameshow | Chụp lúc tạo phòng; kiểm lúc vào phòng (thay hằng số 300 bằng `min(giá trị chụp, 300)`). Thêm `requireFeature("teaching_tools.access")` vào route tạo (hiện chỉ kiểm đăng nhập) | `GameParticipant` theo phòng | Theo người tạo |
| `exam.session.max_candidates` | Thí sinh mỗi ca thi | Chụp vào `ExamSession.maxCandidates` lúc tạo ca (`createExamSession`, `createExamSessionInRound`, `createFormalSession`): lấy `min(giá trị giảng viên nhập, giá trị gói)`; kiểm lúc thí sinh nhận mã — logic `maxCandidates` đã có | `ExamCandidate` theo ca | Theo người tạo ca (cần thêm cột `ExamSession.createdById`) |
| `ai_oral.monthly_attempts` | Lượt vấn đáp AI mỗi tháng | Lúc giảng viên mở phiên (`openOralExamSession`: cần còn ít nhất 1 lượt) và lúc học viên **bắt đầu** một lượt mới (`startOralExamAttempt`, `joinOralSessionByCode`). Lượt đã bắt đầu thì chạy tới hết | `ExamAttempt` của đề `kind = oral`, `startedAt` trong tháng, chủ chi phí = `Exam.createdById`, rỗng thì chủ khoá | **Quỹ chung**: cộng mọi lượt của đề do thành viên tổ chức sở hữu |
| `ai.tokens.monthly_override` (đã có, chưa nơi nào đọc) | Token AI mỗi tháng cho soạn bài giảng, bài học, câu hỏi, chấm AI | `resolveMonthlyAllowance` trong `tokenWallet.ts` đọc khoá này trước, rỗng thì dùng `SiteSetting` như cũ; ví vẫn theo từng người | Sổ token đang có | Mỗi thành viên nhận mức của gói tổ chức (không gộp quỹ token) |
| `storage.mb` | Dung lượng | Lúc giảng viên tải **nội dung của mình** lên (media bài học, slide, ảnh bìa, tài liệu vấn đáp, gói SCORM/H5P). **Không** kiểm bài nộp hay tệp của học viên | Tổng `StoredFile` theo `billedUserId` **trừ tệp do học viên tải lên** (bài nộp, ghi âm luyện tập); tệp học viên vẫn hiện riêng trên thước đo nhưng không làm giảng viên bị chặn | **Quỹ chung**: cộng mọi thành viên |
| `org.max_instructors` | Số giảng viên của tổ chức | Lúc OrgAdmin hoặc admin thêm người có vai trò giảng dạy vào tổ chức (thêm tay, nhập hàng loạt) | Người có `User.organizationId` là tổ chức đó và có vai trò Instructor hoặc CenterTeacher; đồng giảng viên từ ngoài tổ chức không tính | Chỉ gói tổ chức |
| `org.active_learners` | Học viên hoạt động trong tháng (gói trung tâm) | **Không chặn.** Vượt thì báo OrgAdmin và hiện trong báo cáo admin để bán nâng cấp | `LearningEvent` với `learnerActivityWhere()`, `course.organizationId`, theo tháng | Chỉ gói tổ chức |

**Tính năng trung tâm theo gói.** `isCenterEnabledForUser` (`core-lms/src/org/centerAccess.ts`) hiện bật khi có một trong bốn điều kiện, trong đó có `Organization.centerEnabled` do OrgAdmin tự bật. Khi `PLANS_ENABLED` bật: mọi điều kiện bật tính năng trung tâm phía giảng viên đều phải đi kèm `center.access` của gói hiệu lực (gói tổ chức hoặc cá nhân); công tắc `centerEnabled` vẫn giữ để tổ chức có gói tự tắt/bật, và trang cài đặt nói rõ "Cần gói Trung tâm" khi gói không có. Dữ liệu đã tạo (lịch, điểm danh, nhận xét) không bị xoá khi gói hết; giảng viên chỉ mất lối tạo mới, học viên vẫn xem được lịch và nhận xét đã gửi.

Kèm theo để số đếm đúng:
- **Dung lượng:** chạy `pnpm backfill:stored-files` trên prod và đối chiếu (sổ ghi 1,15 GB trong khi thư mục uploads khoảng 9 GB) **trước khi** bật chặn dung lượng; thêm cron chạy `attributeStoredFiles` hằng đêm để bài nộp và tệp đồng giảng viên tính về chủ khoá.
- **Vấn đáp:** lượt vấn đáp hiện trừ token vào ví **học viên** (`examinerChat.ts`, `recordAiUsage(studentUserId)`). Lần này không đổi đường trừ token (lượt vấn đáp đã có hạn mức riêng ở trên), nhưng ghi lại thành lỗi riêng cần sửa.

### 5.4. Dùng thử và hết hạn

- **Công tắc theo máy chủ:** biến môi trường `PLANS_ENABLED` (mặc định tắt, khai trong `x-web-env` của `docker-compose.prod.yml`). Tắt thì hàm tra bỏ qua tầng gói, không hiện trang gói hay nút nâng cấp, không chạy migration dùng thử. Chỉ bật trên limio.vn (server 224); máy chủ riêng của trường (limio.hust.edu.vn) giữ tắt vì đã có hợp đồng riêng.

- Migration dữ liệu (idempotent, có bản chạy thử): mỗi người dùng có vai trò giảng dạy ở thời điểm chạy nhận một `Subscription` gói `trial_individual`; mỗi tổ chức hiện có nhận `org_trial`. `source = trial`, `endsAt = 01/03/2027 00:00` giờ Việt Nam.
- Hai gói dùng thử **không giới hạn**: mọi khoá boolean mà các gói bán có đều bật (`limio_live.access`, `ai_oral.access`, `center.access`; các khoá sellable khác như `lms.enrollment.direct_payment` không nằm trong gói nào nên giữ như cũ), mọi khoá int bằng trần kỹ thuật (mục 5.3). Mỗi gói dùng thử có thêm trường `referencePlanKey` (`pro` với cá nhân, `org_khoa` với tổ chức): khi số đã dùng vượt mức của gói tham chiếu, `checkQuota` vẫn cho phép nhưng ghi `plan.limit.reached` với `enforced = false`. Admin xem danh sách đó ở `/admin/plans` (ai vượt, vượt khoá nào, bao nhiêu) để chào gói lớn trước 01/03/2027.
- Hết hạn không cần job: hàm tra so ngày, quá `endsAt` thì tự rơi về gói còn lại hoặc `free`.
- Cron hằng ngày (sidecar `docker/cron`) gửi email nhắc trước 14 ngày và 3 ngày khi gói sắp hết, mỗi mốc tối đa một lần mỗi gói.
- Thanh báo ở đầu trang giảng viên khi gói còn ≤ 30 ngày: "Gói … của thầy/cô còn n ngày" kèm nút "Xem gói".

### 5.5. Giao diện

- **`/me/goi`** (giảng viên): gói đang dùng, nguồn (cá nhân hay của tổ chức), ngày hết hạn, thước đo đã dùng/hạn mức của từng hạn mức theo tháng, bảng so sánh các gói `isPublic`, nút mua hoặc gia hạn theo tháng/năm qua SePay. Giảng viên chỉ dùng gói tổ chức thì thấy "Gói do … cung cấp" và không có nút mua cho tổ chức.
- **`<PlanLimitNotice>`** (dùng chung): nói rõ chạm hạn mức nào, đã dùng bao nhiêu trên bao nhiêu, nút "Nâng cấp gói" tới `/me/goi`; nếu hạn mức đến từ gói tổ chức thì thay bằng "Liên hệ quản trị viên của …".
- **Phía học viên** khi một hoạt động hay ca thi đã đủ chỗ: câu rõ nghĩa "Hoạt động đã nhận đủ số lượt gửi" / "Ca thi đã đủ số thí sinh, vui lòng báo giảng viên", không lộ tên gói hay giá.
- **Cảnh báo trước cho giảng viên:** khi tạo hoạt động hoặc ca thi, ô số lượng hiện trần của gói; khi số lượt vấn đáp trong tháng đạt 80% thì gửi một thông báo.
- **`/admin/plans`**: danh sách gói, sửa `entitlements` theo danh sách khoá `sellable` (ô số, công tắc), sửa giá, bật/tắt.
- **Admin gán gói:** trên trang tổ chức (`/admin/orgs/[id]`) và trang người dùng: chọn gói, ngày bắt đầu, ngày kết thúc, ghi chú hợp đồng; gia hạn, huỷ. Mỗi thao tác ghi `AuditLog`.
- **OrgAdmin** (`/org/settings` hoặc trang mới): gói của tổ chức, ngày hết hạn, quỹ đã dùng (vấn đáp, dung lượng), số giảng viên, học viên hoạt động tháng này.
- **Lily:** đổi giao diện giảng viên ⇒ cập nhật `docs/hoc-lieu/huong-dan-limio/GIAO-DIEN.md` trước, rồi `teacherAssistantGuide.ts` và `ASSISTANT_DESTINATIONS` (trang `/me/goi`); test `teacherAssistantFreshness` phải xanh.

### 5.6. Mua gói

- `POST /api/orders/checkout` nhận thêm `{ planPriceId, provider: "sepay_pg" }`. Đơn khoá giá lúc tạo như đơn khoá học.
- `settleGatewayPayment` có nhánh đơn gói: trong cùng giao dịch, gia hạn `Subscription` cùng gói của người mua (`endsAt = max(now, endsAt hiện tại) + kỳ`) hoặc tạo mới nếu chưa có. Mua gói cao hơn khi đang có gói thấp hơn: tạo dòng mới bắt đầu ngay; dòng cũ giữ nguyên tới hạn (gộp MAX nên không thiệt quyền); không hoàn tiền phần còn lại.
- Chỉ IPN cấp quyền; trang quay về chỉ chuyển hướng (đúng khuôn VNPay/SePay hiện có).

### 5.7. Sự kiện

Namespace mới `plan.*`, thêm vào `NON_LEARNER_ACTIVITY_PREFIXES`; payload chỉ id, khoá gói, nguồn, ngày, số đếm:
- `plan.subscription.started` (trial, purchase, contract, admin), `plan.subscription.extended`, `plan.subscription.cancelled`.
- `plan.limit.reached` (khoá hạn mức, `limit`, `used`): tối đa một lần mỗi người, mỗi khoá, mỗi ngày — dùng để biết ai cần nâng cấp.
Subject là người được gán gói (với gói tổ chức: người thao tác). Thêm `Subscription` và đơn gói vào `exportProfile`; `deleteUser` xoá `Subscription` cá nhân, giữ `Order` theo quy tắc kế toán hiện hành.

## 6. Giá trị gói ban đầu (seed, admin sửa được)

Lấy từ phương án chào hàng; "—" là không áp dụng.

Hai gói `trial_individual` và `org_trial` không nằm trong bảng: chúng bật mọi tính năng và lấy trần kỹ thuật cho mọi hạn mức (mục 5.4).

| Khoá | free | pro | pro_plus | org_khoa | org_truong | center_start | center_growth |
|---|---|---|---|---|---|---|---|
| `activity.max_responses` | 100 | 300 | 500 | 500 | 500 | 300 | 500 |
| `gameshow.max_participants` | 40 | 150 | 300 | 300 | 300 | 150 | 300 |
| `exam.session.max_candidates` | 50 | 300 | 1.000 | 1.000 | 1.000 | 300 | 1.000 |
| `ai_oral.monthly_attempts` | 2 | 30 | 100 | 125 (≈1.500/năm) | 833 (≈10.000/năm) | 100 | 400 |
| `ai.tokens.monthly_override` | 300.000 | 1.000.000 | 3.000.000 | 1.000.000 mỗi người | 1.000.000 mỗi người | 1.000.000 mỗi người | 1.000.000 mỗi người |
| `storage.mb` | 2.048 | 20.480 | 51.200 | 204.800 | 1.048.576 | 51.200 | 204.800 |
| `org.max_instructors` | — | — | — | 30 | 200 | 5 | 20 |
| `org.active_learners` | — | — | — | — | — | 100 | 500 |
| `limio_live.access`, `ai_oral.access` | bật | bật | bật | bật | bật | bật | bật |
| `center.access` | tắt | tắt | tắt | tắt | tắt | bật | bật |

Giá (`PlanPrice`): Pro 99.000đ/tháng hoặc 990.000đ/năm; Pro+ 2.900.000đ/năm.

## 7. Tiêu chí nghiệm thu

**AC1 — Tra quyền theo gói**
- Given giảng viên không có gói nào, When tra `activity.max_responses`, Then nhận giá trị của gói `free`.
- Given giảng viên có Pro cá nhân và tổ chức có `org_khoa`, When tra khoá int, Then nhận số lớn hơn; khoá boolean bật nếu một trong hai bật.
- Given học viên thuộc tổ chức có gói, When tra bất kỳ khoá nào, Then kết quả y như trước khi có gói.
- Given người dùng có `UserFeatureOverride` còn hạn, When tra khoá đó, Then override thắng gói.
- Given admin lưu gói có khoá `sellable = false` trong `entitlements`, Then bị từ chối.
- Given gói hết hạn hôm qua, When tra hôm nay, Then rơi về gói còn hiệu lực hoặc `free`, không cần chạy job.

**AC2 — Dùng thử**
- Given migration chạy hai lần, Then mỗi giảng viên và mỗi tổ chức hiện có đúng một gói dùng thử, `endsAt = 01/03/2027 00:00` giờ Việt Nam.
- Given tài khoản giảng viên tạo sau migration, Then ở gói `free`.
- Given gói còn 14 ngày, When cron chạy hai lần cùng ngày, Then chỉ một email nhắc.
- Given giảng viên đang dùng thử đã chạy 1.100 lượt vấn đáp trong tháng, When học viên bắt đầu lượt mới, Then vẫn được; có sự kiện `plan.limit.reached` với `enforced = false` và người đó hiện trong danh sách "vượt mức Pro" ở `/admin/plans`.
- Given `PLANS_ENABLED` tắt (máy chủ riêng của trường), Then không có tầng gói, không có trang gói, không chạy migration dùng thử; mọi quyền như trước.

**AC2b — Tính năng trung tâm theo gói**
- Given tổ chức có gói `org_khoa` (không có `center.access`) và OrgAdmin bật `centerEnabled`, Then giảng viên không thấy lịch lớp, điểm danh; trang cài đặt hiện "Cần gói Trung tâm".
- Given tổ chức đang dùng thử, Then tính năng trung tâm chạy như hôm nay.
- Given gói Trung tâm hết hạn, Then lịch và nhận xét đã gửi vẫn hiện với học viên; giảng viên không tạo buổi hay điểm danh mới được.

**AC3 — Chặn lúc tạo, không cắt giữa chừng**
- Given giảng viên Free đã dùng 2 lượt vấn đáp trong tháng, When học viên bấm bắt đầu lượt mới, Then bị từ chối với câu dành cho học viên; giảng viên thấy `<PlanLimitNotice>` ở trang đề.
- Given một lượt vấn đáp đã bắt đầu, When quỹ hết giữa lượt, Then lượt đó chạy tới hết và được lưu.
- Given giảng viên Free tạo ca thi và nhập 200 thí sinh tối đa, Then ca được lưu với `maxCandidates = 50` và giao diện nói rõ lý do.
- Given ca thi tạo khi còn Pro (300), When gói hạ về Free giữa chừng, Then ca vẫn nhận tới 300.
- Given hoạt động Free đã nhận 100 phiếu, When học viên thứ 101 gửi, Then bị từ chối với câu rõ nghĩa; 100 phiếu cũ còn nguyên.
- Given tổ chức `center_start` có 120 học viên hoạt động, Then không học viên nào bị chặn; OrgAdmin thấy cảnh báo vượt.

**AC4 — Dung lượng**
- Given giảng viên Free đã dùng 2.048 MB, When tải video bài học, Then bị chặn kèm đường nâng cấp; file cũ vẫn xem được.
- Given cùng giảng viên đó, When học viên nộp bài có tệp, Then vẫn nộp được.
- Given tổ chức có quỹ 200 GB, Then số đã dùng là tổng của mọi thành viên.

**AC5 — Số giảng viên của tổ chức**
- Given tổ chức `org_khoa` đã có 30 giảng viên, When OrgAdmin thêm người thứ 31 (tay hoặc nhập hàng loạt), Then bị chặn, có thông báo; nhập hàng loạt báo rõ dòng nào không thêm được.

**AC6 — Mua gói**
- Given giảng viên chọn Pro năm, When IPN SePay báo thành công đúng số tiền, Then có `Subscription` 1 năm và sự kiện `plan.subscription.started`.
- Given IPN gửi lặp lại, Then không gia hạn hai lần.
- Given đang có Pro còn 20 ngày, When mua thêm Pro tháng, Then `endsAt` lùi thêm một tháng tính từ ngày hết hạn cũ.
- Given trang quay về được mở mà IPN chưa đến, Then gói chưa đổi.

**AC7 — Quản trị**
- Given admin gán `org_truong` cho tổ chức từ 01/09/2027 đến 31/08/2028, Then có `AuditLog` và sự kiện; giảng viên của tổ chức thấy gói mới từ ngày bắt đầu.
- Given admin sửa `activity.max_responses` của Free, Then hoạt động tạo sau đó theo số mới; hoạt động cũ giữ số đã chụp.

**AC8 — Riêng tư và Lily**
- `exportProfile` có gói và đơn gói của người dùng; `deleteUser` xoá gói cá nhân.
- Payload sự kiện `plan.*` không chứa số tiền, tên hay email (test kiểm JSON).
- Test `teacherAssistantFreshness` xanh sau khi thêm trang và nút mới.

## 8. Thứ tự làm (đề xuất)

1. **Mốc 1 — xong 26/11/2026, xem `docs/superpowers/plans/2026-11-26-goi-tai-khoan-moc-1.md`.** Dữ liệu, hàm tra quyền theo gói, seed gói, migration dùng thử, `/admin/plans` và gán gói. Lên prod được ngay vì mọi người đang dùng thử nên chưa ai bị chặn, trừ tài khoản mới.
2. Các điểm kiểm hạn mức (5.3) và `<PlanLimitNotice>`; đối chiếu dung lượng trên prod trước khi bật `storage.mb`.
3. `/me/goi`, mua qua SePay, email nhắc, thanh báo hết hạn.
4. Trang OrgAdmin, báo cáo học viên hoạt động, cập nhật Lily.

## 9. Để người dựng tự quyết

Tên route và component cụ thể, cách đệm Redis, cách hiện thước đo, câu chữ thông báo (theo `docs`/ux-copy và thuật ngữ §4.6.1), cách chia commit.
