# Giảng viên ảo trong Limio — tiêu chí chấp nhận

> Bản nháp 01/11/2026, chờ duyệt trước khi code. Mở rộng `nghe-giang-slide.md`: bài giảng slide của bài học vốn đã có **giọng đọc tự chuyển slide**;
> việc này thêm **giảng viên hiện hình** (chân dung, phụ đề, chọn người giảng) và **cài đặt quản trị** bật/tắt/ép dùng. Học từ phần giảng viên ảo của
> SmartDoc (`nguoiGiang/`, `CaiDatLop.jsx`) nhưng không chép nguyên: Limio dùng lại bài giảng slide và giọng đọc sẵn có, không dựng trình phát thứ hai.

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
- **Limio** đã có: `LiveDeck`/`LiveSlide` (lời giảng = `config.presenterNote`), `LessonNarration` (loại `lecture`, tạo giọng, mốc thời gian từng đoạn), trình phát nghe giảng
  slide, cài đặt hệ thống (`SiteSetting`, trang `/admin/settings`). **Chưa có** giảng viên hiện hình và mọi cài đặt về nó.

## Phạm vi

**Giai đoạn 1 (tài liệu này):** cài đặt quản trị, giảng viên hiện hình trên trình phát slide sẵn có, nhập khoá AI Research.
**Để sau (ghi rõ để khỏi hiểu nhầm là bỏ sót):** gia sư 1-1 (giảng lại / ví dụ khác / hỏi đáp), cổng đạt mức thành thạo, slide HTML tương tác kiểu SmartDoc có `data-chi` và thẻ nhịp
`[chỉ]` `[nghĩ]`, video avatar, nhập học phần mẫu Toán 10 (cần runtime iframe riêng, xem ❓5).

## AC1 — Cài đặt quản trị

- **Given** admin mở `/admin/settings`, **when** vào mục «Giảng viên ảo», **then** thấy: công tắc **Bật giảng viên ảo toàn hệ thống** (mặc định **tắt**),
  **mức mặc định** (Bắt buộc / Hiện / Em tự bật / Không hiện; mặc định **Hiện**) và **giảng viên mặc định**. Chỉ admin thấy và lưu được; người khác nhận 403.
- **Given** công tắc toàn hệ thống đang tắt, **then** không ở đâu hiện giảng viên ảo, bất kể cài đặt khoá; trình phát chạy đúng như hôm nay.
- **Given** admin mở danh sách khoá ở `/admin/courses`, **when** đặt mức riêng cho một khoá, **then** mức đó thắng mức mặc định của hệ thống; «Theo mặc định hệ thống» xoá mức riêng.
  Lưu bằng một cột nullable mới trên `Course` (null = theo hệ thống) qua `prisma migrate`; mọi thay đổi ghi `AuditLog` (`course.virtual_lecturer.changed`), payload chỉ mang id và giá trị cũ/mới.
- Giảng viên ảo là một **danh sách cố định trong code** (mã, tên, giới, mã giọng); admin chọn người mặc định, không tải ảnh hay thêm người ở giai đoạn này.

## AC2 — Học viên thấy và dùng

- **Given** bài học có bài giảng slide **đã có giọng** (`LessonNarration.status = ready`) và giảng viên ảo đang được bật cho khoá, **when** học viên mở trình phát slide,
  **then** thấy giảng viên ở một góc: chân dung, hiệu ứng khi đang nói, **phụ đề** theo lời đang đọc, nút chọn người giảng (nếu mức cho phép), tốc độ 0,75–1,5 và tắt/bật phụ đề.
- Bài **chưa có giọng** thì không hiện giảng viên ảo (như nút nghe giảng hiện nay), không lỗi.
- Lựa chọn của học viên (người giảng, tốc độ, phụ đề) nhớ trong trình duyệt; không gửi lên máy chủ. Tên gọi/biệt danh **không** gửi đi.
- Người xem thử (giảng viên xem thử khoá, khách xem khoá công khai) thấy đúng như học viên; không cần đăng nhập thì không ghi sự kiện học tập.

## AC3 — Bốn mức

