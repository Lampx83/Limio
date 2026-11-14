# Đề thi dạng Khảo sát (không chấm điểm) — Acceptance criteria

> Duyệt 11/11/2026; **đã code cùng ngày, chưa commit.** Nhu cầu đầu tiên: phiếu khảo sát trước/sau của thực nghiệm học phần "Kỹ năng thực hành tại CSBL thuốc" (`docs/nghien-cuu/mo-phong-duoc-csbl/Bo-phieu-khao-sat-CSBL.docx`). Thầy chốt 11/11/2026: mỗi nhóm một đề, dựng trên limio.vn, sinh viên quét QR rồi vào bằng **tài khoản đã ghi danh**, và Limio phải có **chế độ Khảo sát** cùng nút xuất câu trả lời, không dùng script ngoài.

## Vì sao làm

- Đề thi hiện tại bắt mỗi câu trắc nghiệm có **đúng một** đáp án đúng, câu số phải có giá trị đúng, câu trả lời ngắn phải có đáp án chấp nhận được (`core-lms/exam/schemas.ts`). Câu thang 1–5 hay "bạn tự tin bao nhiêu" không có đáp án đúng.
- Bảng điểm xuất ra chỉ ghi Đúng/Sai/điểm cho từng câu, không ghi sinh viên **đã chọn gì**. CSV "phân tích" có cột "Phương án đã chọn" nhưng ghi chữ cái (A;C) và trộn cột đáp án đúng, không dùng được cho khảo sát.
- Trang kết quả của học viên vào bằng tài khoản **luôn hiện điểm** khi bài đã chấm (`learn/.../result/page.tsx`), kể cả khi ca đặt "không bao giờ hiện"; trình làm bài hiện "(N điểm)" cạnh mỗi câu và cảnh báo "Các câu chưa trả lời sẽ bị tính 0 điểm". Với phiếu khảo sát, những chữ này sai và gây hiểu nhầm.

## Đối chiếu mã (11/11/2026)

- `enum ExamPurpose { assessment, field_test }` đã là trục "đề này để làm gì" (schema, `Exam.purpose`, `ExamSession.purpose`); `field_test` đã có tiền lệ "không hiện đáp án, điểm không tính". Khảo sát là **một mục đích thứ ba**, không phải một loại đề riêng.
- Câu hỏi: điểm cho phép 0 (`questions.ts`), chưa có cờ bắt buộc trả lời; nộp với câu bỏ trống được phép (`SubmitReviewModal`).
- Chấm: `gradeExamAnswer`, `applyAutoGrading`, `finalizeSubmission` (`grading.ts`, `submission.ts`); tự luận và trả lời ngắn để `needsGrading = true`.
- Phần (`ExamSection`) có tiêu đề nhưng **không có mô tả**, và học viên chỉ thấy tiêu đề phần khi đề ở chế độ thi thử (`ExamPlayer.tsx`). Đoạn văn (`ExamPassage`) có nội dung định dạng và hiện cho học viên.
- Mở bằng QR: trang "Link thi nhanh" (`instructor/organize/quick`) chỉ liệt kê đề `assessment`; `shareExamLink` tạo ca `open_code`, người đã đăng nhập vào bằng tài khoản qua `AccountClaim`.
- Sự kiện đã có: `exam.started`, `exam.question.answered`, `exam.submitted`, `exam.graded`, `exam.share_link.opened`.

## Phương án

Thêm giá trị **`survey`** vào `ExamPurpose`. Đề có `purpose = survey` dùng lại toàn bộ bộ máy đề thi (soạn câu, phần, ca, mã QR, lưu đáp án, sự kiện) và chỉ khác ở các điểm trong AC dưới đây: câu không có đáp án đúng, không bao giờ chấm hay hiện điểm, phần có thể gắn với lần đo trước hoặc sau, và có bảng xuất câu trả lời.

