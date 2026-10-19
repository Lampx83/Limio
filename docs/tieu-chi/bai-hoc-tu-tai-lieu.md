# Tiêu chí nghiệm thu: bài học văn bản từ tài liệu (AI) — dàn ý trước, sửa không hỏng định dạng

Thay cho ô "Văn bản — AI hỗ trợ" hiện nay. Học theo luồng bài giảng tương tác (`bai-giang-tuong-tac-G-H.md`): tài liệu, dàn ý, chốt, rồi mới tạo bài.
Bản mẫu giao diện: `docs/mockup/bai-hoc-bo-cuc.html`. Trạng thái: mốc 1–3 đã commit; mốc 4 đã code (2026-10-17), chưa commit. Chuyển bài AI cũ hàng loạt: `pnpm --filter @feedbackme/web exec tsx scripts/convert-legacy-ai-lessons.ts` (chạy thử), thêm `--apply` để chuyển thật. Mẫu màn dàn ý: `docs/mockup/bai-hoc-dan-y.html` (đã chốt).

Quyết định đã chốt (2026-10-17): mỗi lần tạo bài, giảng viên chọn AI giữ nguyên lời hay được biên tập câu (1c); tài liệu dài thì dàn ý gợi ý tách thành nhiều bài học, giảng viên quyết (2b); luồng mới thay ô "Văn bản — AI hỗ trợ" (3a); bài đã định dạng bằng AI trước đây được tự chuyển sang dạng mới, bản cũ giữ trong lịch sử (4a).

## Vấn đề cần giải quyết

Hiện nay AI viết luôn màu sắc, viền, cỡ chữ vào từng đoạn văn. Trình soạn thảo không hiểu các khối "Mục tiêu học tập", "Hộp lưu ý", "Tổng kết", nên mở ra là mất. Vì vậy bài đã định dạng bằng AI đang bị khoá: chỉ xem được, muốn sửa một chữ cũng phải chạy AI lại cả bài. Bài cũng không có lịch sử, bấm "Áp dụng và lưu" là mất bản trước.

Cách giải quyết: **tách nội dung khỏi trang trí.** Bài chỉ lưu chữ và loại khối (đây là Mục tiêu, đây là Hộp lưu ý). Màu sắc và kiểu chữ do bảng màu, kiểu chữ của bài quyết định; cách sắp xếp mỗi mục do bố cục của mục đó quyết định. Trình soạn thảo hiểu các khối này, nên sửa tay thoải mái mà hình thức không đổi.

## Mốc 1. Khối, bố cục, bảng màu và trình soạn thảo (K)

