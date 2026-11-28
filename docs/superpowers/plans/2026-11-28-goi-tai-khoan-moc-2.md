# Gói tài khoản — Mốc 2: điểm kiểm hạn mức và thông báo chạm hạn mức

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Các hạn mức của gói (spec §5.3) được kiểm thật ở server lúc tạo hoặc lúc mở, hạn mức theo quy mô được chụp vào hoạt động lúc tạo, giảng viên thấy thông báo chạm hạn mức rõ ràng, học viên thấy câu rõ nghĩa không lộ tên gói, và người dùng thử vượt mức gói tham chiếu được ghi lại để admin chào gói.

**Architecture:** Module `packages/core-lms/src/plans/quota.ts` (mới) giữ toàn bộ logic hạn mức: đọc trần theo gói (`getPlanLimit`), đếm số đã dùng từ bảng thật theo tháng giờ VN, tách nguồn cá nhân và nguồn tổ chức cho quỹ chung, phát `plan.limit.reached`. Các route và hàm lõi gọi vào đó rồi ném `PlanLimitError`; `mapKnownError` trả `{ error: "plan_limit_reached", details }` 409. Ví token (core-feedback) không được import core-lms nên nhận trần theo gói qua một hàm đăng ký do `apps/web` cài lúc khởi động.

**Tech Stack:** Prisma + PostgreSQL, Vitest (DB test của core-lms), Next.js App Router.

**Spec:** `docs/tieu-chi/goi-tai-khoan.md` (đã sửa 28/11: tính năng trung tâm theo loại tổ chức; mốc 2 lên prod cùng mốc 3).

## Global Constraints

- Làm thẳng trên `main`, không nhánh, không worktree. Commit từng task (chỉ stage tệp của task: cây có nhiều WIP của người dùng, **không** `git add -A` / `git add .`). **Không push**: mốc 2 chỉ lên prod cùng mốc 3.
- `core-lms` không import `core-feedback` và ngược lại; `shared-types` chỉ hằng số và kiểu; `packages/db` không có logic.
- Schema đổi qua `prisma migrate` (thư mục migration mới, SQL tay được), không `db push`.
- `PLANS_ENABLED` tắt ⇒ mọi điểm kiểm cư xử y như trước mốc 2 (giữ trần cứng cũ, không chụp số mới, không phát sự kiện). Có test cho từng điểm kiểm.
- Chỉ người giảng dạy đi qua tầng gói (`getPlanSubjectKind` = `"teaching"`). Platform Admin, học viên, người không xác định ⇒ không giới hạn theo gói (chỉ trần cứng).
- Trần cứng giữ làm trần trên: phiếu bầu 500, word cloud 500, ghi chú bảng 2.000, Gameshow 300 (`MAX_PARTICIPANTS_PER_SESSION`), và `TECH_CEILINGS` trong `packages/shared-types/src/plans.ts`. Giá trị chụp = `min(giá trị gói, trần cứng)`.
- **Điều cấm (spec §3):** không cắt học viên giữa chừng (lượt đã bắt đầu, lượt nối lại, đổi phiếu đã bầu đều không bị kiểm); hạ gói không khoá nội dung cũ; số đã dùng luôn đếm từ bảng thật, không có bộ đếm riêng.
- Lỗi hạn mức: `PlanLimitError` (core-lms), mã `"plan_limit_reached"`, `details: { key, limit, used, source: "individual" | "organization", planKey, organizationName? }`. HTTP 409 qua `mapKnownError`.
- Câu cho học viên không lộ tên gói hay giá: hoạt động "Hoạt động đã nhận đủ số lượt gửi."; ca thi giữ "Ca thi đã đủ số lượng thí sinh tối đa." (đã có); Gameshow "Phòng đã đầy (tối đa {n} người)."; vấn đáp "Buổi vấn đáp tạm thời chưa nhận thêm lượt. Em hãy báo giảng viên.".
- Sự kiện `plan.limit.reached`: subject = giảng viên chủ chi phí (hoặc người thao tác với hạn mức tổ chức); payload đúng `PlanLimitReachedPayload` đã khai ở `packages/shared-types/src/events.ts:417` (không tên, email, số tiền); `eventKey = plan.limit.reached:<userId>:<key>:<YYYY-MM-DD giờ VN>` để tối đa một lần mỗi người, mỗi khoá, mỗi ngày.
- Tháng tính theo giờ Việt Nam (UTC+7, không có giờ mùa hè).
- Chữ giao diện tiếng Việt, xưng thầy/cô với giảng viên, dùng `.banner-warning`, `.text-body/.text-meta` (CLAUDE.md §4.6). Thuật ngữ ca thi/thí sinh theo §4.6.1.

## Quyết định của người dựng (ghi lại để người dùng soát)

