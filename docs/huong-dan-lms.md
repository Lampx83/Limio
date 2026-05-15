# Hướng dẫn sử dụng FeedBackMe

Chào bạn 👋

Tài liệu này giúp bạn làm quen với FeedBackMe — một nền tảng học tập trực tuyến (LMS) được thiết kế để việc dạy và học trở nên nhẹ nhàng, có định hướng và *thông minh* hơn. Dù bạn là **giảng viên** đang xây khoá học đầu tiên, hay **học viên** vừa đăng ký — chỉ cần đọc đúng phần dành cho mình là đủ.

Hệ thống có khá nhiều tính năng, nhưng đừng lo: bạn không cần dùng hết ngay. Bắt đầu từ những thứ cơ bản, rồi mở rộng dần khi quen.

> 💡 Phần Gamification (XP, huy hiệu, nhiệm vụ, giải đấu) có tài liệu riêng tại `huong-dan-gamification.md`.

---

## 🧑‍🏫 Phần 1 — Dành cho Giảng viên

Sau khi đăng nhập bằng tài khoản giảng viên, bạn sẽ thấy khu vực riêng tại `/instructor`. Menu bên trái là "trung tâm điều khiển" — mọi thứ giảng viên cần đều ở đó.

### 1. Bắt đầu từ Dashboard

Vào `/instructor/dashboard` mỗi sáng để biết **hôm nay cần làm gì**:

- 📌 **Việc cần làm**: bài luận chưa chấm, bài tập chờ phản hồi, câu hỏi trên diễn đàn chưa ai trả lời.
- 📊 **Hoạt động gần đây** của học viên trong khoá bạn dạy.
- ⚠️ **Cảnh báo skill**: nếu có bài học hoặc câu hỏi chưa gắn "kỹ năng" (skill), hệ thống sẽ nhắc bạn.

> **Tại sao phải gắn skill?** Vì FeedBackMe dùng skill để cá nhân hoá việc học — biết học viên yếu chỗ nào, gợi ý đúng bài. Không gắn skill thì hệ thống "mù". Vì vậy, bài học/câu hỏi nào cũng nên có ít nhất 1 skill trước khi xuất bản.

### 2. Tạo và quản lý khoá học

#### 2.1. Tạo khoá mới

Vào `/instructor/courses/new`. Form tạo khoá gồm các trường:

- **Tiêu đề** (bắt buộc, tối đa 200 ký tự): ví dụ "Lập trình Python cơ bản".
- **Mô tả**: trình soạn thảo rich text — bạn có thể bôi đậm, gạch chân, làm danh sách, chèn link, đặt heading.
- **Level**: chọn *Cơ bản* / *Trung cấp* / *Nâng cao*.
- **Ngôn ngữ**: *Tiếng Việt* hoặc *English*.
- **Category**: nhập tự do (ví dụ `data-science`) — dùng để phân loại trong catalog.

Nhấn **Tạo** xong, hệ thống đưa bạn thẳng vào trang chỉnh sửa khoá. Khoá mới mặc định ở trạng thái **Nháp** — học viên chưa thấy được.

#### 2.2. Cấu trúc khoá học

Hiểu cấu trúc giúp bạn tổ chức bài có lớp lang:

```
Khoá học (Course)
└── Module (Chương)
    └── Bài học (Lesson)
        ├── Hoạt động & Tài nguyên (content, video, file...)
        ├── Quiz (kiểm tra nhanh)
        └── Assignment (bài tập nộp)
```

Trang chỉnh sửa `/instructor/courses/[id]` có **4 tab** ở đầu trang:
1. **Tổng quan** — thông tin chung, status, publish.
2. **Nội dung** — xây dựng module/lesson/hoạt động (tab dùng nhiều nhất).
3. **Học viên** — ghi danh, import học viên.
4. **Phân tích** — xem báo cáo.

#### 2.3. Tab Tổng quan — chỉnh thông tin & publish

