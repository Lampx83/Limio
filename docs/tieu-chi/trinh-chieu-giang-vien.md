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
- Chân dung thật của giảng viên: đã có ảnh tĩnh; video nói được (Ditto) làm ở AC7.
- Chọn người giảng ở phía học viên; slide tương tác cộng tác (bình chọn, bảng trắng).

## AC1 — Vào và thoát

> Bài dùng khung slide tương tác có lối vào và cách thoát riêng: xem `bai-slide-man-hinh-bia.md`.

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

## Bố cục và dừng chờ (01/11/2026, chiều)

- **Bố cục:** không có thanh nền trên cùng. «Thoát» ở góc trên trái, ảnh giảng viên nhỏ ở góc trên phải (viền sáng khi đang nói); phía dưới slide là phụ đề (không nền riêng, dùng nền và màu chữ của slide) rồi thanh chuyển slide: ‹ số trang › · phụ đề · toàn màn hình. Từ dưới 640px khung nhường dải 3,5rem phía trên cho hai nút này để không đè chữ slide.
- **Thanh phát** trong trình chiếu không đổ bóng, thanh tua và điều khiển chung một hàng từ `sm` (thấp khoảng một nửa).
- **Giao diện slide** theo Limio: màu nhấn xanh chanh `--brand`, nền sáng (phím T trong khung vẫn đổi sang tối); khi trình chiếu, slide liền một màu với vùng xung quanh (không viền thẻ, không quầng sáng bị cắt).
- **Dừng chờ học viên:** slide có `loiGiang.dungCuoi` được đánh dấu `data-dung-cuoi`; giọng đọc hết lời giảng của slide đó thì tạm dừng, hiện «Em làm xong rồi bấm Tiếp tục», nút › thành «Tiếp tục». Bấm Tiếp tục (hoặc ›) thì sang slide sau và giọng đi tiếp. Chưa nhận biết «làm xong» từ khung — học viên tự bấm.
- Đã kiểm trên máy dev (giọng giả): dừng ở slide 12 «Ghép hàm số», bấm Tiếp tục → 13 và giọng chạy; 375px không đè chữ.

## AC7 — Giảng viên nói thật (video Ditto, lip-sync)

Thầy Tiến Đạt hiện **to ở góc dưới bên phải**, rõ mặt, và **mở miệng nói khớp với giọng**. Video do Ditto (dịch vụ avatar của Vidgen trên server 232)
dựng từ ảnh `public/lecturers/tien-dat.jpg` và chính tệp giọng của bài; video **tắt tiếng**, chạy theo `audio.currentTime` của trình phát nên
trình phát, thanh tua, tốc độ, phụ đề không đổi gì.

- **Given** bài có giọng và đã nạp video giảng viên, **when** học viên vào trình chiếu và bấm phát, **then** góc dưới phải hiện video giảng viên
  (mặt rõ, cỡ lớn trên máy tính, nhỏ hơn trên điện thoại), miệng chuyển động khớp tiếng; tạm dừng giọng thì video dừng, tua giọng thì video nhảy theo.
- **Given** video lệch giọng quá 0,25 giây (tua, mạng chậm, tab nền), **then** video tự tua về đúng giờ của giọng; lệch nhỏ hơn thì không tua (không giật).
- **Given** đổi tốc độ nghe (0,75×–1,5×), **then** video chạy cùng tốc độ.
- **Given** bài chưa có video, video đã cũ (giọng được tạo lại sau khi dựng video), cờ tắt, hoặc video lỗi tải/phát, **then** góc dưới phải hiện ảnh tĩnh
  như trước, không báo lỗi cho học viên, giọng và slide chạy bình thường. Ảnh tĩnh cũng là ảnh bìa (`poster`) lúc video đang tải.
- Điện thoại (< 640px) hoặc bật tiết kiệm dữ liệu dùng bản 256 px (~1/3 dung lượng); từ 640px dùng bản 512 px. Video chỉ tải khi học viên vào trình chiếu.
- Quyền xem video giống Nghe giảng (`canListenToLesson`); tệp nằm ở lớp `private`, không có đường dẫn công khai, chỉ phục vụ cho phần tử `<video>` của trang
  (`Sec-Fetch-Dest: video`), cho tua (Range), không cho bộ nhớ đệm công cộng lưu.
