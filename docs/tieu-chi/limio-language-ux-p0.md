# Khoá ngoại ngữ — UX P0: thanh điều hướng một dòng và tuỳ chọn đọc

Nguồn: phản hồi học viên + `docs/mockup/ngoai-ngu-ux.html` (đề xuất A và D). Áp dụng cho mọi khoá dùng khung bài học 3 cột.

## A. Thanh điều hướng một dòng (dưới `lg`, tức < 1024 px)
- **A1.** Given đang xem một bài trong khung, When màn hẹp (< 1024 px), Then phía trên nội dung chỉ có MỘT thanh dính: nút ← về trang khoá, "n/N" (vị trí bài trong unit) cùng tên bài, nút "Aa", nút AI. Không còn thẻ "Bài trong unit" riêng, không còn đường dẫn nhiều dòng, không còn nút "Mục lục khoá học" nằm trên nội dung.
- **A2.** Bấm vào "n/N · tên bài" mở danh sách bài của unit (thanh bài), kèm "Mục lục khoá học"; bấm lại thì đóng. Vạch tiến độ mỏng dưới thanh theo số bài đã xong của unit.
- **A3.** Nút nổi cuộn lên/xuống và nút nổi mở panel AI không hiện dưới `lg` (đã có trong thanh); từ `lg` trở lên mọi thứ như cũ.
- **A4.** Từ `lg` trở lên: không đổi bố cục; chỉ thêm nút "Aa" ở hàng đường dẫn.

## D. Tuỳ chọn đọc "Aa"
- **D1.** "Aa" mở bảng có: Pinyin (Luôn hiện / Chạm để xem / Ẩn — chỉ khi khoá có pinyin) và Cỡ chữ (Vừa / Lớn / Rất lớn).
- **D2.** Ẩn = pinyin biến mất hẳn (không làm mờ). Chạm để xem = ẩn sẵn; chạm vào câu/khối thì hiện pinyin của khối đó, chạm lần nữa thì ẩn. Chạm vào nút, liên kết, ô nhập không kích hoạt việc này.
- **D3.** Lựa chọn nhớ theo khoá (`localStorage`, khoá `limio:reader:<slug>`), lần dựng đầu (máy chủ) luôn là mặc định để không lệch hydration; hỏng/thiếu dữ liệu thì về mặc định.
- **D4.** Cỡ chữ chỉ đổi phần nội dung bài, không đổi thanh điều hướng.
- Ngoài phạm vi P0: lựa chọn Bản dịch (các nút Phiên âm/Nghĩa/Bản dịch hiện có đã ẩn hẳn).
