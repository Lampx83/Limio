# Giao diện giảng viên Limio — sự thật đã kiểm chứng (2026-10-03)

Nguồn duy nhất để viết khoá "Hướng dẫn sử dụng Limio". Mỗi dòng dưới đây đã đối
chiếu với mã nguồn `apps/web/src`. **Khi giao diện đổi, sửa tệp này trước rồi mới
sửa bài.** Đường dẫn trong ngoặc là chỗ để kiểm lại.

## Quy ước khi viết (user chốt 2026-10-03)

- Câu **đủ chủ ngữ và vị ngữ**, từ ngữ dễ hiểu.
- Xưng **"thầy/cô"** với người đọc. Không dùng "bạn".
- **Không trộn tiếng Anh với tiếng Việt.** Dùng: bài kiểm tra (quiz), bài tập
  (assignment), tiêu chí chấm (rubric), phản hồi (feedback), bảng theo dõi
  (dashboard), xuất bản (publish), chương (module), bài học (lesson).
- Hình giao diện là **ảnh chụp thật** (user đổi ý 2026-10-03, trước đó chọn mockup). Bài đặt
  chỗ ảnh bằng `shot()`; ảnh chụp bằng `capture/shoot.mjs` với tài khoản mẫu. Ảnh sẽ còn chữ
  tiếng Anh của giao diện (Publish, Assignment…) cho tới khi đổi nhãn — phần chữ của bài
  vẫn viết thuần Việt và chú thích rõ nút nào trên ảnh.
- Cuối bài là mục **"Thử ngay"**: một việc làm được trong khoảng 2 phút ở khoá của
  chính thầy/cô.

## Bảng đổi tên: giao diện đang ghi gì, khoá mẫu viết gì

Giao diện thật còn nhiều nhãn tiếng Anh. Khoá mẫu viết thuần Việt, nên **nên đổi
nhãn trong giao diện cho khớp** (việc riêng, chưa làm).

| Giao diện đang ghi | Khoá mẫu viết |
|---|---|
| Publish (nút) | Xuất bản |
| Module / "Tạo module" / "Tên module" | Chương |
| lesson / "Tạo lesson" / "Tên lesson" | Bài học |
| Quiz / "+ Thêm quiz" | Bài kiểm tra |
| Assignment | Bài tập |
| Forum Q&A | Diễn đàn hỏi đáp |
| Rubric chấm điểm | Tiêu chí chấm |
| Learner Insights (BKT mastery) | Nắm kiến thức |
| Level / Category | Trình độ / Lĩnh vực |
| skill (trong ô tìm) | chủ đề |

## 1. Thanh điều hướng của giảng viên (`components/InstructorLeftMenu.tsx`)

Cột biểu tượng bên trái, bấm một mục thì hiện danh sách của mục đó:

**Cột trái chỉ có BIỂU TƯỢNG** (không có chữ); tên mục hiện khi rê chuột (Tooltip). Bấm một
biểu tượng thì cột thứ hai liệt kê chức năng. Thanh trên cùng có logo, nút "Đấu trường", chuông
thông báo và nút tên tài khoản. Thứ tự biểu tượng: bảng ô vuông (Trang chủ), mũ cử nhân (LMS),
bảng trình chiếu (Limio-Live), người máy (Vấn đáp AI), chữ A+ (Kiểm tra đánh giá), cúp (Đấu
trường), biểu đồ cột (Phân tích và Báo cáo).

1. **Trang chủ** → `/instructor/dashboard` ("Tổng quan việc cần xử lý")
2. **LMS** ("Bài giảng Elearning"): Khoá học của tôi · Bài tập · Diễn đàn hỏi đáp
3. **Limio-Live** ("Dạy học trực tiếp"): Bài giảng của tôi, Vote, Word Cloud,
   Padlet, Draw-it, Whiteboard, Đếm ngược, Gọi tên, Phân nhóm, Gameshow.
   *Không nhắc:* "Thư viện mẫu", "Template", "Soạn kịch bản" (chưa phát triển).
4. **Vấn đáp AI** → Phòng vấn đáp
5. **Kiểm tra đánh giá**: Bắt đầu · Ngân hàng câu hỏi · Thiết kế đề thi · Tổ chức thi
6. **Đấu trường** → Đấu trường của tôi
7. **Phân tích và Báo cáo**: Nắm kiến thức (và "Token AI" khi đã mở)
   *Không nhắc:* "Analytics và Báo cáo" chỉ dành cho nhà nghiên cứu.

