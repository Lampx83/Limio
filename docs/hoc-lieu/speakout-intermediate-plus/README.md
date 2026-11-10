# Khoá demo "Speakout Intermediate Plus" — phương án đưa học liệu lên Limio

> 10/11/2026, **bản đề xuất (đã sửa theo lời thầy: dùng học liệu có bản quyền của Pearson làm demo, đang trao đổi với Pearson), chờ thầy chốt các câu ở cuối, chưa làm gì.** Chỉ bắt đầu sau khi bản deploy hiện tại chạy ổn trên môi trường đích.

## Hướng đi

Em **không soạn lại nội dung**: học liệu do thầy cung cấp (sách, audio, video, đáp án), Limio **số hoá** thành khoá học đúng cấu trúc của sách rồi dùng các tính năng Limio để cho thấy giá trị: bài nghe có transcript, luyện đề có phản hồi từng câu, thẻ ghi nhớ, đề thi thử, cá nhân hoá. Giá trị mà Pearson cần thấy là **sách của họ chạy trên Limio trông như thế nào**, nên độ trung thành với sách quan trọng hơn sáng tạo thêm.

## Bảo vệ bản quyền trong lúc làm demo

- **Không đưa học liệu của Pearson vào Git.** PDF, audio, video, ảnh gốc để ở thư mục ngoài kho mã (hoặc thư mục đã loại khỏi Git), trong repo chỉ có mã dựng và dữ liệu đã chuyển đổi cần thiết. Em sẽ kiểm trước khi commit.
- **Khoá để ở trạng thái nháp**, chỉ chủ khoá và người thầy cấp quyền thấy; người xem demo vào bằng **mã kích hoạt** (tính năng học liệu nhà xuất bản đã có).
- **Bật khoá học liệu có bản quyền** (`protected media`): ảnh, audio, video chỉ phát cho người có quyền vào khoá, không dùng đường dẫn công khai. Cờ này là chính tính năng Limio muốn trình bày với nhà xuất bản.
- Ghi rõ trong khoá nguồn và phạm vi Pearson đã đồng ý (xem câu hỏi 2), để không ai nhầm demo với bản phát hành chính thức.

## Quy trình nhập (tái sử dụng cách đã làm với khoá Tiếng Trung III)

1. **Đọc sách bằng ảnh trang** (không dùng OCR nhúng trong PDF scan, vì sai chữ), tách theo đơn vị bài và từng mục: từ vựng, ngữ pháp, bài đọc, bài nghe, nói, viết, ôn tập.
2. **Dựng khoá:** mỗi **Unit = một module**, mỗi mục của sách = một bài; số bài và thứ tự bám đúng sách.
3. **Chuyển bài tập thành Bài luyện:** đoạn văn/bài nghe thành đoạn văn của Bài luyện; từng bài tập của sách thành câu hỏi đúng dạng (chọn đáp án, Đúng/Sai/Không có thông tin, điền khuyết, ghép cặp, sắp xếp, kéo thả…); đáp án lấy từ **bộ đáp án của sách** (không tự suy ra), giải thích đáp án chỉ thêm khi sách có.
4. **Audio và transcript:** tệp audio của sách tải vào Bài luyện; **audioscript của sách** làm transcript (học viên tự mở/ẩn khi luyện). Audio quá 25 MB tách theo track hoặc nén; video tối đa 100 MB.
5. **Từ vựng thành thẻ ghi nhớ** (từ, phiên âm, nghĩa, ví dụ lấy từ sách).
6. Phần chỉ Limio có (thẻ ghi nhớ, nhãn kỹ năng, Nghe giảng) **đánh dấu rõ là do Limio thêm**, tách khỏi nguyên văn của sách.
7. Nhập vào **máy dev** trước, thầy xem, rồi mới lên máy chủ đích (nháp).

## Phạm vi đề xuất theo mốc (dừng cho thầy duyệt sau mỗi mốc)