Tab này hiển thị:
- **Badge trạng thái**: *Nháp* / *Đã publish* / *Lưu trữ*.
- **Card metadata** — tiêu đề, mô tả, level, ngôn ngữ, category, giá. Nhấn **Sửa** để mở form chỉnh.
- **Thống kê nhanh**: phiên bản, số module, số lesson, số quiz.
- **Cảnh báo skill**: nếu có lesson chưa tag skill, banner màu vàng sẽ hiện kèm tên các lesson đó. *Khoá không publish được khi còn cảnh báo này.*

**Đặt giá khoá học** (trong form Sửa):
- Để trống ô giá ⇒ khoá **miễn phí**.
- Tiền **VND**: nhập số nguyên (ví dụ `299000` = 299.000đ).
- Tiền **USD**: nhập theo **cent** (ví dụ `999` = $9.99). Cẩn thận đơn vị nhé!

**Hành động cho khoá** ở góc trên:
- **Publish**: xuất bản khoá — chỉ bật được khi mọi lesson đã có skill. Nếu chưa, di chuột vào nút sẽ thấy tooltip liệt kê lesson còn thiếu.
- **Nhân bản khoá** (Duplicate): tạo bản sao toàn bộ khoá để chỉnh thử mà không động vào bản gốc.
- **Xoá khoá**: chuyển sang trạng thái lưu trữ (không xoá hẳn).
- **Archive** (chỉ hiện khi đã publish): chuyển khoá về lưu trữ. ⚠️ Sau khi archive **không publish lại được** — hệ thống sẽ hỏi xác nhận.

#### 2.4. Tab Nội dung — xây dựng bài giảng

Đây là "phòng làm việc" chính. Giao diện chia 2 cột:
- **Cột trái** (trên màn hình rộng): cây module → lesson. Click vào lesson nào để mở chi tiết bên phải.
- **Cột phải**: hoặc là tổng quan module, hoặc trình soạn thảo lesson đã chọn.

**Tạo module mới**
1. Nhấn nút **+ Thêm module** (viền nét đứt) cuối danh sách module.
2. Nhập **Tên module** (tối đa 200 ký tự) — ví dụ "Phương trình bậc 1".
3. Nhấn **Tạo** (hoặc **Hủy** để bỏ).

**Sắp xếp lại module**: kéo-thả module trong cột trái để đổi thứ tự — thứ tự này chính là thứ tự học viên thấy.

**Tạo lesson trong module**
1. Trong module, nhấn **+ Thêm lesson**.
2. Điền:
   - **Tên lesson** (bắt buộc, ≤200 ký tự).
   - **Mô tả** (tuỳ chọn, rich text — viết tóm tắt mục tiêu bài học).
3. Nhấn **Tạo lesson**.

**Sửa lesson**: click vào lesson trong cây bên trái → cột phải hiện trình soạn thảo. Phần đầu là **header lesson** với:
- Tiêu đề + số thứ tự (ví dụ "Lesson 1").
- 👁️ Nút **Ẩn/Hiện** — ẩn tạm thời không xoá nội dung.
- Chip **Preview** nếu lesson cho phép xem thử (không cần đăng ký).
- Cảnh báo "chưa tag skill" nếu thiếu skill.
- Nút **Sửa** để chỉnh tên/mô tả lesson.

> 💡 **Mẹo**: Lesson có thể ẩn để bạn soạn dần mà học viên chưa thấy. Đến khi xong thì bật hiện lại. Module và content item bên trong cũng có chế độ ẩn tương tự.

#### 2.5. Gắn skill cho lesson (bắt buộc trước khi publish)

Trong trình soạn lesson, mục **Skill tags** hiển thị các skill đã gắn dưới dạng "pill" có dạng `[CODE] · [Tên skill] ×`.

