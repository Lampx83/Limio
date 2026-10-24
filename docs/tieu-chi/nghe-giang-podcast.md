# Nghe giảng và Podcast — Acceptance criteria

> Trạng thái (24/10/2026): **4 quyết định đã chốt (xem cuối file), đang code.** Nguồn lời giảng và kịch bản: `docs/hoc-lieu/tu-duy-phan-bien-ai/`
> (mỗi bài có `lecture` và `podcast`). Quyết định đã chốt trước đó: giọng NEU TTS; giảng viên ảo xưng "mình – bạn" với ảnh
> đại diện và sóng âm; làm cả hai hình thức; phạm vi khoá mẫu trước.

## Vì sao làm

Học viên tự vào Limio cần một lý do để ở lại. Một bài đọc 20 phút bằng chữ dễ bị bỏ giữa chừng, trong khi nghe một giảng
viên giảng hoặc hai người trò chuyện về bài thì nhẹ hơn, làm được khi di chuyển, và giúp người đọc chậm vẫn theo kịp.
Khoá mẫu "Tư duy phản biện thời AI" đã có sẵn lời giảng và kịch bản podcast cho cả sáu bài; thiếu phần giọng đọc và
trình phát.

## Phạm vi

- **Làm lần này:** lưu lời giảng và kịch bản cùng bài; quản trị bấm "Tạo giọng" để tạo tệp âm thanh một lần; học viên bấm
  "Nghe giảng" hoặc nghe "Podcast" trong trang bài học; áp dụng được cho mọi bài có dữ liệu, nhưng chỉ khoá mẫu có dữ liệu.
- **Chưa làm:** nút "AI soạn lời giảng" cho giảng viên tự dùng với bài của mình; tải tệp âm thanh tự thu của giảng viên;
  đa ngôn ngữ; tải về để nghe offline.

## AC1 — Lưu lời giảng và kịch bản cùng bài

- **Given** manifest nhập khoá có `lecture` và `podcast` cho một bài, **When** nhập khoá, **Then** hệ thống lưu hai bản ghi
  gắn với bài đó (loại `lecture` và `podcast`) ở trạng thái "chưa có giọng", kèm nguyên văn đoạn lời và một mã băm của kịch bản.
- **Given** nhập lại cùng khoá với kịch bản không đổi, **Then** không tạo bản ghi trùng, không làm mất giọng đã tạo.
- **Given** kịch bản đã đổi so với lần tạo giọng gần nhất (mã băm khác), **Then** bản ghi được đánh dấu "giọng đã cũ" và nút
  "Nghe giảng" / "Podcast" của học viên **ẩn đi** cho tới khi quản trị tạo lại giọng, thay vì phát lời không khớp với trang.
- Công cụ nhập báo lỗi khi `anchor` của một đoạn lời giảng không khớp `mo-dau`, `tong-ket` hay tiêu đề của một mục trong bài.

## AC2 — Quản trị tạo giọng

- **Given** quản trị mở trang quản lý khoá, **Then** mỗi bài có dữ liệu hiện hai dòng "Nghe giảng" và "Podcast" với trạng
  thái: chưa có giọng, đang tạo (kèm tiến độ %), sẵn sàng (kèm thời lượng), giọng đã cũ, lỗi (kèm lý do).
- **When** quản trị bấm "Tạo giọng" cho một dòng hoặc "Tạo giọng cho cả khoá", **Then**:
  - việc chạy nền, trang không bị giữ; trang tự cập nhật tiến độ;
  - lời giảng đọc bằng một giọng; podcast đọc theo lượt, mỗi người dẫn một giọng riêng;
  - các đoạn nối nhau có khoảng lặng ngắn (khoảng 0,5 giây giữa các mục, 0,3 giây giữa các lượt thoại);
  - kết quả là **một tệp** cho mỗi lần tạo, kèm mốc thời gian bắt đầu và kết thúc của từng đoạn (lời giảng) hoặc từng lượt (podcast).
- **Given** một đoạn lỗi (NEU TTS không phản hồi), **Then** thử lại tối đa 3 lần với thời gian chờ tăng dần; vẫn lỗi thì trạng
  thái "lỗi" nêu rõ đoạn nào, và bấm "Tạo giọng" lần nữa chỉ làm lại phần còn thiếu, không làm lại từ đầu.
