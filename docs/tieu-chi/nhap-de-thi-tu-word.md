# Đề thi: nhập câu hỏi thẳng từ file Word (.docx) — tiêu chí chấp nhận

> 19/11/2026. Mở rộng "Excel import" / "AI import" của mục Nội dung đề thi. Bản nháp chờ thầy duyệt; code theo bản này.

## Vì sao làm

Đường nhập hiện có chỉ là Excel (6 dạng, không có ảnh hay đoạn văn) và AI import dán chữ (5 dạng, không có ảnh, không có đoạn văn). Giảng viên soạn đề trong Word, nên cần nhập thẳng file, giữ **ảnh**, **đoạn văn** và đủ **10 dạng** câu hỏi của Limio.

## Đã chốt (theo file mẫu `docs/mau-thu-de-thi/De-thi-demo_Bach-khoa-Ha-Noi.docx`)

1. **Đọc theo khuôn, không dùng AI.** Kết quả xem trước giống nhau mỗi lần, không tốn token, không phụ thuộc mô hình. Chữ nào không nhận ra thì báo, không đoán.
2. Có **xem trước** rồi mới nhập (cùng bảng xem trước của Excel/AI). Bước nhập đọc lại file, không tin dữ liệu từ trình duyệt.
3. Ảnh chỉ được tải lên kho đề **ở bước nhập**, và chỉ ảnh của câu/đoạn được chọn nhập.
4. Chỉ dùng cho đề thường còn nháp (hoặc chưa có lượt thi). Đề Khảo sát không dùng được (như Excel/AI).

## Khuôn file Word

| Thành phần | Cách viết |
|---|---|
| Câu hỏi | Đoạn bắt đầu bằng `Câu N.` (hoặc `Câu N:`, `Câu N)`). Sau đó tuỳ chọn `(2 điểm)` (mặc định 1 điểm) và nhãn dạng trong ngoặc vuông, rồi đề bài |
| Nhãn dạng | `[Một đáp án]`, `[Nhiều đáp án]`, `[TRUE / FALSE / NOT GIVEN]`, `[Đúng / Sai]`, `[Điền khuyết]`, `[Trả lời ngắn]`, `[Sắp xếp thứ tự]`, `[Ghép cặp]`, `[Đáp án dạng số]`, `[Kéo thả từ/câu]`, `[Tự luận]`. Phần sau dấu "·" trong nhãn (vd "· có hình") bỏ qua. Không có nhãn thì suy ra từ nội dung |
| Đề nhiều dòng, có ảnh | Các đoạn nằm giữa dòng `Câu N.` và dòng phương án/đáp án đầu tiên đều thuộc đề; ảnh trong các đoạn đó thành ảnh của đề |
| Phương án | Dòng bắt đầu `A.` hoặc `A)` (chữ in hoa); danh sách tự đánh số của Word cũng được (gán A, B, C… theo thứ tự) |
| Đáp án | `Đáp án: B` (một đáp án), `A, B, E` (nhiều đáp án), `TRUE`/`FALSE`/`NOT GIVEN` hoặc `Đúng`/`Sai`, `B → E → D` (sắp xếp), `1 – D; 2 – A` (ghép cặp), `0,2` (số), `lập trình ; CLB lập trình` (trả lời ngắn, cách nhau bằng `;`), `Hà Nội ; 1956` (điền khuyết, mỗi chỗ trống một mục, đáp án phụ cách bằng `|`) |
| Ghép cặp | Cột trái đánh số `1.`, cột phải đánh chữ `A.`; đáp án `1 – D; …` |
| Số | `Đáp án: 0,2` và (tuỳ chọn) dòng `Sai số: 0,01` (mặc định 0) |
| Kéo thả | Đề có `[[1]]`, `[[2]]`…; thẻ viết `Thẻ [1]: biến`, `Thẻ [2]: vòng lặp`, thẻ gây nhiễu `Thẻ nhiễu: chú thích` |
| Tự luận | `Tiêu chí đánh giá (rubric): …` và (tuỳ chọn) `Số từ tối thiểu: 100` |
| Giải thích | `Giải thích: …` (tuỳ chọn, mọi dạng) |
| Đoạn văn | Dòng `[ĐOẠN VĂN] Tiêu đề`; các đoạn/ảnh/danh sách tiếp theo là nội dung đoạn; các câu hỏi đứng sau thuộc đoạn đó cho tới dòng `[HẾT ĐOẠN VĂN]`, dòng `[ĐOẠN VĂN]` mới, hoặc một tiêu đề cấp 1 |
| Bỏ qua | Bảng, tiêu đề, và mọi chữ không thuộc câu hỏi hay đoạn văn (vd. khung ghi chú, phụ lục) |

## AC1 — Chọn file và xem trước

