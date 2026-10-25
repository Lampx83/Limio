# CENTER — Trung tâm ngoại ngữ: lịch buổi, điểm danh, nhận xét sau buổi, gói học liệu, mục tiêu

> Acceptance criteria, viết trước khi code theo CLAUDE.md §6.
> Feature ID `CENTER.*` là **tạm** — chưa có trong SPEC.docx; đổi khi spec được cập nhật.
> **Trạng thái: bản nháp chờ chủ dự án duyệt (2026-10-23). Chưa có dòng mã nào.**
>
> **Mục tiêu:** để một trung tâm ngoại ngữ nhỏ (chủ trung tâm vừa dạy vừa quản lý) mở Limio và có ngay:
> lịch dạy cụ thể, điểm danh học viên và giáo viên, giáo án dựng sẵn theo từng buổi, nhận xét gửi tới học
> viên ngay sau buổi học, và mục tiêu học tập đo được. **Không** làm ERP trung tâm (học phí, lương, CRM tuyển sinh).

## Quyết định đã chốt (2026-10-23)

1. **Người mua đầu tiên:** trung tâm nhỏ (1–3 cơ sở). Hệ quả: một người thường kiêm chủ trung tâm, quản lý và giáo viên; không làm phân quyền nhiều tầng, không làm báo cáo chuỗi.
2. **Gói học liệu đầu tiên:** Tiếng Trung (tận dụng khoá Tiếng Trung cơ bản/III, deck Limio-Live, flashcard sẵn có).
3. **Giáo viên check-in:** **tự bấm** ở bản đầu. QR tại phòng để sau; thiết kế để thêm phương thức mà không đổi dữ liệu (`method`).
4. **Nhận xét sau buổi:** gửi **email cho học viên** (học viên nhỏ tuổi thường dùng email của phụ huynh). Không thêm trường phụ huynh ở bản đầu.
5. **Kênh gửi:** email + thông báo trong app. Zalo để sau; chừa chỗ cắm kênh mới.

## Vị trí trong sản phẩm

- **Lõi chung** (dùng được cho mọi khoá, không gắn ngôn ngữ): lịch, buổi, điểm danh, đối chiếu giáo viên, tổng kết và nhận xét sau buổi.
- **Riêng ngoại ngữ:** mục tiêu theo cấp độ (HSK/IELTS/CEFR…) và gói học liệu dựng sẵn.
- **Limio Language** là nơi hiện ra: các mục này nằm đầu menu giảng viên của vỏ Language; ở vỏ thường vẫn có nhưng không nổi bật.
- Ba module (LMS / Feedback / Gamification) vẫn không import nhau. Lịch/điểm danh thuộc `core-lms`; nhận xét và mục tiêu thuộc `core-feedback`, đọc dữ liệu buổi học qua bảng và event.

## Tiêu chí chung cho mọi giai đoạn

- [ ] Viết test từ checklist rồi mới code.
- [ ] Hành vi có ý nghĩa nghiệp vụ emit `LearningEvent` trong cùng transaction; tên `<domain>.<entity>.<verb_past>`, payload có schema. Namespace mới (`class.*`, `attendance.*`, `goal.*`, `meeting.*`) phải thêm vào danh sách ở CLAUDE.md §4.2.
- [ ] Bảng điểm danh là trạng thái **hiện tại** (sửa được); lịch sử sửa nằm ở event, không UPDATE/DELETE `LearningEvent`.
- [ ] Mọi giờ tính theo `Asia/Ho_Chi_Minh` qua `lib/datetime.ts` (buổi tối thứ 7 không bị lệch sang chủ nhật).
- [ ] Đổi schema bằng `prisma migrate`; index khai trong `schema.prisma`; cascade xoá theo lớp rõ ràng.
- [ ] Quyền: chỉ giảng viên phụ trách lớp (hoặc quản trị của tổ chức) ghi được; học viên chỉ đọc của chính mình. Endpoint dữ liệu học viên có xác thực và phân quyền.
- [ ] Export/xoá dữ liệu cá nhân của học viên bao gồm điểm danh, nhận xét và mục tiêu (CLAUDE.md §5.4).
- [ ] Chuỗi giao diện đúng thuật ngữ §4.6.1; responsive theo §4.6; điểm danh dùng được một tay trên điện thoại.
- [ ] Mục menu/trang giảng viên mới ⇒ cập nhật `GIAO-DIEN.md`, `teacherAssistantGuide.ts` (có `useCases`), `ASSISTANT_DESTINATIONS`; test `teacherAssistantFreshness` xanh (§4.9).
- [ ] Xem bằng mắt trên mobile và desktop trước khi báo xong.
- [ ] Mỗi giai đoạn kết thúc bằng một điểm dừng để review.

Thứ tự làm: **C1 → C2 → C3 → C4 → C5 → C6**. Không làm P1/P2 của giai đoạn sau trước khi xong P0 giai đoạn đang làm.

---

## C1 · Lịch lớp và buổi học (nền tảng)

**Thiết kế đề xuất:** `ClassSchedule` là quy tắc lặp gắn `CourseSection` (thứ trong tuần, giờ bắt đầu, thời lượng, phòng, giáo viên dự kiến, hiệu lực từ–đến). `ClassMeeting` là từng buổi cụ thể sinh ra từ quy tắc, có số thứ tự `seq` (buổi 1..N), `startsAt/endsAt`, `room`, `plannedTeacherId`, `actualTeacherId?`, `status` (`planned | held | cancelled`), `makeupOfMeetingId?` cho buổi dạy bù.

**Trạng thái (2026-10-23, nhánh `feat/center-c1-lich-buoi`, chưa commit):** service + 51 test xanh (`classSchedule.test.ts`, `classScheduleCalc.test.ts`); API, trang "Lịch dạy" (`/instructor/lich-day`), khối lịch trong trang lớp, trang "Lịch học" (`/me/lich-hoc`) đã viết, typecheck sạch, Lily + `GIAO-DIEN.md` đã cập nhật (test freshness xanh). **Chưa làm:** xem bằng mắt trên mobile/desktop (C1.9, C1.10 mới kiểm ở tầng dữ liệu); migration `20261023120000_class_schedule_meetings` mới áp lên DB test, **chưa áp lên DB dev**.

**Bổ sung sau khi thử (2026-10-24):** buổi học cũng được đưa vào widget "Lịch" ở trang chủ của giảng viên và học viên (cùng chỗ với hạn nộp bài tập), và học viên có thẻ "Chuyên cần của bạn" ở trang tổng quan, vì trang "Lịch học" riêng khó thấy (nằm sau menu).