- **Trung tâm không theo gói** (người dùng chốt 28/11): `center.access` đã gỡ khỏi danh mục gói (đã làm, chưa commit: `shared-types/plans.ts`, `feature-flag-catalog.ts` → `sellable: false`, `planAdminUi.ts`, `catalog.test.ts`, migration `20261128200000_plans_drop_center_access`). Task 1 commit phần này.
- `org.active_learners`, thông báo 80% lượt vấn đáp, email nhắc, thanh báo sắp hết hạn: **để mốc 3/4** (chưa có bảng thông báo trong app; mốc 3 có email và thanh báo, mốc 4 có trang OrgAdmin).
- Hạn mức theo quy mô (hoạt động, Gameshow, ca thi) **không** ghi `plan.limit.reached` cho người dùng thử (không có "đã dùng" theo tháng để so với gói tham chiếu). Ghi lại vượt mức tham chiếu chỉ áp cho `ai_oral.monthly_attempts`, `storage.mb`, `org.max_instructors`.
- Ghi chú do **chủ bảng** đăng không bị tính vào hạn mức của bảng (chủ bảng đăng qua cùng route công khai).
- Đệm Redis cho tầng gói: không làm (mốc 1 cũng không; số truy vấn nhỏ).
- Token AI: đổi gói giữa tháng áp dụng từ tháng sau (ví cấp lười mỗi tháng một lần — giữ nguyên).
- Dung lượng: tệp học viên không chặn giảng viên — loại khỏi tổng các `kind` `submission`, `practice_answer`, `proctor_snapshot`, `avatar`. Tệp ghi sai người (tên tệp bắt đầu bằng examId/boardId) tạm không tính cho ai cho tới khi cron gán lại chạy; sai về phía có lợi cho người dùng.
- `org.max_instructors`: tổ chức **không có gói tổ chức hiệu lực** ⇒ không giới hạn. Platform Admin cũng bị chặn khi thêm vượt (spec: "OrgAdmin hoặc admin").
- Lily: mốc 2 không thêm trang hay mục menu giảng viên; hướng dẫn về gói và trang `/me/goi` viết ở mốc 3.

## Review Focus

1. **Lượt nối lại / phiếu đổi lựa chọn:** học viên nối lại lượt vấn đáp đã bắt đầu, hoặc đổi phiếu đã bầu, khi quỹ đã hết ⇒ vẫn được. → test ở Task 4 và Task 6.
2. **Hạ gói sau khi tạo:** hoạt động / phòng / ca tạo lúc còn gói lớn vẫn nhận tới số đã chụp; sửa ca thi sau khi hạ gói (đổi tên, giờ) không làm giảm `maxCandidates` đã chụp. → test ở Task 4, 5, 6.
3. **`PLANS_ENABLED` tắt (máy chủ trường):** mọi điểm kiểm giữ trần cũ, không cột chụp nào được ghi số theo gói, không sự kiện. → một test mỗi task.
4. **Ranh tháng giờ VN:** lượt vấn đáp lúc 23:30 ngày 31 giờ VN (16:30 UTC) thuộc tháng đó; 00:10 ngày 1 giờ VN (17:10 UTC hôm trước) thuộc tháng mới. → test ở Task 2.
5. **Quỹ chung hai nguồn:** giảng viên trong tổ chức có quỹ còn chỗ nhưng gói cá nhân Free đã hết ⇒ được, nguồn trả về là `organization`; ngược lại tổ chức hết quỹ nhưng gói cá nhân Pro còn ⇒ được, nguồn `individual`. → test ở Task 2.

---

## Bản đồ tệp

| Tệp | Trách nhiệm |
|---|---|
| `packages/core-lms/src/plans/quota.ts` (mới) | `vnMonthRange`, `getPlanLimit`, `checkUsageQuota`, `assertUsageQuota`, `PlanLimitError`, phát sự kiện |
| `packages/core-lms/src/plans/index.ts` | re-export |
| `packages/db/prisma/schema.prisma` + migration `20261128210000_plan_quota_snapshots` | cột chụp + `ExamSession.createdById` |
| `apps/web/src/lib/apiHelpers.ts` | map `PlanLimitError` |
| `apps/web/src/lib/planLimit.ts` (mới) | `describePlanLimit(details)` (câu cho giảng viên), `PLAN_LIMIT_LEARNER_TEXT` |
| `apps/web/src/components/ui/PlanLimitNotice.tsx` (mới) | thông báo chạm hạn mức dùng chung |
| route hoạt động, Gameshow, ca thi, vấn đáp, upload, thành viên tổ chức | điểm kiểm (chi tiết từng task) |
| `packages/core-feedback/src/aiTutor/tokenWallet.ts` | hook trần token theo gói |
| `apps/web/src/lib/planTokenAllowance.ts` (mới) + `instrumentation.ts` + `worker/index.ts` | đăng ký hook |
| `apps/web/src/app/api/cron/storage-attribution/route.ts` (mới) + `docker/cron/crontab` | gán lại tệp hằng đêm |
| `apps/web/src/app/admin/plans/**` | danh sách người dùng thử vượt mức tham chiếu |

---

### Task 1: Commit gỡ `center.access` khỏi gói

Phần mã đã viết sẵn trong cây (xem "Quyết định của người dựng").

