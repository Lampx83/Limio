# A7 — Exam Module (P0) — Acceptance Criteria

> **ID note**: ban đầu dự định A4 nhưng A4 đã là Quiz trong schema. Module Exam đổi thành **A7** (A5=Assignment, A6=Forum đã dùng).

> Given-When-Then checklist cho phase MVP của module thi trực tuyến. Mỗi mục là điều kiện **phải pass** trước khi feature được coi là done. Tag feature ID khi commit (vd. `feat(A7.2): exam authoring UI`).

Sub-features:

- **A7.1** Exam CRUD (instructor)
- **A7.2** Passage authoring (text + image, audio policy config)
- **A7.3** Question authoring & skill tagging
- **A7.4** Learner exam runtime (2-cột UI, timer, autosave)
- **A7.5** Submission & auto-grading
- **A7.6** Manual grading (ESSAY/SHORT)
- **A7.7** Event emission & incident logging
- **A7.8** Anti-cheat cơ bản

---

## A7.1 — Exam CRUD (instructor)

### A7.1.1 Tạo exam
- **Given** instructor đã đăng nhập và là owner của course X
- **When** gọi `POST /api/courses/:courseId/exams` với `{title, durationMin, openAt, closeAt, attemptPolicy, gradingMode, passScore, proctoringLevel}`
- **Then** tạo bản ghi `Exam` ở trạng thái `DRAFT`, emit `exam.created`, trả về `examId`

### A7.1.2 Validation publish-time
- **Given** exam ở `DRAFT`, có ≥ 1 passage và ≥ 1 question
- **When** instructor bấm Publish
- **Then** server kiểm tra: (a) mọi question có tag ≥ 1 skill, (b) mọi passage có ≥ 1 question, (c) `openAt < closeAt`, (d) `durationMin > 0`, (e) tổng `points` > 0. Nếu fail → trả 422 với danh sách lỗi. Nếu pass → set status `PUBLISHED`, emit `exam.published`.

### A7.1.3 Không cho sửa exam đang có attempt
- **Given** exam đã `PUBLISHED` và có ≥ 1 `ExamAttempt` ở trạng thái `IN_PROGRESS` hoặc `SUBMITTED`
- **When** instructor cố PATCH passage/question/duration
- **Then** trả 409 Conflict. Chỉ cho phép chỉnh `closeAt` (kéo dài) và metadata (title, description).

### A7.1.4 Authorization
- **Given** user không phải instructor của course
- **When** gọi bất kỳ endpoint CRUD nào của exam thuộc course đó
- **Then** trả 403.

---

## A7.2 — Passage authoring

### A7.2.1 Tạo passage
- **Given** instructor đang ở editor của exam DRAFT
- **When** thêm passage với `{title, contentJson (Tiptap doc), orderIndex, audioPolicy, maxAudioPlays, revealMode, skillTags[]}`
- **Then** tạo `ExamPassage`, content lưu dạng JSON structured (không HTML thô). UI hiển thị passage trong list theo `orderIndex`.