- [x] **C1.1** Given lớp chưa có lịch, when giảng viên thêm quy tắc "T3, T5 · 18:30–20:30 · phòng B2 · từ 03/11 · 24 buổi", then hệ thống sinh đúng 24 `ClassMeeting` theo thứ tự thời gian, đánh `seq` 1..24.
- [x] **C1.2** Given quy tắc có nhiều dòng (T3 và T5 khác giờ), then mỗi dòng sinh buổi riêng và `seq` vẫn tăng theo thời gian thực chứ không theo dòng.
- [x] **C1.3** Given sửa quy tắc, when áp dụng, then chỉ các buổi **chưa diễn ra và chưa đóng** bị sinh lại; buổi đã `held` không đổi.
- [x] **C1.4** Given một buổi, when giảng viên huỷ kèm lý do, then `status = cancelled`, `seq = null` (không tính vào số thứ tự), các buổi sau tự lùi số, buổi vẫn hiện trong lịch (gạch ngang, kèm lý do) và phát `class.meeting.cancelled` (payload chỉ mang độ dài lý do).
- [x] **C1.5** Given buổi bị huỷ, when giảng viên thêm buổi dạy bù, then buổi mới có `makeupOfId` và chen vào đúng vị trí **theo thời gian**; `seq` luôn là thứ tự trong các buổi không huỷ, nên giáo án đi theo thứ tự dạy thật. *(Sửa so với bản nháp: không còn "nhận `seq` của buổi bị huỷ" vì hai buổi sẽ trùng số.)* Áp lại kế hoạch sau khi huỷ tự thêm một buổi thay thế ở cuối để đủ tổng số buổi.
- [x] **C1.6** Given đổi phòng hoặc đổi giờ một buổi lẻ, then chỉ buổi đó đổi và bị khoá khỏi việc áp lại kế hoạch. **Thông báo cho học viên trong app dời sang C4** (cùng hạ tầng kênh gửi); trước mắt học viên thấy thay đổi ở trang "Lịch học".
- [x] **C1.7** Given hai buổi cùng giáo viên trùng giờ (kể cả giữa hai lớp), when lưu, then cảnh báo rõ nhưng không chặn cứng (trung tâm nhỏ có thể dạy ghép). Trùng **phòng** cùng giờ cũng cảnh báo.
- [x] **C1.8** Given đổi giáo viên dự kiến của một buổi, then `plannedTeacherId` đổi; `actualTeacherId` chỉ do C5 ghi.
- [x] **C1.9** Giảng viên có trang "Lịch dạy": xem tuần/tháng, lọc theo lớp, mỗi buổi hiện lớp · giờ · phòng · buổi số mấy.
- [x] **C1.10** Học viên thấy lịch của các lớp mình ghi danh ở trang cá nhân; không thấy lớp khác.
- [x] **C1.11** Sinh buổi **idempotent**: bấm áp dụng hai lần không tạo trùng buổi.
- [x] **C1.12** Index: `ClassMeeting (sectionId, startsAt)` và `(plannedTeacherId, startsAt)` cho lịch của giảng viên.

**P1:** nhập lịch từ Excel; xuất lịch ra iCal/Google Calendar; ngày nghỉ lễ tự loại; nhắc buổi học trước 1 giờ.

## C2 · Điểm danh học viên

**Trạng thái (2026-10-23, nhánh `feat/center-c1-lich-buoi`, chưa commit):** service `attendance.ts` + 29 test xanh; API, trang điểm danh `/instructor/courses/[id]/sections/[sectionId]/meetings/[meetingId]`, nút "Điểm danh" ở từng buổi, bảng "Chuyên cần" ở trang lớp, trạng thái của học viên ở "Lịch học"; Lily + `GIAO-DIEN.md` đã cập nhật; điểm danh có trong bản xuất dữ liệu cá nhân. Migration `20261023150000_student_attendance` đã áp lên DB dev; đã xem bằng mắt desktop + mobile + phía học viên (2026-10-23). Sửa sau khi xem: nút trạng thái một dòng trên mobile, nâng nút "Hỏi Lily" lên trên thanh CTA cố định (CSS `.assistant-launcher`). Chưa thấy bằng mắt khối cảnh báo "vắng từ 2 buổi liên tiếp" vì lớp mẫu mới có một buổi đã diễn ra (logic đã có test).

**Cửa sổ ghi (chốt khi code, gộp C2.1 và C2.4):** từ 30 phút trước giờ bắt đầu đến 7 ngày sau giờ kết thúc, cả lần đầu lẫn sửa. Ngoài cửa sổ vẫn xem được. Buổi đã có điểm danh không bao giờ bị áp lại kế hoạch lịch xoá hay thay.

**Thiết kế đề xuất:** `StudentAttendance (meetingId, userId, status, note?, markedById, markedAt)`, unique `(meetingId, userId)`; `status ∈ present | late | absent | excused`. Danh sách lấy từ học viên ghi danh vào lớp (`CohortMember`/`Enrollment.sectionId`) tại thời điểm mở buổi.

- [x] **C2.1** Given buổi trong khoảng từ 30 phút trước giờ bắt đầu đến hết ngày, when giảng viên phụ trách mở "Điểm danh", then thấy toàn bộ học viên của lớp, mặc định **chưa đánh dấu**.
- [x] **C2.2** Given nút "Có mặt cả lớp", when bấm, then mọi học viên chưa đánh dấu thành `present`; học viên đã đánh dấu khác (vắng, muộn) giữ nguyên.
- [x] **C2.3** Given một học viên, when chạm vào tên, then luân phiên hoặc chọn nhanh Có mặt / Muộn / Vắng / Có phép; có ô ghi chú ngắn tuỳ chọn.
- [x] **C2.4** Given đã lưu, when sửa lại sau (trong 7 ngày), then cập nhật dòng hiện tại và phát event mới có giá trị cũ → mới; không làm mất lịch sử.
- [x] **C2.5** Given buổi `cancelled`, then không cho điểm danh.
- [x] **C2.6** Given học viên ghi danh sau khi buổi đã mở, then xuất hiện ở danh sách khi tải lại, chưa đánh dấu.
- [x] **C2.7** Given học viên rời lớp, then vẫn giữ điểm danh các buổi đã qua; không xuất hiện ở buổi sau.
- [x] **C2.8** Phát `attendance.student.marked` mỗi lần đánh dấu/sửa, trong cùng transaction với ghi bảng; payload: meetingId, userId, status, trạng thái cũ.
- [x] **C2.9** Quyền: giảng viên **không** phụ trách lớp → 403; học viên chỉ xem được điểm danh của chính mình.
- [x] **C2.10** Tổng hợp theo lớp: tỉ lệ có mặt từng học viên, số buổi vắng liên tiếp; học viên vắng ≥ 2 buổi liên tiếp được đánh dấu để giảng viên chú ý (chỉ gợi ý, không tự nhắn).
- [x] **C2.11** Giao diện điện thoại: danh sách một cột, hàng đủ cao để chạm, nút lưu cố định đáy (`StickyMobileCTA`); lưu được khi mạng yếu và báo rõ lúc lưu xong.
- [x] **C2.12** Học viên xem được lịch sử điểm danh của mình trong từng lớp.

**P1:** học viên tự điểm danh bằng mã 4 số hiển thị trên bảng; xuất bảng điểm danh ra Excel.

## C3 · Gói học liệu dựng sẵn theo buổi (Tiếng Trung đầu tiên)

