# Kế hoạch Limio-Live

2026-09-19 · tổng hợp qua trao đổi với Claude Code

## Tổng quan & định vị

Limio-Live là module bài giảng tương tác trực tiếp kiểu Nearpod: giáo viên soạn 1 "deck" gồm cả slide nội dung và slide hoạt động (quiz, thăm dò, bảng cộng tác...), rồi trình chiếu đồng bộ — học viên bị khoá theo đúng slide giáo viên đang chiếu.

Khác Kịch bản lớp học (đã build trước đó): Kịch bản là chuỗi công cụ rời chạy tuỳ ý, không khoá màn hình học viên. Limio-Live là 1 bài giảng tuần tự, đúng mô hình Nearpod.

Lợi thế cạnh tranh không nằm ở bề rộng tính năng — Nearpod đi trước nhiều năm, nhiều loại activity/VR/3D hơn hẳn — mà ở **độ sâu tích hợp** với phần còn lại của platform:

- Nối vào Feedback Engine (BKT/learner model) — Nearpod chỉ báo cáo đúng/sai, không cá nhân hoá.
- Skill tag tự động kế thừa từ Lesson khi import nội dung (lesson-as-tag).
- Gamification (XP/badge/streak) dùng chung cả khoá học, không cô lập trong 1 buổi như Nearpod.
- Tái dùng nội dung LMS trực tiếp (copy/liên kết Lesson) thay vì soạn lại từ đầu.
- Thiết kế cho thực tế không thiết bị của K12 Việt Nam (chi tiết ĸ mục Chế độ tham gia).
- 1 hệ sinh thái, 1 lần đăng nhập — không tách app riêng (chi tiết ở mục Kiến trúc).

## Vị trí kiến trúc

Limio-Live là **module thứ 4** bên trong app hiện có (Next.js modular-monolith — LMS/Feedback/Gamification là 3 module không import lẫn nhau, giao tiếp qua `LearningEvent` + bridge table). Quyết định: **không tách thành app riêng**.

Lý do: tách app phải nhân đôi auth/user, đồng bộ dữ liệu course/lesson giữa 2 hệ, giáo viên phải nhảy qua lại 2 chổ. Kiến trúc modular-monolith đã được thiết kế sẵn để hấp thụ domain mới mà không cần tách app — chỉ cần tuân thủ đúng luật ranh giới: không import trực tiếp `core-lms`/`core-feedback`/`core-gamification`, giao tiếp qua `LearningEvent` + bảng tham chiếu riêng (giống `ContentSkillMapping`).

Chỉ nên tách app riêng nếu đối tượng dùng thực sự khác (vd cho phép người ngoài dùng không cần tài khoản Limio) — hiện tại không phải trường hợp này.

## Loại slide (Content + Activity)

Khảo sát theo danh mục chính thức của Nearpod, đối chiếu với code hiện có trong repo.

| Loại | Nhóm | Trạng thái | Ghi chú |
| --- | --- | --- | --- |
| Nội dung (text/ánh) | Content | Kế hoạch P0/P1 | Soạn tay P0; import từ Lesson (sao chép/liên kết) P1 |
| Web content / PDF / Audio | Content | Gần miễn phí | LMS `ContentItem` đã có `embed`/`external_link`/`file`, chỉ cần cho phép chọn khi import (P1) |
| Video | Content | Đã quyết | V1: chỉ chiếu trên máy giáo viên, không đồng bộ từng máy học viên |
| 3D / Simulation / VR Field Trip / BBC / MS Sway / Twitter | Content | Không làm | Đầu tư lớn, giá trị thấp cho bối cảnh phổ thông VN |
| Quiz | Activity | Có (P0) |  |
| Poll | Activity | Có (P0) |  |
| Collaborate Board | Activity | Đã có sẵn | Chính là `InteractiveBoard` + `BoardNote` đang dùng cho Kịch bản lớp học — chỉ cần gắn làm 1 loại slide |
| Open-Ended Question | Activity | Chưa có | P1/P2 — độ khó gần QuickPoll |
| Draw It | Activity | Chưa có, việc mới hoàn toàn | `Whiteboard` hiện tại là canvas dùng chung, không phải mỗi học viên 1 bài riêng — xác nhận qua đọc schema. Cần model kiểu `AssignmentSubmission`/`WordCloudSubmission` (mỗi học viên 1 bản nộp) + màn hình giáo viên duyệt từng bài |
| Fill in the Blanks | Activity | Chưa có | P2 |
| Matching Pairs / Drag & Drop | Activity | Chưa có | Cần engine kéo-thả, P2/P3 |
| Memory Test | Activity | Chưa có | Ưu tiên thấp, P3 |
| Time to Climb | Activity | Không xây trong module Live | Thuộc về Gamification (đua tốc độ, leaderboard) — nối qua `LearningEvent` với module Gamification thay vì code riêng, đúng luật ranh giới module |

