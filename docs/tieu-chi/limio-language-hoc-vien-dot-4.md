# Limio Language — Đợt 4: nối Bài luyện vào nhãn kỹ năng và Lịch ôn tập — Acceptance criteria

> Bản nháp 09/11/2026, **đã duyệt và đã code (xem "Đã làm" ở cuối), chưa commit.** Tiếp nối đợt 1–3 (`aa9a7e63` … `2b585e40`). Gắn với B1/B2 (BKT, hồ sơ kỹ năng), LANG G3/G5e, và menu "Lịch ôn tập" trong Figma.

> **Cập nhật 10/11/2026:** trang "Lộ trình của tôi" đã bỏ, và mục "Lịch ôn tập" **tạm bỏ khỏi menu** (trang `/language/lich-on-tap`, các hàm đọc dữ liệu và cầu nối Bài luyện → nhãn kỹ năng vẫn giữ; chỉ không có liên kết dẫn tới). Xem `docs/tieu-chi/limio-language-gop-menu.md`.

## Vì sao làm

Đợt 3 để lại hai khoảng trống đã nói thẳng:
1. Câu làm trong **Bài luyện** chỉ ghi sự kiện `exam.practice.answered`, **chưa làm đổi** nhãn Cần ôn / Nên luyện / Vững ở "Hồ sơ kỹ năng". Học viên luyện nhiều mà nhãn đứng yên.
2. Menu "Lịch ôn tập" của Figma chưa có trang, và thẻ "Đến lúc ôn lại" mới chỉ có từ vựng.

## Đối chiếu mã (09/11/2026)

- **Cách nhãn được tính:** `getLanguageProfile` gộp `LearnerSkillState` của các **skill gắn vào bài** (lesson-as-tag, có `Skill.languageSkill`). Nhãn chỉ hiện khi tổng lượt trả lời ≥ 5 (`LANGUAGE_PROFILE_MIN_EVIDENCE`).
- **Cách BKT được cập nhật:** quiz gọi `updateLearnerStateFromAttempt` khi nộp (ở tầng `apps/web`, vì core-lms và core-feedback không import nhau, §4.3). Có sẵn `updateLearnerStateForLessonObservation(userId, lessonId, isCorrect)` (đường H5P) áp **một lượt quan sát lên các skill gắn vào bài**, nhưng đang gắn cứng `source: "h5p"`.
- **Skill của câu hỏi đề thi khác skill của bài:** `ExamQuestionSkillTag` trỏ tới skill do giảng viên tự tạo, **không có** `languageSkill`, nên hồ sơ bỏ qua. Vì vậy cầu nối đúng là **áp lượt quan sát lên skill của bài chứa khối Bài luyện** (cùng cách H5P), không phải lên skill của câu hỏi.
- **Bộ máy kiểm tra** `checkPracticeAnswer` chấm lại được nhiều lần (mở lại bài là gọi lại); cần chặn việc tính trùng.
- **Thẻ ôn từ vựng** đã có lịch ôn cách quãng (`FlashcardState.dueAt`, chỉ mục `(userId, courseId, dueAt)`), đủ để vẽ lịch các ngày tới. **Điểm ngữ pháp thì chưa có mô hình dữ liệu nào.** `/me/lich-hoc` là lịch buổi học của trung tâm, không phải trang này.

## Phạm vi

- **Có:** (A) cầu nối Bài luyện → nhãn kỹ năng; (B) trang **Lịch ôn tập** `/language/lich-on-tap` và mục menu; (C) thẻ "Đến lúc ôn lại" ở "Lộ trình của tôi" thêm số câu luyện nên làm lại.
- **Không đổi schema, không migration.** Một sự kiện mới `exam.practice.observed`.
- **Không làm:** điểm ngữ pháp (chưa có mô hình nội dung; đề xuất để sau khi thầy chốt cách soạn), cầu nối cho **trang luyện đề độc lập** (không biết bài nào để ghi nhận), XP/huy hiệu cho luyện đề, hiện số mastery cho học viên.
- **Chỉ trong vỏ Language, vai học viên**, như các đợt trước.

## AC1 — Cầu nối: Bài luyện làm đổi nhãn kỹ năng