Menu người dùng: Tổng quan của tôi, Cài đặt tài khoản, Quản trị trường, Đăng xuất.

## 2. Khoá học

**Lối vào:** giảng viên chưa có khoá thấy nút "+ Tạo khoá đầu tiên" ở trang chủ;
còn lại vào "Khoá học của tôi" → "+ Tạo khóa học" (`/instructor/courses`).

**Biểu mẫu "Tạo khóa học mới"** (`/instructor/courses/new`). Dòng phụ: "Khởi tạo
nháp — bạn có thể bổ sung module, lesson, quiz ở bước tiếp theo." Các ô theo thứ tự:
Tiêu đề (bắt buộc, tối đa 200 ký tự) · Mô tả (bắt buộc, soạn được định dạng) ·
Level: Cơ bản / Trung cấp / Nâng cao · Ngôn ngữ: Tiếng Việt / English ·
Category (không bắt buộc) · ô chọn **"Bật cá nhân hoá học tập"** · nhóm
"Ai vào được khoá này": **"Mở — ai cũng tự đăng ký được"** hoặc **"Chỉ vào bằng
link mời lớp"**. Nút: "Hủy", "Tạo và tiếp tục".

**Sau khi tạo:** hệ thống tự dựng sẵn **3 chương × 3 bài học** tên "Module 1..3",
"Bài học 1..3" và mở thẳng tab Nội dung. Các tên này **vẫn nằm đó nếu xuất bản mà
không sửa** (hệ thống không kiểm tra khoá rỗng) — nên nhắc thầy/cô đổi tên hoặc xoá.

**Trình soạn khoá** (`/instructor/courses/[id]`):
- Đầu trang: "← Khóa của tôi", nhãn trạng thái (Nháp / Đã publish / Lưu trữ), nút
  xanh **Publish**, nút **"Chế độ đứng lớp"** (mở bài ở tab mới, chế độ giảng viên).
- Các tab theo thứ tự: **Tổng quan · Nội dung · Học viên · Lớp học · Grade ·
  Phân tích · Gamification**. Khoá còn nháp chỉ hiện Tổng quan và Nội dung.
  "Phân tích" chỉ dành cho nhà nghiên cứu — không nhắc.
- **Tổng quan**: ngoài các ô ở biểu mẫu tạo còn có "Giá khoá học" (VND/USD, để
  trống = miễn phí, chỉ hiện với khoá "Mở"), ô chọn **"Công khai — xem được không cần
  đăng nhập"** (chỉ có tác dụng sau khi xuất bản; tiến độ, ghi chú, thảo luận,
  bài kiểm tra và trợ lý AI vẫn đòi đăng nhập), nút "Lưu và tiếp tục", mục
  "Giảng viên" (Chủ khóa / Đồng giảng viên / GV không chỉnh sửa / Trợ giảng) và
  "Hành động khóa" (Duplicate, Archive khi đã xuất bản, Delete chỉ chủ khoá).
- **Xuất bản**: khoá là nháp cho tới khi bấm Publish; xong nút biến mất. Khi bật
  cá nhân hoá, xuất bản sẽ tự gắn chủ đề cho các bài học.
- **Khoá mẫu** không do giảng viên tạo: quản trị viên đánh dấu một khoá đã xuất
  bản + công khai; giảng viên chưa có khoá thấy "Xem khoá mẫu" ở trang chủ.

## 3. Chương, bài học, khối nội dung

- Tab **Nội dung**: tiêu đề "Modules"; nút "Xem trước"; "Gập hết" / "Mở hết"; ô
  tìm "Tìm bài học…".
- **Thêm chương**: ô nhập (gợi ý "Ví dụ: Phương trình bậc 1") + nút "Tạo". Sửa
  chương: "Sửa module" có ô tên và ô **Order** (số thứ tự). **Chương không kéo thả
  được** — đổi thứ tự bằng ô số. Ngoài ra có: ẩn/hiện, khoá, xoá chương.
- **Thêm bài học**: "Tên lesson", "Mô tả ngắn (optional)", nút "Tạo lesson". Menu "⋮"
  của bài: Hiện bài này · Khoá nội dung · Cho xem thử · Nhân bản bài · Chuyển lên ·
  Chuyển xuống · Chuyển sang module khác · Xóa bài học.