**Cách gắn skill có sẵn**:
1. Nhấn **+ Tag skill**.
2. Gõ vào ô tìm — ví dụ "đại số", "math.algebra". Tối đa 20 kết quả hiện ra, lọc theo cả code lẫn tên.
3. Click skill phù hợp ⇒ tự gắn vào lesson.

**Tạo skill mới ngay tại đây** (khi chưa có skill phù hợp):
1. Trong dropdown tìm kiếm, chọn **+ Tạo skill mới**.
2. Nhập:
   - **Code**: theo định dạng `tên.con.chi-tiết` — chữ thường, dùng dấu chấm, gạch ngang, gạch dưới. Ví dụ `math.algebra.linear`. Code phải bắt đầu bằng chữ cái.
   - **Tên hiển thị**: ví dụ "Phương trình bậc nhất".
3. Nhấn **Tạo + tag** — skill được tạo và gắn ngay.

**Để AI gợi ý skill**:
- Nhấn nút **AI suggest** — hệ thống đọc nội dung lesson và đề xuất 1–3 skill kèm % độ tin cậy và lý do.
- Mỗi gợi ý có nút **+ Thêm** (chấp nhận) và **✕** (bỏ qua).
- Cực kỳ hữu ích khi bạn lười nghĩ skill hoặc không chắc nên gắn gì.

**Bỏ skill**: click dấu **×** trên pill skill muốn bỏ.

#### 2.6. Thêm hoạt động và tài nguyên vào lesson

Cuối trình soạn lesson có khu vực **Hoạt động (X)** — X là tổng số hoạt động hiện có. Nhấn **+ Thêm hoạt động/tài nguyên** mở một modal chọn loại.

Modal có:
- Ô tìm "🔎 Tìm hoạt động..."
- Filter: **Tất cả** | **Tài nguyên** | **Hoạt động**.

**Nhóm Tài nguyên** (nội dung để học):

| Loại | Dùng cho |
|---|---|
| 📝 **Văn bản** | Soạn bài bằng editor WYSIWYG (giống Word). |
| 🅼 **Markdown** | Viết bằng cú pháp markdown thô. |
| 🎬 **Video** | Nhúng YouTube/Vimeo/Loom — chỉ cần dán URL, hệ thống tự lấy thumbnail. Hoặc upload file. |
| 📄 **PDF** | Tải file PDF lên hoặc link ngoài. |
| 📁 **File đính kèm** | File tải về (slide, code mẫu, dataset...). |
| 🔗 **Link ngoài** | Liên kết ngoài. |
| 🌐 **Embed** | Nhúng iframe tuỳ chỉnh. |
| 📦 **SCORM** | Gói SCORM 1.2 (.zip). |
| 🎯 **H5P** | Nội dung tương tác H5P. |
| 🔌 **LTI** | Tool ngoài qua chuẩn LTI 1.3. |

**Nhóm Hoạt động** (việc học viên làm):
- ❓ **Quiz** — kiểm tra trắc nghiệm, máy chấm.
- 📋 **Assignment** — bài tập có giảng viên chấm tay.

**Sau khi tạo, mỗi content item hiện thành 1 dòng** gồm:
1. Số thứ tự (vòng tròn).
2. Thumbnail (cho video) hoặc emoji.
3. Badge loại nội dung + nhà cung cấp (ví dụ `video · YouTube`).
4. Tóm tắt 80 ký tự đầu.
5. Hover vào dòng để hiện 3 nút: **👁️ ẩn/hiện**, **✏️ sửa**, **🗑️ xoá** (có xác nhận).

**Sửa content item**: nhấn nút bút chì — form sửa hiện ra ngay tại chỗ với các trường phù hợp loại (URL cho video, tiêu đề+URL cho PDF, editor cho richtext...).

#### 2.7. Quiz trong lesson

Khi thêm **Quiz** vào lesson, một panel mở rộng sẽ hiện:

```
❓ [Tên quiz]    [X] câu · diff [Y] · pass [Z]%
```