Phương án thay thế (không đề xuất): làm một mô hình "Phiếu khảo sát" riêng. Sạch hơn về khái niệm nhưng phải viết lại soạn câu, mở ca, mã QR, lưu đáp án và tự lưu, tức gần gấp ba khối lượng.

## Ghi chú triển khai (11/11/2026)

- **"Phần" của phiếu là đoạn văn (`ExamPassage`), không phải `ExamSection`.** Đoạn văn đã có tiêu đề, nội dung định dạng và đã hiện cho sinh viên; `ExamSection` gắn với trọng số, bảng quy đổi và chỉ hiện ở chế độ thi thử. Cột mới: `ExamPassage.surveyPhase` và `ExamSession.surveyPhase` (enum `SurveyPhase`), loại câu mới `slider`. Migration `20261111090000_exam_survey`.
- Đề Khảo sát ép `shuffleQuestions/shuffleOptions = false`, không hiện kết quả, không giám sát (`SURVEY_FIXED_SETTINGS` trong `core-lms/exam/exams.ts`).
- Lượt nộp ở trạng thái `submitted`/`auto_submitted` vĩnh viễn, `score = null`. Cron gỡ kẹt (`gradeStuckSubmittedAttempts`) loại đề Khảo sát, nếu không chúng chiếm hết lô mỗi lượt.
- Học viên **không** mở phiếu qua đường trang khoá học (`startExamAttempt` từ chối): chỉ qua mã QR theo lần đo, vì đường đó không biết lần đo và không tách lượt trước/sau.
- Loại khỏi: thống kê câu hỏi, bộ chọn đề của Thử nghiệm câu hỏi, Kỳ thi chính thức và đổi đề của ca; không nhận câu từ ngân hàng, ma trận đề, AI import hay Excel import.
- Kiểm thử: `core-lms/src/exam/__tests__/survey.test.ts` (15 test); đã xem trên dev bằng tài khoản mẫu, khổ điện thoại 375 px.

## Phạm vi

- **Có:** (A) mục đích "Khảo sát" khi tạo đề; (B) các dạng câu không có đáp án đúng; (C) câu thang trượt cho điểm 0–100; (D) phần có lời dẫn và gắn lần đo; (E) mở ca bằng QR, chọn lần đo; (F) giao diện làm phiếu không có điểm; (G) xuất câu trả lời ra Excel; (H) loại khảo sát khỏi điểm và sổ điểm; (I) cập nhật hướng dẫn của Lily.
- **Không làm (đợt này):** biểu đồ thống kê theo câu trong giao diện; câu bắt buộc trả lời; logic nhảy câu theo câu trả lời; khảo sát ẩn danh không đăng nhập; tính điểm thang hay đảo câu (việc của bước phân tích); nhập phiếu từ Word.
- **Giữ nguyên:** mọi đề `assessment` và `field_test`, luồng thi chính thức nhiều ca.

## AC1 — Tạo đề Khảo sát

- **Given** giảng viên tạo hoặc sửa đề trong khoá **When** mở ô mục đích **Then** có thêm lựa chọn **"Khảo sát (không chấm điểm)"** bên cạnh các lựa chọn hiện có.
- Đề Khảo sát ẩn mọi ô không có nghĩa với nó: điểm từng câu, trọng số phần, bảng quy đổi điểm, cách chấm, hiện kết quả sau khi nộp, xáo đáp án. Thời lượng vẫn đặt được (mặc định 30 phút).
- Đổi một đề **đã có lượt làm** sang hoặc ra khỏi Khảo sát bị chặn, báo rõ lý do; đề chưa có lượt làm thì đổi tự do.
- Nhân bản đề Khảo sát giữ nguyên mục đích, các phần, gắn lần đo và mã câu (để tạo đề thứ hai từ đề thứ nhất).

## AC2 — Câu hỏi không có đáp án đúng

