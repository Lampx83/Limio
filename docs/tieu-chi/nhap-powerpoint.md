# Tiêu chí: nhập bài giảng PowerPoint (.pptx) vào Limio-Live

Bản mẫu đã duyệt: `docs/mockup/nhap-powerpoint.html` (2026-10-18). Luồng có ba bước (Tải file → Chọn cách chuyển → Đối chiếu),
sau đó vào trang dàn ý hiện có (sửa, xác nhận, tạo slide). Limio dựng lại bài theo giao diện Limio; màu, phông,
hiệu ứng của file gốc không được sao chép.

Mốc: (1) đọc .pptx và cách "Giữ ý, làm đẹp lại"; (2) cách "Soạn lại mạch" và màn đối chiếu; (3) bảng và biểu đồ gốc.
Vì nhánh đã có bố cục Bảng và Biểu đồ, mốc 1 dựng luôn bảng và biểu đồ ở dạng gốc khi vừa khung (P19–P20).

## Mô hình

- **M1.** Bài nhập từ PowerPoint là bài "tài liệu" (`LiveDeck.sourceKind = "document"`): luật số liệu như tài liệu tải lên.
  `sourceName` = tên file; `sourceText` = chữ của mọi slide (tiêu đề, gạch đầu dòng, ô bảng, số liệu biểu đồ, ghi chú giảng)
  để AI đọc và để kiểm số liệu.
- **M2.** Cột mới `LiveDeck.importSource` (JSON, null với bài không nhập từ file trình chiếu): `{ format: "pptx", fileName,
  slideCount, slides: [...] }`, mỗi slide gốc có số thứ tự, tiêu đề, các đoạn có cấp, ghi chú giảng, hình đã lưu, bảng,
  biểu đồ, các cờ "chỉ lấy được chữ" và cờ ẩn. Việc tạo slide (kể cả tạo lại) dựng từ cột này, không đọc lại file.
- **M3.** Mỗi dòng dàn ý có thể mang nguồn `origin = { slides: number[], how, piece?, pieces?, sig? }`:
  `how = "same"` (từ một slide gốc), `"merge"` (gộp nhiều slide gốc), `"split"` (một trong các slide AI tách từ một slide
  gốc dài), `"new"` (mới; `slides` không rỗng nghĩa là
  "dựa trên"), `"back"` (giảng viên thêm lại một slide gốc chưa dùng). `piece/pieces` khi một slide gốc dài phải chia
  thành nhiều slide Limio. `sig` là dấu của các ý lúc nhập, để biết giảng viên đã sửa các ý của dòng hay chưa.
  `sanitizeOutline` giữ nguyên trường này khi giảng viên lưu dàn ý.

## Bước 1: tải file và đọc

- **P1.** Given giảng viên ở trang "Tạo bài giảng", When chọn tab "PowerPoint", Then thấy vùng kéo thả nhận .pptx (tối đa 50 MB),
  câu hướng dẫn cho .ppt đời cũ, Google Slides và Keynote, và câu "Hình trong file được tính vào dung lượng lưu trữ".
- **P2.** Given file .ppt (đời cũ) hoặc .pptx có mật khẩu, When tải lên, Then báo "mở bằng PowerPoint rồi lưu lại thành .pptx"
  (có mật khẩu: bỏ mật khẩu rồi lưu lại), không tạo gì. File không phải trình chiếu hoặc hỏng: báo không đọc được.
- **P3.** Given file .pptx hợp lệ, When đọc xong, Then đọc đúng thứ tự slide trong file (theo `presentation.xml`, không theo tên file),
  kể cả slide ẩn (giữ trạng thái ẩn).
- **P4.** Tiêu đề lấy từ placeholder tiêu đề (`title`/`ctrTitle`); không có thì lấy dòng đầu của khối chữ trên cùng nếu ngắn;
  không có nữa thì "Slide N".
- **P5.** Gạch đầu dòng giữ cấp (`a:pPr lvl`) và thứ tự đọc (trên xuống, trái sang); chữ giữ nguyên, chỉ bỏ khoảng trắng thừa.
  Bỏ số trang, ngày, chân trang; bỏ khối chữ y hệt nhau lặp ở từ một nửa số slide trở lên (ít nhất 3 slide).
- **P6.** Ghi chú giảng lấy từ `notesSlides`, giữ nguyên chữ và xuống dòng.
- **P7.** Hình nhúng (PNG, JPEG, GIF, WebP) được giữ; hình cùng một tệp lặp ở từ một nửa số slide trở lên (ít nhất 3 slide)
  và nhỏ hơn 15% diện tích slide (logo) bị bỏ. Hình EMF/WMF/SVG không chuyển được thì báo.