**Cài đặt quiz** (mở bằng nút sửa hoặc xổ panel):
- **Tiêu đề** quiz.
- **Difficulty**: số nguyên thể hiện độ khó.
- **Pass threshold (%)**: ngưỡng đậu, mặc định 70%.
- **Time limit (giây)**: để trống = không giới hạn.
- **Max attempts**: số lần làm tối đa; trống = không giới hạn.
- **Require confidence**: bắt học viên đánh giá mức độ tự tin trước khi xem điểm — hữu ích cho phương pháp metacognition.

**Quản lý câu hỏi trong quiz**:
- Mỗi câu hiện thành dòng: nội dung 80 ký tự đầu, badge loại câu, số đáp án, điểm, skill đã gắn, nút Sửa/Xoá.
- **+ Thêm câu**: tạo câu thủ công.
- **AI suggest**: dùng AI sinh câu hỏi từ nội dung lesson — nhanh, nhưng nhớ rà lại.
- **Bulk import**: import hàng loạt từ CSV/Excel — phù hợp khi bạn đã có ngân hàng câu trong file.

#### 2.8. Assignment (bài tập nộp)

Khác Quiz, Assignment cần giảng viên chấm tay. Khi tạo:
- **Tiêu đề** + **Mô tả** (rich text — viết rõ đề bài, tiêu chí chấm).
- **Loại hoạt động (Pedagogical intent)**: dropdown có sẵn 7 kiểu sư phạm dựa trên ICAP framework — *summarizing, mapping, drawing, imagining, self_explaining, teaching, enacting*. Chọn loại phù hợp ⇒ hệ thống gợi ý format response.
- **Điểm tối đa**: mặc định 100.
- **Hạn nộp**: datetime picker.
- Tuỳ chọn:
  - ☐ **Yêu cầu tự đánh giá**: học viên phải tự chấm trước khi nộp.
  - ☐ **Yêu cầu reflection**: bắt viết phần phản tư (reflection).
  - ☑ **Tính vào điểm**: mặc định bật — nếu tắt thì assignment chỉ luyện tập, không vào điểm khoá.

Assignment đã có bài nộp thì xuất hiện nút **Xem bài nộp** — đi thẳng tới `/instructor/assignments/[id]/submissions` để chấm.

#### 2.9. Tab Học viên & Tab Phân tích

**Tab Học viên**:
- Nút **Import học viên** — bulk enroll bằng file (CSV).
- Danh sách enrollment hiện sẵn: tên, email, vai trò (student / TA / instructor), trạng thái, tiến độ.

**Tab Phân tích**: dashboard và CSV exports — đã mô tả ở mục 7.

#### 2.10. Quy trình Publish khoá

Tóm tắt 3 trạng thái:

| Trạng thái | Học viên thấy? | Hành động khả dụng |
|---|---|---|
| **Nháp** | Không | Sửa thoải mái; nút Publish (cần tag skill xong) |
| **Đã publish** | Có (trong catalog) | Vẫn sửa được; có thể Archive |
| **Lưu trữ** | Không (badge readonly) | Chỉ xem, không edit, không publish lại |

**Trước khi nhấn Publish, checklist gợi ý**:
- [ ] Mọi lesson đều có ≥1 skill tag.
- [ ] Đã ẩn các lesson/content còn dang dở.
- [ ] Đã đặt giá (hoặc xác nhận miễn phí).
- [ ] Đã viết mô tả khoá đầy đủ.
- [ ] Mở thử ở góc nhìn học viên (nếu có Preview lesson) để kiểm tra.

#### 2.11. Quản lý lớp (Cohort)

Vào `/instructor/courses/[id]/cohorts`. Cohort là cách bạn dạy **nhiều lớp dùng chung 1 nội dung**:
- Tạo cohort mới — đặt tên (ví dụ "K65 đợt 1", "Doanh nghiệp ABC tháng 5/2026"), gắn lịch học.
- Thêm học viên vào cohort.
- Mỗi cohort có thể có đề thi/lịch mở riêng (gating theo cohort), nhưng dùng chung bài giảng — không phải nhân bản khoá.

