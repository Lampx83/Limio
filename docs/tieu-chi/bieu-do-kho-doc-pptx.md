# Tiêu chí: biểu đồ khó đọc trong bài PowerPoint

Bổ sung cho `docs/tieu-chi/nhap-powerpoint.md` (P8, P20). Bản mẫu hướng 2: `docs/mockup/ve-lai-bieu-do-tu-hinh.html`.

Hai trường hợp mà bộ đọc .pptx hiện chưa dựng được biểu đồ Limio:

1. **Biểu đồ dán từ Excel dạng đối tượng nhúng (OLE).** Khung `p:graphicFrame` có `a:graphicData uri=".../presentationml/2006/ole"`,
   chứa `p:oleObj r:id` trỏ tới một gói Excel trong `ppt/embeddings/`. Hiện bị gắn cờ `object`. Số có sẵn trong gói Excel, nên đọc
   thẳng, **không cần AI**.
2. **Biểu đồ là hình chụp.** File chỉ có ảnh; số không có ở đâu khác. Slide giữ hình. Giảng viên có thể nhờ AI đọc số từ ảnh,
   nhưng **số AI đọc chỉ lên slide sau khi giảng viên đối chiếu**.

Quy ước chung: không bịa số liệu; giảng viên ít thao tác; chữ của giảng viên giữ nguyên.

## Hướng 1: đọc số từ Excel nhúng (không AI)

- **E1.** Given slide có khung đồ hoạ OLE (`uri` kết thúc bằng `/ole`) mà `p:oleObj` (trong `mc:Choice`, `mc:Fallback` hoặc đứng
  thẳng) có `r:id` trỏ tới tệp `.xlsx` hoặc `.xlsm` trong gói, When đọc file, Then mở gói Excel đó và không gắn cờ `object`
  cho khung này nếu đọc được biểu đồ hoặc bảng.
- **E2.** Given gói Excel có biểu đồ (trang biểu đồ riêng, hoặc biểu đồ đặt trong trang tính đang hiện), When đọc, Then lấy biểu đồ
  của trang đang hiện (`workbookView@activeTab`; chỉ khi không xác định được trang đang hiện mới lấy biểu đồ đầu tiên của sổ;
  trang đang hiện là trang tính không có biểu đồ thì đọc thành bảng theo E4) bằng cùng bộ đọc chart XML như biểu đồ PowerPoint
  (loại, tiêu đề, nhãn, tên chuỗi, số, đơn vị %), rồi dựng như P20 (Biểu đồ nếu vừa khung, không thì Bảng).
- **E3.** Given biểu đồ trong gói Excel không lưu bộ đệm số (`c:numRef` chỉ có công thức `c:f`), When đọc, Then lấy số từ các ô mà
  công thức trỏ tới (`'Tên trang'!$B$2:$B$6`) trong chính gói đó. Ô trống hoặc không phải số thì để trống, không đoán.
- **E4.** Given gói Excel không có biểu đồ (dán vùng ô thành bảng tính nhúng), When đọc, Then đọc vùng đang hiện trên slide
  (`oleSize ref` trong `workbook.xml`; không có thì vùng có dữ liệu của trang đang hiện) thành Bảng: hàng đầu là hàng tiêu đề; bỏ
  hàng và cột trống ở rìa. Tối đa 200 hàng × 12 cột; vượt thì cắt và vẫn dựng, phần cắt không bịa thêm.
- **E5.** Số trong ô bảng hiện như Excel hiện: ô định dạng phần trăm (mã định dạng 9, 10 hoặc có `%`) thành "25%" (giá trị 0,25),
  số thường bỏ nhiễu dấu phẩy động (0,30000000000000004 → 0,3) và dùng dấu phẩy thập phân như các bảng khác của Limio. Chữ giữ nguyên
  (chuỗi dùng chung và chuỗi trong ô). Ô công thức lấy giá trị đã tính lưu trong file (`<v>`), không tính lại.
- **E6.** Given biểu đồ PowerPoint thường (chart XML) mất bộ đệm số nhưng có `c:externalData` trỏ tới gói Excel trong
  `ppt/embeddings/`, When đọc, Then lấy số từ gói đó như E3.
- **E7.** Given đối tượng nhúng không phải gói Excel mới (`.bin` của Excel 97–2003, Word, PDF…) hoặc gói Excel hỏng, When đọc, Then giữ
  hành vi cũ: gắn cờ `object`, không ném lỗi, các phần khác của slide vẫn đọc bình thường.
- **E8.** Báo cáo sau khi đọc (P10) đếm biểu đồ và bảng từ Excel nhúng cùng với biểu đồ, bảng thường, và thêm câu "N biểu đồ/bảng đọc
  số từ bảng Excel nhúng trong file" khi N > 0. Chữ của đối tượng nhúng đã đọc được đi vào `sourceText` như bảng và biểu đồ thường (M1).

## Hướng 2: vẽ lại biểu đồ là hình chụp (AI đọc ảnh, giảng viên đối chiếu)

Điều kiện tiên quyết: mô hình chat tự host nhận được ảnh (`image_url` trong `/chat/completions`). Chưa kiểm được thì không làm hướng 2.

- **V1.** Given slide bố cục Chữ và hình có hình đã lưu trong Limio (địa chỉ `/api/…`: hình nhập từ PowerPoint hoặc giảng viên tải
  lên), When mở cửa sổ sửa, Then thấy nút "Vẽ lại thành biểu đồ" dưới ô hình kèm một câu giải thích. Slide không có hình, hình minh hoạ
  mặc định, hoặc địa chỉ ảnh bên ngoài: không có nút.