- **API:** `POST /api/practice-sessions/[id]/check/[questionId]` nhận thêm **tuỳ chọn** thân `{ lessonId }`. Bài luyện nhúng luôn gửi nó (cả lúc "Kiểm tra câu n" lẫn lúc nạp lại kết quả khi mở bài). Không có thân thì hành vi y như cũ.
- **Kiểm liên kết ở máy chủ** (không tin `lessonId` từ máy khách): bài phải **hiển thị cho học viên**, thuộc khoá mà học viên **đang ghi danh**, và có khối `exam_practice` **không ẩn** trỏ đúng đề của buổi luyện. Sai một điều kiện thì **chỉ bỏ qua cầu nối**, kết quả kiểm tra vẫn trả về bình thường (không lỗi, không để lộ vì sao).
- **Một lượt quan sát mỗi (buổi, câu):** lần kiểm tra **đầu tiên** của câu được tính; sửa đáp án rồi kiểm tra lại, hoặc mở lại bài, **không** tính thêm. Bảo đảm bằng sự kiện `exam.practice.observed` có `eventKey = exam.practice.observed:<buổi>:<câu>`; chỉ khi sự kiện **vừa được tạo** mới gọi BKT, trong cùng luồng xử lý.
- **Chỉ câu chấm tự động** (không phải câu chờ giảng viên chấm) mới được tính. Khoá không bật cá nhân hoá (không có skill gắn bài) thì không có gì thay đổi và không lỗi.
- **Tác động:** `updateLearnerStateForLessonObservation` được thêm tham số `source` (`"h5p"` mặc định, `"practice"` cho đường này); `skill.state.updated` ghi đúng nguồn và `lessonId`.
- **Điều không đổi:** học viên không nhận số mastery; nhãn vẫn chỉ hiện khi đủ 5 lượt; lớp đối chứng (B10) vẫn không thấy kênh này; quiz và H5P chạy như cũ.
- Cầu nối ở `apps/web` (tầng điều phối): core-lms không import core-feedback (§4.3).
- Payload sự kiện chỉ mang id và `correct` (không mang đáp án).

## AC2 — Trang Lịch ôn tập

- Menu vỏ Language có **Lịch ôn tập** (`/language/lich-on-tap`) sau "Thư viện giáo trình"; sáng ở trang con; `languageMenu` và test cập nhật.
- Chọn khoá bằng `?course=<slug>` như "Lộ trình của tôi" (chỉ khoá ngoại ngữ mình đang học; slug lạ bị bỏ qua).
- **Khối "Hôm nay":** số thẻ từ vựng đến hạn (kể cả quá hạn) và nút tới `/learn/<slug>/flashcards`; không có thì "Hôm nay không có thẻ nào đến hạn".
- **Khối "7 ngày tới":** số thẻ đến hạn theo từng ngày (giờ Việt Nam, `vnDayStart`), hôm nay đã gồm thẻ quá hạn; ngày không có thẻ hiện 0; chỉ tính thẻ còn hiển thị trong bộ thẻ (bài ẩn/khoá không tính, cùng luật với `getFlashcardStats`).
- **Khối "Câu luyện nên làm lại":** mỗi đề thi thử đã bật "Cho luyện đề" của khoá có câu mà **lần trả lời gần nhất sai**: tên đề, số câu, nút "Làm lại" (tới trang luyện đề của đề, bộ lọc "sai"). Chỉ đề học viên đã làm; không đề nào thì ẩn khối.
- **Khối "Gợi ý hôm nay":** dùng `suggestion` của `getLanguageProfile` (cùng nguồn "Luyện hôm nay"); không có thì ẩn. Không hiện số mastery.
- Không có việc nào đến hạn ở cả ba khối thì hiện `<EmptyState>` "Hôm nay bạn đã ôn xong".
- **Quyền:** chỉ dữ liệu của chính người xem; chưa đăng nhập → đăng nhập; giảng viên/admin → về trang chủ của họ (như `/language`); `noindex`. **Responsive (§4.6):** một cột dưới `lg`, không cuộn ngang ở 375px.

## AC3 — Thẻ "Đến lúc ôn lại" ở Lộ trình của tôi

- Giữ dòng từ vựng hiện có. **Thêm** dòng "n câu luyện nên làm lại" (tổng các đề của khoá đang chọn) khi n > 0, và liên kết "Xem lịch ôn tập" tới `/language/lich-on-tap?course=<slug>`.
- Thẻ ở trạng thái "không có gì đến hạn" chỉ khi **cả hai** đều 0.
- Không còn nhắc "điểm ngữ pháp" (chưa có).

## AC4 — Tài liệu, kiểm thử, xong

- Cập nhật `GIAO-DIEN.md` (mục Bài luyện hiện đang ghi "chưa làm đổi nhãn": sửa lại cho đúng, kèm quy tắc "lần kiểm tra đầu của mỗi câu" và "cần ít nhất 5 lượt mới hiện nhãn") và hướng dẫn của Lily; `teacherAssistantFreshness` vẫn xanh.
- Test lõi: liên kết hợp lệ/không hợp lệ (bài ẩn, khoá khác, khối ẩn, đề khác, chưa ghi danh); tính **đúng một lần** (kiểm tra lại, sửa đáp án rồi kiểm tra lại, mở lại bài); câu tự luận không tính; BKT thật sự đổi `LearnerSkillState` của skill gắn bài; khoá không cá nhân hoá không đổi gì; `source` đúng; lịch 7 ngày (múi giờ VN, quá hạn vào hôm nay, bài ẩn không tính); câu sai gần nhất.
- Test giao diện: menu, trang Lịch ôn tập các trạng thái, thẻ ôn lại ở Lộ trình.
- `tsc` sạch, web và core-lms xanh; xem bằng mắt trên dev ở 375px và desktop. Không commit, không push khi chưa được thầy bảo.