**Trạng thái (2026-10-23, nhánh `feat/center-c1-lich-buoi`, chưa commit):** service `coursePacks.ts` + `sessionPlan.ts` + 24 test xanh; `duplicateCourse` tách ra `cloneCourseUnchecked`/`cloneModuleTree` (24 test cũ vẫn xanh); thư viện `/instructor/giao-trinh` (xem trước, "Dùng giáo trình này"), giáo án hiện ở khối "Lịch dạy" của trang lớp và ở "Lịch dạy"/"Lịch học", banner "có bản mới" + nút cập nhật; API công khai và API quản trị `/api/admin/packs`. Lily + `GIAO-DIEN.md` đã cập nhật. Script `scripts/build-pack-zh-so-cap-1.ts` dựng gói mẫu **6 buổi** (chạy thử trên DB test). Migration `20261023180000_course_pack` đã áp lên DB dev; gói mẫu đã dựng trên dev; đã xem bằng mắt desktop + mobile + phía học viên (2026-10-24). Sửa sau khi xem: khoá sao về là bản nháp nên chuyển hướng về trang khoá và dặn bấm Publish trước khi tạo lớp; mục menu rút gọn thành "Giáo trình" (cột menu cắt chữ); nhãn "Giáo án:" (chỉ đúng ngày hôm nay mới ghi "Hôm nay dạy:"). **Chưa làm:** giao diện quản trị phát hành gói (hiện chỉ có API), audio, 18 buổi còn lại của gói Tiếng Trung (C3.11 chưa đạt: cần chủ dự án soạn/duyệt), thử nút "Cập nhật các buổi chưa dạy" bằng mắt (đã có test). Ghi chú thiết kế: gói = một khoá, chương = buổi (`Module.sessionNo`); buổi `seq` N dạy chương N; bản sao độc lập hoàn toàn. Slide Limio-Live và flashcard chưa được sao theo gói (flashcard sinh từ khối từ vựng trong bài nên đi theo bài).

**Thiết kế đề xuất:** một khoá mẫu có khung buổi: mỗi buổi gắn với một hoặc nhiều bài (`Lesson`) và có phần "dành cho giáo viên" (mục tiêu buổi, gợi ý trình tự 90 phút, đáp án). Trung tâm **sao chép** khoá mẫu về lớp của mình. Cơ chế phiên bản để cập nhật gói gốc không làm đổi nội dung lớp đang dạy.

- [x] **C3.1** Given thư viện gói, when giảng viên chọn "Giáo trình dựng sẵn → Tiếng Trung sơ cấp 1", then thấy mô tả, số buổi, trình độ đầu ra, xem trước được từng buổi.
- [x] **C3.2** Given chọn gói và lớp, when áp dụng, then hệ thống sao chép khoá về tổ chức của giảng viên, chủ khoá là giảng viên, gắn buổi 1..N của gói vào `seq` 1..N của lịch lớp.
- [x] **C3.3** Given lớp có lịch và gói đã gắn, then mỗi `ClassMeeting` hiện "Hôm nay dạy: Bài X" kèm nút mở bài/slide Limio-Live/flashcard/bài tập của buổi đó.
- [x] **C3.4** Given số buổi của lịch nhiều hơn số buổi của gói, then các buổi dư hiện "chưa có giáo án" (không lỗi); ít hơn thì cảnh báo còn bài chưa dạy.
- [x] **C3.5** Given buổi dạy bù hoặc huỷ, then giáo án đi theo `seq`, không theo ngày (C1.5).
- [x] **C3.6** Given bản sao, when giảng viên sửa bài, then sửa trên **bản sao**; gói gốc không đổi.
- [x] **C3.7** Given gói gốc có phiên bản mới, then lớp đang dùng bản cũ **không** bị đổi; hiện thông báo "có bản mới" và cho chọn áp dụng cho các buổi **chưa dạy**.
- [x] **C3.8** Phần "dành cho giáo viên" (đáp án, gợi ý trình tự) **không bao giờ** lộ cho học viên: kiểm bằng test ở route trả nội dung học viên (cùng tinh thần guard rò nội dung của annotation).
- [x] **C3.9** Bản sao đi qua lesson-as-tag (§4.4) khi khoá bật personalization; khoá tắt thì không sinh `Skill` thừa.
- [x] **C3.10** Dung lượng media của bản sao được sổ đúng chủ khoá (ledger lưu trữ); sao chép không nhân đôi file khi có thể dùng chung tham chiếu.
- [ ] **C3.11** Gói **Tiếng Trung sơ cấp** đầu tiên: ít nhất 24 buổi, mỗi buổi gồm bài từ vựng/hội thoại (G2), audio, quiz cuối buổi, bài tập về nhà; nội dung do chủ dự án soạn hoặc có nguồn/giấy phép ghi rõ.

**P1:** gói tiếng Anh/Hàn/Nhật; trung tâm đóng gói giáo án riêng của họ thành mẫu dùng lại.

## C4 · Tổng kết buổi và nhận xét gửi sau buổi

**Trạng thái (2026-10-24, chưa commit):** C4a và C4b đã làm đủ, có test (core-lms 31, core-feedback 22 mới) và đã xem bằng mắt trên dev (kết thúc buổi, gửi tổng kết, soạn–duyệt–gửi nhận xét, học viên đọc lại). Ghi chú thực hiện:
- Khoá template dùng dấu chấm cho khớp các khoá sẵn có: `class.meeting_summary`, `class.student_note` (AC ghi gạch dưới). Có bản dự phòng trong mã và dòng seed để quản trị sửa.
- Nguồn dữ liệu của C4.7 hiện là **điểm danh, bài tập của buổi và nhãn nắm bài theo bài của buổi** (mức nắm hiện tại, chưa có "thay đổi so với đầu buổi"). Bình chọn, gọi ngẫu nhiên, quiz cuối buổi của Limio-Live **chưa được ghi theo từng học viên** nên chưa đưa vào; sẽ thêm khi có dữ liệu.
- C4.13: nháp theo mẫu khi không cấu hình mô hình, hết hạn mức token hoặc mô hình lỗi/trả sai (rỗng, có dấu %); token trừ ví giảng viên qua `recordAiUsage`.
- C4.15: `FeedbackDelivery` được ghi khi bản **đã gửi** (idempotent), `masteryAtGeneration` là ảnh chụp lúc soạn nháp; bản AI soạn mang `sourceKind = hybrid` vì giáo viên luôn duyệt.
- C4.17: hàng đợi BullMQ `class-mail` (5 lần thử, backoff 15 giây); ngoài production gửi thẳng trong tiến trình (đặt `CLASS_MAIL_MODE=queue` để thử hàng đợi thật).
- C4.18: `meeting.*` và `class.*` được loại khỏi "hoạt động của học viên" cùng `attendance.*`.
- Học viên tắt email: nhận xét vẫn ghi là đã gửi và đọc được trong ứng dụng (`sendError = email_optout`).

**Hai lớp:** (a) **Tổng kết chung** — tự động, gửi cả lớp; (b) **Nhận xét cá nhân** — AI soạn nháp từ dữ liệu thật, giáo viên duyệt rồi mới gửi.

