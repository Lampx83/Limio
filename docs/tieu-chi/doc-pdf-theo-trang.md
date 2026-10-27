# Đo đọc PDF theo từng trang — tiêu chí chấp nhận

> Bản nháp 27/10/2026. Mở rộng B11 (`LessonEngagement`, `lesson.engaged`): hôm nay một bài chỉ có PDF nhiều trang và quiz
> chỉ cho biết người học ở lại bài bao lâu và cuộn tới đâu của **cả trang bài**. `PdfViewer` giữ trang hiện tại trong
> state cục bộ nên không ai biết em đã xem trang nào, dừng ở trang nào, hay lật lướt qua cả file.

## Vì sao làm

- PDF phân trang (một canvas, nút Trước/Sau) nên `maxScrollPct` không phản ánh việc đọc PDF: em lật hết 40 trang mà không
  cuộn trang bài thì vẫn ghi 0%.
- Với một thực nghiệm về phản hồi cá nhân hoá, "đã đọc trang nào" là biến trung gian cần có để giải thích vì sao em làm sai
  một câu quiz (trang chứa kiến thức đó em có mở không, mở bao lâu).
- Cùng triết lý với `videoRanges`: không đo "cao nhất từng đạt" mà đo **phần đã xem thật**.

## Đã chốt (cho bản nháp này, chờ thầy duyệt)

1. **Đơn vị đo là giây dừng trên mỗi trang**, không phải số lần lật. Chỉ đếm khi **tab đang hiện** và **khung PDF nằm ít
   nhất 25% trong màn hình** (bài có chữ phía trên mà PDF ở cuối, em đọc chữ thì không tính là đọc PDF).
2. **Không phát event cho mỗi lần lật trang** (`LearningEvent` append-only; 40 trang × cả lớp là hàng nghìn dòng vô nghĩa).
   Số liệu theo trang nằm ở cột mới `LessonEngagement.pdfPages`; event `lesson.engaged` chỉ thêm **một bản tóm tắt**.
3. **Máy khách gửi phần chênh** theo nhịp 30 giây sẵn có (cùng nhịp `activeSecDelta`), không thêm đường gọi mới. Mất một
   nhịp thì mất đúng phần đó (như `activeSec`).
4. Một trang được coi là **"đã xem"** khi tổng thời gian dừng ≥ **3 giây** (hằng `PDF_PAGE_VIEWED_MIN_SEC`). Số giây thô vẫn
   lưu nên đổi ngưỡng khi phân tích không cần đo lại.
5. Một bài có thể có **nhiều PDF**: số liệu tách theo `contentItemId`.
6. Bản ghi cũ (trước tính năng) có `pdfPages = null`: nghĩa là **chưa từng đo**, không phải "không xem". Không backfill.

## Chưa làm trong đợt này

- Đo PDF ở bài giảng slide / Limio-Live, bài tập, đề thi (chỉ bài học trong khoá).
- Đo vùng cuộn/phóng to trong một trang, thời gian dừng theo vị trí con trỏ.
- Hiển thị cho học viên hoặc bảng điều khiển giảng viên (chỉ lưu + xuất nghiên cứu).
- Bài PDF nhúng bằng `embed`/`file`/`external_link` (chỉ loại `pdf` dùng `PdfViewer`).
- Đọc gì trong tab mới: PDF mở ở tab mới do trình xem PDF của trình duyệt vẽ, nằm ngoài trang Limio nên không đo được
  trang nào, bao lâu (xem AC6 — chỉ ghi được việc họ có bấm mở; AC7 giảm nhu cầu mở tab mới bằng nút toàn màn hình).

## AC1 — Máy khách ghi thời gian dừng theo trang

- **Given** bài có một PDF, người học đang ở trang 3, tab hiện và khung PDF hiện ≥ 25%, **when** 12 giây trôi qua rồi bấm
  "Sau →", **then** trang 3 được cộng 12 giây (làm tròn xuống), và từ lúc đó thời gian tính cho trang 4.