### A7.2.2 Upload image trong passage
- **Given** instructor đang soạn passage
- **When** upload ảnh (≤ 5MB, mime image/*)
- **Then** tạo `ExamAsset` type=IMAGE, upload lên S3/R2, trả signed URL, chèn node image vào `contentJson` với `assetId`. Alt text **bắt buộc** — nếu trống → block save passage.

### A7.2.3 Cấu hình audio policy (UI sẵn, runtime ở P1)
- **Given** instructor đang soạn passage
- **When** chọn dropdown audio policy
- **Then** UI cho phép chọn `FREE_REPLAY | LIMITED_REPLAY | ONCE_ONLY`. Nếu LIMITED → hiện input `maxAudioPlays` (1–10). Lưu vào `ExamPassage`. **P0 không upload audio thực**, chỉ persist config.

### A7.2.4 Reorder & delete passage
- **Given** exam DRAFT
- **When** instructor kéo thả đổi `orderIndex` hoặc xoá passage
- **Then** cập nhật DB; nếu xoá passage còn questions → confirm dialog "Xoá X câu hỏi gắn với passage này?". Hard delete (passage chưa publish chưa có attempt).

---

## A7.3 — Question authoring & skill tagging

### A7.3.1 Tạo question gắn passage
- **Given** passage đã tồn tại trong exam
- **When** instructor thêm question với `{type, prompt, options?, correctAnswer, points, skillTags[], passageId, orderInPassage}`
- **Then** tạo `ExamQuestion`, validate theo type (MCQ phải có ≥ 2 options + 1 correct; TRUE_FALSE_NOTGIVEN có đúng 3 options cố định; GAP_FILL có `acceptedAnswers[]`; ESSAY/SHORT không cần correctAnswer auto).

### A7.3.2 Question độc lập (không gắn passage)
- **Given** instructor muốn câu hỏi standalone
- **When** tạo question với `passageId = null`
- **Then** chấp nhận, hiển thị riêng ở section "Câu hỏi độc lập" trong UI learner.

### A7.3.3 Bắt buộc tag skill (§5 nguyên tắc 3)
- **Given** question ở DRAFT
- **When** save question với `skillTags = []`
- **Then** UI cho phép save tạm, nhưng publish-time validation (A7.1.2) sẽ reject. Hiển thị warning icon trên question card.

### A7.3.4 Preview side-by-side
- **Given** instructor đang ở question editor
- **When** bấm Preview
- **Then** mở modal hiển thị đúng UI learner sẽ thấy (passage trái + question phải), không lưu state.

---

## A7.4 — Learner exam runtime

### A7.4.1 Start attempt
- **Given** learner đã enroll course, exam ở `PUBLISHED`, hiện trong `[openAt, closeAt]`, learner chưa có attempt active
- **When** gọi `POST /api/exams/:examId/attempts`
- **Then** tạo `ExamAttempt` status=`IN_PROGRESS`, `startedAt = now()`, lock attempt bằng session token. Emit `exam.started`. Nếu `attemptPolicy=SINGLE` và đã có attempt cũ submitted → trả 409.

### A7.4.2 UI 2 cột
- **Given** learner vào trang làm bài, attempt IN_PROGRESS
- **When** màn hình ≥ 1024px
- **Then** hiển thị split view: trái passage (sticky, scroll độc lập), phải questions của passage. Trên mobile (< 768px) → tab switch giữa "Bài đọc" và "Câu hỏi". Câu hỏi standalone hiển thị ở cuối, không split.

### A7.4.3 Server-authoritative timer
- **Given** attempt đã start với `durationMin = D`
- **When** client load trang
- **Then** server trả `serverNow` + `startedAt` + `durationSec = D*60`. Client tính remaining = `startedAt + durationSec - serverNow`. UI hiển thị countdown. Khi remaining ≤ 0 → tự gọi submit. Client clock không được tin.

### A7.4.4 Autosave
- **Given** learner đang trả lời question Q
- **When** thay đổi answer
- **Then** debounce 2s rồi `PATCH /api/attempts/:id/answers/:qid` với `{answerJson}`. Upsert vào `ExamAnswer`. Emit `exam.question.answered` + `exam.autosaved`. UI hiển thị "Đã lưu" với timestamp.

### A7.4.5 Resume sau khi mất kết nối
- **Given** learner đóng tab / mất mạng giữa chừng, attempt vẫn IN_PROGRESS, chưa hết `durationSec`
- **When** learner mở lại exam URL
- **Then** server load lại tất cả `ExamAnswer` đã autosave, tính lại remaining theo `startedAt`, learner tiếp tục từ đúng vị trí. Đếm số lần resume vào `ExamAttempt.resumeCount` (analytics).

### A7.4.6 Highlight & note (localStorage)
- **Given** learner đang đọc passage
- **When** bôi text và bấm highlight, hoặc gõ note vào sidebar
- **Then** lưu vào `localStorage` key `exam:{attemptId}:passage:{passageId}`. Không gửi server. Hiển thị banner "Ghi chú chỉ lưu trên thiết bị này". Khi submit → clear localStorage của attempt đó.

### A7.4.7 Single-tab lock
- **Given** learner đã có attempt IN_PROGRESS ở tab/thiết bị A
- **When** mở exam URL ở tab/thiết bị B
- **Then** tab B hiển thị "Đang thi ở thiết bị khác", không cho làm bài. Dùng BroadcastChannel (cùng browser) + server session token check (khác browser).

---

## A7.5 — Submission & auto-grading

### A7.5.1 Submit thủ công
- **Given** learner đã trả lời ≥ 0 câu, attempt IN_PROGRESS
- **When** bấm Submit và confirm
- **Then** set `submittedAt = now()`, status = `SUBMITTED`, chạy auto-grading inline, emit `exam.submitted`.

### A7.5.2 Auto-submit khi hết giờ
- **Given** attempt IN_PROGRESS quá `startedAt + durationSec`
- **When** BullMQ job `exam-autosubmit` chạy (mỗi phút) hoặc client phát hiện hết giờ
- **Then** set status = `AUTO_SUBMITTED`, chạy auto-grading, emit `exam.auto_submitted`. Idempotent: gọi 2 lần không double-grade.

### A7.5.3 Auto-grade rules
- **Given** attempt SUBMITTED/AUTO_SUBMITTED
- **When** chạy grading
- **Then**:
  - MCQ/MULTI: so sánh set answer với set correct → exact match = full points, không match = 0 (no partial credit ở P0)
  - TRUE_FALSE_NOTGIVEN: exact match
  - GAP_FILL: so sánh với `acceptedAnswers[]`, mode EXACT hoặc CASE_INSENSITIVE
  - ESSAY/SHORT: `autoScore = null`, đẩy vào hàng chờ manual grade
- Tính `score` = sum(autoScore + manualScore), nếu còn câu chưa grade → status vẫn `SUBMITTED`, không tính passed/failed. Khi tất cả grade xong → emit `exam.graded`.

### A7.5.4 Learner xem kết quả
- **Given** attempt đã `GRADED` (mọi câu chấm xong) và `exam.showResultsAfterSubmit = true`
- **When** learner mở trang result
- **Then** hiển thị tổng điểm, pass/fail theo `passScore`, breakdown từng câu (correct/incorrect + đáp án đúng nếu instructor bật). Trước khi GRADED → hiển thị "Đang chấm".

---

## A7.6 — Manual grading (ESSAY/SHORT)

### A7.6.1 Inbox chấm tay
- **Given** instructor đăng nhập, có exam có submission chứa ESSAY/SHORT
- **When** vào trang "Cần chấm"
- **Then** hiển thị list các answer chưa `manualScore`, sắp xếp theo `submittedAt` cũ nhất trước.

### A7.6.2 Chấm 1 câu
- **Given** instructor mở answer cần chấm
- **When** nhập `manualScore` (0 ≤ x ≤ `question.points`) + comment optional
- **Then** lưu vào `ExamAnswer.manualScore`, `gradedBy`, `gradedAt`. Nếu đây là câu cuối cùng của attempt → cập nhật `ExamAttempt.score` + status = `GRADED`, emit `exam.graded`.

### A7.6.3 Regrade
- **Given** answer đã có `manualScore`
- **When** instructor sửa điểm
- **Then** cập nhật, emit `exam.regraded` với `{old, new, reason}`. Audit trail giữ history (bảng `ExamGradeHistory` hoặc trong event payload).

---

## A7.7 — Event emission & incident logging

### A7.7.1 Event coverage
Mọi action sau phải emit `LearningEvent` cùng transaction (§5 nguyên tắc 1):

| Action | Event type |
|---|---|
| Tạo/publish exam | `exam.created`, `exam.published` |
| Start attempt | `exam.started` |
| Mỗi lần autosave answer | `exam.question.answered`, `exam.autosaved` |
| Submit | `exam.submitted` hoặc `exam.auto_submitted` |
| Auto-grade xong | `exam.graded` |
| Manual regrade | `exam.regraded` |
| Incident | `exam.incident.flagged` |

### A7.7.2 Idempotency
- **Given** cùng một autosave request gửi lại do retry
- **When** server xử lý
- **Then** không tạo duplicate event/answer. Dùng `(attemptId, questionId, answerHash)` làm dedup key.

### A7.7.3 Incident logging
- **Given** learner đang trong attempt IN_PROGRESS
- **When** xảy ra: tab blur, fullscreen exit, paste vào answer field, network lost > 30s, multi-tab detected
- **Then** ghi `ExamIncident` (append-only) + emit `exam.incident.flagged`. **Không** auto-disqualify — chỉ flag để instructor review tay.

---

## A7.8 — Anti-cheat cơ bản

### A7.8.1 Shuffle questions & options
- **Given** exam có `shuffleQuestions = true`
- **When** learner load exam
- **Then** thứ tự question (trong cùng passage) và options của MCQ/MULTI được shuffle deterministic theo `(attemptId, questionId)` — cùng attempt load lại vẫn ra thứ tự cũ, attempt khác ra thứ tự khác.

### A7.8.2 Single attempt enforcement
- **Given** `exam.attemptPolicy = SINGLE`
- **When** learner đã có attempt SUBMITTED/AUTO_SUBMITTED/GRADED
- **Then** không cho tạo attempt mới. UI ẩn nút Start, server trả 409.

### A7.8.3 Fullscreen mode (soft)
- **Given** `proctoringLevel != NONE`
- **When** learner bấm Start
- **Then** prompt browser fullscreen API. Nếu learner exit fullscreen → ghi incident `FULLSCREEN_EXIT`, hiển thị banner "Vui lòng quay lại fullscreen". Không kick out (UX guard, không phải enforcement cứng).

### A7.8.4 Paste detection
- **Given** learner đang nhập answer vào ESSAY/SHORT
- **When** dùng Ctrl+V hoặc paste menu
- **Then** ghi incident `PASTE` với độ dài chuỗi paste. Vẫn cho phép paste (không block — tránh false positive với người dùng password manager / autocomplete).

---

## Out of scope (đẩy P1+)

- Audio upload + play-count enforce + ONCE_ONLY runtime
- MATCHING_HEADING question type
- Fuzzy SHORT answer + LLM accept-list suggester
- Webcam snapshot proctoring
- Video stimulus
- Sequential reveal
- LLM essay rubric grading
- Certificate generation
- Plagiarism check
- Question bank / question reuse across exams
- Partial credit cho MULTI

---

## Định nghĩa "Done" cho A4 P0

- [ ] Tất cả AC trên có test pass (unit + integration)
- [ ] Schema migration apply sạch trên DB rỗng + DB seed
- [ ] Event emit kiểm tra qua integration test (mỗi event type ≥ 1 test)
- [ ] Instructor có thể tạo 1 exam IELTS-style hoàn chỉnh (1 passage text+image, 5 questions mix MCQ/TF_NG/GAP_FILL/ESSAY) và publish
- [ ] Learner có thể làm bài → submit → xem kết quả (sau khi instructor chấm essay)
- [ ] Mất mạng giữa chừng resume được, không mất answer
- [ ] Auto-submit khi hết giờ chạy đúng qua BullMQ
- [ ] Mọi endpoint check authorization (instructor vs learner vs guest)
