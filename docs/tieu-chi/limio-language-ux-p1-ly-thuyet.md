# Khoá ngoại ngữ — UX P1: phần lý thuyết gọn hơn

Nguồn: `docs/mockup/ngoai-ngu-ux.html` + đề xuất lý thuyết (gập mục phụ, mục lục phần, chế độ từng bước). Áp dụng cho bài HSK tác giả (bản gốc Limio); các khoá khác theo sau.

## E. ~~Gập các mục phụ, mở sẵn mục chính~~ (ĐÃ BỎ 19/11/2026)
Người dùng chọn bỏ hẳn phần gập: Ngữ pháp, Văn hoá và Lưu ý về từ mở sẵn như mọi mục khác, không còn dòng tóm tắt và nút "Xem chi tiết" / "Thu gọn". Mã `FoldSection`, `foldSummary`, `isFoldedSection` và khoá i18n `reader.fold.*` đã xoá.

## F. Mục lục phần trong thanh bên trái (máy tính)
- **F1.** Từ `lg`, bài đang xem trong thanh bài mở rộng ra các mục có số (01, 02…); mục đang đọc được tô đậm khi cuộn; bấm một mục thì cuộn tới mục đó. Bài không có mục có số thì không hiện.

## G. Chế độ từng bước cho bài dài
- **G1.** Bài có từ 4 mục lớn trở lên tự vào chế độ từng bước (người học đổi được và lựa chọn nhớ theo khoá); bài ngắn vẫn một trang.
- **G2.** Thanh dính `‹ n/N · tên mục ▾ ›` đi qua các mục rồi nối sang Luyện tập; mỗi lần chỉ một mục.
- **G3.** Thanh đáy chỉ có một nút chính: giữa bài là "Tiếp"; ở bước cuối mới là "Sang bài tiếp theo".
