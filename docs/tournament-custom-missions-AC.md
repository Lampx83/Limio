# Tournament Custom Missions — Acceptance Criteria

> Feature ID: **C5.x** (extend Module C — Gamification → Tournament)
> Spec ref: §5.6 (Tournament), §6.1 (event-driven), §5.5 (anti-farming)
> Status: design approved 2026-05-21, awaiting AC sign-off

---

## 1. Mission types & verify modes

### AC-1.1 — Mission type COURSE_LINKED (existing)
- **Given** instructor tạo mission với `missionType = COURSE_LINKED`
- **When** save mission
- **Then** behavior hiện tại không đổi: dùng `conditionType/conditionValue/...` để auto-check qua event analytics.

### AC-1.2 — Mission type CUSTOM
- **Given** instructor chọn `missionType = CUSTOM` + 1 trong 4 `verifyMode`
- **When** save
- **Then** `contentPayload` (markdown/embedded quiz/instructions) lưu vào mission; `lessonId/quizId/conditionType` phải NULL.
- **And** participant thấy mission detail với content payload render được.

### AC-1.3 — Mission type EXTERNAL
- **Given** instructor chọn `missionType = EXTERNAL`
- **When** save
- **Then** `contentPayload` chứa `{ url, instructions }`; verifyMode bắt buộc là AUTO_CHECK hoặc MANUAL_REVIEW (không cho AUTO_GRADE/PEER_REVIEW vì content nằm ngoài).

---

## 2. Verify mode: AUTO_GRADE (inline quiz)

### AC-2.1
- **Given** mission AUTO_GRADE — khi tạo, system tự tạo `Quiz` ẩn với `tournamentMissionId` set, `QuizQuestion` do instructor soạn qua quiz builder hiện có
- **When** user submit answers
- **Then** dùng flow `QuizAttempt` có sẵn để chấm, tạo `MissionSubmission` với `payload = { quizAttemptId }`, `status = PASSED/FAILED` theo `passThreshold`, `finalScore = score/maxScore`, emit `tournament.mission.submitted` + `tournament.mission.verified` cùng tx.
- **And** PASSED ⇒ award XP qua `XpTransaction`, emit `xp.awarded`.
- **And** Quiz với `tournamentMissionId IS NOT NULL` bị filter khỏi mọi listing quiz của course (instructor quiz tab, learner course view, search).

### AC-2.2 — Resubmit
- **Given** đã submit AUTO_GRADE, chưa quá submission deadline
- **When** submit lại
- **Then** update row cũ (`finalScore` overwrite), không tạo row mới. Emit event mới.

### AC-2.3 — Resubmit chặn sau deadline
- **Given** quá `mission.submissionDeadline`
- **When** submit
- **Then** 403, message "Submission deadline đã qua".

---

## 3. Verify mode: AUTO_CHECK (rule-based)

### AC-3.1 — URL pattern
- **Given** mission AUTO_CHECK với `autoCheckRule = { type: "url_pattern", regex: "..." }`
- **When** user submit URL
- **Then** match regex ⇒ PASSED + XP; không match ⇒ FAILED, được resubmit.

### AC-3.2 — Webhook
- **Given** `autoCheckRule = { type: "webhook", endpoint: "..." }`
- **When** user submit proof
- **Then** background job POST endpoint, parse response `{ passed: bool, score?: number }`, update status.
- **And** webhook timeout 10s ⇒ status PENDING, retry 3 lần.

### AC-3.3 — File format
- **Given** `autoCheckRule = { type: "file_format", mime: ["application/pdf"], maxSizeMb: 10 }`
- **When** user upload file
- **Then** validate ngay, PASSED nếu hợp lệ.

---

## 4. Verify mode: PEER_REVIEW

### AC-4.1 — Rubric bắt buộc khi tạo
- **Given** instructor chọn PEER_REVIEW
- **When** save thiếu `rubric` hoặc `rubric` rỗng
- **Then** validation error, không cho save.

### AC-4.2 — `passThreshold` instructor set
- **Given** PEER_REVIEW mission
- **When** instructor không set `passThreshold`
- **Then** validation error (required cho mode này, range 0..1).

### AC-4.3 — Submission
- **Given** user submit PEER_REVIEW
- **When** submit
- **Then** tạo `MissionSubmission` status PENDING, emit `tournament.mission.submitted`. Chưa award XP.

### AC-4.4 — Resubmit chặn khi có review
- **Given** đã submit PEER_REVIEW, đã có ≥1 `MissionReviewAssignment.completedAt`
- **When** submit lại
- **Then** 403, "Đã có review, không thể resubmit". (Khác AC-2.2.)

