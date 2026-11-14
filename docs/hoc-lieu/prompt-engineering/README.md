# Khoá "Prompt Engineering" (Micro4Asia, tiếng Anh, 14 buổi)

> Trạng thái (13/11/2026): **đã nhập prod ở trạng thái nháp** (slug `prompt-engineering`), chưa xuất bản, chưa gán tổ chức NEU.
> Nguồn: bộ tài liệu của giảng viên (`Micro4Aisa_Prompt Engineering/`: đề cương v1.5, lecture notes v1.4, 150 MCQ v1.0, 2 bộ slide, 3 activity sheet Student + Instructor, CSV bán lẻ 200 giao dịch).
> Khung giống các khoá M4A khác (xem `mathematical-foundations-for-data-science/`).

## Cấu trúc

| Module | Bài | Ghi chú |
|---|---|---|
| Start here | Course Syllabus, Course Overview | đề cương tóm tắt trung thực; mục "TBC" của đề cương ghi đúng là chưa xác định |
| Module 1 (P1–3) | "Module 1 materials" + Period 1–3 | chatbot, giới hạn, định nghĩa tác vụ |
| Module 2 (P4–6) | "Module 2 materials" + Period 4–6 | cấu trúc prompt, follow-up, chiến lược |
| Module 3 (P7–9) | "Module 3 materials" + Period 7–9 | Activity 1 (P7), Activity 2 (P8) là bài tập nộp |
| Module 4 (P10–12) | "Module 4 materials" + Period 10–12 | Case 2; Activity 3 (P12) là bài tập nộp |
| Module 5 (P13–14) | "Module 5 materials" + Period 13–14 | quyền riêng tư, tài liệu hoá, tái lập |
| Integrated final assessment | 1 bài, 13 câu tình huống | **bản nháp để duyệt**: đề cương chưa xác định bài cuối, ngưỡng đạt, trọng số |

Tổng: 7 module, 22 bài, **205 câu hỏi** (150 MCQ gốc đủ một lần, đáp án khớp bản gốc; 42 câu mới 3/Period; 13 câu cuối khoá), 103 lỗi tư duy + 103 mẫu phản hồi, 3 bài tập, 31 khối đính kèm.

Phiên bản chữ: chính tả Anh-Anh. 150 MCQ chỉ đổi chính tả Mỹ → Anh (colorful → colourful…), không đổi nghĩa hay đáp án.

## Dựng lại / nhập

```bash
node docs/hoc-lieu/prompt-engineering/build.mjs        # ghép course.json + start.json + parts/part-{1..5}.json + final.json → khoa-prompt-engineering.json
cd packages/core-lms
pnpm import:course -- --file ../../docs/hoc-lieu/prompt-engineering/khoa-prompt-engineering.json --owner <email> --dry-run
pnpm import:course -- --file ../../docs/hoc-lieu/prompt-engineering/khoa-prompt-engineering.json --owner <email>
# đính kèm (đề cương, notes, 2 bộ slide, 3 activity Student, CSV) — xem đầu apps/web/scripts/attach-pe-materials.ts
pnpm --filter @feedbackme/web exec tsx scripts/attach-pe-materials.ts <materials-dir> [--url-map map.json]
```

`build.mjs` thêm khối ```` ```prompt Tiêu đề ```` (prompt mẫu, trả lời mẫu của AI) → đổi thành hộp có khung khi ghép.
Lên prod: `import:course:prod` qua đường hầm SSH (xem đầu `import-course.ts`), tải các tệp lên S3 rồi chạy script đính kèm với `--url-map`.

`AUTHORING.md` là hướng dẫn đã dùng để soạn từng phần (đường dẫn `SRC` trong đó là thư mục tạm của phiên soạn).

## Tệp đính kèm

PDF chuyển từ DOCX bằng LibreOffice: đề cương (3 tr.), lecture notes (79 tr.), 3 activity sheet bản **Student**. Hai bộ slide dùng nguyên PDF gốc.
Bản Instructor của activity (đáp án / hướng dẫn chấm) **không** đính kèm và không được chép vào chỗ người học nhìn thấy.

## Cần giảng viên xác nhận

- Bài cuối tích hợp: 13 câu do hệ thống soạn thêm; đề cương ghi "to be specified". Điều kiện đạt/trọng số chưa công bố — bài chỉ nêu điều đó.
- Mã môn, giờ tự học, PLO, trọng số các phần đánh giá: đề cương ghi TBC.
- Hai bộ rubric khác nhau cho Activity 2 (notes §8.5 so với slide 84/activity sheet): bài dạy theo bản của activity sheet.
- Trang slide 81 trang của từng Period được suy từ chân trang (bản trích text không có số cho trang mở module).
- PE119 ("Named owner, inputs and deadline") hơi lệch với notes (kế hoạch không nên nêu thời hạn cố định); PE099 phương án B là một khẳng định sai về sự kiện (CSV có `Discount_Amount`).
- Notes ghi chú hình có trang slide lệch 1 (Figure 1, 2 của Period 1; Figure 4 của Period 6).
- Ví dụ trên slide 25 ghi "West … 260,026.33" nhưng đó là tổng của North (dùng làm bài "Find the error").
- Hình minh hoạ (biểu đồ, ảnh chụp) chưa có trong bài; mô tả bằng chữ và prompt mẫu.