### C4a · Tổng kết chung
- [x] **C4.1** Given giáo viên bấm "Kết thúc buổi", then buổi `status = held`, `closedAt` ghi lại, phát `class.meeting.closed`.
- [x] **C4.2** Given buổi đã đóng, then tổng kết chung được dựng từ giáo án của buổi: học gì hôm nay, từ vựng cần ôn, bài tập về nhà + hạn, buổi sau học gì (và giờ buổi sau theo lịch C1).
- [x] **C4.3** Given chưa gắn giáo án, then tổng kết chỉ gồm giờ buổi sau và bài tập (nếu có); không bịa nội dung.
- [x] **C4.4** Given lớp bật "tự gửi tổng kết chung" (mặc định **bật**), then gửi email + thông báo trong app tới mọi học viên của lớp, kể cả người vắng (người vắng nhận thêm dòng "Em vắng buổi này, bài cần học bù: …").
- [x] **C4.5** Gửi **idempotent**: mỗi `(meetingId, userId)` nhiều nhất một email tổng kết; đóng lại/bấm lại không gửi trùng.

### C4b · Nhận xét cá nhân
- [x] **C4.6** Given buổi đã đóng, when giáo viên mở "Nhận xét sau buổi", then thấy danh sách học viên có mặt/muộn, mỗi em một bản nháp, trạng thái `nháp | đã duyệt | đã gửi`.
- [x] **C4.7** Given nháp AI, then chỉ dùng dữ liệu của **chính học viên đó** trong buổi: điểm danh, hoạt động trên lớp (bình chọn, gọi ngẫu nhiên, quiz cuối buổi), kết quả bài tập liên quan, thay đổi mức thành thạo theo nhãn (Cần ôn / Nên luyện / Vững; **không hiện %**). Không nhắc tên hay kết quả học viên khác, không xếp hạng.
- [x] **C4.8** Given chỗ nào không có dữ liệu (ví dụ em chưa phát biểu), then nháp **bỏ trống** hoặc để giáo viên điền; không suy đoán.
- [x] **C4.9** Given giáo viên thêm một dòng ghi chú nhanh hoặc chọn chip có sẵn, then AI viết lại nháp có kèm ghi chú đó; ghi chú của giáo viên được giữ nguyên ý.
- [x] **C4.10** Given nút "Gửi tất cả đã duyệt", then gửi mọi bản `đã duyệt`; bản `nháp` **không bao giờ** tự gửi. Không có chế độ tự gửi cho nhận xét cá nhân.
- [x] **C4.11** Given bản đã gửi, then không sửa được; muốn đính chính thì gửi bản mới đánh dấu "đính chính".
- [x] **C4.12** Given học viên vắng, then không dùng AI; nhận email chung C4.4. Giáo viên có thể thêm lời nhắn tay.
- [x] **C4.13** Given hết hạn mức token AI hoặc AI lỗi, then tạo nháp **theo mẫu có sẵn** (rule-based) từ cùng dữ liệu; luồng không bị chặn. Chi phí AI trừ ví token (`chargeTokens`) và ghi `AiUsageLog` như các đường sinh khác.
- [x] **C4.14** Nội dung ở mức **nhiệm vụ và quá trình** ("em làm đúng phần so sánh, cần ôn lại bổ ngữ kết quả"). Khen cá nhân chung chung không nằm ở đây (kênh gamification).
- [x] **C4.15** Mỗi bản nhận xét tạo `FeedbackDelivery` **mang toạ độ SSMMD** (`codeFeedback`: `level`, `levels`, `elaboration`, `sourceKind`, `generationContext`); `self` không được emit ở tầng meso (CLAUDE.md §4.8). `masteryAtGeneration` snapshot trước khi chấm.
- [x] **C4.16** Học viên đọc lại được nhận xét của mình trong app; chỉ của mình.
- [x] **C4.17** Email dùng template qua `sendTemplatedEmail` (key `class_meeting_summary`, `class_student_note`), gửi qua BullMQ với retry; một email lỗi không chặn các email khác; thất bại hiện lại cho giáo viên để gửi lại.
- [x] **C4.18** Phát `meeting.summary.sent`, `meeting.note.drafted`, `meeting.note.sent`; payload nhận xét **không** chứa nguyên văn nội dung nhận xét nếu thuộc dữ liệu nhạy cảm — chỉ id và độ dài (theo mẫu `assistant.question.asked`).
- [x] **C4.19** Email có liên kết huỷ nhận email (chỉ tắt thư tự động, vẫn xem được trong app).

**P1:** kênh Zalo (OA/ZNS) qua cùng giao diện kênh gửi; trường email phụ huynh riêng; nhận xét bằng giọng nói của giáo viên.

## C5 · Giáo viên check-in và đối chiếu lịch

**Thiết kế đề xuất:** `TeacherCheckIn (meetingId, teacherId, checkedInAt, checkedOutAt?, method)`; `method = self` ở bản đầu, thêm `room_qr` sau mà không đổi bảng. Độ lệch **tính khi đọc**, không lưu cứng, để đổi quy tắc không phải sửa dữ liệu.

- [ ] **C5.1** Given giáo viên dự kiến của buổi, when bấm "Bắt đầu buổi" trong khoảng từ 30 phút trước giờ bắt đầu đến giờ kết thúc, then ghi `checkedInAt`; bấm lần hai không ghi đè.
- [ ] **C5.2** Given giáo viên **khác** giáo viên dự kiến bấm bắt đầu, then ghi `actualTeacherId` và hiển thị là "dạy thay"; chỉ giáo viên có quyền trong tổ chức mới làm được.
- [ ] **C5.3** Given "Kết thúc buổi" (C4.1), then ghi `checkedOutAt` nếu chưa có.
- [ ] **C5.4** Phân loại tính khi đọc, ngưỡng mặc định 15 phút (cấu hình theo tổ chức): **Đúng giờ** (vào trong ≤ ngưỡng sau giờ bắt đầu), **Trễ**, **Kết thúc sớm** (ra trước giờ kết thúc quá ngưỡng), **Dạy thay**, **Không check-in** (buổi qua giờ mà không ai bấm).
- [ ] **C5.5** Given buổi `held` mà không có điểm danh học viên, then đánh dấu "chưa điểm danh" để chủ trung tâm nhắc.
- [ ] **C5.6** Chủ trung tâm (quản trị của tổ chức) có báo cáo tuần: mỗi giáo viên bao nhiêu buổi đúng giờ/trễ/dạy thay/không check-in; bấm vào một buổi xem chi tiết.
- [ ] **C5.7** Giáo viên chỉ xem **của mình**; chỉ quản trị tổ chức xem của tất cả.
- [ ] **C5.8** Phát `attendance.teacher.checked_in`, `attendance.teacher.checked_out`.
- [ ] **C5.9** Cách trình bày là "đối chiếu lịch để xếp dạy bù", không phải chấm công: tên trang, nút, email đều theo ngôn ngữ đó.
- [ ] **C5.10** Giáo viên quên bấm: quản trị sửa được sau, có ghi lý do; sửa ghi event.

