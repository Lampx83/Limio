# Xuất nội dung phiên vấn đáp theo từng học viên

Giảng viên tải về nội dung phiên vấn đáp (hội thoại, điểm, nhận xét) của một người, vài người hoặc cả lớp từ trang
**Chấm vấn đáp**. Mỗi học viên là một file Word. Một người thì tải thẳng file Word, từ hai người trở lên thì gói vào một
file nén.

Chọn Word vì đo với 100 học viên, mỗi phiên 40 lượt: PDF mất 38 giây và làm máy chủ đứng tới 1 giây mỗi lần, Word mất
dưới 1 giây. Đã bỏ hẳn xuất PDF cho vấn đáp. Trang chấm từng lượt có "Xuất Word" cho riêng lượt đó.

## Tiêu chí nghiệm thu

1. **Chọn người.** Mỗi lượt thi trong danh sách có một ô chọn, phía trên có "Chọn tất cả" và dòng đếm số người đã chọn.
2. **Nút xuất đổi theo lựa chọn.**
   - Chưa chọn ai: "Xuất tất cả file Word (.zip)", xuất mọi lượt đã kết thúc. Đề chỉ có một lượt thì nút là "Xuất Word".
   - Chọn một người: "Xuất Word", tải về một file Word.
   - Chọn nhiều người: "Xuất n file Word (.zip)", tải về một file nén.
3. **Tên file** theo mẫu `Tên học viên - ngày thi - Tên đề.docx`, có dấu tiếng Việt, ví dụ
   `Nguyễn Văn An - 02-11-2026 - Giữa kỳ Kinh tế vi mô.docx`. Ngày thi tính theo giờ Việt Nam.
4. **File nén** có một thư mục `Vấn đáp - Tên đề - ngày xuất`, bên trong là file nhỏ của từng người. File nén mang cùng
   tên với thư mục.
5. **Trùng tên.** Hai file trùng tên (trùng họ tên, hoặc một người thi hai lượt cùng ngày) thì file sau thêm `(2)`, không
   file nào bị ghi đè.
6. **Quyền.** Chỉ người sửa được đề mới xuất được. Mã lượt thi của đề khác gửi lên sẽ bị bỏ qua.
7. **Báo lỗi.** Trong lúc tạo file, nút hiện "Đang tạo file…" và không bấm lại được. Xuất không được thì báo ngay trên
   trang, không chuyển sang trang lỗi.