- Trong đề Khảo sát, các dạng câu dùng được là: **Một lựa chọn**, **Nhiều lựa chọn**, **Thang trượt** (AC3), **Trả lời ngắn**, **Trả lời dài**. Các dạng còn lại không hiện trong bộ chọn dạng câu.
- Câu một lựa chọn và nhiều lựa chọn có 2–10 lựa chọn, **không có ô đánh dấu đáp án đúng**; trả lời ngắn và dài không có đáp án chấp nhận được, không có rubric. Lưu câu thiếu nội dung hoặc thiếu lựa chọn thì báo lỗi ngay cạnh câu như hiện nay.
- Mỗi câu có ô **"Mã câu"** không bắt buộc (ví dụ `TT01`), dài tối đa 20 ký tự, không trùng trong cùng đề. Mã câu dùng làm tiêu đề cột khi xuất (AC7) và **không** hiện cho sinh viên.
- Điểm của mọi câu trong đề Khảo sát luôn là 0, ô điểm không hiện.
- Kiểm hợp lệ áp dụng ở **mọi đường tạo câu** (soạn tay, nhập Excel, nhân bản), không chỉ ở trình soạn.

## AC3 — Câu thang trượt

- Giảng viên đặt: giá trị nhỏ nhất, lớn nhất, bước (ví dụ 0–100, bước 10 hoặc 5) và **nhãn hai đầu** (ví dụ "Rất thấp" … "Rất cao"; "Hoàn hảo" … "Thất bại").
- **Given** sinh viên làm phiếu trên điện thoại **When** gặp câu thang trượt **Then** thấy một thanh kéo rộng hết màn hình, nhãn hai đầu và **số đang chọn** hiện rõ; thanh **chưa có giá trị** cho đến khi sinh viên chạm vào, để phân biệt "chưa trả lời" với "chọn số nhỏ nhất".
- Lưu đúng một số nằm trong khoảng và đúng bước; bàn phím (mũi tên) chỉnh được trên máy tính.

## AC4 — Phần, lời dẫn và lần đo

- Phần trong đề Khảo sát có thêm ô **"Lời dẫn"** (văn bản có định dạng, ví dụ "0 = hoàn toàn không làm được … 100 = hoàn toàn chắc chắn"). Sinh viên **luôn thấy** tiêu đề và lời dẫn của phần ở đầu phần (không chỉ ở chế độ thi thử).
- Mỗi phần có ô **"Dùng ở lần đo"**: Cả hai lần (mặc định) / Chỉ lần trước / Chỉ lần sau.
- **Given** một ca của đề được mở là "Lần trước" **When** sinh viên làm phiếu **Then** chỉ thấy các phần "Cả hai lần" và "Chỉ lần trước"; tương tự với "Lần sau". Số câu ở thanh tiến độ và ở bước xem lại trước khi nộp chỉ đếm các câu được hiện.
- Đề không có phần nào thì mọi câu hiện ở cả hai lần.

## AC5 — Mở bằng QR và chọn lần đo

- Trang "Link thi nhanh" liệt kê cả đề Khảo sát, có nhãn "Khảo sát" để phân biệt.
- Khi mở đề Khảo sát, form hỏi **"Lần đo: Lần trước / Lần sau / Không phân lần"** (bắt buộc chọn nếu đề có phần gắn lần đo), ẩn ô chính sách hiện đáp án (Khảo sát luôn là không bao giờ). Mã QR và đường dẫn hiện như hiện nay.
- Ca Khảo sát **chỉ cho người đã đăng nhập** vào làm: người chưa đăng nhập quét QR được đưa tới trang đăng nhập rồi quay lại đúng phiếu; không có lối vào bằng tên tự khai. Người đăng nhập nhưng **chưa ghi danh vào khoá** của đề bị từ chối với thông báo rõ ("Bạn chưa ghi danh vào khoá … Liên hệ giảng viên").
- Mở lại cùng đề với cùng lần đo dùng lại ca đang mở như hiện nay; khác lần đo thì tạo ca mới.
- Mỗi sinh viên làm **một lượt** cho mỗi lần đo của mỗi đề; quét lại QR sau khi đã nộp thì thấy "Bạn đã nộp phiếu này".

