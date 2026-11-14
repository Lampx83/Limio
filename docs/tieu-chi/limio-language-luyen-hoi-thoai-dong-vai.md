# Luyện "work in pairs" với bạn ảo (khoá ngoại ngữ tự học) — Acceptance criteria

> 14/11/2026, **bản đề xuất, chờ thầy duyệt, chưa code.** Thầy chốt: khoá demo tự học, làm "cách 2" — học viên đóng một vai, vai còn lại là **bạn ảo** (audio mẫu), học viên ghi âm phần của mình và nhận phản hồi.

## Hiện trạng (đã đối chiếu mã và tài liệu)

- Câu mở (`essay`) trong Bài luyện nhúng đã có: **ghi âm trong trình duyệt** (tối đa 3 phút), chuyển giọng thành chữ (Whisper), **nhận xét bằng AI**, **bài mẫu có audio**, trừ ví token của học viên, xem thử của giảng viên không lưu gì. Chi tiết ở `bai-luyen-tra-loi-bang-giong-noi-va-bai-mau.md`.
- Unit 1 có hai loại hoạt động "work in pairs":
  1. **Hội thoại có kịch bản** — vd bài 1.3 Exercise 6B "Practise the conversations in Exercise 6A" (4 hội thoại A/B).
  2. **Hỏi và thảo luận với bạn** — vd 1.1 "Choose four questions to ask your partner", 1.2 "Is your life very busy?", 1.4 "Discuss the questions".
- Chưa có chỗ gắn audio cho từng lượt của một hội thoại, và chưa có khối "đóng vai".

## AC1 — Hội thoại đóng vai (loại 1)

- **Given** một bài luyện có khối hội thoại hai vai (A/B) với từng lượt: vai, chữ, audio mẫu của lượt đó. **When** học viên mở khối. **Then** thấy cả hội thoại và hai nút chọn vai **"Em đóng A"** / **"Em đóng B"** (mặc định A). Lượt của mình hiện nổi bật, lượt của bạn ảo hiện nhạt hơn.
- **Chạy từng lượt, theo thứ tự hội thoại.** Tới lượt bạn ảo: có nút **nghe** (nghe lại bao nhiêu lần tuỳ ý; không tự phát khi học viên chưa bấm bắt đầu). Tới lượt học viên: câu của mình hiện rõ, có nút **ghi âm** (dùng lại bộ ghi âm sẵn có: Dừng, Nghe lại, Ghi lại; tối đa 30 giây một lượt).
- Ghi xong, hệ thống chuyển giọng thành chữ và **so với câu mẫu**: hiện câu mẫu với từ đã nói đúng và từ thiếu/khác được đánh dấu (không có điểm, không phán "sai"). Học viên ghi lại tuỳ ý rồi bấm **"Lượt tiếp"**; không bắt buộc ghi mọi lượt (có "Bỏ qua lượt này").
- **Đổi vai** bất cứ lúc nào: bắt đầu lại từ đầu hội thoại với vai kia; hai lần đóng được tính riêng.
- **Chạy cả hội thoại**: nút **"Nghe cả hội thoại"** phát lần lượt mọi lượt (hai giọng khác nhau cho A và B).

## AC2 — Nhận xét sau khi đóng vai

- Cuối hội thoại có nút **"Nhận xét bằng AI"** (một lần bấm), nhận xét **cả phần của học viên** theo ba tiêu chí Cần cải thiện/Khá/Tốt: nói đủ và đúng lượt, dùng đúng cụm trong bài, nhịp nói và lúng túng (dùng số liệu nhịp nói có sẵn). Không có số điểm.
- Dùng lại khung góp ý của câu mở: nhãn "Góp ý do AI tạo, có thể sai", trừ ví token của học viên, hết hạn mức hoặc chưa cấu hình AI thì báo rõ và **phần ghi âm, so câu mẫu vẫn dùng được**.
- Không có bước giảng viên duyệt; không vào sổ điểm.

## AC3 — Câu hỏi thảo luận (loại 2)

- Câu "hỏi bạn / thảo luận" được soạn thành câu mở có **audio của câu hỏi** (giọng bạn ảo hỏi): học viên nghe, rồi **trả lời bằng giọng nói** với chức năng có sẵn (bản chữ, góp ý AI, bài mẫu có audio).
- Câu có "follow-up" trong sách (vd "Ask follow-up questions") hiện kèm **một câu gợi ý hỏi tiếp** để học viên nói thêm; chưa có hội thoại tự do với AI (xem Ngoài phạm vi).

## AC4 — Soạn và nhập

- Trình soạn Bài luyện thêm khối **"Hội thoại đóng vai"**: danh sách lượt (vai A/B, chữ), tên hai vai, nút **"Tạo giọng đọc"** cho từng lượt (hai giọng khác nhau cho A và B) và tải audio riêng nếu muốn. Công cụ nhập khoá nhận hội thoại và tự tạo audio như audio bài mẫu.
- Audio của lượt **không** nằm trong dữ liệu công khai trước khi học viên mở khối (chỉ đường dẫn phát), bản chữ của lượt thì hiện sẵn như sách.
- Khoá Speakout: dựng 4 hội thoại ở 1.3 Exercise 6 và các câu thảo luận ở 1.1, 1.2, 1.4 theo khuôn trên; **chỉ những câu sách yêu cầu làm cặp**.

## AC5 — Quyền riêng tư, dữ liệu, sự kiện