> 💡 Nếu bạn dạy lớp "khoá 2024" và "khoá 2025" cùng giáo trình, **dùng cohort thay vì nhân bản khoá** — đỡ phải đồng bộ chỉnh sửa hai chỗ.

---

### Thuật ngữ trong giao diện

Vài từ Anh-Việt hay gặp khi dùng course editor:

| Tiếng Việt (UI) | Ý nghĩa |
|---|---|
| Nháp | Bản nháp, chưa xuất bản |
| Đã publish | Đã xuất bản, học viên thấy được |
| Lưu trữ | Archived, đóng băng |
| Thêm / Sửa / Xoá / Hủy / Lưu | Các hành động cơ bản |
| Ẩn / Hiện | Bật/tắt hiển thị với học viên |
| Hoạt động | Việc học viên làm (quiz, assignment) |
| Tài nguyên | Nội dung học viên xem/đọc (video, văn bản...) |
| Module / Bài / Câu | Chương / Lesson / Question |

### 3. Đề thi và Quiz — khác nhau thế nào?

Đây là hai khái niệm dễ nhầm:

| | **Quiz** | **Đề thi (Exam)** |
|---|---|---|
| Mục đích | Kiểm tra nhanh trong bài học | Bài thi chính thức |
| Thời gian | Không giới hạn chặt | Có thời lượng cố định |
| Giám sát | Không | Có (chống chuyển tab, fullscreen) |
| Cửa sổ mở | Lúc nào học cũng được | Mở/đóng theo lịch |

**Tạo đề thi** tại `/instructor/courses/[id]/exams/new`. Trong trang chỉnh sửa đề, bạn cấu hình:

- ⏱️ **Cài đặt**: thời lượng, điểm đậu, lịch mở/đóng, số lần thi cho phép.
- 📝 **Câu hỏi**: trắc nghiệm 1/nhiều đáp án, điền khuyết, đáp án ngắn, tự luận. Có thể gắn vào *passage* (đoạn văn) cho dạng đọc hiểu.
- 🏷️ **Skill**: gắn kỹ năng cho từng câu — để feedback sau bài thi có ý nghĩa.

> 💡 **Mẹo**: Lưu câu hỏi vào **Ngân hàng câu hỏi** (`/instructor/question-banks`) để dùng lại cho nhiều đề. Tạo đề mới chỉ cần "rút" ngẫu nhiên N câu — đỡ phải gõ lại.

**Theo dõi học viên đang thi** (`/live`): Trong lúc học viên làm bài, bạn xem được ai còn bao nhiêu phút, ai gặp sự cố (mất mạng, chuyển tab, thoát fullscreen). Cần thiết thì mở từng bài để xem chi tiết.

**Chấm bài tự luận** (`/grading`):
- Trắc nghiệm và điền khuyết → máy chấm tự động.
- Tự luận và đáp án ngắn → bạn chấm tay, nhập điểm và nhận xét.
- Có **Feedback Templates** (`/instructor/feedback-templates`) để chèn nhanh phản hồi mẫu — không phải gõ đi gõ lại "Tốt!", "Cần cải thiện diễn đạt..."

### 4. Chấm bài tập và bài luận

Hai chỗ chính:

- 📚 **Trung tâm chấm luận** (`/instructor/grade-essays`): tất cả bài luận đang chờ trên mọi khoá, gom về một chỗ.
- 📋 **Bài tập** (`/instructor/assignments`): danh sách assignment với số bài chờ chấm. Click vào để chấm từng bài.

### 5. Quản lý học viên