**P1:** `room_qr`; nhắc giáo viên trước buổi dạy 15 phút; xuất báo cáo Excel.

## C6 · Mục tiêu học tập

**Trạng thái (2026-10-24, chưa commit):** C6.1–C6.9 đã làm, có test (core-lms: 22 mục tiêu + 4 xuất/xoá; core-feedback: 17 tiến độ + 5 nhắc mục tiêu trong nhận xét) và đã xem bằng mắt trên dev (học viên dùng mục tiêu lớp, đổi mục tiêu, xem lịch sử; giáo viên xem bảng). Ghi chú thực hiện: (1) giờ thực tế chỉ tính từ lúc đặt mục tiêu (hoặc từ lúc vào lớp / lúc lớp cập nhật mục tiêu nếu dùng mục tiêu lớp), nên học viên mới đặt chưa có nhận định; (2) mục tiêu chung không gắn khoá chỉ chủ nhân xem, giáo viên chỉ thấy mục tiêu gắn khoá của học viên mình dạy; (3) event `goal.*` còn lại sau khi xoá tài khoản (ẩn danh), còn bản ghi mục tiêu thì xoá hẳn; (4) nhãn kỹ năng của khoá có `languageMode` lấy từ hồ sơ 4 kỹ năng, khoá thường có một nhãn tổng và cần ít nhất 5 lượt trả lời; (5) vá thêm C6.9 cho C2 và C4 vì lần trước bỏ sót xuất/xoá dữ liệu cá nhân.

**Thiết kế (2026-10-24):** `LearnerGoal (userId, courseId?, framework, targetLevel, targetDate, hoursPerWeek?, status, setById)` cho mục tiêu của từng học viên và `SectionGoal (sectionId, ...)` cho mục tiêu của lớp; `framework ∈ HSK | IELTS | TOEIC | CEFR | custom`. Danh sách cấp độ chuẩn đặt ở `packages/shared-types/src/goals.ts`. Mục tiêu (CRUD, quyền, lịch sử, xuất/xoá dữ liệu) ở core-lms; tiến độ và nhận định ở core-feedback (đọc `LearnerSkillState` và `lesson.engaged`); apps/web ghép. **Chỉ gợi ý**, không phán xét, không hiện %.

**Quy tắc nhận định "đúng kế hoạch / chậm / vượt" (C6.3), tính khi đọc:** cần có `hoursPerWeek`. Số giờ kỳ vọng = `hoursPerWeek` × số tuần đã trôi (tính từ lúc đặt mục tiêu, tối thiểu 1 tuần). Giờ thực tế = tổng `activeSec` của các `lesson.engaged` của học viên (trong khoá của mục tiêu, hoặc mọi khoá nếu mục tiêu chung) từ lúc đặt. Tỉ lệ ≥ 1,15 là **vượt**; từ 0,8 đến dưới 1,15 là **đúng kế hoạch**; dưới 0,8 là **chậm**. Chưa đủ 1 tuần kể từ lúc đặt, hoặc không đặt số giờ/tuần: **chưa đủ dữ liệu** (vẫn hiện số tuần còn lại). Quá hạn mà chưa đánh dấu đạt: **đã qua hạn**.

- [x] **C6.1** Given học viên hoặc giáo viên đặt mục tiêu "HSK 3 trước 30/06/2027, 4 giờ/tuần", then lưu và phát `goal.set` (chủ thể là học viên, payload ghi ai đặt). Hạn phải sau hôm nay (giờ VN) và trong 10 năm; số giờ/tuần từ 0,5 đến 60; mỗi học viên có tối đa một mục tiêu đang theo đuổi cho mỗi khoá (và một mục tiêu chung không gắn khoá).
- [x] **C6.2** Given khung có cấp độ chuẩn (HSK 1–6, IELTS 4.0–9.0 bước 0,5, TOEIC 400–900 bước 100, CEFR A1–C2), then cấp độ phải thuộc danh sách; `custom` cho nhập nhãn tự do (1–60 ký tự).
- [x] **C6.3** Given học viên có mục tiêu, then trang **"Mục tiêu học tập"** (`/me/muc-tieu`) hiện số tuần còn lại, tiến độ theo từng kỹ năng bằng nhãn **Cần ôn / Nên luyện / Vững** (không hiện %; khoá không dùng 4 kỹ năng thì một nhãn tổng và số bài đã luyện), số giờ đã học (làm tròn 0,5 giờ) và nhận định theo quy tắc trên.
- [x] **C6.4** Given giáo viên quản khoá đặt **mục tiêu của lớp**, then học viên của lớp (kể cả người vào sau) thấy đó là gợi ý và bấm "Dùng mục tiêu này" để thành mục tiêu riêng (người đặt = học viên); học viên chưa có mục tiêu riêng thì tiến độ tính theo mục tiêu lớp, đánh dấu "mục tiêu của lớp". Đặt lại mục tiêu lớp không đổi mục tiêu riêng đã có.
- [x] **C6.5** Given nhận xét sau buổi (C4), then bản nháp (mẫu và AI) nhắc mục tiêu **riêng** của học viên kèm số tuần còn lại nếu có; không nhắc mục tiêu lớp, không nhắc nếu không có.
- [x] **C6.6** Mục tiêu và tiến độ chỉ chính học viên, giảng viên quản khoá và giáo viên được xếp vào lớp của học viên xem được; người khác (kể cả học viên khác cùng lớp) bị từ chối. Có trong bản xuất dữ liệu cá nhân (`exportProfile`) và **bị xoá hẳn** khi xoá tài khoản (`deleteUser` ẩn danh hoá nên phải xoá tường minh).
- [x] **C6.7** Đổi mục tiêu phát `goal.changed` mang giá trị cũ và mới từng trường; đổi trạng thái (đã đạt, lưu trữ, theo đuổi lại) phát `goal.status_changed`; xem lại được lịch sử từ các event. Không ghi đè âm thầm.
- [x] **C6.8** `goal.*` không tính là hoạt động học của học viên (giáo viên có thể đặt hộ).
- [x] **C6.9 (vá C2 và C4)** Bản xuất dữ liệu cá nhân có nhận xét sau buổi **đã gửi** cho học viên đó và tình trạng gửi tổng kết; `deleteUser` xoá hẳn nhận xét (kể cả nháp) và xoá ghi chú của giáo viên trong điểm danh của người đó (giữ trạng thái có mặt/vắng ở dạng ẩn danh).

**Chưa làm (P1):** cảnh báo giáo viên khi học viên lệch kế hoạch hai tuần liền; gợi ý bài luyện hôm nay theo mục tiêu; đưa kết quả thi thử vào tiến độ (Limio chưa có mốc thi thử theo khung này).

## G · Bật tính năng trung tâm theo tổ chức, và trang lịch dạng lịch

