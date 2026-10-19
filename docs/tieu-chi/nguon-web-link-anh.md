# Tiêu chí: link nguồn và ảnh minh hoạ từ nguồn internet

Bản mẫu: `docs/mockup/nguon-web-link-anh.html` (chờ duyệt). Áp cho bài giảng tạo từ mô tả chủ đề có bật "Tìm thêm nguồn trên internet" (`sourceKind = "topic_web"`).

Yêu cầu của người dùng (2026-10-19): ở slide Nguồn tham khảo cần link đến từng nguồn; nếu nguồn có ảnh minh hoạ cho nội dung thì lấy ảnh đó vào bài giảng.

## Link nguồn

- **W1.** *Given* bài có nguồn internet, *when* tạo slide, *then* slide "Nguồn tham khảo" liệt kê từng trang: dòng chính là "[n] Tên trang", dòng phụ là địa chỉ rút gọn (tên miền và đường dẫn, cắt bớt khi dài).
- **W2.** Mỗi dòng là link bấm được, mở trang nguồn trong thẻ mới (`target="_blank"`, `rel="noopener noreferrer"`), ở trình sửa, khi trình chiếu, ở màn của học viên và ở trang chia sẻ chỉ đọc.
- **W3.** Bản PDF tải từ trang chia sẻ in đủ địa chỉ để người đọc gõ lại được.
- **W4.** Chỉ nhận địa chỉ `http` hoặc `https`; địa chỉ khác không thành link.
- **W5.** Giảng viên sửa được tên trang và xoá dòng như mọi slide Tóm tắt; địa chỉ giữ nguyên theo dòng.

## Ảnh minh hoạ từ nguồn

- **W6.** Khi tìm nguồn, hệ thống lấy luôn danh sách ảnh trong phần chữ của từng trang (kèm chữ thay thế của ảnh), nên mỗi ảnh gắn với đúng trang chứa nó.
- **W7.** Loại ảnh không phù hợp: không phải `http(s)`, SVG, GIF, biểu tượng, logo, ảnh đại diện, quảng cáo, ảnh nhỏ hơn 400 px chiều ngang, ảnh không tải được. Mỗi trang lấy tối đa 3 ảnh, cả bài tối đa 8 ảnh ứng viên.
- **W8.** *Given* có ảnh ứng viên, *when* tạo slide, *then* mỗi slide bố cục "Chữ và hình" nhận ảnh hợp nhất theo mức trùng từ giữa chữ thay thế của ảnh và tiêu đề, ý chính của slide; mỗi ảnh dùng cho tối đa một slide; slide không có ảnh hợp thì giữ hình minh hoạ tự vẽ như hiện nay. Không đặt ảnh lên bìa và bìa phần.
- **W9.** Ảnh được tải về qua đường lấy ảnh an toàn hiện có (`safeFetchImage`: chặn địa chỉ nội bộ, giới hạn dung lượng) và lưu như ảnh tải lên (`saveSlideImage`: bỏ EXIF, tạo bản 480 và 960), để bài giảng không hỏng khi trang gốc đổi hay xoá ảnh.
- **W10.** Mỗi ảnh có dòng ghi nguồn dưới ô hình: "Nguồn ảnh: Tên trang (tên miền)", là link mở trang nguồn ở thẻ mới (`imageCredit`, `imageSourceUrl`). Slide Nguồn tham khảo không ghi thêm gì về ảnh (người dùng bỏ dòng này, 2026-10-19).
- **W11.** Giảng viên đổi hoặc bỏ ảnh ở ô hình như ảnh tự chọn (bộ chọn hình hiện có).
- **W12.** Trang dàn ý và trình sửa nhắc thêm: "Ảnh lấy từ các trang nguồn; thầy/cô kiểm tra quyền sử dụng trước khi chia sẻ công khai."
- **W13.** Tải ảnh lỗi hay hết dung lượng không làm hỏng việc tạo slide: slide đó giữ hình tự vẽ; sự kiện ghi số ảnh đã gắn.

## Sự kiện, thử nghiệm

- **W14.** `live.deck.slides_generated` thêm `webImageCount` (số ảnh nguồn đã gắn).
- **W15.** Test thuần: trích ảnh từ chữ dạng markdown của trang, lọc ảnh, chọn ảnh cho slide theo mức trùng từ, dòng ghi nguồn, dòng link của slide Nguồn tham khảo. Thử trên localhost bằng dịch vụ tìm kiếm giả.
