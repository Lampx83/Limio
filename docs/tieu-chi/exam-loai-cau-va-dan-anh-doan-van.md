# Đề thi / Bài luyện: loại câu chưa làm được và dán ảnh vào Đoạn văn — Acceptance criteria

> 10/11/2026, **thầy đã duyệt; A, B đã commit (`1124c5c8`); C đã code (xem "Đã làm C"), chưa commit.** Phát hiện từ khoá "Speak Out 2nd Edition" trên server 224: trình soạn cho tạo câu Ghép cặp (`matching`) trong Bài luyện nhưng trình làm bài báo "Unsupported question type: matching". Ba việc, làm theo thứ tự A → B → C; A và B đẩy được ngay, C lớn hơn.

## Hiện trạng (đã đối chiếu mã, 10/11/2026)

- Trình soạn (`QuestionEditor`, dùng chung cho đề thi và Bài luyện) cho tạo 10 loại: một đáp án, nhiều đáp án, Đúng/Sai/Không có thông tin, điền khuyết, trả lời ngắn, **sắp xếp, ghép cặp, số, kéo thả điền**, tự luận (Bài luyện bỏ tự luận). Máy chủ nhận và chấm được cả 4 loại in đậm.
- Trình làm bài `ExamQuestion.tsx` (dùng cho đề thi, luyện đề, Bài luyện) chỉ vẽ được 6 loại; 4 loại kia rơi vào nhánh "Unsupported question type".
- `toPublicQuestionConfig` (whitelist cấu hình gửi xuống trình duyệt) trả rỗng cho 4 loại đó, nên dù có vẽ cũng không có dữ liệu.
- Giao diện 4 loại đã có sẵn trong Quiz (`OrderingInput`, `MatchingInput`, `DragDropFillInput`, ô nhập số) nhưng nằm riêng trong `QuizPlayer.tsx` và gắn với dạng dữ liệu của Quiz.
- Trình soạn Đoạn văn (`PassageEditor`) là ô văn bản thường; ảnh chỉ vào được bằng nút "Tải ảnh". Trình soạn câu hỏi (`RichTextEditor`) đã hỗ trợ dán ảnh.

## A — Dán ảnh từ clipboard vào Đoạn văn

- **Given** giảng viên đang soạn Đoạn văn (đề thi hoặc Bài luyện), con trỏ trong ô "Nội dung". **When** dán (Ctrl/Cmd+V) mà clipboard có ảnh và **không có chữ**. **Then** ảnh được tải lên cùng đường với nút "Tải ảnh" (`/api/exams/<id>/assets`) và chèn `![mô tả](đường dẫn)` đúng vị trí con trỏ, cách đoạn trước/sau một dòng trống như hiện nay.
- Hỏi **mô tả ảnh (alt text)** như nút "Tải ảnh" (bắt buộc, huỷ hoặc để trống thì không tải). *Điểm thầy chốt:* nếu muốn dán nhanh hơn thì đổi sang tự lấy tên tệp làm mô tả, giống `RichTextEditor`.
- Clipboard có chữ (kể cả chữ kèm ảnh khi copy từ Word/web): **giữ nguyên hành vi dán chữ**, không cướp sự kiện dán.
- Chỉ nhận PNG, JPG, WebP, GIF như nút "Tải ảnh"; loại khác hoặc quá cỡ thì báo lỗi bằng tiếng Việt, không chèn gì.
- Trong lúc tải, nút tải ảnh/audio/video bị khoá (dùng lại trạng thái `uploading`); lỗi tải thì báo như hiện nay và ô nội dung không đổi.
- Không áp cho ô khác (tiêu đề, ghi chú) và không đổi trình soạn câu hỏi (đã có sẵn).

## B — Chưa làm được thì đừng cho tạo (đẩy ngay)

- Trong bộ chọn loại câu của `QuestionEditor` (đề thi và Bài luyện), **ẩn 4 loại**: Sắp xếp, Ghép cặp, Số, Kéo thả điền, cho tới khi C xong. Tạo mới không còn chọn được chúng.
- Câu thuộc 4 loại này **đã tồn tại** (như câu ghép cặp ở khoá Speak Out): vẫn xem và sửa được trong trình soạn (không mất dữ liệu), nhưng ở danh sách câu của Đề thi/Bài luyện hiện nhãn cảnh báo "Loại câu này chưa làm được trong bài, nên đổi sang loại khác".
- Học viên gặp câu thuộc 4 loại: thay dòng tiếng Anh đỏ "Unsupported question type" bằng câu tiếng Việt "Câu này chưa hiển thị được. Báo giảng viên.", không làm hỏng các câu khác và không chặn nộp bài.
- Có kèm bản sửa nút cam (commit riêng): nút "Bảng giảng viên" không chồng nút AI/Ghi chú ở khung bài học.