**Trạng thái (2026-10-24, chưa commit):** service `org/centerAccess.ts` + 10 test; `Organization.centerEnabled` + cờ `center.access` + migration `20261024100000_org_center_enabled` (đã áp DB dev); menu, trang và trang lớp ẩn theo quy tắc; công tắc ở cài đặt trường và trang quản trị trường; `/instructor/lich-day` và `/me/lich-hoc` dạng lịch. Đã xem bằng mắt: trường tắt thì menu ẩn và truy cập thẳng bị đưa về trang chủ; bật bằng công tắc thì hiện ngay; lịch có dữ liệu. Dev: tài khoản `giangvien.mau@` đã được xếp vào trường `TT-DEMO` (mặc định đã bật sau khi thử). Ghi chú: sau `prisma generate` phải khởi động lại máy chủ dev. **Chưa làm:** vai trò "giảng viên trung tâm" (chỉ dạy, không soạn) — xem thảo luận 2026-10-24.

**Quyết định (2026-10-24):** tính năng trung tâm (lịch dạy, giáo trình dựng sẵn, điểm danh, chuyên cần) không hiện cho mọi người. Ẩn ở tầng giao diện (menu, trang, khối trên trang lớp); API và dữ liệu không đổi. Người đã có sẵn dữ liệu (lớp có lịch) không bị mất lối vào.

- [x] **G1** `Organization.centerEnabled` (mặc định tắt). Platform Admin hoặc OrgAdmin của chính trường đó bật/tắt được; người khác bị từ chối; mỗi lần đổi ghi `AuditLog` (`org.center_setting_changed`).
- [x] **G2** `isCenterEnabledForUser(userId)` đúng khi: (a) trường của người đó bật, hoặc (b) cờ `center.access` của người đó đúng (cấp riêng qua cơ chế cờ tính năng có sẵn, cho tài khoản chưa thuộc trường nào), hoặc (c) người đó đang dạy một khoá có lớp đã đặt lịch (không bị mất lối vào). Còn lại sai. Thiếu dòng cờ trong DB thì coi là sai, không báo lỗi.
- [x] **G3** `hasClassSchedule(userId)` (học viên) đúng khi đang học (đang học/đã hoàn thành) ở một lớp có ít nhất một buổi.
- [x] **G4** Menu giảng viên ẩn "Lịch dạy" và "Giáo trình" khi G2 sai; menu học viên ẩn "Lịch học" khi G3 sai. Áp cho cả menu giảng viên hiện ở các trang `/me/*`.
- [x] **G5** `/instructor/lich-day`, `/instructor/giao-trinh` (và xem trước) chuyển về trang chủ giảng viên khi G2 sai; `/me/lich-hoc` chuyển về tổng quan khi G3 sai. Trang lớp ẩn khối "Lịch dạy", bảng "Chuyên cần" và thông báo giáo trình có bản mới khi G2 sai.
- [x] **G6** Công tắc "Tính năng trung tâm" trong cài đặt trường (OrgAdmin) và trang quản trị trường (Platform Admin).
- [x] **G7** Trang "Lịch dạy" (giảng viên) và "Lịch học" (học viên) là **lịch** giống widget ở trang chủ: nút Tuần/Tháng, Trước/Sau, bấm ngày thấy các buổi trong ngày kèm giáo án; học viên thấy trạng thái điểm danh của mình; bấm buổi mở trang điểm danh (giảng viên). Câu trống nói "buổi học", không nói "hạn nộp".
- [x] **G8** (2026-10-25, sau khi chủ dự án thử trên production) Dễ tìm chỗ đặt lịch: thẻ lớp ở tab "Lớp học" có dòng tóm tắt lịch ("Chưa có lịch, đặt lịch ngay" hoặc "24 buổi, thứ ba và thứ năm 18:30, buổi tới 27/10") và nút chính **"Lịch dạy"** ngay đầu phần mở rộng của lớp. Trang lớp có hai tab, mỗi tab một đường dẫn (`?tab=lich-day`, `?tab=hoc-vien`): **"Lịch dạy"** (đặt lịch, các buổi, tự gửi tổng kết) và **"Học viên"** (chuyên cần, mục tiêu học tập, danh sách). Mặc định mở "Lịch dạy". Khoá chưa bật tính năng trung tâm giữ nguyên: không tab, chỉ danh sách học viên.

## H · Vai trò giảng viên trung tâm (chỉ dạy, không soạn)

**Trạng thái (2026-10-24, chưa commit):** `RoleName.CenterTeacher`, `isCenterTeacher`, `setOrgMemberCenterTeacher`, `courses/teachingScope.ts` (13 + 8 + 1 test mới; toàn bộ test cũ vẫn xanh); các dịch vụ lịch, điểm danh, giáo án đã tách quyền quản và dạy; menu, trang chủ "Hôm nay tôi dạy", trang lớp chỉ xem, chặn trang soạn, công tắc cấp vai trò đã làm. Đã xem bằng mắt (H10–H14) với tài khoản chỉ có `center_teacher` trên dev: menu, trang chủ, chuyển hướng khỏi trang soạn, trang lớp chỉ xem. Sửa thêm sau khi xem: buổi của giảng viên khác không còn nút "Điểm danh" và mở thẳng link thì về trang lớp; nút quay lại của người chỉ dạy là "← Lịch dạy".

**Quyết định (2026-10-24, chủ dự án chốt):** thêm vai trò toàn cục `center_teacher`, riêng với `instructor`. Giảng viên trung tâm chỉ dạy theo lộ trình chủ trung tâm đã dựng sẵn (lịch, bài học, thi cử); họ không soạn nội dung và không đặt lịch. Bốn điểm đi kèm: (1) họ chỉ thấy lớp và buổi được xếp cho mình; (2) ghi chú riêng vào giáo án để P1; (3) chủ trung tâm là quản trị trường kiêm giảng viên thường, và được xếp dạy như mọi giáo viên khác; (4) đề nghị nghỉ/đổi buổi để P1, ở bản đầu họ báo qua chủ trung tâm.

**Khái niệm**
- **Quyền trên một khoá** (`getTeachingScope`): `manage` = Platform Admin, hoặc chủ khoá, hoặc đồng giảng viên (hai vai trò được sửa nội dung); `teach` = có tên trong khoá với vai trò khác (không sửa nội dung, trợ giảng); `null` = không liên quan. Giảng viên trung tâm được thêm vào khoá bằng vai trò có sẵn "non-editing-teacher".
- **Được xếp vào một buổi:** là giáo viên dự kiến của buổi đó; hoặc buổi chưa gán giáo viên mà người đó là giáo viên phụ trách lớp. **Được xếp vào một lớp:** là giáo viên phụ trách lớp, hoặc là giáo viên dự kiến của ít nhất một buổi hay một khung giờ của lớp.

**Vai trò và cấp quyền**
- [x] **H1** `RoleName.CenterTeacher = "center_teacher"`; Platform Admin cấp được qua cơ chế cấp vai trò có sẵn. Người chỉ có vai trò này **không** được coi là giảng viên thường (`isInstructor` sai), nên không tạo được khoá.
- [x] **H2** Quản trị trường cấp/thu hồi vai trò cho **thành viên của chính trường mình** (`setOrgMemberCenterTeacher`); Platform Admin cho trường bất kỳ; người khác, và quản trị trường khác, bị từ chối; người không thuộc trường → `not_member`; mỗi lần đổi ghi `AuditLog` (`org.center_teacher_changed`); cấp lại khi đã có hoặc thu hồi khi chưa có thì không ghi.

