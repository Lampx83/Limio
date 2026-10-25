# Nghe giảng bằng bài giảng slide — tiêu chí chấp nhận

> Bản nháp 25/10/2026, chờ duyệt trước khi code. Mở rộng `nghe-giang-podcast.md`: nút "Nghe giảng" của một bài học có
> thêm cách nghe thứ hai — **bài giảng slide có giọng đọc, tự chuyển slide**. Cách nghe cũ (giọng đọc theo bài viết, tô
> sáng trong bài) vẫn còn, dùng khi bài chưa có bài giảng slide.

## Vì sao làm

Cách nghe theo bài viết phải **đoán** đoạn nào của bài ứng với lời đang đọc, nên tô sáng chỉ đúng ở mức mục lớn, có lúc dừng
sai chỗ (đã gặp: kẹt ở khung mục tiêu). Với slide, mỗi slide là một đơn vị có lời riêng; chuyển slide tự động theo đúng độ
dài tệp âm thanh của slide đó, không cần đoán. Lời giảng ngắn (20–40 giây mỗi slide) cũng ít bị lệch giọng hơn khi tạo giọng
và tạo lại được từng slide.

## Đã chốt (25/10/2026)

1. Slide tương tác (bình chọn, đám mây từ, bảng cộng tác, bảng trắng) **đổi thành câu tự kiểm tra có đáp án ngay** khi học
   viên tự học. Không bỏ qua.
2. Bài giảng slide **do AI sinh từ bài viết** của bài học rồi giảng viên chỉnh; không soạn riêng từ đầu.
3. Giữ cả hai cách nghe, **tách thành hai nút**: "Nghe giảng" (theo bài viết, như hiện có) và nút slide. Podcast là nút riêng
   cạnh "Nghe giảng" (đã làm). Nút slide có hai kiểu tuỳ người dùng (xem AC6):
   - Người sửa được khoá: "Xem slide" có hai việc — **"Xem slide để dạy"** (mở bài giảng tương tác Limio-Live để dạy trực tiếp)
     và **"Xem slide để nghe giảng"** (chạy như học viên sẽ thấy, dạng slideshow).
   - Học viên: chỉ có **nghe giảng slide**, và chỉ chọn được khi bài đã có giọng; chưa có giọng thì không hiện nút.
4. Học viên **không tải** được tệp âm thanh (như `nghe-giang-podcast.md` AC5).

## Chưa làm trong đợt này

- Soạn tay bài giảng slide riêng không dựa vào bài viết.
- Học viên bình chọn chung, đám mây từ chung, bảng cộng tác chung khi nghe (chỉ có trong buổi dạy trực tiếp).
- Nhiều bài giảng cho một bài học; bài giảng dùng chung cho nhiều bài.
- Phụ đề chạy theo giọng.
- Giảng viên bấm tạo giọng cho từng khoá ngoài trang quản trị "Giọng đọc" (cùng chỗ với lời giảng hiện có).
- Dựng cho Bài 2–6 của khoá mẫu: làm Bài 1 trước, bạn duyệt rồi mới làm tiếp.

## AC1 — Gắn bài giảng slide với bài học

- **Given** một bài học và một bài giảng (LiveDeck) của chủ khoá, **when** quản trị hoặc giảng viên sửa được khoá gắn chúng,
  **then** bài học có đúng một bài giảng slide; gắn lần nữa thì thay bài giảng cũ (sau khi hỏi lại), không tạo hai bài.
- **Given** bài học có bài giảng slide, **when** bài giảng bị xoá, **then** bài học tự về cách nghe cũ, không lỗi, không để lại
  tham chiếu chết.
- **Given** một học viên ghi danh (hoặc người xem thử, hoặc khoá cho đọc công khai) được xem bài học và bài đã có giọng slide, **when**
  họ mở trình phát slide, **then** họ chỉ xem được **slide của bài giảng đó qua bài học** — không lộ danh sách bài giảng khác của giảng viên,
  không lộ ghi chú giảng (ghi chú là bản nháp của giảng viên), không lộ nguồn gốc (`sourceText`).
- **Given** khoá chưa xuất bản hoặc bài bị ẩn/khoá, **then** trình phát slide chặn đúng như `canListenToLesson`.
- Bài chưa có giọng slide thì học viên **không** vào được trang slide (kể cả gõ thẳng địa chỉ); chỉ người sửa được khoá vào được.
- Bản sao khoá (nếu có) mang theo hay không: **chưa mang theo**; ghi rõ ở giao diện sao chép.