- 👥 **Tất cả enrollment** (`/instructor/enrollments`): lọc theo khoá, theo trạng thái (đang học / đã hoàn thành / bỏ học / lâu rồi không vào). Hữu ích để nhận ra học viên "bốc hơi" và nhắc nhẹ.
- 🆘 **Học viên gặp khó** (`/instructor/courses/[id]/struggling-students`): hệ thống tự đánh dấu những em đang vật lộn với khoá. Vào xem chi tiết: em ấy yếu skill nào, hay sai dạng câu hỏi gì, đã từng làm bài nào — để bạn hỗ trợ đúng chỗ.

### 6. Công cụ dạy học trực tiếp (Classroom Tools)

Khi đứng lớp (trực tiếp hoặc online), bạn cần những công cụ "nhỏ mà có võ". FeedBackMe có sẵn:

- ⏰ **Đồng hồ đếm ngược**: bấm giờ cho hoạt động nhóm, hết giờ là chuyển. Lưu được mẫu thường dùng (5 phút thảo luận, 15 phút thuyết trình...) ở **Timer Templates**.
- 🎲 **Chia nhóm ngẫu nhiên**: nhập "chia 4 nhóm" hoặc "3 người 1 nhóm" — hệ thống tự bốc.
- 🎯 **Bốc thăm gọi tên**: cần gọi học viên ngẫu nhiên trả lời? Click một cái xong.
- 📝 **Sổ ghi chú live**: ghi nhanh trong lúc giảng, lưu kèm bài học.
- 🗳️ **Quick Poll**: tạo câu khảo sát 1-click, học viên trả lời từ điện thoại, kết quả lên ngay.
- ☁️ **Word Cloud**: học viên gửi từ khoá, hệ thống vẽ "đám mây từ" trực quan — hay dùng cho phần warm-up đầu giờ.

Tất cả nằm trong `/instructor/classroom/[lessonId]` (gắn với bài học cụ thể) hoặc `/instructor/teaching-tools` (dùng độc lập).

### 7. Phân tích — biết khoá của mình đang chạy ra sao

Vào `/instructor/analytics` để xem bức tranh tổng:

- 🔻 **Funnel ghi danh**: bao nhiêu người đăng ký → bắt đầu học → hoàn thành.
- ✅ Tỷ lệ đậu quiz, trạng thái bài tập.
- 📈 Hoạt động 30 ngày gần nhất.
- 🎯 Bài học nào hút, bài nào bị bỏ giữa chừng.
- 📥 Xuất CSV nếu cần làm báo cáo riêng.

Sâu hơn:
- **Phân tích từng câu hỏi** (`/instructor/item-analytics`): câu nào quá dễ, quá khó, hay câu nào "đánh đố không đúng cách" — để bạn cải thiện đề.
- **Insights từng học viên** (`/instructor/learner-insights`): hồ sơ chi tiết từng em.

### 8. Tính năng nâng cao (khi bạn đã quen)

- 🏷️ **Skill Tagging** (`/instructor/skill-tagging`): gắn skill hàng loạt, đỡ phải vào từng bài.
- 💬 **Diễn đàn** (`/instructor/forum`): quản lý thread chưa được trả lời.
- 📅 **Đợt thi & Phiên thi** (`/instructor/exam-rounds`, `/instructor/exam-sessions`): lập lịch thi tập trung cho nhiều lớp.
- 🏆 **Tournament** (`/instructor/tournaments`): tổ chức giải đấu học tập — chi tiết ở tài liệu Gamification.
- 🤖 **AI Feedback Generator** (`/instructor/feedback-generator`): nhờ AI sinh nhận xét cá nhân hoá dựa trên bài làm — bạn chỉ chỉnh lại.

---

## 🎓 Phần 2 — Dành cho Học viên

Chào mừng bạn đến FeedBackMe! Đây là nơi bạn học theo cách phù hợp với *riêng mình* — hệ thống sẽ quan sát bạn học và đưa ra gợi ý đúng lúc.

### 1. Tìm khoá học và đăng ký