- [ ] **Step 1:** Áp migration lên DB dev và DB test: `pnpm --filter @feedbackme/db exec prisma migrate deploy` (với `DATABASE_URL` dev, rồi DB test theo `packages/core-lms/src/test/setup.ts`). Kiểm: `SELECT count(*) FROM "Plan" WHERE entitlements ? 'center.access'` = 0.
- [ ] **Step 2:** Chạy `pnpm --filter @feedbackme/core-lms test -- plans` và `pnpm --filter @feedbackme/core-lms test -- centerAccess`. Expected: PASS.
- [ ] **Step 3:** Chạy seed cờ trên dev (`pnpm --filter @feedbackme/db exec tsx src/seed-feature-flags.ts`) để `center.access.sellable = false`; mở `/admin/plans` lưu thử một gói ⇒ không lỗi `non_sellable_key`.
- [ ] **Step 4: Commit** `docs/tieu-chi/goi-tai-khoan.md`, `packages/shared-types/src/plans.ts`, `packages/db/src/feature-flag-catalog.ts`, `apps/web/src/lib/planAdminUi.ts`, `packages/core-lms/src/plans/__tests__/catalog.test.ts`, thư mục migration — message `feat(plans): tính năng trung tâm theo loại tổ chức, gỡ center.access khỏi gói`.

### Task 2: Lõi hạn mức `plans/quota.ts`

**Files:** Create `packages/core-lms/src/plans/quota.ts`, `packages/core-lms/src/plans/__tests__/quota.test.ts`; Modify `packages/core-lms/src/plans/index.ts`, `packages/core-lms/src/plans/subscriptions.ts` (xuất thêm hàm nội bộ cần dùng).

**Interfaces — Produces:**
```ts
export type UsageMetric = "ai_oral.monthly_attempts" | "storage.mb" | "org.max_instructors";
export type SnapshotMetric = "activity.max_responses" | "gameshow.max_participants" | "exam.session.max_candidates";
export type QuotaSource = "individual" | "organization";
export interface QuotaResult {
  allowed: boolean;
  limit: number | null;      // null = không giới hạn theo gói
  used: number;              // đơn vị của khoá: lượt, MB (làm tròn lên), người
  source: QuotaSource | null;
  planKey: string | null;
  organizationName?: string;
}
export class PlanLimitError extends Error { code: "plan_limit_reached"; details: QuotaResult & { key: string } }
export function vnMonthRange(now: Date): { start: Date; end: Date };      // [start, end)
export function vnDayKey(now: Date): string;                               // "YYYY-MM-DD" giờ VN
export async function getPlanLimit(userId: string, key: SnapshotMetric, db?: PrismaClient): Promise<number | null>;
export async function checkUsageQuota(subject: { userId?: string; organizationId?: string }, key: UsageMetric, opts?: { increment?: number; now?: Date; db?: PrismaClient }): Promise<QuotaResult>;
export async function assertUsageQuota(subject: { userId?: string; organizationId?: string }, key: UsageMetric, opts?: { increment?: number; now?: Date; db?: PrismaClient }): Promise<QuotaResult>; // ném PlanLimitError khi !allowed
```

Quy tắc (viết đúng như sau):
- `getPlanLimit`: `null` khi `plansEnabled()` tắt hoặc người đó không phải `"teaching"`; ngược lại `resolveFeature(userId, key)` (để override riêng thắng gói), rồi `min(value, TECH_CEILINGS[key])`; giá trị không phải số ⇒ `TECH_CEILINGS[key]`.
- `checkUsageQuota` với `userId` (vấn đáp, dung lượng): tắt tầng gói hoặc không phải người giảng dạy ⇒ `{ allowed: true, limit: null, used: 0, source: null, planKey: null }` (không đếm). Ngược lại tính hai nguồn:
  - **cá nhân**: `UserFeatureOverride` còn hạn của khoá (nếu có) ⇒ đó là hạn mức; không thì gộp MAX các thuê bao cá nhân hiệu lực; không có thuê bao cá nhân ⇒ giá trị trong gói `free`. `used` = số của riêng người đó.
  - **tổ chức** (chỉ khi `User.organizationId` có thuê bao tổ chức hiệu lực): MAX các thuê bao tổ chức; `used` = tổng mọi người có `User.organizationId` đó.
  - Cho phép khi `used + increment <= limit` ở ít nhất một nguồn, ưu tiên cá nhân. Không nguồn nào cho phép ⇒ `allowed: false`, trả nguồn có hạn mức lớn hơn (để thông báo đúng người cần liên hệ).