- Đầu mỗi bài: "Trình chiếu", "Xem như học viên", "Sửa", "Xóa".
- **Khối nội dung** trong bài: bấm "+ Thêm hoạt động/tài nguyên" → hộp thoại có ô
  tìm "Tìm hoạt động...", bộ lọc Tất cả / Tài nguyên / Hoạt động.
  - *Tài nguyên:* **Văn bản — AI hỗ trợ** (dán chữ rồi bấm "Định dạng bằng AI",
    hoặc "Tải file .docx (Word) lên") · Richtext editor · **Ghi chú giảng viên**
    (chỉ giảng viên thấy, học viên và bản in không thấy) · Markdown (gõ thô) ·
    **Video** (liên kết YouTube/Vimeo/Loom/Wistia/Bunny/Mux hoặc tải tệp, tối đa
    500 MB; có thể chèn câu hỏi giữa video) · PDF · File đính kèm · Link ngoài ·
    Embed · HTML tự tải lên.
  - *Hoạt động:* Quiz · Assignment · SCORM (1.2, tệp .zip) · H5P · LTI (1.3).
  - Các khối trong bài kéo thả để đổi thứ tự (tay cầm "Kéo để sắp xếp").
  - **Không có** chức năng nhập bài từ Markdown. Chỉ có khối "Markdown" gõ thô và
    nhập Word (.docx).

## 4. Bài kiểm tra trong bài học

- Thêm bằng "+ Thêm quiz" → "Tạo quiz" → "Mở trình soạn".
- Trình soạn có các nút: "Cài đặt", "AI import", "Excel import", "Nhập thủ công",
  danh sách "Câu hỏi (n)".
- **Cài đặt:** Thời gian làm bài · Số lần làm · Hạn mở · Hạn đóng · "Cách tính điểm
  khi làm nhiều lần" (Cao nhất / Lần cuối / Trung bình; chỉ hiện khi cho làm nhiều lần). Mỗi
  cài đặt có công tắc; tắt thì là "Không giới hạn" / "Mở ngay" / "Không có hạn". Có thêm "Lịch
  theo lớp" (xem mục 7). **"Độ khó (1 dễ – 5 khó)" và "Đánh giá độ tự tin" chỉ hiện với tài
  khoản nhà nghiên cứu** (`QuizHeader.tsx`, `showResearch`) — không nhắc cho giảng viên thường.
- **Luồng thêm:** bấm "+ Thêm quiz", gõ tên, bấm "Tạo quiz" thì hệ thống tự mở trang trình soạn;
  "Mở trình soạn" chỉ có ở bài kiểm tra đã tạo.
- **Nhập hàng loạt** ("AI import", "Excel import"): chỉ nhận 5 dạng (trắc nghiệm, đúng/sai,
  sắp xếp, ghép cặp, điền khuyết); AI nhận tối đa 20.000 chữ, Excel tối đa 500 câu một lần; cả
  hai có bước xem trước.
- **9 dạng câu hỏi:** Trắc nghiệm · Đúng / Sai · Điền khuyết · Sắp xếp thứ tự ·
  Ghép cặp · Đáp án dạng số · Tự luận · Trả lời ngắn · Kéo thả từ/câu.

## 5. Kiểm tra đánh giá (hệ thống riêng với bài kiểm tra trong bài học)

