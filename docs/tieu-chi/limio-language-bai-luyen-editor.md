# Limio Language — Editor riêng cho "Bài luyện" (không qua thiết kế đề thi) — Acceptance criteria

> Bản nháp 10/11/2026, **đã duyệt (mô hình "bản đề ẩn", dạng câu như AC3) và đã code (xem "Đã làm" ở cuối), chưa commit.** Thay cách soạn của khối "Bài luyện" đã làm ở đợt 3b (`docs/tieu-chi/limio-language-hoc-vien-dot-3.md`): hiện giảng viên phải dựng một **đề thi thử** ở mục Đề thi rồi chọn nó trong bài. Thầy chốt 10/11/2026: **Bài luyện có editor riêng để giảng viên đưa học liệu lên, không đi qua phần thiết kế đề thi.**

## Vì sao làm

- Bài luyện là **học liệu nằm trong bài** (một đoạn văn hoặc bài nghe kèm vài câu để học viên tự kiểm tra), không phải một kỳ thi. Bắt giảng viên tạo "đề thi thử theo khung", xuất bản, bật "Cho luyện đề", rồi quay lại bài để chọn là quá nhiều bước và dùng sai khái niệm ("Đề thi" có giờ, phần, trọng số, bảng quy đổi điểm).
- Quy ước thuật ngữ (CLAUDE.md §4.6.1): "Đề thi" là nội dung câu hỏi + cài đặt của luồng kiểm tra đánh giá; Bài luyện **không** thuộc luồng đó.

## Đối chiếu mã (10/11/2026)

