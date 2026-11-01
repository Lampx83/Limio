# Quiz Toán: nháp ra giấy trước khi trả lời — tiêu chí chấp nhận

> Bản 01/11/2026, đã duyệt. Áp dụng cho các quiz được đánh dấu riêng; quiz khác không đổi.

## Vì sao làm

Phương án nhiễu của quiz Toán được soạn từ lỗi tính toán thật. Nếu học sinh nhìn đáp án rồi loại trừ hoặc thử ngược, quiz không còn cho biết em sai ở bước nào và phản hồi mất ý nghĩa. Một câu nhắc bằng chữ rất dễ bị bỏ qua, nên việc nháp được đưa vào chính luồng làm bài.

## Đã chốt

1. Có hai phần: màn hình chuẩn bị giấy bút trước khi làm, và che đáp án ở câu cần tính toán.
2. Đánh dấu theo **từng câu**, lưu trong `extra.workOnPaper` của câu hỏi, không cần đổi cấu trúc DB. Quiz có ít nhất một câu được đánh dấu thì có màn hình chuẩn bị.
3. Đây là lời nhắc có cấu trúc, **không phải kiểm tra**: hệ thống không biết học sinh có nháp thật hay không, và không chặn việc bấm ngay.
4. Chữ trên màn hình xưng "em" vì hiện chỉ dùng cho khoá học sinh. Khi dùng cho khoá người lớn thì phải đổi lại.

## Chưa làm trong đợt này

- Đánh dấu các quiz của khoá mẫu "Ôn thi vào lớp 10" (làm được bằng cùng cơ chế).
- Giao diện cho giảng viên tự đánh dấu câu: hiện đánh dấu trong tệp học liệu, vì khoá này do Limio soạn.
- Dùng thời gian làm mỗi câu để phát hiện đoán mò.
- Chụp ảnh bài nháp.

## AC1 — Màn hình chuẩn bị

- **Given** quiz có câu được đánh dấu và lượt làm chưa có câu trả lời nào, **when** học sinh vào bài, **then** thấy hình tờ giấy nháp và bút, dòng "Em chuẩn bị giấy và bút nhé", câu giải thích, số câu, số điểm và nút "Em đã sẵn sàng"; đề chưa hiện.
- **When** bấm "Em đã sẵn sàng", **then** vào câu 1 và không gặp lại màn hình này trong lượt đó.
- **Given** lượt làm đã có câu trả lời, hoặc học sinh đã qua màn hình này và tải lại trang, **then** vào thẳng bài làm.
- **Given** quiz có giới hạn thời gian, **then** không hiện màn hình này, vì đồng hồ đã chạy từ lúc mở bài.
- **Given** quiz không có câu nào được đánh dấu, **then** giao diện không đổi.

## AC2 — Che đáp án ở câu được đánh dấu

- **Given** câu được đánh dấu chưa có trả lời, **when** tới câu đó, **then** thấy đề bài, nhưng các phương án được thay bằng khung "Các đáp án đang được che. Em giải ra giấy trước đã." và nút "Em giải xong rồi".
- **When** bấm nút, **then** các phương án hiện ra và chọn được bình thường; tiêu điểm bàn phím chuyển tới phương án đầu tiên.
- **Given** câu đã mở hoặc đã có trả lời, **when** rời đi rồi quay lại, hoặc tải lại trang khi đã trả lời, **then** các phương án vẫn hiện.
- **Given** câu đã mở nhưng chưa trả lời và học sinh tải lại trang, **then** câu đó được che lại.
- Câu không được đánh dấu, câu điền số và câu ghép đôi không bị che.
- Học sinh vẫn chuyển câu, đánh dấu xem lại và nộp bài được khi còn câu đang che; câu đó được tính là chưa trả lời, theo đúng cảnh báo sẵn có khi nộp.
- Khi che, các phương án không nằm trong trang (kể cả cho trình đọc màn hình), không chỉ bị ẩn bằng CSS.

## AC3 — Không làm thay đổi kết quả