- **Given** tab bị ẩn hoặc khung PDF cuộn ra khỏi màn hình (< 25%), **then** không cộng giây cho trang nào cho đến khi cả hai
  điều kiện thoả lại.
- **Given** bài có hai PDF, **then** mỗi PDF có trang hiện tại riêng; chỉ PDF đang hiện trong màn hình được cộng giây.
- **Given** `PdfViewer` đang dùng ở nơi không có bộ đo (form giảng viên, Limio-Live), **then** không có gì thay đổi và không
  gọi mạng thêm.
- Nhịp 30 giây và nhịp khép lượt (`sendBeacon`) mang theo phần chênh theo trang; sau khi gửi, bộ đếm theo trang về 0 (giữ
  lại phần lẻ dưới 1 giây để không mất dần).
- Lỗi mạng không làm hỏng việc học: cùng nguyên tắc nuốt lỗi của `LessonEngagementTracker`.

## AC2 — Máy chủ cộng dồn theo trang

- **Given** nhịp có `pdf: [{ contentItemId, totalPages, lastPage, dwellSec: {"3": 12} }]`, **when** `recordLessonEngagement`
  chạy, **then** `pdfPages[contentItemId].dwellSec["3"]` tăng 12, `totalPages` và `lastPage` lấy giá trị mới nhất.
- **Given** hai nhịp liên tiếp cùng trang, **then** giây được **cộng** (không ghi đè).
- **Given** `contentItemId` không thuộc bài này hoặc không phải loại `pdf`, **then** mục đó bị bỏ, nhịp vẫn được ghi (thời
  gian đọc, cuộn không bị mất vì một mục hỏng).
- **Given** trang < 1 hoặc > `totalPages`, **then** trang đó bị bỏ.
- **Given** một nhịp báo quá nhiều: mỗi trang tối đa `MAX_DELTA_SEC` (120) giây, tối đa 60 trang và 10 PDF mỗi nhịp, **then**
  vượt trần thì bị chặn ở validate hoặc cắt bớt, không làm phình dòng dữ liệu.
- **Given** nhịp **không có** trường `pdf` (máy khách cũ, bài không PDF), **then** hành vi y như trước, `pdfPages` không đổi.
- Chỉ người đã ghi danh mới ghi được (giữ `not_enrolled`).

## AC3 — Tóm tắt trong `lesson.engaged`

- **Given** lượt đọc khép lại và bài có PDF đã được đo, **then** payload `lesson.engaged` có thêm
  `pdf: [{ contentItemId, totalPages, pagesViewed, lastPage }]` (số liệu **cộng dồn** sau lượt này, như `totalActiveSec`).
- **Given** bài không có PDF hoặc chưa đo được trang nào, **then** payload **không có** trường `pdf` (không phải mảng rỗng).
- Payload chỉ mang id và con số, không mang tiêu đề hay nội dung PDF.

## AC4 — Đọc và xuất cho nghiên cứu

- `getCourseEngagement` trả thêm `pdfPages` (null khi chưa đo).
- Xuất CSV nghiên cứu "đọc bài" (B13) thêm ba cột: **Số trang PDF đã xem**, **Tổng số trang PDF**, **Trang PDF dừng gần
  nhất** (rỗng khi bài không có PDF hoặc có nhiều hơn một PDF; hai cột đầu cộng gộp các PDF của bài).
- Người chưa mở bài ra dòng 0 như các cột hiện có; bài không có PDF ra rỗng, không phải 0 (phân biệt "không có PDF" với
  "có PDF mà không xem").

## AC5 — Quy ước repo

- Migration qua `prisma migrate`, cột `pdfPages Json?` nullable.
- Không đổi giao diện giảng viên nên không cần cập nhật `GIAO-DIEN.md` / Lily.
- Test chạy trong `packages/core-lms` (`engagement.test.ts`) trước khi viết code.

