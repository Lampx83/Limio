# Giao diện giảng viên Limio — sự thật đã kiểm chứng (cập nhật 2026-10-19)

Nguồn duy nhất để viết khoá "Hướng dẫn sử dụng Limio" và để làm tri thức cho trợ lý Limio ở trang chủ
giảng viên (`apps/web/src/lib/teacherAssistantGuide.ts`). Mỗi dòng dưới đây đã đối chiếu với mã nguồn
`apps/web/src`. **Khi giao diện đổi, sửa tệp này trước rồi mới sửa bài và kho hướng dẫn của trợ lý.**
Đường dẫn trong ngoặc là chỗ để kiểm lại.

**Phiên bản.** Bản gốc 2026-10-03. Bản này (2026-10-19) rà lại toàn bộ theo mã nguồn sau các đợt thay đổi
từ 03/10 đến 19/10: tổ chức thi làm lại (A5.3), chấm bài và nộp nhóm, tạo bài học từ tài liệu bằng AI,
ngoại ngữ (LANG), vấn đáp AI, Limio-Live, Hoạt động nhanh, trợ lý Limio. **Các phần mới (mục 11 trở đi và
những chỗ ghi "mới") được đối chiếu bằng đọc mã, chưa xem bằng mắt trên giao diện.** Mục "Điều chỉnh theo
ảnh chụp thật" ở cuối là của 2026-10-03; chỗ nào xung đột với phần trên thì theo phần trên.

Số mục 1–10 giữ nguyên chủ đề như bản cũ để các tài liệu đang trỏ tới còn đúng; phần mới đánh số từ 11.

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
- Khi hướng dẫn, **ghi đúng tên nút như trên màn hình** (kể cả còn tiếng Anh) để giảng viên tìm được.

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
| Learner Insights | Nắm kiến thức |
| Level / Category | Trình độ / Lĩnh vực |
| skill (trong ô tìm; "Skill tracked", "Coverage theo skill") | chủ đề |
| Vote (menu, trình sửa) · "Bình chọn" (trang chia sẻ) · Poll (Hoạt động nhanh) | Bình chọn |
| Padlet (Hoạt động nhanh) · "Dán Note" (loại slide) | Bảng ý tưởng |
| Whiteboard · "Bảng trắng" (trang chia sẻ) | Bảng trắng |

## 1. Thanh điều hướng của giảng viên (`components/InstructorLeftMenu.tsx`)

Cột biểu tượng bên trái, bấm một mục thì hiện danh sách của mục đó:

**Cột trái chỉ có BIỂU TƯỢNG** (không có chữ); tên mục hiện khi rê chuột (Tooltip). Bấm một
biểu tượng thì cột thứ hai liệt kê chức năng; cột này gấp/mở được. Thanh trên cùng có logo, nút "Đấu
trường" (ẩn khi đang ở trang thi), chuông thông báo và nút tên tài khoản. Thứ tự biểu tượng: bảng ô vuông
(Trang chủ), mũ cử nhân (LMS), bảng trình chiếu (Limio-Live), người máy (Vấn đáp AI), chữ A+ (Kiểm tra
đánh giá), cúp (Đấu trường), biểu đồ cột (Phân tích và Báo cáo).

1. **Trang chủ** → `/instructor/dashboard` (chú giải khi rê chuột: "Tìm kiếm nhanh, hỏi Lily và khoá học gần đây")
2. **LMS** ("Bài giảng Elearning"): Khoá học của tôi · **Assignment** · **Forum Q&A** (nhãn menu nguyên văn,
   còn tiếng Anh)
3. **Limio-Live** ("Dạy học trực tiếp"), chia 4 nhóm nhỏ: "Slide tương tác" (Slide của tôi) ·
   "Hoạt động nhanh" (Vote, Word Cloud, Padlet, Draw-it, Whiteboard) · "Điều hành lớp học" (Đếm ngược,
   Gọi tên, Phân nhóm, Gameshow). Cần quyền `limio_live.access`. Tài khoản miễn phí thấy nhãn nhỏ
   "Premium"/"Trial" (tooltip "Tài khoản miễn phí được dùng thử tính năng này") ở Limio-Live và Vấn đáp AI.
   *Không nhắc:* "Thư viện mẫu", "Template", "Soạn kịch bản" (còn "đang phát triển", không bấm được).
4. **Vấn đáp AI** → Phòng vấn đáp (cần quyền `ai_oral.access`)
5. **Kiểm tra đánh giá**: Bắt đầu · Ngân hàng câu hỏi · Thiết kế đề thi · Tổ chức thi · **Lịch sử thi**
   (mới, `/instructor/exam-history`)
6. **Đấu trường** → Đấu trường của tôi
7. **Phân tích và Báo cáo**: Nắm kiến thức (và "Token AI" khi quản trị viên đã mở trang — mặc định bị
   khoá, trang trả 404 khi khoá)
   *Không nhắc:* "Analytics và Báo cáo" chỉ dành cho nhà nghiên cứu.

Menu người dùng: Tổng quan của tôi, Cài đặt tài khoản, Quản trị trường (OrgAdmin) (chỉ admin trường),
Đăng xuất. Người chỉ làm giám thị (không dạy khoá nào) thấy menu rút gọn một mục "Giám sát phòng thi"
(`/instructor/my-rooms`).

## 2. Khoá học

**Lối vào:** giảng viên chưa có khoá thấy nút "+ Tạo khoá đầu tiên" ở trang chủ;
còn lại vào "Khoá học của tôi" → "+ Tạo khóa học" (`/instructor/courses`).

**Biểu mẫu "Tạo khóa học mới"** (`/instructor/courses/new`, khung "Thông tin course"). Dòng phụ: "Khởi tạo
nháp — bạn có thể bổ sung module, lesson, quiz ở bước tiếp theo." Các ô theo thứ tự:
Tiêu đề (bắt buộc, tối đa 200 ký tự; gợi ý "Ví dụ: Đại số cơ bản") · Mô tả (bắt buộc, soạn được định dạng;
gợi ý "Khóa học này dành cho ai? Học xong sẽ làm được gì?") · Level: Cơ bản / Trung cấp / Nâng cao ·
Ngôn ngữ: Tiếng Việt / English · Category (không bắt buộc) · ô chọn **"Bật cá nhân hoá học tập"** · nhóm
"Ai vào được khoá này": **"Mở — ai cũng tự đăng ký được"** hoặc **"Chỉ vào bằng link mời lớp"**. Nút:
"Hủy", "Tạo và tiếp tục". Trang **không còn** khối "khoá mẫu ngoại ngữ" (đã gỡ 2026-10-10).

**Sau khi tạo:** hệ thống tự dựng sẵn **3 chương × 3 bài học** tên "Module 1..3",
"Bài học 1..3" và mở thẳng tab Nội dung. Các tên này **vẫn nằm đó nếu xuất bản mà
không sửa** (hệ thống không kiểm tra khoá rỗng) — nên nhắc thầy/cô đổi tên hoặc xoá.

**Trình soạn khoá** (`/instructor/courses/[id]`):
- Đầu trang: "← Khóa của tôi", nhãn trạng thái (Nháp / Đã publish / Lưu trữ), nút
  xanh **Publish**, nút **"Chế độ đứng lớp"** (mở bài ở tab mới, chế độ giảng viên).
- Các tab theo thứ tự: **Tổng quan · Nội dung · Lớp học · Học viên · Grade · Phân tích · Gamification**
  (Lớp học đứng TRƯỚC Học viên). Khoá còn nháp chỉ hiện Tổng quan và Nội dung. "Phân tích" chỉ dành cho
  nhà nghiên cứu — không nhắc.
- **Tổng quan** là bản tóm tắt chỉ đọc (Level, Ngôn ngữ, Category, Giá, thẻ "Chế độ": "LMS thường" /
  "AI Feedback" / "Ngoại ngữ (4 kỹ năng)") kèm nút "Sửa". Biểu mẫu "Sửa" có: ô **"Cá nhân hoá học tập"**
  (không có chữ "Bật" như biểu mẫu tạo), ô **"Chế độ ngoại ngữ"** (mới; xem mục 12), "Giá khoá học"
  (mặc định VND, "Nhập số nguyên (đồng). Ví dụ: 299000."; chỉ khi chọn USD mới nhập theo cent, "999 = $9.99";
  để trống = miễn phí; chỉ hiện với khoá "Mở"; khoá có giá sinh mã kích hoạt sau khi lưu), ô chọn
  **"Công khai — xem được không cần đăng nhập"** (chỉ có tác dụng sau khi xuất bản; tiến độ, ghi chú,
  thảo luận, bài kiểm tra và trợ lý AI vẫn đòi đăng nhập), nút "Lưu và tiếp tục", mục "Giảng viên" (Chủ
  khóa / Đồng giảng viên / GV không chỉnh sửa / Trợ giảng) và "Hành động khóa" (Duplicate, Archive khi đã
  xuất bản, Delete chỉ chủ khoá).
- **Xuất bản**: khoá là nháp cho tới khi bấm Publish; xong nút biến mất. Khi bật
  cá nhân hoá, xuất bản sẽ tự gắn chủ đề cho các bài học.
- **Khoá mẫu** không do giảng viên tạo: quản trị viên đánh dấu một khoá đã xuất
  bản + công khai; giảng viên chưa có khoá thấy "Xem khoá mẫu" ở trang chủ.

## 3. Chương, bài học, khối nội dung

- Tab **Nội dung**: tiêu đề "Modules"; nút "Xem trước"; "Gập hết" / "Mở hết"; ô
  tìm "Tìm bài học…".
- **Xem như học viên**: nút "Xem trước" cạnh tiêu đề "Modules" mở trang khoá đúng như học viên thấy, ở tab mới.
  Khi đang mở một bài học, cạnh tên bài có nút **"Xem như học viên"** mở riêng bài đó (chỉ tên bài và nội dung)
  ở tab mới; trang soạn giữ nguyên. Bài đang ẩn thì nút này mờ đi (học viên cũng không thấy bài), bật lại ở menu
  "⋮" → "Hiện bài này". Trang bài nộp và trang chấm không có nút này.
- **Thêm chương**: ô nhập (gợi ý "Ví dụ: Phương trình bậc 1") + nút "Tạo". Sửa
  chương: "Sửa module" có ô tên và ô **Order** (số thứ tự). **Chương không kéo thả
  được** — đổi thứ tự bằng ô số. Ngoài ra có: ẩn/hiện, khoá, xoá chương.
- **Thêm bài học**: "Tên lesson", "Mô tả ngắn (optional)", nút "Tạo lesson". Menu "⋮" của bài trong trang
  bài: Hiện bài này · Khoá nội dung · Cho xem thử · Nhân bản bài · Chuyển lên · Chuyển xuống · Chuyển sang
  module khác · Xóa bài học.