Ba bước ở trang **Bắt đầu** (`/instructor/assessment`, tiêu đề "Kiểm tra đánh
giá"): Bước 1 Ngân hàng câu hỏi · Bước 2 Thiết kế đề thi · Bước 3 Tổ chức thi.
Bước 1 có thể bỏ qua nếu soạn câu hỏi thẳng trong đề.

**Ngân hàng câu hỏi** (`/instructor/question-banks`):
- "+ Tạo ngân hàng mới": "Tên ngân hàng" + "Phạm vi" (Riêng tư — chỉ mình thầy/cô,
  hoặc chia sẻ với đồng giảng viên của một khoá).
- Trong ngân hàng: thêm bằng dán chữ cho AI định dạng, nhập Excel (.xlsx), hoặc
  "+ Nhập thủ công". Bảng có các cột: Mã câu · Câu hỏi · Chủ đề · Loại · Trạng thái ·
  Thẩm định · Tư duy · Độ khó · Cập nhật · Đợt thi. Thẩm định: Chưa thẩm định /
  Đã duyệt / Cần sửa. Có xuất bản và lưu trữ hàng loạt.
- 10 loại: TN 1 đáp án · TN nhiều đáp án · Đúng / Sai · Điền khuyết · Trả lời ngắn ·
  Tự luận · Sắp xếp · Ghép cặp · Điền số · Kéo thả.

**Thiết kế đề thi** (`/instructor/exams`):
- "+ Tạo bài thi mới" hoặc "+ Tạo đề không gắn khoá học". Mỗi đề có tab Tổng quan,
  Nội dung. "+ Thêm câu hỏi" → "Lấy câu hỏi từ đâu?" → Ngân hàng câu hỏi hoặc Nhập
  thủ công. Lấy từ ngân hàng có 3 cách: "Chọn nhanh theo tiêu chí", "Chọn thủ công",
  "Theo ma trận đề thi". Đề chia "Phần" (ví dụ "Phần 2 - Tự luận").
- **Hai mức Cơ bản / Nâng cao.** *Cơ bản* là trình hướng dẫn 3 bước: "Chọn nội dung
  cần kiểm tra" → "Cấu hình đề" (Số câu hỏi, Thời gian làm bài, "Đề này dành cho",
  "Tỉ lệ mức tư duy") → "Phát đề cho học sinh" (Một đề chung cho cả lớp / Xáo trộn
  cho mỗi học sinh / Chia lớp làm nhiều ca thi), rồi "Tạo đề". *Nâng cao* là biểu
  mẫu đầy đủ: Mục đích (Đề thi thật / Đề thử nghiệm), Chấm điểm (Tự động / Kết hợp),
  Giám thị (Không / Cơ bản / Nghiêm ngặt), trộn câu và trộn đáp án. Sau 3 đề, giao
  diện hiện biểu ngữ "Bạn đã tạo nhiều đề. Bật chế độ Nâng cao để xem chỉ số chất lượng câu
  hỏi chi tiết?" với nút "Bật ngay" và "Bỏ qua". Không có công tắc quay lại mức Cơ bản.

**Tổ chức thi** (`/instructor/organize`, câu hỏi "Bạn định tổ chức kiểu gì?") có 3 thẻ:
1. **Link thi nhanh**: chọn đề đã xuất bản, đặt thời lượng (phút), chọn "Hiện đáp án
   và kết quả" (4 lựa chọn), tuỳ chọn "Hẹn giờ mở / Hẹn giờ đóng", bấm "Mở" → nhận
   đường dẫn + mã QR; có "Các buổi đã mở" và "Xem kết quả".
2. **Thử nghiệm câu hỏi**: giống link thi nhanh nhưng mặc định không hiện đáp án.
3. **Kỳ thi chính thức**: **Đợt thi** ("+ Tạo đợt thi"; tab Tổng quan / Ca thi / Phòng
   thi / Trưởng đợt / Kết quả) › **Ca thi** (vào "Theo phòng" bằng mã riêng từng thí
   sinh, hoặc "Tự do" bằng một mã chung) › **Phòng thi** ("+ Thêm phòng thi", nhập
   danh sách thí sinh, in phiếu phòng). Giám thị vào bằng mã tại `/giam-thi`.

Trạng thái đợt thi chỉ để phân loại, không tự mở hay đóng ca (xem CLAUDE.md §4.6.1). Muốn dừng
một ca đang thi thì đóng ca đó ở thẻ Ca thi. Giám thị vào `/giam-thi` không cần tài khoản, bằng mã
phòng riêng của giám thị (khác mã thí sinh). "Chốt" = cố định bộ câu đang rút ngẫu nhiên từ ngân
hàng vào đề. Trình hướng dẫn Cơ bản còn dùng chữ "học sinh" ("Phát đề cho học sinh") — lệch thuật
ngữ "học viên"/"thí sinh" của khoá.

## 6. Bài tập

- Thêm bằng thẻ "Assignment" ("Bài tập — instructor chấm tay") hoặc "+ Thêm
  assignment". Ô: "Tiêu đề assignment", "Mô tả nhiệm vụ...", "Hạn nộp (optional)",
  "Điểm tối đa". Có mục thu gọn "Gợi ý dạng bài làm (không bắt buộc)" với nút
  **"Gợi ý bằng AI"** và các dạng: Tóm tắt, Tự giải thích, Hình dung tình huống,
  Vẽ sơ đồ, Vẽ minh hoạ, Dạy lại, Thực hành minh hoạ.
