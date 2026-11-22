# Chấm bài tập nộp bằng AI hàng loạt — tiêu chí nghiệm thu

Trạng thái: **đã duyệt và đã code** (22/11/2026). Đã xem bằng trình duyệt với dữ liệu mẫu (khung chạy, cột và bộ lọc, điền sẵn trong cửa sổ chấm); **chưa** chạy AI thật, chưa thử worker BullMQ thật và chưa thử nút chốt hàng loạt từ đầu đến cuối. Bài nộp nhóm: chạy một lần mỗi nhóm và gợi ý điền sẵn trong cửa sổ chấm nhóm; **chưa có chốt hàng loạt cho bài nhóm** (AC5 mới làm cho bài cá nhân).

## Bối cảnh

Hiện nút "✨ Gợi ý điểm bằng AI" ở trang `/instructor/assignments/[id]/submissions` chỉ chạy cho **một** bài nộp và **không lưu gì** (`/api/submissions/[id]/suggest-grade` chỉ trả gợi ý, thầy/cô bấm "Chấm điểm" mới ghi `AssignmentSubmission.score`). Lớp 40 bài thì phải bấm 40 lần, và đóng trang là mất gợi ý.

Mục tiêu: một nút chạy AI cho mọi bài chưa chấm, **lưu gợi ý lại**, thầy/cô rà rồi mới chốt. Giữ nguyên nguyên tắc: AI không bao giờ tự chốt điểm, không đổi điểm đã chốt.

## Phạm vi

- Có: bài tập nộp của khoá (`AssignmentSubmission`), cả nộp cá nhân lẫn nộp nhóm.
- Chưa: câu tự luận trong đề thi, thi vấn đáp (làm sau, dùng lại khung này).

## Quyết định thiết kế (cần user chốt)

1. **Nơi lưu gợi ý.** Đề xuất bảng mới `AssignmentAiGradeSuggestion` (một dòng mỗi bài nộp: điểm gợi ý, nhận xét, lý do, tiêu chí, đã đọc/chưa đọc, token, thời điểm). Không dùng cột `aiFeedback` của `AssignmentSubmission` vì cột đó dành cho góp ý gửi học viên. Cần migration.
2. **Cách chạy.** Chạy nền bằng BullMQ (đóng trang không mất, có tiến độ). **Đã làm: chạy tuần tự từng bài trong một lô** (không song song), để con trỏ tiến độ khớp và retry chạy tiếp đúng chỗ; lô của nhiều giảng viên vẫn chạy song song với nhau. Máy dev không có worker thì chạy thẳng trong tiến trình web (`AI_GRADE_BATCH_MODE=queue` để thử hàng đợi thật).
3. **Tên sự kiện.** Namespace `assignment.*` đang tính là hoạt động học, nên sự kiện của giảng viên dùng tiền tố mới `grading.` (`grading.ai_batch.started`, `grading.ai_batch.completed`), thêm vào `NON_LEARNER_ACTIVITY_PREFIXES`. Payload chỉ mang id và số đếm, không mang điểm, nhận xét hay chữ bài nộp.

## Tiêu chí (Given – When – Then)

### AC1. Nút và ước lượng chi phí
- Given trang bài nộp có n bài ở trạng thái `submitted` (chưa chấm), When thầy/cô mở trang, Then thấy nút "Gợi ý điểm bằng AI cho n bài chưa chấm" ở đầu danh sách; n = 0 thì nút ẩn.
- Given thầy/cô bấm nút, When hộp xác nhận mở, Then hiện số bài sẽ chạy, **ước lượng token cần** và **số dư ví token hiện có**; bài dài hơn ước lượng chung không làm hộp sai quá lớn (dùng độ dài chữ thật của bài, đã có `estimatePages`).
- Given số dư không đủ cho cả n bài, When xem hộp xác nhận, Then báo rõ "ví đủ khoảng k/n bài" và cho chạy k bài đầu theo thứ tự nộp, không âm thầm chạy rồi dừng giữa chừng.

### AC2. Chạy và tiến độ
- Given thầy/cô xác nhận, When job chạy, Then mỗi bài đi qua **đúng đường chấm hiện có** (cùng prompt, cùng cách đọc Google Docs/PDF/Word/bài nói, cùng `assertWithinCaps`), không viết lại logic chấm.
- Given job đang chạy, When thầy/cô ở trang hoặc quay lại sau, Then thấy tiến độ "đã xong x/n, lỗi y", có nút "Dừng"; bấm dừng thì bài đang chạy xong rồi dừng, bài chưa chạy giữ nguyên.
- Given đã có một job đang chạy cho bài tập này, When bấm nút lần nữa, Then bị từ chối với thông báo "đang chạy", không tạo job trùng.