Vào `/catalog`, lướt qua các khoá theo chủ đề, đọc mô tả, xem ai là giảng viên, giá bao nhiêu. Thấy ưng thì nhấn **Đăng ký**. Khoá miễn phí vào học ngay; khoá có phí thì thanh toán qua Stripe/VNPay/Momo — xong là vào học được liền.

### 2. Trang chính của một khoá học

Sau khi đăng ký, vào `/learn/[slug]` (slug là mã khoá). Đây là "bàn làm việc" của bạn cho khoá đó:

- 📊 **Tiến độ**: bạn đã đi được bao xa, còn bao nhiêu bài.
- ⚡ **XP và Streak**: điểm kinh nghiệm và chuỗi ngày học liên tiếp. Streak càng dài, XP càng "nhân hệ số".
- 🏅 **Bảng xếp hạng & Huy hiệu**: bạn đang đứng thứ mấy, đã đạt badge nào.
- 🎯 **Daily Quest**: nhiệm vụ hôm nay — làm xong là có thưởng XP và giữ streak.
- 🧭 **Gợi ý bài học tiếp theo**: hệ thống tự chọn bài phù hợp nhất *cho bạn* — không nhất thiết phải học tuần tự.

### 3. Học một bài

Vào một bài học (`/learn/[slug]/lessons/[lessonId]`), bạn sẽ có:

- 📖 **Nội dung**: văn bản đẹp, video chất lượng cao (xem trên di động cũng mượt), file để tải.
- ✏️ **Quiz** ngay trong bài: làm xong là biết đúng/sai, có giải thích.
- 📤 **Nộp bài tập** (nếu có): tải file lên hoặc viết thẳng trên hệ thống.
- 💬 **Diễn đàn**: kẹt chỗ nào cứ hỏi — giảng viên và bạn học sẽ trả lời.
- 🤖 **AI Tutor**: trợ lý AI luôn online, biết bạn đang học bài nào — hỏi trực tiếp khi cần. Đừng ngại "hỏi câu ngu" — AI không phán xét đâu!
- ✅ **Đánh dấu hoàn thành** khi xong — XP về liền.

### 4. Làm bài thi

**Trước khi bắt đầu**:
- Vào `/learn/[slug]/exams` xem có những đề nào.
- Click vào đề muốn làm — đọc kỹ thời lượng, điều kiện đậu, số lần được thi.
- Sẵn sàng thì nhấn **Bắt đầu làm bài**. Không quay lại được nữa nhé — bộ đếm thời gian sẽ chạy.

**Trong lúc làm bài** (giao diện Exam Player):

- ⏳ Đồng hồ đếm ngược ở góc — đừng quên ngó.
- 🗂️ **Bảng câu hỏi (palette)** ở bên: nhìn nhanh câu nào xong, câu nào đánh dấu để quay lại, câu nào chưa làm.
- 💾 **Tự động lưu**: gõ tới đâu, hệ thống lưu tới đó. Mất mạng cũng không sợ mất bài.
- 🖥️ **Chế độ toàn màn hình**: hệ thống yêu cầu bạn ở fullscreen. Nếu chuyển tab hay thoát fullscreen, sự cố sẽ được ghi nhận — vài lần thì có thể bị giảng viên cảnh báo. Nên đóng các app khác trước khi vào thi.
- 📤 **Nộp bài**: xem lại các câu lần cuối, xác nhận và nộp.

**Sau khi nộp**:
- Câu trắc nghiệm có điểm ngay.
- Câu tự luận chờ giảng viên chấm — bạn sẽ thấy điểm và nhận xét khi xong.
- Quan trọng: đọc kỹ phần **Feedback cá nhân hoá** — nó chỉ ra bạn yếu skill nào, hay sai kiểu gì, và *nên ôn thế nào*. Đây là phần "vàng" của FeedBackMe — đừng bỏ qua!