| Mốc | Nội dung | Mục đích |
|---|---|---|
| **0** | Thầy gửi học liệu; em lập **bản kê** (có gì, thiếu gì, mỗi đơn vị bài có bao nhiêu mục/bài tập/track audio) | Biết phạm vi thật, tránh hứa quá |
| **1** | **Một Unit** nhập đủ (mọi mục, audio, transcript, đáp án) | Thầy duyệt độ trung thành và cách hiển thị |
| **2** | Các Unit còn lại thầy muốn đưa vào demo | Hoàn chỉnh khoá |
| **3** | Bài ôn/đề thi thử (nếu sách có phần Review hoặc bộ kiểm tra), khối "Đề thi" | Demo luồng ôn → thi thử |
| **4** | Mã kích hoạt, bật bảo vệ bản quyền, kiểm trên máy thật, nhập lên máy chủ đích (nháp) | Phát hành cho người xem demo |

## Việc kỹ thuật

- **Mở rộng công cụ nhập khoá** (`pnpm import:course`): hiện hỗ trợ văn bản, thẻ ghi nhớ, quiz, hội thoại, lời giảng, podcast; **chưa** hỗ trợ khối **Bài luyện** (đoạn văn có ảnh/audio/transcript + câu hỏi), **Đề thi** và tải **tệp audio** kèm transcript. Cần thêm trước mốc 1 (hoặc dựng thủ công đơn vị mẫu bằng giao diện nếu thầy muốn xem sớm).
- **Dung lượng:** audio của cả giáo trình có thể nhiều GB; cần kiểm hạn mức dung lượng và dung lượng đĩa máy chủ đích trước khi nhập.
- **Ảnh trong sách:** cắt từ trang scan hoặc dùng tệp ảnh gốc nếu Pearson cung cấp (chất lượng tốt hơn); mỗi ảnh tối đa 5 MB, ảnh lớn tự thu về 2000 px.
- Bài nói và bài viết có chấm điểm bằng AI cần khoá OpenAI thật trên máy chủ đích; nếu chưa có thì mốc đầu để các bài đó ở dạng bài thường.

## Rủi ro và giới hạn nói thẳng

- **Chất lượng nguồn quyết định chất lượng khoá:** PDF scan mờ, audio thiếu track, thiếu bộ đáp án thì phần đó không nhập được đúng; em sẽ báo trong bản kê ở mốc 0 chứ không đoán.
- Một số bài tập của sách không tự chấm được (nói tự do, viết, thảo luận nhóm); những bài này nhập dưới dạng hướng dẫn hoặc bài nộp, không có đúng/sai.
- Dạng bài đặc thù của sách (ví dụ nối nhiều cột, bài tập điền bảng) có thể phải đơn giản hoá cho vừa các dạng câu hiện có; em sẽ ghi rõ chỗ nào đã đổi.
- Phạm vi Pearson cho phép (mức chia sẻ, thời hạn, ai được xem) chưa rõ; xem câu hỏi 2.

## Câu cần thầy chốt

1. **Học liệu thầy đang có** (hoặc sẽ nhận từ Pearson) gồm những gì: Student's Book (PDF hay bản scan?), Workbook, tệp audio, video, audioscript, **bộ đáp án / Teacher's Book**? Thầy gửi tới đâu để em lập bản kê (mốc 0)? (Đừng đặt vào thư mục có Git.)
2. **Phạm vi Pearson đồng ý** cho bản demo: toàn bộ sách hay một vài Unit, ai được xem (nội bộ hay đối tác), có thời hạn hoặc yêu cầu như hình mờ tên người xem, chặn tải xuống không?
3. **Đơn vị bài đưa vào demo:** toàn bộ hay một số Unit nhất định (đề xuất làm mốc 1 bằng một Unit giàu dạng bài nhất)?
4. **Tên khoá** hiển thị: đúng tên sách, kèm ghi chú nguồn như thế nào?
5. **Ngôn ngữ giao diện hướng dẫn** của khoá: tiếng Việt cho phần Limio thêm (đề xuất), nội dung sách giữ nguyên tiếng Anh?
6. **Mở rộng công cụ nhập** (Bài luyện, Đề thi, tải audio kèm transcript) làm trước mốc 1: đồng ý không?