## AC6 — Ghi việc mở PDF ở tab mới (bổ sung 27/10/2026)

Lý do: mở PDF ở tab mới làm tab bài học bị ẩn nên bộ đo chốt lượt đọc; người đọc hết PDF ngoài trang và người mở rồi bỏ đi
trông giống nhau (ít giây, 0 trang). Ghi cú bấm để tách hai trường hợp.

- **Given** học viên đã ghi danh bấm "Mở PDF trong tab mới" (hoặc "Mở trong tab mới" khi PDF không tải được), **then**
  máy khách gửi một yêu cầu nền và phát event `lesson.pdf.opened_external` với payload chỉ có `lessonId`, `contentItemId`.
  Không mang tiêu đề, địa chỉ PDF hay nội dung.
- Mỗi lần bấm một event, **không chống trùng**: mở đi mở lại là tín hiệu thật (như `feedback.remediation.clicked`).
- **Không bao giờ chặn hay làm chậm việc mở tab**: gửi bằng `fetch` + `keepalive`, không chờ, nuốt mọi lỗi; link vẫn là thẻ `<a>`
  thường (mở được cả khi JS lỗi, cả khi bấm chuột giữa / Ctrl+Click).
- Máy chủ từ chối (không ghi gì): người chưa ghi danh, `contentItemId` không thuộc bài này hoặc không phải loại `pdf`,
  bài không tồn tại. Chống kẻ khác bơm event cho khối bất kỳ làm sai số liệu.
- `PdfViewer` ở nơi không có bộ đo (form giảng viên, Limio-Live) không gửi gì khi bấm.
- Event **không tính là hoạt động của người dạy** (là hành vi học, thuộc namespace `lesson.*`), không cần thêm vào
  `NON_LEARNER_ACTIVITY_PREFIXES`.
- Xuất CSV nghiên cứu thêm cột **Mở PDF ở tab mới (lần)**: đếm event theo (người học × bài); bài không có PDF để rỗng,
  bài có PDF mà không bấm ra 0.

## AC7 — Nút toàn màn hình cho phần xem PDF (bổ sung 27/10/2026)

Lý do: đọc ngay trong trang thì đo được; chuyển sang tab khác thì không (AC6). Nút toàn màn hình cho khung xem đủ lớn để
học viên không cần mở tab mới.

- **Given** trình duyệt hỗ trợ Fullscreen API, **then** `PdfViewer` có nút "Toàn màn hình" (hiện cả khi PDF chỉ 1 trang). Bấm thì
  vùng xem PDF vào toàn màn hình, trang PDF **vừa khít cả chiều ngang lẫn chiều cao** màn hình, không phải cuộn mới thấy hết một trang.
- **Đang toàn màn hình chỉ còn đúng ba thứ**: nút **"Thoát toàn màn hình"**, nút **Trước / Sau**, và số thứ tự trang
  **"Trang X / N"**. **Bỏ hết phần còn lại**: tiêu đề (header), nút "Toàn màn hình", link "Mở PDF trong tab mới". Với PDF 1 trang thì
  chỉ còn nút thoát và số trang (không có Trước/Sau). Thoát xong, mọi thứ hiện lại như cũ.
- Esc cũng thoát (do trình duyệt). Phím ← / → đổi trang.
- **Given** trình duyệt không hỗ trợ (vd Safari trên iPhone), **then** không hiện nút, không lỗi; link "Mở PDF trong tab mới" vẫn dùng được.
- Trình duyệt từ chối vào toàn màn hình thì nuốt lỗi, trang không đổi.
- **Đo đọc không đổi**: trong toàn màn hình `PdfViewer` vẫn báo trang đang mở và việc khung PDF nằm trong màn hình (AC1), nên
  thời gian đọc vẫn cộng đúng trang. Không thêm event riêng cho toàn màn hình.
- Áp dụng cho mọi nơi dùng `PdfViewer` (cả bản xem thử của giảng viên), nhưng chỉ bài học của khoá mới có đo.