- `checkUsageQuota` với `organizationId` (`org.max_instructors`): chỉ nguồn tổ chức; tổ chức không có thuê bao tổ chức hiệu lực ⇒ không giới hạn.
- Đếm (`used`):
  - `ai_oral.monthly_attempts`: `ExamAttempt` có `startedAt ∈ vnMonthRange(now)` và `exam.kind = "oral"`, chủ chi phí là `exam.createdById`, rỗng thì chủ khoá (`CourseInstructor.role = "owner"`).
  - `storage.mb`: `ceil(sum(StoredFile.sizeBytes) / 1048576)` với `billedUserId` thuộc chủ thể, `deletedAt = null`, `kind` không thuộc `["submission","practice_answer","proctor_snapshot","avatar"]`; `increment` là MB của tệp sắp ghi (làm tròn lên).
  - `org.max_instructors`: người có `organizationId` = tổ chức và có vai trò `instructor` hoặc `center_teacher`.
- Sự kiện (bằng `emitEvent`, eventKey ở Global Constraints): khi `allowed = false` ⇒ `enforced: true`. Khi `allowed = true` mà nguồn cho phép là gói dùng thử (có `referencePlanKey`) và `used + increment` vượt giá trị khoá đó trong gói tham chiếu ⇒ `enforced: false`, `limit` = giá trị gói tham chiếu. Ghi sự kiện không được làm hỏng lời gọi (lỗi ghi ⇒ nuốt và log).

- [ ] **Step 1: Viết test hỏng** trong `quota.test.ts` (dùng helper tạo giảng viên/thuê bao như `trial.test.ts`):
  - `vnMonthRange(new Date("2026-11-30T16:30:00Z")).start` = `2026-10-31T17:00:00.000Z`; `new Date("2026-11-30T17:10:00Z")` thuộc tháng 12 (`start` = `2026-11-30T17:00:00.000Z`).
  - giảng viên không gói, 2 lượt vấn đáp trong tháng ⇒ `checkUsageQuota({userId}, "ai_oral.monthly_attempts")` = `{ allowed: false, limit: 2, used: 2, source: "individual", planKey: "free" }`.
  - cùng giảng viên, tổ chức có `org_khoa` (125) và tổng 10 lượt ⇒ `allowed: true, source: "organization"`.
  - Pro cá nhân (30) còn chỗ, tổ chức `org_khoa` đã 125 ⇒ `allowed: true, source: "individual"`.
  - lượt tháng trước không tính; đề `kind != oral` không tính; đề không `createdById` tính cho chủ khoá.
  - `PLANS_ENABLED` tắt ⇒ `limit: null, allowed: true`; học viên / admin ⇒ `limit: null`.
  - người dùng thử, 31 lượt ⇒ `allowed: true` và có đúng một `LearningEvent` `plan.limit.reached` với `enforced: false, limit: 30`; gọi lại cùng ngày ⇒ vẫn một.
  - `assertUsageQuota` khi hết ⇒ ném `PlanLimitError` có `details.key = "ai_oral.monthly_attempts"`, payload sự kiện `enforced: true`, JSON payload không chứa `@`.
  - dung lượng: tệp `submission` 3 GB của học viên được gán cho giảng viên Free không làm `used` tăng; tệp `lesson_video` 2.048 MB ⇒ `increment` 1 MB bị từ chối.
  - `org.max_instructors`: tổ chức `org_khoa` (30) có 30 giảng viên ⇒ từ chối; tổ chức không gói ⇒ `limit: null`.
  - `getPlanLimit`: Free ⇒ 100 cho `activity.max_responses`; `UserFeatureOverride` 250 ⇒ 250; dùng thử ⇒ 500; tắt tầng gói ⇒ `null`.
- [ ] **Step 2:** `pnpm --filter @feedbackme/core-lms test -- quota` ⇒ FAIL (module chưa có).
- [ ] **Step 3:** Cài `quota.ts` theo quy tắc trên; export qua `plans/index.ts`.
- [ ] **Step 4:** Chạy lại ⇒ PASS; chạy cả `-- plans` ⇒ PASS.
- [ ] **Step 5: Commit** `feat(plans): lõi kiểm hạn mức theo gói (checkUsageQuota, getPlanLimit)`.

### Task 3: Lớp web dùng chung — lỗi, câu chữ, `<PlanLimitNotice>`

**Files:** Modify `apps/web/src/lib/apiHelpers.ts`; Create `apps/web/src/lib/planLimit.ts`, `apps/web/src/lib/planLimit.test.ts`, `apps/web/src/components/ui/PlanLimitNotice.tsx`.

**Interfaces — Produces:**
- `mapKnownError` nhận `PlanLimitError` ⇒ status 409, body `{ error: "plan_limit_reached", details }`.
- `describePlanLimit(details: PlanLimitDetails): string` — câu cho giảng viên, ví dụ khoá vấn đáp nguồn cá nhân: `"Thầy/cô đã dùng 2/2 lượt vấn đáp AI của gói tháng này."`; dung lượng: `"Thầy/cô đã dùng 2.048/2.048 MB dung lượng của gói."`; nguồn tổ chức thêm `" Thầy/cô liên hệ quản trị viên của {organizationName} để nâng hạn mức."`; nguồn cá nhân thêm `" Thầy/cô có thể nâng cấp gói ở trang Gói tài khoản."`. Số định dạng `vi-VN`.
- `PLAN_LIMIT_LEARNER_TEXT: Record<"activity" | "gameshow" | "oral", string>` đúng các câu ở Global Constraints.
- `<PlanLimitNotice details={…} />` (server-safe, không state): `.banner-warning` chứa `describePlanLimit` và, khi nguồn cá nhân, nút link "Nâng cấp gói" tới `/me/goi` (trang có ở mốc 3; hai mốc lên prod cùng lúc).

