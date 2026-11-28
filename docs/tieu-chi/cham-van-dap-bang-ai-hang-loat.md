# Chấm vấn đáp bằng AI hàng loạt — tiêu chí nghiệm thu

Trạng thái: **đã duyệt (28/11/2026) và đã code**; chưa commit, chưa xem bằng trình duyệt với dữ liệu mẫu, chưa chạy AI thật. Mở rộng khung đã làm cho bài tập nộp (`docs/tieu-chi/cham-bai-tap-bang-ai-hang-loat.md`) sang vấn đáp AI.

## Bối cảnh

Ở trang `/instructor/courses/[id]/exams/[examId]/grading` của một đề vấn đáp (`Exam.kind = oral`), thầy/cô phải mở **từng lượt** rồi bấm "Chấm bằng AI" (`OralGradeForm`). Lớp 40 sinh viên thì bấm 40 lần, mỗi lần chờ AI đọc cả hội thoại.

Mục tiêu: một nút chạy AI cho mọi lượt đã kết thúc mà chưa có đề xuất, thầy/cô rà rồi mới chốt. Giữ nguyên nguyên tắc: AI chỉ đề xuất, **không tự chốt, không đổi điểm đã chốt**.

## Phạm vi

- **Có:** vấn đáp AI bản cũ (`Exam.kind = oral`, bảng `OralExamEvaluation`). Chấm vẫn dùng được cả khi admin đã tắt tạo mới vấn đáp cũ (`isLegacyOralDisabled` chỉ chặn bắt đầu cuộc hỏi–đáp mới).
- **Chưa:** Limio Vấn đáp (bản mới, `vandap.*`). Phần chấm của nó là Mốc 3 chưa làm; khi làm Mốc 3 sẽ dùng lại khung lô này.
- **Chưa:** câu tự luận trong đề thi viết.

## Điều đã có sẵn, nên không làm lại

- Đề xuất của AI đã được **lưu** ở `OralExamEvaluation` (`aiSuggestedScore`, `aiSummary`, `aiRubricBreakdown`), tách khỏi điểm chốt (`instructorScore`, `status`, `gradedAt`). Vì vậy **không cần bảng gợi ý mới** như bài tập.
- Chấm một lượt đã đi qua `generateOralExamEvaluation` (core-feedback): đúng prompt, đúng `assertWithinCaps` (gồm ví token), ghi `AiUsageLog`. Lô **gọi lại đúng hàm này**, không viết đường chấm thứ hai.
- Chốt điểm đi qua `submitOralEvaluation` (core-lms): kiểm quyền, `status = approved` khi điểm trùng đề xuất, phát `exam.oral_evaluation.graded`.

## Quyết định thiết kế (đã duyệt theo đề xuất, 28/11/2026)

1. **Chỉ thêm bảng lô** `OralAiGradeBatch` (theo `examId`, con trỏ tiến độ, số đếm, lý do dừng), cùng một lô `running` mỗi đề qua chỉ mục duy nhất từng phần trong SQL thô của migration. Cần migration. Đề xuất bảng riêng thay vì tổng quát hoá bảng lô bài tập, để không đụng phần vừa lên production.
2. **Nhận xét khi chốt hàng loạt.** Đề xuất: nút "Chốt theo đề xuất AI" ghi **điểm và nhận xét tóm tắt của AI** vào `instructorNotes` (sinh viên thấy), và hộp xác nhận nói rõ điều đó. Phương án khác: chỉ ghi điểm, để trống nhận xét.
3. **Sinh viên thi nhiều lượt.** Đề xuất: chạy mọi lượt đã kết thúc chưa có đề xuất (điểm tính vẫn là lượt cao nhất như hiện nay). Phương án khác: chỉ chạy lượt mới nhất của mỗi sinh viên cho đỡ tốn token.
4. **Sự kiện.** `grading.oral_batch.started` và `grading.oral_batch.completed` (payload chỉ id và số đếm), thêm vào nhóm tiền tố `grading.` đã có trong `NON_LEARNER_ACTIVITY_PREFIXES`.

## Tiêu chí (Given – When – Then)

### AC1. Nút và ước lượng chi phí
- Given trang chấm vấn đáp có n lượt đã kết thúc chưa có đề xuất AI và chưa chốt, When thầy/cô mở trang, Then thấy nút "Gợi ý điểm bằng AI cho n lượt chưa chấm" ở đầu danh sách; n = 0 thì nút ẩn.
- Given bấm nút, When hộp xác nhận mở, Then hiện số lượt, **ước lượng token** (theo độ dài hội thoại thật của từng lượt cộng rubric) và **số dư ví** của người bấm.
- Given ví không đủ cho cả n lượt, When xem hộp xác nhận, Then báo "ví đủ khoảng k/n lượt" và chạy k lượt đầu theo thứ tự nộp, không chạy rồi dừng giữa chừng.

