# Bài giảng Toán tương tác có giảng viên ảo — tiêu chí chấp nhận

> Bản nháp 01/11/2026. Mục tiêu: **một bài giảng mẫu** cho học sinh ôn Toán (vào lớp 10, tốt nghiệp THPT, thi đại học)
> mà học sinh *làm* nhiều hơn *đọc*: kéo tham số xem đồ thị đổi, tự làm bước cuối, tìm lỗi trong lời giải, nghe giảng viên ảo
> giảng theo từng bước. Bài đầu tiên: **Hàm số bậc hai $y=ax^2+bx+c$**.

## Vì sao chọn cách này

Khảo sát code hiện có (31/10): Limio đã có công thức KaTeX, lời giải hiện từng bước, Nghe giảng bám bước, quiz 10 loại câu,
lỗi tư duy (`misconception`) gắn phương án sai, BKT + đường học gợi ý, thẻ ghi nhớ lặp ngắt quãng, giảng viên ảo
(đã làm AC1–AC3 của `giang-vien-ao.md`). **Thiếu đúng một thứ quyết định với Toán: đồ thị kéo được.** Lấp đúng chỗ đó,
dùng lại phần còn lại.

## Đã chốt

1. Đồ thị tương tác là **một tệp HTML tự chứa** (canvas + JS thuần, không thư viện ngoài, không gọi mạng) đặt trong
   `apps/web/public/widgets/`, nhúng bằng khối `embed` có sẵn. Không dùng GeoGebra/Desmos: phụ thuộc dịch vụ ngoài,
   không kiểm soát được, không offline, không đo được học sinh làm gì.
2. Lời giảng, ví dụ hiện từng bước, quiz, lỗi tư duy dùng **cơ chế sẵn có** của khoá mẫu `on-thi-toan-10-mau`. Không thêm
   loại nội dung mới ngoài `embed`.
3. Nội dung do Limio tự soạn.

## Chưa làm trong đợt này

- Chọn mục tiêu (vào 10 / THPT / ĐH) rồi sắp lại đường học theo mục tiêu — cần thêm trường mục tiêu vào hồ sơ học viên.
- Gia sư AI chuyên Toán (nhắc theo kiểu gợi mở, không đưa đáp án ngay).
- Đề thi thử trọn vẹn tính giờ cho từng kỳ thi.
- Widget cho các dạng khác (hệ phương trình, hình học, xác suất).
- Gắn kết quả thử thách trong widget vào XP/BKT (widget chưa phát event).

## AC1 — Đồ thị parabol kéo được

- **Given** học sinh mở bài, **when** kéo thanh trượt $a$, $b$, $c$ (hoặc gõ số), **then** parabol vẽ lại ngay (< 100 ms), kèm
  đỉnh, trục đối xứng, $\Delta$, các nghiệm (nếu có) cập nhật cùng lúc; $a=0$ hiện cảnh báo "không còn là hàm bậc hai" thay vì vẽ đường thẳng lặng lẽ.
- **Given** $\Delta<0$, **when** hiển thị, **then** ghi "vô nghiệm" và không vẽ điểm cắt trục hoành.
- **Given** màn hình < 640px, **when** mở widget, **then** thanh trượt xếp dưới đồ thị, không cuộn ngang, chạm kéo được.
- **Given** không có mạng, **when** mở widget, **then** vẫn chạy (không tải gì ngoài chính tệp).

## AC2 — Thử thách có chấm

- **Given** học sinh bấm "Thử thách", **when** hệ ra đề kiểu "kéo để parabol có đỉnh $(1;-4)$ và đi qua $(0;-3)$", **then**
  học sinh kéo $a,b,c$; bấm "Kiểm tra" thì báo đúng/sai kèm chỗ lệch (đỉnh sai bao nhiêu), sai không trừ gì.
- **Given** đề sinh ngẫu nhiên, **when** sinh, **then** luôn có nghiệm với $a,b,c$ nguyên nhỏ ( |giá trị| ≤ 5 ) để kéo được bằng thanh trượt bước 1.
- Đề và lời giải kiểm bằng test đơn vị (hàm thuần, không cần trình duyệt).

## AC3 — Nhúng vào bài học

- **Given** tệp manifest có `embeds` trong bài, **when** nhập khoá, **then** mỗi mục thành một khối `embed` đặt **sau** các khối
  chữ, đúng thứ tự khai báo; URL dạng đường dẫn cùng-origin (`/widgets/...`) hợp lệ, URL ngoài phải https.
- **Given** URL embed sai (`javascript:`, `//host`, http), **when** nhập, **then** importer từ chối trước khi ghi dòng nào.

## AC4 — Bài giảng có giảng viên ảo

- **Given** bài có lời giảng bám các mục và bước, **when** học sinh bấm Nghe giảng (hoặc giảng viên ảo ở chế độ Bắt buộc),
  **then** giọng giảng tới đâu thì mục/bước đó hiện ra; lời giảng nhắc học sinh **thử kéo thanh trượt** ở đúng mục có widget.
- **Given** lời giảng, **when** chuẩn bị, **then** không có ký hiệu `$`/LaTeX thô trong chữ đọc (đã có `cleanNarration` làm việc này).

## AC5 — Luyện và tự kiểm

- **Given** mỗi mục kiến thức, **when** học xong, **then** có (a) ví dụ mẫu hiện từng bước, (b) "Tự làm bước cuối", (c) "Tìm lỗi
  trong lời giải" — như bài mẫu hiện có.
- **Given** quiz của bài, **when** học sinh chọn phương án sai thuộc một lỗi tư duy đã khai báo (`ham2.*`), **then** phản hồi
  chỉ đúng chỗ nhầm và gợi ý quay lại mục tương ứng. Mỗi câu tag Nhận biết / Thông hiểu / Vận dụng.
- **Given** quiz bật `requireConfidence`, **when** nộp, **then** có thang tự tin (cơ chế sẵn có), dùng để thấy "tự tin mà sai".

## AC6 — Nhập và kiểm chứng

- Khoá nhập được bằng `pnpm import:course` (kiểm `--dry-run` trước), ở trạng thái nháp.
- Mọi đáp án số trong quiz được tính lại bằng script (không tin tay) trước khi nhập.
- Kiểm bằng mắt trên máy dev: widget kéo được, quiz hiện công thức, Nghe giảng bám bước.

## Rủi ro

| Rủi ro | Cách giữ |
|---|---|
| Widget nhúng không sandbox | Tệp tự viết, cùng origin, không đọc cookie/DOM cha; không nhận tham số từ URL ngoài việc đặt giá trị ban đầu (đã kiểm số) |
| Học sinh xem như trò chơi, không học | Lời giảng và bài tập đòi hỏi *dự đoán trước khi kéo*: "em đoán đỉnh nằm ở đâu?" |
| Đáp án sai | Script tính lại mọi đáp án (AC6) |