- [ ] **Step 1:** Test `planLimit.test.ts`: ba câu trên đúng từng chữ; không câu nào chứa tên gói khi là câu cho học viên; `describePlanLimit` với `source: "organization"` không chứa "Nâng cấp".
- [ ] **Step 2:** Chạy `pnpm --filter @feedbackme/web test -- planLimit` ⇒ FAIL; cài; ⇒ PASS.
- [ ] **Step 3: Commit** `feat(plans): thông báo chạm hạn mức dùng chung`.

### Task 4: Schema chụp hạn mức + hoạt động nhanh, bảng, slide Live

**Files:** Modify `packages/db/prisma/schema.prisma`; Create migration `20261128210000_plan_quota_snapshots` (thêm `ClassroomPoll.maxResponses Int?`, `WordCloud.maxResponses Int?`, `InteractiveBoard.maxNotes Int?`, `GameSession.maxParticipants Int?`, `ExamSession.createdById String?` + FK `SetNull` tới `User` + index); Modify:
- tạo: `apps/web/src/app/api/classroom/quick-poll/create/route.ts` (create ~:78), `.../word-cloud/create/route.ts` (~:76), `apps/web/src/app/api/instructor/teaching-tools/boards/route.ts` (~:38), Live runtime `apps/web/src/app/api/instructor/limio-live/decks/[deckId]/present/[sessionId]/slides/[slideId]/route.ts` (poll/quiz ~:51, word_cloud ~:64, collaborate_board ~:89);
- gửi: `apps/web/src/app/api/classroom/quick-poll/[pollId]/vote/route.ts` (~:120, chỉ phiếu mới), `.../word-cloud/[cloudId]/submit/route.ts` (~:70), `apps/web/src/app/api/public/boards/[code]/notes/route.ts` (~:111; bỏ qua khi người đăng là `ownerId`);
- client: `PollVotingPage.tsx`, `QuickPollVote.tsx`, `WordCloudSubmitPage.tsx`, `app/join/[code]/page.tsx` hiện `PLAN_LIMIT_LEARNER_TEXT.activity` khi gặp lỗi đầy.

Quy tắc: lúc tạo, `maxResponses = getPlanLimit(creator, "activity.max_responses")` kẹp theo trần cứng của loại (500 / 500 / 2.000); `null` khi tầng gói tắt. Lúc gửi: `cap = row.maxResponses ?? <trần cứng cũ>`; vượt ⇒ giữ mã lỗi cũ của route (`board_full` 403; phiếu/word cloud 400 với `error: "activity_full"` thay câu tiếng Anh) để client map câu tiếng Việt.

- [ ] **Step 1:** Viết test cho một hàm thuần `activityCap(stored: number | null, hardCap: number): number` (đặt ở `apps/web/src/lib/planLimit.ts`) và test route-level nếu thư mục route đã có mẫu test; tối thiểu: `activityCap(null, 500) = 500`, `activityCap(100, 500) = 100`, `activityCap(900, 500) = 500`.
- [ ] **Step 2:** Migration + `prisma generate`; áp lên dev và test DB.
- [ ] **Step 3:** Chụp ở 4 nơi tạo; kiểm ở 3 nơi gửi; client map câu.
- [ ] **Step 4:** Kiểm tay trên dev (Review Focus 1–3): tạo phiếu bằng giảng viên Free (dev có `PLANS_ENABLED=1`) ⇒ cột = 100; đổi phiếu đã bầu khi đã đủ ⇒ được; tắt `PLANS_ENABLED` ⇒ cột `null`, trần 500.
- [ ] **Step 5:** `pnpm --filter @feedbackme/web typecheck` ⇒ exit 0. **Commit** `feat(plans): chụp hạn mức phản hồi vào hoạt động lúc tạo`.

### Task 5: Gameshow

**Files:** `apps/web/src/app/api/gameshow/sessions/create/route.ts` (thêm `requireFeature("teaching_tools.access")`, mặc định cờ này bật nên không ai mất quyền; chụp `maxParticipants` ở cả `createFromQuiz` và `createFromQuestionSet`), `.../sessions/by-code/[code]/join/route.ts` (~:51: `cap = session.maxParticipants ?? MAX_PARTICIPANTS_PER_SESSION`), `.../sessions/by-code/[code]/route.ts` (trả thêm `maxParticipants` đã kẹp), `apps/web/src/app/play/[code]/page.tsx` (~:197 và ~:378 dùng số từ API thay hằng 300), `apps/web/src/app/instructor/gameshow/new/NewGameshowClient.tsx` (hiện dòng `.text-meta` "Phòng tối đa {n} người theo gói của thầy/cô." — lấy n qua prop từ server page bằng `getPlanLimit`, ẩn khi `null`).

