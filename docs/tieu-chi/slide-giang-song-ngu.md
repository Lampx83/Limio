# Slide giảng song ngữ Việt – Anh — tiêu chí chấp nhận

> Bản nháp 15/11/2026, **chờ duyệt, chưa viết mã.** Mở rộng khung slide tương tác `/decks/<id>` (xem `dung-nghi-loi-giang-slide.md`,
> `bai-slide-man-hinh-bia.md`) để một bài học tiếng Anh có giảng viên ảo **giảng bằng tiếng Việt và đọc ví dụ bằng giọng
> tiếng Anh**. Bài đầu tiên dùng tính năng này: **Speakout Unit 1 · 1.1 Grammar (bị động; causative have)**.

## Vì sao làm

Học viên yếu cần hai thứ cùng lúc: nghe giải thích bằng tiếng Việt và nghe mẫu bằng tiếng Anh. Lời giảng hiện chỉ có **một giọng
cho cả bài** (`VoiceRole = "lecturer"`), và cả 8 giảng viên ảo đều là giọng Việt. Giọng Việt đọc "I had my car repaired" sẽ sai
phát âm; giọng Anh đọc phần giải thích tiếng Việt thì còn tệ hơn.

Kho đã lưu giọng **theo vai** (`LessonNarration.voices`, podcast dùng vai A và B), nên thêm vai thứ hai cho lời giảng không cần
đổi cấu trúc dữ liệu.

## Đã chốt (15/11/2026)

1. Phương án **song ngữ**: giọng Việt giảng, giọng Anh đọc ví dụ. Không giảng hoàn toàn bằng tiếng Anh.
2. Bài đầu tiên là **Grammar 1.1**; Từ vựng, Đọc, Nói, Viết giữ nguyên là Bài luyện của khoá.
3. Nội dung slide **tự soạn**, không chép bài đọc hay bài tập của sách (bộ slide nằm trong Git; học liệu Pearson thì không được vào Git).

## Chưa làm trong đợt này

- Bấm vào cụm tiếng Anh trên slide để nghe lại (widget âm thanh). Tách thành đợt sau nếu thầy muốn.
- Video giảng viên ảo (miệng khớp tiếng). Bài song ngữ **không** bật video; tiếng Anh do một giảng viên người Việt "nói" sẽ lệch.
- Giọng Anh cho các bài khác ngoài khoá `/decks`; podcast song ngữ.
- Chặn `/decks/<id>` theo ghi danh (việc treo từ trước). Nội dung tự soạn nên chưa chặn trước, nhưng **phải làm trước khi bán**.

## S. Đánh dấu tiếng Anh trong lời giảng

- **S1.** *Given* một bước lời giảng `loiGiang.buoc[i]`, *when* có đoạn `[en: …]`, *then* chữ bên trong được đọc bằng **giọng Anh**,
  phần còn lại bằng giọng giảng viên. Ví dụ: `Ta nói [en: I had my car repaired], nghĩa là xe được sửa giúp mình.`
- **S2.** Thẻ `[en: …]` không lồng nhau, không chứa `]`. Dấu `[` không đóng, hoặc `[en:` rỗng, **làm lệnh dựng khoá báo lỗi** kèm
  vị trí (slide, bước), không âm thầm bỏ qua.
- **S3.** Lời giảng không có `[en: …]` cho ra **đúng kịch bản và đúng mã băm như trước** (`scriptHash`), nên 5 bài Toán 10 không bị
  coi là đổi lời và giọng cũ vẫn phát.
- **S4.** Các thẻ nhịp `[chỉ]`, `[chờ]`, `[nghĩ n]`, `[dừng]` vẫn dùng được trong cùng một bước, kể cả ngay trước hoặc sau `[en: …]`.
  Chữ sau dấu hai chấm của `[chờ]`/`[nghĩ]` vẫn hiện trên màn hình, không đọc.
- **S5.** Chỗ nào hiển thị chữ của lời giảng cho người đọc (bản ghi lời, nếu có) thì bỏ thẻ và giữ chữ tiếng Anh: `[en: I had my car repaired]` → "I had my car repaired".

## V. Tạo giọng hai vai

- **V1.** Kế hoạch đọc (`planNarration`) tách một mục lời giảng thành các đoạn nhỏ có vai riêng (`lecturer` hoặc `en`), giữ thứ tự.
  Mỗi đoạn vẫn ≤ 500 ký tự mỗi lần gọi NEU. Khoảng lặng **trong** một bước giữa hai đoạn khác vai là 0,2 giây; khoảng lặng cuối
  bước giữ nguyên 0,5 giây.