## Giới hạn nói thẳng

- Luyện đề làm ở **trang riêng** (không qua Bài luyện trong bài) vẫn không làm đổi nhãn.
- Nhãn chỉ nhúc nhích sau ≥ 5 lượt trong các bài cùng kỹ năng; vài câu đầu chưa đủ để đổi nhãn.
- Điểm ngữ pháp vẫn chưa có.

## Cần thầy chốt (mặc định đề xuất in đậm)

1. Mỗi câu chỉ tính **lần kiểm tra đầu tiên** (chống "xem đáp án rồi đổi để được điểm"), giống quiz nơi đáp án là cuối cùng: đồng ý?
2. Chỉ **Bài luyện nhúng trong bài** làm đổi nhãn; luyện đề độc lập chưa: đồng ý?
3. Số phút ước tính ("khoảng 6 phút" trong Figma): **không hiện** (không có số đo thật), hay dùng quy tắc cố định 15 giây mỗi thẻ?
4. Điểm ngữ pháp: **để sau**, chờ quyết định cách soạn nội dung ngữ pháp (bảng ngữ pháp như bảng từ vựng?): đồng ý?
5. "Làm lại" câu sai đi tới **trang luyện đề sẵn có** (lọc câu sai) thay vì làm ngay trong Lịch ôn tập: đồng ý?

## Đã làm (09/11/2026, chưa commit)

- **Không schema, không migration.** Sự kiện mới `exam.practice.observed`.
- **Cầu nối (AC1):** `observePracticeAnswer` (core-lms, `exam/practice.ts`) kiểm liên kết bài–khối–đề–ghi danh ở máy chủ rồi ghi sự kiện với `eventKey` theo (buổi, câu) nên chỉ lần kiểm tra đầu tiên được tính; route `POST /api/practice-sessions/[id]/check/[questionId]` nhận thân tuỳ chọn `{ lessonId }` và, khi `created`, gọi `updateLearnerStateForLessonObservation(..., "practice")` (core-feedback, thêm tham số `source`). Lỗi ở cầu nối không làm hỏng việc kiểm tra. `LessonPractice` gửi `lessonId` ở cả lúc bấm Kiểm tra lẫn lúc nạp lại kết quả.
- **Sửa lỗi tìm thấy khi thử trên dev:** hai lượt quan sát chạy song song (bấm "Kiểm tra" hai câu liên tiếp) **mất một lượt** vì đọc-sửa-ghi `LearnerSkillState` không có khoá (thử thật: 3 lượt quan sát ra `attempts = 2`). Đã bọc mỗi skill trong một giao dịch có khoá tư vấn `pg_advisory_xact_lock` theo (người học, skill); có test chạy song song 6 lượt ra đúng 6. Đường H5P dùng chung hàm này nên cũng được hưởng.
- **Lịch ôn tập (AC2):** `getFlashcardSchedule` (core-feedback; thẻ quá hạn vào hôm nay, ranh giới ngày theo giờ VN, bài ẩn không tính), `getPracticeReviewSummary` (core-lms; câu có lần trả lời gần nhất sai, chỉ đề bật "Cho luyện đề"), trang `/language/lich-on-tap`, mục menu "Lịch ôn tập", `ReviewSchedule`; "Làm lại" mở `/learn/<slug>/exams/<đề>/practice?filter=wrong` (`PracticeSetup` nhận `initialFilter`).
- **Thẻ ôn lại (AC3):** thêm dòng "n câu luyện nên làm lại" và liên kết "Xem lịch ôn tập →"; chữ khi không có gì là "Hôm nay không có gì đến hạn."
- **Tài liệu (AC4):** `GIAO-DIEN.md` và hướng dẫn Lily sửa câu "chưa làm đổi nhãn" cho đúng.
- **Kiểm thử:** web 220 file / 2554 test, core-feedback 63 file / 740 test, core-lms (language, courses, exam, learning) 127 file / 1601 test, đều xanh; `tsc` sạch ở ba gói. Chạy thật trên dev: chọn đáp án và "Kiểm tra" trong Bài luyện ghi `exam.practice.observed` (đúng/sai) và `skill.state.updated` với `source = practice`; trang Lịch ôn tập hiện "Câu luyện nên làm lại" và gợi ý; thẻ ở Lộ trình có dòng mới; 375px không tràn ngang.
- **Mặc định đã chốt theo đề xuất:** chỉ lần kiểm tra đầu mỗi câu; chỉ Bài luyện nhúng làm đổi nhãn; không hiện số phút; điểm ngữ pháp để sau; "Làm lại" đi tới trang luyện đề sẵn có.
- **Dữ liệu dev đã dùng để xem:** thêm tạm khối "Bài luyện", buổi luyện và trạng thái kỹ năng của giảng viên mẫu; **đã dọn hết** (sự kiện đã ghi vẫn còn vì `LearningEvent` là append-only).
- **Lưu ý khi commit:** `shared-types/src/events.ts` có thay đổi của việc khác cùng file; chỉ staging một khối `ExamPracticeObserved`.