**Tách quyền quản lịch khỏi quyền dạy** (sửa lỗ hổng: trước đây mọi dịch vụ lịch và điểm danh kiểm bằng quyền "chấm bài", gồm cả người chỉ được dạy)
- [x] **H3** `getTeachingScope` trả đúng theo ma trận: chủ khoá → `manage`; đồng giảng viên → `manage`; Platform Admin → `manage`; non-editing-teacher và trợ giảng → `teach`; người ngoài → `null`.
- [x] **H4** Đặt/áp lịch, huỷ buổi, thêm buổi dạy bù, sửa buổi lẻ chỉ cho `manage`; người `teach` bị từ chối (`forbidden`) và không có gì thay đổi.
- [x] **H5** Xem lịch của một lớp (`getClassSchedule`) và chuyên cần toàn lớp: `manage` luôn được; `teach` chỉ khi được xếp vào lớp đó; lớp khác → `forbidden`.
- [x] **H6** Mở danh sách điểm danh, đánh dấu, "Có mặt cả lớp" của một buổi: `manage` luôn được; `teach` chỉ khi được xếp vào **buổi** đó; buổi của giáo viên khác → `forbidden` và không ghi gì.
- [x] **H7** `listTeacherMeetings`: người `manage` thấy mọi buổi của khoá; người `teach` chỉ thấy buổi được xếp cho mình (gồm cả buổi chưa gán giáo viên của lớp mình phụ trách). Hai giảng viên cùng khoá không thấy buổi của nhau.
- [x] **H8** Giáo án của khoá (`getCoursePlan`) đọc được bởi `manage` và `teach`; cập nhật theo bản mới của giáo trình vẫn chỉ `manage`.
- [x] **H9** Giảng viên thường (chủ khoá, đồng giảng viên) và Platform Admin không bị ảnh hưởng: mọi hành vi C1–C3 giữ nguyên (các test cũ vẫn xanh).

**Giao diện: không gian chỉ dạy**
- [x] **H10** Người có `center_teacher` mà không có `instructor`/`admin` vào được khu giảng viên (`/instructor`) và được coi là đang ở không gian "Giảng viên" (không có chế độ riêng để chuyển). Menu của họ chỉ còn: Trang chủ, Lịch dạy, Assignment (chấm bài lớp mình), Forum Q&A, và Giám sát phòng thi nếu được xếp. Không có "Khoá học của tôi", "Giáo trình", Limio-Live, Vấn đáp AI, Kiểm tra đánh giá, Đấu trường, Phân tích.
- [x] **H11** Trang chủ của họ là **"Hôm nay tôi dạy"**: các buổi được xếp cho họ hôm nay và 7 ngày tới, mỗi buổi kèm giáo án, liên kết mở bài và nút "Điểm danh"; không có lối tắt "Tạo slide / Tạo đề thi / Tạo khoá học".
- [x] **H12** Ở trang lớp, người `teach` thấy lịch và chuyên cần của lớp mình **chỉ để xem**: không có form đặt lịch, "Sửa", "Huỷ buổi", "+ Thêm buổi dạy bù"; vẫn có "Điểm danh" ở buổi được xếp cho mình.
- [x] **H13** Người `teach` vào thẳng các trang chỉ dành cho người soạn (`/instructor/giao-trinh`, `/instructor/courses/new`) thì được đưa về trang chủ của họ.
- [x] **H14** Trang quản lý thành viên của quản trị trường có công tắc "Giảng viên trung tâm" cho từng thành viên (G2 ở trên).

**P1 (chưa làm ở giai đoạn này):** đề nghị nghỉ/đổi buổi; ghi chú riêng của giáo viên vào giáo án; check-in (C5) và nhận xét sau buổi (C4) dùng đúng quyền "teach" ở trên; Lily trả lời theo vai trò (hiện vẫn nói cả các mục họ không có).

## I · Học viên xem được bài của từng buổi

**Quyết định (2026-10-24, chủ dự án chốt):** học liệu từng buổi (giáo án C3) hiện cho học viên ngay trên lịch học, không chỉ giảng viên. Dữ liệu đã đúng từ C3 (học viên chỉ nhận id và tên bài, bài và chương ẩn bị lọc, không có ghi chú giảng viên); phần còn thiếu là giao diện.

- [x] **I1** Trên lịch (trang Lịch học và lịch ở trang chủ học viên), bấm một ngày: mỗi buổi có giáo án hiện thêm dòng "Bài của buổi" với từng bài là một liên kết mở thẳng `/learn/<slug>/lessons/<id>`. Bấm vào tên buổi vẫn mở như cũ; hai liên kết không lồng nhau.
- [x] **I2** Buổi đã huỷ, buổi không có giáo án và buổi dạy bù không hiện dòng "Bài của buổi".
- [x] **I3** Học viên chỉ thấy bài của lớp mình đang học; bài và chương ẩn không hiện; không có nội dung hay ghi chú giảng viên đi theo (đã kiểm ở C3.6, giữ nguyên).
- [x] **I4** Giảng viên cũng thấy dòng này trên lịch dạy (bấm bài mở trang học của bài đó); trang chủ giảng viên trung tâm giữ nguyên.
- [x] **I5** Cập nhật `GIAO-DIEN.md`, hướng dẫn Lily (học viên xem bài của buổi ở đâu) và bỏ câu "chưa có" nếu có.

## J · Kế hoạch giảng dạy (giáo án từng buổi do giáo viên soạn)

**Trạng thái (2026-10-25, chưa commit):** J1–J13 đã làm. Bảng `ClassMeetingLesson` và cột `ClassMeeting.planCustomized`, `planTopic` (migration `20261025100000_class_meeting_plan`); `core-lms/courses/meetingPlan.ts` (`getMeetingPlan`, `setMeetingPlan`, `addMeetingPlanLessons`, `resetMeetingPlan`) và `sessionPlan.resolveMeetingPlans` (kế hoạch hiệu lực cho mọi nơi dùng); `core-feedback` nhận xét đọc cùng quy tắc; API `/api/meetings/[id]/plan`; giao diện nút "Kế hoạch". Ghi chú: (1) tên giáo án của buổi tuỳ chỉnh là chủ đề giáo viên đặt, không mượn tên chương (chưa có chủ đề thì để trống, hiện "Buổi N"); (2) "Thêm bài" nằm trong form lưu một lần ("Lưu kế hoạch"), giao diện chưa gọi API thêm từng bài; (3) quản trị trường chưa tự có quyền sửa kế hoạch.

**Lý do (2026-10-25):** giáo án theo buổi hiện chỉ có khi khoá sao từ giáo trình dựng sẵn (chương số N ↔ buổi số N). Khoá do giảng viên tự tạo không có cách nào gắn nội dung vào buổi. Chức năng này cho giáo viên hoặc quản trị khoá **thêm bài (lesson) trực tiếp vào từng buổi** sau khi đã có lịch.