- [ ] **Step 1:** Test `activityCap(150, 300) = 150` dùng lại; thêm test (nếu route có test) rằng phòng có `maxParticipants = 40` từ chối người thứ 41 với `room_full`.
- [ ] **Step 2:** Cài; typecheck; kiểm tay: giảng viên Free tạo phòng ⇒ 40; tắt tầng gói ⇒ `null`, client vẫn ghi 300.
- [ ] **Step 3: Commit** `feat(plans): hạn mức người chơi Gameshow theo gói`.

### Task 6: Ca thi — chụp `maxCandidates` và `createdById`

**Files:** `packages/core-lms/src/exam/cohorts.ts` (`createExamSessionImpl` ~:458/491), `packages/core-lms/src/exam/exam-rounds.ts` (`createExamSessionInRound` ~:577/606, `bulkCreateExamSessionsInRound` ~:665/738, `createFormalSession` ~:2157/2206, update ~:773/909), `packages/core-lms/src/exam/quick-share.ts` (~:181 và ~:207), `packages/core-lms/src/org/session-templates.ts` (~:188), `packages/core-lms/src/exam/exam-rooms.ts` (`ensureDefaultSession` ~:511), `packages/core-lms/src/exam/oral-attempts.ts` (`openOralExamSession` ~:247); UI `apps/web/src/app/instructor/exam-sessions/[sessionId]/SessionOverviewPanel.tsx` (~:400).

**Interfaces — Produces:** `clampSessionCap(input: number | null | undefined, planLimit: number | null, current?: number | null): number | null` trong `packages/core-lms/src/plans/quota.ts`:
- tạo mới: `planLimit == null` ⇒ `input ?? null`; ngược lại `min(input ?? planLimit, planLimit)`.
- sửa (có `current`): chỉ áp khi `input` được gửi; trần = `max(planLimit, current ?? 0)` để ca đã chụp số lớn không bị giảm khi sửa trường khác; `input` không gửi ⇒ giữ nguyên.

Mọi nơi tạo ghi `createdById = actorUserId` và `maxCandidates = clampSessionCap(input, await getPlanLimit(actorUserId, "exam.session.max_candidates"))`. Route update trả thêm `{ capClampedTo?: number }` khi số lưu nhỏ hơn số nhập; panel hiện `.banner-warning` "Gói của thầy/cô cho tối đa {n} thí sinh mỗi ca." và dòng `.text-meta` cùng ý dưới ô nhập (ẩn khi không có trần). Kiểm lúc nhận mã (`claimByOpenCode`, `claimByAccount`) giữ nguyên.

- [ ] **Step 1: Test** `packages/core-lms/src/exam/__tests__/sessionCap.test.ts`: `clampSessionCap(200, 50) = 50`; `clampSessionCap(undefined, 50) = 50`; `clampSessionCap(undefined, null) = null`; sửa `clampSessionCap(undefined, 50, 300) = 300` (không gửi ⇒ giữ); `clampSessionCap(400, 50, 300) = 300`; DB test: giảng viên Free gọi `createFormalSession` với `maxCandidates: 200` ⇒ dòng lưu 50 và `createdById` = giảng viên; tắt tầng gói ⇒ 200.
- [ ] **Step 2:** Chạy ⇒ FAIL; cài 8 nơi tạo + update; chạy `-- exam` toàn bộ (đặc biệt `lobby.test.ts`) ⇒ PASS.
- [ ] **Step 3:** UI panel; typecheck.
- [ ] **Step 4: Commit** `feat(plans): chụp số thí sinh tối đa của ca theo gói`.

### Task 7: Vấn đáp AI theo tháng

**Files:** `packages/core-lms/src/exam/oral-attempts.ts` — `openOralExamSession` (~:197, chủ chi phí = `exam.createdById ?? resolveCourseOwner(courseId)`, `assertUsageQuota(..., { increment: 1 })` trước khi tạo/mở phiên), `startOralExamAttempt` (~:115, chỉ trên nhánh tạo lượt mới sau `decideOralStart`; thêm `createdById` vào select), `joinOralSessionByCode` (~:403, trước `examAttempt.create` ~:450; thêm `createdById`). Learner: `apps/web/src/app/learn/[slug]/exams/[examId]/page.tsx` (~:57) và `apps/web/src/app/oral/[code]/page.tsx` (`describeError` ~:97) map `plan_limit_reached` ⇒ `PLAN_LIMIT_LEARNER_TEXT.oral`. Giảng viên: trang đề vấn đáp của giảng viên hiện `<PlanLimitNotice>` khi `checkUsageQuota(owner, "ai_oral.monthly_attempts")` trả `allowed: false` (gọi không `increment`, tức `used + 0 <= limit`… dùng `increment: 1` để "còn ít nhất 1 lượt"); route `oral-session` trả lỗi qua `mapKnownError` và client hiện `describePlanLimit`.