| # | Tiêu chí |
|---|---|
| K1 | Có các khối: Mục tiêu học tập, Tổng kết, Hộp lưu ý, Hộp ví dụ, Hộp định nghĩa, Trích dẫn, Bảng, Ảnh có chú thích (chú thích ghi cả nguồn ảnh). Tiêu đề mục có hai cấp: mục lớn và mục con. |
| K2 | **Bố cục cho từng mục** (7 loại): Văn bản (mặc định), Chữ và ảnh, Thẻ khái niệm (2 đến 4 thẻ), So sánh hai cột, Các bước (đánh số theo trình tự), Hỏi và đáp (bấm câu hỏi để mở câu trả lời), Số liệu nổi bật (2 đến 4 con số lớn kèm chú thích, chỉ dùng khi số có trong tài liệu). Trên điện thoại, mọi bố cục nhiều cột tự xếp thành một cột. |
| K3 | Đổi bố cục của một mục giữ nguyên chữ: từng phần của mục (tiêu đề nhỏ và nội dung) chuyển sang bố cục mới. Phần nào bố cục mới không sắp được (ví dụ ảnh khi chuyển sang Thẻ) vẫn hiện, xếp toàn chiều ngang của mục; không phần nào bị ẩn hay bị xoá. *(Khi code đổi từ "giữ ẩn" sang "vẫn hiện" vì đơn giản và an toàn hơn — không có chữ nào bị giấu khỏi học viên.)* |
| K4 | **Bảng màu cho cả bài** (6 loại): Xanh Limio, Giấy ấm, Rừng thông, Hoàng hôn, Sinh động (mỗi mục lớn một màu), Trang nhã (đơn sắc, hợp để in). **Kiểu chữ cho cả bài** (3 loại): Hiện đại, Dễ đọc, Học thuật (tiêu đề có chân). Mọi kiểu chữ đều đủ dấu tiếng Việt và được nhúng sẵn. Đổi bảng màu hay kiểu chữ có hiệu lực ngay, không gọi AI, không tốn token, không đổi chữ. |
| K5 | Trình soạn thảo có nút "Chèn khối" để thêm khối ở K1 và mục mới với bố cục ở K2. Gõ, sửa, xoá chữ trong khối, kéo khối hoặc mục lên xuống, xoá khối đều không làm hỏng hình thức của khối đó hay khối khác. |
| K6 | Trong trình soạn thảo, bài trông giống hệt như học viên sẽ thấy (cùng màu, cùng kiểu khối). Không có màn xem mã HTML. |
| K7 | Học viên xem bài trên điện thoại không bị tràn ngang; bảng dài thì cuộn ngang trong khung bảng. Chữ đủ tương phản (từ 4,5:1) ở cả 6 bảng màu, cả chế độ sáng lẫn tối, kiểm tự động trong bộ test. |
| K8 | Dán từ Word vào trình soạn thảo vẫn được làm sạch như hiện nay. Chức năng in đậm, nghiêng, gạch chân, liên kết, màu chữ, tô nền hiện có vẫn giữ. |
| K9 | Ghi chú và đánh dấu của học viên trên bài không bị mất khi giảng viên sửa đoạn khác. Ghi chú nằm đúng ở đoạn bị sửa thì được giữ lại nếu còn tìm thấy đoạn chữ đó, nếu không thì hiện ở mục "ghi chú không còn vị trí" như hiện nay. |
| K10 | Ô "Richtext editor" (soạn tay từ đầu) dùng chung trình soạn thảo này, nên cũng chèn được khối, chọn bố cục, bảng màu và kiểu chữ. |

## Mốc 2. Tài liệu và dàn ý (D)