## C — Làm đủ 4 loại bằng giao diện dùng chung

- **Tách thành phần dùng chung** từ `QuizPlayer.tsx`: sắp xếp, ghép cặp, kéo thả điền và ô nhập số, nhận dữ liệu trung tính (danh sách, giá trị hiện tại, hàm đổi). Quiz giữ nguyên hành vi (test Quiz hiện có phải qua, chưa đổi dòng chữ nào của Quiz).
- **Lớp nối cho đề thi** trong `ExamQuestion`, đúng định dạng đáp án máy chủ đang chấm: sắp xếp `{order: [id…]}`, ghép cặp `{matched: {cặp → cặp chọn}}`, kéo thả `{placed: {chỗ trống → token}}`, số `{value}`.
- **Máy chủ**: `toPublicQuestionConfig` trả cấu hình cho 4 loại mà **không lộ đáp án** qua payload:
  - Sắp xếp: danh sách đã xáo trộn, không giữ thứ tự đúng (đảm bảo không trùng thứ tự đúng).
  - Ghép cặp: vế trái và vế phải xáo trộn độc lập, **mã vế phải không trùng mã cặp** (nếu trùng thì nhìn mã là biết cặp); việc đổi mã về cặp thật làm ở máy chủ trước khi chấm.
  - Kéo thả: danh sách token (kèm mồi nhử) không kèm `blankIndex`; chỗ trống theo `[[N]]` trong đề.
  - Số: chỉ cần ô nhập (không gửi `expected`, `tolerance`).
- Xáo trộn **ổn định** theo câu và lượt làm: tải lại trang không đổi thứ tự (để không mất đáp án đang kéo dở), nhưng khác nhau giữa các học viên.
- **Trang xem lại đáp án** (`AnswerReview`) và nút **"Kiểm tra câu n"** của luyện đề/Bài luyện hiện đúng/sai và đáp án đúng cho 4 loại; điểm chấm giữ nguyên quy tắc hiện có (all-or-nothing cho ghép cặp, sắp xếp, kéo thả).
- Làm xong C thì **bỏ phần ẩn ở B** (4 loại hiện lại trong bộ chọn) và bỏ nhãn cảnh báo; câu ghép cặp đã tạo trên 224 tự dùng được.
- Giao diện cảm ứng/điện thoại: kéo thả có phương án chạm chọn như Quiz (không bắt buộc kéo).

## Kiểm thử

- A: dán ảnh (không chữ) chèn đúng vị trí; dán chữ giữ nguyên; loại tệp sai/quá cỡ; lỗi tải không đổi nội dung.
- B: bộ chọn không có 4 loại; câu cũ thuộc 4 loại vẫn mở được; nhãn cảnh báo; câu tiếng Việt ở học viên.
- C: mỗi loại một bài test render + đúng định dạng đáp án; `toPublicQuestionConfig` không chứa đáp án (so sánh với cấu hình đầy đủ); xáo trộn ổn định và không trùng thứ tự đúng; chấm đúng/sai qua luồng thật; Quiz không đổi (chạy lại test Quiz).
- Xem trên trình duyệt: soạn và làm thử một câu mỗi loại trong Bài luyện và luyện đề, ở 1280 và 400 px.

## Ngoài phạm vi

Chấm điểm từng phần cho ghép cặp/kéo thả; loại câu mới; sửa trình soạn câu hỏi; dán ảnh ở trường khác ngoài Đoạn văn; thay đổi giao diện Quiz.

## Đã làm (A + B, 10/11/2026)

