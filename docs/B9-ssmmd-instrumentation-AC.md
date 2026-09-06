# B9 — SSMMD instrumentation + remediation uptake

> Acceptance criteria, viết trước khi code theo CLAUDE.md §6.
>
> **Mục tiêu:** hệ thống hiện *sinh ra* feedback nhưng *không tự mô tả* feedback nó
> sinh ra. Không có mô tả thì không mã hoá được theo khung ba tầng
> (macro = nguồn dữ liệu/mô hình · meso = task/process/self-regulation/self ·
> micro = mức elaboration), và không có bảng phân bố nào để báo cáo.
>
> Feature ID mới **B9** (B8 đã dùng cho quality loop / rating).
> Gồm 2 phần: **B9.1** gắn toạ độ, **B9.2** đo uptake.

## Phạm vi

| Trong phạm vi | Ngoài phạm vi |
|---|---|
| Ghi toạ độ macro/meso/micro cho mỗi `FeedbackDelivery` | `FeedbackPolicy` + random hoá theo lớp (đó là tier C) |
| Sự kiện `feedback.remediation.clicked` | Feedback hiệu chỉnh từ confidence (tier B) |
| Backfill mã hoá cho dữ liệu đã có | Đưa LLM vào đường sinh feedback |

---

## B9.1 — Toạ độ SSMMD trên mỗi lượt feedback

### Nhóm 1 — Schema

| # | Given / When / Then |
|---|---|
| 1.1 | Ba enum mới: `FeedbackLevel` (task, process, self_regulation, self) · `FeedbackElaboration` (kr, kcr, kh, km, elaborated) · `FeedbackSourceKind` (rule_template, misconception, bkt_state, llm, hybrid) |
| 1.2 | `FeedbackDelivery` thêm `level`, `levels` (Json array), `elaboration`, `sourceKind`, `generationContext` (Json) — **nullable**, vì hàng cũ chưa được mã hoá và không được giả vờ là đã có |
| 1.3 | `FeedbackTemplate` thêm `level` + `elaboration` nullable — GV khai báo một lần; null ⇒ suy ra từ `scope` |
| 1.4 | Index `(level, deliveredAt)` để truy vấn phân bố theo thời gian không phải quét bảng |

### Nhóm 2 — Phân loại tất định

Phân loại chạy **lúc sinh feedback**, không đoán ngược từ text.

| # | Given / When / Then |
|---|---|
| 2.1 | **Given** feedback có template khớp misconception · **Then** `levels` chứa `process`, `sourceKind = misconception` |
| 2.2 | **Given** feedback có ≥1 link ôn bài · **Then** `levels` chứa `self_regulation` |
| 2.3 | **Then** `levels` **luôn** chứa `task` — mọi lượt đều nói câu này sai |
| 2.4 | **Then** `levels` **không bao giờ** chứa `self` — khen ngợi cá nhân nằm ở kênh gamification, có chủ ý (Hattie: FS kém hiệu quả nhất) |
| 2.5 | **Then** `level` (trội) = tầng cao nhất có mặt, thứ tự task < process < self_regulation |
| 2.6 | **Then** `elaboration` = tầng sâu nhất: `elaborated` (misconception + link) > `km` (chỉ misconception) > `kh` (chỉ link) > `kcr` (chỉ template) > `kr` (chỉ câu fallback) |
| 2.7 | **Then** `generationContext` chứa đủ để tái lập: templateScope, misconceptionCode, skillIds, remediationLessonIds, số bài đã học bị loại, `masteryPriorBySkill` (BKT **trước** lượt này), `coderVersion` |
| 2.8 | Template có `level`/`elaboration` khai báo tay ⇒ **thắng** giá trị suy ra |

### Nhóm 3 — Backfill

| # | Given / When / Then |
|---|---|
| 3.1 | `pnpm backfill:feedback-coding` mã hoá hàng cũ từ `templateId` + `remediationLessonIds` |
| 3.2 | Hàng backfill có `generationContext.codedRetroactively = true` — người đọc dữ liệu phải phân biệt được mã hoá lúc sinh và mã hoá hồi tố |
| 3.3 | Idempotent: chạy lần 2 mã hoá thêm 0 hàng |
| 3.4 | Backfill **không** bịa `masteryPriorBySkill` — trường đó vắng mặt ở hàng hồi tố |

---

## B9.2 — Đo uptake (feedback.remediation.clicked)

Đây là biến trung gian quan trọng nhất trong nghiên cứu feedback, và hiện **không đo được**: hệ thống gợi ý bài ôn nhưng không biết học viên có mở hay không.

| # | Given / When / Then |
|---|---|
| 4.1 | Event type mới `feedback.remediation.clicked`, payload `{ deliveryId, lessonId, questionId, attemptId }` |
| 4.2 | **When** học viên bấm link ôn bài trên trang kết quả · **Then** emit event, và **điều hướng vẫn xảy ra bình thường** kể cả khi ghi event lỗi |
| 4.3 | **Given** `lessonId` không nằm trong `remediationLessonIds` của delivery · **Then** từ chối — không cho bơm event tuỳ ý |
| 4.4 | **Given** delivery của người khác · **Then** 403 |
| 4.5 | Bấm nhiều lần ⇒ nhiều event (log append-only, không nuốt). Phân tích lấy `min(occurredAt)` cho mỗi (delivery, lesson) |

---

## Test

- Unit cho classifier (thuần, không DB): phủ hết 5 mức elaboration và 3 tổ hợp level
- Integration: nộp bài sai → assert delivery có toạ độ đúng và `generationContext` đủ trường
- Uptake: happy path + 3 nhánh từ chối (lesson lạ, người khác, delivery không tồn tại)
- Backfill: idempotent, cờ hồi tố, không bịa mastery
- **Toàn bộ test core-feedback cũ phải pass nguyên** — đây là thay đổi cộng thêm, không đổi hành vi feedback

## Files

`packages/db/prisma/schema.prisma` · `packages/core-feedback/src/coding.ts` (mới) ·
`packages/core-feedback/src/diagnostic.ts` · `packages/core-feedback/src/uptake.ts` (mới) ·
`packages/shared-types/src/events.ts` · `apps/web/src/app/api/feedback-deliveries/[id]/remediation-click/route.ts` (mới) ·
`apps/web/src/components/RemediationLink.tsx` (mới) · trang kết quả quiz ·
`packages/core-feedback/scripts/backfill-feedback-coding.ts` (mới)