- **Given** đang tạo giọng cho một bài, **When** bấm "Tạo giọng" cùng bài lần nữa, **Then** không chạy hai việc song song.
- Chỉ quản trị nền tảng bấm được; giảng viên và học viên không thấy nút.
- Giọng đọc chọn trong cài đặt (một giọng giảng viên, hai giọng podcast) lấy từ danh sách giọng của NEU TTS; chưa chọn thì
  dùng giọng mặc định đã cấu hình và quản trị được cảnh báo rằng podcast đang dùng cùng một giọng cho hai người.
- Tệp âm thanh có kích thước hợp lý để phát trên điện thoại: lời giảng khoảng 25 phút không vượt 25 MB.

## AC3 — Học viên nghe giảng

- **Given** bài có lời giảng ở trạng thái sẵn sàng, **Then** trên đầu bài, cạnh nút "In / Lưu PDF", có nút **"Nghe giảng"** kèm
  thời lượng ("Nghe giảng · 14 phút"). Không có lời giảng sẵn sàng thì không hiện nút, không hiện chỗ trống.
- **When** bấm "Nghe giảng", **Then** hiện một **thanh phát** dính ở cuối màn hình gồm: ảnh đại diện giảng viên ảo có tên,
  sóng âm chuyển động khi đang nói, nút phát/dừng, thanh tua, tốc độ (0,75 · 1 · 1,25 · 1,5), tên mục đang giảng, nút sang mục
  trước/sau, nút đóng. Thanh phát không che các nút nổi sẵn có của trang (mục lục, trợ lý, ghi chú); các nút đó được đẩy
  lên khi thanh phát đang hiện.
- **Given** đang phát, **Then** mục tương ứng trong bài được **tô sáng** và trang **tự cuộn** để mục đó nằm trong tầm nhìn.
  Học viên tự cuộn đi chỗ khác thì trang ngừng tự cuộn và hiện nút "Theo giảng viên" để bật lại; tô sáng vẫn chạy.
- **When** học viên bấm vào một mục của bài, hoặc dùng nút mục trước/sau, hoặc tua, **Then** âm thanh nhảy đúng tới đầu đoạn
  lời giảng của mục đó.
- Phần mở đầu (`mo-dau`) tô sáng khối đầu bài; phần tổng kết (`tong-ket`) tô sáng khối tổng kết; khi lời giảng nhắc tới ảnh
  hay sơ đồ, mục chứa ảnh đang được tô sáng.
- **Given** bài có mục không có đoạn lời (vd "Tài liệu tham khảo"), **Then** không tô sáng và không dừng ở mục đó.
- Phát xong thì thanh phát hiện "Đã nghe xong" và nút "Nghe lại"; không tự chuyển sang bài khác.
- Nhớ vị trí nghe dở của từng bài trong trình duyệt; mở lại bài thì thanh phát đề nghị "Nghe tiếp từ 06:12".
- Mở một trình phát âm thanh khác trong trang (video, podcast, ô nghe phát âm) thì "Nghe giảng" tự tạm dừng, không phát chồng nhau.
- Tuân theo thiết lập giảm chuyển động của hệ điều hành: sóng âm đứng yên, trang không tự cuộn mượt mà nhảy thẳng.
- Dùng được bằng bàn phím và trình đọc màn hình: nút có nhãn, thanh tua có giá trị đọc được, phím cách phát/dừng khi thanh phát có tiêu điểm.
- Màn hình điện thoại (dưới 640 px): thanh phát chiếm đủ chiều ngang, gọn một hàng khi thu nhỏ, bấm vào để mở rộng; không có thanh cuộn ngang.

## AC4 — Học viên nghe Podcast

- **Given** bài có podcast sẵn sàng, **Then** trên trang bài hiện một thẻ **"Podcast"** gồm tên tập, thời lượng, tên hai người dẫn
  và nút phát; thẻ nằm ngay dưới phần mục tiêu của bài.
- **When** phát, **Then** dùng cùng trình phát với "Nghe giảng" (tốc độ, tua, nhớ vị trí, không phát chồng) nhưng **không**
  tô sáng và tự cuộn trang, vì podcast nghe được cả khi không nhìn màn hình.
- Thẻ có bản chữ **theo lượt**, mở được: mỗi lượt ghi tên người nói, lượt đang phát được tô sáng, bấm vào một lượt thì nhảy tới đó.
- Podcast phát tiếp được khi học viên chuyển sang tab khác hoặc khoá màn hình điện thoại (theo khả năng của trình duyệt).