- **A:** `lib/pastedImage.ts` (`pickPastedImage`, test 4 ca) + `onPaste` trong `PassageEditor`: dán ảnh không kèm chữ thì hỏi mô tả, tải lên `/api/exams/<id>/assets` và chèn `![mô tả](đường dẫn)` tại con trỏ; dán chữ (kể cả chữ kèm ảnh) giữ nguyên; SVG và định dạng lạ thì chặn dán và báo "Chỉ dán được ảnh PNG, JPG, WebP hoặc GIF.". Đã thử trên trình duyệt với PNG thật: 201 Created, ảnh chèn đúng; chữ kèm ảnh không bị chặn; SVG báo lỗi.
- **B:** `lib/examQuestionSupport.ts` (danh sách 6 loại làm được, nhãn và câu cảnh báo; test); bộ chọn của `QuestionEditor` chỉ còn 6 loại (đã xem trên trình duyệt); danh sách câu của đề thi (`ContentManager`) và Bài luyện (`PracticeEditor`) hiện nhãn "Chưa làm được — nên đổi loại" cho câu thuộc 4 loại; `ExamQuestion` hiện "Câu này chưa hiển thị được. Báo giảng viên." thay dòng tiếng Anh đỏ. Sửa chữ còn sót "Luyện thi" trong giải thích công tắc ở `MockExamPanel`. Cập nhật `GIAO-DIEN.md`.
- **Chưa xem tay:** nhãn cảnh báo trên một câu `matching` có sẵn và câu tiếng Việt phía học viên (mới có test và đọc mã). Đường nhập vào đề thi khác không đi qua bộ chọn (AI import, Ngân hàng câu hỏi, Excel import) vẫn có thể đưa 4 loại vào đề: ngoài phạm vi, nhãn cảnh báo là lưới an toàn; C sẽ giải quyết.
- **Nút cam chồng nút AI/Ghi chú:** sửa ở commit riêng (xem lịch sử nhánh).

## Đã làm C (10/11/2026)

- **Giao diện dùng chung:** `components/quiz/QuestionInputs.tsx` (Sắp xếp, Ghép cặp, Kéo thả điền chuyển NGUYÊN VĂN từ `QuizPlayer`, kèm `questionInputTypes.ts`); `QuizPlayer` chỉ còn import, hành vi Quiz không đổi (273 test component qua). Lớp nối cho đề thi: `exam/ExamQuestionExtraTypes.tsx` (đổi config/đáp án của đề thi sang dạng của Quiz) + ô nhập số; `ExamQuestion` vẽ đủ 10 loại, bỏ khối đề chung cho Kéo thả điền (tự vẽ ô thả). `isAnswerValueAnswered` thay ba bản `isAnswered` riêng ở ExamPlayer, PracticePlayer, LessonPractice.
- **Máy chủ (không lộ đáp án):** `core-lms/exam/public-tokens.ts` (`publicToken` HMAC, `resolvePublicId`, `seededShuffle`); `toPublicQuestionConfig(type, config, seed)` trả cấu hình cho 4 loại: Sắp xếp xáo và đổi mã, Ghép cặp (vế trái mã cặp, vế phải xáo + mã công khai), Kéo thả (token xáo + mã công khai, không `blankIndex`), Số (rỗng); seed = lượt làm/học viên + câu nên tải lại không đổi thứ tự. Chấm điểm (`gradeOrdering/Matching/DragDropFill`) nhận mã công khai và cả mã gốc cũ. Khoá HMAC: `EXAM_PUBLIC_SECRET`, không có thì `NEXTAUTH_SECRET`/`AUTH_SECRET` (đổi khoá thì đáp án 4 loại này đang làm dở coi như chưa trả lời).
- **Xem lại đáp án:** `withReviewTokens` thêm bảng mã vào cấu hình đầy đủ ở kết quả kiểm tra, kết quả luyện đề và xem lại bài thi; `AnswerReview` hiện thứ tự đúng/đã xếp, từng cặp, từng ô, đáp án số cho 4 loại; đề Kéo thả hiện "(Ô N)" thay `[[N]]`.
- **Bỏ phần ẩn ở B:** `examQuestionSupport` có đủ 10 loại; bộ chọn trình soạn hiện lại 4 loại.
- **Kiểm thử:** `public-tokens.test.ts` (15 ca: mã, xáo, không lộ, chấm bằng mã công khai), `ExamQuestion.test.tsx` (15 ca: vẽ, đáp án, xem lại). Đã làm thử trên trình duyệt ở chế độ luyện đề với đề 4 loại câu: sắp xếp (↑↓), ghép cặp (chọn), kéo thả (kéo bằng chuột), số, đúng/sai chấm đúng; dữ liệu trang không chứa mã gốc, `blankIndex`, đáp án số hay lời giải.
- **Chưa xem tay:** kéo thả bằng cảm ứng thật trên điện thoại (Kéo thả điền chỉ có kéo, không có phương án chạm như Sắp xếp/Ghép cặp: đúng như Quiz hiện nay); đề thi thật (ExamPlayer, có giờ) và trang xem lại của lượt thi (đã phủ bằng test, chưa mở); Bài luyện nhúng trong bài học (`LessonPractice`).