## AC2 — AI sinh bài giảng từ bài viết

- **Given** bài học có nội dung chữ (khối richtext/markdown), **when** giảng viên bấm "Tạo bài giảng slide từ bài viết",
  **then** hệ thống chạy đường sẵn có của Limio-Live (nguồn → dàn ý → xác nhận → slide), với nguồn là **chữ của chính bài học**
  (tiêu đề mục, đoạn, bảng, hộp "Ghi nhớ", thẻ ghi nhớ, tài liệu tham khảo).
- Dàn ý hiện cho giảng viên xem và xác nhận **trước** khi sinh slide (giống `tao-bai-giang-mot-o.md`); không tự sinh slide.
- AI **chỉ dùng kiến thức có trong bài viết**; số liệu, tên người, trích dẫn phải có trong bài. Slide có trích dẫn nêu nguồn
  như bài viết.
- Hình trong bài viết (ảnh Wikimedia kèm giấy phép) được **dùng lại** trên slide kèm chú thích giấy phép; không tự tải hình
  mới từ nguồn khác.
- Số slide theo thời lượng bài (khoảng 12–16 slide cho bài 15 phút); luôn có slide bìa và slide tổng kết.
- Mỗi lần sinh ghi lại **dấu vân của bài viết** tại thời điểm đó. Bài viết sửa sau này thì trang quản trị báo "Bài viết đã đổi
  sau khi tạo bài giảng" và đề nghị sinh lại; **không tự sinh lại** và không ghi đè chỉnh sửa của giảng viên.
- Chạy được khi chưa có khoá NEU (chỉ cần mô hình chat đã cấu hình). Lỗi mô hình → báo lỗi, không để bài giảng nửa vời.

## AC3 — Slide tương tác đổi thành câu tự kiểm tra

- Bài giảng sinh cho bài học **chỉ gồm slide chữ/hình (`content`) và slide trắc nghiệm (`quiz`)**. Chỗ lẽ ra là bình chọn,
  đám mây từ, bảng cộng tác, bảng trắng thì AI sinh **câu trắc nghiệm tự kiểm tra** dựa trên bài viết (có một đáp án đúng).
- **Given** bài giảng gắn bài học đã có sẵn slide loại khác (bài giảng soạn từ trước), **when** học viên nghe, **then** các slide
  loại đó **không** xuất hiện trong trình phát; trang quản trị liệt kê các slide bị bỏ và gợi ý đổi thành trắc nghiệm.
- **Given** học viên ở slide tự kiểm tra, **when** chọn một đáp án, **then** hiện **ngay** đúng/sai, đáp án đúng, và lời giải
  thích ngắn nếu có; sau đó mới đi tiếp. Chọn lại được trước khi bấm "Tiếp tục"; không giới hạn số lần, không điểm.
- Slide tự kiểm tra **không tính điểm, không vào bảng điểm, không cập nhật hồ sơ năng lực**. Ghi sự kiện đo lường chỉ gồm
  id slide và đúng/sai ở lần chọn cuối, **không** ghi nội dung câu hỏi hay đáp án chọn.

## AC4 — Lời giảng từng slide

- **Lời giảng chính là ghi chú giảng của slide** (`config.presenterNote`, tối đa 6.000 ký tự; không thêm trường mới). Với bài giảng
  sinh cho bài học, AI viết ghi chú **ngay lúc sinh slide** dưới dạng lời đọc cho tai nghe: câu đầy đủ, xưng "mình – bạn",
  không markdown, không ký hiệu, không gạch đầu dòng.
- Ghi chú vẫn hiện ở khung giảng viên khi trình chiếu và vẫn **không lộ qua link chia sẻ**; học viên nghe giọng đọc nhưng
  **không nhận chữ của ghi chú**.
- Giảng viên sửa ghi chú trong trình soạn như cũ. **Giọng đã tạo không đổi khi sửa ghi chú**: audio là bản chụp tại lúc tạo,
  chỉ đổi khi **quản trị viên** bấm "Tạo lại" ở trang quản trị (xem AC5). Mục đích là không tốn thêm token tạo giọng vì chỉnh ghi chú nhỏ. Trình soạn của giảng viên có
  dòng báo điều này ở bài giảng gắn bài học, kèm dấu "ghi chú đã đổi sau khi tạo giọng" trên slide nào lệch và lời nhắn
  "nhờ quản trị viên tạo lại giọng nếu cần"; giảng viên không tự tạo giọng.