### AC-4.5 — Random assign reviewer khi submission deadline đóng
- **Given** submission deadline tới
- **When** job `assign-peer-reviewers` chạy
- **Then** với mỗi submission, random pick `peerReviewerCount` reviewer trong số đã submit cùng mission.
- **And** loại trừ self (reviewer ≠ submitter).
- **And** ưu tiên reviewer chưa từng review submission khác nhiều, để cân tải.
- **And** tạo N row `MissionReviewAssignment` với `dueAt = reviewWindowEndAt`, emit `tournament.mission.review.assigned` per row.

### AC-4.6 — Reviewer chấm
- **Given** reviewer mở review queue
- **When** submit `scores` theo rubric criteria + optional comment
- **Then** lưu `MissionReviewAssignment.scores + completedAt`, emit `tournament.mission.reviewed`.
- **And** reviewer không thấy identity của submitter.
- **And** submitter không thấy identity của reviewer.

### AC-4.7 — Close window: tính median + award
- **Given** `reviewWindowEndAt` tới
- **When** job `close-review-window` chạy
- **Then** với mỗi submission:
  - Tính `aggregateScore` per review theo weighted rubric.
  - Lấy median của N aggregate → set `MissionSubmission.finalScore = median`.
  - `finalScore >= passThreshold` ⇒ PASSED; ngược lại FAILED.
  - Emit `tournament.mission.verified`.
  - Award XP cho submitter nếu PASSED.
- **And** cho mỗi `MissionReviewAssignment`:
  - Tính `deltaFromMedian = |aggregate - median|`.
  - Base XP = 5 (nếu submit trong hạn).
  - Bonus: delta ≤ 1 ⇒ +10; delta ≤ 2 ⇒ +5; else 0.
  - Cap 3 review/mission/reviewer tính bonus (review thứ 4+ chỉ base).
  - Set `xpAwarded`, emit `tournament.mission.review.awarded`, ghi `XpTransaction`.

### AC-4.8 — Outlier flag
- **Given** sau close window
- **When** reviewer có ≥2 review trong cùng tournament với delta > 2 SD median
- **Then** flag `MissionReviewAssignment.flagged = true`, emit `tournament.mission.review.flagged`, thông báo instructor.

### AC-4.9 — Reviewer không submit trong hạn
- **Given** `reviewWindowEndAt` tới, reviewer chưa submit
- **When** close-window
- **Then** `MissionReviewAssignment.completedAt` NULL → 0 XP, không tính vào median.

### AC-4.10 — Extend window khi không đủ reviewer
- **Given** close-window job chạy, một submission có số review hoàn thành < `peerReviewerCount`
- **When** chưa extend lần 2
- **Then** tự động `UPDATE reviewWindowEndAt = reviewWindowEndAt + 24h`, increment `extendCount`, KHÔNG close submission đó, KHÔNG award XP cho reviewer đã chấm (chờ vòng sau), notify reviewer chưa chấm.
- **And** emit event `tournament.mission.review.window_extended` với `{ missionId, submissionId, newEndAt, extendCount }`.
- **Max 2 lần extend**. Sau lần 2 vẫn thiếu ⇒ fallback: chuyển submission sang `MANUAL_REVIEW` (instructor chấm), notify instructor, emit `tournament.mission.review.fallback_manual`.

---

## 5. Verify mode: MANUAL_REVIEW (reuse Assignment)

### AC-5.1 — Tạo mission tự sinh Assignment ẩn
- **Given** instructor tạo mission MANUAL_REVIEW
- **When** save
- **Then** tạo `Assignment` với `tournamentMissionId` set, `lessonId = NULL`, `isHidden = true` trong context course.
- **And** Assignment chỉ hiện trong UI tournament, không hiện trong tab Assignment thường.

### AC-5.2 — Cross-course tournament
- **Given** Tournament không có `courseId`
- **When** tạo mission MANUAL_REVIEW
- **Then** Assignment tạo ra có `lessonId = NULL`, không thuộc course nào. CHECK constraint pass vì `tournamentMissionId` set.

### AC-5.3 — Submit
- **Given** user submit mission MANUAL_REVIEW
- **When** submit qua UI tournament
- **Then** dưới hood gọi flow `AssignmentSubmission` hiện tại, tạo `MissionSubmission` với `payload = { assignmentSubmissionId }`, status PENDING.
- **And** emit `tournament.mission.submitted`.

### AC-5.4 — Instructor grade
- **Given** instructor chấm Assignment trong grading queue có sẵn
- **When** `AssignmentSubmission.status = graded`
- **Then** listener cập nhật `MissionSubmission.finalScore = score/maxScore`, status PASSED nếu `>= passThreshold` (instructor set per mission), emit `tournament.mission.verified`, award XP nếu PASSED.