- **Khối nội dung** trong bài: bấm "+ Thêm hoạt động/tài nguyên" → hộp thoại "Thêm hoạt động/tài nguyên"
  có ô tìm "Tìm hoạt động...", bộ lọc Tất cả / Tài nguyên / Hoạt động.
  - *Tài nguyên (13):* **Văn bản — AI hỗ trợ** (nhãn nhỏ "AI supported"; mô tả "Tải Word, PDF hoặc dán văn
    bản — AI lập dàn ý, bạn chốt rồi AI viết bài") — **mở sang trang riêng, xem mục 11** · Richtext editor
    ("Soạn trực tiếp — in đậm, danh sách, ảnh, bảng, không qua AI") · **Ghi chú giảng viên** (chỉ giảng viên
    thấy, học viên và bản in không thấy) · Markdown (gõ thô) · **Video** (liên kết
    YouTube/Vimeo/Loom/Wistia/Bunny/Mux hoặc tải tệp, tối đa 500 MB; có thể chèn câu hỏi giữa video) ·
    **Audio (bài nghe)** (mp3/m4a/OGG/WebM, tối đa 50 MB; mục 12) · **Từ vựng (bảng từ)** (mục 12) ·
    **Hội thoại** (mục 12) · PDF (tối đa 50 MB) · **File đính kèm** (tải lên tối đa 10 MB hoặc dán link) ·
    Link ngoài · Embed · HTML tự tải lên (tối đa 10 MB).
  - *Hoạt động (5):* Quiz · Assignment · SCORM (1.2, tệp .zip) · H5P · LTI (1.3).
  - Các khối trong bài kéo thả để đổi thứ tự (tay cầm "Kéo để sắp xếp").
  - **Không có** khối "Slide bài giảng" trong hộp này.
  - Khối "Markdown" vẫn là ô gõ thô. Muốn đưa văn bản có sẵn vào bài thì dùng luồng "Tạo bài từ tài liệu"
    (mục 11), nhận cả tệp .md.

## 4. Bài kiểm tra trong bài học

- Thêm bằng "+ Thêm quiz" → "Tạo quiz" → "Mở trình soạn".
- Trình soạn có các nút: "Cài đặt", "AI import", "Excel import", "Nhập thủ công",
  danh sách "Câu hỏi (n)". (Trình soạn của giảng viên không đổi từ 2026-10-03.)
- **Cài đặt:** Thời gian làm bài · Số lần làm · Hạn mở · Hạn đóng · "Cách tính điểm
  khi làm nhiều lần" (Cao nhất / Lần cuối / Trung bình; chỉ hiện khi cho làm nhiều lần). Mỗi cài đặt có
  công tắc; tắt thì là "Không giới hạn" / "Mở ngay" / "Không có hạn". Có thêm "Lịch theo lớp" (xem mục 7).
  **"Độ khó (1 dễ – 5 khó)" và "Đánh giá độ tự tin" chỉ hiện với tài khoản nhà nghiên cứu** — không nhắc cho
  giảng viên thường.
- **Luồng thêm:** bấm "+ Thêm quiz", gõ tên, bấm "Tạo quiz" thì hệ thống tự mở trang trình soạn;
  "Mở trình soạn" chỉ có ở bài kiểm tra đã tạo.
- **Nhập hàng loạt** ("AI import", "Excel import"): chỉ nhận 5 dạng (trắc nghiệm, đúng/sai,
  sắp xếp, ghép cặp, điền khuyết); AI nhận tối đa 20.000 chữ, Excel tối đa 500 câu một lần; cả
  hai có bước xem trước.
- **9 dạng câu hỏi:** Trắc nghiệm · Đúng / Sai · Điền khuyết · Sắp xếp thứ tự ·
  Ghép cặp · Đáp án dạng số · Tự luận · Trả lời ngắn · Kéo thả từ/câu.
- *Phía học viên (đổi 2026-10-08):* màn làm quiz là trang riêng (bản đồ câu hỏi, "Đánh dấu", "Câu trước" /
  "Câu sau", hộp xác nhận khi nộp có số câu thiếu); đáp án lưu ngay khi chọn ("Đã lưu lúc …"); hết giờ tự
  nộp. Trang kết quả có khung "Xem lại từng câu" và nút hỏi trợ giảng ở câu sai.

## 5. Kiểm tra đánh giá (hệ thống riêng với bài kiểm tra trong bài học)

Ba bước ở trang **Bắt đầu** (`/instructor/assessment`, tiêu đề "Kiểm tra đánh
giá"): Bước 1 Ngân hàng câu hỏi · Bước 2 Thiết kế đề thi · Bước 3 Tổ chức thi.
Bước 1 có thể bỏ qua nếu soạn câu hỏi thẳng trong đề. (Chữ Bước 3 ở trang này còn nói "đợt thi chính thức
gồm nhiều ca" — đã lỗi thời, đừng lặp lại.)

**Ngân hàng câu hỏi** (`/instructor/question-banks`):
- "+ Tạo ngân hàng mới": "Tên ngân hàng" + "Phạm vi" (Riêng tư — chỉ mình thầy/cô,
  hoặc chia sẻ với đồng giảng viên của một khoá).
- Trong ngân hàng: thêm bằng dán chữ cho AI định dạng, nhập Excel (.xlsx), hoặc
  "+ Nhập thủ công". Bảng có các cột: Mã câu · Câu hỏi · Chủ đề · Loại · Trạng thái ·
  Thẩm định · Tư duy · Độ khó · Cập nhật · Đợt thi (cột này nay hiểu là số lần câu đã dùng; không nêu).
  Thẩm định: Chưa thẩm định / Đã duyệt / Cần sửa. Có xuất bản và lưu trữ hàng loạt. Ngân hàng **không có**
  ô rubric.
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
- **Câu tự luận** trong đề có ô **"Rubric (tuỳ chọn)"** (ô soạn thảo định dạng, gợi ý "Tiêu chí chấm bài…")
  và "Số từ tối thiểu (0 = không yêu cầu)". Khi chấm, rubric hiện ngay trên bài làm trong khối thu gọn
  **"Rubric chấm"** (bấm để mở), cả ở trang "Chấm bài" lẫn trang "Xem bài làm" của từng lượt thi; câu
  không có rubric thì không hiện khối này.
- Nút xuất bản vẫn ghi "Publish". **Publish chỉ làm đề sẵn sàng, không tự mở thi**; hộp thoại sau Publish
  dẫn sang "Tổ chức thi →". Đề luyện thi (đề thi thử, mục 12) cho học viên đã ghi danh làm ngay, không cần ca.
- Mỗi thẻ đề có nút "Xoá"; đề đã có lượt thi thì nút khoá kèm lý do ("Đề đã có lượt thi nên không xoá được.").
- **"Thi thử"** (mới): đề viết có nút "Thi thử" cho giảng viên (`…/exams/<id>/thi-thu`) — bản thử, không tạo
  lượt thi, không ảnh hưởng điểm hay kết quả. Nộp xong hiện "Đã nộp bản thử" cùng "Thi thử lại" và "Quay lại
  đề thi".
- **Trọng số theo Phần** (mới): tab Nội dung › "Chia đề thành nhiều phần (nâng cao)" › thẻ "Trọng số điểm
  theo phần", nút "Lưu trọng số" / "Bỏ trọng số". Chỉ có hiệu lực khi đề từ 2 phần, mọi phần có trọng số,
  tổng đúng 100%, và không phần nào rút ngẫu nhiên từ ngân hàng. Khi có hiệu lực, trọng số thay điểm %
  chính thức (trang Kết quả, tệp Excel, kết quả học viên xem); điểm thô giữ nguyên; trang Kết quả ghi chú
  "Điểm tính theo trọng số: …".

**Tổ chức thi** (`/instructor/organize`, tiêu đề "Tổ chức thi", câu hỏi "Bạn định tổ chức kiểu gì?"). Trang
chỉ có 3 thẻ để TẠO MỚI; lịch sử không còn ở đây (mỗi trang con có dòng "Xem và quản lý các lần thi trong
Lịch sử thi →"). Đi từ đề sang (nút Tổ chức thi) thì hiện "Đang tổ chức cho đề: …" và chọn sẵn đề.
1. **Link thi nhanh** (`/instructor/organize/quick`): "Đề thi" · "Thời lượng làm bài (phút)" · "Hiện đáp án
   và kết quả" (4 lựa chọn: Hiện ngay sau khi nộp / Hiện điểm, không hiện đáp án / Hiện sau khi đóng buổi
   thi / Không hiện) · "Tuỳ chọn nâng cao — giờ mở/đóng" (Hẹn giờ mở, Hẹn giờ đóng) · nút "Mở". Mở xong
   hiện "Đã mở buổi thi.", mã 6 ký tự, nút sao chép link, mã QR, "Mở buổi khác", "Xem kết quả". Không hẹn
   giờ thì buổi mở ngay và đóng khi giảng viên bấm.
2. **Thử nghiệm câu hỏi**: cùng một biểu mẫu với link thi nhanh (blurb nói mặc định không hiện đáp án — chưa
   kiểm chứng trong mã).
3. **Kỳ thi chính thức** (`/instructor/organize/formal`): "Đề thi" · "Tên ca" (tuỳ chọn) · "Mở lúc" ·
   "Đóng lúc" · "Cách vào thi" (**Theo phòng** / **Tự do**) · "Hiện đáp án và kết quả" (Sau khi đóng ca /
   Ngay sau khi nộp / Không hiện) · nút **"Tạo ca thi"**. **Không còn bước tạo đợt, không còn "+ Tạo đợt
   thi" hay "Trưởng đợt"**: cấu trúc là **Ca thi › Phòng thi**. Tạo xong sang trang ca
   (`/instructor/exam-sessions/<id>?tab=rooms`).

**Trang ca** (nút "Quản lý ca" ở Lịch sử thi): 3 tab **Tổng quan · Phòng thi · Kết quả**; đầu trang có "In
phiếu mã", "Live monitor", bộ đếm "Đang chờ: N" (người trong phòng chờ).
- Thẻ "Chế độ thi": "Đổi sang Tự do" / "Đổi sang Theo phòng" (chặn khi có bài đang làm). Theo phòng: "Nguồn
  mã thi cho thí sinh" là Ngẫu nhiên (8 ký tự) hoặc MSSV. Tự do: có "Mã thi chung", "Copy mã", "Sinh mã mới"
  và đường dẫn `/thi`.
- Tab Tổng quan: "Thông tin ca thi" › "Chỉnh sửa" (Mã ca, Tên ca, Mở từ, Đóng lúc, "Thời lượng (phút) —
  override", "Số thí sinh tối đa" — ô này chỉ hiện với ca Tự do), "Đổi trạng thái", "Vùng nguy hiểm" › "Xoá ca
  thi".
- Tab Phòng thi: **"Danh sách thí sinh"** của cả ca (chỉ chế độ Theo phòng) với ba nguồn **"Lấy từ lớp
  học"**, **"Dán từ Excel"** (cột Họ tên, MSSV, Email, Mã lớp học, Mã lớp thi; chỉ Họ tên bắt buộc), **"Gõ
  từng em"** ("Thêm thí sinh"), và "Dán cột MSSV" (ghép theo email). Bảng phòng: **"Nhập từ danh sách"** (dán
  bảng phòng + giám thị + lớp học + thí sinh; bắt buộc cột "mã lớp thi" = tên phòng; tối đa 2.000 dòng) và
  **"+ Thêm phòng thi"** (hộp thoại "Tạo nhiều phòng thi", tối đa 50 phòng). Cột: Tên phòng, Địa điểm / Zoom,
  Giám thị, Người chấm, Thí sinh, Đang làm, Đã nộp. Mỗi phòng có "Mã giám thị" (gửi riêng cho giám thị) và
  "Mã phòng cho thí sinh".
- **Mở và đóng ca:** ca chính thức chạy theo giờ "Mở lúc" / "Đóng lúc". Trạng thái Nháp / Đang mở / Đã đóng /
  Lưu trữ **chỉ để phân loại** (không tự mở hay đóng ca). Muốn dừng sớm thì sửa "Đóng lúc" trong "Chỉnh sửa".
  Nút "Đóng ca" / "Mở lại" chỉ có với ca chạy thủ công (thường là link thi nhanh không hẹn giờ).

**Lịch sử thi** (`/instructor/exam-history`): tab Tất cả · Link thi nhanh · Thử nghiệm câu hỏi · Kỳ thi chính
thức. Mỗi thẻ ca có nhãn Đang mở / Đã đóng, số "bài đã nộp", và các nút "Giám sát" (ca đã đóng thành "Xem
lại") · "Kết quả" · "Tải" · "Quản lý ca" (chỉ ca chính thức) · "Phòng thi" · "Đóng ca" / "Mở lại" · "Xoá". Xoá
chỉ được khi ca đã đóng và chưa có bài nộp; nếu không, hộp thoại "Xoá ca thi?" gợi ý "Lưu trữ ca".

**Kết quả:** "Kết quả" mở `/instructor/exam-runs/<id>` với ba lát cắt "Theo thí sinh/học viên" · "Theo câu
hỏi" · "Chờ chấm tay"; có lọc ca và phòng, tìm kiếm, sắp xếp, "Xem bài làm" (chỉ bài đã nộp; chấm tại chỗ câu
tự luận, "← Bài trước" / "Bài sau →", nhãn "Đã chấm xong"); bài còn tự luận ghi "chưa gồm câu chờ chấm". Menu
"Xuất file": "Bảng điểm (Excel)" và "Dữ liệu phân tích (CSV)". Tab Kết quả của trang ca có "Xuất bảng điểm ca
thi (Excel)", mỗi dòng một thí sinh (STT, Họ tên, MSSV, Email, Mã lớp học, Mã lớp thi, Phòng, Mã thi, Trạng
thái, Điểm, Điểm thang 10, Nộp lúc, Số lượt); thí sinh chưa vào thi vẫn có dòng.

**Thí sinh thấy gì:** vào `/thi` ("Bắt đầu làm bài thi", ô "Mã thi", "Vào thi →").
- **Mã chung 6 ký tự** (link thi nhanh, ca Tự do): bắt buộc đăng nhập, không cần ghi danh khoá; được thêm vào
  ca và xếp vào phòng mặc định.
- **Mã cá nhân 8 ký tự** (ca Theo phòng): không cần đăng nhập; lời chào theo tên, màn "Xác nhận lớp học" rồi
  "Xác nhận → Bắt đầu thi". Mã vào thi là duy nhất toàn hệ thống.
- **Phòng chờ** mở trước giờ thi 15 phút ("Đã vào phòng chờ", đếm ngược), tới giờ tự sang "Ca thi đã mở" kèm
  nút "Vào thi"; đồng hồ làm bài chỉ chạy từ lúc bấm "Vào thi". Ca thủ công chưa mở ghi "Đang chờ giảng viên
  bắt đầu".
- **Giới hạn mạng khi vào thi** là cài đặt của quản trị trường (`/org-admin/settings`), giảng viên không tự
  đặt; thí sinh ngoài dải mạng thấy "Bạn đang ở dải mạng không phù hợp để vào thi." Đề luyện thi không bị giới
  hạn. Ca đủ người: "Ca thi đã đủ số lượng thí sinh tối đa. Liên hệ giảng viên."
- **Giám thị** vào `/giam-thi` ("Giám thị coi thi", ô "Mã giám thị", "Vào phòng thi"), không cần tài khoản,
  bằng mã giám thị của phòng (khác mã thí sinh). Xem kết quả: `/exam/<mã>/result`, theo lựa chọn "Hiện đáp án
  và kết quả" của ca.

"Chốt" = cố định bộ câu đang rút ngẫu nhiên từ ngân hàng vào đề. Trình hướng dẫn Cơ bản còn dùng chữ "học
sinh" ("Phát đề cho học sinh") — lệch thuật ngữ "học viên"/"thí sinh" của khoá. Tab Kết quả của trang ca còn
hiện "Đạt / Chưa đạt" và "Điểm %" cũ — đừng lặp lại.

## 6. Bài tập

- Thêm bằng thẻ "Assignment" ("Bài tập — instructor chấm tay") hoặc "+ Thêm
  assignment". Ô: "Tiêu đề assignment", "Mô tả nhiệm vụ...", "Hạn nộp (optional)",
  "Điểm tối đa". Mục **"Cách nộp"**: "Nộp cá nhân" / "Nộp theo nhóm" (link "Xem các nhóm"; đã có bài nộp
  thì không đổi được). Có mục thu gọn "Gợi ý dạng bài làm (không bắt buộc)" với nút
  **"Gợi ý bằng AI"** và các dạng: Tóm tắt, Tự giải thích, Hình dung tình huống,
  Vẽ sơ đồ, Vẽ minh hoạ, Dạy lại, Thực hành minh hoạ. Form tạo/sửa bài tập **không còn** ô rubric.
- **Thẻ bài tập trong bài học** có nút "Xem bài nộp" và ba nút biểu tượng không chữ (rê chuột mới hiện tên):
  con mắt (ẩn/hiện với học viên), bút chì "Sửa assignment" (mở lại form: tiêu đề, mô tả, điểm tối đa, cách nộp,
  hạn nộp), thùng rác "Xóa assignment" (hỏi "Xóa assignment này?"; **xoá luôn mọi bài nộp và điểm** của bài tập,
  không khôi phục được, kể cả khi đã có học viên nộp). **Chưa có chuyển bài tập sang bài học khác**: đặt nhầm
  chỗ thì tạo bài tập mới ở bài đúng rồi xoá bài cũ, tốt nhất trước khi học viên nộp. Bài tập chỉ quản lý (sửa,
  xoá) ở trang bài học; trang `/instructor/assignments` chỉ để xem bài nộp và chấm.
- **Tiêu chí chấm (rubric)** của bài tập: khung **"Rubric chấm điểm (không bắt buộc)"** nằm TRÊN bảng "Danh
  sách" ở trang bài nộp, gợi ý "Ví dụ: 3đ nêu đúng khái niệm. 4đ có ví dụ. 3đ trình bày rõ ràng.", nút
  "Lưu rubric", tối đa 5.000 ký tự. **Chỉ nhập bằng chữ, không đính kèm tệp**: rubric có sẵn trong Word/PDF
  thì sao chép phần chữ rồi dán vào khung. Trong cửa sổ chấm có khối thu gọn "Rubric chấm điểm (bấm để xem / sửa)"
  (tự mở khi chưa có rubric). **Không phải bảng tiêu chí có cấu trúc**; AI đọc đúng đoạn chữ này khi gợi ý
  điểm. Các chỗ nhập rubric khác của Limio: câu tự luận trong đề thi ("Rubric (tuỳ chọn)", mục 5), vấn đáp AI
  (mục 13), nhiệm vụ Đấu trường kiểu chấm chéo (mục 16, đây mới là bảng có cấu trúc).
- **Màn chấm** `/instructor/assignments`: hai tab "Danh sách assignment" và "Cần chấm"
  (hàng chờ của mọi khoá; đếm theo từng người, chưa gộp theo nhóm). Trang bài nộp có bốn thẻ số **"Tổng học
  viên · Chưa nộp · Chờ chấm · Đã chấm"**, bảng "Danh sách" (STT / Người nộp / Lớp / Trạng thái "Chưa nộp /
  Đã nộp / Đã chấm" / Ngày giờ nộp / Bài làm / Điểm), ô tìm theo tên hoặc email, lọc "Tất cả lớp (n)", sắp
  xếp theo cột.
- **Cửa sổ chấm** ("Xem bài làm"): chia hai cột từ màn hình lớn — trái là **xem trước file đính kèm** (PDF nộp
  qua upload, ảnh, video, audio, YouTube/Vimeo, Google Docs/Sheets/Slides/Drive; loại khác hiện thẻ link và nút
  "Mở trong tab mới"), phải là bài làm và form chấm.
  - Đầu cửa sổ có **"← Trước", "Sau →"** và chỉ số "n/tổng"; phím ←/→ cũng chuyển bài (trừ khi con trỏ ở ô
    nhập). Chân cửa sổ có ô tích "Chỉ chuyển qua bài chờ chấm" và "← Quay lại danh sách". Chuyển bài khi điểm
    hoặc nhận xét chưa lưu thì hỏi xác nhận.
  - Ô "Điểm", "Nhận xét"; nút "✓ Chấm điểm" / "Cập nhật điểm"; **"Chấm & bài tiếp →"** lưu rồi chuyển bài kế
    (với bài đã chấm đổi thành "Cập nhật & bài tiếp →"). Nhận xét này đến tay học viên.
  - **"✨ Gợi ý điểm bằng AI"** điền sẵn điểm và nhận xét *nháp* — AI không bao giờ tự lưu. AI chấm từng tiêu
    chí rồi hiện "Theo tiêu chí: tên x/y" (điểm làm tròn số nguyên; nhận xét là chữ thường, không markdown).
    AI đọc chữ trong PDF/Word/txt, Google Docs/Sheets/Slides đã mở quyền xem, và bài nói (chưa có bản chữ thì
    chuyển chữ ngay, trừ vào ví AI của giảng viên). **AI không chấm ảnh, video, PDF scan hay link ngoài** (hiện
    cảnh báo "AI chưa đọc …"). **Giới hạn 20.000 ký tự (khoảng 7 trang)**; bài dài hơn có cảnh báo "Bài dài
    khoảng N trang — AI sẽ chấm tối đa được 20.000 ký tự…".
- **Nộp theo nhóm:** nhóm do **học viên tự lập** ở khối "Nhóm của tôi" trên trang khoá (chỉ hiện khi khoá có
  bài tập nhóm): "Tạo nhóm" / "Vào nhóm bằng mã" (mã 6 ký tự), "Sao chép mã", "Đổi mã", "Đổi tên" (trưởng nhóm
  khi chưa khoá), "Rời nhóm". Giảng viên vào trang **"Nhóm làm bài tập"** (`/instructor/courses/{id}/teams`,
  mở từ tab "Lớp học") để đặt "Số người tối đa mỗi nhóm", "Khoá danh sách nhóm" / "Mở khoá", đổi tên nhóm
  (bút chì), đặt trưởng nhóm, gỡ người, chuyển người sang nhóm khác, thêm người chưa có nhóm — kể cả khi đã
  khoá. Trang chấm bài nhóm: mỗi nhóm một dòng, cột "Điểm nhóm", mục "Sinh viên chưa có nhóm"; cửa sổ chấm có
  "Phần việc của tôi" của từng người, "Điểm nhóm", "Chỉnh điểm riêng" / "Bỏ điểm riêng" (chấm điểm nhóm xong
  mới chỉnh riêng được). Học viên thấy "Nộp lần cuối bởi …"; nộp lại đưa cả nhóm về chưa chấm, có hộp xác
  nhận.
- **Tự luận trong đề thi** chấm ở trang "Chấm bài" của đề thi (cột điểm tự luận) với nút **"Gợi ý chấm"**;
  "↻ Chấm lại tất cả" nằm cùng trang và chỉ tính lại câu trắc nghiệm (giữ điểm tự luận đã chấm tay). Trang
  "Chấm tự luận" (`/instructor/grade-essays`) là hàng chờ chấm tự luận của quiz và đề thi, **không có** "Gợi ý
  chấm". Trong chấm bài thi, "Gợi ý chấm" không hứa đọc tệp.

## 7. Hạn theo lớp (đổi 2026-09-30)

Nằm trong **form sửa** bài tập hoặc bài kiểm tra. Tiêu đề **"Hạn nộp bài"** (bài tập) hoặc **"Khi nào học
viên được làm bài?"** (quiz). Hai lựa chọn: **"Cùng một lịch cho mọi lớp"** và **"Mỗi lớp một hạn riêng"**
(quiz: "Mỗi lớp một lịch riêng"). Ô ngày: "Mở lúc" và "Hạn nộp" / "Đóng lúc"; để trống thì hiện "Mở ngay" /
"Không có hạn" / "Không đóng". Có "Chọn tất cả lớp" và **"Áp dụng cho n lớp đã chọn"**; hàng chung là "Tất cả
học viên" hoặc "Chưa vào lớp nào". Hạn chỉ lưu khi bấm "Lưu" của form. (Không còn nút "Dùng hạn chung" /
"Sửa".)

## 8. Cá nhân hoá và lộ trình

- Khi bật "Bật cá nhân hoá học tập", **mỗi bài học tự thành một "Chủ đề"** — giảng
  viên không phải gắn tay. Câu hỏi trong bài thừa hưởng chủ đề của bài.
- Giảng viên tự gắn: chip "n chủ đề" / "chưa có chủ đề" ở thanh trên của bài mở ra
  hộp chọn có ô tìm và "+ Tạo skill mới...". Chủ đề giảng viên gắn **luôn thắng**
  chủ đề tự sinh. Bài kiểm tra độc lập (không gắn bài học) không được gắn tự động.
- **Quan niệm sai** (còn gọi lỗi tư duy): trong biểu mẫu câu hỏi có ô "Không gắn quan
  niệm sai" và "+ Tạo quan niệm sai mới". Gắn vào *phương án sai* để hệ thống nói
  đúng học viên hiểu nhầm chỗ nào.
- **Nắm kiến thức** (`/instructor/learner-insights`): **nhãn thật trong giao diện còn tiếng Anh** — tiêu đề
  "Learner Insights"; thẻ số "Học viên tracked", "Skill tracked", "Mastery TB", "HV có skill
  yếu"; "Ma trận học viên × skill"; "Coverage theo skill". Có hộp chọn **"Tất cả khoá"** để lọc theo khoá
  (mới). Khi hướng dẫn, nói "chủ đề" và nêu kèm nhãn thật để giảng viên tìm. Giảng viên thấy phần trăm.
- **Học viên cần hỗ trợ** (`/instructor/courses/{id}/struggling-students`): cột
  "Lỗi tư duy chưa khắc phục", "Kỹ năng yếu", "Hoạt động gần nhất". Lối vào từ trang
  Học viên.
- **Học viên chỉ thấy nhãn, không thấy phần trăm:** **Cần ôn** (dưới 60%) ·
  **Nên luyện thêm** (từ 60% tới dưới 85%) · **Vững** (từ 85%) · "Chưa có dữ liệu".
  Trang `/me/skills` "Bản đồ chủ đề của bạn"; trang khoá có "Lộ trình của bạn" với
  các bước "Ôn lại trước khi học tiếp", "Bài tiếp theo", "Luyện thêm cho chắc", "Có
  thể lướt qua"; ở bài có thể thấy "Bạn có thể bỏ qua bài này".

## 9. Lớp học và tương tác

- **Lớp học** (tab "Lớp học", `/enroll/[mã]` cho học viên): nút "Tạo lớp" mở biểu mẫu **"Tạo lớp học"** có
  "Tên lớp" (gợi ý "Vd: Lớp K65-CS1"), **"Kỳ học"** (ví dụ "HK1 2026-27") và **"Ghi chú"**; có thêm
  **"Nhập từ Excel"** để tạo nhiều lớp (Tên lớp / Kỳ học / Ghi chú, tối đa 200 lớp). Danh sách lớp là bảng
  "Tên lớp / Kỳ học / Ghi chú / Sĩ số / Ngày tạo" với ô "Tìm lớp học"; bấm một dòng để mở rộng, có các nút
  "Sửa", "Tạo lại mã mời" (link cũ chết ngay), "Xoá" (chỉ khi lớp rỗng) và **"Danh sách học viên (n)"**. Mỗi
  lớp có hộp **"Link mời vào lớp"** kèm "Sao chép" và "Mã QR". **"Nhập học viên"** nhận tệp CSV có dòng đầu
  `name,email`. Danh sách lớp có cột Học viên / Trạng thái / Vào lớp / Tiến độ / Điểm quiz gần nhất /
  "Chuyển lớp". Khoá "Chỉ vào bằng link mời lớp" chỉ vào được bằng các link này. Trang đón: "Lời mời tham gia
  lớp học" → "Vào học". Từ tab này còn mở được trang "Nhóm làm bài tập" (mục 6).
- **Học viên** (tab "Học viên"): trạng thái Đang học / Đã hoàn thành / Bỏ học / Đã hoàn
  tiền / Hết hạn truy cập; tìm theo tên hoặc email; "Gán lớp", "Xoá khỏi khoá học",
  "Tải danh sách học viên".
- **Diễn đàn** ("Forum Q&A"): học viên bấm "💬 Thảo luận" trong bài rồi "Đăng câu hỏi". Giảng viên vào
  "Forum Q&A": bốn thẻ số (Tổng thread / Chưa giải đáp / Đã xử lý / Stale), hộp chọn "Tất cả khoá học", lọc
  Tất cả / Chưa giải đáp / Đã xử lý và nút "Stale >48h", liên kết "Mở thread"; trong chủ đề bấm **"Đánh dấu là
  câu trả lời"** để chuyển sang "Đã xử lý".
- **Ghi chú theo vùng chọn và Hỏi AI** (cho học viên đã ghi danh và chủ khoá): bôi đen
  một đoạn chữ trong bài → bấm chuột phải → **"Viết annotation"** hoặc **"Hỏi AI về đoạn
  này"**. Ghi chú có hai chế độ **"Riêng tư"** và **"Cả lớp"** ("Chia sẻ với cả lớp").
  Không có trong chế độ xem trước. Ngoài ra có khung nổi **"Trợ giảng AI"** (tính vào
  Token AI).
- **KHÔNG có tính năng thông báo lớp.** Không viết.

## 10. Theo dõi, gamification, chứng nhận, e-portfolio, trang chủ

- **Trang chủ giảng viên** (`/instructor/dashboard`): một cột hẹp ở giữa, nhiều khoảng trắng. Từ trên xuống:
  lời chào theo giờ Việt Nam ("{Chào buổi sáng/chiều/tối}, {tên}") và câu "Thầy/cô muốn tìm gì, hoặc làm gì hôm nay?";
  **ô tìm kiếm lớn** (ô nhập "Tìm khoá học, bài, đề thi… hoặc hỏi Lily cách làm", nút "Hỏi Lily" bên phải); dòng lối
  tắt "Tạo slide", "Tạo đề thi", "Tạo khoá học", "Hoạt động trên lớp"; và **"Khoá học gần đây"** (3 khoá vừa sửa, có "Tất
  cả khoá học (n)" hoặc "Quản lý khoá học").
  - **Ô tìm kiếm** tìm trong khoá học, bài học, đề thi và slide của chính giảng viên; gõ không dấu vẫn ra ("thiet ke"
    ra "Thiết kế"). Bấm vào ô khi còn trống thì hiện gợi ý "Hay làm". Dùng mũi tên lên/xuống rồi Enter để mở một dòng.
    Dòng cuối "Hỏi Lily: “…”" (hoặc Enter khi chưa chọn dòng nào, hoặc nút "Hỏi Lily") chuyển câu đang gõ cho Lily
    và mở ngăn kéo chat.
  - **Hai nút trên thanh đầu trang** (ở mọi trang giảng viên): **chuông thông báo** và nút **"Lịch"**. Chuông của giảng
    viên liệt kê các việc đang chờ, mới nhất trước: bài tập chờ chấm ("{tên} đã nộp bài tập"), tự luận trong đề thi chờ
    chấm ("{tên} cần chấm tự luận"), bài nộp nhiệm vụ Đấu trường cần duyệt tay, câu hỏi diễn đàn mới, **ca thi sắp
    diễn ra trong 24 giờ** ("Ca thi {giờ} hôm nay") và một dòng gộp **"{n} học viên không hoạt động quá 14 ngày"**.
    Số trên chuông là số mục mới kể từ lần mở chuông gần nhất (dòng học viên im ắng không tính vào số này). Nút
    **"Lịch"** mở lịch tuần (đổi được sang Tháng; "Hôm nay"; chỉ hiện hạn bài tập và bài kiểm tra; tài khoản thuộc
    trường thấy nhãn "Tuần N").
  - Trang chủ **không còn** dải số liệu, khối "Gamification theo khoá", "Hoạt động gần đây" và lịch nằm sẵn trên trang
    (xem gamification ở tab Gamification của từng khoá; xem học viên ở trang "Enrollments").
- **Tiến độ:** tab Học viên, danh sách lớp (cột "Tiến độ"), tab Grade (có "Tải bảng
  điểm quiz" và "Tải bảng điểm bài tập"), trang chủ giảng viên.
- **Gamification — giảng viên chỉ xem, không cấu hình** (không chỉnh XP, huy hiệu hay
  nhiệm vụ). Tab Gamification có lọc "Lớp", "Tải CSV", các thẻ: Học viên, Tổng XP, XP
  trung bình, Badge đã cấp, Đang có streak, Phân bố level; bảng từng học viên mở rộng
  được ("Badge trong khoá này", "20 giao dịch XP gần nhất"); nhãn "Ẩn khỏi BXH". Học viên
  thấy: `/xp-guide` "Cách tính điểm (XP)", `/leaderboard` "Bảng xếp hạng" (Hôm nay / Tuần
  này / Tháng này / Mọi thời), `/me/badges` "Huy hiệu của bạn", "Nhiệm vụ hôm nay" (3
  nhiệm vụ cố định: "Học 1 bài", "Vượt 1 quiz", "Khắc phục lỗi tư duy"). Chuỗi ngày học
  (streak) chỉ là số liệu, không cấp XP. Giảng viên chỉ đặt điểm XP ở **Đấu trường**.
- **Hồ sơ năng lực (e-portfolio)**: chỉ phía học viên, menu "e-Portfolio của tôi", `/me/portfolio` ("e-Portfolio
  của bạn"), trang công khai `/p/{slug}`. Học viên bật công tắc "Công khai", viết "Dòng giới thiệu" / "Giới
  thiệu ngắn", chọn **khoá đã hoàn thành có chứng nhận** để "Đang khoe", mỗi khoá tối đa **2 bài** (được chọn
  cả bài chưa chấm), mỗi bài có câu giới thiệu riêng; bài Đấu trường gộp theo đấu trường. Trang công khai
  **không hiện điểm và nhận xét của giảng viên** (bài đã chấm có nhãn "GV đã chấm"). Giảng viên không phải cài
  gì và chưa có mục xem phía giảng viên.
- **Chứng nhận:** tự cấp khi học viên hoàn thành khoá ("Xem chứng nhận"), tải PDF, có
  trang xác minh `/verify/{số chứng nhận}`. Không có cài đặt phía giảng viên.
- **Token AI** (`/me/ai-tokens`, tiêu đề trang "Lượt hỏi AI"): "Còn lại tháng này" (so với hạn mức, thanh phần
  trăm đã dùng), "Đã mua thêm" (không mất khi sang tháng), "Ước tính còn dùng được" (lượt hỏi AI), "Các gói",
  "Xác nhận đặt mua" → "Đã tạo đơn" (thanh toán chuyển khoản kèm mã đơn), "Lịch sử đơn". Chỉ có khi quản trị
  viên mở trang — đừng hứa với mọi giảng viên.
- **Cài đặt tài khoản** (`/me/settings`, "Cài đặt"): "Hướng dẫn sử dụng" với nút "Xem lại hướng dẫn", "Hồ sơ
  công khai" (Ảnh đại diện, tên hiển thị, email), công tắc "Ẩn khỏi bảng xếp hạng", "Quyền riêng tư", "Mật
  khẩu" (tối thiểu 8 ký tự).
- **Quản trị trường** (`/org-admin/settings`, "Thương hiệu & kỳ học"): thương hiệu cho bài giảng Limio-Live
  (mục 14), "Kỳ học & lịch" (Tuần 1 = tuần Thứ Hai–Chủ Nhật chứa ngày bắt đầu), giới hạn mạng khi vào thi.
  Giảng viên không tự đặt được.

## 11. Tạo bài học từ tài liệu ("Văn bản — AI hỗ trợ", mới)

Chọn "Văn bản — AI hỗ trợ" trong "+ Thêm hoạt động/tài nguyên" **không mở form dán chữ trong hộp thoại nữa**
mà chuyển sang trang riêng `/instructor/courses/{id}/lessons/{lessonId}/from-document` ("Tạo bài từ tài liệu",
thanh bước **Tài liệu → Dàn ý → Bài học**). Mỗi tài liệu chỉ ra **một bài học**, không gợi ý cắt bài; tài liệu
tối đa **4.000 từ** (dài hơn thì báo lỗi, giảng viên tự chia tệp).

**Tệp Word (.docx) và Markdown (.md) đi đường riêng, không qua AI và không có bước Dàn ý:** nút ở bước một
ghi **"Đưa vào bài học"**; tệp vào thẳng một bài, giữ nguyên tiêu đề, bảng, ảnh, danh sách như trong tệp (tên
tài liệu ở dòng đầu được bỏ vì bài đã có tên). Thanh bước chỉ còn **Tài liệu → Xem trước**; màn xem trước có tên
tệp, số từ, số ảnh, nút bảng màu và **"Áp dụng vào bài học"**, "Dùng tài liệu khác". **AI chỉ chạy khi giảng viên bấm**
(mỗi lần tốn một lượt hỏi AI): nút **"Thêm Mục tiêu và Tổng kết"** (AI rút từ chính chữ của bài; hộp Mục tiêu ở
đầu bài, hộp Tổng kết ở cuối; bấm lại ghi "Tạo lại Mục tiêu và Tổng kết", còn có "Bỏ Mục tiêu và Tổng kết"); và
**bấm vào một đoạn** trong bài (đoạn được viền xanh) để hiện thanh **"Nhờ AI sửa đoạn đã chọn"** với bốn việc:
"Viết ngắn hơn", "Dễ hiểu hơn", "Thêm ví dụ", "Sửa chính tả". AI trả bản đề xuất cạnh "Bản hiện tại"; giảng
viên bấm **"Dùng bản này"** hoặc "Bỏ", không có gì tự thay đổi. Đoạn có liên kết, ảnh hay ký hiệu đặc biệt thì
chưa nhờ AI được. Phần dưới đây là đường của PDF, .txt và văn bản dán.
1. **Bước Tài liệu** ("Biến tài liệu thành bài học"): kéo thả hoặc chọn tệp (Word .docx, PDF, .txt, .md, tối
   đa 10 MB; ảnh trong Word được giữ) hoặc dán vào ô "Dán nội dung bài vào đây...". Cần ít nhất 200 ký tự. PDF
   chụp ảnh không đọc được chữ, phải dán văn bản. Chọn **"Mẫu bài"** (một lần cho cả bài): "Bài lý thuyết"
   (Mục tiêu → các mục → Tổng kết), "Bài hướng dẫn thực hành" (Mục tiêu → Chuẩn bị → Các bước → Lỗi thường gặp
   → Tổng kết), "Bài ôn tập" (Ý chính cần nhớ → Câu hỏi thường gặp → Tự kiểm tra). Bấm **"Đọc tài liệu và lập
   dàn ý"** (tài liệu dài mất khoảng một phút).
2. **Bước Dàn ý** (hai cột). Trái: sửa "Tên bài học", "Mục tiêu học tập" ("+ Thêm"), từng mục (kéo thả đổi
   thứ tự, "Tiêu đề mục", "Ý chính của mục", "+ Thêm ý", "Xoá mục", "Thêm mục"). Đoạn tài liệu AI bỏ sót được
   tự nối vào mục đứng trước, giảng viên không phải gán từng đoạn.
   Phải: thẻ "Xem trước" và "Tài liệu gốc" (đoạn chưa thuộc mục nào có "Gán vào mục…"). "Đổi mẫu" → "Lập lại
   dàn ý"; "Dùng tài liệu khác" để làm lại. Bản nháp tự lưu ("Đã lưu"), mở lại trang làm tiếp được. Chọn **"Cách
   viết"**: "Giữ nguyên lời" hoặc "Biên tập cho mạch lạc"; tick "Thêm Mục tiêu và Tổng kết"; màn hiện "Dự kiến
   khoảng N token khi tạo bài". Tick "Tôi đã xem dàn ý" rồi bấm **"Chốt dàn ý"** (chỉ bật khi dàn ý không lỗi).
3. **Bước Bài học:** bấm **"Tạo bài"**, AI viết từng mục theo tiến độ; kết quả ở thẻ "Bài học" (xem trước, đối
   chiếu tài liệu gốc). Đổi ý: "Quay lại dàn ý", "Tạo lại" (hỏi xác nhận, tốn thêm token). Bấm **"Áp dụng vào bài
   học"** — bài thứ nhất thành một khối Văn bản mới ở cuối bài. Nếu dàn ý có nhiều bài thì nút ghi "Áp dụng N bài
   học": các bài sau thành bài MỚI cùng chương, đang ẨN với học viên cho tới khi giảng viên bật "Hiện bài này" (nút xanh ngay cạnh nhãn "Đang ẩn" ở đầu bài,
   hoặc công tắc cùng tên trong menu "⋮").
4. **Giao diện của bài** (nút "Giao diện", "Bảng màu và kiểu chữ của cả bài"): 6 bảng màu (Xanh Limio, Giấy ấm,
   Rừng thông, Hoàng hôn, Sinh động, Trang nhã); 3 kiểu chữ (Hiện đại, Dễ đọc, Học thuật); 7 bố cục (Văn bản,
   Chữ và ảnh, Thẻ khái niệm, So sánh hai cột, Các bước, Hỏi và đáp, Số liệu nổi bật); 5 loại hộp (Mục tiêu
   học tập, Tổng kết, Lưu ý, Ví dụ, Định nghĩa). Giảng viên **không phải chọn bố cục từng mục** — AI tự chọn.
5. **Sửa sau khi áp dụng** (hàng khối bài → "Mở trình soạn" hoặc bút chì): "+ Chèn khối" ("Mục mới, chọn bố
   cục", "Hộp", "Ảnh có chú thích"); thanh "Mục" có "Bố cục của mục", **"Nhờ AI"** (sửa MỘT mục: "Viết ngắn
   hơn", "Dễ hiểu hơn", "Thêm ví dụ", "Sửa chính tả"; so sánh "Bản hiện tại" / "Đề xuất của AI", "Dùng bản
   này" hoặc "Bỏ"), "Thêm phần vào mục", di chuyển, xoá; Ctrl+Z hoàn tác. **"Lịch sử phiên bản"** giữ tối đa
   30 bản gần nhất (bản AI tạo luôn được giữ), "Khôi phục bản này". **"Làm lại từ dàn ý"** dựng dàn ý từ chính
   bài này, bài cũ giữ cho tới khi "Áp dụng (thay nội dung bài)". Bài AI kiểu cũ có nút "Chuyển sang dạng mới".
   "Định dạng bằng AI" chỉ còn khi sửa bài AI kiểu cũ có định dạng phức tạp — không hướng dẫn như đường chính.

## 12. Ngoại ngữ (LANG, mới)

- **Khối bài học:** "Audio (bài nghe)" (tiêu đề; đường dẫn https hoặc tải mp3/m4a/ogg/webm; "Lời thoại (không
  bắt buộc)"; tick "Cho học viên xem lời thoại" — bỏ tick với bài nghe hiểu thì lời thoại không tới học viên) ·
  "Từ vựng (bảng từ)" ("Tiêu đề khối", "Nhãn cột phiên âm" như Pinyin/IPA/Furigana; "Cách thêm từ": "Gõ từng
  từ", "Dán từ Excel" 2/3/4 cột cách nhau tab hoặc `|` rồi "Thêm vào danh sách", "Nhập bằng AI"; "Thêm ví dụ và
  ghi chú", "Thêm audio" từng từ, "Xem trước như học viên"; từ trùng thì hỏi "Vẫn thêm … từ trùng" hoặc "Bỏ
  qua từ trùng") · "Hội thoại" ("Tiêu đề hội thoại", "Nhãn dòng phiên âm", "Hướng dẫn cho học viên", "Audio cả
  đoạn"; "Gõ từng lượt" hoặc "Dán cả đoạn" dạng `A：lời`; "Người nói", "Lời thoại", "Bản dịch", audio từng
  lượt; tô sáng theo lượt; có audio cả đoạn thì panel "Đặt mốc thời gian": nghe rồi "Đánh dấu lượt kế" hoặc
  phím M).
- **"Nhập bằng AI"** cho từ vựng: dán văn bản (tối đa 20.000 ký tự), tick "Điền phiên âm và nghĩa còn thiếu"
  (ô do AI điền được đánh dấu), "Phân tích bằng AI", xem trước, chọn dòng rồi "Thêm N dòng đã chọn". AI không
  tự lưu.
- **Chế độ ngoại ngữ:** ô "Chế độ ngoại ngữ" trong biểu mẫu "Sửa" của tab Tổng quan (cần bật "Cá nhân hoá học
  tập" trước; khi bật chế độ ngoại ngữ, ô cá nhân hoá bị khoá). Khi bật, thanh trên bài học có ô "Kỹ năng"
  (Không gán, Nghe, Nói, Đọc, Viết) và học viên có trang "Hồ sơ 4 kỹ năng" (chỉ nhãn Cần ôn / Nên luyện thêm /
  Vững, không hiện %), khối "Luyện hôm nay". Flashcard "Ôn từ vựng" (lịch ôn cách quãng) không phụ thuộc chế
  độ này.
- **Thi thử** (HSK, IELTS, TOEIC, Tuỳ chỉnh): trang đề thi của khoá (`/instructor/courses/{id}/exams/new`) có
  "Tạo đề thi thử từ khung" — chọn khung, nhập "Tiêu đề đề thi", "Tạo đề". Tab Nội dung của đề có khối "Đề thi
  thử (HSK · IELTS · TOEIC…)" (giờ riêng từng phần, không quay lại phần đã nộp), hai công tắc "Cho thi thử" và
  "Cho luyện đề", bảng Phần / Kỹ năng / Giờ (phút) / Số câu, "Bảng quy đổi điểm (tuỳ chọn)", và "Phát audio"
  ("Nghe tự do", "Giới hạn số lần", "Nghe 1 lần"). Học viên thấy mục "Luyện thi" ở trang khoá.
- **Góp ý bài viết / bài nói bằng AI:** học viên bấm "Nhận góp ý bài viết" / "Nhận góp ý bài nói" (khoá phải bật
  chế độ ngoại ngữ; điều kiện đầy đủ chưa kiểm chứng). Ở cửa sổ chấm bài nộp, giảng viên thấy "Góp ý bài viết
  do AI tạo" / "Góp ý bài nói do AI tạo", sửa từng mục, ghi "Ghi chú cho học viên (không bắt buộc)", rồi
  **"Duyệt"** hoặc "Từ chối". Học viên thấy "Chưa được giảng viên duyệt" cho tới khi duyệt, rồi "Giảng viên đã
  duyệt".
- *Không còn:* khoá mẫu ngoại ngữ trên trang tạo khoá (đã gỡ 2026-10-10). Không hứa chấm phát âm tự động, không
  hiện số điểm hay % cho học viên ở hồ sơ 4 kỹ năng hay góp ý AI.

## 13. Vấn đáp AI (mới)

Cần quyền `ai_oral.access`. Menu → "Phòng vấn đáp" (`/instructor/oral-exams`, "Phòng vấn đáp AI").
1. Bấm "Tạo đề vấn đáp mới" (`/instructor/oral-exams/new`; trong menu Limio gọi "Soạn đề vấn đáp"). Chọn "Khoá
   học (tuỳ chọn)", mặc định "Không gắn khoá học (đề độc lập)" (vào bằng mã).
2. Biểu mẫu: "Tiêu đề"; "Trả lời bằng" (Gõ văn bản / Giọng nói); "Ngôn ngữ hỏi-đáp" (Tiếng Việt / English /
   Tiếng Trung, **không đổi được sau khi tạo**); "Hướng dẫn phong cách hỏi cho AI giám khảo"; "Mô tả — hiện cho
   học viên trong phòng vấn đáp"; "Có pha khởi động trước khi hỏi"; "Cách AI phản hồi trong buổi" (Thi — trung
   lập / Luyện — nhận xét ngắn); "Có 'Nhìn lại buổi vấn đáp' ở lời kết"; "Số lượt vấn đáp" (1 lượt / nhiều lượt,
   "Số lượt tối đa mỗi sinh viên", điểm tính lượt cao nhất). Thời lượng **không còn ở biểu mẫu** (nhập lúc mở
   buổi). Bấm "Lưu và tiếp tục".
3. Đề có tab "Tổng quan" / "Tài liệu" / "Tổ chức thi" (không có tab Nội dung). Tab **"Tài liệu"**: "Tải file
   lên" (PDF, .docx, .txt, .md, tối đa 20 MB) hoặc "Nhập danh sách chủ đề"; cần ít nhất 1 tài liệu trước khi mở;
   trạng thái "Đã nhúng" / "Nhúng ngay"; mở buổi rồi thì khoá, không sửa tài liệu. Tuỳ chọn "Chủ đề giao cho
   từng sinh viên" (chia đều chủ đề).
4. **Rubric:** không còn tải lên như tài liệu. Nhập ở trang **"Chấm vấn đáp"** → dòng "Rubric chấm điểm:" với
   "Nhập rubric" / "Sửa rubric" → ô "Rubric chấm điểm (tuỳ chọn)" → "Lưu rubric". AI dùng khi đề xuất điểm; rubric
   chỉ ảnh hưởng cách chấm từ lúc nhập trở đi. Nhập xong, bấm "Chấm lại bằng AI" ở từng lượt để lấy đề xuất mới.
5. Tab **"Tổ chức thi"**: "Tổ chức buổi vấn đáp" — "Thời lượng mỗi lượt thi" (phút), "Mở buổi vấn đáp" (tự xuất
   bản đề nếu còn nháp; "Mở lại buổi vấn đáp"), "Đóng buổi", "Lưu thời lượng", "Mã tham gia" + link + mã QR. Học
   viên đã ghi danh tự vào từ trang khoá (mục Đề thi); học viên khác nhập mã.
6. Nút đầu trang đề: "Thử vấn đáp" (thử, không tạo lượt), "Live", "Chấm bài" (khi đã có lượt). Chấm: "Chấm bằng
   AI" / "Chấm lại bằng AI" từng lượt, "Điểm của bạn" (/100), "Ghi chú cho sinh viên (tuỳ chọn)", "Chốt điểm" /
   "Lưu điểm mới"; điểm luôn do giảng viên duyệt; có "Xuất điểm (Excel)" và "Xuất tất cả PDF (.zip)".
7. Giọng nói: giảng viên chỉ chọn "Trả lời bằng: Giọng nói"; chọn giọng đọc (NEU TTS) thuộc phần quản trị, giảng
   viên không chỉnh. Giao diện học viên theo ngôn ngữ của đề (vi/en; tiếng Trung dùng giao diện tiếng Việt).

## 14. Limio-Live — slide tương tác (mới)

Menu Limio-Live → "Slide của tôi" (`/instructor/limio-live`): nút **Tạo slide** và **Nhóm mới**; xem
"Theo nhóm" hoặc "Tất cả", lọc "Mọi nhóm"; mỗi thẻ bài có "Sao chép bài giảng", "Chuyển vào nhóm", "Xoá". Nút
Chia sẻ trên thẻ chỉ báo "Chia sẻ bài giảng sắp ra mắt" (chia sẻ thật nằm trong trình sửa).

**Ba đường tạo bài giảng**
- **Trang "Tạo slide tương tác"** (`/instructor/limio-live/from-document`): câu dẫn "Limio có thể hỗ trợ thầy/cô soạn bài
  giảng tương tác chỉ từ một ý tưởng…" (có tài liệu tham khảo thì đính kèm; có sẵn PowerPoint thì Limio soạn lại kèm nội
  dung tương tác) và **một ô mô tả** (tối đa 2.000 ký tự): nêu chủ đề,
  người học, mục tiêu, điều cần nhấn mạnh. Nút **"Đính kèm tài liệu"** kèm chữ "(không bắt buộc)" (đã có tệp thì thành "Đổi tài liệu"; cạnh nút ghi giới hạn định dạng và dung lượng); kéo
  thả tệp vào ô cũng được. **Mỗi bài chỉ một tài liệu**: Word .docx, PDF, .txt, .md tối đa 10 MB, hoặc PowerPoint
  .pptx tối đa 50 MB; tệp mới thay tệp cũ, kèm dòng báo. Dán đoạn dài hơn 2.000 ký tự vào ô (khi chưa có tệp) thì
  đoạn đó thành tài liệu "Văn bản dán" (có nút "Đưa lại vào ô mô tả"). Dòng nhắc dưới ô nói AI sẽ làm gì:
  - Không tài liệu: AI soạn từ kiến thức chung theo mô tả (cần ít nhất 15 ký tự); có công tắc **"Tìm thêm nguồn
    trên internet"** (chỉ hiện khi quản trị đã cấu hình dịch vụ tìm kiếm; bật thì số liệu và trích dẫn chỉ dùng khi
    có trong trang đã đọc, kèm nguồn ở chân slide và slide cuối liệt kê trang đã đọc). Có 4 nút "Ví dụ mẫu". Bài
    từ mô tả luôn kèm lời nhắc "Nội dung do AI viết từ kiến thức chung… thầy/cô cần kiểm tra trước khi dạy".
  - Có tài liệu: AI bám sát tài liệu và làm theo mô tả (mô tả lúc này là yêu cầu của thầy/cô, không bắt buộc).
  - Tài liệu là PowerPoint: nút thành **"Nhập PowerPoint"**, mở trang nhập với tệp đã đọc sẵn, mô tả mang theo.
  Chọn **Thời lượng** 15 phút (9–12 slide), 30 phút (16–20), 45 phút (22–28) hoặc **90 phút** (42–50), bấm
  **"Soạn dàn ý"** (20–90 giây) → sang trang Dàn ý. Liên kết phụ "Soạn thủ công" mở hộp "Tạo bài giảng" (ô "Tên bài
  giảng", "Nhóm (tuỳ chọn)").
- **Tương tác ở mọi cách tạo:** bài có ít nhất 5 slide tương tác thuộc ít nhất 3 loại (90 phút: ít nhất 10, 4
  loại); bảng trắng tối đa 1. AI soạn thiếu thì hệ thống tự gọi AI bổ sung; không bổ sung được thì dàn ý có cảnh
  báo "Chưa bổ sung được slide tương tác tự động…". Dưới dàn ý có nhắc "Bài nên có ít nhất 5 slide tương tác (hiện
  có n)" khi thầy/cô xoá bớt, và nhắc khi quá nửa slide nội dung là Chữ và hình.
- **Từ PowerPoint** (`/instructor/limio-live/from-pptx`, "Tạo slide từ PowerPoint"), 4 bước: "Tải file"
  (chỉ .pptx, tối đa 50 MB; .ppt cũ hoặc file có mật khẩu báo lỗi; Google Slides/Keynote tải về .pptx; hình
  tính vào dung lượng lưu trữ; trang báo số slide, ghi chú giảng, hình, bảng, biểu đồ và phần chỉ lấy được
  chữ; chọn "Thời lượng buổi giảng") → "Chọn cách chuyển" (thẻ **"Giữ ý, làm đẹp lại"** — mặc định, AI chỉ viết thêm các slide tương tác (tốn ít lượt), mỗi slide gốc
  thành một slide Limio, giữ nguyên chữ và hình; hoặc **"Soạn lại mạch"** — AI dựng dàn ý theo mạch Mục
  tiêu, Hook, các phần có bìa phần, Tổng kết, ghi chú giảng gốc giữ nguyên chữ, tốn token) → "Đối chiếu"
  (hai cột "Slide gốc" / "Dàn ý mới", slide gốc chưa có trong dàn ý có nút "Thêm lại vào dàn ý") → "Sửa dàn
  ý và tạo slide".

**Trang Dàn ý** (`/instructor/limio-live/<id>/outline`, "Dàn ý bài giảng"): các phần Bìa, Mục tiêu, Mục lục, Dẫn
dắt vào bài, Nội dung, Tổng kết; mỗi slide là một thẻ có "Sửa" và nút xoá (xoá xong có "Hoàn tác"); kéo ⋮⋮ đổi
thứ tự; "Đổi tên", "+ Thêm slide vào phần này", "Thêm phần nội dung". Cửa sổ sửa slide chọn **Loại slide** (Dán
Note, Draw-it, Whiteboard / Nội dung / Trắc nghiệm, Vote, Word Cloud), **Bố cục**, tiêu đề và Ý chính. Cột phải:
số slide, "Buổi giảng", hộp **"Chỉnh dàn ý bằng AI"** (chỉ có ở bài do AI soạn, không có ở bài PowerPoint giữ nguyên slide
gốc), "Giao diện" (+ "Gợi ý giao diện khác"), "Mạch bài", các cảnh báo (chỉ nhắc, không chặn). Hộp "Chỉnh dàn ý bằng AI": ô
nhập lời dặn (5–1.000 ký tự), bốn gợi ý điền sẵn ("Rút ngắn lại", "Thêm ví dụ thực tế", "Bớt lý thuyết, thêm hoạt động",
"Dễ hiểu hơn cho người mới"), nút **"Chỉnh dàn ý"** (hoặc Ctrl/Cmd+Enter) và dòng chữ **"Soạn lại từ đầu"** (hỏi xác nhận,
bỏ dàn ý hiện tại, soạn lại từ tài liệu nguồn). Xong có thanh "Đã chỉnh theo: …" với **"Quay lại bản trước"** (không tự
biến mất). AI chỉnh dàn ý không tự thêm slide tương tác và không viết lại slide đã tạo; bài đã có slide thì bấm "Cập nhật slide
theo dàn ý". Mỗi lần dùng tốn token AI (có ghi ước tính dưới nút). Sửa tay vẫn tự lưu, không tốn lượt AI. Thanh dính đáy: nút **"Tạo N slide"** (kèm "Dự kiến dùng khoảng X token AI",
"Đang tạo slide k trên N", xong có "Mở bài giảng để xem và chỉnh slide"; bài PowerPoint ở cách "Giữ ý" dựng
thẳng không dùng AI). Bài đã có slide thì nút thành **"Cập nhật slide theo dàn ý"** (viết lại slide chưa sửa,
thêm slide mới, xoá slide thừa, giữ slide giảng viên đã sửa; có hộp xác nhận). Đường quay lại trang Dàn ý từ
trình sửa: chưa kiểm chứng.