- **Given** giảng viên ở Nội dung đề thi, **when** mở menu thêm câu, **then** có mục "Word import" cạnh "Excel import" và "AI import".
- Cửa sổ có nút "Tải file mẫu" (file mẫu Bách khoa) và "Chọn file Word", kèm hướng dẫn ngắn khuôn file.
- **When** chọn file `.docx` hợp lệ, **then** thấy bảng xem trước đúng cột như Excel: số câu, trạng thái ✓/⚠/✗, loại, đề bài, đáp án, điểm, đoạn văn; câu có ảnh hiện số ảnh.
- File không phải `.docx` (kể cả `.doc` cũ), rỗng, quá 20 MB, hoặc không có câu nào nhận ra: báo lỗi bằng tiếng Việt, không có bảng.

## AC2 — Đủ 10 dạng

- Mỗi dạng ở bảng trên được đọc thành câu hợp lệ theo đúng cấu hình của Limio (cùng schema Zod với trình soạn): `mcq`, `multi`, `true_false_notgiven`, `gap_fill`, `short_answer`, `ordering`, `matching`, `numerical`, `drag_drop_fill`, `essay`.
- "Đúng / Sai" có hai phương án A/B được đọc thành TRUE/FALSE theo chữ của phương án đáp án.
- Ghép cặp, sắp xếp: thứ tự và cặp đúng theo `Đáp án`; thiếu hoặc lệch phần tử thì báo lỗi dòng đó.

## AC3 — Ảnh

- Ảnh nằm trong đề của câu hỏi thành ảnh trong đề (ở đúng vị trí đoạn); ảnh trong đoạn văn thành ảnh trong đoạn.
- Mô tả ảnh (alt) lấy từ Word nếu có, không thì "Hình minh hoạ câu N" / "Hình minh hoạ đoạn văn".
- Ảnh không phải PNG/JPG/WebP/GIF hoặc lớn hơn 5 MB: câu (hoặc đoạn) chứa ảnh đó báo lỗi rõ, không tự bỏ ảnh âm thầm.
- Xem trước **không** ghi gì vào kho; ảnh chỉ được tải lên ở bước nhập, và nếu một ảnh tải lỗi thì câu chứa nó không được tạo.

## AC4 — Đoạn văn

- `[ĐOẠN VĂN] Tiêu đề` tạo một đoạn văn mới của đề (chữ, tiêu đề phụ, danh sách, ảnh), câu hỏi theo sau gắn vào đoạn đó theo thứ tự.
- Câu nằm ngoài đoạn là câu độc lập. Đoạn không có tiêu đề thì dùng "Đoạn văn n". Đoạn không có câu nào: cảnh báo, vẫn tạo.
- Không tạo đoạn trùng: chọn lại "Làm lại" rồi nhập không sinh thêm gì khi chưa bấm nhập.

## AC5 — Kiểm lỗi từng câu

- Lỗi (câu bị loại, nói rõ lý do và số câu): thiếu `Đáp án`; mcq có 0 hoặc nhiều đáp án đúng; chữ đáp án không có trong phương án; điền khuyết số chỗ trống không khớp số mục đáp án; kéo thả không có `[[N]]` hoặc thẻ thiếu/dư; số không phải số; dạng không nhận ra.
- Cảnh báo (vẫn nhập được): đề trống chữ nhưng có ảnh; câu không có nhãn dạng mà đoán dạng ("Đoán là Một đáp án"); số chỗ trống thừa.
- Hộp "Bao gồm câu có cảnh báo" hoạt động như Excel.

## AC6 — Nhập

- **When** bấm "Import N câu", **then** tạo đoạn văn (nếu có), tải ảnh, tạo câu theo thứ tự trong file, cuối đề; báo số câu nhập được và lỗi từng câu.
- Câu lỗi hoặc bị bỏ không ảnh hưởng câu khác. Mỗi câu giữ điểm đã ghi (hoặc 1).
- Đề đã có lượt thi (`exam_has_attempts`), đề khảo sát, người không có quyền sửa đề, chưa đăng nhập: bị từ chối đúng như Excel.
- Câu nhập xong mở được và sửa được trong trình soạn câu hỏi hiện có; làm bài đúng cấu hình.

## AC7 — Không hồi quy

- Excel import và AI import không đổi hành vi (test cũ vẫn qua).
- Kho đề không có tệp mồ côi khi xem trước, và khi một câu tạo lỗi sau khi ảnh đã tải thì ảnh đó vẫn thuộc đề (không xoá ảnh đã gắn vào câu khác).

## Kiểm thử

Test đọc file (core-lms): file mẫu Bách khoa cho đúng 16 câu, đủ 10 dạng, 1 đoạn văn có ảnh, 3 ảnh, tổng điểm 20; từng dạng một ca đúng và một ca lỗi; nhãn thiếu; danh sách tự đánh số; ảnh sai định dạng; bảng/phụ lục bị bỏ qua. Test route (preview, confirm: quyền, đề có lượt thi, file sai). Xem trên trình duyệt: nhập file mẫu vào một đề trống và làm thử một lượt.

## Chưa làm

- Nhập audio/video từ Word; công thức Word (OMML) — thay bằng cú pháp `$…$` đã có.
- Gắn skill từng câu, độ khó từng câu (Excel có cột này; Word dùng mặc định).
- File `.doc` cũ.
