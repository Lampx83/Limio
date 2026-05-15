# Hướng dẫn giảng viên — Module Khảo thí

> Tài liệu vận hành cho instructor sử dụng các tính năng trong section **Khảo thí** (left menu). Cập nhật theo phase: hiện tại P0–P2 đã sẵn sàng; P3 (proctoring strict, LLM grading) trong roadmap.

## 1. Tổng quan section "Khảo thí"

| Mục | Đường dẫn | Mô tả |
|---|---|---|
| **Đề thi** | `/instructor/exams` | Danh sách bài thi của bạn (tất cả khóa). Lọc theo trạng thái Nháp / Đã publish / Lưu trữ. |
| **Ngân hàng câu hỏi** | `/instructor/question-banks` | Hub ngân hàng câu hỏi — quản lý bank, thêm câu, tag skill, publish/archive. |
| **Chấm tự luận** | `/instructor/grade-essays` | Hàng đợi câu hỏi essay/short_answer cần chấm tay. |
| **Ca thi trực tiếp** | _Soon_ | Hub cross-exam liệt kê các ca thi đang chạy (đang phát triển). Tạm thời mở từng exam → tab **🔴 Live monitor**. |
| **Phân tích item** | _Soon_ | Cross-exam analytics (đang phát triển). Tạm thời mở từng exam → tab **📊 Item Analytics**. |

## 2. Tạo và publish bài thi (P0)

1. Vào course → **Bài thi** → **+ Tạo bài thi**.
2. Điền meta: tiêu đề, mô tả, thời lượng (`durationMin`), `openAt`/`closeAt`, điểm đạt (`passScore`), chính sách attempt (single / multiple), chế độ chấm (`auto` / `manual` / `mixed`).
3. **Thêm nội dung** (tab Nội dung bài thi):
    - Tạo đoạn bài đọc (passage) nếu cần — gắn skill cho passage.
    - Thêm câu hỏi: 6 loại (mcq, multi, short_answer, essay, true_false, fill_blank). Mỗi câu phải tag **≥ 1 skill** trước khi publish (CLAUDE.md §5.3 — tag skill bắt buộc).
4. **Section** (tùy chọn — random pool): tab Section → tạo section với `selectionMode: random_pool` + filter difficulty/skill/bank → seed deterministic theo (examId + subject + sectionId).
5. **Access mode** (tab Access):
    - `signed_in`: chỉ user đã đăng nhập course.
    - `open_code`: 6 ký tự, anonymous, ai có code đều thi được — nhập `displayName` + `phone` + `email` để định danh.
    - `assigned_code`: 8 ký tự per-candidate — instructor upload danh sách candidates trước (tab Candidates), hệ thống sinh code và gửi email qua Resend.
6. **Cohort & Schedule** (tab Schedules): gán cohort vào schedule với window thời gian + IP allowlist (tùy). Cohort-specific schedule override schedule course-wide.
7. **Publish**: nhấn Publish ở header. Sau publish + có lượt thi đầu tiên, các field `durationMin / openAt / passScore / proctoring / shuffle / showResults / attemptPolicy / gradingMode` sẽ khoá — chỉ title/description/closeAt còn sửa được.

## 3. Ngân hàng câu hỏi (P2)

- Mỗi bank thuộc một subject (mặc định "Đại số cơ bản" — sẽ multi-subject ở P3).
- Workflow: **Tạo bank** → **Thêm câu hỏi** (type + prompt + config + skill) → **Publish** (cần ≥1 skill) → **Reuse** trong exam qua tab Section selection mode `from_bank` hoặc copy thẳng vào exam.
- **Version snapshot**: mỗi lần edit câu hỏi bank đã publish → tạo `BankQuestionVersion` mới (immutable). Exam đã copy giữ snapshot cũ, không bị ảnh hưởng khi bank sửa sau đó.
- Archive câu hỏi không xóa khỏi exam đã dùng (FK protect).

## 4. Cohort & Schedule (P2)

- Cohort = nhóm SV trong một course. Vào `/instructor/courses/[id]/cohorts` để tạo + assign member.
- Mỗi exam có thể có nhiều schedule. Priority resolution:
    1. Schedule cho **cohort cụ thể** mà candidate thuộc.
    2. Schedule **course-wide** (không gán cohort).
    3. Window mặc định của exam (`openAt` / `closeAt`).
- IP allowlist (mảng CIDR) — nếu set, IP của candidate phải match khi `claim-code`.

## 5. Giám sát ca thi (P0/P1 — Live Monitor)

Từ exam edit page → **🔴 Live monitor** (chỉ hiện khi status=published).

- **Dot grid**: hàng = candidate, cột = câu hỏi. Màu:
    - Xám: chưa trả lời
    - Xanh: đã trả lời
    - Xanh đậm: đã chấm đúng (auto)
    - Đỏ: bị flag (paste flood / tab blur / heartbeat lost)