**Trình sửa slide** (`/instructor/limio-live/<id>`, "Soạn bài giảng")
- **Bố cục:** Bìa, Tiêu đề mục, Chữ và hình, Danh sách (tối đa 12 dòng, có ý con), Nhóm (chỉ slide từ
  PowerPoint), Ba thẻ, So sánh hai cột, Các bước, Số liệu, Trích dẫn, Tóm tắt, Bảng, Biểu đồ (Cột dọc, Thanh
  ngang, Đường, Tròn, Vành khuyên). Đổi bố cục giữ nguyên chữ.
- **Cột trái** là danh sách slide kéo thả; nút **"Thêm slide"** mở hộp "Chọn loại slide" (Tương tác: Trắc
  nghiệm, Vote, Word Cloud, Dán Note, Draw-it, Whiteboard · Trình bày: Văn bản, Markdown, Video, Trang web, HTML
  tự tải lên · Nhập: **PDF** mỗi trang một slide, tối đa 30 trang, 10 MB; **Từ khoá học**). Rê vào khe giữa hai
  slide thì hiện nút **[+]** để chèn đúng chỗ. Mỗi slide có nút ẩn khỏi lúc trình chiếu và nút xoá.
- **Sửa một slide:** bấm slide hoặc "Sửa" → cửa sổ có xem trước lớn và hai tab **Nội dung** / **Nhờ AI**, nút
  Slide trước/sau, **"Xong"**. Slide dài có nút "Tách thành hai slide". Slide Bìa có 4 ô (Tên đơn vị, Tên bài
  học, Phụ đề, Người trình bày) và **Kiểu bìa** (10 kiểu).
