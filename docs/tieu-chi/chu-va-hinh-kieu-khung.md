# Tiêu chí: kiểu trình bày và khung hình cho bố cục Chữ và hình

Bản mẫu: `docs/mockup/chu-va-hinh-bien-the.html` (người dùng duyệt 2026-10-19: sáu kiểu, bảy khung, hệ thống tự xen kẽ kiểu, khung chọn theo bài).

Vấn đề: bài giảng AI soạn có rất nhiều slide "Chữ và hình", slide nào cũng chữ trái, hình bo góc bên phải, nên bài trông đơn điệu. Việc này chỉ đổi cách trình bày; nội dung slide (tiêu đề, các ý, hình) giữ nguyên, AI không phải viết thêm gì.

## Sáu kiểu trình bày

- **K1.** Bố cục "Chữ và hình" có sáu kiểu, cùng dữ liệu tiêu đề, các ý, hình:
  - "Hình bên phải": kiểu hiện có.
  - "Hình bên trái": đảo chiều.
  - "Hình tràn nửa slide": hình sát mép phải, cao trọn slide.
  - "Hình trên, ý dưới": dải hình ngang phía trên, các ý thành cột ngang bên dưới.
  - "Hình nền, khối chữ phủ": hình phủ cả slide, chữ trên một khối nền sáng.
  - "Hình nhỏ có chú thích": chữ chiếm phần lớn, hình nhỏ kiểu ảnh rửa, kèm chú thích là chữ thay thế của hình (nếu có).
- **K2.** Kiểu lưu ở khoá meta `imageStyle` của slide; thiếu nghĩa là "Tự động". Đổi kiểu không tính là sửa tay nội dung, và được giữ khi slide được viết lại theo dàn ý (như hoa văn, kiểu bìa).
- **K3.** "Hình trên, ý dưới" và "Hình nền, khối chữ phủ" chỉ dùng khi slide có ảnh thật. Slide chưa có ảnh (đang hiện hoa văn) mà được chọn tay hai kiểu này thì vẽ như "Hình bên phải". "Hình trên, ý dưới" cần từ 2 đến 3 ý; nhiều hơn thì vẽ như "Hình bên phải".

## Tự xen kẽ

- **K4.** *Given* kiểu là "Tự động", *then* hệ thống chọn kiểu theo thứ tự của slide trong các slide Chữ và hình của bài. Slide Chữ và hình đầu tiên luôn là "Hình bên phải".
  - Có ảnh thật, xoay vòng: phải, tràn nửa, trái, hình trên, hình nền.
  - Chưa có ảnh, xoay vòng: phải, trái, tràn nửa, hình nhỏ.
  - Kiểu không hợp (K3) thì lấy kiểu kế tiếp trong vòng.
- **K5.** Chữ dài (tổng tiêu đề và các ý từ 280 ký tự) thì không dùng "Hình trên, ý dưới" và "Hình nền, khối chữ phủ"; ưu tiên "Hình nhỏ có chú thích" ở các lượt tràn nửa hoặc hình trên.
- **K6.** Hai slide Chữ và hình liền nhau trong bài (không tính slide ẩn) không cùng kiểu tự động.

## Khung hình

- **K7.** Ô hình có bảy khung: "Bo góc" (hiện có), "Tròn", "Vòm", "Lục giác", "Hình giọt", "Lá", "Khung lệch". Hình luôn được cắt giữ phần giữa, không méo.
- **K8.** Khung áp cho các kiểu có ô hình riêng: hình bên phải, hình bên trái, hình nhỏ có chú thích. Ba kiểu còn lại không có khung.
- **K9.** Cả bài dùng chung một khung, lưu ở cột `LiveDeck.imageFrame` (thêm bằng migration; trống nghĩa là "Tự động"). Tự động chọn theo hoa văn chủ đạo của bài:
  - lục giác → "Lục giác"
  - chấm, vòng, điểm nối → "Tròn"
  - cung → "Vòm"
  - sóng, dòng chảy, khói → "Hình giọt"
  - còn lại → "Bo góc"
- **K10.** Giảng viên đổi khung cho cả bài ở menu "Giao diện", mục "Khung hình" (có "Tự động"). Muốn khác cho riêng một slide thì chọn trong hộp Sửa slide; lựa chọn đó lưu ở khoá meta `imageFrame` của slide, thắng lựa chọn của bài.

## Trong trình sửa

- **K11.** Hộp Sửa slide của bố cục Chữ và hình có mục "Kiểu trình bày": "Tự động" và sáu kiểu. Kiểu không hợp với slide hiện tại (K3) vẫn chọn được nhưng có dòng nhắc lý do vẽ như "Hình bên phải".
- **K12.** Cũng trong hộp đó có mục "Khung hình" của riêng slide: "Theo bài" và bảy khung.
- **K13.** Trình chiếu, màn của học viên, trang chia sẻ, bản in PDF và ảnh thu nhỏ trong trình sửa vẽ cùng một kiểu và khung như trình sửa.

## Sự kiện, thử nghiệm, hướng dẫn

- **K14.** Đổi kiểu hoặc khung đi qua đường lưu slide và đường lưu bài hiện có. Không thêm sự kiện mới: đây là thay đổi trình bày, không phải hành vi học.
- **K15.** Test thuần:
  - `resolveImageStyle`: tự động, chọn tay, kiểu không hợp, chữ dài
  - thứ tự xoay vòng và K6
  - `resolveImageFrame`: theo slide, theo bài, tự động theo hoa văn
  - `pickMeta` giữ hai khoá mới
  - đổi kiểu không làm slide thành "đã sửa tay"
- **K16.** Cập nhật `GIAO-DIEN.md` và hướng dẫn trợ lý Limio (mục Giao diện và hộp Sửa slide).
- **K17.** Xem trên localhost ở khổ rộng và khổ hẹp: bài có nhiều slide Chữ và hình hiện đủ các kiểu xen kẽ, và đổi khung ở menu Giao diện thì cả bài đổi theo.

## Kết quả (2026-10-19, chưa commit)

- Đã làm K1–K17. Bài thử 7 slide Chữ và hình trên localhost tự xen kẽ đúng: phải, tràn nửa, trái, hình trên, hình nền; slide chưa có ảnh: trái, tràn nửa.
- Khung lục giác và khung tròn cho cả bài áp đúng. Chọn tay "Hình nhỏ có chú thích" hiện chú thích. Đổi kiểu trong hộp Sửa slide lưu ngay và không đánh dấu "đã sửa tay".
- Chữ ở kiểu tràn mép không bị co nhầm: bộ đo bỏ qua ô hình tràn mép (lớp `.edge`).
- Màn của học viên (/join) chưa có provider hoa văn, nên slide ở đó vẽ theo kiểu đã chọn tay; slide để "Tự động" thì vẽ như "Hình bên phải".

## Ngoài phạm vi

- Việc giảm số slide Chữ và hình khi AI soạn dàn ý (luật đa dạng bố cục trong câu lệnh): làm riêng sau.
