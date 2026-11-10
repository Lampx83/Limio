# Đoạn văn: xoá ảnh/audio, ảnh vừa khung, transcript — Acceptance criteria

> 10/11/2026, **bản đề xuất, chờ thầy duyệt, chưa code.** Áp cho trình soạn "Đoạn văn" (`PassageEditor`, dùng trong Đề thi và trong Bài luyện) và nơi học viên xem đoạn văn (`PassageView`).

## Hiện trạng (đã đối chiếu mã)

- **Xoá:** ảnh và audio chèn vào đoạn chỉ gỡ được bằng cách bấm chọn rồi nhấn phím Delete; không có nút nào trên giao diện. Gỡ khỏi đoạn **không** xoá tệp và dòng `ExamAsset`, nên tệp mồ côi còn nằm trong kho (tính vào hạn mức dung lượng). Lõi đã có `deleteAsset` nhưng **không có route** nào gọi nó.
- **Ảnh:** trong ô soạn có `max-w-full h-auto`; ở phía học viên (`PassageView`) chỉ có `rounded border`, không giới hạn chiều cao và không căn giữa. Ảnh dọc, ảnh chụp màn hình dài có thể cao hơn cả khung đề.
- **Audio trong ô soạn:** chỉ là một thẻ chữ "🔊 mô tả", không nghe thử được.
- **Transcript:** lúc tải audio, hệ thống hỏi transcript bằng hộp thoại `window.prompt` rồi lưu vào `ExamAsset.transcript`, nhưng **không nơi nào đọc lại để hiển thị** (chỉ `clone` sao chép). Nghĩa là thầy cô nhập mà học viên không bao giờ thấy, và thầy cô cũng không sửa lại được. Nút khối audio trong tài liệu đoạn chỉ mang `src` và `alt`; đoạn văn được gửi nguyên xuống trình duyệt học viên, nên **không được để transcript trong khối này** (lộ đáp án trước giờ thi).

## AC1 — Nút xoá ảnh và audio (trình soạn)

- **Given** thầy cô đang soạn đoạn văn. **When** chọn một ảnh hoặc một khối audio. **Then** hiện thanh nhỏ ngay trên khối với nút **"Xoá"** (biểu tượng thùng rác + chữ). Bấm là gỡ khối khỏi đoạn, hoàn tác được bằng Ctrl/Cmd+Z như mọi thao tác soạn.
- Khối audio luôn hiện nút "Xoá" ngay trên thẻ (không cần chọn trước), vì thẻ không có chỗ để bấm chọn rõ ràng như ảnh. Ảnh hiện nút khi rê chuột hoặc chạm vào ảnh (trên điện thoại hiện sẵn).
- **Dọn tệp:** khi **lưu** đoạn, các ảnh/audio của đề mà không còn được đoạn văn nào của đề đó dùng thì bị xoá khỏi kho và bảng `ExamAsset`. Không xoá ngay lúc bấm "Xoá", để bấm nhầm rồi hoàn tác hoặc không lưu vẫn còn tệp.
- Route xoá/dọn kiểm cùng quyền sửa đề như tải lên; đề đã xuất bản (đề thường) chỉ dọn khi đề còn sửa được, đề do Bài luyện sở hữu dọn bình thường.
- Nhật ký hoạt động: không thêm sự kiện mới (đây là thao tác soạn, không phải hành vi học).

## AC2 — Ảnh vừa khung hình