- Chấm điểm, lưu bài, phản hồi, trang kết quả và tiến độ bài học không đổi.
- `latencyMs` của câu vẫn tính từ lúc vào câu, nên gồm cả thời gian nháp.
- Không ghi sự kiện mới.

## AC4 — Giao diện

- Điện thoại 375 px: không cuộn ngang, hai nút cao ít nhất 44 px, hình không đẩy nút ra khỏi màn hình.
- Sáng và tối đều đọc được; hình dùng màu theo chủ đề, không phải ảnh tải về. Tôn trọng "giảm chuyển động".

## AC5 — Soạn và cập nhật dữ liệu

- Tệp học liệu có `"workOnPaper": true` ở từng câu; importer ghi vào `extra` và vẫn giữ `manifestKey`.
- `update-lesson.ts` nhận ra thay đổi đánh dấu và ghi được cả khi quiz đã có lượt làm, không cần `--force`, vì đề và đáp án không đổi. Thay đổi đề hay đáp án vẫn bị chặn như cũ.
- Câu mở sẵn của lượt làm cũ vẫn hoạt động bình thường, không mất câu trả lời.

### Các câu được đánh dấu

| Bài | Câu |
|---|---|
| Hàm số bậc hai và đồ thị | 4 (đỉnh), 6 (đồng biến), 7 (giá trị nhỏ nhất), 9 (tham số) |
| Ba đường conic | 4, 5 (tiêu điểm), 6 (đường chuẩn), 9 (viết phương trình) |
| Hệ thức lượng trong tam giác | 4 (tìm cạnh), 5 (tìm góc), 6 (định lí sin), 7 (diện tích) |
| Hệ bất phương trình và tối ưu | 5 (giao điểm), 7 và 10 (giá trị tại các đỉnh) |
| Xác suất cổ điển | 6 (hai mặt bằng nhau), 8 (chia hết cho 4), 9 (ít nhất một), 10 (cùng màu) |

## AC6 — Kiểm thử

- Test hàm thuần: khi nào hiện màn hình chuẩn bị, khi nào câu bị che (chưa trả lời, đã mở, đã trả lời, có giới hạn thời gian, loại câu không che).
- Test importer: `workOnPaper` đi vào `extra` cùng `manifestKey`.
- Duyệt tay trên desktop và 375 px, sáng và tối: vào bài, mở câu, tải lại trang, nộp khi còn câu che; quiz không đánh dấu và quiz có giới hạn thời gian không đổi.

## Đã kiểm (01/11/2026, máy dev, quiz Xác suất cổ điển)

- [x] AC1: màn hình chuẩn bị hiện với đề chưa lộ; nút được tiêu điểm sẵn, cao 44 px; tải lại trang không gặp lại.
- [x] AC2: đúng các câu 6, 8, 9, 10 bị che và khi che không có phương án nào trong trang; bấm mở thì tiêu điểm tới phương án đầu tiên; chọn rồi rời đi và quay lại vẫn giữ; câu đã mở chưa trả lời bị che lại sau khi tải lại trang; nộp được khi còn câu che.
- [x] AC4: 375 px không cuộn ngang; giao diện tối đọc được khung che.
- [x] AC5: dev đánh dấu đủ 19 câu, giữ nguyên `manifestKey`; ghi được cả ở quiz đã có lượt làm.
- [x] AC6: `quizPlayerState.test.ts`, `importCourseLayouts.test.ts`.
- [x] Câu ghép đôi: ở 375 px nhãn xếp trên ô chọn (lỗi có từ trước, cột chữ từng co còn 14 px, sửa cùng đợt vì dùng chung cho mọi khoá); ở 768 px đã ghép đủ không vỡ bố cục.
- [ ] Quiz không đánh dấu và quiz có giới hạn thời gian mới kiểm bằng test, chưa xem trên trình duyệt. Màn hình chuẩn bị ở giao diện tối chưa xem bằng mắt; ở 375 px mới đo vị trí nút.