- [ ] **Step 1: Test** `oral-attempts` (DB): giảng viên Free có 2 lượt tháng này ⇒ học viên `startOralExamAttempt` lượt mới ném `PlanLimitError`; cùng học viên đang có lượt `in_progress` ⇒ nối lại được (Review Focus 1); `openOralExamSession` ném khi hết; người dùng thử ⇒ luôn được; tắt tầng gói ⇒ được.
- [ ] **Step 2:** FAIL ⇒ cài ⇒ PASS; chạy `-- oral` toàn bộ ⇒ PASS.
- [ ] **Step 3:** Map câu ở hai trang học viên và thông báo ở trang giảng viên; typecheck.
- [ ] **Step 4: Commit** `feat(plans): hạn mức lượt vấn đáp AI theo tháng`.

### Task 8: Token AI theo gói

**Files:** `packages/core-feedback/src/aiTutor/tokenWallet.ts` (`resolveMonthlyAllowance` ~:67); Create `apps/web/src/lib/planTokenAllowance.ts`; Modify `apps/web/src/instrumentation.ts` (nhánh nodejs) và `apps/web/src/worker/index.ts`.

**Interfaces:** core-feedback xuất `setPlanTokenAllowanceResolver(fn: ((userId: string) => Promise<number | null>) | null): void`. `resolveMonthlyAllowance` gọi resolver trước; số ⇒ dùng số đó; `null` hoặc chưa đăng ký hoặc resolver ném ⇒ logic `SiteSetting` cũ. `apps/web/src/lib/planTokenAllowance.ts` cài resolver: `plansEnabled()` tắt ⇒ `null`; người không phải `"teaching"` ⇒ `null`; ngược lại `resolveFeature(userId, "ai.tokens.monthly_override")` (số ⇒ kẹp `TECH_CEILINGS`, khác ⇒ `null`). Gói tổ chức cho mỗi thành viên đúng mức đó (MAX đã có trong `resolveFeatures`).

- [ ] **Step 1: Test** core-feedback: resolver trả 300000 ⇒ allowance 300000; resolver trả `null` ⇒ số `SiteSetting`; resolver ném ⇒ số `SiteSetting`; `setPlanTokenAllowanceResolver(null)` gỡ được.
- [ ] **Step 2:** FAIL ⇒ cài ⇒ PASS. Đăng ký trong `instrumentation.ts` và `worker/index.ts`; typecheck web.
- [ ] **Step 3: Commit** `feat(plans): trần token AI hằng tháng theo gói`.

### Task 9: Dung lượng

**Files:** Create `apps/web/src/lib/storageQuota.ts` với `assertStorageQuotaResponse(userId: string, bytes: number): Promise<NextResponse | null>` (gọi `checkUsageQuota({userId}, "storage.mb", { increment: ceil(bytes/1MB) })`; từ chối ⇒ `NextResponse.json({ error: "plan_limit_reached", details }, { status: 409 })` và phát sự kiện qua `assertUsageQuota`). Gọi **trước khi ghi** ở các route giảng viên tải nội dung của mình: `api/lesson-media/{audio,files,html,images,pdfs,transcripts,videos}`, `api/lesson-media/docx-import`, `api/lessons/[lessonId]/drafts` (docx), `api/instructor/courses/[courseId]/cover`, Live `slide-images`, `resource-upload`, `brand-logo`, `import-pptx`, `slot-image`, `api/instructor/teaching-tools/whiteboards/pages`, `api/instructor/teaching-tools/boards/[id]/attachments`, `api/exams/[id]/assets`, `api/exams/[id]/questions/import/word-commit`, `api/exams/[id]/oral-materials`, `api/van-dap/exams/[id]/materials`, `api/scorm-packages`, `api/h5p-packages`. **Không** gọi ở: bài nộp, ghi âm luyện tập, ảnh giám sát, bảng công khai, ảnh đại diện, sinh giọng đọc.

Cron: Create `apps/web/src/app/api/cron/storage-attribution/route.ts` (xác thực `CRON_SECRET` như các route cron có sẵn, gọi `attributeStoredFiles({ limit: 5000 })`, trả số tệp đã gán); thêm dòng `docker/cron/crontab` lúc 3h15 hằng đêm (`run.sh storage-attribution`), theo đúng cách `storage-orphan-sweep` được khai.

Client: các uploader của giảng viên đang hiện `error` của API ⇒ khi `error === "plan_limit_reached"` hiện `describePlanLimit(details)`. Tìm bằng grep các nơi gọi các route trên; nơi nào chỉ hiện chuỗi lỗi chung thì đổi sang câu này.

- [ ] **Step 1: Test** `storageQuota.test.ts` (hoặc DB test core-lms đã có ở Task 2) cho: Free 2.048 MB đầy ⇒ trả 409; tắt tầng gói ⇒ `null`.
- [ ] **Step 2:** Cài helper + gắn vào từng route (mỗi route một dòng, ngay sau khi biết kích thước tệp, trước khi ghi). Grep kiểm đủ: `grep -L assertStorageQuotaResponse <danh sách route>` ⇒ rỗng.
- [ ] **Step 3:** Cron route + crontab; typecheck.
- [ ] **Step 4: Commit** `feat(plans): chặn dung lượng theo gói khi giảng viên tải nội dung lên`.