- Ở phía học viên (đề thi, luyện đề, xem lại đáp án, xem thử của giảng viên) và trong ô soạn, ảnh **luôn nằm gọn trong bề rộng cột đoạn văn**, căn giữa, giữ tỉ lệ (không méo, không cắt), **cao tối đa 28rem** (ảnh dọc/dài thu nhỏ lại cho vừa, nằm trọn trong khung, không kéo giãn cột). Ảnh nhỏ hơn khung thì giữ cỡ gốc, không phóng to.
- Bấm vào ảnh mở xem **toàn cỡ** (lớp phủ, nút đóng, phím Esc), để ảnh bị thu nhỏ vẫn đọc được chữ trong ảnh. Lớp phủ không cuộn nền và không dùng trong lượt thi có khoá (đã có sẵn cơ chế khoá thao tác thì tuân theo).
- Không thêm tuỳ chọn cỡ ảnh cho thầy cô (ít lựa chọn): một quy tắc chung cho mọi ảnh.
- **Khi tải lên:** ảnh có cạnh dài hơn 2000 px được thu về 2000 px ở máy người soạn trước khi tải (JPG/WebP chất lượng 0,85; PNG giữ PNG), để nhẹ cho trang và tiết kiệm dung lượng. Ảnh nhỏ hơn không đụng tới; GIF động không đụng tới. Dán từ clipboard cũng theo quy tắc này.
- Có `alt` như hiện nay; không đổi cách nhập mô tả.

## AC3 — Soạn transcript cho audio

- **Lúc đưa audio lên** (thầy yêu cầu 10/11/2026: hộp thoại hiện nay chỉ thấy một dòng): chọn tệp xong mở một **hộp thoại riêng** gồm ô "Mô tả audio" (bắt buộc, một dòng) và ô **"Transcript (tuỳ chọn)" là vùng nhập nhiều dòng cao sẵn khoảng 12 dòng** (thấy được cả đoạn văn dài, tự cuộn khi dài hơn, kéo giãn được), đếm ký tự "x / 20.000". Có nút "Tải lên" và "Huỷ"; huỷ thì không tải gì. Trên điện thoại hộp thoại chiếm gần hết màn hình, ô nhập vẫn cao ít nhất 8 dòng. Thay luôn hộp `window.prompt` hỏi mô tả audio (cùng một hộp thoại, khỏi hỏi hai lần).
- Bỏ hộp thoại `window.prompt` hỏi transcript. Thay bằng: ngay trên thẻ audio có nút **"Transcript"** mở một ô nhập nhiều dòng (tối đa 20.000 ký tự như hiện nay); lưu cùng đoạn. Thẻ audio hiện nhãn nhỏ "Có transcript" / "Chưa có transcript".
- Sửa được bất cứ lúc nào (không còn kẹt ở lúc tải lên). Dán transcript vào, mỗi đoạn cách nhau một dòng trống; hệ thống đánh số ①②… như transcript bài nghe trong bài học (dùng lại `splitTranscriptParagraphs`).
- Nơi lưu: giữ ở `ExamAsset.transcript`, **không** đưa vào tài liệu đoạn văn (xem hiện trạng). Giao diện lấy bằng mã tệp của audio.
- Audio ngoài (đã có tệp từ trước, không có dòng `ExamAsset`) thì không có ô transcript và thẻ không hiện nhãn.

## AC4 — Transcript hiện lúc nào, hiện ra sao (học viên)

Nguyên tắc: transcript là **đáp án của câu nghe** nên chỉ riêng **thi thử có giờ** bị khoá (máy chủ quyết định, không có trong dữ liệu gửi xuống); các chế độ luyện (không tính điểm chính thức) để học viên tự mở/ẩn.

| Hoàn cảnh | Transcript |
|---|---|
| Đang làm **thi thử** (có giờ) | **Không bao giờ**: không có nút, không có trong dữ liệu gửi xuống |
| Thi thử **đã nộp**, xem lại đáp án (nếu đề cho xem lại) | Có, theo quy định xem đáp án của đề |
| **Bài luyện** trong bài học và **Luyện đề** (không giờ) | Có **ngay từ đầu, bất cứ lúc nào**: học viên tự bấm mở hoặc ẩn tuỳ ý (thầy chốt 10/11/2026), kể cả trước khi trả lời |
| Giảng viên xem thử | Luôn có |