- Bản ghi âm chỉ gửi tới dịch vụ chuyển chữ **khi học viên bấm**, có dòng báo lần đầu như câu mở.
- Mặc định **không lưu file ghi âm từng lượt** (chỉ giữ bản chữ và kết quả so khớp, để tiết kiệm dung lượng); chỉ nghe lại được ngay trong lúc làm. (Xem câu 1.)
- Mỗi lượt ghi và mỗi lần nhận xét phát sự kiện vào `LearningEvent` (`practice.roleplay.turn_recorded`, `practice.roleplay.feedback_generated`), payload chỉ id và số đếm, **không** mang chữ học viên nói; không tính là hoạt động học thêm ngoài bài luyện (theo quy ước của namespace `practice`).
- Xoá tài khoản xoá toàn bộ dữ liệu này; có trong export dữ liệu cá nhân.
- Xem thử của giảng viên: ghi âm và so khớp dùng được, **không lưu gì**, không gọi nhận xét AI.

## AC6 — Giao diện

- Dùng đúng phiếu bài tập (cùng màu nhấn, chữ, nền trắng) và bố cục 1 cột; ở 400 px nút ghi âm đủ lớn để bấm, không tràn ngang.
- Trình đọc màn hình: mỗi lượt có nhãn "Lượt n, vai A, của bạn/của bạn ảo"; nút có tên rõ.
- Cập nhật `GIAO-DIEN.md` và hướng dẫn trợ lý Lily cho khối và nhãn mới.

## Kiểm thử

- Chạy hội thoại hai chiều, đổi vai, bỏ qua lượt, ghi lại; so khớp từ (đủ/thiếu/khác, bỏ dấu câu và hoa thường).
- Ghi âm → chuyển chữ (Whisper giả): hết hạn mức, chưa cấu hình AI, quá 30 giây, từ chối micro; xem thử không lưu gì.
- Dữ liệu công khai của khối không chứa gì ngoài chữ và đường dẫn phát; sự kiện không chứa chữ nói.
- Xem trên trình duyệt ở 400 và 1280 px.

## Ngoài phạm vi (đợt này)

Hội thoại tự do với AI (AI hỏi tiếp theo câu học viên vừa nói); chấm phát âm từng âm; ghép hai học viên thật; hội thoại ba vai trở lên.

## Câu cần thầy chốt

1. **Lưu bản ghi âm từng lượt không?** Đề xuất: **không** (nhẹ, ít rủi ro riêng tư); nghe lại chỉ trong phiên. Nếu cần nghe lại sau, phải tính dung lượng vì mỗi hội thoại có 4–8 lượt.
2. **Có làm hội thoại tự do với AI ở đợt sau không?** Đề xuất: **để đợt sau**, sau khi xem học viên dùng đóng vai có kịch bản. Đây là phần đắt nhất (nghe, hiểu và trả lời theo thời gian thực) và phải có trần token.
3. **Thứ tự dựng cho Unit 1:** đề xuất 1.3 Exercise 6 (4 hội thoại) trước để thử, rồi các câu thảo luận.

## Đã làm (14/11/2026) và chỗ khác với AC

- **Dữ liệu:** không thêm loại câu mới. Hội thoại là câu `essay` có `config.roleplay` (vai, lượt, audio từng lượt) nên dùng lại ghi âm, ví token, AI nhận xét, lưu câu trả lời. Kịch bản và audio lượt xuống trình duyệt (là nội dung đề), bài mẫu và tiêu chí vẫn giấu.
- **Học viên:** chọn vai A/B, nghe vai kia (từng lượt hoặc "Nghe cả hội thoại"), ghi âm từng lượt (tối đa 30 giây, bấm "Dừng và kiểm tra" là gửi), thấy câu mẫu đánh dấu từ nghe được/thiếu và từ thừa, không điểm. Đổi vai giữ phần đã nói của vai kia; tải lại trang khôi phục đúng lượt. "Nhận xét bằng AI" dùng đường kiểm tra câu mở sẵn có, kịch bản làm bài mẫu cho AI.
- **Không lưu bản ghi âm** (đã chốt câu 1): route `POST /api/practice-sessions/{id}/roleplay/{câu}?turn=n` chỉ chuyển chữ và trả chữ. Xem thử của giảng viên dùng route chuyển chữ xem thử sẵn có (không lưu gì).
- **Sự kiện:** `exam.practice.roleplay_turn_recorded` (payload chỉ id, số lượt, thời lượng, số từ; không mang chữ nói) — tên theo quy ước `<domain>.<entity>.<verb>` của dự án thay vì `practice.roleplay.*` trong AC. Nhận xét AI dùng sự kiện sẵn có `exam.practice.feedback_generated`.
- **Soạn:** trong "Soạn bài luyện", câu Tự luận có khối "Hội thoại đóng vai (tuỳ chọn)": kịch bản "A: …/B: …", tên hai vai, "Audio lượt n" (tải lên). Khác AC: **chưa có nút "Tạo giọng đọc"** trong trình soạn vì hệ thống chưa có chức năng đó cho bài mẫu; audio tạo bằng công cụ nhập khoá (`roleplay` trong manifest, `turns[].audio`). Xoá lượt hoặc câu thì **file audio lượt chưa được dọn** khỏi kho (chỉ audio bài mẫu được dọn).
- **Speakout 1.3 Exercise 6B:** 4 hội thoại, 8 audio mẫu (giọng Samantha cho A, Daniel cho B). Hội thoại 3 dùng "Chocolate! It's good for energy." vì dữ liệu sách "good for/to use energy" không thành câu đúng; cần thầy xác nhận.
- **Chưa kiểm:** ghi âm bằng micro thật và Whisper thật trên dev (chỉ kiểm bằng test với bộ ghi âm giả, route có test, giao diện xem được ở 1.3).