- Bật/tắt bằng biến môi trường `NARRATION_LECTURER_VIDEO` (mặc định bật; `0`/`off` tắt cho mọi bài). Không có tên miền hay máy chủ nào ghi cứng trong mã.
- Chỉ ảnh tĩnh khi ở chế độ đọc (Nghe giảng cuộn) — video chỉ dùng trong trình chiếu.

### Dựng và nạp video

- Ditto nằm trong mạng riêng của server 232 nên **production không gọi được**: video dựng offline bằng `apps/web/scripts/build-lecturer-video.ts` (trên máy có ssh
  tới 232), rồi nạp bằng `apps/web/scripts/lecturer-video.ts attach`. Hướng dẫn ở `docs/van-hanh/giang-vien-ao-video.md`.
- Mỗi bài dựng **một video cả bài** dài đúng bằng tệp giọng, 25 hình/giây, tắt tiếng; mỗi đoạn giảng (`segments`) là một clip Ditto, khoảng lặng giữa hai đoạn giữ hình
  cuối clip trước. Ranh giới tính theo số hình tuyệt đối từ mốc giây nên không trôi dần.
- Script dựng **chạy lại được, idempotent**: đoạn đã có trong cache không gọi lại Ditto; bài đã dựng khớp ảnh + giọng + mốc đoạn thì bỏ qua. Script nạp mặc định chỉ
  in kế hoạch (dry run), ghi khi có `--apply`, bỏ qua bài đã nạp đúng bản, từ chối bài mà giọng đã đổi so với lúc dựng.
- Tạo lại giọng của bài thì video cũ không còn dùng (và bị xoá khỏi kho); cần dựng và nạp lại.

### Kiểm thử AC7

- Test hàm thuần (`lecturerVideoPlan.test.ts`): ranh giới clip theo số hình, tổng đúng độ dài giọng, đoạn chồng nhau bị từ chối, chọn bản theo bề rộng, ngưỡng tua.
- Test lõi (`narration.test.ts`): video chỉ tới học viên khi còn khớp giọng; tạo giọng lại làm video cũ; cờ tắt; nạp video từ chối khi giọng đã đổi.
- Duyệt tay (dev, video thật): desktop + 375px; tạm dừng/tua/đổi tốc độ; xoá video thì về ảnh tĩnh.

## Dải điều khiển một hàng, laser, nhịp nghỉ (01/11/2026)

- **Một hàng duy nhất** từ `sm` trở lên (slide cần nhiều chỗ nhất): chuyển slide + phụ đề (hoặc «Nghe tiếp từ / Nghe từ đầu» khi có lời mời nghe tiếp) · thanh tua · giờ · tốc độ · phát.
  `SlideDock` render **trong** thanh phát (không còn cụm nổi riêng); điện thoại vẫn tách thành cụm nổi phía trên thanh.
- Bỏ phần thừa: tên giảng viên + mã đoạn, nút Trước/Sau chữ, hàng tốc độ (gom vào nút «1×» bấm mới xổ ra), nút X trong thanh (đã có X thoát góc trên trái),
  bộ đếm «n / N» trong nút chuyển slide khi khung slide tương tác đã tự hiện ở góc trên, nút «hiện ý tiếp theo» trong slide (nút › ở thanh làm đúng việc đó).
- **Con trỏ laser là dấu duy nhất** chỉ chỗ đang giảng: không còn khung sáng viền xanh và nét gạch cam đè lên nội dung.
- **Nhịp nghỉ** (`NarrationPlayer`, chỉ bài dùng khung slide tương tác): hết mỗi đoạn giảng, giọng dừng 1,4 giây (2,6 giây khi sang slide mới, +0,9 giây nếu đoạn vừa rồi dài)
  rồi tự đi tiếp để học viên kịp nhìn và ngấm. Nút phát/dừng của học viên trong lúc nghỉ luôn thắng; slide chờ học viên làm đã có điểm dừng riêng nên không nghỉ chồng.
- **F5 giữ chỗ**: học viên chuyển slide / tua thì vị trí được nhớ dù giọng chưa bắt đầu phát; mở lại thấy đúng slide đó cùng lời mời nghe tiếp.
- **Một cửa vào**: khoá có lời mời «Học với giảng viên ảo» (mức Hiện) thì ẩn nút «Nghe giảng» ở đầu bài; học viên ẩn lời mời thì nút «Nghe giảng» hiện lại để không mất lối vào.
  Việc ẩn lời mời nhớ **theo từng tài khoản** (`limio:lecturer-invite:<khoá>:<userId>`), không theo trình duyệt — hai người dùng chung một máy không ẩn lây cho nhau.