- **V2.** When bấm nút, Then phần Nội dung chuyển thành màn đối chiếu trong cùng cửa sổ: hình gốc (bên trái; dưới 900 px thì ở trên,
  chạm để phóng to) và trạng thái "AI đang đọc số trong hình…". Slide chưa thay đổi gì.
- **V3.** Máy chủ (`POST …/slides/[slideId]/chart-from-image`) chỉ nhận slide của chính giảng viên; đọc hình từ kho lưu trữ của Limio
  theo `imageUrl` của slide (không tải địa chỉ ngoài); gửi ảnh cho AI; trả **đề xuất**, **không ghi gì vào slide**. Tính vào hạn mức AI
  như các lệnh AI khác của slide.
- **V4.** Kết quả AI được kiểm trước khi trả: loại biểu đồ thuộc {cột dọc, thanh ngang, đường, tròn, vành khuyên}; 2 ≤ số nhãn ≤ giới hạn
  lưu của bố cục Biểu đồ; ≤ 2 chuỗi; mỗi số hữu hạn hoặc trống; mỗi số kèm cờ "ghi trên hình" hay "ước lượng theo trục".
  AI trả "không phải biểu đồ", JSON hỏng hoặc không qua kiểm: Then hiện "Hình này không giống biểu đồ có số đọc được", slide giữ hình.
- **V5.** Given AI đọc xong, Then bảng số điền sẵn nhãn, tên chuỗi, giá trị, loại biểu đồ, đơn vị, tiêu đề (giữ tiêu đề slide hiện tại).
  Mọi dòng bắt đầu ở trạng thái **chưa đối chiếu** (nền vàng nhạt). Số AI ước lượng theo trục mang dấu "≈ ước lượng", và màn hiện câu
  cảnh báo "Hình không ghi số trên cột…".
- **V6.** Đối chiếu theo dòng: nút "Khớp" ở cuối mỗi dòng; sửa nhãn hoặc số của dòng nào thì dòng đó tính là đã đối chiếu; nhấn Enter
  trong một ô = Khớp và chuyển sang dòng sau. Bấm lại "Đã khớp" thì bỏ khớp. Có thanh "Đã đối chiếu k/n dòng". Thêm, xoá dòng hay đổi
  loại biểu đồ không bỏ khớp các dòng khác; dòng mới thêm là dòng giảng viên tự gõ nên tính là đã đối chiếu khi có số.
- **V7.** Bản xem trước trong màn đối chiếu chỉ vẽ dòng đã đối chiếu; dòng chưa đối chiếu là khung trống "chưa kiểm", không có số.
  Biểu đồ tròn và vành khuyên chỉ vẽ khi đã đối chiếu hết.
- **V8.** Nút "Thay hình bằng biểu đồ" bị khoá đến khi mọi dòng đã đối chiếu; câu bên cạnh nói còn bao nhiêu dòng.
- **V9.** When bấm "Thay hình bằng biểu đồ", Then slide đổi sang bố cục Biểu đồ với đúng số đã đối chiếu; dòng nguồn để trống; ghi chú
  giảng và các khoá meta khác của slide giữ nguyên; slide lưu khoá `fromImage` (địa chỉ hình gốc). Nếu slide cũ có ý (gạch đầu dòng)
  không trống thì các ý đó sang slide "(tiếp)" chèn ngay sau (bố cục Chữ và hình, không hình) — không mất chữ.
- **V10.** **Số chưa đối chiếu không bao giờ lên slide**: Huỷ, "Quay lại nội dung", đóng cửa sổ (Esc, Xong, bấm ra ngoài) hay chuyển slide
  khi còn dòng chưa đối chiếu thì slide giữ nguyên hình và không có lệnh lưu nào mang số AI đọc. Số AI đọc chỉ sống trong bộ nhớ của
  cửa sổ; mở lại thì đọc lại.
- **V11.** Slide Biểu đồ có `fromImage`: cửa sổ sửa có dòng "Vẽ lại từ hình gốc · Trả lại hình". Bấm thì slide về bố cục Chữ và hình với
  hình gốc và tiêu đề hiện tại (các ý ở slide "(tiếp)" không tự gộp lại; giảng viên tự xoá slide đó nếu muốn).
- **V12.** Sự kiện `live.slide.chart_from_image_proposed` (máy chủ, sau mỗi lần AI đọc: deckId, slideId, `outcome` = "ok" hoặc lý do
  không dùng được, số nhãn, số giá trị ước lượng). Khi giảng viên thay hình: `live.slide.ai_edit_accepted` với `action =
  "chart_from_image"` (lưu như chấp nhận đề xuất AI, có bản lưu trước khi đổi để khôi phục ở Lịch sử phiên bản). Không ghi số liệu vào sự kiện.

## Thử

- Hướng 1: unit test `pptxImport` dựng file mẫu bằng `src/test/pptxFixture.ts` (biểu đồ Excel nhúng có và không có bộ đệm số, bảng
  tính nhúng có `oleSize`, phần trăm, `.bin` nhúng, gói hỏng) và `limioLivePptx` (dựng ra bố cục Biểu đồ/Bảng).
- Hướng 2: unit test kiểm kết quả AI (V4) và luật đối chiếu (V6–V8, hàm thuần); E2E trên localhost với LLM giả: sau khi AI trả số,
  slide bên ngoài cửa sổ vẫn là hình; đối chiếu một phần rồi đóng cửa sổ thì không có PATCH nào mang số; đối chiếu hết rồi thay thì
  slide là biểu đồ đúng số.