- **V2.** Mốc thời gian của từng bước (`startSec`, `endSec`) và neo `s<i>b<b>` **không đổi cách tính**: slide vẫn chuyển đúng bước
  theo độ dài tệp, kể cả khi trong bước có hai giọng.
- **V3.** `VoiceRole` có thêm `"en"`. Chỉ **bắt buộc** khi kịch bản có ít nhất một đoạn `en`: `requiredRoles("lecture", script)` trả
  `["lecturer"]` hoặc `["lecturer", "en"]`. Route báo thiếu giọng Anh **trước** khi tạo, như báo thiếu giọng hiện nay.
- **V4.** Hộp "Tạo giọng" (Quản trị › Giọng đọc) khi kịch bản có tiếng Anh hiện thêm ô **"Giọng đọc tiếng Anh"**, chỉ liệt kê giọng
  có `language = "en"`. Mặc định: giọng cấu hình ở `neutts.voice_en`, không có thì gợi ý theo cặp ở V5.
- **V5.** Cặp mặc định cho giảng viên ảo của bài, để hai giọng cùng giới: Tiến Đạt ↔ `am_adam`, Bảo Trang ↔ `af_heart`. Dùng **giọng Anh Mỹ**
  (`af_/am_`), cùng họ với bạn ảo Alex (đã chốt 15/11/2026).
- **V6.** Bộ nhớ đệm từng đoạn khoá theo (giọng, chữ), nên đổi chữ ở một bước chỉ đọc lại đúng đoạn đó; đổi giọng Anh thì chỉ
  đọc lại các đoạn `en`.
- **V7.** Đổi giọng Anh (hoặc giọng giảng viên) rồi lưu: bản nghe cũ **không còn khớp**, học viên không thấy nút nghe cho tới khi
  tạo lại (cùng quy tắc `generatedHash`/giọng hiện có). `voices` ghi cả hai vai.
- **V8.** Máy dev không có khoá NEU: `NARRATION_FAKE_TTS=1` vẫn chạy trọn luồng hai vai (bộ giả nhận cả tên giọng Anh). Bộ giả vẫn bị chặn ở production.

## L. Dựng và nhập bài

- **L1.** `cleanNarration` giữ `[en: …]` nguyên vẹn ở bước chuẩn hoá (không xoá như thẻ nhịp) để `planNarration` tách được; các thao tác thay xưng hô
  `{{Tx}}`, `{{tx}}` chạy ở phần chữ ngoài thẻ.
- **L2.** `deckLecture` (`build-deck-course.ts`) và `build-deck-lecture.ts` cho ra cùng định dạng đoạn `{ anchor, text }`; `text` có thể chứa `[en: …]`.
- **L3.** `import-course` và `update-lesson` nhận kịch bản có `[en: …]` mà không cần cờ mới; giới hạn cũ giữ nguyên (≤ 60 đoạn, ≤ 8.000
  ký tự mỗi đoạn, ≤ 40.000 ký tự cả bài). Bài 1.1 Grammar phải nằm gọn trong 56 đoạn để còn chỗ sửa.
- **L4.** (Sửa 15/11/2026) Bài Grammar khai báo `"ngonNgu": "vi"`: người học là học viên Việt, lời giảng và nút trong ô nhập đáp án của khung vốn là tiếng Việt, nên nhãn khối (ĐỊNH NGHĨA, VÍ DỤ, LƯU Ý) cũng tiếng Việt cho đồng nhất. Chữ của slide thì tiếng Anh ở phần ví dụ.

## B. Bài Grammar 1.1 (nội dung)

- **B1.** Bộ slide `apps/web/src/content/decks/passive-causative.json`, 12 đến 14 slide, kèm quiz cuối bài theo quy ước của khoá
  Toán 10 (10 câu, mỗi phương án nhiễu gắn một lỗi tư duy thật, mã `en1.1.*`).
- **B2.** Mạch bài: dẫn nhập từ chủ đề lối sống; bị động (hình thức, khi nào dùng); causative have (hình thức); phân biệt hai
  cấu trúc; bắt lỗi sai; nhập đáp án; cầu nối sang mục Speaking ("When was the last time you…?").
