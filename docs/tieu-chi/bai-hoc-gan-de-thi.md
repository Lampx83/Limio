# Gắn đề thi vào bài học (khối "Đề thi") — Acceptance criteria

> 10/11/2026, **thầy chọn hướng này và đã duyệt; đã code (xem "Đã làm" ở cuối), chưa commit.** Mục đích: gắn một đề thi thử đã soạn ở khoá vào đúng bài (cuối Unit, Bài 5…), để học viên thi thử và luyện đề ngay tại bài thay vì phải tìm ở trang khoá.

## Hiện trạng

- Đề thi thuộc **khoá** (`Exam.courseId`), hiện cho học viên ở khối "Thi thử" trên trang khoá, mỗi đề một thẻ hai cột Thi thử / Luyện đề (`learn/[slug]/page.tsx`).
- Bài học chỉ có thẻ chung "Sẵn sàng vận dụng? Thi thử ↗" ở thanh bên, dẫn về trang khoá; không trỏ vào đề cụ thể. Loại nội dung `exam_practice` (Bài luyện) là đề **ẩn riêng của khối**, soạn trong bài, không phải đề của khoá.
- Khoá không nhân bản đề thường khi nhân bản khoá (chỉ nhân bản đề ẩn của Bài luyện).

## AC1 — Thêm khối "Đề thi" vào bài (giảng viên)

- Menu **"+ Thêm hoạt động/tài nguyên"** có mục **"Đề thi"** (mô tả: "Gắn một đề thi thử đã có của khoá vào bài"). Chọn thì mở ô chọn đề: danh sách đề thi thử của khoá, mỗi dòng có tên đề, "n phần · m phút" và trạng thái **Nháp / Đã xuất bản**; chọn một đề rồi lưu. Có ô tiêu đề khối tuỳ chọn (mặc định lấy tên đề).
- Chỉ liệt kê đề **thi thử viết** (`mockMode`, `kind = written`) của **chính khoá này**, chưa lưu trữ, và **không** phải đề ẩn của Bài luyện. Một đề gắn được vào nhiều bài; một bài có nhiều khối đề được.
- Khoá chưa có đề thi thử: ô chọn báo "Khoá chưa có đề thi thử" kèm link **"Tạo đề thi thử"** (`/instructor/courses/<id>/exams/new`).
- Dữ liệu: loại nội dung mới `exam_ref`, payload `{ examId, title? }` (zod); `examId` phải thuộc cùng khoá, nếu không thì từ chối `validation_failed`. Thêm giá trị enum `ContentType` qua migration (cùng cách `exam_practice`, `20261109200000`).

## AC2 — Học viên thấy gì trong bài

- **Given** học viên đã ghi danh và đề đã xuất bản với ít nhất một công tắc "Cho thi thử"/"Cho luyện đề" bật. **Then** khối hiện **đúng thẻ đề của trang khoá**: tên, "n phần · m phút", chip kỹ năng, hai cột **Thi thử** ("Mô phỏng thi thật", trạng thái, nút Thi thử / Tiếp tục thi / Thi lại / Xem kết quả) và **Luyện đề** ("Không bấm giờ, xem đáp án ngay", trạng thái, nút Luyện đề / Tiếp tục luyện); đề chỉ bật một chế độ thì một cột. Nút dẫn tới đúng các đường hiện có (`/learn/<khoá>/exams/<đề>`, `…/practice`).
- Thẻ dùng **một thành phần chung** với trang khoá (tách khỏi `learn/[slug]/page.tsx`), nên hai nơi luôn giống nhau, trạng thái (lượt dở, số lần thi, buổi luyện dở) lấy từ cùng truy vấn.
- Hiện ở cả bài **có khung 3 cột** và **ngoài khung** (thẻ không phụ thuộc khung). Không hiện ở chế độ chiếu lớp và trang in.
- **Không** tính vào "Để hoàn thành bài" (làm đề là việc riêng; không đổi quy tắc hoàn thành bài hiện có).

## AC3 — Khi đề không dùng được

- Đề nháp, đã lưu trữ, bị xoá, hoặc tắt cả hai công tắc: **học viên không thấy gì** ở chỗ khối đó (không để ô trống, không lộ tên đề).
- Giảng viên ("Xem như học viên" và trang soạn) thấy thẻ kèm nhãn rõ lý do: "Đề chưa xuất bản — học viên chưa thấy", "Đề đã lưu trữ", "Đề đã bị xoá — chọn đề khác". Khối chưa chọn đề (sau khi nhân bản khoá) hiện "Chưa chọn đề".
- Học viên chưa ghi danh: không thấy khối (cùng quy tắc với các khối cần ghi danh).

## AC4 — Trong trình soạn

- Hàng khối trong bài hiện: tên đề, trạng thái ("Đã xuất bản · Cho thi thử, Cho luyện đề" hoặc "Nháp — học viên chưa thấy"), nút **"Đổi đề"** (mở lại ô chọn) và **"Sửa đề"** (mở trang soạn đề trong khoá). Xoá khối **không xoá đề**.
- Đổi tên đề thì khối hiện tên mới (khối chỉ lưu `examId`, tên lấy từ đề; tiêu đề khối tuỳ chọn thắng nếu có).

## AC5 — Nhân bản

