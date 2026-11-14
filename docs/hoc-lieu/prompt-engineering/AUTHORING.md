# Hướng dẫn soạn phần của khoá "Prompt Engineering" (Micro4Asia, tiếng Anh)

Khoá dựng từ tài liệu của giảng viên, theo **cùng khung với khoá Mathematical Foundations for Data Science**
(`docs/hoc-lieu/mathematical-foundations-for-data-science/` — đọc `README.md`, `parts/part-1.json` làm mẫu về giọng văn,
bố cục bài và cách gắn lỗi tư duy). Mỗi agent soạn **một file JSON của riêng mình**; `build.mjs` ghép lại.

## Nguồn (chỉ đọc) — thư mục `SRC`
`/private/tmp/claude-501/-Users-mac-Documents-Code-Limio/cf11ca4c-5d88-4a04-829e-381282b2c275/scratchpad/pe/`

| File | Nội dung |
|---|---|
| `src/notes-pNN.md` | Lecture notes của Period NN (14 file) · `src/notes-intro.md` mở đầu giáo trình |
| `src/mcq-pNN.json` | Các MCQ gốc của Period NN: `id, text, level, related, choices ("A. …\nB. …"), correct, feedback` |
| `syllabus.md` | Đề cương (mục tiêu CLO1–6, đánh giá, kế hoạch 14 buổi) |
| `Activity_0N_*_Student.md` / `*_Instructor.md` | 3 hoạt động. **Student** là nội dung cho người học. **Instructor là đáp án/hướng dẫn chấm: chỉ dùng để kiểm chứng, TUYỆT ĐỐI không chép đáp án vào chỗ người học nhìn thấy** |
| `slides150.txt`, `slides81.txt` | Chữ trích từ hai bộ slide (150 slide đầy đủ; 81 slide bản ngắn) |
| `/Users/mac/Downloads/Micro4Aisa_Prompt Engineering/Practice cases/Slidescope_Retail_Store_Sales_Enhanced_2025.csv` | CSV 200 giao dịch dùng cho Case 1 và Case 2. Số liệu viết vào bài phải **tính lại từ file này** (pandas), không chép mù từ notes |

## Khung khoá
- 14 Period. Mỗi Period là **một bài**: tiêu đề `Period N · <tên trong đề cương>`; `durationMin` 45.
- Module 1 (P1–3) "Module 1 — AI Chatbots and Task Definition" · Module 2 (P4–6) "Module 2 — Design: Prompts and Prompting Strategies" ·
  Module 3 (P7–9) "Module 3 — Execute: Apply, Compare and Automate" · Module 4 (P10–12) "Module 4 — Prompting for Data-Driven Problem Solving" ·
  Module 5 (P13–14) "Module 5 — Privacy, Security, Documentation and Reproducibility".
- Mỗi module mở bằng bài **"Module N materials: …"** (6 phút, không quiz): các file đính kèm là gì, phần nào của file ứng với Period nào, cách học.
  File đính kèm (gắn sau bằng script, bạn chỉ MÔ TẢ): lecture notes (.docx, toàn khoá), slide 150 trang (PDF), slide 81 trang bản ngắn (PDF), 3 activity sheet bản Student (.docx), CSV.
  Trang slide ứng với từng Period: lấy từ cột `related` của MCQ ("Period 05, slide 63: …") và `slides150.txt`.
- Palette: M1 `limio`, M2 `forest`, M3 `sunset`, M4 `vibrant`, M5 `paper`; font `modern`.
- Ngôn ngữ: tiếng Anh, chính tả **Anh-Anh** (visualisation, organise) như tài liệu gốc. Không emoji. Văn phong rõ, ngắn, xưng "you".
- Khoá **không dạy lập trình**; không bịa tính năng của công cụ AI. Nói theo kiểu "an AI chatbot with file-analysis and chart capabilities where available".

## Định dạng một file `parts/part-N.json`
```json
{ "module": { "title": "...", "description": "...", "lessons": [ <lesson>, ... ] },
  "misconceptions": [ { "code": "pe.p04.xxx", "name": "...", "description": "..." } ],
  "feedbackTemplates": [ { "misconception": "pe.p04.xxx", "body": "...", "priority": 10 } ] }
```
Viết bằng Python (`json.dump(..., ensure_ascii=False, indent=2)`) để JSON luôn hợp lệ.

### Lesson (xem `packages/core-lms/scripts/import-course.ts`, `LessonSpec`, nếu cần chi tiết)
`title, durationMin, description, look{palette,font}, objectivesLead:"By the end of this period you can:", objectives[4–6 câu, động từ hành vi quan sát được],
body (markdown), sections[] (tuỳ chọn: layout text|cards|compare|steps|faq|stats), flashcards{title, items[{term,meaning,example?}] 6–10 thẻ}, summary[3–4 ý], quiz{...}`, và `assignments[]` nếu được giao.

