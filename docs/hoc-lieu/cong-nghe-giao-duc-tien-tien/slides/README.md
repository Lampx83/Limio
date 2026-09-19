# Slide trình chiếu trên lớp

Slide dạng một file HTML tự chứa (font Inter và logo nhúng sẵn, chạy được không cần mạng), gắn vào bài học bằng loại nội dung **HTML tự tải lên** (`html_block`) — trên trang bài hiện thành thẻ mở tab mới để trình chiếu toàn màn hình.

| File | Bài | Trên prod |
|---|---|---|
| `bai-1-6-mo-bai.html` | Bài 1.6 · 5 slide mở bài Chegg – Duolingo | `/api/lesson-media/html/92124105-7b60-4632-a40c-73275f0d222f-1789657792199-29f20ad7ab2474c2.html` |

Dựng lại: `node build-deck.js bai-1-6-mo-bai.html` (cần `react`, `react-dom`, `react-icons`). Kiểu chữ và màu đồng bộ với bài học: Inter, dải màu mục `SECTION_HUES` / `SECTION_TEXT_HUES` của importer.

Điều khiển: ← → chuyển slide · F toàn màn hình · slide 4 có đồng hồ đếm ngược 4 phút.

Logo lấy từ Wikimedia Commons (`Chegg logo.svg`, `Duolingo logo (2019).svg`); nhãn hiệu thuộc Chegg, Inc. và Duolingo, Inc.

**Cập nhật slide đã gắn vào bài:** tải file mới lên với TÊN MỚI (route phục vụ đặt cache 7 ngày `immutable`, ghi đè cùng tên thì người đã mở vẫn thấy bản cũ), rồi sửa `payload.url` của content item.
