# Đề thi / Bài luyện: loại câu chưa làm được và dán ảnh vào Đoạn văn — Acceptance criteria

> 10/11/2026, **thầy đã duyệt; A, B, C đã commit (`1124c5c8`, `820481b8`); D đã code (xem "Đã làm D"), chưa commit.** Phát hiện từ khoá "Speak Out 2nd Edition" trên server 224: trình soạn cho tạo câu Ghép cặp (`matching`) trong Bài luyện nhưng trình làm bài báo "Unsupported question type: matching". Ba việc, làm theo thứ tự A → B → C; A và B đẩy được ngay, C lớn hơn.

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

## D — Đoạn văn soạn bằng trình soạn giàu định dạng (thầy duyệt 10/11/2026, đã code)

**Hiện trạng:** `PassageEditor` là ô văn bản thường; đoạn lưu dạng Tiptap JSON (`contentJson`) nhưng `plainTextToTiptap` chỉ tạo đoạn văn, ảnh, audio, video; dán từ Word/web mất in đậm, tiêu đề, danh sách. `PassageView` (phía học viên) vẽ được: đoạn văn, tiêu đề, danh sách (chấm và số), ảnh, audio, video, ngắt dòng và chữ đậm/nghiêng/gạch chân/tô nổi. `RichTextEditor` có sẵn (HTML vào/ra; dán ảnh, kéo thả, làm sạch Word) nhưng nhận cả thứ `PassageView` chưa vẽ (liên kết, màu chữ, bảng, gạch ngang…) và **không biết** nút audio/video của đoạn văn.

- **Soạn:** ô "Nội dung" của Đoạn văn (đề thi và Bài luyện) dùng `RichTextEditor` ở chế độ "đoạn văn": thanh công cụ chỉ có những gì học viên **thật sự thấy được**: in đậm, in nghiêng, gạch chân, tô nổi, tiêu đề (cỡ 2 và 3), danh sách chấm và số, ảnh. Không có liên kết, màu chữ, bảng, gạch ngang, khối trích dẫn, khối mã (các thứ `PassageView` không vẽ).
- **Ảnh:** dán từ clipboard, kéo thả hoặc nút ảnh đều tải lên `/api/exams/<id>/assets` như hiện nay (chèn ngay thấy ảnh trong ô). Vẫn **hỏi mô tả ảnh (alt text)** cho mỗi ảnh (giữ yêu cầu hiện tại; không lấy tên tệp làm mô tả). Phần dán ảnh vào ô văn bản của mục A được thay bằng cách này (bỏ `onPaste` riêng).
- **Audio và video:** giữ ba nút hiện có ("Tải audio", "Chèn video/Dán link video", "Tải video lên"), mỗi nút chèn **một khối** tại vị trí con trỏ; trong ô soạn khối hiện thành thẻ có biểu tượng và mô tả ("🔊 mô tả", "🎬 mô tả") và xoá được như một phần tử. Chính sách phát audio (nghe tự do / giới hạn / 1 lần) vẫn đặt ở ô riêng bên dưới như hiện nay; transcript audio vẫn hỏi như cũ.
- **Lưu:** nội dung đổi thành Tiptap JSON đúng loại nút mà `PassageView` vẽ (đoạn văn, tiêu đề, danh sách, ảnh, audio, video, chữ có dấu định dạng). Không để lọt nút lạ vào dữ liệu (nếu có thì bỏ và báo). Đoạn trống thì không cho lưu (như hiện nay).
- **Đoạn đã có:** mở lại đoạn cũ (chỉ gồm đoạn văn, ảnh, audio, video) thì hiện đúng trong trình soạn, **không mất, không đổi chữ** (so sánh trước/sau khi lưu). Đoạn có nút ngoài tập trên (nếu dữ liệu từ nơi khác nhập vào) thì **không tự chuyển**: hiện cảnh báo rõ "Đoạn này có phần trình soạn chưa hỗ trợ" và cho xem nguồn/giữ nguyên, giống cách `RichTextEditor` đã làm cho nội dung bài học (dò mất mát có sẵn).
- **Dán từ Word/web:** giữ in đậm, in nghiêng, tiêu đề, danh sách; bỏ màu, liên kết, bảng thành chữ thường (hoặc đoạn văn), không bỏ chữ.
- **Học viên:** không đổi gì ở `PassageView`; đoạn soạn mới hiển thị y như bản xem trước trong trình soạn.
- **Hai nơi dùng:** đề thi (`ContentManager`) và Bài luyện (`PracticeEditor`) cùng một `PassageEditor`, nên cả hai được. Nút/ô khác của form Đoạn văn (tiêu đề, chính sách audio, kỹ năng) giữ nguyên.
- **Hướng dẫn:** cập nhật `GIAO-DIEN.md` và kho của Lily (nội dung Đoạn văn nay có thanh định dạng; ảnh dán/kéo thả; nút audio/video chèn khối).