- **P8.** Bảng (`a:tbl`) đọc thành hàng tiêu đề và các hàng ô chữ; biểu đồ (chart XML) đọc loại, nhãn, các chuỗi số và tên chuỗi
  từ bộ đệm số trong file.
- **P9.** Phần chỉ lấy được chữ được báo theo slide: SmartArt (lấy chữ các nút theo cấp), sơ đồ vẽ bằng hình khối (từ 3 hình
  khối có chữ hoặc có đường nối), công thức, video/âm thanh; hiệu ứng chuyển động và chuyển slide báo một dòng cho cả bài.
- **P10.** Màn đọc xong hiện: số slide, số slide có ghi chú giảng, số hình được giữ (và số logo đã bỏ), số bảng và biểu đồ,
  khung cảnh báo các phần chỉ lấy được chữ, dải xem nhanh các slide đã đọc, và thời lượng gợi ý.
- **P11.** Thời lượng gợi ý theo số slide: đến 12 slide → 15 phút; 13–19 → 30 phút; từ 20 → 45 phút. Giảng viên đổi được.
- **P12.** Việc đọc ở bước 1 diễn ra ngay trên trình duyệt (chưa tải file lên, chưa tốn dung lượng). File chỉ được gửi lên
  khi giảng viên bấm tạo dàn ý; máy chủ đọc lại file (không tin kết quả đọc của trình duyệt).

## Bước 2: chọn cách chuyển (một lần cho cả bài)

- **P13.** Hai lựa chọn: "Giữ ý, làm đẹp lại" (mặc định, không dùng AI) và "Soạn lại mạch" (dùng AI). Quay lại bước 1 được.

## Cách "Giữ ý, làm đẹp lại" (không AI)

- **P14.** Given cách "Giữ ý", When tạo dàn ý, Then mỗi slide gốc thành một dòng dàn ý theo đúng thứ tự, nguồn "từ slide N";
  không gọi AI ở bước nào (kể cả lúc tạo slide), không tốn token. Số slide của bài không bị cắt theo thời lượng.
- **P15.** Chữ không bao giờ bị cắt mất. Slide gốc nhiều chữ hơn bố cục chứa được thì chia thành slide tiếp theo cùng tiêu đề
  thêm "(tiếp)" (nguồn "từ slide N, phần k/m"); ý dài quá giới hạn được tách ở ranh giới câu, rồi dấu phẩy, rồi khoảng trắng.
- **P16.** Bố cục chọn bằng quy tắc:
  slide đầu có tiêu đề → Bìa (phụ đề = dòng phụ đề gốc); slide dùng layout "Section Header" → Mở phần;
  slide chỉ có tiêu đề (không chữ, không hình) → Bìa (ví dụ "Cảm ơn", "Câu hỏi?");
  có bảng → Bảng; có biểu đồ → Biểu đồ; SmartArt hoặc danh sách đánh số 2–5 mục ngắn → Các bước;
  2–4 mục cấp 1 đều có ý con, tên mục ngắn → Ba thẻ (tên mục là tiêu đề thẻ, ý con là câu giải thích);
  4–5 mục ngắn, không hình → Tóm tắt; còn lại → Chữ và hình (tối đa 3 ý một slide).
- **P17.** Hình lớn nhất của slide gốc vào ô hình của "Chữ và hình", hiện trọn hình (không cắt). Slide có nhiều hình: dùng hình lớn
  nhất và báo ở bước 1 slide nào có hình chưa đưa lên.
- **P18.** Ghi chú giảng gốc vào `presenterNote` nguyên chữ (slide chia nhiều phần: ghi chú ở phần đầu). Slide gốc không có
  ghi chú thì để trống. Giới hạn ghi chú nâng lên 6.000 ký tự; dài hơn thì báo.
- **P19.** Bảng vừa khung (≤ 5 cột, ô ≤ 60 ký tự) dựng bằng bố cục Bảng, mỗi slide tối đa 6 hàng (nhiều hơn thì chia slide,
  lặp hàng tiêu đề). Bảng không vừa thì mỗi hàng thành một ý "ô 1: ô 2 · ô 3".
- **P20.** Biểu đồ vừa khung (số nhãn theo loại, ≤ 2 chuỗi) dựng bằng bố cục Biểu đồ, số giữ nguyên từ file. Không vừa thì dựng
  Bảng (hoặc danh sách "nhãn: số"). Chữ thêm của slide có bảng/biểu đồ sang slide "(tiếp)".