- Khối `exam_practice` hiện lưu `payload = { examId, title? }` trỏ tới một `Exam` đã xuất bản, đã bật `mockMode`, cùng khoá (`courses/practiceBlock.ts`, `PracticeBlockFields.tsx`, route `GET /api/lessons/[lessonId]/practice-exams`).
- Phía học viên đã có sẵn bộ máy dùng được cho nội dung này: `getPracticeForEmbed`, `ExamPracticeSession/Answer`, chấm từng câu `checkPracticeAnswer`, cầu nối nhãn kỹ năng `observePracticeAnswer`, hiển thị `LessonPractice` (đoạn văn bên cạnh câu hỏi, "Kiểm tra câu n", giải thích đáp án).
- Editor đề thi có sẵn các thành phần soạn đúng thứ cần: `PassageEditor` (đoạn văn Tiptap, ảnh/âm thanh qua `ExamAsset`, chính sách nghe lại), `QuestionEditor` (các dạng câu, ô "Giải thích đáp án").
- **Chưa lên production** (PR #119 chờ merge), nên đổi được mô hình dữ liệu của khối này mà không phải giữ tương thích với bài luyện cũ.

## Phương án (đề xuất)

Khối Bài luyện **sở hữu nội dung của chính nó**, soạn ở một editor riêng mở từ khối; phía lưu trữ vẫn tái sử dụng bộ máy luyện đề hiện có bằng một "bản đề ẩn" gắn với khối:

- Thêm cột `Exam.ownerContentItemId` (nullable, **unique**, khoá ngoại tới `ContentItem`, `ON DELETE CASCADE`). `Exam` có cột này khác null là **nội dung của một khối Bài luyện**: giảng viên không bao giờ thấy nó như một đề thi.
- Payload của khối đổi thành `{ title? }`. Không còn `examId`.
- Ưu điểm: giữ nguyên chấm câu, phiên luyện, lưu đáp án, cầu nối BKT, giao diện học viên; xoá khối thì nội dung xoá theo. Rủi ro: **mọi chỗ liệt kê/đếm đề thi phải loại đề có chủ** (xem AC8).

Phương án thay thế (không đề xuất): lưu câu hỏi thành JSON ngay trong payload của khối. Rẻ về lược đồ nhưng phải viết lại chấm điểm, lưu đáp án và cầu nối kỹ năng.

## Phạm vi

- **Có:** (A) editor riêng cho Bài luyện; (B) đưa học liệu lên (đoạn văn, ảnh, âm thanh); (C) soạn câu hỏi và giải thích đáp án; (D) xem trước đúng như học viên; (E) bỏ cách chọn đề thi thử cũ; (F) nhân bản bài/khoá mang theo Bài luyện; (G) loại đề có chủ khỏi mọi danh sách đề.
- **Không làm (đợt này):** nhập câu hỏi từ Ngân hàng câu hỏi; nhập từ Word/Markdown; câu tự luận hoặc câu cần chấm tay; thời gian làm bài, phần, trọng số, điểm quy đổi, lịch, mã vào; thống kê chi tiết theo câu cho giảng viên (đợt sau); AI sinh câu hỏi.
- **Giữ nguyên:** giao diện học viên của Bài luyện, cầu nối nhãn kỹ năng, trang Lịch ôn tập (tạm không có liên kết).

## AC1 — Mở editor từ khối

- **Given** giảng viên sửa được khoá **When** thêm hoạt động "Bài luyện" vào bài (tile như hiện nay) **Then** hộp thêm chỉ hỏi **Tiêu đề** (không bắt buộc), sau khi lưu mở thẳng editor Bài luyện của khối đó; **không còn** ô "Đề thi thử".
- Mỗi hàng khối Bài luyện trong bài có nút **"Soạn bài luyện"** mở editor, và tóm tắt: số đoạn, số câu; khối rỗng báo **"Chưa có câu hỏi"**.
- Quyền: ai sửa được khoá (chủ khoá, đồng giảng viên theo đúng `assertCanEditCourse` hiện dùng cho bài học) vào được editor; người khác bị từ chối như các trang soạn bài khác.
- Editor là **một trang riêng** (`/instructor/courses/{id}/bai-luyen/{contentItemId}`, xem trước ở `.../xem-truoc`) có đường quay về trang soạn khoá, không phải hộp nhỏ, vì nội dung dài.

## AC2 — Đưa học liệu lên

- Editor cho thêm nhiều **Đoạn**; mỗi đoạn có: tiêu đề (không bắt buộc), nội dung soạn bằng trình soạn văn bản của Limio, **ảnh**, **âm thanh** (bài nghe) và **video** (tải tệp từ máy lên bằng "Tải video lên", hoặc "Dán link video" YouTube/Vimeo/Google Drive/OneDrive/link .mp4), cho nghe lại thoải mái hoặc giới hạn số lần (dùng lại chính sách nghe lại sẵn có của đoạn văn đề thi).
- Mỗi đoạn có các **câu hỏi** của nó; ngoài ra có thể có câu hỏi **không thuộc đoạn nào**.
- Sắp xếp lại thứ tự đoạn và câu (kéo thả hoặc nút lên/xuống), nhân bản và xoá đoạn/câu.
- Xoá đoạn hoặc câu đã có học viên làm có **hộp xác nhận nói rõ** là lượt làm của học viên với câu đó cũng bị xoá.
- Tệp tải lên theo đúng giới hạn dung lượng và loại tệp của kho học liệu hiện có; không tạo luồng tải riêng.

## AC3 — Soạn câu hỏi

- Các dạng được dùng: một đáp án, nhiều đáp án, Đúng/Sai/Không có thông tin, điền khuyết, trả lời ngắn (có đáp án chấp nhận được), sắp xếp, ghép cặp, số, kéo thả điền. **Không có** tự luận.
- Mỗi câu có ô **"Giải thích đáp án"** (hiện cho học viên sau khi bấm "Kiểm tra câu n", như đợt 3c).
- Kiểm hợp lệ khi lưu, dùng đúng luật của trình soạn câu hỏi hiện có (ví dụ trắc nghiệm có ít nhất 2 lựa chọn và ít nhất 1 đáp án đúng); lỗi hiện ngay cạnh câu, không lưu câu sai.
- Không có ô gắn "chủ đề/kỹ năng" thủ công (lesson-as-tag, CLAUDE.md §4.4): nhãn kỹ năng lấy từ bài chứa khối như đợt 4.
- **Không có** thời lượng, phần, trọng số, điểm, bảng quy đổi, lịch hay mã vào ở bất cứ đâu trong editor.

## AC4 — Lưu và xem trước

- Lưu tự động từng thay đổi (hoặc nút "Lưu" rõ ràng) và báo trạng thái "Đã lưu/Đang lưu/Lỗi"; mất kết nối không làm mất phần đã lưu.
- Nút **"Xem trước"** mở đúng giao diện học viên (đoạn văn cạnh câu hỏi, kiểm tra từng câu) trên **dữ liệu thật của khối**, không ghi đáp án nào vào sổ của giảng viên và không tạo phiên luyện thật.
- Không có bước "xuất bản": Bài luyện hiện cho học viên cùng quy tắc hiển thị của **bài chứa nó** (bài ẩn thì ẩn). Khối chưa có câu hỏi thì học viên **không thấy khối** (không thấy khung rỗng), giảng viên thấy cảnh báo ở hàng khối.

## AC5 — Phía học viên không đổi

- `LessonPractice`, `getPracticeForEmbed`, kiểm tra từng câu, tóm tắt, "Luyện lại", cầu nối nhãn kỹ năng (`exam.practice.observed`), cấu hình công khai **không có đáp án/giải thích** cho câu chưa kiểm tra: giữ nguyên hành vi và test hiện có.
- Học viên phải đã ghi danh khoá và bài hiển thị mới làm được; người chưa ghi danh nhận `not_enrolled` như cũ.
- Cờ "Cho luyện đề" của đề không còn ý nghĩa với đề có chủ: Bài luyện luôn cho làm.

## AC6 — Mô hình dữ liệu

- Migration: `Exam.ownerContentItemId String? @unique`, khoá ngoại tới `ContentItem(id)` `ON DELETE CASCADE`. Không sửa dữ liệu đề đang có (cột mới null).
- Payload `exam_practice` = `{ title? }` (kiểm bằng schema); payload cũ có `examId` bị từ chối khi lưu mới. Bài luyện cũ ở **dev DB** (demo) được dựng lại bằng script seed; production chưa có.
- Tạo khối ⇒ tạo luôn `Exam` ẩn (`kind = written`, `mockMode = false`, `allowPractice = true`, trạng thái đã xuất bản nội bộ, `courseId` của khoá, `createdById` người tạo) trong **cùng giao dịch**; không để lẻ khối không có đề hoặc đề không có khối.
- Xoá khối ⇒ xoá `Exam` ẩn, đoạn, câu, tệp đính kèm tham chiếu và lượt luyện của học viên (cascade), sau hộp xác nhận nói rõ.

## AC7 — Sự kiện và quyền riêng tư

- Mọi thay đổi nội dung Bài luyện phát sự kiện `lesson.practice.updated` (chủ thể là giảng viên; payload chỉ mang `lessonId`, `contentItemId`, số đoạn, số câu — **không** mang chữ của câu hỏi hay đáp án). Tiền tố `lesson.practice.` thêm vào `NON_LEARNER_ACTIVITY_PREFIXES` (giảng viên soạn không phải hoạt động học).
- Đáp án và giải thích chỉ giảng viên thấy ở editor; không bao giờ có trong phản hồi dành cho học viên trước khi kiểm tra từng câu (test đã có, mở rộng sang đường mới).

## AC8 — Đề có chủ không lộ ra như đề thi

Đề có `ownerContentItemId` khác null **không** xuất hiện ở: trang và API **Đề thi** của khoá, Ngân hàng câu hỏi/đợt thi/ca thi, danh sách "Luyện đề"/"Thi thử" của học viên, báo cáo và xuất kết quả đề, đếm đề của khoá, nhân bản đề, và mọi truy vấn liệt kê `exam` còn lại. Cách làm: một điều kiện dùng chung (`ownedPracticeExcluded()`) áp ở mọi truy vấn liệt kê; có **test quét** báo đỏ nếu một truy vấn `exam.findMany` trong `core-lms/src/exam` và `courses` không đi qua điều kiện đó (hoặc không có ghi chú ngoại lệ có lý do).

## AC9 — Nhân bản

- Nhân bản **bài** (cùng khoá) và nhân bản **khoá** sao chép sâu Bài luyện: tạo khối mới, `Exam` ẩn mới, đoạn, câu và tệp đính kèm tham chiếu (không dùng chung hàng với bản gốc, sửa bản sao không ảnh hưởng bản gốc). Bỏ giới hạn hiện tại "nhân bản khoá bỏ khối Bài luyện".
- Không chép lượt luyện của học viên.

## AC10 — Dọn mã, hướng dẫn và tài liệu

- Xoá: `PracticeBlockFields`, `listSelectablePracticeExams`, `assertPracticeBlockExam`, route `GET /api/lessons/[lessonId]/practice-exams` và test của chúng.
- Cập nhật hướng dẫn Lily (`teacherAssistantGuide.ts`, mục "Bài luyện trong bài học": bỏ bước tạo đề thi thử; ghi đúng tên nút "Soạn bài luyện", "Xem trước"; `useCases` mới) và `GIAO-DIEN.md`; test `teacherAssistantFreshness` xanh. Cập nhật CLAUDE.md §4.6.1 một dòng: Bài luyện không phải Đề thi.
- Đánh dấu ở AC đợt 3 rằng cách soạn "chọn đề thi thử" đã được thay bởi tài liệu này.

## AC11 — Kiểm thử

- Hàm thuần/dịch vụ: tạo khối kèm đề ẩn trong một giao dịch; xoá khối cascade; payload cũ bị từ chối; quyền (chủ khoá, đồng giảng viên, người lạ); kiểm hợp lệ câu hỏi; sắp xếp; không lộ đáp án.
- AC8: test quét điều kiện loại đề có chủ; kiểm từng chỗ liệt kê chính (danh sách đề của khoá, luyện đề học viên, nhân bản đề).
- AC9: nhân bản bài và khoá sao chép sâu, bản sao độc lập.
- Giao diện: editor (thêm đoạn/câu, sửa, xoá có xác nhận, xem trước); học viên làm bài luyện từ nội dung mới.
- `tsc` sạch, web/core-lms qua, xem bằng trình duyệt ở 1280 px và 375 px.

## Câu cần thầy chốt trước khi code

1. **Mô hình lưu:** "bản đề ẩn" như trên (đề xuất), hay lưu JSON trong khối.
2. **Dạng câu:** danh sách ở AC3 (không tự luận) có ổn không; có cần thêm/bớt dạng nào.
3. **Thời điểm (đã rõ 10/11/2026: #119 đã merge, production chưa có khối Bài luyện nào nên không cần chuyển dữ liệu):** PR #119 đã merge/deploy chưa? Nếu **chưa**, nên làm trên nhánh #119 để production không bao giờ có cách chọn đề cũ. Nếu **rồi**, làm thành PR tiếp theo và migration thêm cột `ownerContentItemId`; bài luyện cũ nếu có sẽ cần đổi sang mô hình mới (tôi viết script chuyển).

## Đã làm (10/11/2026)

- **Mô hình:** migration `20261110200000_exam_owner_content_item` (`Exam.ownerContentItemId` unique, FK `ON DELETE CASCADE`, không đổi dữ liệu nào). Tạo khối ⇒ tạo luôn đề ẩn + một phần trong **cùng giao dịch** (`createContentItem`); payload chỉ `{ title? }`, payload cũ có `examId` bị từ chối (`.strict()`). Đổi tiêu đề khối ⇒ đổi tên đề ẩn. Xoá khối ⇒ cascade.
- **Editor:** `/instructor/courses/{id}/bai-luyen/{contentId}` (`PracticeEditor`): thêm/sửa/xoá/đổi thứ tự đoạn và câu, dùng lại `PassageEditor` và `QuestionEditor` với prop `practiceMode` (ẩn Điểm, Skill, "Hiển thị", không có Tự luận). Khối trong bài chỉ còn ô Tiêu đề; thêm xong tự mở editor; hàng khối có "n đoạn · m câu hỏi" / cảnh báo "Chưa có câu hỏi", nút "Soạn bài luyện", hộp xác nhận xoá nói rõ kết quả luyện cũng mất.
- **Xem trước:** `.../xem-truoc` dùng `LessonPractice` ở chế độ `preview` (không tạo buổi, không lưu đáp án, chấm qua `POST /api/practice-preview/{examId}/check/{questionId}`, không ghi sự kiện/kỹ năng).
- **Học viên:** đọc nội dung từ đề ẩn của khối; khối chưa có câu thì không hiện; giao diện, kiểm tra từng câu, cầu nối nhãn kỹ năng giữ nguyên (`observePracticeAnswer` kiểm "bài chứa khối sở hữu đề này").
- **Thứ tự làm bài:** hook `afterOwnedPracticeChanged` đồng bộ `ExamSectionItem.orderInSection` với thứ tự editor (đoạn rồi câu lẻ) sau mỗi thay đổi và phát `lesson.practice.updated` (chỉ id + số đoạn/câu; tiền tố `lesson.practice.` không tính là hoạt động học).
- **AC8:** `EXCLUDE_OWNED_PRACTICE` + `ownerContentItemId: null` ở mọi truy vấn liệt kê/đếm đề (danh sách đề của khoá, Thi thử của học viên, tổ chức thi, đợt thi, đánh giá, tìm kiếm…); test quét `apps/web/src/lib/ownedPracticeExcluded.test.ts` đỏ nếu một truy vấn `exam.findMany/count/findFirst/groupBy` thiếu điều kiện hoặc ghi chú `owned-practice-ok: <lý do>`.
- **AC9:** nhân bản bài và nhân bản khoá sao chép sâu Bài luyện (đề, phần, tệp đính kèm đổi id, đoạn, câu); không chép lượt luyện.
- **Dọn:** xoá `PracticeBlockFields`, `listSelectablePracticeExams`, `assertPracticeBlockExam`, route `/api/lessons/[lessonId]/practice-exams`. Cập nhật Lily, `GIAO-DIEN.md`, CLAUDE.md §4.6.1 và script seed demo.
- **Kiểm tra:** `tsc` sạch (web, core-lms, shared-types); web 217 file / 2486 test; core-lms 194 file / 2184 test (gồm `practiceBlock.test.ts` viết lại 13 ca, `practiceObserve.test.ts`). Xem trên trình duyệt (dev): trang soạn, xem trước và chấm câu, hàng khối trong bài, bản hẹp 375 px, học viên làm bài luyện từ nội dung mới.
- **Chưa kiểm bằng mắt:** tải âm thanh/ảnh thật vào đoạn từ editor; nhân bản bài/khoá trên giao diện (đã có test dịch vụ); thêm khối mới qua hộp "+ Thêm hoạt động/tài nguyên".
- **Video trong đoạn (bổ sung 10/11/2026):** ngoài ảnh và âm thanh, đoạn văn của Bài luyện nhận **video**: nút **"Tải video lên"** (kho video của bài học: MP4, WebM, MOV, MKV, OGV, tối đa 500 MB; chỉ ở chế độ Bài luyện, không mở thêm cho đề thi) và **"Dán link video"** (YouTube, Vimeo, Google Drive, OneDrive, link .mp4/.webm; có sẵn từ trước, đổi nhãn "Chèn video"). Mỗi video bắt buộc có mô tả (alt text). Học viên thấy trình phát `<video>` (tệp) hoặc khung nhúng (link). Test: `contentHelpers.video.test.tsx` (thẻ ↔ nút video, `<video>` đúng tệp, nhúng YouTube/Vimeo).

## Bổ sung 10/11/2026 — "Xem như học viên" hiện Bài luyện

- **Lỗi:** bấm "Xem như học viên" (`?preview=1`) ở trang bài thì khối Bài luyện trống, dù học viên thật thấy. Nguyên nhân: trang bài chỉ dựng khối khi `enrolled && !previewMode && !stageMode && !teacherMode` (học viên đã ghi danh, không xem thử); giảng viên xem thử thường không ghi danh khoá của mình và `previewMode` bật nên không có nhánh nào dựng khối.
- **Sửa:** khi `previewMode` (chỉ người dạy khoá, không chiếu lớp) dựng khối bằng `getPracticePreview` và `LessonPractice preview` (cùng bản với nút "Xem trước" ở trang soạn Bài luyện): chấm như học viên, kiểm tra từng câu được, **không tạo buổi luyện, không lưu đáp án**, hiện dòng "Xem trước: không lưu đáp án". Khối chưa có câu vẫn ẩn như với học viên. Không dẫn sang trang luyện đề (giảng viên không ghi danh nên sẽ bị chặn).
- **Đã thử trên trình duyệt:** dựng Bài luyện có 1 đoạn văn và 1 câu trắc nghiệm trong bài demo, mở `?preview=1`: thấy khối với đoạn văn và câu hỏi; chọn đáp án đúng rồi "Kiểm tra câu 1" → "Chính xác", yêu cầu đi qua `/api/practice-preview/…` (không phải `practice-sessions`). Chưa phủ bằng test tự động (trang bài là server component; logic nằm ở `getPracticePreview` đã có test).

## Bổ sung 10/11/2026 — tải ảnh/audio vào Đoạn văn của Bài luyện (lỗi `exam_not_draft`)

- **Lỗi (báo từ limio.vn):** tải audio (và ảnh) vào Đoạn văn của Bài luyện báo "Upload lỗi: exam_not_draft". Nguyên nhân: `assertExamEditable` (`core-lms/exam/assets.ts`) chỉ cho tải khi đề `draft`, mà đề ẩn của khối Bài luyện được tạo sẵn ở trạng thái `published`. Đoạn văn và câu hỏi của đề đó vẫn soạn được (`passages.ts`, `questions.ts` chỉ chặn đề đã lưu trữ), chỉ riêng tải tệp bị chặn. Lỗi có từ trước khi có trình soạn mới.
- **Sửa:** với đề ẩn của Bài luyện (`ownerContentItemId`) cho tải khi chưa lưu trữ; đề thường giữ nguyên quy tắc (chỉ khi nháp, vì đề đã xuất bản có thể có lượt thi). Phát lại tệp cho học viên không kiểm trạng thái đề nên không đổi.
- **Kiểm thử:** `exam/__tests__/assets-practice.test.ts` (4 ca: Bài luyện tải được ảnh và audio; Bài luyện đã lưu trữ vẫn chặn; đề thường nháp được/đã xuất bản chặn; người không sửa được khoá bị từ chối). Đã thử trên trình duyệt (dev): tải tệp audio vào Đoạn văn của Bài luyện → 201 Created, thẻ "🔊" hiện trong ô soạn; **dán ảnh từ clipboard** vào cùng ô (thầy báo cũng lỗi, cùng điểm cuối `/api/exams/<id>/assets`) → không lỗi, ảnh chèn với đường dẫn `/api/exam-assets/…`.

