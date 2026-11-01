# Trình chiếu có giảng viên ảo — tiêu chí chấp nhận

> Bản 01/11/2026. Cho học sinh một cách học **như xem bài giảng**: mỗi mục của bài là một slide toàn màn hình, giảng viên ảo hiện bên cạnh
> với phụ đề chạy theo giọng, lời giải hiện từng bước, đồ thị kéo được ngay trên slide. Dựng **trên Nghe giảng có sẵn** (`nghe-giang-podcast.md`):
> cùng lời giảng bám mục/bước, cùng một tệp giọng, không bảng mới, không giọng từng slide.

## Vì sao không dùng LiveDeck

Slide Limio-Live là chữ thuần (không công thức KaTeX, không nhúng widget, không hiện từng bước) và cần giọng riêng từng slide
(`nghe-giang-slide.md` giai đoạn 3–4, chưa làm). Bài Toán đã có sẵn công thức, lời giải từng bước, đồ thị kéo được và lời giảng bám mục:
chỉ thiếu một **khung trình chiếu**. Dựng khung này thì mọi khoá có lời giảng (Toán 10, hàm số bậc hai, AI Research sau này) dùng được ngay.

## Chưa làm trong đợt này

- Giọng và lời giảng riêng cho slide LiveDeck (giai đoạn 3–4 của `nghe-giang-slide.md`).
- Chân dung thật của giảng viên (đang dùng khung tròn + màu; chờ Vidgen).
- Chọn người giảng ở phía học viên; slide tương tác cộng tác (bình chọn, bảng trắng).

## AC1 — Vào và thoát

- **Given** bài có Nghe giảng (đã có giọng), **when** học viên bấm «Học với giảng viên ảo» (thanh mời) hoặc nút «Trình chiếu» trên thanh phát,
  **then** nội dung bài thành các slide toàn màn hình; **Nghe giảng** ở đầu bài vẫn là chế độ đọc cuộn như cũ.
- **Given** đang trình chiếu, **when** bấm «Thoát» hoặc Esc, **then** về trang bài ở đúng mục đang giảng; giọng vẫn phát nếu đang phát.
- Mức «Bắt buộc» của giảng viên ảo vào thẳng trình chiếu; học viên vẫn thoát được trình chiếu về chế độ đọc, còn thanh phát vẫn không đóng được (như hiện nay).
- Bài chưa có giọng: không có nút trình chiếu, không lỗi.

## AC2 — Một mục = một slide

- Slide = một mục `##` của bài (kèm khối nhúng đứng ngay sau nó, vd đồ thị kéo được). Phần mở đầu trước mục đầu (mục tiêu, thời lượng) là slide bìa.
- Bài dựng theo bố cục nhiều mục trong một khối (`sections`) thì **mỗi mục** vẫn là một slide riêng.
- Giọng đang giảng tới mục/bước nào thì slide đó hiện; lời giải từng bước hiện tới bước đang giảng (cơ chế sẵn có).
- Bấm Trước/Sau hoặc phím ←/→ chuyển slide và giọng nhảy theo; học viên tự bấm «Bước tiếp» trong slide vẫn dùng được.
- Công thức, bảng, hộp ghi nhớ, đồ thị nhúng hiển thị đúng như trang bài; widget kéo được trong lúc đang giảng.

## AC3 — Giảng viên và phụ đề

- Giảng viên hiện trên **thanh phát** (tên, chân dung, hiệu ứng khi đang nói); trình chiếu không lặp lại khung giảng viên riêng. Phụ đề là câu đang đọc, chạy theo giọng.
- Phụ đề chia theo câu, thời gian chia theo số ký tự trong đoạn (ước lượng, không chính xác từng chữ). Tắt/bật được; nhớ trong trình duyệt.
- Học viên **nhận chữ lời giảng** (như podcast đã nhận bản chữ) để làm phụ đề. Không lộ ghi chú giảng của slide LiveDeck (không liên quan chế độ này).

## AC4 — Điện thoại và truy cập

- Điện thoại: slide co theo màn hình, không cuộn ngang, nút ≥ 44px, phụ đề phía trên thanh phát; công thức dài cuộn trong khung.
- Tôn trọng «giảm chuyển động». Bàn phím: cách = phát/dừng, ←/→ = slide trước/sau, Esc = thoát.
- Quyền truy cập đúng như Nghe giảng (`canListenToLesson`); không thêm đường lộ audio.
- Đo lường dùng lại `narration.*`; không thêm sự kiện.

## AC5 — Kiểm thử

- Test hàm thuần: chia slide từ DOM (mục đơn, nhiều mục trong một khối, khối nhúng đi kèm, bìa), chọn slide theo phần tử đang giảng, phụ đề theo thời gian, ghép chữ lời giảng vào đoạn cho học viên.
- Duyệt tay: desktop + 375px, giao diện sáng/tối, với bài Toán 10 (nhiều mục) và bài hàm số bậc hai (có đồ thị nhúng).