**Điểm thầy chốt:** (1) giữ hỏi mô tả ảnh mỗi lần (đề xuất: giữ) hay lấy tên tệp như trình soạn bài học; (2) có cần liên kết trong bài đọc không (nếu có thì phải thêm vào `PassageView`: đề xuất: chưa).

**Kiểm thử:** hàm đổi nội dung ↔ Tiptap JSON (đoạn cũ không đổi sau khi mở và lưu lại; ảnh, audio, video, danh sách, tiêu đề, chữ đậm); nút lạ bị bỏ/báo; dò mất mát cho đoạn có nút ngoài tập; dán Word; xem trên trình duyệt: soạn một đoạn có tiêu đề, danh sách, ảnh dán, audio, video rồi xem ở phía học viên (luyện đề và Bài luyện), ở 1280 và 400 px.

**Ngoài phạm vi:** bảng, liên kết, màu chữ trong bài đọc; sửa `PassageView` (trừ khi thầy chọn thêm liên kết); trình soạn đề câu hỏi (đã giàu định dạng).

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

## Đã làm D (10/11/2026)

- **Trình soạn riêng cho Đoạn văn** thay vì thêm chế độ vào `RichTextEditor` dùng chung (tránh đụng một thành phần lớn đang phục vụ bài học): `components/exam/PassageRichEditor.tsx` + `lib/passageDoc.ts`. Thanh công cụ chỉ có đậm, nghiêng, gạch chân, tô nổi, H2, H3, danh sách chấm/số, ảnh, xoá định dạng. Dán Word dùng lại `cleanWordHtml`; dán ảnh (không kèm chữ) và kéo thả ảnh đều hỏi mô tả rồi tải lên `/api/exams/<id>/assets`. Bỏ phần dán ảnh vào ô văn bản của mục A (`pastedImage.ts`) vì đã được thay.
- **Audio/video:** ba nút cũ giữ nguyên; mỗi nút chèn một khối (thẻ "🔊/🎬 mô tả" trong ô soạn) kèm một đoạn trống phía sau để chèn tiếp không thay mất khối. Nút `audio`/`video` đúng tên mà `PassageView` vẽ.
- **Lưu:** HTML → Tiptap JSON chỉ với tập nút mà `PassageView` vẽ (liên kết, màu chữ, bảng, gạch ngang, trích dẫn bị bỏ, chữ giữ lại). Tạo mới luôn gửi nội dung; sửa mà chưa đụng ô nội dung thì **không gửi lại** (đoạn cũ không đổi một ký tự).
- **Đoạn đã có nút ngoài tập** (vd. bảng): giữ nguyên, hiện cảnh báo bằng tiếng Việt kèm bản học viên thấy, khoá nút audio/video; nút "Vẫn dùng trình soạn" (có xác nhận, phần đó mất khi lưu).
- **Khác tiêu chí:** đoạn không có chữ vẫn lưu được (như trước giờ, không có kiểm tra rỗng ở máy chủ); đã bỏ dòng tiêu chí "không cho lưu đoạn trống".
- **Kiểm thử:** `passageDoc.test.ts` (9 ca: đoạn cũ không đổi, định dạng mới, audio/video, thứ bị bỏ, nút ngoài tập, tên tiếng Việt, đoạn rỗng). Đã thử trên trình duyệt: soạn đoạn có H2, đậm/nghiêng/gạch chân/tô nổi, danh sách chấm và số, video, ảnh dán; lưu (201), danh sách hiện đúng như học viên thấy; mở lại đủ các khối; lưu không sửa gì chỉ gửi tiêu đề/chính sách; đoạn có bảng hiện cảnh báo "bảng" và khoá nút chèn.
- **Chưa xem tay:** tải audio từ tệp thật, kéo thả ảnh bằng chuột, dán từ Word thật, Bài luyện (cùng `PassageEditor` nên được, chưa mở), điện thoại thật.
- **Cỡ chữ (thầy yêu cầu, chọn "từng đoạn chữ được chọn"):** nút "Cỡ chữ" trên thanh công cụ (thầy yêu cầu có nhãn và xem trước: mở ra thì mỗi mức hiện chính chữ "Cỡ chữ" ở đúng cỡ đó kèm tên mức) với 4 mức cố định Nhỏ (0,875rem) / Thường (mặc định) / Lớn (1,25rem) / Rất lớn (1,5rem), áp cho đoạn chữ đang chọn; lưu bằng dấu `textStyle.fontSize` của Tiptap. `lib/passageFontSizes.ts` (nhẹ, dùng chung với phía học viên); `PassageView` chỉ vẽ đúng bốn mức, giá trị lạ (Word: 12pt, 14px; chuỗi độc) bị bỏ khi lưu và khi vẽ. Nút đậm/nghiêng/… giờ đổi trạng thái theo vị trí con trỏ. Test: 4 ca trong `passageDoc.test.ts`, 2 ca `PassageView.fontSize.test.tsx`.
- **Tiêu đề bài đọc (thầy yêu cầu "stylist lại cho đẹp"):** `PassageView` (dùng ở đề thi, luyện đề, Bài luyện): tiêu đề cỡ `text-h3` đậm thay cho cỡ chữ thân, kèm vạch nhấn gradient thương hiệu ngắn bên dưới. Đã xem trên trình duyệt (luyện đề HSK demo).
- **Khối câu hỏi (thầy yêu cầu "stylist cho đẹp"):** `components/exam/QuestionChrome.tsx` dùng chung cho `ExamPlayer` và `PracticePlayer`: "N câu hỏi cho đoạn này" có ô số lượng nổi bật; mỗi câu là một thẻ riêng (viền, bo góc, bóng nhẹ) với thẻ gradient "Câu n", số điểm dạng chip xám và trạng thái ("Đã trả lời", "Đúng/Chưa đúng") dạng chip tròn. Bài luyện nhúng trong bài học (`LessonPractice`) giữ kiểu "CÂU n" đã làm theo Figma. Đã xem trên trình duyệt ở chế độ thi thử của giảng viên (cùng `ExamPlayer`).
- **Màu chữ và màu tô nổi (thầy yêu cầu có bảng màu):** hai nút "Màu chữ" (9 màu) và "Tô màu" (6 màu) trên thanh công cụ, mỗi nút mở lưới ô màu kèm "Màu mặc định"/"Bỏ tô"; cùng bảng màu với trình soạn bài học (`lib/passageColors.ts`). Chỉ nhận màu trong bảng: màu lạ (màu tên, hex tuỳ ý, dán từ Word) bị bỏ khi lưu và khi vẽ; màu lưu dạng `#rrggbb` (trình duyệt trả `rgb(…)` nên được chuẩn hoá). `PassageView` vẽ màu chữ, màu tô nổi và cỡ chữ cùng lúc. Ba menu (Cỡ chữ, Màu chữ, Tô màu) dùng chung một thành phần `ToolbarMenu` (đóng khi bấm ra ngoài hoặc Esc). Test: `passageColors.test.ts` (4 ca), thêm 4 ca ở `passageDoc.test.ts` và 2 ca ở `PassageView.fontSize.test.tsx`. Đã thử trên trình duyệt ở trình soạn đề thi (chọn chữ rồi chọn màu đỏ, tô xanh dương) và ở **Bài luyện** (dùng chung `PassageEditor`): lưu đoạn có chữ đỏ cỡ lớn và nền xanh lá, hiển thị đúng.
- **Nút "Màu chữ" trực quan (thầy yêu cầu):** hiện chữ **A** tô đúng màu đang chọn kèm vạch màu bên dưới (như Word); con trỏ ở chữ chưa tô màu thì vẫn hiện màu vừa chọn gần nhất, chưa chọn gì thì A mặc định kèm vạch xám. Đã xem trên trình duyệt (chọn Đỏ → A đỏ, vạch đỏ).