## AC6 — Giao diện làm phiếu

- Tiêu đề trang dùng chữ **"Phiếu khảo sát"**, không dùng "bài thi"; không có "(N điểm)" cạnh câu.
- Bước xem lại trước khi nộp vẫn liệt kê câu chưa trả lời, nhưng câu cảnh báo là "Bạn còn n câu chưa trả lời. Vẫn nộp phiếu?" (không nhắc điểm). Nộp với câu bỏ trống được phép.
- Sau khi nộp, **cả hai đường vào** (QR và trang học của khoá) chỉ hiện "Đã ghi nhận phiếu của bạn. Cảm ơn bạn." cùng thời điểm nộp; **không bao giờ** hiện điểm, phần trăm, đúng/sai hay lại câu trả lời.
- Tự lưu, mất mạng, hết giờ và nộp tự động giữ đúng hành vi hiện có.

## AC7 — Xuất câu trả lời

- Trang kết quả của đề Khảo sát (giảng viên sửa được khoá) có nút **"Xuất câu trả lời (Excel)"**, lọc được theo ca hoặc theo lần đo.
- Tệp có một sheet **"Câu trả lời"**, **mỗi lượt nộp một dòng**: họ tên, email, mã sinh viên (nếu có), lớp (CourseSection nếu có), lần đo, mã ca, thời điểm bắt đầu, thời điểm nộp, trạng thái (đã nộp / nộp tự động / đang làm), rồi **mỗi câu một cột** theo thứ tự trong đề, tiêu đề cột là mã câu (thiếu mã thì "Câu n").
- Giá trị ô: một lựa chọn ghi **thứ tự của lựa chọn** (1, 2, 3…) theo thứ tự soạn, không theo thứ tự đã xáo; nhiều lựa chọn ghi các thứ tự cách nhau dấu chấm phẩy ("1;3"); thang trượt ghi số; trả lời ngắn và dài ghi nguyên văn; bỏ trống để ô trống (không ghi "—" hay 0).
- Sheet thứ hai **"Từ điển câu hỏi"**: mã câu, phần, lần đo, dạng câu, nội dung câu, và danh sách "thứ tự = nội dung lựa chọn" hoặc khoảng của thang trượt, để người phân tích đọc được tệp mà không cần mở Limio.
- Người không sửa được khoá không tải được tệp (kiểm cả ở API, không chỉ ẩn nút). Mỗi lần xuất ghi một sự kiện (AC9).

## AC8 — Khảo sát không phải điểm

- Lượt nộp phiếu Khảo sát **không** có điểm (`score` và `scorePct` để trống), **không** bao giờ ở trạng thái "chờ chấm", và không xuất hiện trong danh sách bài cần chấm tay.
- Đề Khảo sát không xuất hiện trong Sổ điểm của khoá, bảng điểm đợt thi, điểm tổng của học viên, XP hay bất kỳ thống kê điểm nào; trang lịch sử thi của học viên ghi "Đã nộp phiếu" thay cho điểm.
- Câu trả lời khảo sát không đi vào mô hình người học (BKT) hay thống kê độ khó câu hỏi.

## AC9 — Sự kiện và quyền riêng tư

- Luồng làm phiếu giữ các sự kiện `exam.*` hiện có (`exam.started`, `exam.question.answered`, `exam.submitted`); **không** phát `exam.graded`. Payload các sự kiện của đề Khảo sát **không mang nội dung câu trả lời** (chỉ id câu, id lượt).
- Thêm sự kiện `exam.survey.exported` (subject là giảng viên xuất, payload chỉ `examId`, số dòng và bộ lọc). Sự kiện này không tính là hoạt động học (thêm vào `NON_LEARNER_ACTIVITY_PREFIXES` nếu cần theo quy ước CLAUDE.md §4.2).
- Câu trả lời khảo sát chỉ người sửa được khoá xem và xuất; học viên xoá tài khoản theo quy trình hiện có thì lượt khảo sát xoá theo.