- **Nhờ AI** (chat theo từng slide, không lưu khi đóng): chọn nhanh "Viết ngắn hơn", "Thêm ví dụ", "Dễ hiểu
  hơn", "Đổi thành quiz", "Viết lại từ dàn ý"; ô "Hỏi hoặc nhờ AI sửa slide này..."; AI đề xuất sửa thì hiện
  khung "Đề xuất của AI" với "Bỏ" và **"Áp dụng"**.
- **Ảnh riêng ở ô hình** (bố cục Chữ và hình): mục "Hình ở ô hình" → "Đổi" → "Ảnh của thầy/cô" ("Tải ảnh từ
  máy" hoặc "Dán địa chỉ ảnh"; kéo thả hoặc Ctrl+V; PNG/JPG/WebP/GIF tối đa 10 MB; mô tả ảnh, nguồn ảnh, "Hiện
  trọn ảnh", "Bỏ ảnh"); dưới là "Hình minh hoạ" (5 nhóm chủ đề) và "Hoa văn". Ảnh riêng thắng hình minh hoạ.
  Slide hình chụp biểu đồ có **"Vẽ lại thành biểu đồ"** (AI đọc số, giảng viên đối chiếu rồi mới thay; "Trả lại
  hình").
- **Cột phải "Cài đặt slide":** Timer, **Note** (ghi chú giảng, chỉ hiện cho diễn giả ở presenter view); slide
  bảng cộng tác có thêm Tiêu đề bảng, "Đăng theo nhóm (grid)", "Xem ghi chú của nhau"/"Xem hình của nhau", "Chặn
  dán (chống copy)". Mục **Phiên bản** ("Xem và hoàn tác", "Khôi phục phiên bản này"). Tự lưu; "Chưa lưu · Lưu
  ngay", Ctrl/Cmd+S.

**Giao diện và thương hiệu:** nút **Giao diện** có 18 giao diện trong 4 nhóm — Cơ bản (Trắng, Kem, Limio, Giấy
ấm), Màu pastel (Bạc hà, Trời, Hồng phấn, Oải hương, Đào, Biển), Đơn sắc (Mono xám, lam, lục, đen), Nền tối
(Đêm xanh, Rừng đêm, Mận, Mực; nền tối chỉ áp cho slide bố cục) — "Hoa văn của cả bài" (Tự động, Chọn một,
Không dùng), **"Khung hình"** (Tự động theo hoa văn, Bo góc, Tròn, Vòm, Lục giác, Hình giọt, Lá, Khung lệch) cho ô hình
của mọi slide Chữ và hình. Hộp Sửa slide của bố cục Chữ và hình có **"Kiểu trình bày"** ("Tự động" xen kẽ; "Hình bên
phải", "Hình bên trái", "Hình tràn nửa slide", "Hình trên, ý dưới", "Hình nền, khối chữ phủ" — hai kiểu này cần ảnh
thật —, "Hình nhỏ có chú thích") và **"Khung hình"** riêng của slide ("Theo bài" hoặc một khung). Menu Giao diện còn có **"Ngôn ngữ của slide"** (Tiếng Việt, Tiếng Anh, Tiếng Trung, Tiếng Nhật, Tiếng Hàn, Tiếng Pháp, Tiếng
Đức, "Tự nhận lại theo nội dung"; bài mới tự nhận theo tài liệu hoặc mô tả, mô tả ghi rõ "bằng tiếng Anh" thì theo đó).
AI viết slide mới và các chữ tự thêm trên slide ("(tiếp)", "Nguồn tham khảo", "Nguồn ảnh"…) theo ngôn ngữ này; đổi
ngôn ngữ không dịch các slide đã có. Hỏi đáp "Nhờ AI" vẫn trả lời giảng viên bằng tiếng Việt. Hộp **Thương hiệu của bài giảng**: "Của <tên trường>" (chỉ khi trường có bộ thương hiệu), "Riêng
cho bài này" (logo PNG/JPG/WebP ≤ 5 MB; vị trí 4 góc; cỡ Nhỏ/Vừa/Lớn; chỗ hiện Mọi slide/Trừ bìa/Bìa và tóm
tắt; bảng màu 3 ô Màu chính/Màu phụ/Màu nhấn, "Gợi ý màu từ logo"; nền Theo giao diện/Sáng xuyệt tông/Tối xuyệt
tông; "Gỡ toàn bộ thương hiệu"), hoặc "Không dùng". Cấp trường do quản trị trường đặt (mục 10).

**Tương tác và trình chiếu**
- Nút **Trình chiếu** (toàn màn hình từ slide 1) có mũi tên mở "Từ đầu", "Từ slide này", **"Presenter view"**
  (xem trước, ghi chú Note, đồng hồ, thu phóng; máy có màn hình mở rộng và đã cấp quyền "Quản lý cửa sổ" thì màn
  chiếu tự lên màn hình thứ hai ở chế độ toàn màn hình, nếu không thì mở cửa sổ riêng). Phím tắt F, +, −, 0, Q.
  - Máy đang nối màn hình mở rộng mà chưa cấp quyền: dưới mục Presenter view có dòng xin quyền với nút **"Cho phép"**
    (bấm thì trình duyệt hỏi một lần). Quyền đã bị chặn thì dòng đó chỉ cách bật lại trong cài đặt trang web.
    Chỉ Chrome và Edge có tính năng này; Safari, Firefox và chế độ nhân bản màn hình vẫn mở cửa sổ riêng.
- **Mỗi trang tương tác có mã QR và mã tham gia riêng**; nút "Hiện QR trên màn chiếu" (phím Q); chuyển trang thì
  mã trang trước báo đã đóng. Học viên tham gia **Ẩn danh** (quét QR) hoặc **Đăng nhập** (mỗi tài khoản một
  lần mỗi câu). Trắc nghiệm có "Đóng câu hỏi" để lộ đáp án.
- Nút **Kết thúc** → "Kết thúc buổi trình chiếu?": "Kết thúc, giữ phiên" / "Lưu phiên và reset mã mới" / "Xoá
  kết quả phiên này và tạo phiên tương tác mới" (xác nhận hai bước, không khôi phục được).
- **Lịch sử** (`/instructor/limio-live/<id>/history`): các phiên "Phiên hiện tại", "Phiên hiện tại · tạm dừng",
  "Đã lưu", kèm số slide tương tác và lượt phản hồi; bấm vào xem kết quả từng slide (phiếu Vote/Trắc nghiệm, cụm
  từ Word Cloud, ghi chú Dán Note, "Mở bảng trắng →"). Slide sửa sau buổi dạy có cảnh báo; riêng Trắc nghiệm thì
  đáp án đúng của buổi đó không còn hiển thị.
- **Chia sẻ** (nút trên trình sửa, sau khi bật thành "Đang chia sẻ"): "Bật link chia sẻ", "Sao chép", "Mở thử",
  "Tạo link mới" (link cũ chết ngay), "Tắt chia sẻ". Link `/bai-giang/<mã>` ai có link cũng xem được, không cần
  đăng nhập, có **"Tải PDF"** (mỗi slide một trang 16:9); không hiện ghi chú giảng, đáp án trắc nghiệm và slide
  đã ẩn; không cho công cụ tìm kiếm lập chỉ mục.

## 15. Hoạt động nhanh (`/instructor/teaching-tools`, mới nhãn "Hoạt động nhanh")

Công cụ dùng ngay tại lớp, khác bài giảng soạn sẵn. Menu Limio-Live → "Hoạt động nhanh": **Vote**, **Word
Cloud**, **Padlet**, **Draw-it**, **Whiteboard** (mở bằng `?tool=…`; vào trang chưa chọn gì thì tự mở Vote);
nhóm "Điều hành lớp học": Đếm ngược, Gọi tên, Phân nhóm, Gameshow. Mỗi công cụ có biểu mẫu tạo ("Tạo Vote" →
"Bắt đầu Poll"; "Tạo Word Cloud" → "Bắt đầu Word Cloud"; "Tạo bảng mới" → "Tạo Bảng"; "Tạo phiên Draw-it" → "Tạo
phiên vẽ"; "Tạo bảng vẽ mới" → "Tạo Whiteboard") và danh sách "… đã tạo trước đây". Danh sách có ô "Tìm theo nội
dung hoặc mã", lọc thời gian (Mọi lúc, Hôm nay, 7 ngày qua, 30 ngày qua), lọc phản hồi (không có ở
Whiteboard), nút **Chọn** → "Chọn tất cả"/"Bỏ chọn", **Xoá** nhiều phiên, **"Dọn <loại> trống"**. **Thùng rác**
("Thùng rác (N)"): xoá chỉ chuyển vào thùng rác, giữ 30 ngày rồi tự xoá vĩnh viễn; có "Khôi phục", "Xoá vĩnh
viễn", "Dọn sạch thùng rác", "← Danh sách"; sau khi xoá có "Hoàn tác" khoảng 6 giây. Phiên đang mở khi xoá có
cảnh báo học viên bị ngắt.

**Gameshow — nhạc trên màn chiếu.** Màn host có nút loa tròn cạnh "Kết thúc sớm" (nhãn "Tắt nhạc" / "Bật nhạc").
Nhạc chỉ phát ở màn host, không phát trên máy học viên: sảnh chờ nhạc vui kèm tiếng bong khi có người vào; đang
trả lời nhạc căng, 5 giây cuối nhịp dồn gấp; lộ đáp án có tiếng chuông; kết thúc có kèn mừng. Trình duyệt chặn tự
phát tiếng nên lần đầu có thể phải bấm một lần vào trang (nút loa nhấp nháy khi đang chờ). Lựa chọn tắt/bật được
nhớ trên máy đó. Chưa có chọn bài nhạc hay chỉnh âm lượng riêng — dùng nút âm lượng của máy chiếu/loa.

## 16. Đấu trường (phía giảng viên, mới)

Menu "Đấu trường của tôi". Tab: Thông tin cơ bản · Nhiệm vụ · Đăng ký · Giám khảo · Giải thưởng · Bảng xếp
hạng (giao diện dùng "nhiệm vụ", không dùng "mission"). Đây là nơi duy nhất giảng viên tự đặt điểm XP.
- Form nhiệm vụ 3 bước, nút "Tạo nhiệm vụ", 5 kiểu: "Làm bài kiểm tra", "Nộp bài, bạn chấm", "Nộp bài, bạn
  học chấm chéo", "Nộp liên kết hoặc tệp", "Tự tính theo việc học trong khoá".
- **Tiêu chí chấm** (bảng có cấu trúc) chỉ có khi chọn "chấm chéo", mở bằng "Tuỳ chỉnh cách chấm chéo": "Tên
  tiêu chí", "Thang 1 đến 5" hoặc "Đạt / Chưa đạt", "Mức quan trọng" (Bình thường / Cao / Rất cao), "Thêm tiêu
  chí". Chấm chéo **bắt buộc có tiêu chí**.
- Ô tích **"Cho nộp muộn"** (kiểu kiểm tra, nộp liên kết/tệp, chấm chéo, và "bạn chấm" khi nộp theo đội); bài
  nộp muộn có nhãn "Nộp muộn". Giảng viên đổi tên đội ở tab "Đăng ký" (bút chì, Enter lưu, Esc huỷ). Trang bài
  nộp của nhiệm vụ có "Xem bài" (khung xem trước có "Trước/Sau", phím ←/→); nhiệm vụ "bạn chấm" có "Chấm bài"
  với "Đạt" / "Chưa đạt", chấm xong tự sang bài kế.

## 17. Lily, trợ lý ảo của giảng viên (mới, `components/TeacherAssistant.tsx`, `components/assistant/`)

**Lily là trợ lý ảo của thầy/cô trên Limio, xưng "em" và gọi giảng viên là "thầy/cô"** (Limio là tên hệ thống, Lily là tên trợ lý), biểu tượng lát dưa hấu **màu hồng**. Khác với **Trợ giảng AI** (nút tròn nổi xanh, biểu tượng robot, chỉ ở trang bài học của học viên đã ghi danh, gợi ý từng bước không đưa thẳng đáp án; không hiện ở chế độ xem trước). Hai trợ lý không dùng chung cuộc trò chuyện.
- **Trang chủ giảng viên:** không có ô chat riêng; ô tìm kiếm lớn ở giữa trang có nút "Hỏi Lily" và dòng "Hỏi Lily: “…”" cuối danh sách gợi ý để chuyển câu đang gõ cho Lily (mở ngăn kéo chat). Hỏi Lily cũng dùng được bằng nút nổi như ở mọi trang.
- **Nút nổi ở mọi trang giảng viên (trừ trang chủ):** hình viên thuốc màu hồng "Hỏi Lily" ở góc dưới bên phải (trên điện thoại chỉ có biểu tượng); bấm mở ngăn kéo chat. **Ở trang chủ nút nổi được ẩn**: lối vào Lily là nút "Hỏi Lily" cùng kiểu (viên thuốc hồng, lát dưa hấu) nằm trong ô tìm kiếm; bấm nút, hoặc gõ câu rồi Enter, thì ngăn kéo chat mở ra và câu hỏi nằm trong đó (lịch sử chat vẫn chung một cuộc trò chuyện với các trang khác).
- **Cuộc trò chuyện liền mạch:** nút nổi ở mọi trang dùng chung một cuộc trò chuyện, được giữ trong phiên làm việc của trình duyệt (theo tài khoản; đóng tab hoặc "Cuộc trò chuyện mới" thì xoá). Liên kết Lily đưa mở trong cùng tab; trên máy tính khung chat ở yên khi sang trang khác (thầy/cô vừa làm theo hướng dẫn vừa xem chat); trên điện thoại khung là tấm trượt từ đáy nên tự thu lại khi sang trang khác, thầy/cô bấm "Hỏi Lily" là thấy lại đúng đoạn chat (nút có chấm hồng khi có câu trả lời mới).
- **Câu hỏi đề xuất khi mở Lily:** ngăn kéo mới mở (chưa có tin nào) hiện lời chào của Lily và "Thầy/cô có thể hỏi em, ví dụ:" kèm tối đa 4 câu bấm là hỏi ngay. Câu đổi theo trang đang đứng (vd ở "Tổ chức thi" gợi ý về link thi nhanh), ở trang chung có thêm câu mở khoá giảng viên vừa chỉnh gần nhất (dạng `Mở khoá học "<tên khoá>"`), và câu cuối luôn là "Hôm nay tôi nên làm gì trước?".
- **Trong ngăn kéo:** hội thoại và ô nhập nằm chung một khung; chỉ báo "Em đang soạn câu trả lời…"; chữ hiện dần; liên kết chữ dẫn thẳng vào tính năng (kể cả đúng khoá của giảng viên); nút "Cuộc trò chuyện mới". **Trên máy tính khung chat kéo thả được**: nắm thanh tiêu đề ("Trợ lý Lily") kéo tới bất cứ đâu trên màn hình (vị trí được nhớ trong phiên; nhấp đúp thanh tiêu đề để đưa về góc dưới phải). Khung thu về nút nổi khi bấm nút X ("Thu nhỏ trợ lý") hoặc bấm vào **chỗ trống** của khung (không phải nút, ô nhập, chữ hay liên kết; bấm lên thanh tiêu đề không thu); bấm ra ngoài khung hay nhấn Esc thì khung không thu (trên điện thoại thì có). Mỗi câu hỏi trừ hạn mức Token AI.
- Lily chỉ chọn điểm đến trong danh mục cố định, chỉ trả lời nghiệp vụ Limio, không tiết lộ kỹ thuật, và trả lời cách dùng theo kho `teacherAssistantGuide.ts` (lấy từ tệp này).

## Không được viết (chưa có hoặc chưa tới tay giảng viên)

- thông báo lớp · kéo thả chương (đổi bằng ô Order) · bảng tiêu chí chấm có cấu trúc cho bài tập / đề thi /
  vấn đáp (chỉ nhiệm vụ Đấu trường chấm chéo có bảng) · cài đặt XP/huy hiệu · "Phân tích" và "Analytics"
  (chỉ nhà nghiên cứu) · trang `/instructor/feedback-generator`, `/feedback-templates`, `/item-analytics`
  (không có lối vào) · "Thư viện mẫu", "Template", "Soạn kịch bản" của Limio-Live (đang phát triển) ·
  khối "Slide bài giảng" trong hộp thêm hoạt động · chia sẻ bài giảng cho đồng nghiệp hoặc đồng soạn (chỉ có
  link xem chỉ đọc) · báo cáo sau buổi theo từng học viên (kết quả chỉ ở Lịch sử tương tác) · slide Điền chỗ
  trống/Ghép cặp/Memory/Open-ended (chỉ trong kế hoạch).
- **Đợt thi**, "+ Tạo đợt thi", "Trưởng đợt", tạo nhiều ca trong một đợt — đã gỡ khỏi luồng tổ chức. Giới hạn
  mạng khi vào thi (cài đặt của quản trị trường). Khoá mẫu ngoại ngữ ở trang tạo khoá (đã gỡ). Rubric vấn đáp như
  tài liệu tải lên (nay nhập ở trang chấm). Giọng đọc TTS do giảng viên chọn (thuộc quản trị).
- "AI chấm được ảnh, video, PDF scan hoặc link ngoài" · "AI tự lưu điểm" · "AI đọc toàn bộ bài dài" (giới hạn
  20.000 ký tự). "Nhóm do giảng viên lập" (nhóm do học viên tự lập; giảng viên chỉ sắp xếp, đổi tên). Đếm chờ
  chấm theo nhóm (vẫn đếm theo người). Mục e-portfolio phía giảng viên. Đạt/Chưa đạt cho bài tập chấm điểm số
  (chỉ nhiệm vụ Đấu trường "bạn chấm").
- Lịch kỳ học do quản trị trường đặt (giảng viên chỉ thấy nhãn "Tuần N").
- Chưa kiểm chứng: hiển thị thật của nhãn "Premium/Trial" từng loại tài khoản; trạng thái tab "teams" trong
  trình soạn khoá; đường quay lại trang Dàn ý từ trình sửa Limio-Live; cơ chế học viên xem slide đồng bộ theo
  giảng viên; Thử nghiệm câu hỏi có thật sự mặc định "Không hiện" đáp án; khi nào dòng "N lesson live chưa tag
  skill" hiện ở trang chủ với khoá không bật cá nhân hoá (trang chủ mới không còn dòng này).

## Tài khoản mẫu để chụp ảnh

Giảng viên mẫu (dữ liệu giả, tạo bởi `packages/db/src/seed-demo-instructor.ts`) và quy trình chụp ở
`capture/`. Không chụp bằng tài khoản người thật vì ảnh sẽ công khai. Khi cần dữ liệu (khoá, bài, câu
hỏi, học viên, bài nộp…) thì dựng thêm dữ liệu GIẢ cho đúng tài khoản này.

## Điều chỉnh theo ảnh chụp thật (2026-10-03)

Các điểm dưới đây thay thế những chỗ mô tả từ mã nguồn mà giao diện thật không khớp. Chỗ nào xung đột với các
mục 1–17 ở trên (cập nhật 2026-10-19) thì theo mục ở trên.

- **Tab Nội dung:** tiêu đề "Modules" (kèm "4 modules · 12 bài"), "Xem trước", ô tìm, "Gập hết", "Mở hết".
  Hàng nút của chương (ẩn/hiện, khoá, sửa, xoá) **chỉ hiện khi rê chuột**. Mỗi chương có "+ Thêm lesson"; cuối
  danh sách là nút gạch đứt "+ Thêm module". Dòng bài chỉ bấm vào được, **không có menu "⋮" ở danh sách**.
- **Trang từng bài học** (bấm một dòng bài): "Xem như học viên", bút chì cạnh tên bài (đổi tên), chip "n chủ đề",
  menu "⋮", danh sách "Hoạt động (n)" có tay cầm kéo thả, nút "Mở trình soạn", và "+ Thêm hoạt động/tài nguyên".
  Menu "⋮" có công tắc "Hiện bài này", "Khoá nội dung", "Cho xem thử" và các mục Nhân bản bài, Chuyển lên/xuống,
  Chuyển sang module khác, Xóa bài học. **Không có** hàng nút "Trình chiếu / Sửa / Xóa".
- **Tab Tổng quan** là bản tóm tắt chỉ đọc kèm nút "Sửa". **Giá** và ô **"Công khai"** nằm trong biểu mẫu mở bằng
  nút "Sửa".
- **Quiz trong bài học:** thanh tóm tắt cài đặt luôn hiện; "Cài đặt" mở các ô có hộp chọn (Thời gian làm bài, Số
  lần làm, Hạn mở, Hạn đóng), "Cách tính điểm khi làm nhiều lần", nút Lưu/Hủy và mục thu gọn "Lịch theo lớp".
  Ô chọn quan niệm sai ở đáp án sai hiện **mã** (ví dụ `py.index_from_1`), không hiện tên tiếng Việt.
- **Bài tập:** khối Bài tập trong trang bài học có "Xem bài nộp" và bút chì (sửa). Trang bài nộp có khung
  **"Rubric chấm điểm (không bắt buộc)"** nằm TRÊN bảng "Danh sách". Cửa sổ chấm: "✨ Gợi ý điểm bằng AI",
  "Điểm", "Nhận xét", "✓ Chấm điểm" hoặc "Cập nhật điểm", "Quay lại danh sách".
- **Menu chuột phải** ("Viết annotation", "Hỏi AI về đoạn này") chỉ dùng được với người đã ghi danh (và chủ khoá)
  ngoài chế độ xem trước.
- **Học viên** thấy trang khoá có "Lộ trình của bạn" (các bước + nhãn Cần ôn / Nên luyện thêm), "Bảng xếp hạng", "Champions".