- **Status badges**: in_progress / submitted / auto_submitted / disqualified.
- **Drill-down**: click row → timeline của candidate (answer save, heartbeat, fullscreen exit, paste event).
- **Actions**:
    - **Pause**: tạm khoá attempt (candidate thấy banner đợi).
    - **Extend time**: cộng phút vào `endsAt`.
    - **Force submit**: chấp nhận current state.
    - **Disqualify**: đóng attempt + status=disqualified.
- **Heartbeat detector**: cron `*/2 * * * *` quét attempt mất heartbeat ≥3 phút → flag trên dashboard.

## 6. Chấm bài (P0 — Grading)

- Hàng đợi: section **Chấm tự luận** hoặc nút "Chấm bài" (có badge số câu chờ) trên exam header.
- Auto-score chạy ngay khi candidate submit; chỉ essay / short_answer cần chấm tay.
- Có thể override điểm auto bằng `manualScore` (audit log lưu lại).
- Sau khi chấm xong, `ExamAttempt.score` + `scorePct` recompute; nếu publish kết quả thì candidate nhận email link result-lookup (open mode) hoặc thấy ngay (signed-in mode).

## 7. Item Analytics (P2.5 — T5)

Vào exam edit page → kéo xuống panel **📊 Item Analytics**.

- **P-value** (độ khó): tỉ lệ candidate trả lời đúng. Càng cao càng dễ.
    - `< 0.20` → **Quá khó** (đỏ)
    - `> 0.95` → **Quá dễ** (vàng)
    - Sentinel `—` khi attempt < 5.
- **Discrimination** (point-biserial): tương quan giữa "trả lời đúng câu này" và "tổng điểm cao". Đo lường khả năng phân biệt SV giỏi/yếu.
    - `< 0.10` → **Phân biệt yếu** (đỏ)
    - `> 0.30` → tốt (xanh)
- **Distractor stats** (MCQ/multi): số candidate chọn từng option. Distractor mà 0 ai chọn → option đó vô dụng, nên thay.
- **Filter "Lọc cờ"**: chỉ hiện câu bị flag (≥ 1 trong 3 cờ).
- Recompute: cron 02:00 daily; cần ≥ 5 attempt mới compute (tránh noise).

## 8. Code-based exam — 2 luồng anonymous (P1)

### 8.1. Open code

Bài thi mở (test thử, kiểm tra đầu vào, mini contest):
1. Tạo exam → access mode `open_code` → hệ thống sinh code 6 ký tự (`LOAD01`, `MATH24`, ...).
2. Share URL `/exam/[code]` cho candidate. Họ nhập `displayName`, `phone`, `email` → claim → vào `/exam-take/[attemptId]`.
3. Cùng (`openCode`, `phone`) chỉ tạo 1 attempt (deduplicate). Nếu candidate đóng tab → re-mở URL + nhập lại cùng phone → resume attempt cũ.
4. Cap: `openMaxAttempts` (mặc định 50 — chỉnh trong tab Access).

### 8.2. Assigned code

Bài thi định danh (cuối kỳ, certification):
1. Tab **Candidates** → upload CSV/Excel danh sách (cột: displayName, email, studentCode, class).
2. Hệ thống sinh code 8 ký tự per-candidate → gửi email tự động qua Resend (template VN). Nếu Resend chưa cấu hình, code log ra console dev.
3. Candidate nhận email → click link `/exam/[code]` → đã có thông tin → confirm displayName (không sửa được tên) → vào thi.
4. Lost code: tra cứu `/exam/[code]/result` bằng (email + studentCode) — kèm rate limit chống brute-force.

## 9. GDPR Export (P2)

- Tab Candidates → nút **Export data** (per candidate): trả về JSON gồm attempt, answers, audit log liên quan tới candidate đó.
- Delete API: **tạm dừng** theo decision của owner (CLAUDE.md §5.4 vẫn đề cập GDPR — nhưng spec hiện tại không có delete để giữ audit trail thi cử).

## 10. Tips vận hành

- **Trước publish**: dry-run với account demo Bob để chắc chắn shuffle/timer/section render đúng.
- **Trong ca thi**: mở Live monitor ở 1 tab + Grading queue ở tab khác.
- **Sau ca thi**: chấm tay essay → xác nhận score → release kết quả → review Item Analytics (chờ nightly cron 02:00 hoặc trigger manual qua `/api/cron/exam-analytics` với CRON_SECRET).
- **Rotate openCode** nếu bị leak: edit exam → access tab → regenerate (attempt cũ vẫn giữ snapshot, không bị mất).

## Tham chiếu

- Spec gốc: `docs/SPEC.docx` §A5 (Exam) + §A7 (Exam P0 acceptance — `docs/A7-exam-P0-acceptance.md`).
- Plan triển khai: `docs/PLAN-A5.md`.
- Load test: `scripts/loadtest/README.md`.
