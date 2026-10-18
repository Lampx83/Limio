# Tiêu chí: dàn ý theo mạch cấu trúc, nút xoá trên dòng, slide bìa phần

Bản mẫu đã duyệt: `docs/mockup/dan-y-mach-cau-truc.html` (2026-10-18). Dàn ý vẫn là danh sách dọc; hộp Sửa giữ nguyên.

## Mô hình

- **S1.** Dàn ý có danh sách phần (`parts`). Mỗi slide thuộc đúng một phần (`partId`); các slide của một phần luôn liền nhau. Lưu trong cột JSON `LiveDeck.outline`, không cần migration.
- **S2.** Sáu vai trò phần: Bìa, Mục tiêu, Mục lục, Hook, Nội dung (có tên riêng, có thể nhiều phần), Tổng kết.
- **S3.** Dàn ý cũ chưa có phần được tự chia khi mở: slide Bìa đầu bài vào Bìa; mỗi slide "Mở phần" mở một phần Nội dung mang tên slide đó; slide Tóm tắt cuối vào Tổng kết; phần còn lại vào một phần Nội dung.
- **S4.** Slide Mục lục luôn có các ý bằng đúng tên các phần Nội dung theo thứ tự; giảng viên không nhập tay.
- **S5.** Slide mở phần (slide đầu của một phần Nội dung, bố cục Mở phần) có tiêu đề bằng tên phần; sửa tên ở chỗ nào thì chỗ kia đổi theo.

## AI lập dàn ý

- **S6.** Buổi từ 30 phút: Bìa, Mục tiêu (2–4 mục tiêu "Người học …"), Mục lục, Hook (1–2 slide, không bịa giai thoại hay số liệu), 2–4 phần Nội dung (mỗi phần mở bằng slide Mở phần), Tổng kết đi lại các mục tiêu.
- **S7.** Buổi 15 phút: Bìa (kèm mục tiêu chính), Hook, 2–3 phần Nội dung không có slide Mở phần, Tổng kết; không có Mục tiêu và Mục lục riêng.
- **S8.** Không tin đầu ra mô hình: vai trò lạ, phần đứt đoạn, thiếu slide mở phần (buổi ≥ 30 phút, còn chỗ trong mức slide) đều được sửa ở `normalizeOutline`.

## Giao diện dàn ý

- **S9.** Danh sách chia nhóm: mỗi phần có dòng tiêu đề (tên phần, khoảng slide, số slide) và chấm trên một đường dọc nối các phần.
- **S10.** Kéo thả: thả lên một slide thì slide được kéo đứng cạnh slide đó và thuộc phần của nó; thả lên tên phần thì thành slide đầu của phần; thả lên dòng "Thêm slide vào phần này" thì thành slide cuối của phần. Phần hết slide thì biến mất.
- **S11.** Đổi tên phần Nội dung ngay trên dòng tiêu đề (Enter lưu, Esc huỷ). Thêm slide vào một phần; thêm phần Nội dung mới (đứng trước Tổng kết, có slide Mở phần nếu buổi ≥ 30 phút).
- **S12.** Nút xoá trên từng dòng (hiện khi rê chuột hoặc dùng bàn phím, luôn hiện trên màn cảm ứng): xoá ngay, thông báo có nút Hoàn tác trong 6 giây. Không xoá được slide cuối cùng.

## Slide bìa phần

- **S13.** Khi tạo slide, slide mở phần nhận số phần, mục lục (tên các phần) và vị trí phần hiện tại do hệ thống tính, không do AI viết. Slide Mục lục nhận đúng tên các phần.
- **S14.** Bìa phần có mục lục vẽ hai cột: trái là số phần, tên phần, câu dẫn; phải là mục lục, phần đã qua có dấu hoàn thành, phần đang học nổi bật, phần sau để nhạt. Chữ ≥ 26 px trên khung 1280 × 720, không nhãn trang trí, hiệu ứng nhẹ và tắt khi bật giảm chuyển động. Slide mở phần cũ (không có mục lục) vẫn vẽ như trước.
- **S15.** Ghi chú giảng của slide mở phần có lời chuyển ý: một câu chốt phần trước (nếu có) và một câu nêu câu hỏi của phần này.