- **P21.** Dàn ý chia phần như dàn ý cũ (Bìa đầu bài, mỗi slide Mở phần mở một phần Nội dung, slide Tóm tắt cuối vào Tổng kết).
  Không tự tạo phần Mục lục (để không ghi đè chữ của slide "Nội dung chính" gốc).
- **P22.** Given dòng dàn ý từ slide gốc, When giảng viên sửa tiêu đề, Then slide tạo ra dùng tiêu đề mới, phần thân vẫn từ slide gốc.
  When giảng viên sửa các ý, Then slide dựng từ các ý đã sửa (vẫn giữ hình và ghi chú gốc). When đổi bố cục, Then đổi nội dung
  gốc sang bố cục đó.
- **P23.** Tạo slide xong, mỗi slide nhập có `outlineId`, `aiGenerated` (để "cập nhật theo dàn ý" hoạt động như cũ) và bìa nhận
  tên đơn vị, người trình bày từ hồ sơ khi ô đó trống.

## Cách "Soạn lại mạch" (AI) — mốc 2

- **P24.** AI nhận chữ của mọi slide gốc (đánh số) và đề xuất dàn ý theo mạch cấu trúc (Bìa, Mục tiêu, Mục lục, Hook,
  các phần Nội dung có bìa phần, Tổng kết; buổi 15 phút theo mạch rút gọn), được gộp, tách slide và thêm slide tương tác.
  Mỗi dòng AI trả kèm `from` (các slide gốc dùng) và có thể `basis` (slide gốc làm căn cứ cho slide mới).
- **P25.** Không tin AI: số slide gốc ngoài khoảng bị bỏ; dòng `from` một slide → "same" (cùng slide gốc đứng một mình ở nhiều
  dòng → "split"); nhiều slide → "merge"; không có, hoặc slide tương tác → "new" (kèm `from`/`basis` làm căn cứ).
- **P26.** Dòng "same" được thay bằng (các) dòng dựng như cách "Giữ ý" (tiêu đề và chữ gốc, AI không đặt lại). Dòng "merge" do AI
  viết từ các ý của các slide gốc, ghi chú giảng là ghi chú gốc nối theo thứ tự slide (AI không viết lại). Dòng "split": ghi chú
  gốc ở dòng tách đầu tiên, các dòng sau giữ ghi chú AI viết cho phần của mình. Dòng "new" do AI viết, kể cả ghi chú.
  Slide Chữ và hình của dòng gộp/tách nhận hình của slide gốc đầu tiên có hình.
- **P27.** Lỗi AI (hết hạn mức, quá tải, hỏng định dạng) báo như luồng tạo từ tài liệu, không tạo bài rỗng.

## Bước 3: đối chiếu — mốc 2

- **P28.** Hai cột: slide gốc và dàn ý mới (chia nhóm theo phần). Mỗi dòng dàn ý ghi nguồn: "từ slide 4", "gộp slide 5, 6, 7 và 8",
  "mới", "mới, dựa trên slide 6, 7 và 8", "thêm lại từ slide 23".
- **P29.** Bấm một dòng dàn ý thì tô sáng các slide gốc của nó; bấm một slide gốc thì tô sáng các dòng dùng nó; khung chi tiết
  dính đáy màn hình cho biết ghi chú giảng được giữ thế nào.
- **P30.** Dòng độ phủ "22/24 slide gốc đã được dùng"; mỗi slide gốc chưa dùng có nút "Thêm lại vào dàn ý" (thêm cuối phần
  Tổng kết, nguồn "back", dựng như cách "Giữ ý").
- **P30b.** Đổi cách chuyển ở đầu bước 3 dựng lại dàn ý trên chính bài đã tạo từ dữ liệu đã đọc (không tải file lại); dàn ý đã
  dựng theo mỗi cách được giữ trong trang, nên đổi qua lại không gọi AI lần nữa.
- **P31.** Màn hình hẹp (< 900 px): một cột, có nút chuyển "Slide gốc / Dàn ý mới".

## Ghi sự kiện, quyền, dung lượng

- **P32.** Tạo bài từ PowerPoint ghi `live.deck.outline_generated` như luồng tài liệu, thêm `sourceFormat: "pptx"`, `importMode`
  ("keep" | "restructure"), `importedSlides`, `imageCount`.
- **P33.** Chỉ người có quyền `limio_live.access`; bài tạo ra thuộc người tải lên.
- **P34.** Hình được xử lý như ảnh của bảng cộng tác (≤ 1.600 px, bỏ EXIF, thumbnail WebP 480/960), lưu ở kho ảnh slide
  Limio-Live (tên file bắt đầu bằng mã người dùng nên tính vào dung lượng của người đó). Chỉ lưu hình được dùng.