## Đã kiểm (01/11/2026, máy dev, giọng giả)

- [x] AC1 vào bằng «Học với giảng viên ảo» → slide toàn màn hình; Esc / «Thoát» về chế độ đọc, thanh phát còn nguyên và có nút «Trình chiếu» để vào lại.
- [x] AC2 bài Toán 10 «Hàm số bậc hai và đồ thị»: 20 slide (bìa + 19 mục); bài «đọc đồ thị parabol»: 9 slide, đồ thị nhúng nằm trong slide «Kéo thử». Trước/Sau nhảy giọng theo; slide không có lời giảng riêng («Những câu học sinh hay hỏi») vẫn tới được, giọng vẫn chạy.
- [x] AC3 phụ đề chạy theo câu, tắt/bật được.
- [x] AC4 375px: không cuộn ngang, nút ≥ 44px, ảnh giảng viên thu nhỏ trong thanh trên; token màu đổi theo giao diện tối.
- [x] AC5 test: `slideshow.test.ts` (17), `narration.test.ts` (chữ lời giảng tới học viên).
- [x] AC6 (máy dev, giọng giả) bài «Hàm số bậc hai»: giọng qua slide 2→3→4 thì khung theo; bấm Tiếp trong khung nhảy giọng tới bước kế, Lui nhảy ngược lại; 375px khung co theo, không cuộn ngang. Test: `deckSync.test.ts` (10), `decks.test.ts` (7), importer (anchor deck).
- [ ] Chưa kiểm: giọng NEU TTS thật; điện thoại thật; ghi nhớ giữa các thiết bị cho phụ đề (chỉ localStorage).

## AC6 — Bài dùng khung slide tương tác (`/decks/<id>`)

Slide chữ dựng từ trang bài (AC2) vẫn dùng cho mọi bài thường. Riêng bài **Toán 10 — slide tương tác** nhúng khung slide của SmartDoc
(kéo tham số, trắc nghiệm, ghép đôi, thẻ lật… ngay trên slide):

- **Given** bài có khối nhúng `/decks/<id>` và lời giảng toàn anchor `s<slide>b<bước>`, **when** học viên nghe giảng, **then** giọng sang đoạn nào
  thì khung nhảy tới đúng slide và bước đó (kể cả khi chưa bật trình chiếu, khung nằm trong trang).
- **Given** học viên tự bấm Tiếp / Lui / chọn slide trong khung (hoặc nút ‹ › của thanh trên, phím ←/→), **when** khung báo vị trí mới,
  **then** giọng nhảy tới đoạn tương ứng; lệnh do chính giọng gửi xuống không bị coi là thao tác của học viên (không lặp vô hạn).
- **Given** trình chiếu toàn màn hình, **then** khung chiếm trọn vùng giữa thanh trên và thanh phát, chữ giới thiệu của bài ẩn đi, thanh điều khiển
  đáy của khung ẩn (thanh phát Limio thay vào); thoát trình chiếu thì thanh ấy hiện lại để vẫn tự lật slide được.
- **Given** tin nhắn tới từ nơi khác (không phải iframe của bài, khác origin, sai giao thức), **then** bị bỏ.
- Importer chỉ nhận anchor `s<i>b<b>` khi bài có khối nhúng `/decks/…`; anchor lạ vẫn bị từ chối.
- Bộ slide là tệp JSON trong `apps/web/src/content/decks/` (id chỉ `[a-z0-9-]`, tải theo danh sách có sẵn, không đọc đường dẫn người dùng đưa);
  route `/decks/<id>` không lập chỉ mục (`noindex`) và nằm sau đăng nhập (`PRIVATE_PREFIXES`).
- Dựng khoá: `tsx apps/web/scripts/build-deck-course.ts <manifest.json>` rồi `pnpm import:course`.

## Giới hạn đã biết

- Bài viết liền **một khối nhiều `##`** (không phải bố cục `sections`) chỉ thành **một** slide dài, cuộn trong khung: DOM do React dựng, không xẻ ra được. Muốn mỗi mục một slide thì dựng bài bằng bố cục nhiều mục (importer làm sẵn).
- Phụ đề chia thời gian theo số ký tự, lệch vài giây ở câu dài là bình thường.
- Khung SmartDoc **chưa có cá nhân hoá**: chưa có gia sư riêng theo BKT, chưa ghi kết quả thao tác trong khung (trắc nghiệm, thanh trượt) vào `LearningEvent`/XP. Bước sau.
- Slide tương tác «dừng chờ học viên» (`dungCuoi`): giọng vẫn chạy tiếp sang slide sau, không tự dừng chờ.
- Phím ←/→ chỉ hoạt động khi tiêu điểm ở trang; khi đang bấm trong khung, khung tự xử lý phím của nó.