### AC2. Chạy và tiến độ
- Mỗi lượt đi qua `generateOralExamEvaluation`, không sao chép logic chấm.
- Chạy nền, **tuần tự** từng lượt trong một lô (như bài tập); đóng trang vẫn chạy. Thấy tiến độ "đã xong x/n, lỗi y" và nút "Dừng" (lượt đang chạy xong rồi dừng).
- Đã có lô `running` của đề này thì bấm lại bị từ chối "đang chạy".

### AC3. Lượt nào được bỏ qua
- Lượt đã `graded` (đã chốt điểm) **không bao giờ** bị chạy.
- Lượt đã có `aiSuggestedScore` bị bỏ qua, trừ khi tích "Chạy lại cả lượt đã có đề xuất (tốn thêm token)".
- Lượt không có câu trả lời nào của sinh viên (chỉ có lời giám khảo, hoặc không có lượt hội thoại) ghi vào "chưa gợi ý được" kèm lý do, không tính là lỗi hệ thống, không trừ ví.
- Lượt đang làm dở (`in_progress`) không vào lô.

### AC4. Lưu đề xuất, không tự chốt
- Sau khi một lượt chạy xong, `instructorScore`, `instructorNotes`, `status`, `gradedAt`, `gradedById` và `ExamAttempt.status` **giữ nguyên**; sinh viên không thấy đề xuất.
- Mở một lượt thì ô điểm điền sẵn từ đề xuất (hành vi hiện có của `OralGradeForm`); bấm "Chốt điểm" mới ghi điểm.
- Danh sách lượt hiện cột điểm AI đề xuất (đã có ở `OralAttemptsList`), thêm bộ lọc "Chỉ lượt có đề xuất AI".
- Điểm AI không đọc được (`score = null` do AI trả sai khuôn) được tính là **lỗi của lượt đó**, không phải đề xuất.

### AC5. Chốt nhanh nhưng có kiểm soát
- Given có ít nhất một đề xuất, When tích nhiều lượt rồi bấm "Chốt theo đề xuất AI cho m lượt", Then hộp xác nhận nêu rõ sẽ **ghi điểm thật và nhận xét sinh viên sẽ thấy** (theo quyết định 2); chỉ chạy khi xác nhận.
- Chốt đi qua `submitOralEvaluation` (cùng kiểm quyền, cùng sự kiện). Điểm giữ đúng điểm đề xuất nên `status = approved`.
- Lượt đã chốt rồi, hoặc chưa có đề xuất, được bỏ qua và nêu rõ ở kết quả.
- Không có chế độ "AI chấm và chốt luôn".

### AC6. Lỗi, ví và hạn mức
- Hết ví (`no_token_budget`), vượt trần hệ thống hay `rate_limited`, `openai_not_configured`: lô **dừng sạch**, giữ các đề xuất đã có, báo bằng tiếng Việt (dùng `aiSuggestErrorText`), chạy tiếp được sau khi nạp.
- Lỗi một lượt không làm dừng cả lô: ghi lỗi, đi tiếp, liệt kê cuối lượt kèm nút "Chạy lại các lượt lỗi".
- Token tính vào ví của thầy/cô bấm nút, ghi `AiUsageLog` như thường.

### AC7. Quyền, riêng tư, sự kiện
- Chỉ người qua `assertCanEditExam` của đề được tạo/dừng/xem lô; người khác nhận 403. Sinh viên không đọc được đề xuất qua API nào.
- Phát `grading.oral_batch.started` và `grading.oral_batch.completed`; payload chỉ `examId`, `batchId`, số đếm, token — **không** mang lời hội thoại, điểm hay nhận xét.
- `deleteUser` xoá lô do người đó bấm; đề xuất nằm trong `OralExamEvaluation` nên đã theo `deleteUser` và export hiện có (kiểm lại bằng test).

### AC8. Xuất Excel điểm vấn đáp
- File `diem-van-dap_*.xlsx` có thêm cột **"Mã sinh viên"** ngay sau "Họ tên" (lấy `User.studentCode`; trống khi sinh viên chưa khai). *Đã làm ngày 28/11/2026.* Mã này do sinh viên tự khai ở Cài đặt, không xác thực.

### AC9. Kiểm thử bắt buộc
- Hàm thuần: chọn lượt (bỏ đã chốt, bỏ đã có đề xuất, bỏ lượt không có lời sinh viên), ước lượng token, số lượt vừa ví.
- Runner: dừng sạch khi hết ví, lỗi một lượt không dừng lô, không bao giờ ghi `instructorScore`/`status`.
- Route: 403 người ngoài, 409 khi đã có lô chạy, chốt hàng loạt qua `submitOralEvaluation`.
- Cập nhật `GIAO-DIEN.md` và mục tương ứng trong `teacherAssistantGuide.ts` (CLAUDE.md §4.9); test `teacherAssistantFreshness` xanh.

## Ngoài phạm vi / chưa làm

- Phát hiện rubric đã đổi sau khi AI đề xuất (hiện chỉ có tích "Chạy lại").
- Limio Vấn đáp (chờ Mốc 3), câu tự luận đề thi viết.
- Chế độ AI tự chốt điểm.
