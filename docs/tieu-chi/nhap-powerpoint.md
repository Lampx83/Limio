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

## Tối ưu theo file thật (2026-10-18)

File thử: BL_ED2000_0103_Dinh_nghia_Pham_vi_Ver4.pptx (22 slide). Mọi slide dùng layout trống, không có placeholder: chữ nằm
trong hộp chữ, nhóm hình và hình khối. Các tiêu chí dưới đây áp cho slide không có placeholder tiêu đề (placeholder luôn thắng).

- **P35.** Vị trí của khối nằm trong nhóm hình được đổi sang toạ độ của slide (theo `chOff/chExt` của từng nhóm, lồng nhau),
  để thứ tự đọc và các quy tắc vị trí đúng với cái giảng viên nhìn thấy.
- **P36.** Given slide không có placeholder tiêu đề, When đọc, Then tiêu đề là khối chữ ngắn có cỡ chữ lớn nhất (ưu tiên khối ở
  phần trên slide và chữ đậm; khối có gạch đầu dòng không được chọn). Ví dụ: "NHẬP MÔN CÔNG NGHỆ GIÁO DỤC" (54 pt) chứ không
  phải "Nhóm chuyên môn: …" (24 pt) nằm phía trên; "NỘI DUNG BÀI HỌC" (36 pt, đầu slide) chứ không phải các mục 40 pt ở giữa.
- **P37.** Tiêu đề ngắt thành nhiều khối liền nhau ("ĐỊNH NGHĨA VỀ" + "CÔNG NGHỆ GIÁO DỤC") được ghép thành một khi các khối sát
  nhau theo chiều dọc, chồng nhau theo chiều ngang, cùng kiểu chữ hoa hay thường và cỡ chữ không nhỏ hơn 55% khối lớn nhất.
- **P38.** Khối chữ nhỏ hơn nằm phía trên tiêu đề là dòng dẫn (kicker): "NỘI DUNG 1", "Nhóm chuyên môn: Công nghệ giáo dục".
  Slide đầu: dòng dẫn thành tên đơn vị của bìa. Dòng dẫn dạng "Nội dung 1", "Phần 2", "Chương III" làm slide thành slide Mở phần,
  số phần lấy từ dòng dẫn, tên phần là tiêu đề. Dòng dẫn khác vẫn được giữ, đứng đầu nội dung slide.
- **P39.** Bỏ chữ trang trí: khối chỉ có số (số trang, số thứ tự "01", "1") và khối chỉ có một ký tự không phải chữ số (ký tự
  biểu tượng như "z").
- **P40.** Dòng ghi nguồn hình ("Nguồn ảnh minh hoạ: …", "Nguồn: …", "Ảnh: …") không thành gạch đầu dòng: thành dòng nguồn ở
  chân slide (`cite`). Dài quá 80 ký tự thì giữ làm một ý để không mất chữ.
- **P41.** Trong cùng một khối, các đoạn là dòng ngắt của một câu được ghép lại: đoạn trên không có dấu kết câu, không có gạch
  đầu dòng, và (cả hai viết hoa toàn bộ, hoặc đoạn dưới bắt đầu bằng chữ thường).
- **P42.** Nhãn và nội dung của nhãn: nhãn là khối đậm, ngắn (≤ 40 ký tự, ≤ 5 từ, không dấu kết câu, không gạch đầu dòng).
  Khối nội dung nằm cùng hàng bên phải nhãn, hoặc cùng cột bên dưới nhãn, thuộc nhãn gần nhất: nhãn thành ý cấp 1, nội dung
  thành ý con ("Bản chất: Ứng dụng công nghệ như công cụ hỗ trợ giảng dạy"). Từ 3 nhãn cùng cỡ chữ không có nội dung riêng, nhãn
  ngắn hẳn (≤ 12 ký tự, ≤ 60% độ dài trung vị của các nhãn còn lại) là nhãn chung, các nhãn còn lại là ý con của nó ("Ví dụ: …").
- **P43.** Slide không phải slide đầu có tiêu đề trùng tiêu đề slide đầu và tối đa 3 dòng ngắn (≤ 80 ký tự) là slide kết: dựng
  bằng bố cục Bìa.
- **P44.** "Thêm lại vào dàn ý" chèn slide gốc vào đúng vị trí theo thứ tự gốc: ngay sau dòng cuối cùng lấy từ slide gốc có số nhỏ
  hơn (thay cho P30 "cuối phần Tổng kết"), cùng phần với dòng đó.
- **P45.** Chữ cho AI đọc (cách Soạn lại mạch) ghi cả dòng dẫn, không ghi dòng nguồn hình. Lời nhắc thêm: slide gốc có dòng dẫn
  "Nội dung n" là slide mở phần, dùng tên của nó làm tên phần; giữ slide tài liệu tham khảo ở cuối bài; hoạt động yêu cầu người
  học làm là slide tương tác, không phải slide nội dung hay trích dẫn.
- **P46.** Bảng luôn giữ dạng bảng (thay cho P19 "bảng không vừa thì thành danh sách"): ô dài tới 200 ký tự (cỡ chữ tự co), bảng
  rộng hơn 5 cột chia theo nhóm cột và lặp cột đầu, nhiều hàng thì chia slide và lặp hàng tiêu đề. Chỉ bảng một cột, hoặc có
  ô dài hơn 200 ký tự, mới thành danh sách để không mất chữ. Hai hoặc nhiều hộp cao gần bằng nhau đặt cạnh nhau, mỗi hộp có
  dòng đầu đậm và các gạch đầu dòng, cũng dựng thành bảng (hàng tiêu đề là dòng đầu của các hộp).