| # | Tiêu chí |
|---|---|
| D1 | Lối vào là ô "Văn bản — AI hỗ trợ" trong danh sách hoạt động, dẫn vào luồng mới. Nhận file Word, PDF, .txt, .md (tối đa 10 MB) hoặc dán văn bản (tối đa khoảng 40 trang). |
| D2 | Ảnh trong file Word được giữ lại và đưa vào bài đúng chỗ tương ứng. PDF chỉ lấy được chữ; nếu PDF có ảnh thì báo rõ "ảnh trong PDF chưa lấy được". PDF dạng ảnh chụp (không có chữ) thì báo không đọc được, gợi ý dán văn bản. |
| D3 | Sau khi tải lên, hệ thống chỉ sinh **dàn ý**, chưa viết bài. Dàn ý gồm: tên bài, mục tiêu học tập (3 đến 5 ý), các mục kèm ý chính, và các đoạn tài liệu thuộc từng mục. Cách trình bày từng mục do AI tự chọn trong bốn loại (Văn bản, Chữ và ảnh, Các bước, Hỏi và đáp): mục có ảnh luôn là Chữ và ảnh, mục là quy trình theo thứ tự là Các bước, mục gồm câu hỏi và câu trả lời là Hỏi và đáp, còn lại là Văn bản. Hộp Lưu ý, Ví dụ, Định nghĩa chỉ có khi tài liệu có sẵn đoạn tương ứng. Giảng viên **không** phải chọn bố cục hay hộp ở dàn ý; muốn đổi thì đổi trong trình soạn thảo sau khi áp dụng (K2, K3). Bảng màu và kiểu chữ vẫn chọn ở bước này. *(Đổi 2026-10-18: bản đầu cho chọn 7 bố cục và bật tắt hộp ở từng mục; giảng viên góp ý là đẹp nhưng nhiều việc.)* |
| D3a | Trước khi lập dàn ý, giảng viên chọn **một mẫu bài** cho cả bài, mặc định Bài lý thuyết. **Bài lý thuyết**: Mục tiêu, các mục nội dung theo mạch tài liệu, Tổng kết. **Bài hướng dẫn thực hành**: Mục tiêu, Chuẩn bị, Các bước thực hiện, Lỗi thường gặp, Tổng kết. **Bài ôn tập**: Ý chính cần nhớ, Câu hỏi thường gặp, Tự kiểm tra. AI chỉ bỏ một mục của khung khi tài liệu không có nội dung cho mục đó, và không thêm nội dung ngoài tài liệu để lấp khung. Ở màn Dàn ý có dòng "Mẫu bài: …" kèm nút Đổi mẫu; đổi mẫu thì AI lập lại dàn ý từ chính tài liệu đã tải (không phải tải lại), sau khi báo trước rằng dàn ý đang sửa sẽ bị thay. Lập lại không được thì dàn ý cũ vẫn giữ nguyên. |
| D4 | Mỗi mục trong dàn ý ghi rõ lấy từ đoạn nào của tài liệu; bấm vào xem được đoạn gốc. Đoạn nào của tài liệu không thuộc mục nào thì dàn ý cảnh báo "đoạn này đang bị bỏ ra ngoài", giảng viên gán vào một mục hoặc chủ động bỏ. |
| D5 | Tài liệu dài (nhiều hơn 5 mục lớn, hoặc ước lượng đọc quá 20 phút) thì dàn ý gợi ý tách thành nhiều bài học. Giảng viên gộp lại, tách thêm, hoặc chuyển mục từ bài này sang bài kia. Mỗi bài có mục tiêu và tổng kết riêng. |
| D6 | Giảng viên sửa tên bài, mục tiêu, tiêu đề và ý chính của từng mục, thêm, xoá, kéo đổi thứ tự mục. Sửa dàn ý không gọi AI, không tốn token, tự lưu. Rời trang rồi quay lại vẫn còn dàn ý. |
| D7 | Nút "Tạo bài" chỉ bật khi giảng viên đã tích "Tôi đã xem dàn ý" và bấm Chốt. Sửa dàn ý sau khi chốt thì phải chốt lại. Không có đường tắt tự tạo bài từ tài liệu. |

## Mốc 3. Tạo bài từ dàn ý (T)

| # | Tiêu chí |
|---|---|
| T1 | Trước khi bấm "Tạo bài", giảng viên chọn một trong hai cách viết. **Giữ nguyên lời** (mặc định): giữ câu chữ của tài liệu, chỉ sửa lỗi chính tả và dấu câu, chia đoạn, đặt tiêu đề mục, đưa đoạn phù hợp vào khối. **Biên tập cho mạch lạc**: được viết lại câu lủng củng, thêm câu dẫn, lược phần lặp. Cả hai cách đều không đổi ý nghĩa, số liệu, thuật ngữ, tên riêng, trích dẫn, và không đưa kiến thức ngoài tài liệu. |
| T2 | Có ô "Tự thêm Mục tiêu học tập và Tổng kết" như hiện nay. Mục tiêu dùng động từ hành động cụ thể (phân biệt được, áp dụng được), không dùng "hiểu", "biết" chung chung. |
| T3 | Bài tạo ra đúng theo dàn ý đã chốt: đúng số bài, số mục, thứ tự mục, tên mục và bố cục từng mục. AI không tự thêm hay bỏ mục, không tự đổi bố cục. |
| T4 | Trước khi bấm, hệ thống hiện số token dự kiến. Token chỉ bị trừ một lần khi tạo bài, trừ vào ví token AI. Hết hạn mức thì báo rõ, và vẫn soạn tay được. |
| T5 | Khi tạo, có thanh tiến độ theo từng mục. Một mục bị lỗi thì mục đó dùng nguyên đoạn gốc của tài liệu (kèm cảnh báo), các mục khác vẫn tạo được. Không bao giờ ra bài trắng. |
| T6 | Với cách "Giữ nguyên lời", xong bài hệ thống so với tài liệu và liệt kê đoạn nào của tài liệu không thấy trong bài (nếu có), để giảng viên kiểm. |
| T7 | Xong thì giảng viên xem trước rồi bấm "Áp dụng". Bài đầu tiên vào đúng bài học đang mở; nếu dàn ý tách nhiều bài thì các bài sau thành bài học mới ngay sau, cùng chương, ở trạng thái ẩn với học viên cho đến khi giảng viên bật hiện. |
| T8 | Bài học mới tạo ra đi qua đúng đường tạo bài học thông thường, nên khoá học bật cá nhân hoá vẫn tự sinh chủ đề cho bài như hiện nay. |
| T9 | Văn phong khoa học, câu đầy đủ, không câu cụt, không emoji. |

