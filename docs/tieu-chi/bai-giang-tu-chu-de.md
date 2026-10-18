# Tiêu chí: tạo bài giảng tương tác từ mô tả chủ đề

Bản mẫu: `docs/mockup/bai-giang-tu-chu-de.html`. Người dùng chọn (2026-10-18): lối vào phương án B (tab thứ ba trên trang "AI hỗ trợ soạn"), làm cả hai mức nguồn trong đợt này, dịch vụ tìm kiếm chưa chọn (adapter đầu tiên là Tavily, đổi được).

## Mô hình

- **T1.** `LiveDeck.sourceKind` (chuỗi, nullable): `"document"`, `"topic"` (kiến thức chung) hoặc `"topic_web"` (kiến thức chung kèm nguồn internet). Bài cũ để trống và được coi như `"document"`.
- **T2.** Bài từ chủ đề lưu `sourceName = "Mô tả chủ đề"`; `sourceText` là đoạn mô tả (mức 1) hoặc đoạn mô tả kèm các nguồn đã đọc, đánh số [1], [2]… (mức 2).

## Nhập chủ đề

- **T3.** *Given* giảng viên mở trang AI hỗ trợ soạn, *when* trang hiện ra, *then* có ba tab "Mô tả chủ đề", "Tải tệp lên", "Dán văn bản"; tab đầu được chọn sẵn và có một ô mô tả lớn, ba gợi ý nên viết gì (chủ đề, người học, mục tiêu) và bốn ví dụ mẫu.
- **T4.** *Given* ô mô tả trống, *when* giảng viên bấm một ví dụ, *then* ô được điền đúng chữ của ví dụ và nút "Soạn dàn ý" bật.
- **T5.** *Given* mô tả ngắn hơn 15 ký tự, *then* nút "Soạn dàn ý" tắt; máy chủ cũng trả `topic_too_short` nếu nhận được. Mô tả dài hơn 2.000 ký tự bị chặn ở ô nhập và máy chủ trả `topic_too_long`; giao diện gợi ý chuyển sang tab "Dán văn bản".
- **T6.** Không có trường bắt buộc nào ngoài ô mô tả và thời lượng (mặc định 30 phút như hiện nay).
- **T7.** *Given* quản trị viên chưa cấu hình khoá tìm kiếm web, *then* không có công tắc nguồn internet. *Given* đã cấu hình, *then* có công tắc "Tìm thêm nguồn trên internet", bật sẵn.

## AI lập dàn ý (mức 1, `topic`)

- **T8.** Câu lệnh nói rõ không có tài liệu: dùng kiến thức chung, bám đối tượng người học và mục tiêu trong mô tả; KHÔNG đưa con số cụ thể, tên nghiên cứu, tên người, câu trích dẫn hay nguồn; giữ mọi quy tắc văn phong hiện có (câu hoàn chỉnh, không emoji, tiếng Việt) và mạch cấu trúc (Bìa, Mục tiêu, Mục lục, Hook, Nội dung, Tổng kết).
- **T9.** Câu lệnh và lược đồ JSON không liệt kê bố cục "stats" và "quote".
- **T10.** *Given* mô hình vẫn trả dòng dàn ý bố cục "stats" hoặc "quote", *when* `normalizeOutline` chạy với nguồn `topic`, *then* "stats" thành "cards" và "quote" thành "image".
- **T11.** *Given* một dòng dàn ý có con số kiểu thống kê (phần trăm, năm, số có phân cách hàng nghìn, số kèm "triệu", "tỷ"…), *then* dàn ý có cảnh báo nêu số slide và con số đó để giảng viên kiểm tra.

## AI lập dàn ý (mức 2, `topic_web`)