**Markdown trong `body` / `parts[].md` / `outro`:** `##` mục cấp 2 (có mục lục khi ≥4 mục), `###`, bảng `| a | b |`, danh sách, **đậm**, *nghiêng*, `code`;
callout `> [!ghi-nho] …` (Key idea), `> [!canh-bao] …` (Common pitfall), `> [!meo] …` (Tip), `> [!vi-du] …` (Example);
khối gấp `:::Tiêu đề\nnội dung\n:::` (dùng cho "Predict before you read", "Open the solution after you have tried", "Find the error");
**prompt mẫu**: 
````
```prompt Tiêu đề nhãn (vd. Prompt A — weak)
nội dung prompt, giữ nguyên xuống dòng
```
````
(build.mjs đổi khối này thành hộp có khung — dùng cho MỌI prompt và câu trả lời mẫu của AI). Không dùng LaTeX. Không HTML thô.

**Thân bài nên có:** mở bằng tình huống bán lẻ cụ thể; dạy đúng các mục `X.1, X.2…` của Period trong notes, nhưng viết lại cho dễ học
(không chép nguyên văn dài); ít nhất một "Predict before you read" hoặc "Find the error" gấp được; ít nhất 2 callout; mỗi prompt mẫu đi kèm
**nhận xét vì sao tốt/chưa tốt**; mục "Check it yourself" nói rõ phải kiểm lại số/khẳng định nào bằng CSV hoặc bảng tính.

### Quiz
```json
"quiz": { "title": "Quiz · Period N", "passThresholdPct": 70, "requireConfidence": true, "questions": [ ... ] }
```
1. **Mọi MCQ gốc của Period đó phải có mặt ĐÚNG MỘT LẦN**, giữ nguyên nội dung đề và 4 phương án (có thể sửa lỗi chính tả/định dạng nhỏ; không đổi nghĩa; không đổi đáp án).
   `key` = `pe.pNN.<id viết thường>` (vd `pe.p04.pe031`), `type:"mcq"`. Thứ tự phương án: giữ nguyên.
2. `explanation` = phần "Why" của file gốc, viết lại gọn; thêm 1 câu nói vì sao phương án hay bị chọn nhầm là sai.
3. **Mỗi phương án sai gắn `misconception`** (mã lỗi tư duy). Mỗi Period dùng **4–7 mã**, đặt `pe.pNN.<slug-ngắn>`; một mã dùng lại cho nhiều câu (đó là điểm của nó:
   cùng một kiểu hiểu sai). `name` = một câu ngắn mô tả hành vi sai ("Treats a longer prompt as a better prompt"); `description` = 2–3 câu: người học nghĩ gì, vì sao sai, dấu hiệu nhận ra.
4. Thêm **3 câu mới/Period** (không có trong MCQ gốc), `key` = `pe.pNN.x1..x3`, mỗi câu một dạng khác nhau trong: `true_false` (options Đúng/Sai: "True"/"False"),
   `fill_in` (`answers`: liệt kê mọi cách viết chấp nhận, chữ thường), `ordering` (`sequence` theo thứ tự đúng), `matching` (`pairs`). Câu mới phải kiểm tra điều bài thực sự dạy, có `explanation`.
5. Câu có tính toán dựa trên CSV: thêm `"workOnPaper": true`.

### feedbackTemplates
Mỗi mã lỗi có **ít nhất 1 mẫu**, `priority: 10`. Body 2–4 câu, xưng "you": nói **người học sai ở chỗ nào**, cách tự kiểm tra, và hành động nên làm
(không chỉ nói "wrong"). Không lộ đáp án của một câu cụ thể (mẫu dùng chung cho mọi câu mang mã đó).

### Assignments (chỉ Period 7, 8, 12 — bạn nào được giao thì làm)
```json
"assignments": [ { "title": "...", "description": "<markdown, nội dung Student sheet viết lại để nộp bài>", "responseFormat": "text", "maxScore": 100, "rubricText": "<tiêu chí chấm lấy từ Student sheet, ≤5000 ký tự>", "countsTowardGrade": false } ]
```

## Kiểm tra trước khi báo xong
```bash
node docs/hoc-lieu/prompt-engineering/build.mjs --only N --out /private/tmp/claude-501/-Users-mac-Documents-Code-Limio/cf11ca4c-5d88-4a04-829e-381282b2c275/scratchpad/pe/check-N.json
```
Phải ra "N module, … câu hỏi" **không lỗi** và không cảnh báo "lỗi tư duy chưa có mẫu phản hồi". Tự đếm: số MCQ gốc = số trong `src/mcq-pNN.json`; mọi phương án sai đều có `misconception`;
mỗi bài có đủ objectives/body/flashcards/summary/quiz. Đọc lại 2 bài của chính mình như người học: có chỗ nào mơ hồ, sai số, hay chép nguyên văn dài không.
**Chỉ sửa file của mình.** Không chạm file/thư mục khác trong repo, không `git add/commit`.