## AC5 — Quyền truy cập và riêng tư

- **Học viên chỉ nghe, không tải về.** Trình phát không có nút "Tải xuống" (phần tử âm thanh đặt `controlsList="nodownload"`,
  không có menu tải trên thanh phát của Limio), và không có đường dẫn công khai tới tệp trong HTML của trang.
- Tệp chỉ phát được cho người **được xem bài đó**: học viên đã ghi danh, người đọc công khai khi khoá cho đọc công khai và
  bài không ẩn, người sửa được khoá. Khoá chưa xuất bản hoặc bài ẩn thì trả 403/404 dù biết đường dẫn.
- Không dùng đường dẫn "bí mật theo tên tệp" như tệp âm thanh bài học hiện nay; mỗi lượt tải đi qua tuyến kiểm quyền theo bài.
- Tuyến chỉ phục vụ yêu cầu do **phần tử âm thanh của trang** gửi (tiêu đề `Sec-Fetch-Dest: audio`); mở thẳng đường dẫn trên
  thanh địa chỉ hoặc dán sang tab khác để tải sẽ bị từ chối. Phản hồi để `inline`, cho phép tua (Range), `Cache-Control:
  private, no-store`, không để bộ nhớ đệm công cộng (CDN) lưu giữ.
- **Giới hạn nói thẳng:** trình duyệt buộc phải nhận dữ liệu âm thanh thì mới phát được, nên không thể chặn tuyệt đối việc
  người rành kỹ thuật ghi lại tệp. Mục tiêu là không có đường tải tiện lợi, không lộ liên kết công khai, và không dùng
  được ngoài phiên đăng nhập của người được xem bài.
- Tệp được tính vào sổ dung lượng của khoá (`StoredFile`), gắn đúng khoá và chủ khoá, để sau này đo được dung lượng.

## AC6 — Đo lường

- Ghi sự kiện `narration.started` (bài, loại lời giảng hay podcast, nghe từ đầu hay nghe tiếp), `narration.completed`, và
  `narration.stopped` kèm phần trăm đã nghe và tốc độ. Không ghi nội dung; ghi sự kiện **không** làm chậm hay chặn việc phát.
- Mục tiêu thành công: sau 2 tuần, tỷ lệ học viên mới hoàn thành bài 1 (làm xong quiz) cao hơn nhóm trước đó; xem được số
  người dùng nút "Nghe giảng" / "Podcast" và phần trăm nghe hết.

## AC7 — Phát triển và kiểm thử

- Máy dev không có khoá NEU TTS, nên có bộ đọc **giả** (tạo tiếng bíp theo độ dài đoạn) để làm và thử toàn bộ luồng; bộ đọc
  thật chỉ chạy khi có cấu hình, và bộ đọc giả bị chặn ở môi trường production.
- Có test cho: chia đoạn dưới giới hạn ký tự, ghép tệp và tính mốc thời gian, đánh dấu "giọng đã cũ" khi kịch bản đổi,
  kiểm quyền tải tệp, ánh xạ `anchor` với tiêu đề mục, và chọn mục theo thời điểm đang phát.
- Thử trên trình duyệt cả máy tính lẫn điện thoại, và gửi ảnh chụp trước khi xin duyệt.

## Đã chốt (24/10/2026)

1. **Nơi tạo giọng:** container web, chạy nền; trạng thái lưu trong cơ sở dữ liệu, tạo lại thì chỉ làm phần còn thiếu. Không đổi
   hạ tầng triển khai (mọi bản web đã dùng chung thư mục tệp tải lên).
2. **Định dạng:** ghép WAV của NEU rồi mã hoá **MP3 mono 64 kbps ngay trong Node** bằng `@breezystack/lamejs` (đã thử: 10 phút
   âm thanh mã hoá trong 7,5 giây, 25 phút khoảng 11 MB). Thư viện này theo giấy phép **LGPL-3.0** (vì là bản chuyển của LAME);
   dùng phía máy chủ, không phân phối lại, nhưng cần biết khi có kiểm tra giấy phép phần mềm.
3. **Quyền tải:** học viên **không tải về**; tuyến riêng kiểm quyền theo bài như AC5.
4. **Giọng cụ thể** cho giảng viên và hai người dẫn podcast: chọn sau khi nghe thử danh sách giọng ở Quản trị › Tích hợp trên
   máy chủ; không chặn việc code (máy dev dùng bộ đọc giả).