- **T12.** *Given* công tắc bật, *when* giảng viên bấm Soạn dàn ý, *then* hệ thống tìm tối đa 5 trang, ghép phần chữ thành tài liệu nguồn đánh số, rồi gọi AI với câu lệnh cho phép kiến thức chung nhưng chỉ dùng số liệu, tên người, tên nghiên cứu và trích dẫn khi có trong các nguồn, kèm số nguồn [n].
- **T13.** *Given* dịch vụ tìm kiếm lỗi hoặc không trả trang nào, *then* bài vẫn được soạn ở mức 1 (`topic`) và giao diện dàn ý ghi rõ là không tìm được nguồn.
- **T14.** Dàn ý mức 2 có thêm dòng cuối "Nguồn tham khảo" liệt kê các trang (tên miền và tên trang), do hệ thống dựng chứ không do AI viết; giảng viên xoá được như mọi dòng.
- **T15.** *Given* dòng dàn ý có con số kiểu thống kê không có trong các nguồn, *then* dàn ý có cảnh báo như T11.

## Nhãn nguồn và lời nhắc

- **T16.** *Given* bài có `sourceKind` là `topic` hoặc `topic_web`, *when* mở trang dàn ý hoặc trình sửa slide, *then* có dòng "Nội dung do AI viết từ kiến thức chung, thầy/cô cần kiểm tra trước khi dạy." (mức 2 thêm số trang đã đọc). Lời nhắc không tắt được và không hiện trên màn chiếu.
- **T17.** Bên cạnh tiêu đề trang dàn ý, nhãn nguồn ghi "Từ mô tả chủ đề" thay cho tên tệp.
- **T18.** *Given* bài nguồn `topic`, *when* giảng viên mở hộp sửa một dòng dàn ý, *then* bộ chọn bố cục không có "Số liệu" và "Trích dẫn".

## Tạo slide

- **T19.** *Given* bài nguồn `topic` (tài liệu chỉ là đoạn mô tả, có thể ngắn), *when* bấm tạo slide, *then* slide được tạo; không còn lỗi "tài liệu quá ngắn" với bài từ chủ đề.
- **T20.** Câu lệnh viết slide theo nguồn: `topic` cấm số liệu, tên người, trích dẫn; `topic_web` chỉ cho phép khi có trong nguồn và yêu cầu ghi số nguồn vào trường `source`.
- **T21.** *Given* bài `topic` và một dòng dàn ý bố cục "stats" hoặc "quote" (dàn ý cũ hoặc sửa tay qua API), *when* tạo slide, *then* slide dùng "cards" hoặc "image".
- **T22.** *Given* bản nháp AI của một slide có con số kiểu thống kê không có trong dòng dàn ý (mức 1) hoặc không có trong nguồn và dòng dàn ý (mức 2), *then* slide đó rơi về nội dung dựng từ dàn ý và được đếm vào `fallbackCount`.
- **T23.** Mức 2: số nguồn [n] trong chữ của slide được gỡ khỏi câu và gom thành dòng "Nguồn: [1], [3]" ở chân slide (khoá meta `cite`); chỉ giữ số có trong danh sách nguồn. Dòng "Nguồn tham khảo" trong dàn ý thành slide Tóm tắt giữ đúng chữ của dàn ý, không gửi cho AI viết lại; ghi chú giảng của slide đó liệt kê đầy đủ địa chỉ.
- **T24.** "Nhờ AI sửa slide" với bài từ chủ đề dùng cùng quy tắc nguồn (T20) và cùng kiểm tra con số (T22); bản đề xuất hỏng thì báo lỗi như hiện nay.

## Sự kiện

- **T25.** `live.deck.outline_generated` có thêm `sourceKind` và, với mức 2, `webSourceCount`. Bài từ tài liệu ghi `sourceKind: "document"`.

## Thử nghiệm

- **T26.** Test thuần: câu lệnh theo ba nguồn, `normalizeOutline` với nguồn `topic`, hàm nhận diện con số kiểu thống kê, gom số nguồn, dòng Nguồn tham khảo, adapter tìm kiếm (fetch giả).
- **T27.** E2E trên localhost bằng LLM giả: một câu mô tả → dàn ý → slide, cả khi LLM giả cố tình trả "stats", "quote" và số liệu bịa.