- Nhân bản **bài trong cùng khoá**: khối giữ nguyên `examId`.
- Nhân bản **khoá**: khối được giữ nhưng **bỏ liên kết** (`examId = null`, vì đề thuộc khoá cũ) → hiện "Chưa chọn đề" ở bản sao, không lỗi. Không nhân bản đề.

## AC6 — Không làm hỏng chỗ khác

- Khối "Thi thử" ở trang khoá, thẻ "Sẵn sàng vận dụng?" ở thanh bên, khối Bài luyện, quyền truy cập đề (ghi danh, công tắc, lượt thi) giữ nguyên; làm đề vẫn đi qua các trang thi/luyện đề hiện có (không nhúng lượt thi vào trang bài).
- Không thêm sự kiện học mới (làm đề đã ghi sự kiện riêng); `exam_ref` không phải hoạt động học (`NON_LEARNER_ACTIVITY_PREFIXES` không đổi vì không phát sự kiện).

## Kiểm thử

- Dữ liệu: payload hợp lệ/không hợp lệ (đề khoá khác, đề ẩn của Bài luyện, đề lưu trữ, không có `examId`); nhân bản bài giữ `examId`, nhân bản khoá bỏ `examId`.
- Hiển thị học viên: đủ ba trạng thái (chưa làm / làm dở / đã nộp) và buổi luyện dở như thẻ ở trang khoá; đề nháp/lưu trữ/tắt cả hai công tắc thì không có gì; chưa ghi danh không thấy; giảng viên xem thử thấy nhãn lý do.
- Thành phần thẻ dùng chung: trang khoá và bài giống nhau (test render).
- Trình soạn: thêm, đổi đề, xoá khối; xem trên trình duyệt ở 1280 và 400 px (trong và ngoài khung 3 cột).

## Ngoài phạm vi

Nhúng lượt thi vào trang bài; tính điểm đề vào hoàn thành bài; gắn đề Vấn đáp AI; gắn đề của khoá khác; nhân bản đề cùng khoá; trang in.

## Điểm thầy chốt

1. Tên hiển thị của mục trong menu: **"Đề thi"** (đề xuất) hay "Thi thử / Luyện đề".
2. Có tính vào "Để hoàn thành bài" không (đề xuất: không).

## Đã làm (10/11/2026)

- **Dữ liệu:** `ContentType.exam_ref` (migration `20261110210000_exam_ref_content_type`, chỉ thêm giá trị enum); `ExamRefPayload { examId (uuid|null), title? }` strict; `createContentItem`/`updateContentItem` đòi `examId` hợp lệ và kiểm bằng `assertExamRefTarget` (đề thi thử viết của CHÍNH khoá, chưa lưu trữ, không phải đề ẩn của Bài luyện); nhân bản khoá bỏ `examId` (→ "Chưa chọn đề"), nhân bản bài giữ nguyên. `courses/examRef.ts`: `listExamRefChoices(ForLesson)`, `getExamRefStates`, `getExamRefBlockInfo`, `getExamRefPreviewCard`.
- **Học viên:** `components/exam/MockExamCard.tsx` là thẻ DÙNG CHUNG (tách từ trang khoá, trang khoá nay dùng nó); khối trong bài dựng ở `learn/[slug]/lessons/[lessonId]/page.tsx` (`examRefBlocks`) qua `listMockExamsForLearner` nên chỉ hiện khi đề dùng được; `LessonContent` hiện/ẩn theo `blocks`. Tiêu đề khối thắng tên đề. Chiếu lớp và trang in không hiện.
- **Giảng viên:** mục **"Đề thi"** trong "+ Thêm hoạt động/tài nguyên" (`ActivityPicker`), ô chọn `ExamRefPicker` (API `GET /api/lessons/<bài>/exam-ref-choices`; khoá chưa có đề thì báo kèm link "Tạo đề thi thử"), sửa/đổi đề ở `EditContentItemForm`, hàng khối có tên đề, trạng thái, hai công tắc hoặc lý do học viên chưa thấy, nút "Sửa đề" (API `GET /api/contents/<khối>/exam-ref`); xoá khối nói rõ không xoá đề. "Xem như học viên": thẻ không bấm được kèm ghi chú, hoặc nhãn lý do (chưa xuất bản, lưu trữ, bị xoá, khoá khác, tắt cả hai công tắc, chưa chọn đề).
- **Kiểm thử:** `courses/__tests__/examRef.test.ts` (10 ca), `MockExamCard.test.tsx` (5 ca), `LessonContent.examRef.test.tsx` (2 ca). Đã thử trên trình duyệt: thêm khối "Đề thi" vào bài demo (chọn đề HSK, đặt tiêu đề), hàng khối hiện đúng, "Xem như học viên" hiện thẻ không bấm được, học viên thấy thẻ với trạng thái thật ("Tiếp tục thi", "Đang luyện dở · 1/8 câu") và đúng đường dẫn. Đã xoá khối và đề thử khỏi dev.
- **Lưu ý khi triển khai:** có migration mới (thêm giá trị enum); bước `migrate` của deploy tự áp. Dev server phải khởi động lại sau `prisma generate` (client cũ báo "Invalid value for argument `type`").
- **Chưa xem tay:** nhân bản khoá có khối "Đề thi" trên giao diện (đã phủ bằng test), đề nháp/lưu trữ phía học viên (phủ bằng test và truy vấn `listMockExamsForLearner`), khối trong bài ngoài khung 3 cột, điện thoại thật.