### Task 10: Số giáo viên của tổ chức

**Files:** `packages/core-lms/src/org/members.ts` (`addOrgMember` ~:122: khi người được gắn vào tổ chức đã có vai trò `instructor`/`center_teacher`; `assignUserOrganization` ~:246 cùng điều kiện), `packages/core-lms/src/org/centerTeacher.ts` (`setOrgMemberCenterTeacher` ~:12 khi bật, người đó chưa có `instructor`), `packages/core-lms/src/auth/roles.ts` (`grantRole` ~:41 khi cấp `instructor`/`center_teacher` cho người có `organizationId` và chưa có vai trò giảng dạy nào trong hai vai đó), `apps/web/src/app/api/orgs/[id]/members/route.ts` (`errorStatus` ~:7: `plan_limit_reached` ⇒ 409 + details), `apps/web/src/app/org-admin/members/MemberImport.tsx` (~:317: lý do `plan_limit_reached` ⇒ "tổ chức đã đủ số giáo viên của gói").

Kiểm bằng `assertUsageQuota({ organizationId }, "org.max_instructors", { increment: 1 })` trong cùng transaction với thao tác. Nhập hàng loạt (`importOrgMembers`) tự nhận lỗi theo dòng vì gọi `addOrgMember`; `PlanLimitError` phải được bắt thành `{ outcome: "failed", reason: "plan_limit_reached" }` như `OrgMemberError`.

- [ ] **Step 1: Test** (DB): tổ chức `org_khoa` đã 30 giáo viên ⇒ `addOrgMember` một giảng viên ngoài ném; nhập 2 dòng khi còn 1 chỗ ⇒ dòng 1 `attached`, dòng 2 `failed` lý do `plan_limit_reached`; thêm học viên (không vai trò giảng dạy) ⇒ không bị đếm, không bị chặn; tổ chức không gói ⇒ được; tắt tầng gói ⇒ được.
- [ ] **Step 2:** FAIL ⇒ cài ⇒ PASS; chạy `-- org` và `-- roles` ⇒ PASS.
- [ ] **Step 3: Commit** `feat(plans): hạn mức số giáo viên của tổ chức`.

### Task 11: `/admin/plans` — người dùng thử vượt mức gói tham chiếu

**Files:** Create hàm `listTrialOverages(opts?: { sinceDays?: number }, db?)` trong `packages/core-lms/src/plans/admin.ts` (đọc `LearningEvent` `plan.limit.reached` có `payload.enforced = false` trong `sinceDays` (mặc định 30) ngày, gộp theo `(userId, key)` lấy `used` lớn nhất và lần gần nhất; trả `{ userId, displayName, email, key, used, referenceLimit, lastAt }[]`); Modify `apps/web/src/app/admin/plans/page.tsx` thêm mục "Người dùng thử vượt mức gói tham chiếu" (bảng: người, hạn mức, đã dùng / mức tham chiếu, lần gần nhất; trống ⇒ `<EmptyState>`).

- [ ] **Step 1: Test** DB: 2 sự kiện cùng người cùng khoá ⇒ 1 dòng, `used` lớn nhất; sự kiện `enforced: true` không vào danh sách.
- [ ] **Step 2:** FAIL ⇒ cài ⇒ PASS; trang; typecheck.
- [ ] **Step 3: Commit** `feat(plans): admin xem người dùng thử vượt mức gói tham chiếu`.

### Task 12: Soát cuối

- [ ] `pnpm --filter @feedbackme/core-lms test`, `pnpm --filter @feedbackme/core-feedback test`, `pnpm --filter @feedbackme/web test`, `pnpm --filter @feedbackme/web typecheck`, `pnpm lint` ⇒ đều xanh (lỗi có sẵn trước mốc 2 thì ghi lại, không sửa lan).
- [ ] Grep kiểm điều cấm: không `UPDATE`/`DELETE` `LearningEvent`; payload `plan.limit.reached` không có tên/email/tiền.
- [ ] Cập nhật spec §8 mục 2 "xong 28/11 (chưa lên prod)" và memory dự án.

## Lên prod (cùng mốc 3, không làm ở mốc này)

1. Trước deploy: `pnpm backfill:stored-files` trên 224 và đối chiếu tổng sổ với `du -sh` thư mục uploads (sổ ghi 1,15 GB / thực ~9 GB ngày 17/10) — lệch lớn thì sửa sổ trước, vì người dùng Free sẽ bị chặn theo sổ.
2. Deploy; migration `20261128200000` và `20261128210000` chạy ở bước migrate.
3. Kiểm: giảng viên dùng thử tạo phiếu ⇒ `maxResponses = 500`; danh sách `/admin/plans` mục mới hiện được.