- Bài giảng soạn từ trước (ghi chú là ý chính hay để trống) khi gắn vào bài học: trang quản trị cảnh báo slide nào có ghi chú quá
  ngắn, có gạch đầu dòng/markdown, hoặc để trống, và đề nghị "AI chuốt thành lời giảng" (đề xuất để giảng viên xem rồi nhận,
  không tự ghi đè).
- Slide bìa và slide tổng kết cũng có lời (chào, tóm ý). Slide tự kiểm tra có ghi chú là lời **đọc đề** (không chứa đáp án hay lời giải thích, vì được đọc trước khi học viên chọn).
- Lời (ghi chú) mỗi slide tối đa khoảng 120 từ; dài hơn thì cảnh báo ở trang quản trị nhưng vẫn cho tạo giọng.
- Slide thiếu lời (ghi chú trống) thì **không tạo được giọng cho slide đó**; trang quản trị chỉ ra slide nào còn thiếu.
- Lời **không nhắc tới phần không có trên màn hình** ("như bạn thấy ở trên" chỉ dùng khi đúng là có hình/khung đó trên slide).
  Một phép kiểm tự động bắt các cụm tham chiếu thị giác nhất định (vd "khung trò chuyện", "sơ đồ") mà slide không có hình/khung.

## AC5 — Tạo giọng theo slide

- Dùng chung bộ máy tạo giọng hiện có (NEU TTS, giọng chọn ở trang "Giọng đọc"; chạy nền trong máy chủ web).
- Lời giảng của slide là ghi chú giảng của nó, dấu vân là dấu vân của chữ ghi chú. **Một tệp MP3 cho mỗi slide**, mono 64 kbps, nên tạo lại một slide không đụng slide khác; mỗi slide lưu độ dài thật của tệp.
- Mỗi lần gọi bộ đọc **không quá 250 ký tự** (cắt theo câu) cho lời giảng của slide, để giảm lệch giọng giữa các đoạn.
- **Audio đã tạo không bao giờ tự đổi và không bị ẩn.** Ghi chú của slide sửa sau đó chỉ làm hiện dấu "lời đã đổi sau khi tạo
  giọng" ở trang quản trị và trình soạn (so dấu vân chữ ghi chú lúc tạo với hiện tại); học viên vẫn nghe tệp cũ. Chỉ khi
  **quản trị viên** bấm "Tạo lại" cho đúng slide đó ở trang quản trị thì tệp mới thay tệp cũ (trước đó hiện ước lượng chi phí và hỏi xác nhận).
- "Tạo giọng cho cả bài" **chỉ làm các slide chưa có giọng** (và slide từng lỗi); không bao giờ tạo lại slide đã có giọng.
- Bài giảng "sẵn sàng" khi có ít nhất một slide có giọng. Slide **chưa có giọng** (mới thêm sau khi tạo) vẫn hiện trong trình
  phát nhưng **không tự chuyển**: dừng chờ học viên bấm "Tiếp" (tự đọc); trang quản trị báo slide nào còn thiếu. Slide bị xoá
  hoặc ẩn thì bỏ qua cùng tệp của nó; đổi thứ tự slide thì giọng đi theo slide.
- Trang quản trị "Giọng đọc" thêm một dòng "Bài giảng slide" cho mỗi bài: trạng thái từng slide, tạo cả bài, tạo lại một slide,
  mở trình soạn slide. "Tạo lại" là thao tác riêng cho từng slide, có hỏi xác nhận.
- Chi phí/thời gian ước lượng hiện trước khi bấm tạo (số slide × số ký tự).

## AC6 — Trình phát tự học

- **Nút ở đầu bài.** Người sửa được khoá thấy "Xem slide ▾" (khi bài có bài giảng) với hai mục: "Xem slide để dạy" → trang trình chiếu
  của Limio-Live (dạy trực tiếp, có tương tác thật); "Xem slide để nghe giảng" → trình phát slideshow như học viên. Học viên **không**
  thấy "Xem slide"; họ thấy nút nghe giảng slide chỉ khi bài đã có giọng (AC5), và không thấy gì khi chưa có.
