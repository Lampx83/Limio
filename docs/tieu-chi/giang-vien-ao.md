# Giảng viên ảo trong Limio — tiêu chí chấp nhận

> Cập nhật 01/11/2026 sau khi code AC1–AC3. **Đính chính bản nháp đầu:** bản nháp tưởng Limio đã có trình phát slide tự chuyển theo giọng; thực tế
> `nghe-giang-slide.md` mới làm giai đoạn 1–2 (gắn bài giảng, AI sinh slide), **chưa có** giọng từng slide và trình phát slide (giai đoạn 3–4). Vì vậy giảng viên ảo
> được dựng trên **Nghe giảng có sẵn** (lời giảng bám mục/bước của bài viết, `NarrationPlayer`): thêm **giảng viên hiện hình** (tên, màu, chân dung) và
> **cài đặt quản trị** bật/tắt/ép dùng. Học từ SmartDoc (`nguoiGiang/`, `CaiDatLop.jsx`) nhưng không chép nguyên, không dựng trình phát thứ hai.

## Vì sao làm

Học sinh tự học thì cần cảm giác có người giảng, không chỉ nghe một giọng đọc. Quản trị cần quyền quyết định: bật cho cả hệ thống hay không, và với
khoá nào thì bắt buộc, gợi ý hay ẩn.

## Đã biết từ khảo sát nguồn

- **SmartDoc** (`/Users/mac/Documents/Code/Smartdoc`): giảng viên ảo là lớp phủ toàn màn hình trên slide HTML tương tác; nói từng câu, hiện dần từng phần slide,
  có gia sư hỏi-đáp 1-1. Giọng lấy từ NEU TTS (nội bộ trường) hoặc giọng trình duyệt. Cài đặt lớp có bốn mức: **Bắt buộc / Hiện / Em tự bật / Không hiện**.
  Video avatar dựng sẵn (232 MB) cần GPU nên **không** nằm trong phạm vi.
- **Học liệu AI Research** (`/Users/mac/Documents/Code/Portal-Deploy/Research/HocLieu`, nguồn là file TypeScript, không có DB nội dung): 1 khoá «Nghiên cứu khoa học: từ ý tưởng đến
  công bố», 8 buổi × 150 phút, **311 slide** (13 kiểu: sơ đồ, bảng, so sánh, ví dụ, hoạt động…), 131 câu quiz, mỗi buổi một giảng viên ảo (8 người, mã giọng NEU TTS)
  và lời giảng theo từng bước hiện dần. Có 4 đề tài xuyên suốt (token `{{…}}`). Âm thanh dựng sẵn 22.250 mp3 / 464 MB.
