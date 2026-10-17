# Tiêu chí nghiệm thu: bài giảng tương tác từ tài liệu — nhóm G và H

Bổ sung cho nhóm A đến F (sinh dàn ý, sinh slide, hạn mức Free, trang học viên, xuất Excel, đo lường).
Bản mẫu giao diện: `docs/mockup/slide-layouts.html`. Trạng thái: **chờ duyệt**, chưa viết mã.

## Luồng ba bước: tài liệu gốc, dàn ý, slide cuối

Bước chốt dàn ý là bắt buộc (đã nằm trong nhóm A và B), không bỏ qua được.

| # | Tiêu chí |
|---|---|
| L1 | Sau khi tải tài liệu và chọn thời lượng, hệ thống chỉ sinh **dàn ý** trước. Chưa sinh slide hoàn chỉnh, nên chưa tốn công sinh nội dung chi tiết. |
| L2 | Mỗi dòng của dàn ý là một slide, gồm: tiêu đề, ý chính (một đến ba câu ngắn), bố cục (G1) và loại slide (nội dung hoặc tương tác: quiz, poll, word cloud). |
| L3 | Ở bước dàn ý, giảng viên sửa tiêu đề và ý chính, đổi bố cục hoặc loại slide, thêm, xoá, kéo đổi thứ tự. Số slide hiện cạnh thời lượng đã chọn để biết bài có hợp thời lượng không (15 phút 8 đến 10 slide, 30 phút 14 đến 18, 45 phút 20 đến 25). |
| L4 | Nút "Tạo slide" chỉ bật khi giảng viên đã xem dàn ý và bấm xác nhận. Không có đường tắt tự sinh slide từ tài liệu. |
| L5 | Chỉ khi xác nhận, hệ thống mới sinh slide cuối theo đúng dàn ý đã chốt: số slide, thứ tự, bố cục và loại slide không bị AI đổi. Ghi chú giảng sinh ở bước này. |
| L6 | Xong bước ba, bài ở trạng thái nháp (H1). Giảng viên muốn đổi cấu trúc lớn thì quay lại dàn ý để sinh lại. Slide đã sửa tay giữ nguyên, chỉ slide chưa sửa được sinh lại. |
| L7 | Sửa dàn ý bằng tay không gọi AI, không tốn token và không chờ. Token chỉ bị trừ một lần, khi bấm "Tạo slide". Trước khi bấm, hệ thống hiện số token dự kiến cho cả bài. |

## G. Giao diện slide

| # | Tiêu chí |
|---|---|
| G1 | Có 9 bố cục nội dung (bìa, tiêu đề mục, chữ và ảnh, ba thẻ, so sánh hai cột, các bước, số liệu, trích dẫn, tóm tắt) cùng các slide tương tác (quiz, poll, word cloud), và 3 giao diện (Limio sáng, Đêm xanh, Giấy ấm). Khi sinh dàn ý, AI gán một bố cục cho mỗi slide; giảng viên đổi được. |
| G2 | Slide không có đầu trang, chân trang, nhãn hay chip trang trí. Chỉ có nội dung. |
| G3 | Tiêu đề to và nổi bật: cỡ chữ tiêu đề từ 58 px trở lên trên khung 1280×720. |
| G4 | Mọi chữ trên slide từ 26 px trở lên trên khung 1280×720 (tương đương 39 px trên màn 1920×1080), kể cả sau khi giảng viên sửa. |
| G5 | Font không chân, hỗ trợ đủ dấu tiếng Việt (Be Vietnam Pro, Lexend), nhúng sẵn trong ứng dụng, không phụ thuộc mạng lúc chiếu. Giãn dòng tiêu đề từ 1,2 để dấu chồng không bị cắt. |
| G6 | Không có emoji trên slide. AI sinh nội dung không có emoji; chữ giảng viên nhập tay có emoji thì hiện nhắc nhẹ và không chặn. Biểu tượng dùng hình vẽ SVG. |
| G7 | Văn phong khoa học, câu đầy đủ chủ ngữ và vị ngữ, không viết cụt (kể cả tiêu đề, mô tả thẻ, các bước). AI không bịa số liệu: số nêu trên slide phải có trong tài liệu gốc, nếu không thì dùng cấu trúc hoặc để trống. Kiểm tra bằng bộ 20 slide mẫu do giáo viên duyệt, đạt từ 90% thì qua. |
| G8 | Tương phản chữ thường từ 4,5:1 ở cả 3 giao diện, kiểm tự động trong bộ test. |
| G9 | Hiệu ứng nhẹ: dưới 1,5 giây, chỉ lúc slide hiện ra. Tắt được ở thanh điều khiển, và tự tắt khi máy bật "giảm chuyển động". |
| G10 | Không slide nào tràn khung ở mọi tổ hợp bố cục × giao diện, kiểm tự động bằng số đo vị trí. |
| G11 | Mỗi slide có ghi chú giảng: ô "Note" và khung ghi chú ở chế độ presenter đã có sẵn trong Limio-Live (khoá `presenterNote`), bản này chỉ thêm việc AI sinh 2 đến 4 câu cho mỗi slide. Ghi chú chỉ hiện ở cửa sổ giảng viên; đường dữ liệu của học viên không trả ghi chú. |
| G12 | Đổi giao diện cho cả bài một lần, không đổi nội dung. |