### AC-5.5 — Resubmit
- **Given** Assignment chưa graded
- **When** user resubmit
- **Then** update `AssignmentSubmission` (flow Assignment có sẵn cho phép), `MissionSubmission` không đổi row.
- **And** nếu đã graded ⇒ chặn.

---

## 6. Anti-farming & anti-collusion

### AC-6.1 — XP cap reviewer
- Đã cover trong AC-4.7: 3 review/mission/reviewer được tính bonus.

### AC-6.2 — Daily collusion scan
- **Given** job `detect-collusion` chạy daily
- **When** phát hiện cặp (A, B) review nhau với điểm cả 2 chiều đều > median của reviewer khác +2 điểm
- **Then** flag cả 2 review, notify instructor, emit `tournament.mission.review.flagged` với `reason = "mutual_high_score"`.

### AC-6.3 — Speed-run reject (AUTO_GRADE)
- **Given** mission AUTO_GRADE có embedded quiz
- **When** user submit trong < 10s từ lúc mở mission
- **Then** reject với 429, không tính submission, log event `tournament.mission.speed_run_blocked`.

---

## 7. Events emitted (LearningEvent)

Verify rằng các event sau được ghi vào `LearningEvent` với schema đúng:

| Event type | Required payload fields |
|---|---|
| `tournament.mission.submitted` | `missionId, submissionId, userId, missionType, verifyMode` |
| `tournament.mission.verified` | `submissionId, userId, status, finalScore` |
| `tournament.mission.review.assigned` | `submissionId, reviewerId, dueAt` |
| `tournament.mission.reviewed` | `submissionId, reviewerId, aggregateScore` |
| `tournament.mission.review.awarded` | `reviewerId, missionId, baseXp, bonusXp, deltaFromMedian` |
| `tournament.mission.review.flagged` | `reviewerId, missionId, reason` |
| `tournament.mission.speed_run_blocked` | `missionId, userId, elapsedMs` |

Mọi event là idempotent (replay không tạo state mới).

---

## 8. UI — Instructor

### AC-8.1 — Mission editor
- Picker `missionType` (3 option) + `verifyMode` (4 option, lọc theo missionType — xem AC-1.3).
- Form fields hiện theo verifyMode:
  - AUTO_GRADE: embedded quiz builder (reuse `QuizQuestion` UI).
  - AUTO_CHECK: rule type picker + config form.
  - PEER_REVIEW: rubric builder + `peerReviewerCount` + `passThreshold` + `reviewWindowEndAt`.
  - MANUAL_REVIEW: instructor settings (maxScore, dueAt) + `passThreshold`.
- Personalization toggle off ⇒ skill tag không bắt buộc (memory: project_personalization_toggle).

### AC-8.2 — Reviewer dashboard
- Tab "Review queue" hiện mission đang trong review window được assign cho user.
- Show: mission title (tournament name), due time, submitter ẩn danh, rubric form.
- "Pending XP" indicator: hiện XP dự kiến chưa được award.

---

## 9. UI — Learner

### AC-9.1 — Mission detail page
- Hiện content theo missionType.
- Submit button → form khác nhau theo verifyMode (answers / URL / file / artifact).
- Sau submit: status badge (PENDING/PASSED/FAILED), resubmit button nếu eligible (theo AC-2.2/4.4/5.5).

### AC-9.2 — Peer review status
- Submitter thấy "Đang chờ N/3 reviewer chấm", không thấy điểm từng reviewer riêng.
- Sau window đóng: thấy median + per-criterion average + ẩn danh comment.

---

## 10. Test plan (sẽ viết test trước khi code per §6)

- Unit: median calc, delta/XP calc, rubric weighting, resubmit gate.
- Integration: full flow per verifyMode end-to-end (submit → verify → XP awarded → event log).
- Job: `assign-peer-reviewers`, `close-review-window`, `detect-collusion` idempotency.
- E2E: instructor tạo mission CUSTOM/PEER_REVIEW → 3 learner submit → 3 reviewer chấm → window close → ranking cập nhật.

---

## Resolved decisions (2026-05-21)

1. **Reviewer không đủ**: extend window tự động +24h, max 2 lần, sau đó fallback MANUAL_REVIEW (AC-4.10).
2. **`submissionDeadline`**: field riêng mỗi mission (`TournamentMission.submissionDeadline DateTime`).
3. **AUTO_GRADE**: reuse `Quiz` + `QuizQuestion` + `QuizAttempt`, tạo Quiz ẩn gắn `tournamentMissionId` (AC-2.1, schema: `Quiz.tournamentMissionId String? @unique`).