| Mức | Hành vi |
|---|---|
| Bắt buộc | Mở slide là vào thẳng chế độ có giảng viên; không tắt được; không đổi được người giảng nếu admin khoá |
| Hiện | Có thanh mời «Học với giảng viên ảo»; học viên tắt được |
| Em tự bật | Mặc định tắt; có nút phụ «Bật giảng viên ảo» |
| Không hiện | Không có giảng viên ảo |

- Mức hiệu lực = mức riêng của khoá, không có thì mức mặc định hệ thống; công tắc toàn hệ thống tắt thì coi như «Không hiện».
- **Khác SmartDoc:** SmartDoc chỉ ép mức «Không hiện» ở máy chủ, còn ba mức kia chỉ nằm ở giao diện. Ở Limio hàm tính mức hiệu lực nằm **một chỗ ở `core-lms`**, trang và API cùng gọi nó;
  «Không hiện» thì API phục vụ phần giảng viên ảo trả 403, không chỉ ẩn nút.
- Giảng viên xem khoá mình dạy luôn thấy được (để kiểm tra), không bị «Không hiện» che.

## AC4 — Nhập khoá «Nghiên cứu khoa học: từ ý tưởng đến công bố» (AI Research)

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
- Phần giảng viên ảo dùng chung quyền truy cập bài học của trình phát slide (khoá chưa xuất bản, bài ẩn/khoá thì chặn như `canListenToLesson`).

## AC6 — Kiểm thử

- Test hàm mức hiệu lực: ma trận (công tắc hệ thống × mức khoá × mức mặc định × vai trò xem), gồm giảng viên xem thử.
- Test quyền: người không phải admin không đọc/ghi được cài đặt; API trả 403 khi «Không hiện».
- Test script nhập: chạy hai lần không nhân đôi; báo cáo đúng số liệu trên một buổi nhỏ có sẵn trong repo.
- Duyệt tay trên trình duyệt ở điện thoại và máy tính (sidebar/drawer theo `CLAUDE.md` §4.6), cả giao diện sáng và tối.

## Đã chốt (01/11/2026)

1. **Nguồn demo SmartDoc:** đưa lên **4 bài trình diễn Toán 10** (Ba đường conic, Hệ thức lượng trong tam giác, Hệ bất phương trình bậc nhất hai ẩn và tối ưu, Xác suất cổ điển). Bài 1 «Hàm số bậc hai» (đầy đủ) đi cùng làm bài mẫu chuẩn.
2. **Đề tài của khoá AI Research:** không chọn một trong 4 đề tài tài chính / sức khoẻ / môi trường / giáo dục; thay bằng các **môn học trên Codelab** (lập trình, SQL, giải thuật, web, Java…). Nguồn nội dung các môn này **chưa xác định** (xem dưới).
3. **Chân dung giảng viên:** dùng SVG minh hoạ động trước, thay ảnh thật sau.

## Còn mở

- **Nguồn các môn Codelab.** Server 217 (SmartDoc) chỉ có 7 học phần (Khoa học dữ liệu cơ bản, Nhập môn CNTT, Thiết kế Web, Dữ liệu phi cấu trúc, NCKH, Lịch sử Đảng…), không có SQL / giải thuật / Java.
  Các môn lập trình nhiều khả năng nằm ở hệ Codelab OJ (máy 220/221, bài tập chấm tự động), nhưng tài khoản `codelab` hiện **không có quyền Docker** ở hai máy đó nên chưa đọc được. Cần anh cho biết môn nằm ở đâu và có slide + lời giảng không, hay chỉ là bài tập.
- **Slide HTML của SmartDoc** (có `data-chi`, thẻ nhịp `[chỉ]` `[nghĩ]`) không khớp slide `content` an toàn của Limio. Cần chọn: chuyển đổi thành slide Limio (mất tương tác), hay làm runtime iframe riêng (công lớn, để giai đoạn 2).
- **Chi phí TTS:** ai duyệt khi tạo giọng cho khoảng 311 slide AI Research + 5 bài Toán 10, và dùng đường TTS nào trên production.
- **Khoá AI Research có trùng NCKH 101–501 đã có trên Limio không?**