## AC10 — Hướng dẫn của Lily (CLAUDE.md §4.9)

- Cập nhật `docs/hoc-lieu/huong-dan-limio/GIAO-DIEN.md` trước, rồi mục tương ứng trong `teacherAssistantGuide.ts` (tạo đề Khảo sát, mở bằng QR theo lần đo, xuất câu trả lời), có `useCases` cho tình huống khảo sát đầu và cuối học phần. Test `teacherAssistantFreshness.test.ts` phải xanh.

## Kiểm thử

- Đơn vị: kiểm hợp lệ cấu hình câu Khảo sát (có và không có đáp án đúng, thang trượt sai khoảng/bước, mã câu trùng); lọc câu theo lần đo; chấm một lượt Khảo sát cho ra không điểm và không chờ chấm; dựng dòng xuất từ `answerJson` của từng dạng câu, kể cả thứ tự đã xáo.
- Tích hợp: tạo đề Khảo sát → mở ca "Lần trước" bằng link nhanh → học viên đã ghi danh làm và nộp → học viên chưa ghi danh bị chặn → xuất Excel đúng cột và giá trị → mở ca "Lần sau" cho cùng học viên.
- Xem bằng mắt trên điện thoại (375 px): thang trượt, lời dẫn phần, màn hình "Đã ghi nhận phiếu".

## Phụ lục — Hai đề cho thực nghiệm CSBL (dựng sau khi tính năng lên limio.vn)

Hai đề trong khoá "Kỹ năng thực hành tại CSBL thuốc", cùng nội dung, khác ở hai phần cuối. Nội dung câu lấy nguyên từ `Bo-phieu-khao-sat-CSBL.docx`.

| Phần | Lần đo | Dạng câu | Đề đối chứng | Đề thực nghiệm |
|---|---|---|---|---|
| Đồng ý tham gia | Chỉ lần trước | Một lựa chọn (Đồng ý / Không đồng ý), lời dẫn là phiếu thông tin | ✓ | ✓ |
| N. Thông tin nền | Chỉ lần trước | Một lựa chọn, nhiều lựa chọn, trả lời ngắn | ✓ | ✓ |
| TT. Sự tự tin (TT01–TT29) | Cả hai lần | Thang trượt 0–100, bước 10 | ✓ | ✓ |
| TT nhìn lại lúc bắt đầu (TTR01–TTR29) | Chỉ lần sau | Thang trượt 0–100, bước 10 | ✓ | ✓ |
| TC. Tự chủ và trách nhiệm (TC01–TC12) | Cả hai lần | Một lựa chọn 1–5 | ✓ | ✓ |
| DL. Động lực (DL01–DL12) | Chỉ lần sau | Một lựa chọn 1–5 | ✓ | ✓ |
| TLX. Tải công việc (TLX1–TLX6) | Chỉ lần sau | Thang trượt 0–100, bước 5, nhãn hai đầu | ✓ | ✓ |
| TH. Quá trình học (TH1–TH9) | Chỉ lần sau | Một lựa chọn, trả lời ngắn, trả lời dài | ✓ | ✓ |
| MP. Đánh giá mô phỏng (MP1–MP11) | Chỉ lần sau | Một lựa chọn 1–5, trả lời dài | | ✓ |
| SUS (SUS1–SUS10) | Chỉ lần sau | Một lựa chọn 1–5 | | ✓ |

Phần DL chỉ đưa lên sau khi có phép dùng thang của Keller. Mã câu giữ đúng mã trong bộ phiếu để bảng xuất khớp với hướng dẫn tính điểm (mục C.1 của bộ phiếu).