- **Limio** đã có: `LessonNarration` (loại `lecture`, tạo giọng, mốc thời gian từng đoạn, anchor = tên mục / `mo-dau` / `tong-ket` / `Tên mục #n` cho bước hiện dần),
  `NarrationPlayer`, `LiveDeck`/`LiveSlide`, cài đặt hệ thống (`SiteSetting`, `/admin/settings`). **Chưa có** trình phát slide có giọng từng slide.
  **Đã làm (PR #106, #107):** cài đặt quản trị, hàm mức hiệu lực, giảng viên hiện tên + màu trên Nghe giảng, thanh mời (Hiện), khoá nút đóng (Bắt buộc).

## Phạm vi

**Giai đoạn 1 (tài liệu này):** cài đặt quản trị, giảng viên hiện hình trên Nghe giảng sẵn có, nhập bài trình diễn Toán 10, rồi khoá AI Research.
**Để sau (ghi rõ để khỏi hiểu nhầm là bỏ sót):** gia sư 1-1 (giảng lại / ví dụ khác / hỏi đáp), cổng đạt mức thành thạo, slide HTML tương tác kiểu SmartDoc có `data-chi` và thẻ nhịp
`[chỉ]` `[nghĩ]`, video avatar, slide HTML tương tác của SmartDoc (đã chốt: chuyển thành bài viết theo mục, mất tương tác), **giảng viên có chân dung thật** (đang dùng khung tròn + màu; chờ Vidgen).

## AC1 — Cài đặt quản trị

- **Given** admin mở `/admin/settings`, **when** vào mục «Giảng viên ảo», **then** thấy: công tắc **Bật giảng viên ảo toàn hệ thống** (mặc định **tắt**),
  **mức mặc định** (Bắt buộc / Hiện / Em tự bật / Không hiện; mặc định **Hiện**) và **giảng viên mặc định**. Chỉ admin thấy và lưu được; người khác nhận 403.
- **Given** công tắc toàn hệ thống đang tắt, **then** không ở đâu hiện giảng viên ảo, bất kể cài đặt khoá; trình phát chạy đúng như hôm nay.
- **Given** admin mở danh sách khoá ở `/admin/courses`, **when** đặt mức riêng cho một khoá, **then** mức đó thắng mức mặc định của hệ thống; «Theo mặc định hệ thống» xoá mức riêng.
  Lưu bằng một cột nullable mới trên `Course` (null = theo hệ thống) qua `prisma migrate`; mọi thay đổi ghi `AuditLog` (`course.virtual_lecturer.changed`), payload chỉ mang id và giá trị cũ/mới.
- Giảng viên ảo là một **danh sách cố định trong code** (mã, tên, giới, mã giọng); admin chọn người mặc định, không tải ảnh hay thêm người ở giai đoạn này.

## AC2 — Học viên thấy và dùng

- **Given** bài học có lời giảng **đã có giọng** (`LessonNarration` loại `lecture`, trạng thái `ready`) và giảng viên ảo đang được bật cho khoá, **when** học viên mở Nghe giảng,
  **then** trình phát mang tên và màu giảng viên được chọn, kèm hiệu ứng khi đang nói và tốc độ 0,75–1,5 (đã có). **Chưa làm:** chọn người giảng ở phía học viên, phụ đề.
- Bài **chưa có giọng** thì không hiện giảng viên ảo (như nút Nghe giảng hiện nay), không lỗi. (Đã làm.)
- Lựa chọn của học viên (người giảng, tốc độ, phụ đề) nhớ trong trình duyệt; không gửi lên máy chủ. Tên gọi/biệt danh **không** gửi đi.
- Người xem thử (giảng viên xem thử khoá, khách xem khoá công khai) thấy đúng như học viên; không cần đăng nhập thì không ghi sự kiện học tập.

## AC3 — Bốn mức

| Mức | Hành vi |
|---|---|
| Bắt buộc | Mở bài là vào thẳng Nghe giảng với giảng viên; nút đóng bị ẩn; không đổi được người giảng nếu admin khoá |
| Hiện | Có thanh mời «Học với giảng viên ảo»; học viên tắt được |
| Em tự bật | Mặc định tắt; có nút phụ «Bật giảng viên ảo» |
| Không hiện | Không có giảng viên ảo |

- Mức hiệu lực = mức riêng của khoá, không có thì mức mặc định hệ thống; công tắc toàn hệ thống tắt thì coi như «Không hiện».
- **Khác SmartDoc:** SmartDoc chỉ ép mức «Không hiện» ở máy chủ, còn ba mức kia chỉ nằm ở giao diện. Ở Limio hàm tính mức hiệu lực nằm **một chỗ ở `core-lms`**, trang và API cùng gọi nó;
  «Không hiện» thì API phục vụ phần giảng viên ảo trả 403, không chỉ ẩn nút.
- Giảng viên xem khoá mình dạy luôn thấy được (để kiểm tra), không bị «Không hiện» che (khi đó mức là «Em tự bật»). (Đã làm trong `resolveVirtualLecturerMode`.)

## AC4a — Nhập bài trình diễn Toán 10 của SmartDoc (đã làm, chờ nhập prod)

- Bộ chuyển `smartdocConvert.ts` + `scripts/convert-smartdoc-lesson.ts`: mỗi slide thành một mục `##` của bài viết (công thức `\(..\)` → `$..$`, ô định nghĩa → trích dẫn, trắc nghiệm → câu hỏi + đáp án, nút/ô nhập bị bỏ, SVG bị bỏ và ghi một dòng), lời giảng bám đúng tên mục (slide bìa → `mo-dau`).
- Kết quả: 68 slide, 31.498 ký tự lời giảng, 10 SVG bỏ; khoá `toan-10-giang-vien-ao-demo`, nháp. Giọng tạo bằng «Giọng đọc» (mã `tiendat`).

## AC4 — Nhập khoá «Nghiên cứu khoa học: từ ý tưởng đến công bố» (AI Research)

> Cách làm theo AC4a (bài viết theo mục + lời giảng bám mục), **không** theo slide `LiveDeck` như bản nháp đầu viết bên dưới; các dòng về `LiveDeck`/`presenterNote` chỉ còn giá trị tham khảo cho giai đoạn có trình phát slide.

- Một script chạy được lại nhiều lần (idempotent theo `slug`), đọc nguồn TypeScript của Học liệu, **không** copy thủ công: tạo 1 khoá, 8 module/bài học tương ứng 8 buổi, mỗi buổi một `LiveDeck` gắn vào bài học.
- Ánh xạ slide: slide chữ/ví dụ/so sánh/bảng → slide `content` (HTML an toàn do Limio-Live dựng); câu quiz → slide `quiz`; hoạt động/công cụ → slide `content` mô tả hoạt động. Sơ đồ (`diagram`) **chưa vẽ lại**:
  đổi thành danh sách có thứ tự và ghi vào báo cáo nhập «slide nào bị đơn giản hoá». Báo cáo liệt kê số slide mỗi loại, số slide đơn giản hoá, số slide bỏ.
- Lời giảng theo bước nối thành `config.presenterNote` của slide (đã bỏ thẻ nhịp và token xưng hô thay bằng «mình – bạn» như AC4 của `nghe-giang-slide.md`); mỗi buổi gán người giảng theo `lecturers.ts` của nguồn.
- **Không copy** 22.250 mp3, video avatar, tài liệu truyền thông. Giọng được **tạo bằng đường sẵn có của Limio** (trang quản trị «Giọng đọc») sau khi nhập, tốn token TTS (ước tính trong báo cáo).
- Khoá nhập vào ở trạng thái **nháp** và đúng tên chủ do admin chỉ định; không tự publish, không tự đưa vào mục «Học thử».
- Token đề tài `{{…}}` được thay bằng **một** đề tài (❓2). Nguồn chỉ có tiếng Việt, `language = vi`.

## AC5 — Sự kiện và riêng tư

- Ghi sự kiện `lesson.lecturer.opened` (mở chế độ giảng viên ảo) và `lesson.lecturer.completed` (nghe hết bài) vào `LearningEvent`, payload chỉ có id bài, id người giảng, mức; **không** có biệt danh hay nội dung lời.
- Không lưu gì về lựa chọn giao diện của học viên ở máy chủ. Xoá tài khoản thì sự kiện đi theo luồng xoá sẵn có.
- Phần giảng viên ảo dùng chung quyền truy cập bài học của Nghe giảng (khoá chưa xuất bản, bài ẩn/khoá thì chặn như `canListenToLesson`). Sự kiện `lesson.lecturer.*` **chưa ghi** — làm ở đợt sau.

## AC6 — Kiểm thử

- Test hàm mức hiệu lực: ma trận (công tắc hệ thống × mức khoá × mức mặc định × vai trò xem), gồm giảng viên xem thử.
- Test quyền: người không phải admin không đọc/ghi được cài đặt; API trả 403 khi «Không hiện».
- Test script nhập: chạy hai lần không nhân đôi; báo cáo đúng số liệu trên một buổi nhỏ có sẵn trong repo.
- Duyệt tay trên trình duyệt ở điện thoại và máy tính (sidebar/drawer theo `CLAUDE.md` §4.6), cả giao diện sáng và tối.

## Đã chốt (01/11/2026)

1. **Nguồn demo SmartDoc:** đưa lên **4 bài trình diễn Toán 10** (Ba đường conic, Hệ thức lượng trong tam giác, Hệ bất phương trình bậc nhất hai ẩn và tối ưu, Xác suất cổ điển) cùng bài 1 «Hàm số bậc hai» (đầy đủ) làm bài mẫu chuẩn.
2. **AI Research nhập thành 4 khoá, mỗi khoá một đề tài** (tài chính, sức khoẻ, môi trường, giáo dục), thay vì chọn một đề tài. Script nhập nhận tham số đề tài và tạo một khoá cho mỗi đề tài (slug riêng, idempotent theo slug).
3. **Chân dung giảng viên:** tạm thời do **AI tạo**, liên hệ **Vidgen** để sinh (chưa dùng ảnh người thật). Giai đoạn này chỉ cần danh sách cố định mã giảng viên → tệp ảnh; trong lúc chờ Vidgen thì dùng SVG minh hoạ, thay tệp là xong, không đổi code.
4. **Giọng đọc:** dùng **NEU TTS trên máy 232**, đường sẵn có của Limio («Giọng đọc» ở trang quản trị); không dựng đường TTS mới.

## Còn mở

- **Nguồn các môn Codelab.** Server 217 (SmartDoc) chỉ có 7 học phần (Khoa học dữ liệu cơ bản, Nhập môn CNTT, Thiết kế Web, Dữ liệu phi cấu trúc, NCKH, Lịch sử Đảng…), không có SQL / giải thuật / Java.
  Các môn lập trình nhiều khả năng nằm ở hệ Codelab OJ (máy 220/221, bài tập chấm tự động), nhưng tài khoản `codelab` hiện **không có quyền Docker** ở hai máy đó nên chưa đọc được. Anh nhắc các môn lập trình / SQL / giải thuật / Java trên Codelab: cần biết môn nằm ở đâu và có slide + lời giảng không, hay chỉ là bài tập chấm tự động (nếu chỉ là bài tập thì không thuộc phạm vi giảng viên ảo).
- ~~Slide HTML của SmartDoc~~ — **đã chốt «Đồng ý» mất tương tác**; bài tương tác cao dựng riêng, xem `bai-giang-toan-tuong-tac.md`.
- **Chi phí TTS:** 4 khoá AI Research × 311 slide là ~1.250 slide cần giọng; cần ước tính thời gian tạo trên máy 232 và duyệt trước khi chạy hàng loạt (tạo theo từng khoá).
- **Khoá AI Research có trùng NCKH 101–501 đã có trên Limio không?**