- **Tiêu chí chấm** (`submissions/RubricBox.tsx`): một ô văn bản tự do "Rubric chấm
  điểm (không bắt buộc)", gợi ý "Ví dụ: 3đ nêu đúng khái niệm. 4đ có ví dụ. 3đ trình
  bày rõ ràng.", nút "Lưu rubric". **Không phải bảng tiêu chí có cấu trúc**; AI đọc
  đúng đoạn chữ này khi gợi ý điểm.
- **Màn chấm** `/instructor/assignments`: hai tab "Danh sách assignment" và "Cần chấm"
  (hàng chờ của mọi khoá). Bốn thẻ số: Tổng assignment, Đang chờ chấm, Đã chấm,
  Assignment quá hạn. Trang bài nộp có bảng Người nộp / Lớp / Trạng thái / Ngày giờ
  nộp / Bài làm / Điểm, lọc "Tất cả lớp", liên kết "Xem bài làm" mở cửa sổ chấm.
- **Cửa sổ chấm:** nút **"✨ Gợi ý điểm bằng AI"** điền sẵn điểm và nhận xét *nháp* —
  AI không bao giờ tự lưu, giảng viên xem rồi mới lưu. Ô "Điểm", "Nhận xét"; nút
  "✓ Chấm điểm" / "Cập nhật điểm". Nhận xét này đến tay học viên.
- Tự luận trong đề thi: "Chấm tự luận" có "Gợi ý chấm" (AI) và "↻ Chấm lại tất cả".

## 7. Hạn theo lớp

Bảng **"Hạn theo lớp"** (bài tập) / **"Lịch theo lớp"** (bài kiểm tra), nằm trong
form sửa. Hiện "Hạn chung (…)". Tích chọn lớp, rồi đặt "Hạn mở" / "Mở ngay" / "Hạn
nộp" / "Hạn đóng" / "Không có hạn". Nút: "Áp dụng cho n lớp", "Dùng hạn chung", "Sửa".

## 8. Cá nhân hoá và lộ trình

- Khi bật "Bật cá nhân hoá học tập", **mỗi bài học tự thành một "Chủ đề"** — giảng
  viên không phải gắn tay. Câu hỏi trong bài thừa hưởng chủ đề của bài.
- Giảng viên tự gắn: chip "n chủ đề" / "chưa có chủ đề" ở thanh trên của bài mở ra
  hộp chọn có ô tìm và "+ Tạo skill mới...". Chủ đề giảng viên gắn **luôn thắng**
  chủ đề tự sinh. Bài kiểm tra độc lập (không gắn bài học) không được gắn tự động.
- **Quan niệm sai** (còn gọi lỗi tư duy): trong biểu mẫu câu hỏi có ô "Không gắn quan
  niệm sai" và "+ Tạo quan niệm sai mới". Gắn vào *phương án sai* để hệ thống nói
  đúng học viên hiểu nhầm chỗ nào.
- **Nắm kiến thức** (`/instructor/learner-insights`): thẻ số Học viên / Chủ đề /
  Mastery TB / HV có chủ đề yếu; "Ma trận học viên × chủ đề"; "Độ phủ theo chủ đề".
  Giảng viên thấy phần trăm.
- **Học viên cần hỗ trợ** (`/instructor/courses/{id}/struggling-students`): cột
  "Lỗi tư duy chưa khắc phục", "Kỹ năng yếu", "Hoạt động gần nhất". Lối vào từ trang
  Học viên.
- **Học viên chỉ thấy nhãn, không thấy phần trăm:** **Cần ôn** (dưới 60%) ·
  **Nên luyện thêm** (từ 60% tới dưới 85%) · **Vững** (từ 85%) · "Chưa có dữ liệu".
  Trang `/me/skills` "Bản đồ chủ đề của bạn"; trang khoá có "Lộ trình của bạn" với
  các bước "Ôn lại trước khi học tiếp", "Bài tiếp theo", "Luyện thêm cho chắc", "Có
  thể lướt qua"; ở bài có thể thấy "Bạn có thể bỏ qua bài này".

## 9. Lớp học và tương tác