- **B3a.** (Thêm 15/11/2026) Khung `.nhap-dap-an` chỉ chấm toán, nên thêm kiểu `data-loai="chu"` cho bài ngoại ngữ: không phân biệt hoa thường, bỏ dấu câu thường gặp, nháy cong = nháy thẳng, giữ nháy đơn và gạch nối; nhiều đáp án ngăn bằng `|`. Kiểu cũ không đổi (có test).
- **B3.** Mỗi slide có ít nhất một thao tác của học viên (trắc nghiệm, ghép đôi, nhập đáp án, hiện dần) trong 12 slide; không có slide chỉ đọc chữ liền ba slide.
- **B4.** Ví dụ, câu hỏi và bài kiểm tra **do em tự soạn**; không chép bài đọc, câu ví dụ hay bài tập của sách. Mỗi ví dụ tiếng Anh nằm trong `[en: …]` để có giọng.
- **B5.** Lời giảng tiếng Việt xưng "thầy/cô – em", văn phong khoa học, câu đầy đủ, thuật ngữ tiếng Anh kèm tiếng Việt lần đầu (quy ước học liệu của thầy).
  Mỗi bước dài khoảng 15–40 giây khi đọc.
- **B6.** Bài gắn vào mục "1.1 Grammar · The passive; causative have" của khoá Speakout như bài slide có màn hình bìa; các Bài luyện hiện có của
  mục đó giữ nguyên, bộ slide dẫn học viên sang làm tiếp.
- **B7.** Khoá dev trước; thầy nghe thử và xem bằng mắt rồi mới đẩy lên máy chủ. Tạo giọng thật cần khoá NEU nên làm trên máy chủ.

## T. Thử nghiệm

- **T1.** Test thuần cho phân tích `[en: …]`: một đoạn, nhiều đoạn, nằm cuối/đầu bước, kề thẻ nhịp, thẻ lỗi (không đóng, rỗng, lồng).
- **T2.** Test `planNarration`: vai và thứ tự đúng; không có `[en: …]` thì kết quả **giống hệt** bản cũ (bảo vệ S3); tổng chữ được đọc không thiếu, không thừa.
- **T3.** Test `generateNarrationAudio` với bộ đọc giả: gọi đúng giọng cho đúng đoạn, mốc thời gian đơn điệu, cache theo (giọng, chữ).
- **T4.** Test `missingVoice`/`requiredRoles` theo kịch bản có và không có tiếng Anh.
- **T5.** Chạy `build-deck-course` cho cả 5 bài Toán 10: không đoạn nào đổi (mã băm giữ nguyên).
- **T6.** Xem trên dev ở `127.0.0.1:3000`: tạo giọng giả hai vai, nghe slide chạy qua các bước, đổi giọng Anh thì nút nghe biến mất rồi hiện lại sau khi tạo lại.

## Đã chốt thêm (15/11/2026)

1. **Giọng Anh Mỹ**, không dùng giọng Anh (`bf_/bm_`) dù sách là tiếng Anh Anh; đồng nhất với bạn ảo Alex và các đoạn mẫu Prepare.
2. **Giảng viên của bài này: Bảo Trang (nữ)**, giọng Anh đi kèm là `af_heart`. Bộ slide khai báo `macDinh: "baotrang"` (các bộ Toán 10 vẫn là Tiến Đạt).
3. **Nút nghe lại cụm tiếng Anh trên slide:** để đợt sau.

## Phát hiện khi làm thật (15/11/2026)

- **Giảng viên ảo là cài đặt toàn hệ thống** (`virtual_lecturer.default_lecturer`, hiện là Tiến Đạt); khoá chỉ chọn được mức hiện (`virtualLecturerMode`),
  không chọn được người. Bài Grammar xưng "cô Bảo Trang" nhưng bìa và avatar vẫn là Tiến Đạt. Cần quyết: thêm giảng viên theo khoá (cột mới,
  cần migration) hay đổi mặc định cả hệ thống (ảnh hưởng 5 bài Toán 10 đang xưng "thầy Tiến Đạt").
- Bộ giọng giả của dev chưa có giọng `en`: đã thêm `af_gia` để thử luồng hai vai (V8).
- `update-lesson.ts --create` trước đây chỉ tạo khối chữ nên bài slide ra rỗng; đã dùng `lessonContentItems` (khối nhúng, thẻ ghi nhớ) và lưu luôn lời giảng.
- CSS của khung làm thẻ tab đang chọn mất chữ ở giao diện Học liệu (trắng trên trắng); đã sửa một dòng, các bộ Toán 10 cũng hưởng.