Không chọn 1 trong 3 — giáo viên **chọn theo từng buổi trình chiếu**, mở rộng đúng pattern 2 chế độ (`lessonId`/`studentList`) QuickPoll đang có sẵn thành 3 tựy chọn.

## Chế độ tham gia của học viên

Giáo viên chọn theo từng buổi trình chiếu. **Sửa lại sau phản hồi về pin/băng thông**: bỏ hẫn ý tưởng giữ kết nối real-time liên tục phía học viên — chuyển sang mô hình "đến slide nào quét slide đó".

| Chế độ | Cơ chế tham gia | Nội dung slide | Vào Feedback/Gamification? |
| --- | --- | --- | --- |
| 1. Đăng nhập tài khoản | Vào trang đồng bộ riêng (xem Sitemap) — cơ chế đồng bộ cụ thể (SSE hay polling định kỳ) **còn để mở**, cần cân nhắc lại vì cùng lo ngại pin/băng thông | Hiện trên máy HS, đồng bỘ nhập | Có |
| 2. Có thiết bị (không đăng nhập | Mỗi slide tương tác tự sinh QR/link riêng khi giáo viên Next tới — học viên quét, trả lời 1 lần, không giữ kết nối gì thêm. Tái dùng nguyên cơ chế QuickPoll/WordCloud/InteractiveBoard đang có, gấn 0 việc mới | Chỉ slide tương tác lên máy HS (qua QR); slide Nội dung chỉ chiếu máy GV | Không |
| 3. Không thiết bị (K12 VN) | Tái dùng manual-tally đã có ở QuickPoll (`isStateless`) | Chỉ chiếu trên máy giáo viên | Không |

Hệ quả tốt của cách sửa: Chế độ 2 không cần khái niệm "participantId xuyên suốt buổi" hay trang join-buổi riêng nữa — vì không dùng để làm gì (Chế độ 2 vốn đã không vào Feedback Engine). Phiên bản panel kết quả trực tiếp vẫn dùng SSE nhưng chỉ mở ở **máy giáo viên** (1 kết nối), không phải máy học viên.

Nhận định quan trọng: chỉ Chế độ 1 nuôi được đúng giá trị lõi của FeedBackMe (feedback cá nhân hoá qua BKT). Chế độ 2 và 3 vẫn có giá trị thật (tăng tương tác, dùng được ű lớp cấm điện thoại) nhưng dữ liệu không gắn được vC�o Feedback Engine/Gamification cho buổi đó.

**Lớp online**: không phải thêm chế độ mới — Chế độ 1 và 2 dùng được cho cả lớp online, chỉ khác cách đưa mã cho học viên:

- Lớp trực tiếp: chiếu mã QR lên máy chiếu, học viên quét bằng điện thoại.
- Lớp online: dán link (hoặc đọc mã PIN) vào khung chat của Zoom/Meet, học viên bấm vào link đó.

Không cần xây gì thêm vì QuickPoll hiện tại đã có sẵn cả QR lẫn nút "Copy link". Chế độ 3 (không thiết bị) không áp dụng được cho lớp online, vì học online bắt buộc phải có thiết bị mới vào được lớp.

## Sitemap / phân rã chức năng

**Giáo viên**

1. `/instructor/limio-live` (P0) — Danh sách bài giảng của tôi (tạo trống · bắt đầu từ mẫu)
2. `/instructor/limio-live/[deckId]` (P0) — Soạn bài giảng
   - Thêm slide, thêm từ Lesson có sẵn (P1)
   - Sắp xếp, cấu hình từng loại slide
   - Panel Chia sẻ — công khai/link/đồng biên soạn (P2, tái dùng schema Kịch bản)
3. `/instructor/limio-live/[deckId]/present` (P0) — Trình chiếu
   - Chọn Chế độ tham gia (P1)
   - Next/Prev, panel kết quả trực tiếp, mã QR
4. `/instructor/limio-live/sessions/[sessionId]/report` (P3) — Báo cáo sau buổi (đầy đủ chỉ ở Chế độ 1)
5. `/instructor/limio-live/market` (P2) — Thư viện mẫu / chợ chia sẻ
6. `/instructor/limio-live/shared/[shareCode]` (P2) — Xem qua link chia sẻ

**Học viên**

1. Chế độ 1 (đăng nhập): `/live/[sessionCode]` (P1) — trang đồng bộ slide hiện tại theo giáo viên; cơ chế đồng bộ cụ thể (SSE hay polling định kỳ) còn để mở, cân nhắc lại vì lo ngại pin/băng thông
2. Chế độ 2 (không đăng nhập) (P0) — **không có trang "vào buổi" riêng**: mỗi slide tương tác dùng thẳng route tool đã có sẵn (`/learn/poll/[pollId]`, `/learn/word-cloud/[cloudId]`, `/join/[code]` cho board), học viên quét QR hiện trên màn chiếu đúng lÚc slide đó đang chạy, không giữ kết nối gì sau khi gửi xong

Chế độ 3 (không thiết bị): không có route học viên nào cả, mọi thao tác dồn về trang trình chiếu của giáo viên.

**Menu trái**: Giảng dấy → nhóm mới "Limio-Live" (badge "Mới") → Bài giảng của tôi · Tạo bài giảng mới · Thư viện mẫu.

## Roadmap theo phase

**P0 — Lổi tối thiểu, dùng được ngay**

- [ ] Data model `LiveDeck` + `LiveSlide` (Content/Quiz/Poll/Collaborate Board) — độc lập, thuộc về giáo viên, giống mô hình `TeachingActivityPlan`
- [ ] Soạn deck: CRUD slide, kéo-thả sắp xếp, cấu hình riêng từng loại
- [ ] Trình chiếu — Giáo viên: next/prev, kết quả trực tiếp, mã tham gia + QR
- [ ] Màn hình học viên — chỉ Chế độ 2 (tái dùng QR ẩn danh QuickPoll), khoá nhịp theo giáo viên
- [ ] Nav: nhóm "Limio-Live" trong menu trái

**P1 — Mở röng nội dung & 2 chế độ tham gia còn lại**

- [ ] Import slide Nội dung từ Lesson có sẵn (Sao chép / Liên kết)
- [ ] Chế độ tham gia đăng nhập (Chế độ 1) — gắn `userId` thật
- [ ] Chế độ không thiết bị (Chế độ 3) — tái dùng manual-tally của QuickPoll
- [ ] Slide Open-Ended Question
- [ ] Đổi UI đáp án Trắc nghiệm/Thăm dò sang kiểu đểm tĩnh hơn (bẛt giống Menti)

**P2 — Chia sẻ, thư viện & slide nâng cao**

- [ ] Thư viện mẫu deck (tái dùng pattern chợ/share-code/đồng biên soạn đã xây cho Kịch bản lớp học)
- [ ] Slide Fill in the Blanks
- [ ] Slide Draw It (mỗi học viên 1 bài riêng, GV duyệt)

**P3 — Tích hợp sâu (đầy đủ ý nghĩa chỉ ở Chế độ 1)**

- [ ] Báo cáo sau buổi học theo từng học viên
- [ ] Móc XP/badge (Gamification) cho lượt tham gia
- [ ] Slide Matching Pairs / Drag & Drop / Memory Test
- [ ] Giao deck làm bài tự học độc lập (không cần buổi live) — tương đương "homework mode" của Nearpod, quy mô lớn, để xa

## Template sư phạm

Ý tưởng template theo mô hình/phương pháp sư phạm (Think-Pair-Share, KWL, Exit Ticket...) đã xây cho Kịch bản lớp học chuyển sang Limio-Live tự nhiên — cùng cấu trúc `key/name/category/mode/source/items`, chỉ đổi đơn vị: `items[].toolType` (Kịch bản, chạy tùy ý) → `items[].slideType` (Limio-Live, chạy tuần tự khoá nhịp).

Đã chọn hướng đơn giản nhất: **2 catalog riêng** (`PLAN_TEMPLATES` cho Kịch bản, thêm `LIVE_DECK_TEMPLATES` mới cho Limio-Live) — chấp nhận nội dung sư phạm trùng lặp giữa 2 catalog để giữ đơn giản, thay vì gộp 1 nguồn rồi cho chọn đầu ra (phương án phức tạp hơn, để sau nếu thấy trùng lặp thật sự phiền).

Cơ hội mở röng riêng cho Limio-Live: vì giờ có content-slide + import Lesson + chạy tuần tự, các khung sư phạm trọn bài (5E: Engage-Explore-Explain-Elaborate-Evaluate...) mới thực sự vừa vặn — trước đây không đưa vào Kịch bản và nó chỉ hợp hoạt động rời/khởi động, không hợp "1 bài giảng đầy đủ".

## Phân quyền tính năng (D1)

Repo đã có sẵn hệ thống governance độc lập với Role/RBAC: `FeatureFlag` (registry key toàn cục) + `RoleFeatureOverride` + `UserFeatureOverride` (có hạn dùng). Thứ tự phân giải: **UserOverride (còn hạn) > RoleOverride > default** — gộp nhiều role trên cùng key theo kiểu "role nào cho nhiều hơn thắng" (OR cho boolean). Route gate bằng `requireFeature(key)`, ví dụ `teaching_tools.access` đang gate cả drawer Kịch bản lớp học.

Mỗi key còn có cờ `sellable` — đánh dấu tính năng có thể bán/thçơng mại hoá riỪng sau này, tách khỏi việc bật/tắt theo role.

**Đề xuất cho Limio-Live:**

| Việc | Đề xvất |
| --- | --- |
| Key mới | `limio_live.access` (nhóm `group` mới `"limio_live"`, hiện `FLAGS` chỉ có 6 nhóm: teaching_tools/lms/assessment/ai_oral/ai_tutor/tournament) |
| `defaultValue` | `false` — khác `teaching_tools.access` (default `true`). Limio-Live là tính năng mới, cần bật dần theo giáo viên/trường thí điểm trước khi mở đại trà, không bật sẵn cho tất cả |
| `sellable` | Cân nhắc `true` ngay từ đầu dù chưa bán — tránh phải sửa registry lần 2 nếu sau này đưa vào gói thương mại |
| Độ chi tiết P0 | Chỉ 1 key `limio_live.access` duy nhất, gate toàn bộ module — giống hệt cách `teaching_tools.access` đang làm, không tách quyền soạn/quyền trình chiếu riêng ở P0 |
| Route áp dụng | Mọi route `/instructor/limio-live/**` và API tương ứng đều gọi `requireFeature("limio_live.access")`, cùng pattern `activity-plans` đang dùng |

**Giới hạn cần biết:** chưa có UI admin tự phục vụ để bật/tắt `RoleFeatureOverride`/`UserFeatureOverride` — bật cho giáo viên thí điểm hiện phải làm qua seed hoặc thao tác DB trực tiếp, chưa có màn hình bật/tắt. Việc thêm key mới cũng cần thêm vào `packages/db/src/seed-feature-flags.ts` rói chạy seed (đã tự seed mỗi lần deploy theo thay đổi gần đây).

## Quyết định đã chốt & việc cần làm tiếp

**Đã chốt qua trao đổi:**

- Không tách app riêng — Limio-Live là module thứ 4 trong monolith hiện có.
- Content slide nặng đô hơn để tránh giống Mentimeter; đạp án Trắc nghiệm/Thăm dò cần đổi sang kiểu điềm tĩnh hơn.
- Content slide từ Lesson: cho phép **cả Sao chép lẫn Liên kết**, giao viên chọn lúc import; liên kết hỏng phải báo lỗi rõ thay vì crash/trống.
- Content slide dài (từ Lesson) được cuộn; slide tương tác bắt buộc gọn 1 màn hình, không cuộn.
- Video V1: chỉ chiếu trên máy giáo viên, không xây đồng bộ từng máy học viên.
- "Bảng vẽ" trong mockup cũ cần tách thành 2 loại rõ rặch: Collaborate Board (đã có sẵn) và Draw It (việc mới hoàn toàn).
- Template sư phạm: 2 catalog riêng cho Kịch bản lớp học và Limio-Live, không gộp nguồn.

**Câu hỏi còn mở:**

- [ ] Xác nhận ranh giới P0 (bảng Roadmap ở trên) trước khi viết acceptance criteria chi tiết.
- [ ] Viết acceptance criteria (Given-When-Then) cho từng cụm P0 theo đúng quy trình đã dùng cho Kịch bản lớp học, rồi mới bắt đầu code.
