# Khoá ngoại ngữ — UX P1: phần lý thuyết gọn hơn

Nguồn: `docs/mockup/ngoai-ngu-ux.html` + đề xuất lý thuyết (gập mục phụ, mục lục phần, chế độ từng bước). Áp dụng cho bài HSK tác giả (bản gốc Limio); các khoá khác theo sau.

## E. Gập các mục phụ, mở sẵn mục chính
- **E1.** Given bài HSK tác giả, When mục có tên Việt đúng "Ngữ pháp", "Văn hoá" hoặc "Lưu ý về từ", Then dưới tiêu đề mục (vẫn hiện, vẫn có số) chỉ có dòng tóm tắt và nút "Xem chi tiết"; nội dung nằm trong phần gập.
- **E2.** Dòng tóm tắt: ngữ pháp = tiêu đề các điểm (công thức); Lưu ý về từ = các từ ở cột đầu bảng; Văn hoá = câu đầu của đoạn đầu tiên (cắt gọn). Không có gì để tóm tắt thì không hiện dòng, chỉ có nút.
- **E3.** Bấm nút mở/đóng phần gập; nút đổi nhãn "Xem chi tiết" ↔ "Thu gọn" và có `aria-expanded`. Nội dung gập vẫn nằm trong trang (tìm kiếm trên trang, chạm-để-xem pinyin, âm thanh vẫn hoạt động khi mở).
- **E4.** Hội thoại, Từ mới, Tình huống và mọi mục khác mở sẵn như cũ. Mục "Ôn ngữ pháp", "Ôn văn hoá"… của bài tổng hợp (tên khác) không đổi.

## F. Mục lục phần trong thanh bên trái (máy tính)
- **F1.** Từ `lg`, bài đang xem trong thanh bài mở rộng ra các mục có số (01, 02…); mục đang đọc được tô đậm khi cuộn; bấm một mục thì cuộn tới mục đó. Bài không có mục có số thì không hiện.

## G. Chế độ từng bước cho bài dài
- **G1.** Bài có từ 4 mục lớn trở lên tự vào chế độ từng bước (người học đổi được và lựa chọn nhớ theo khoá); bài ngắn vẫn một trang.
- **G2.** Thanh dính `‹ n/N · tên mục ▾ ›` đi qua các mục rồi nối sang Luyện tập; mỗi lần chỉ một mục.
- **G3.** Thanh đáy chỉ có một nút chính: giữa bài là "Tiếp"; ở bước cuối mới là "Sang bài tiếp theo".