- **Given** bài có giọng slide, **when** học viên (hoặc giảng viên qua "Xem slide để nghe giảng") bấm nghe giảng slide, **then** mở trình phát slide toàn
  khung (trong trang bài học, đóng lại về đúng chỗ cũ): slide hiện lớn, thanh điều khiển ở dưới.
- Giọng đọc xong một slide thì **tự chuyển** sang slide kế sau một khoảng nghỉ ngắn (khoảng nửa giây); tệp slide kế được tải
  trước nên không khựng.
- Điều khiển: phát/tạm dừng, về slide trước/sang slide sau, tua trong slide, tốc độ 0,75–1,5×, đóng. Phím cách = phát/dừng,
  mũi tên trái/phải = slide trước/sau. Danh sách slide (hình nhỏ) để nhảy tới slide bất kỳ.
- Học viên **tự chuyển slide** khi đang phát thì giọng nhảy sang lời của slide đó; tạm dừng thì giữ nguyên chỗ.
- Tới slide tự kiểm tra: giọng đọc đề rồi **dừng chờ** học viên chọn; sau khi chọn và xem đáp án, bấm "Tiếp tục" (hoặc đợi,
  không tự đi tiếp khi chưa chọn). Học viên có thể bỏ qua slide tự kiểm tra bằng nút sang slide sau.
- Nhớ chỗ nghe dở theo bài: lần sau hỏi "Nghe tiếp từ slide k" hoặc "Nghe từ đầu" (theo id slide, nên đổi thứ tự vẫn đúng).
- Hết bài giảng hiện "Đã nghe xong" và nút nghe lại.
- Chạy tốt trên điện thoại (slide co theo màn hình, nút đủ lớn); tôn trọng "giảm chuyển động".
- Chuyển giữa bài giảng slide, giọng đọc theo bài viết, podcast thì cái này dừng, cái kia chạy; không phát chồng.
- "Nghe giảng" theo bài viết vẫn là nút riêng, không đổi.

## AC7 — Không tải, riêng tư

- Tệp âm thanh slide chỉ phát qua tuyến có kiểm quyền, cùng cơ chế với `nghe-giang-podcast.md` AC5 (không công khai, không
  cache, từ chối truy cập không phải thẻ `<audio>`). Không có nút tải; trình duyệt vẫn có thể lấy tệp khi đang phát — nói
  thật như bản trước.
- Ghi chú giảng và dấu vân bài viết chỉ trả cho người sửa được khoá.
- Dữ liệu đo (sự kiện nghe slide, tự kiểm tra) không chứa lời giảng hay câu hỏi; đưa vào xuất/xoá dữ liệu cá nhân của học viên
  như các sự kiện `narration.*` hiện có.

## AC8 — Đo lường

- Dùng lại `narration.started/completed/stopped` với `kind = "slides"`; thêm `narration.slide.checked` ({ lessonId, slideId,
  correct }). Ghi sự kiện không bao giờ được chặn hay làm chậm việc phát.
- `stopped` mang slide xa nhất đã tới và tốc độ.

## Cách làm theo giai đoạn (mỗi giai đoạn dừng cho bạn duyệt)

1. **Gắn bài giảng với bài học (AC1)** + xem slide chỉ đọc qua bài học, chưa có giọng.
2. **AI sinh từ bài viết (AC2, AC3)** + lời giảng từng slide (AC4); thử với Bài 1 của khoá mẫu, bạn xem chất lượng slide.
3. **Tạo giọng theo slide (AC5)** + trang quản trị.
4. **Trình phát tự học (AC6–AC8)**, thử trên máy dev và điện thoại; rồi mới đưa Bài 2–6.

## Điểm cần bạn xác nhận

1. Bài giảng của bài học thuộc **tài khoản chủ khoá** và nằm trong nhóm bài giảng tự tạo theo tên khoá — có ổn không?
2. Khoảng 12–16 slide cho bài 15 phút; lời mỗi slide ≤ 120 từ (khoảng 40 giây): đúng nhịp bạn muốn chưa?
3. Giọng slide dùng **chung giọng giảng viên** đã chọn ở trang "Giọng đọc" (không thêm vai mới): đồng ý?
4. Tự kiểm tra **không điểm** và không vào hồ sơ năng lực: đúng ý bạn?