### 5. Lấy chứng chỉ

Khi hoàn thành khoá (đủ phần trăm bài học + đậu các đề thi chính), bạn vào `/learn/[slug]/certificate` để tải chứng chỉ PDF — có mã xác thực, có thể đính lên LinkedIn hay CV.

### 6. Tham gia hoạt động trong lớp

Khi giảng viên đang dạy trực tiếp, có thể bạn sẽ nhận được link:

- 🗳️ **Poll** (`/learn/poll/[pollId]`): vote nhanh cho câu khảo sát.
- ☁️ **Word Cloud** (`/learn/word-cloud/[cloudId]`): gửi từ khoá, thấy đám mây "lớn dần" trên màn hình lớp.
- 🎯 Nếu được "bốc thăm" trả lời, bạn sẽ thấy thông báo.

### 7. Vài mẹo để học hiệu quả hơn

- 🔥 **Đừng đứt streak**: học mỗi ngày một chút còn hơn ngồi 4 tiếng cuối tuần. Streak giữ động lực, lại nhân XP.
- 🧭 **Tin Adaptive Path**: hệ thống tính rồi — bài nó gợi ý thường đáng học hơn việc bạn cố đi tuần tự.
- 📝 **Đọc feedback sau mỗi quiz/exam**: nếu bạn cứ sai một loại lỗi, feedback sẽ chỉ ra. Sửa được lỗi đó là điểm lên rõ rệt.
- 🤖 **Hỏi AI Tutor sớm**: đừng "im lặng chịu đựng" 30 phút mới hỏi. Cứ kẹt là hỏi.

---

## ❓ Câu hỏi hay gặp

**Giảng viên hỏi**

> *"Tôi tạo bài học mới rồi mà học viên không thấy?"*

Kiểm tra 2 thứ: (1) khoá đã **Xuất bản** chưa? (2) bài học đã **gắn skill** chưa? Thiếu một trong hai là bài không hiển thị.

> *"Học viên báo bị 'đá' khỏi đề thi giữa chừng?"*

Vào trang Live của đề (`/instructor/courses/[id]/exams/[examId]/live`), xem tab **Incidents**. Nếu là mất mạng → học viên thường vào lại được. Nếu vi phạm fullscreen/chuyển tab nhiều lần → có thể attempt đã bị đánh dấu.

> *"Tôi muốn dùng lại đề thi cho lớp năm sau?"*

Hai cách:
1. Tạo **cohort mới** trong cùng khoá — giữ nguyên đề.
2. Lưu câu hỏi vào **Question Bank** trước, sau đó tạo đề mới rút từ bank.

> *"Học viên có thi lại được không?"*

Tuỳ cài đặt "số lần thi tối đa" của đề. Mặc định là 1 lần. Bạn có thể tăng khi tạo/sửa đề.

**Học viên hỏi**

> *"Tôi mất mạng giữa giờ thi, bài có bị mất không?"*

Không — câu trả lời được lưu liên tục. Vào lại là tiếp tục được. Đồng hồ vẫn chạy đó nha.

> *"Bài luận của tôi nộp lâu rồi mà chưa có điểm?"*

Câu tự luận cần giảng viên chấm tay — nên có thể vài ngày. Trang kết quả sẽ tự cập nhật khi xong.

> *"Tôi không thấy khoá học mình đã đăng ký?"*

Đăng nhập đúng email đã dùng để đăng ký. Nếu vẫn không thấy, liên hệ giảng viên hoặc admin.

---

## 📚 Tài liệu liên quan

- **`huong-dan-gamification.md`** — XP, badge, quest, tournament hoạt động ra sao
- **`EXAM-INSTRUCTOR-GUIDE.md`** — chi tiết kỹ thuật về module đề thi
- **`docs/SPEC.docx`** — spec nghiệp vụ đầy đủ (cho team phát triển)

---

Chúc bạn dạy hay và học vui! 🌱