- **Hiện ra sao:** dưới trình phát audio có dòng **"Xem transcript"** (đóng sẵn, học viên tự bấm mở, như `<details>`). Mở ra là các đoạn đánh số ①②…, chữ đủ lớn, không tràn ngang ở 400 px. Chỉ hiện khi audio có transcript và đã đến lúc được xem; không có thì không có dòng đó, không chừa khoảng trống.
- Trong Bài luyện/Luyện đề, trạng thái mở/ẩn chỉ là lựa chọn của học viên lúc đang xem (không lưu, không ghi sự kiện, không ảnh hưởng điểm).
- Audio có chính sách "chỉ nghe 1 lần" / giới hạn lượt (chỉ áp dụng ở thi thử): transcript **vẫn chỉ mở theo bảng trên**, để không biến "chỉ nghe 1 lần" thành đọc.
- Máy chủ trả transcript qua một điểm riêng kiểm quyền (đúng học viên, đúng buổi luyện/lượt thi); buổi luyện của chính học viên thì trả bất cứ lúc nào; lượt thi thử còn mở thì trả 403 dù biết mã tệp.

## AC5 — Không làm hỏng chỗ khác

- Đoạn văn cũ: ảnh vẫn hiện, audio vẫn phát; audio đã nhập transcript trước đây (đang lưu ở `ExamAsset`) tự hiện nút "Có transcript" và được hiện cho học viên theo AC4, không phải nhập lại.
- Nhân bản đề (`clone`) và nhân bản khoá vẫn sao chép transcript như hiện nay.
- Hạn mức dung lượng giảm đúng khi dọn tệp mồ côi (AC1).
- Cập nhật `GIAO-DIEN.md` và `teacherAssistantGuide.ts` (nút "Xoá", "Transcript", cách dán transcript; chạy `teacherAssistantFreshness.test.ts`), theo CLAUDE.md §4.9.

## Kiểm thử

- Hộp thoại tải audio: ô transcript là vùng nhiều dòng (≥ 8 dòng), mô tả bắt buộc, huỷ thì không gọi tải lên, đếm ký tự; nút "Transcript" trên thẻ dùng lại đúng ô đó.
- Xoá: nút gỡ khối; hoàn tác; lưu thì tệp không còn dùng bị xoá, tệp còn dùng ở đoạn khác giữ nguyên; người không có quyền bị từ chối.
- Ảnh: lớp CSS/thuộc tính vừa khung ở `PassageView` và ô soạn; hàm thu ảnh (ảnh lớn thu, ảnh nhỏ giữ, GIF giữ); lớp phủ xem toàn cỡ.
- Transcript: lưu/sửa/xoá trắng; điểm lấy transcript theo từng hoàn cảnh trong bảng AC4 (đặc biệt: lượt thi còn mở trả 403; buổi luyện trả ngay, không cần "Kiểm tra"); `PassageView` không nhận transcript trong dữ liệu khi chưa được xem.
- Xem trên trình duyệt ở 400, 800, 1280 px.

## Ngoài phạm vi

Nghe thử audio trong ô soạn; transcript cho video; tự sinh transcript bằng AI (có thể là bước sau, cần quyết định nhà cung cấp và hạn mức token); thêm tuỳ chọn cỡ/căn lề cho từng ảnh.

## Câu cần thầy chốt

1. ~~Luyện đề: khi nào mở transcript~~ — **đã chốt 10/11/2026:** Bài luyện/Luyện đề cho học viên tự mở hoặc ẩn bất cứ lúc nào.
2. Thi thử đã nộp: transcript theo quy định xem đáp án của đề (đề xuất) hay **luôn mở sau khi nộp**?
3. Ảnh bị thu nhỏ: giữ **bấm để xem toàn cỡ** (đề xuất) hay không cần?
4. Thu ảnh khi tải lên (cạnh dài 2000 px): đồng ý hay giữ nguyên ảnh gốc?