## H. Chỉnh sửa sau khi sinh (bản đầu: sửa tay và nhờ AI sửa một slide)

| # | Tiêu chí |
|---|---|
| H1 | Bài sinh xong mở ở trạng thái nháp trong trình soạn Limio-Live; học viên chưa thấy gì cho đến khi giảng viên trình chiếu. |
| H2 | Slide lưu theo trường có cấu trúc (tiêu đề, ý chính, thẻ, đáp án, ghi chú). Sửa chữ không làm đổi hình thức. Đổi bố cục giữ nguyên nội dung; trường bố cục mới không dùng được thì giữ ẩn và hiện lại khi quay về bố cục cũ. |
| H3 | Định dạng trong dòng chỉ có in đậm và in nghiêng. Chưa có màu nhấn. Không cho chọn tuỳ ý cỡ chữ, font, màu. |
| H4 | Chữ dài quá khung thì tự thu nhỏ nhưng không dưới 26 px. Vẫn không vừa thì cảnh báo "Slide này dài" kèm nút "Tách thành hai slide"; slide thứ hai giữ tiêu đề kèm "(tiếp)". |
| H5 | Thêm, xoá, đổi thứ tự, ẩn slide; thêm slide mới thì chọn bố cục. |
| H6 | Slide tương tác sửa được câu hỏi, đáp án và đáp án đúng như trình soạn hiện nay. |
| H7 | Sửa được ghi chú giảng của từng slide. |
| H8 | Nhờ AI sửa một slide qua các nút "Viết ngắn hơn", "Thêm ví dụ", "Dễ hiểu hơn", "Đổi thành câu hỏi quiz". AI chỉ đụng slide đó, hiện bản xem trước so cũ với mới, giảng viên chấp nhận hoặc bỏ. Trừ vào ví token AI; hết hạn mức thì báo rõ và sửa tay vẫn dùng được. |
| H9 | Quy tắc văn phong G7 và không emoji G6 áp dụng cả cho nội dung AI sửa. |
| H10 | Slide đã sửa tay được đánh dấu. AI sinh lại slide đó chỉ đề xuất bên cạnh bản hiện tại, chỉ thay khi giảng viên xác nhận. |
| H11 | Hoàn tác bằng lịch sử phiên bản hiện có; luôn giữ được bản sinh ban đầu. |
| H12 | Sửa câu hỏi của slide tương tác đã có kết quả buổi dạy trước thì cảnh báo; kết quả cũ giữ theo buổi cũ, không lẫn với buổi mới. |
| H13 | Tự lưu và lưu ngay bằng Ctrl hoặc Cmd + S. Mất mạng thì báo rõ, không mất chữ đang gõ. |
| H14 | Chỉ chủ bài giảng và người được cấp quyền soạn mới sửa được; học viên không có đường sửa nào. |
| H15 | Ghi sự kiện sinh bài và sự kiện AI sửa slide vào `LearningEvent`, đủ để đo tỉ lệ slide bị sửa tay sau khi sinh. |

Để sau (ngoài bản đầu): sinh lại một phần bài từ tài liệu gốc, màu nhấn trong dòng.

## Tình trạng thực hiện (cập nhật 2026-10-17, sau khi làm H11, H12, H15)

Đã làm và đã thử trên máy dev (LLM giả): toàn bộ L1–L7, G1–G12, H1–H15. Chưa thử với mô hình thật (máy dev chưa nối LLM).

Ghi chú về cách làm:
- **H11:** bảng `LiveSlideVersion`; chụp trạng thái cũ trước khi sửa tay (các lần sửa liên tiếp trong 5 phút gộp lại), trước khi nhận đề xuất AI, trước khi cập nhật theo dàn ý, trước khi khôi phục; bản "AI sinh ban đầu" luôn giữ, các bản khác giữ 30 bản gần nhất. Mục "Phiên bản" nằm ở cột Cài đặt slide bên phải.
- **H12:** cảnh báo ở trình soạn quiz, bình chọn, đám mây từ khi slide đã mở trong buổi dạy trước. Đồng thời sửa lỗi có sẵn: trang kết quả cũ đọc câu hỏi/phương án từ slide hiện tại nên sửa slide làm phiếu cũ gán sai phương án; giờ đọc từ bản chụp lúc trình chiếu, kèm ghi chú nếu slide đã đổi.
- **H15:** 6 loại sự kiện `live.*` trong `LearningEvent` (soạn dàn ý, sinh slide, AI đề xuất, nhận đề xuất, sửa tay lần đầu một slide AI sinh, khôi phục phiên bản).