**Khái niệm**
- **Kế hoạch của một buổi** = danh sách bài của khoá, có thứ tự, gắn vào đúng buổi đó (không gắn theo số buổi).
- **Theo giáo trình** (mặc định, như C3): chưa tuỳ chỉnh thì buổi lấy bài của chương `sessionNo = số buổi`. Khoá tự tạo không có chương đánh số thì kế hoạch mặc định là trống.
- **Đã tuỳ chỉnh**: lần đầu giáo viên sửa kế hoạch một buổi, hệ thống **chép danh sách mặc định** thành danh sách riêng của buổi, từ đó buổi dùng danh sách riêng (kể cả rỗng) cho tới khi bấm "Đặt lại theo giáo trình". Sửa là **thay thế**, không cộng dồn với giáo trình, để bỏ được bài không dạy.

**Quyết định cần chủ dự án duyệt (mặc định em đề xuất):** (1) sửa = thay thế như trên; (2) chỉ người **quản khoá** (chủ khoá, đồng giảng viên, Platform Admin) sửa; người chỉ dạy chỉ xem; (3) buổi **đã kết thúc hoặc đã huỷ** thì khoá, không sửa (tổng kết đã chụp lúc kết thúc).

- [x] **J1 Quyền.** Người quản khoá sửa được kế hoạch mọi buổi của lớp. Người chỉ dạy (giảng viên trung tâm, trợ giảng) xem được kế hoạch buổi được xếp cho mình nhưng không sửa. Học viên và người lạ không sửa; quản trị trường không tự có quyền (như đặt lịch).
- [x] **J2 Giao diện.** Ở tab "Lịch dạy" của trang lớp, mỗi buổi chưa huỷ có nút **"Kế hoạch"** mở phần soạn ngay tại dòng buổi: danh sách bài (tên bài kèm tên chương), **"+ Thêm bài"** (chọn từ cây chương và bài của khoá, tìm theo tên, chọn được nhiều bài một lần), bỏ một bài, đổi thứ tự lên/xuống, ô **"Chủ đề buổi"** (không bắt buộc, tối đa 120 ký tự), nhãn "Theo giáo trình" hoặc "Đã tuỳ chỉnh" và nút **"Đặt lại theo giáo trình"** khi đã tuỳ chỉnh. Dòng "Giáo án:" của buổi hiện kế hoạch hiệu lực.
- [x] **J3 Ràng buộc dữ liệu.** Bài phải thuộc đúng khoá của lớp; một bài chỉ xuất hiện một lần trong một buổi; cùng một bài được ở nhiều buổi (học lại, ôn tập); tối đa 30 bài mỗi buổi. Bài đang ẩn thêm được (giáo viên xem được) nhưng học viên không thấy.
- [x] **J4 Tuỳ chỉnh lần đầu chép mặc định.** Buổi theo giáo trình có 2 bài, thêm 1 bài thì thành 3 bài (2 bài cũ + 1 bài mới) và chuyển sang "Đã tuỳ chỉnh". Bỏ hết bài thì buổi có kế hoạch rỗng và **không** quay về giáo trình; chỉ "Đặt lại theo giáo trình" mới quay về.
- [x] **J5 Buổi dạy bù** (chưa có số thứ tự) cũng có kế hoạch riêng được.
- [x] **J6 Khoá sau khi kết thúc.** Buổi đã kết thúc (C4.1) hoặc đã huỷ không sửa được (báo rõ lý do); buổi đã qua giờ nhưng chưa kết thúc vẫn sửa được.
- [x] **J7 Mọi nơi dùng kế hoạch hiệu lực.** Danh sách buổi, calendar ("Bài của buổi"), trang chủ giảng viên trung tâm, tổng kết gửi lớp (bài đã học, từ vựng, bài tập về nhà), bản nháp nhận xét từng học viên (bài của buổi, nhãn nắm bài, bài tập). Học viên chỉ nhận id và tên bài, đã lọc bài và chương ẩn; không nội dung, không ghi chú giảng viên.
- [x] **J8 Huỷ buổi không làm lệch.** Huỷ hoặc thêm buổi làm số thứ tự đổi: buổi **theo giáo trình** dịch theo số như C3; buổi **đã tuỳ chỉnh giữ nguyên** bài đã chọn vì gắn theo buổi, không theo số.
- [x] **J9 Cập nhật giáo trình có bản mới.** `updateCourseFromPack` thay cả chương (xoá và tạo lại bài). Chương nào có bài đang nằm trong kế hoạch tuỳ chỉnh của một buổi thì **bỏ qua** (báo "đang dùng trong kế hoạch của buổi N") để không làm mất kế hoạch; các chương khác cập nhật như cũ.
- [x] **J10 Xoá bài khỏi khoá.** Bài bị xoá khỏi khoá thì tự biến khỏi mọi kế hoạch (liên kết xoá theo); không để lại bài "ma".
- [x] **J11 Sự kiện.** Phát `class.plan.changed` khi kế hoạch của buổi đổi (id buổi, số bài thêm và bỏ, có đặt lại hay không); không mang tên bài hay chủ đề. `class.*` đã được loại khỏi "hoạt động của học viên".
- [x] **J12 Không ảnh hưởng người dùng cũ.** Khoá chưa bật tính năng trung tâm không đổi gì; buổi chưa tuỳ chỉnh hiển thị đúng như trước (theo giáo trình). Migration chỉ thêm bảng và cột có mặc định.
- [x] **J13 Tài liệu.** Cập nhật `GIAO-DIEN.md`, hướng dẫn của Lily (kể cả việc khoá tự tạo gắn bài vào buổi thế nào) và danh mục điểm đến nếu có.

**Chưa làm (P1):** kéo thả đổi thứ tự; chép kế hoạch buổi này sang buổi khác hoặc sang lớp khác; gắn bài tập hoặc quiz riêng lẻ (hiện chỉ gắn bài, và bài mang theo quiz/bài tập của nó); xem trước kế hoạch cả khoá dạng bảng.

## Ngoài phạm vi (cố ý)

- Học phí, hoá đơn, công nợ, lương giáo viên, CRM tuyển sinh, quản lý nhiều cơ sở theo chuỗi.
- Zalo, SMS, trường email phụ huynh riêng, xác thực vị trí/wifi cho check-in giáo viên.
- Tự động gửi nhận xét cá nhân không qua giáo viên duyệt.

## Việc cần xác minh khi bắt đầu code C1

- [ ] Vai trò "chủ trung tâm" ánh xạ vào `OrganizationAdmin` hay cần vai trò mới; trung tâm nhỏ có thể chưa có `Organization`.
- [ ] `CohortMember` và `Enrollment.sectionId` độc lập nhau (xem ghi chú course sections): danh sách điểm danh lấy từ nguồn nào, hay hợp cả hai.
- [ ] Cách vỏ Limio Language nối vào menu (cookie `limio_app`) — mã nằm ở nhánh khác, cần đọc lại trước khi gắn menu.
- [ ] Có dùng lại `AcademicTerm` cho "tuần thứ mấy của kỳ" hay để `termLabel` tự gõ như hiện nay.