- **Lớp học** (tab "Lớp học", `/enroll/[mã]` cho học viên): "Tạo lớp" với "Tên lớp"
  (gợi ý "Vd: Lớp K65-CS1") và "Mô tả (tuỳ chọn)". Mỗi lớp có thẻ **"Link mời vào lớp"**
  kèm mã QR, số học viên, "Xem danh sách". Menu "…": "Sửa lớp", "Tạo lại mã mời" (link
  cũ chết ngay), "Xoá lớp" (chỉ khi lớp rỗng). "Nhập học viên" nhận tệp
  CSV có dòng đầu `name,email`. Danh sách lớp có cột Học viên / Trạng thái / Vào lớp /
  Tiến độ / Điểm quiz gần nhất / "Chuyển lớp". Khoá "Chỉ vào bằng link mời lớp" chỉ vào
  được bằng các link này. Trang đón: "Lời mời tham gia lớp học" → "Vào học".
- **Học viên** (tab "Học viên"): trạng thái Đang học / Đã hoàn thành / Bỏ học / Đã hoàn
  tiền / Hết hạn truy cập; tìm theo tên hoặc email; "Gán lớp", "Xoá khỏi khoá học",
  "Tải danh sách học viên".
- **Diễn đàn:** học viên bấm "💬 Thảo luận" trong bài rồi "Đăng câu hỏi". Giảng viên vào
  "Forum Q&A": lọc Tất cả / Chưa giải đáp / Đã xử lý, thẻ "Stale (>…h chưa resolve)", liên
  kết "Mở thread"; trong chủ đề bấm **"Đánh dấu là câu trả lời"** để chuyển sang "Đã xử lý".
- **Ghi chú theo vùng chọn và Hỏi AI** (cho học viên đã ghi danh và chủ khoá): bôi đen
  một đoạn chữ trong bài → bấm chuột phải → **"Viết annotation"** hoặc **"Hỏi AI về đoạn
  này"**. Ghi chú có hai chế độ **"Riêng tư"** và **"Cả lớp"** ("Chia sẻ với cả lớp").
  Không có trong chế độ xem trước. Ngoài ra có khung nổi **"Trợ giảng AI"** (tính vào
  Token AI).
- **KHÔNG có tính năng thông báo lớp.** Không viết.

## 10. Theo dõi, gamification, chứng nhận

