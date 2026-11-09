# Khoá "Mathematical Foundations for Data Science" (tiếng Anh, 45 giờ)

> Trạng thái (09/11/2026): **đã nhập máy dev (nháp)**, chưa lên prod. Nguồn: bộ tài liệu của giảng viên
> (`Mathematical Foundations for Data Science/`: đề cương + 3 Part, mỗi Part gồm lecture notes, slide, 50 câu MCQ có đáp án và lời giải).
> Khoá **không có video** (chủ khoá không có); phần video/giọng giảng để trống. Mọi thứ còn thiếu so với PDS và ML được soạn thêm.

## Cấu trúc

| Module | Bài | Ghi chú |
|---|---|---|
| Start here | Course overview and syllabus | mục tiêu LO.1–LO.10, 3 Part, 15 topic, cách đánh giá 20/30/50, cách học |
| Part I — Linear Algebra | "Part I materials" + Topic 1–5 | PDF: lecture notes, slide (`linear algebra.pdf`), bộ 50 câu |
| Part II — Calculus and Optimization | "Part II materials" + Topic 6–9 | như trên |
| Part III — Probability and Statistics | "Part III materials" + Topic 10–15 | như trên |
| Integrated final assessment | 1 bài, 11 câu tình huống, 45 phút | trộn cả ba Part, đo LO.10 (chọn đúng công cụ) |

Tổng: 5 module, 20 bài, **236 câu hỏi**, 111 lỗi tư duy + 114 mẫu phản hồi, 15 topic.

- **150 câu MCQ của giảng viên** đều có mặt đúng một lần (khoá `la.t<n>.mcq<số>`, `cal.t<n>.mcq<số>`, `pr.t<n>.mcq<số>`), xếp vào topic theo nội dung
  (Part II, III theo bảng *Topic index* cuối PDF); đáp án đã giải lại bằng sympy/numpy: **không có đáp án sai**. Lời giải của PDF được viết lại thành `explanation`.
- Mỗi topic thêm 3–5 câu sinh thêm (`.x<n>`: điền số, đúng/sai, tự luận ngắn, sắp xếp, ghép cặp) cho phần MCQ không phủ.
- Mỗi phương án sai nhận ra được đều gắn mã lỗi tư duy (`la.*`, `cal.*`, `pr.*`, `fin.*`) + mẫu phản hồi chỉ đúng chỗ sai.
- Mỗi topic: mục tiêu, ví dụ mẫu **hiện từng bước**, "dự đoán trước khi đọc", "tìm lỗi trong lời giải", hỏi đáp, thẻ ghi nhớ, tổng kết,
  phần "Practice with Python" (mã **đã chạy**, kết quả in thật).
- Bảng màu theo Part: Part I `limio`, Part II `forest`, Part III `sunset`, bài cuối `vibrant`.

## Khác biệt so với tài liệu gốc (cần giảng viên biết)

- Đề cương chia Part I thành 4 mục, ở đây **5 topic** (đúng bảng Detailed course content); Part III thành **6 topic**. Lecture notes Part III chỉ có 4 bài, bài "materials" có bảng ánh xạ topic → mục của notes.
- Q41 → T11, Q31 → T13, Q15 và Q36 → T14 (Part III): xếp theo nội dung, có thể đổi.
- Q28, Q43 (Part III) là bảng trong PDF; text câu hỏi không có bảng nên viết lại thành từng dòng.
- Q45 (Part III): 0.3174 là xấp xỉ chuẩn (CLT); giá trị gamma đúng ≈ 0.325 — câu hỏi ghi rõ "CLT approximation".
- Q37, Q36 (Part II): "MSE" hay "half-MSE" tuỳ quy ước 1/m; bracket của Q36 bị hỏng khi trích text, đã lấy lại từ ảnh PDF. Ghi chú đã thêm vào Topic 8/9.
- Lecture notes Part I có hai lỗi chính tả: "det G = det U = 1" (phải là A) và "determinat".

## Hình nên bổ sung sau (nền tảng chưa vẽ được hình trong bài)

Part II: eˣ và ln x đối xứng qua y = x · sigmoid với ngưỡng 0.8 và σ′ · tiếp tuyến/cát tuyến của x² tại a=1 · gradient descent trên (x−2)² với η = 0.25/0.75/1.25 · đường đồng mức loss của bài khớp đường thẳng.
Part III: cây Bayes với tần suất tự nhiên (10 000 người) · pmf cạnh mật độ mũ có tô diện tích · histogram trung bình mẫu n = 1, 5, 25 · 20 khoảng tin cậy mô phỏng · scatter Y = |X| (tương quan 0 nhưng phụ thuộc).

## Giới hạn đã biết của nền tảng

- Importer chỉ có khối mã ```html + `<pre><code>`; chưa có fenced code chung. Mã Python trong bài dùng cách đó (hiển thị đúng, cuộn ngang).
- `fill_in` so khớp chính xác sau khi cắt khoảng trắng + chữ thường, nên mỗi câu liệt kê sẵn các cách viết chấp nhận được (0.25 / 1/4 / 25%…).
- Nhãn do importer chèn (Learning objectives, Summary, Key idea/Common pitfall, "45 min"…) nay theo `course.language` (`en` có bảng riêng, ngôn ngữ khác về tiếng Việt như cũ).

## Cách dựng lại / nhập

```bash
node docs/hoc-lieu/mathematical-foundations-for-data-science/build.mjs            # ghép course.json + parts/part-{1,2,3}.json + final.json → khoa-mathematical-foundations.json
pnpm import:course -- --file ../../docs/hoc-lieu/mathematical-foundations-for-data-science/khoa-mathematical-foundations.json --owner <email> --dry-run
pnpm import:course -- --file ../../docs/hoc-lieu/mathematical-foundations-for-data-science/khoa-mathematical-foundations.json --owner <email> [--replace]
# 9 PDF (mỗi Part: Lecture notes, slide, bộ 50 câu) gắn vào bài "Part N materials":
pnpm --filter @feedbackme/core-lms attach:pdf --course mathematical-foundations-for-data-science --lesson "Part I materials" \
  --owner <email> --file "<pdf>" --title "Lecture notes (PDF)"
```

`parts/*.json` và `final.json` là nguồn sửa tay (mỗi tệp: `module` + `misconceptions` + `feedbackTemplates`); `khoa-mathematical-foundations.json` là bản ghép, sinh lại bằng `build.mjs`
(build kiểm trùng mã lỗi / khoá câu hỏi và mã lỗi chưa khai báo).
Lên prod: dùng biến thể `import:course:prod` (đường hầm SSH), rồi chép 9 PDF vào volume uploads và gắn bằng `attach:pdf --existing-url`. Khoá nhập ở trạng thái nháp.