### AC3. Bài nào được bỏ qua
- Bài đã `graded` (có điểm chốt) **không bao giờ** bị chạy.
- Bài đã có gợi ý còn mới (bài không đổi từ lúc gợi ý) bị bỏ qua, trừ khi thầy/cô chọn "chạy lại cả bài đã có gợi ý".
- Bài trống, hoặc chỉ nộp tệp AI không đọc được (ảnh/video), được ghi vào danh sách "chưa gợi ý được" kèm lý do, không tính là lỗi hệ thống và không trừ ví.
- Nộp nhóm: chạy **một lần cho mỗi nhóm** (lần nộp mới nhất), không chạy lặp theo từng thành viên.

### AC4. Lưu gợi ý, không tự chốt
- When một bài chạy xong, Then gợi ý được lưu ở `AssignmentSubmission` không đổi: `status`, `score`, `feedback`, `graderId`, `gradedAt` **giữ nguyên**; học viên **không** thấy gợi ý này.
- Given gợi ý đã lưu, When thầy/cô mở bài đó, Then ô điểm và ô nhận xét được điền sẵn từ gợi ý kèm ghi chú "Gợi ý của AI, chưa chốt" (cùng giao diện như gợi ý từng bài hiện nay), và bấm "Chấm điểm" mới ghi điểm.
- Given bài nộp bị học viên sửa/nộp lại sau khi có gợi ý, When thầy/cô mở, Then gợi ý được đánh dấu "bài đã đổi" và không tự điền.
- Danh sách bài hiện thêm cột/nhãn "Có gợi ý AI" và hiện điểm gợi ý để thầy/cô lọc, sắp xếp.

### AC5. Chốt nhanh nhưng có kiểm soát
- Given có ít nhất một gợi ý, When thầy/cô chọn nhiều bài rồi bấm "Chốt theo gợi ý AI cho m bài đã chọn", Then hộp xác nhận nêu rõ sẽ **ghi điểm thật và gửi nhận xét cho học viên**, và chỉ chạy khi bấm xác nhận.
- Việc chốt đi qua `gradeSubmission` (cùng kiểm quyền, cùng `onAssignmentGraded`), không ghi thẳng DB. Điểm gợi ý được làm tròn về số nguyên trong `[0, maxScore]` như thao tác tay.
- Không có chế độ "AI chấm và chốt luôn" mà không qua bước chọn của thầy/cô.

### AC6. Lỗi, ví và hạn mức
- Ví hết giữa chừng (`no_token_budget`) hoặc vượt trần hệ thống (`global_token_cap`): job **dừng sạch**, giữ các gợi ý đã có, báo "đã xong x/n, dừng vì hết ví token", và thầy/cô chạy tiếp được sau khi nạp (bài chưa gợi ý sẽ được chạy tiếp, bài đã gợi ý không chạy lại).
- Lỗi một bài (AI trả sai định dạng, tệp lỗi…) không làm dừng cả lô: ghi lỗi của bài đó, đi tiếp, rồi liệt kê cuối lượt kèm nút "Chạy lại các bài lỗi".
- Mọi thông báo lỗi hiện bằng tiếng Việt dễ hiểu, không lộ mã thô (`no_token_budget`…).
- Token tính vào **ví của thầy/cô bấm nút**, đúng như gợi ý từng bài hiện nay; ghi `AiUsageLog` như thường.

### AC7. Quyền, riêng tư, sự kiện
- Chỉ người có `assertCanEditCourse` của khoá (hoặc chủ giải đấu với bài của Tournament) tạo/dừng/xem job; người khác nhận 403. Học viên không đọc được bảng gợi ý qua bất kỳ API nào.
- Phát `grading.ai_batch.started` và `grading.ai_batch.completed` trong cùng transaction tạo/đóng job; payload chỉ `assignmentId`, `jobId`, số bài, số lỗi, token. Không mang chữ bài nộp, điểm hay nhận xét.
- Xoá học viên (`deleteUser`) xoá luôn gợi ý của bài họ; gợi ý nằm trong export dữ liệu cá nhân nếu bài nộp nằm trong đó (CLAUDE.md §5.4).

### AC8. Kiểm thử bắt buộc
- Test đơn vị: chọn bài (bỏ bài đã chấm, bỏ bài gợi ý còn mới, gộp nhóm), tính số bài vừa ví, dừng sạch khi hết ví, lỗi một bài không dừng lô.
- Test route: 403 người ngoài khoá, 409 khi đã có job chạy, không ghi `score`/`status` sau khi chạy xong.
- Test giao diện/hàm thuần: nhãn thông báo cho mọi mã lỗi AI (bao gồm `no_token_budget`).
- Test quét: namespace `grading.*` nằm trong `NON_LEARNER_ACTIVITY_PREFIXES`.

## Ngoài phạm vi / điều chưa làm

- Chấm lại cả lô khi thầy/cô đổi rubric (có thể thêm sau bằng "chạy lại cả bài đã có gợi ý").
- Chế độ AI tự chốt điểm.
- Đề thi tự luận và vấn đáp.