## Mốc 4. Sửa sau khi tạo, lịch sử, chuyển bài cũ (S)

| # | Tiêu chí |
|---|---|
| S1 | Sửa tay trực tiếp trong trình soạn thảo ở mốc 1. Bài đã tạo bằng AI không còn bị khoá. |
| S2 | Nhờ AI sửa **một mục**: "Viết ngắn hơn", "Dễ hiểu hơn", "Thêm ví dụ", "Sửa chính tả". AI chỉ đụng mục đó, hiện bản cũ và bản mới cạnh nhau, giảng viên chấp nhận hoặc bỏ. Ví dụ do AI thêm nằm trong Hộp ví dụ để dễ nhận ra và kiểm. Trừ vào ví token AI. |
| S3 | Mỗi bài có lịch sử phiên bản: bản AI tạo ban đầu, bản trước mỗi lần AI sửa, bản trước mỗi lần khôi phục, và bản sửa tay (các lần sửa trong 5 phút gộp làm một). Giữ tối đa 30 bản, luôn giữ bản AI tạo ban đầu. Khôi phục bản nào cũng lưu bản hiện tại trước đã. |
| S4 | Muốn đổi cấu trúc lớn, giảng viên bấm "Làm lại từ dàn ý": dàn ý cũ (hoặc dàn ý dựng từ bài hiện tại) mở ra để sửa và chốt lại. Bài hiện tại được lưu vào lịch sử trước khi thay. |
| S5 | Bài đã định dạng bằng AI trước đây được tự chuyển sang dạng mới: nhận ra tiêu đề mục, Mục tiêu, Tổng kết, Hộp lưu ý, bảng, ảnh. Bốn giao diện cũ đổi sang bảng màu và kiểu chữ gần nhất: Sinh động thành Sinh động + Hiện đại, Sạch sẽ thành Xanh Limio + Hiện đại, Học thuật thành Trang nhã + Học thuật, Hiện đại thành Hoàng hôn + Hiện đại. Mọi mục nhận bố cục Văn bản. Bản cũ lưu trong lịch sử. Bài nào chuyển mà mất chữ hoặc mất ảnh thì để nguyên và báo cho giảng viên, không chuyển nửa vời. Trước khi chạy thật có báo cáo chạy thử: bao nhiêu bài chuyển được, bao nhiêu để nguyên. |
| S6 | Chỉ người có quyền sửa khoá học mới tạo, sửa, khôi phục được. Tài liệu gốc không hiện cho học viên. |
| S7 | Ghi sự kiện tạo bài, AI sửa mục và khôi phục phiên bản vào `LearningEvent`, đủ để đo tỉ lệ bài bị sửa tay sau khi AI tạo. |

Để sau (ngoài bản đầu): lấy ảnh trong PDF, câu hỏi tự kiểm tra cuối mục, nhờ AI sửa một đoạn bất kỳ (thay vì cả mục).