- **Tiến độ:** tab Học viên, danh sách lớp (cột "Tiến độ"), tab Grade (có "Tải bảng
  điểm quiz" và "Tải bảng điểm bài tập"), trang chủ giảng viên. Lịch ở trang chủ
  chuyển Tuần / Tháng, "Hôm nay", chỉ hiện hạn bài tập và bài kiểm tra. Các mục trang
  chủ: "Cần xử lý gấp", "Hoạt động gần đây", "Gamification theo khoá".
- **Gamification — giảng viên chỉ xem, không cấu hình** (không chỉnh XP, huy hiệu hay
  nhiệm vụ). Tab Gamification có lọc "Lớp", "Tải CSV", các thẻ: Học viên, Tổng XP, XP
  trung bình, Badge đã cấp, Đang có streak, Phân bố level; bảng từng học viên mở rộng
  được ("Badge trong khoá này", "20 giao dịch XP gần nhất"); nhãn "Ẩn khỏi BXH". Học viên
  thấy: `/xp-guide` "Cách tính điểm (XP)", `/leaderboard` "Bảng xếp hạng" (Hôm nay / Tuần
  này / Tháng này / Mọi thời), `/me/badges` "Huy hiệu của bạn", "Nhiệm vụ hôm nay" (3
  nhiệm vụ cố định: "Học 1 bài", "Vượt 1 quiz", "Khắc phục lỗi tư duy"). Chuỗi ngày học
  (streak) chỉ là số liệu, không cấp XP. Giảng viên chỉ đặt điểm XP ở **Đấu trường**.
- **Hồ sơ năng lực (e-portfolio)**: chỉ phía học viên, `/me/portfolio`, trang công khai
  `/p/{slug}`; học viên tự chọn bài đã chấm và bật chia sẻ. Giảng viên không phải cài gì.
- **Chứng nhận:** tự cấp khi học viên hoàn thành khoá ("Xem chứng nhận"), tải PDF, có
  trang xác minh `/verify/{số chứng nhận}`. Không có cài đặt phía giảng viên.

## Không được viết (chưa có hoặc chưa tới tay giảng viên)

- Nhập bài từ Markdown · thông báo lớp · kéo thả chương · bảng tiêu chí chấm có cấu
  trúc · cài đặt XP/huy hiệu · "Phân tích" và "Analytics" (chỉ nhà nghiên cứu) ·
  trang `/instructor/feedback-generator`, `/feedback-templates`, `/item-analytics`
  (không có lối vào) · các mục Limio-Live ghi "đang phát triển" · lịch kỳ học (do
  quản trị trường đặt).

## Tài khoản mẫu để chụp ảnh

Giảng viên mẫu (dữ liệu giả, tạo bởi `packages/db/src/seed-demo-instructor.ts`) và quy trình chụp ở
`capture/`. Không chụp bằng tài khoản người thật vì ảnh sẽ công khai. Khi cần dữ liệu (khoá, bài, câu
hỏi, học viên, bài nộp…) thì dựng thêm dữ liệu GIẢ cho đúng tài khoản này.

## Điều chỉnh theo ảnh chụp thật (2026-10-03)

Các điểm dưới đây thay thế những chỗ ở trên mô tả từ mã nguồn mà giao diện thật không khớp.

- **Tab Nội dung:** tiêu đề "Modules" (kèm "4 modules · 12 bài"), "Xem trước", ô tìm, "Gập hết", "Mở hết".
  Hàng nút của chương (ẩn/hiện, khoá, sửa, xoá) **chỉ hiện khi rê chuột**. Mỗi chương có "+ Thêm lesson"; cuối
  danh sách là nút gạch đứt "+ Thêm module". Dòng bài chỉ bấm vào được, **không có menu "⋮" ở danh sách**.
- **Trang từng bài học** (bấm một dòng bài): "Xem như học viên", bút chì cạnh tên bài (đổi tên), chip "n chủ đề",
  menu "⋮", danh sách "Hoạt động (n)" có tay cầm kéo thả, nút "Mở trình soạn", và "+ Thêm hoạt động/tài nguyên".
  Menu "⋮" có công tắc "Hiện bài này", "Khoá nội dung", "Cho xem thử" và các mục Nhân bản bài, Chuyển lên/xuống,
  Chuyển sang module khác, Xóa bài học. **Không có** hàng nút "Trình chiếu / Sửa / Xóa".
- **Tab Tổng quan** là bản tóm tắt chỉ đọc (Level, Ngôn ngữ, Category, Giá, Chế độ) kèm nút "Sửa". **Giá** và ô
  **"Công khai"** nằm trong biểu mẫu mở bằng nút "Sửa". Giá nhập theo cent bằng USD ("Nhập số cents", ví dụ
  999 = $9.99); để trống = miễn phí.
- **Quiz trong bài học:** thanh tóm tắt cài đặt luôn hiện; "Cài đặt" mở các ô có hộp chọn (Thời gian làm bài, Số
  lần làm, Hạn mở, Hạn đóng), "Cách tính điểm khi làm nhiều lần", nút Lưu/Hủy và mục thu gọn "Lịch theo lớp".
  Ô chọn quan niệm sai ở đáp án sai hiện **mã** (ví dụ `py.index_from_1`), không hiện tên tiếng Việt.
- **Bài tập:** khối Bài tập trong trang bài học có "Xem bài nộp" và bút chì (sửa). Biểu mẫu sửa có "Hạn theo lớp"
  (mục thu gọn). Trang bài nộp có khung **"Rubric chấm điểm (không bắt buộc)"** nằm TRÊN bảng "Danh sách", thẻ số
  (tổng, chưa nộp, chờ chấm, đã chấm). Cửa sổ chấm: "✨ Gợi ý điểm bằng AI", "Điểm", "Nhận xét", "✓ Chấm điểm"
  hoặc "Cập nhật điểm", "Quay lại danh sách".
- **Lớp học:** nút nhập danh sách ở mỗi khung lớp tên là **"Nhập học viên"**. Hộp "Link mời vào lớp" có "Sao chép" và
  "Mã QR".
- **Diễn đàn** tên "Forum Q&A": bốn thẻ số, các nút lọc, bảng và nút "Mở thread".
- **Menu chuột phải** ("Viết annotation", "Hỏi AI về đoạn này") chỉ dùng được với người đã ghi danh (và chủ khoá)
  ngoài chế độ xem trước.
- **Học viên** thấy trang khoá có "Lộ trình của bạn" (các bước + nhãn Cần ôn / Nên luyện thêm), "Bảng xếp hạng", "Champions".
