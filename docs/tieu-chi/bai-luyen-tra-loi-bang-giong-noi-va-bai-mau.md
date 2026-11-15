# Bài luyện: trả lời câu mở bằng giọng nói, góp ý AI và bài mẫu có audio — Acceptance criteria

> 11/11/2026, **bản đề xuất, chờ thầy duyệt, chưa code.** Thầy yêu cầu: với các câu hỏi mở (ví dụ "What 'firsts' and 'seconds' did you learn about?"), học viên được **trả lời bằng giọng nói**, **nhận góp ý đánh giá của AI ngay khi nhập xong** (thầy bổ sung 11/11/2026), và xem **bài mẫu kèm audio**.

## Hiện trạng (đã đối chiếu mã)

- Câu `essay` trong Bài luyện chỉ có ô gõ chữ. Bộ chấm coi là chấm tay: bấm "Kiểm tra câu n" chỉ hiện dòng "Câu tự luận không kiểm tra tự động được. Hãy tự đối chiếu với bài mẫu…" và **không hiện bài mẫu nào**. Phần giải thích đáp án (`explanation`, nơi em nhập bài mẫu của Teacher's Book) chỉ được vẽ cho câu tự chấm. Nên bài mẫu hiện **không bao giờ đến tay học viên**.
- Đã có hạ tầng giọng nói cho Bài tập nộp bài: nút ghi âm trong trình duyệt (tối đa 3 phút), chuyển giọng thành chữ bằng Whisper, ví token của học viên, câu báo "bản ghi âm gửi tới OpenAI". Chưa dùng cho Bài luyện.
- Audio của Bài luyện hiện chỉ nằm trong đoạn văn (có transcript); câu hỏi chưa có chỗ gắn audio.

## AC1 — Trả lời câu tự luận bằng giọng nói (chỉ trong Bài luyện nhúng ở trang bài học)

- **Given** học viên ghi danh ở khoá ngoại ngữ, câu hỏi loại `essay`. **When** mở câu. **Then** cạnh ô gõ có nút **"Trả lời bằng giọng nói"** (biểu tượng micro). Gõ chữ vẫn dùng được như cũ.
- Bấm nút: xin quyền micro (từ chối thì hiện lời nhắn "Hãy gõ câu trả lời, hoặc cho phép micro trong trình duyệt"); ghi âm tối đa **3 phút**, có Dừng, Nghe lại, Ghi lại, hiện thời lượng.
- Câu có góp ý AI: nút chính là **"Nhận xét bằng AI"** — một lần bấm vừa chuyển bản ghi thành chữ vừa kiểm tra và hiện góp ý (không phải bấm "Kiểm tra" thêm); có lối phụ **"Chỉ lấy bản chữ để tự sửa trước"** cho ai muốn đọc lại bản chữ trước khi AI nhận xét. Câu tắt góp ý AI: nút chính là **"Chuyển thành chữ"**, chỉ lấy bản chữ.
- Lấy bản chữ: bản ghi được chuyển thành chữ (Whisper, đúng `language` của khoá) và **điền vào ô trả lời** kèm nhãn "Bản chữ từ giọng nói, máy có thể nghe sai: hãy đọc lại và sửa". Học viên sửa được; câu trả lời được lưu như mọi câu trả lời gõ.
- **Lưu bản ghi âm CUỐI CÙNG của học viên** (thầy chốt 11/11/2026; các lần ghi trước bị thay thế và xoá file): file ở lớp `private` của kho, học viên **nghe lại** được ngay trong thẻ câu hỏi; xoá khi xoá tài khoản và có trong export dữ liệu cá nhân; tính vào hạn mức dung lượng như bài nộp. Vì có bản ghi nên góp ý được dùng **số liệu nhịp nói do Whisper đo** (tốc độ, quãng nghỉ dài) cho tiêu chí Lưu loát; vẫn **không chấm phát âm**.
- ~~Trước lần dùng đầu hiện một dòng: "Bản ghi âm sẽ được gửi tới OpenAI để chuyển thành chữ."~~ — đã bỏ dòng này (14/11/2026, theo yêu cầu của thầy, cả ở câu mở, đóng vai và nói tự do). Không tự gửi gì khi chưa bấm.
- Trừ ví token AI của **học viên** theo mức thực dùng; hết hạn mức hoặc chưa cấu hình AI thì báo rõ, ô gõ chữ vẫn dùng được, không trừ token.
- Bản ghi quá 3 phút hoặc quá 25 MB: báo rõ, không gửi.
- Xem thử của giảng viên (chốt 11/11/2026): ghi âm và chuyển thành chữ **dùng được** để giảng viên thấy trải nghiệm của học viên, nhưng **không lưu gì** (không tạo buổi luyện, không lưu bản ghi hay câu trả lời, không có trình phát "Bản ghi của bạn", không ghi sự kiện) và không có nhận xét AI; nút chính là "Chuyển thành chữ". Chuyển chữ trừ ví token của GIẢNG VIÊN, qua lối riêng `POST /api/practice-preview/{examId}/voice/{questionId}` (chỉ người sửa được khoá chứa đề; câu phải là essay và còn bật giọng nói). Ghi "Xem thử: ghi âm và chuyển thành chữ được, nhưng không lưu bản ghi".
- Không áp dụng cho đề thi thử (thi chính thức), chỉ Bài luyện nhúng trong bài (xem câu hỏi 3).

## AC2 — Bài mẫu hiện cho học viên sau khi kiểm tra

- **Given** câu `essay` có bài mẫu (`explanation`). **When** học viên bấm "Kiểm tra câu n". **Then** hiện khối **"Sample answer"** (bài mẫu chữ), đặt **dưới câu trả lời của chính học viên** để đối chiếu; dòng nhắc "Hãy tự đối chiếu" giữ nguyên.
- Câu không có bài mẫu: chỉ dòng nhắc như cũ (không khối trống).
- Học viên chưa trả lời thì chưa kiểm tra được (như hiện nay), nên không xem được bài mẫu mà không thử trước.

## AC3 — Audio cho bài mẫu

- Khối "Sample answer" có **trình phát audio** khi câu có audio mẫu; học viên nghe bao nhiêu lần tuỳ ý.
- **Soạn:** trong trình soạn Bài luyện, câu tự luận có mục **"Audio bài mẫu"**: tải tệp lên (MP3, OGG, WAV, M4A, WebM, tối đa 25 MB) hoặc, khi máy chủ đã cấu hình giọng đọc, nút **"Tạo giọng đọc từ bài mẫu"**. Có nút Xoá. Hộp thoại nêu sẵn định dạng và dung lượng.
- **Nhập khoá:** công cụ nhập nhận `sampleAudio` (đường dẫn tệp) cho câu `essay`; với khoá Speakout em tạo audio mẫu bằng giọng tổng hợp trên máy dev từ chính bài mẫu của Teacher's Book (14 câu tự luận có bài mẫu).
- Lưu: tệp là một `ExamAsset` loại audio của đề; đường dẫn lưu trong cấu hình câu hỏi (`explanationAudio`). Gỡ audio khỏi câu thì dọn tệp như ảnh/audio của đoạn văn.
- **Bài mẫu không có trong dữ liệu gửi xuống trước khi học viên kiểm tra**: văn bản và audio mẫu chỉ được trả về trong kết quả của lần "Kiểm tra" (như đáp án đúng của câu tự chấm), không nằm trong cấu hình công khai của câu.

## AC4 — Góp ý đánh giá của AI khi học viên nhập xong

- **When** học viên bấm "Kiểm tra câu n" ở câu `essay` đã có câu trả lời (gõ hoặc nói). **Then** hệ thống gửi câu trả lời cho AI và hiện **góp ý** ngay trong thẻ câu hỏi (có chữ "Đang nhận xét…" trong lúc chờ), rồi hiện bài mẫu bên dưới (AC2).
- AI nhận: đề câu hỏi, **câu trả lời của học viên (bản chữ)**, **bài mẫu** (`explanation`) làm tham chiếu và tiêu chí `rubric` nếu giảng viên có đặt, trình độ khoá; học viên mà bản chữ do giọng nói tạo ra thì AI được báo "bản chữ do máy nghe, có thể sai chính tả, đừng chê lỗi chính tả hay dấu câu".
- **Nội dung góp ý** (KHÔNG có số điểm và không phán "đúng/sai"): ba tiêu chí mỗi tiêu chí một mức **Cần cải thiện / Khá / Tốt** kèm một nhận xét ngắn: **Trả lời đúng câu hỏi**, **Nội dung so với bài mẫu** (nêu ý bài mẫu có mà bài làm chưa nhắc, và ý đúng đã có), **Ngôn ngữ** (ngữ pháp, từ vựng); danh sách lỗi `{loại, đoạn trích, bản sửa, giải thích}` với `đoạn trích` **phải có trong bài làm** (lọc như góp ý bài viết); một gợi ý bước luyện tiếp. Viết bằng tiếng Anh, giọng khích lệ.
- Nhãn cố định: "Góp ý do AI tạo, có thể sai. Hãy đối chiếu với bài mẫu." Nội dung góp ý không bao giờ là điểm và không vào sổ điểm.
- **Không có bước giảng viên duyệt** (thầy chốt 11/11/2026): với Bài luyện, góp ý của AI **đẩy thẳng cho học viên**, không qua duyệt (khác Bài tập nộp bài). Giảng viên không phải làm gì; chưa có màn hình xem từng góp ý.
- **Không gọi lại AI vô ích:** cùng câu trả lời đã được góp ý thì hiện lại bản cũ (không gọi AI, không trừ token); sửa câu trả lời thì được góp ý lại. **Chưa đặt trần số lượt góp ý** (thầy chốt 11/11/2026: để quan sát thêm); vẫn trừ ví token và vẫn dùng lại bản cũ khi câu trả lời không đổi.
- Trừ ví token AI của **học viên**; hết hạn mức, chưa cấu hình AI hoặc AI lỗi thì **vẫn hiện bài mẫu** kèm lời nhắn rõ (không trừ token, không để khối góp ý dở).
- Chống nhồi lệnh: câu trả lời đặt trong khung dữ liệu, mô hình được dặn bỏ qua mọi chỉ dẫn nằm trong bài làm.
- Câu trả lời gửi tới nhà cung cấp AI **chỉ khi học viên bấm "Kiểm tra"** (có dòng nói rõ ở lần đầu). Góp ý được lưu theo học viên (xoá khi xoá tài khoản, có trong export dữ liệu cá nhân).
- Xem thử của giảng viên: bấm "Kiểm tra" vẫn hiện bài mẫu nhưng **không gọi AI** (ghi "Xem thử: không nhận xét bằng AI").
- Dữ liệu: thêm hai cột `aiFeedback Json?` và `aiFeedbackHash String?` vào `ExamPracticeAnswer` (migration).
- Mã hoá phản hồi theo SSMMD (`FeedbackDelivery` mang toạ độ riêng: nguồn `llm`, tầng `task`/`process`/`self_regulation`, không bao giờ `self`) như góp ý bài viết.

## AC5a — Giảng viên tự chỉnh trong trình soạn Bài luyện (thầy yêu cầu 11/11/2026)

Mọi thứ của tính năng này soạn và sửa được ngay trong trang "Soạn bài luyện", không cần nhập khoá hay sửa cơ sở dữ liệu:

- **Thêm câu "Tự luận (trả lời mở)"**: hiện nay trình soạn Bài luyện **ẩn dạng Tự luận** khỏi danh sách chọn dạng câu (chỉ sửa được câu đã có). Bật lại dạng này trong Bài luyện.
- Trong form câu tự luận có các mục (tiếng Việt, có chú thích ngắn dưới từng ô):
  - **Bài mẫu (Sample answer)**: ô soạn chữ (dùng lại ô "Giải thích đáp án", đổi nhãn thành "Bài mẫu" cho câu tự luận); học viên thấy sau khi kiểm tra.
  - **Audio bài mẫu**: tải tệp lên hoặc "Tạo giọng đọc từ bài mẫu", có nghe thử và Xoá (AC3).
  - **Tiêu chí đánh giá cho AI** (ô `rubric` có sẵn): giảng viên viết điều AI cần xét, ví dụ "Nêu ít nhất ba mốc thời gian; dùng thì quá khứ"; để trống thì AI chỉ dựa vào đề và bài mẫu. Có số từ tối thiểu (ô có sẵn).
  - Hai công tắc: **"Cho trả lời bằng giọng nói"** (mặc định bật) và **"AI nhận xét câu trả lời"** (mặc định bật). Tắt công tắc nào thì học viên không thấy phần đó; tắt cả hai thì câu chỉ có bài mẫu như bây giờ.
- Sửa các mục này không làm mất câu trả lời đã có của học viên; sửa bài mẫu hoặc tiêu chí thì góp ý cũ của học viên giữ nguyên (chỉ lần góp ý sau dùng nội dung mới).
- Xem trước ("Xem trước" của khối) cho thấy đúng khối "Sample answer" và nút giọng nói như học viên.
- Cập nhật `GIAO-DIEN.md` và hướng dẫn trợ lý Lily cho các nhãn mới.

## AC5 — Không làm hỏng chỗ khác

- Câu tự chấm, đề thi thử và luyện đề không đổi. Bài tập nộp bài (nói/viết) không đổi.
- Câu `essay` cũ không có audio mẫu hoạt động như trước, thêm khối "Sample answer" nếu có bài mẫu.
- Cập nhật `GIAO-DIEN.md` và hướng dẫn trợ lý Lily (nút "Audio bài mẫu", "Trả lời bằng giọng nói").

## Kiểm thử

- Bài mẫu chỉ có trong kết quả kiểm tra, không có trong dữ liệu công khai của câu.
- Khối "Sample answer": có/không có chữ, có/không audio, nằm dưới câu trả lời.
- Ghi âm → chuyển chữ (Whisper giả): điền ô, trừ token, hết hạn mức, chưa cấu hình AI, quá dài, từ chối micro; xem thử chuyển chữ qua lối riêng, không lưu gì.
- Soạn audio mẫu: tải lên sai định dạng/quá nặng, xoá dọn tệp; nhập khoá có `sampleAudio`.
- Xem trên trình duyệt ở 400 và 1280 px.

## Ngoài phạm vi

Chấm phát âm; số điểm tự động cho câu mở; dùng trong luyện đề và thi thử có giờ.

## Câu cần thầy chốt

(Thầy đã yêu cầu cho giảng viên tự chỉnh trong trình soạn: AC5a.)

1. ~~Lưu bản ghi âm~~ — **đã chốt: ghi âm và lưu bản ghi cuối cùng** (học viên nghe lại được; góp ý có số liệu nhịp nói).
2. ~~Góp ý AI không qua giảng viên duyệt~~ — **đã chốt 11/11/2026: đẩy thẳng cho học viên.**
3. ~~Phạm vi~~ — **đã chốt: chỉ Bài luyện nhúng ở trang bài học.**
4. ~~Hạn mức 5 lượt/ngày~~ — **đã chốt: chưa đặt trần, quan sát thêm** (vẫn trừ ví token).

## Thiết kế kỹ thuật (hợp đồng giữa các phần)

**Dữ liệu (đã làm, migration `20261111100000_practice_answer_ai_voice`):** `ExamPracticeAnswer` thêm `aiFeedback Json?`, `aiFeedbackHash String?`, `aiFeedbackAt DateTime?`, `audioKey String?` (tên tệp ở lớp private: `practice-answers/<sessionId>/<questionId>-<mã>.<đuôi>`), `audioMeta Json?` (`{durationSec, mimeType, sizeBytes, metrics}`). Cấu hình `essay` thêm `explanationAudio`, `voiceAnswer`, `aiFeedback` (đã làm ở `schemas.ts`); cấu hình công khai của câu chỉ có `minWords`, `voiceAnswer`, `aiFeedback`.

**core-lms** (export từ `@feedbackme/core-lms`):
- `getPracticeVoiceContext(userId, sessionId, questionId)` → `{ examId, courseId, language, languageMode, voiceAnswer, aiFeedback, previousAudioKey }`; ném `ExamError` khi phiên đóng, câu không thuộc phiên, câu không phải essay, hoặc `voiceAnswer` tắt.
- `saveVoiceAnswer(userId, sessionId, questionId, { text, audioKey, audioMeta })` → `{ previousAudioKey }`: ghi câu trả lời (cùng dạng `answerJson` của câu essay gõ tay, thêm `viaVoice: true`), xoá kết quả kiểm tra cũ như `savePracticeAnswer` khi đổi đáp án, lưu bản ghi mới.
- `getPracticeAnswerAudio(userId, sessionId, questionId)` → `{ audioKey, mimeType } | null` (chỉ chủ buổi luyện).
- `getPracticeSession` và `PracticeEmbed.answers[]` thêm `hasAudio: boolean` và `aiFeedback: unknown | null` để tải lại trang khôi phục bản ghi và góp ý.
- `deleteUser` trả thêm các `audioKey` của câu trả lời trong `removedFiles`; export dữ liệu cá nhân gồm `aiFeedback` và tên tệp ghi âm.

**core-feedback** (`practiceAnswer/`):
- `transcribePracticeVoice({ userId, sessionId, questionId, audio }, { openai, transcribe? }, db?)` → `{ text, durationSec, metrics }` (ví + Whisper như `createSubmissionTranscript`, tối đa 180 giây / 25 MB, không có tiếng nói → lỗi `no_speech`).
- `requestPracticeAnswerFeedback(userId, sessionId, questionId, { openai }, opts?, db?)` → `{ reused, body }`; `body = { summary, criteria[{key:"task"|"content"|"language"|"fluency", level, comment}], errors[{category, quote, correction, explanation}], nextSteps[], viaVoice, generatedAt }`; lưu vào `ExamPracticeAnswer.aiFeedback/aiFeedbackHash/aiFeedbackAt`; dùng lại bản cũ khi băm (câu trả lời + bài mẫu + tiêu chí) không đổi; lỗi qua `PracticeFeedbackError` (`code`).
- Chỉ khoá `languageMode`, lớp không phải đối chứng, câu có `aiFeedback` bật và học viên chủ buổi luyện.

**apps/web:**
- `POST /api/practice-sessions/[sessionId]/voice/[questionId]` (multipart `file`): chuyển chữ, lưu tệp ghi âm vào kho private, `saveVoiceAnswer`, xoá tệp cũ, trả `{ text, durationSec }`.
- `GET /api/practice-sessions/[sessionId]/audio/[questionId]`: phát lại bản ghi của chính học viên.
- Route kiểm tra `/api/practice-sessions/[sessionId]/check/[questionId]`: sau khi kiểm tra câu essay chấm tay có `aiFeedback` bật, gọi `requestPracticeAnswerFeedback`; trả `{...check, feedback?, feedbackError?}`.
- Xem thử của giảng viên: không nhận xét AI, không lưu bản ghi (âm thanh chỉ đi tới dịch vụ chuyển chữ rồi bỏ).