- **P47.** Bố cục mới "Danh sách": tiêu đề và tối đa 12 dòng (ý và ý con) trên cả bề ngang, chữ tự co từ 44 px xuống 26 px, có thể
  kèm ô hình bên phải. Cách "Giữ ý": danh sách phẳng tối đa 3 ý ngắn vẫn dùng "Chữ và hình"; nhiều ý hơn, có ý con, hoặc có ý dài
  hơn 140 ký tự thì dùng Danh sách (không cắt đôi câu), nên mỗi slide gốc thường là đúng một slide. Chỉ khi ở 26 px vẫn không
  vừa mới chia slide "(tiếp)". Giảng viên đổi được sang hoặc từ Danh sách như mọi bố cục, sửa từng dòng và đổi ý ↔ ý con.
- **P48.** Slide giữa bài chỉ có tiêu đề (hoặc thêm một dòng nối tiêu đề, không phải câu đã kết) là slide Mở phần; tiêu đề đánh số
  "2. …" cho số phần và tên phần là phần chữ sau số. Các slide giữa Bìa và slide Mở phần đầu tiên thuộc phần Mục tiêu (nếu có
  slide mục tiêu) hoặc phần Bìa, để số phần khớp bài gốc.
- **P49.** Chú thích hình ("Figure 1b: …", "Fig. 2 …", "Hình 3. …", "Bảng 1: …") không bao giờ là tiêu đề hay một ý: thành mô tả của ảnh
  (`imageAlt`) khi slide Limio có ảnh. Hộp chữ mang tên "Title…" (tiêu đề dán lại thành hộp chữ, cỡ chữ lấy từ mẫu nên không ghi trong
  file) là tiêu đề; nhiều hộp cùng tên thì lấy hộp chữ lớn nhất. Slide đã có placeholder tiêu đề thì hộp "Title…" còn lại là dòng dẫn.
  "Source: https://…" hiện ở chân ô hình bằng tên trang (freepik.com), đường dẫn đầy đủ giữ ở `imageSourceUrl`.
- **P50.** Hai cấp ý trong một khối: dòng đậm hoặc kết bằng dấu hai chấm, không gạch đầu dòng, là ý cha của các gạch đầu dòng ngay sau
  nó ("Research findings:" → các kết quả); đoạn thường không gạch đầu dòng kết thúc nhóm. Bố cục Danh sách hiện ý con thụt vào.
- **P51.** Dòng nguồn ảnh và dòng nguồn chân slide nằm ở lề dưới theo thiết kế, không tính vào phép đo tràn khung: trước đây slide
  nào có nguồn ảnh cũng bị coi là tràn và chữ co về 26 px dù còn nhiều chỗ.
- **P52.** Chữ được nhấn ở slide gốc được giữ lại. Cụm chữ có màu nổi khác màu chủ đạo của khối, hoặc có tô nền (highlight), thành chữ
  **tô màu** (`==chữ==`, hiện bằng màu nhấn của giao diện slide và vệt bút dạ). Cụm chữ đậm hoặc nghiêng *một phần* đoạn thành in đậm
  hoặc in nghiêng; cả đoạn đậm là kiểu của đoạn, không phải chỗ nhấn. Màu trung tính (đen, trắng, xám, màu chữ và màu nền của mẫu)
  không phải chỗ nhấn. Một vài câu dài (không quá một phần tư số đoạn) mang màu riêng trong khi phần lớn slide là chữ thường, như câu
  trích dẫn chốt tô đỏ, cũng thành tô màu. Dấu chỉ đặt lên chữ thân slide (dòng, ý, thẻ, cột, ô bảng), không lên tiêu đề, và không
  có trong dàn ý; dấu làm chữ vượt giới hạn độ dài thì bỏ dấu, giữ chữ. Trình sửa slide có thêm nút **Tô màu** (Ctrl+Shift+H) cạnh
  In đậm và In nghiêng; màu luôn là màu nhấn của giao diện, không chọn màu tuỳ ý (sửa tiêu chí H3).
- **P53.** Cụm từ khoá rải trên slide (ít nhất 3 từ, mỗi từ tối đa 3 chữ và 24 ký tự, không dấu câu cuối, có ít nhất 2 màu nhấn khác
  nhau; mỗi từ một hộp chữ hoặc một hộp nhiều dòng một từ) không thành gạch đầu dòng. Slide đó dùng Danh sách: các dòng rồi đến cụm
  từ, chữ lớn hơn chữ dòng một bậc, xen hai màu nhấn của giao diện, không khung, không nền. Cụm từ không tính vào 12 dòng; không còn
  chỗ thì sang slide "(tiếp)". Slide chỉ có tiêu đề và cụm từ không phải slide Mở phần. Nhãn ngắn cùng một màu (chữ trong sơ đồ)
  không phải cụm từ. Giảng viên sửa cụm từ trong một ô, các từ cách nhau bằng dấu phẩy, tối đa 16 từ.
- **P54.** Dòng chỉ có tên tác giả ("- Alice Morse Earle", "— Abraham Lincoln") ngay sau câu kết bằng ngoặc kép được ghép vào câu đó:
  "“…” — Alice Morse Earle". Danh sách phải chia slide thì chia đều theo độ dài chữ, để slide sau không chỉ còn một hai dòng lẻ.
