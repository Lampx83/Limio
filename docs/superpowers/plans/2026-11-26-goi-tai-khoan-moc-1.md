# Gói tài khoản — Mốc 1: dữ liệu, tầng tra quyền theo gói, dùng thử, quản trị gói

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Có bảng gói và thuê bao, `resolveFeatures` tra thêm tầng gói cho người giảng dạy, mọi giảng viên và tổ chức hiện có được dùng thử không giới hạn đến 01/03/2027 00:00 giờ VN, và admin sửa gói, gán gói trên giao diện.

**Architecture:** Module mới `packages/core-lms/src/plans/` giữ logic gói (gộp quyền, tra thuê bao, thao tác quản trị, cấp dùng thử). `permissions.ts` gọi module này ở tầng 2, sau override riêng của người dùng và trước override theo vai trò. Mọi thứ bị bỏ qua khi biến môi trường `PLANS_ENABLED` tắt. Mốc này **chưa** đặt điểm kiểm hạn mức nào (mốc 2), chưa có trang mua (mốc 3), chưa có trang OrgAdmin (mốc 4).

**Tech Stack:** Prisma + PostgreSQL, Vitest (DB test riêng, `packages/core-lms/src/test/setup.ts`), Next.js App Router (trang admin + API route).

**Spec:** `docs/tieu-chi/goi-tai-khoan.md` (đọc cùng kế hoạch này).

## Global Constraints

- Làm thẳng trên `main`, không tạo nhánh hay worktree (quy ước của người dùng).
- `core-lms` không import `core-feedback` và ngược lại; `packages/db` chỉ schema + client; `shared-types` chỉ type.
- Mọi thay đổi schema đi qua `prisma migrate` (không `db push`); ràng buộc CHECK viết bằng SQL thô trong migration.
- Mọi thao tác gán/sửa gói ghi `AuditLog` (`logAudit`) và phát `LearningEvent` trong cùng transaction.
- Namespace sự kiện `plan.*`, thêm `"plan."` vào `NON_LEARNER_ACTIVITY_PREFIXES`; payload chỉ id, khoá gói, nguồn, ngày ISO — không số tiền, tên, email.
- `Plan.entitlements` chỉ chứa khoá có `FeatureFlag.sellable = true`, đúng `valueType`.
- Ngày hết dùng thử: `2027-02-28T17:00:00.000Z` (= 01/03/2027 00:00 giờ Việt Nam).
- `PLANS_ENABLED` bật khi giá trị là `"1"` hoặc `"true"`; mọi giá trị khác (kể cả không đặt) là tắt.
- Chữ trên giao diện admin bằng tiếng Việt, dùng lớp chữ `.text-h1/.text-body/.text-meta` và banner `.banner-*` (CLAUDE.md §4.6).

## Review Focus

1. **Mốc thời gian:** thuê bao có `endsAt` đúng bằng thời điểm tra phải coi là **đã hết** (`now < endsAt`), và `startsAt` ở tương lai thì chưa hiệu lực. → test ở Task 4.
2. **Đổi tổ chức:** người dùng chuyển `organizationId` sang tổ chức khác thì quyền theo gói tổ chức đổi ngay ở lần tra kế tiếp (mốc 1 không đệm). → test ở Task 4.
3. **Gói ngừng bán (`active = false`):** không gán mới được, nhưng thuê bao đang có vẫn hiệu lực tới `endsAt`. → test ở Task 5.
4. **Gói thiếu một khoá bán được:** khoá vắng mặt trong mọi gói hiệu lực thì rơi về override vai trò và mặc định như cũ, không thành `null`. → test ở Task 4.
5. **Platform Admin và học viên:** không đi qua tầng gói; giá trị tra được y như trước khi có gói. → test ở Task 4.

---

## Bản đồ tệp

| Tệp | Trách nhiệm |
|---|---|
| `packages/db/prisma/schema.prisma` | `Plan`, `PlanPrice`, `Subscription`, enum, `Order.planPriceId` |
| `packages/db/prisma/migrations/<ts>_plans_subscriptions/migration.sql` | bảng + CHECK đúng một chủ thể |
| `packages/db/src/seed-feature-flags.ts` | cờ int mới, `ai_oral.access` bán được |
| `packages/db/src/seed-plans.ts` (mới) | tạo gói còn thiếu, không ghi đè gói admin đã sửa |
| `Dockerfile` | chạy `seed-plans.ts` sau `seed-feature-flags.ts` ở bước migrate |
| `packages/core-lms/src/plans/config.ts` | `plansEnabled`, trần kỹ thuật, ngày hết dùng thử, danh sách khoá gói |
| `packages/core-lms/src/plans/entitlements.ts` | gộp và kiểm `entitlements` (hàm thuần) |
| `packages/core-lms/src/plans/subscriptions.ts` | tra thuê bao hiệu lực, người giảng dạy, quyền theo gói, gói đứng tên |
| `packages/core-lms/src/plans/admin.ts` | sửa gói, giá; gán, gia hạn, huỷ thuê bao |
| `packages/core-lms/src/plans/trial.ts` | cấp dùng thử hàng loạt |
| `packages/core-lms/src/plans/index.ts` | re-export; thêm vào `packages/core-lms/src/index.ts` |
| `packages/core-lms/scripts/grant-plan-trials.ts` | script `backfill:plan-trials` |
| `packages/core-lms/src/auth/permissions.ts` | tầng 2 trong `resolveFeatures` |
| `packages/shared-types/src/events.ts` | 4 kiểu sự kiện + payload |
| `packages/core-lms/src/learning/activity.ts` | tiền tố `"plan."` |
| `packages/core-lms/src/auth/profile.ts`, `deleteUser.ts` | export / xoá thuê bao cá nhân |
| `apps/web/src/app/api/admin/plans/**`, `apps/web/src/app/api/admin/subscriptions/**` | API admin |
| `apps/web/src/app/admin/plans/**`, `apps/web/src/app/admin/_components/SubscriptionManager.tsx` | giao diện admin |
| `docker-compose.prod.yml`, `.env.prod.example`, `CLAUDE.md` | biến `PLANS_ENABLED`, ghi namespace |

---

### Task 1: Schema và migration

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (gần `model Order`, dòng ~2916)
- Create: `packages/db/prisma/migrations/<timestamp>_plans_subscriptions/migration.sql`
- Modify: `packages/core-lms/src/test/setup.ts` (hàm `cleanDb`)

**Interfaces:**
- Produces: model Prisma `plan`, `planPrice`, `subscription`; enum `PlanScope { individual organization }`, `PlanPeriod { month year }`, `SubscriptionSource { trial purchase contract admin }`; cột `Order.planPriceId String?`.

- [ ] **Step 1: Thêm vào schema**

```prisma
model Plan {
  id               String    @id @default(uuid())
  key              String    @unique
  name             String
  scope            PlanScope
  /// featureKey → giá trị; chỉ khoá sellable (kiểm ở core-lms/src/plans/entitlements.ts)
  entitlements     Json      @default("{}")
  /// Gói dùng thử: gói dùng để so "vượt mức" (pro / org_khoa). null với gói thường.
  referencePlanKey String?
  isPublic         Boolean   @default(false)
  sortOrder        Int       @default(0)
  active           Boolean   @default(true)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  prices           PlanPrice[]
  subscriptions    Subscription[]
}

model PlanPrice {
  id        String     @id @default(uuid())
  planId    String
  period    PlanPeriod
  amountVnd Int
  active    Boolean    @default(true)
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
  plan      Plan       @relation(fields: [planId], references: [id], onDelete: Cascade)
  orders    Order[]
  @@unique([planId, period])
}

model Subscription {
  id             String             @id @default(uuid())
  planId         String
  /// Đúng một trong userId / organizationId (CHECK trong migration SQL).
  userId         String?
  organizationId String?
  source         SubscriptionSource
  startsAt       DateTime
  endsAt         DateTime
  orderId        String?            @unique
  grantedById    String?
  note           String?
  cancelledAt    DateTime?
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt
  plan           Plan               @relation(fields: [planId], references: [id], onDelete: Restrict)
  user           User?              @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization   Organization?      @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  order          Order?             @relation(fields: [orderId], references: [id], onDelete: SetNull)
  @@index([userId, endsAt])
  @@index([organizationId, endsAt])
}
```

Thêm 3 enum, `Order.planPriceId String?` + relation `planPrice PlanPrice? @relation(fields: [planPriceId], references: [id], onDelete: SetNull)`, quan hệ ngược `subscriptions Subscription[]` trên `User`, `Organization`, `Order` (`subscription Subscription?`).

- [ ] **Step 2: Tạo migration ở chế độ chỉ tạo**

Run: `pnpm --filter @feedbackme/db exec prisma migrate dev --name plans_subscriptions --create-only`
Expected: thư mục migration mới, chưa áp.

- [ ] **Step 3: Thêm CHECK vào cuối `migration.sql`**

```sql
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_one_subject_chk"
  CHECK (num_nonnulls("userId", "organizationId") = 1);
```

- [ ] **Step 4: Áp migration cho DB dev và DB test**

Run: `pnpm db:migrate` rồi `pnpm db:generate`
Expected: "Your database is now in sync"; client sinh lại không lỗi. DB test theo cách `global-setup.ts` đang làm (chạy `pnpm --filter @feedbackme/core-lms test` một lần, phải không báo lệch schema).

- [ ] **Step 5: Thêm `subscription`, `planPrice`, `plan` vào `cleanDb`** — `subscription` xoá trước `order`, `user`, `organization`; `planPrice` và `plan` xoá sau `subscription` và `order`.

- [ ] **Step 6: Kiểm**

Run: `pnpm --filter @feedbackme/core-lms test -- src/auth/__tests__/permissions.test.ts`
Expected: PASS (chưa đổi hành vi).

- [ ] **Step 7: Commit**

```bash
git add packages/db/prisma packages/core-lms/src/test/setup.ts
git commit -m "feat(plans): bảng Plan, PlanPrice, Subscription (gói tài khoản mốc 1)"
```

---

### Task 2: Cờ hạn mức mới và danh mục gói

**Files:**
- Modify: `packages/db/src/seed-feature-flags.ts`
- Create: `packages/db/src/seed-plans.ts`
- Modify: `packages/db/package.json` (script `seed:plans`), `Dockerfile:127`
- Create: `packages/core-lms/src/plans/config.ts`
- Test: `packages/core-lms/src/plans/__tests__/catalog.test.ts`

**Interfaces:**
- Produces (`config.ts`):
  - `plansEnabled(): boolean`
  - `TRIAL_ENDS_AT: Date` (= `2027-02-28T17:00:00.000Z`)
  - `PLAN_LIMIT_KEYS: readonly string[]` = `activity.max_responses`, `gameshow.max_participants`, `exam.session.max_candidates`, `ai_oral.monthly_attempts`, `ai.tokens.monthly_override`, `storage.mb`, `org.max_instructors`, `org.active_learners`
  - `PLAN_BOOLEAN_KEYS: readonly string[]` = `limio_live.access`, `ai_oral.access`, `center.access`
  - `TECH_CEILINGS: Record<string, number>` = `activity.max_responses: 500`, `gameshow.max_participants: 300`, `exam.session.max_candidates: 5000`, `ai_oral.monthly_attempts: 100000`, `ai.tokens.monthly_override: 10000000`, `storage.mb: 10485760`, `org.max_instructors: 10000`, `org.active_learners: 1000000`
  - `PLAN_CATALOG: PlanSeed[]` với `PlanSeed = { key; name; scope: "individual" | "organization"; entitlements: Record<string, boolean | number>; referencePlanKey?: string; isPublic: boolean; sortOrder: number; prices?: { period: "month" | "year"; amountVnd: number }[] }`
- Produces (db): `seed-plans.ts` dùng lại `PLAN_CATALOG`. Vì `packages/db` không được import `core-lms`, đặt `PLAN_CATALOG` + `TECH_CEILINGS` ở `packages/shared-types/src/plans.ts` (chỉ hằng số, không logic) và `config.ts` re-export.

- [ ] **Step 1: Thêm cờ vào `FLAGS`** — 7 khoá int mới (mọi khoá trong `PLAN_LIMIT_KEYS` trừ `ai.tokens.monthly_override` đã có), `defaultValue: Prisma.JsonNull`, `sellable: true`, nhóm: `activity.*`/`gameshow.*` → `teaching_tools`, `exam.*` → `assessment`, `ai_oral.*` → `ai_oral`, `storage.*`/`org.*` → `lms`. Đổi `ai_oral.access` thành `sellable: true`.

- [ ] **Step 2: Viết `PLAN_CATALOG`** đúng bảng §6 của spec (số ở dạng nguyên, `storage.mb` theo MB). Gói `trial_individual` (`scope: individual`, `referencePlanKey: "pro"`) và `org_trial` (`scope: organization`, `referencePlanKey: "org_khoa"`) có `entitlements` = mọi khoá trong `PLAN_BOOLEAN_KEYS` là `true` + mọi khoá trong `PLAN_LIMIT_KEYS` lấy `TECH_CEILINGS` (`org.*` chỉ ở `org_trial`). Ghi chú quyết định: "mọi tính năng bật" = các boolean mà gói bán có, **không** bật mọi khoá sellable khác (vd `lms.enrollment.direct_payment`, `tournament.create.global` mặc định tắt; bật cho mọi người là đổi hành vi không ai yêu cầu). Giá: `pro` tháng 99000, năm 990000; `pro_plus` năm 2900000. `isPublic`: `free`, `pro`, `pro_plus`.

- [ ] **Step 3: Viết test thất bại `catalog.test.ts`**

```ts
it("gói dùng thử không thấp hơn gói tham chiếu ở bất kỳ khoá nào", () => {
  for (const t of PLAN_CATALOG.filter((p) => p.referencePlanKey)) {
    const ref = PLAN_CATALOG.find((p) => p.key === t.referencePlanKey)!;
    for (const [k, v] of Object.entries(ref.entitlements)) {
      if (typeof v === "number") expect(t.entitlements[k]).toBeGreaterThanOrEqual(v);
      if (v === true) expect(t.entitlements[k]).toBe(true);
    }
  }
});
it("không giá trị nào vượt trần kỹ thuật", () => { /* mọi số ≤ TECH_CEILINGS[k] */ });
it("TRIAL_ENDS_AT là 01/03/2027 00:00 giờ VN", () => {
  expect(TRIAL_ENDS_AT.toISOString()).toBe("2027-02-28T17:00:00.000Z");
});
```

(Test "mọi gói trong danh mục chỉ dùng khoá sellable đúng kiểu" nằm ở Task 3, vì cần `validateEntitlements`.)

- [ ] **Step 4: Viết `seed-plans.ts`** — với mỗi gói: `upsert` theo `key`, `update: {}` (không ghi đè chỉnh sửa của admin), `create` đầy đủ; giá `upsert` theo `(planId, period)` cũng `update: {}`. In số gói tạo mới.

- [ ] **Step 5: Gắn vào triển khai** — `packages/db/package.json`: `"seed:plans": "node --env-file=.env --import tsx src/seed-plans.ts"`; `Dockerfile:127`: thêm `&& (pnpm exec tsx src/seed-plans.ts || echo 'WARN: plans seed failed (non-fatal)')` ngay sau cụm feature-flags.

- [ ] **Step 6: Chạy**

Run: `pnpm --filter @feedbackme/db seed:feature-flags && pnpm --filter @feedbackme/db seed:plans && pnpm --filter @feedbackme/db seed:plans`
Expected: lần đầu "created 9", lần hai "created 0".

- [ ] **Step 7: Commit** — `feat(plans): cờ hạn mức và danh mục gói ban đầu`

---

### Task 3: Gộp và kiểm entitlements

**Files:**
- Create: `packages/core-lms/src/plans/entitlements.ts`
- Modify: `packages/core-lms/src/auth/permissions.ts` (chuyển `mergeValues` sang đây, `permissions.ts` import lại)
- Test: `packages/core-lms/src/plans/__tests__/entitlements.test.ts`

**Interfaces:**
- Produces:
  - `type FeatureValue = boolean | number | string[] | null` (chuyển từ `permissions.ts`, `permissions.ts` re-export để không vỡ chỗ gọi)
  - `mergeValues(valueType: "boolean" | "int" | "string_array", values: FeatureValue[]): FeatureValue`
  - `mergeEntitlements(flags: { key: string; valueType: string }[], list: Record<string, FeatureValue>[]): Record<string, FeatureValue>` — chỉ chứa khoá có mặt ở ít nhất một phần tử
  - `class PlanError extends Error { code: "unknown_key" | "non_sellable_key" | "invalid_value_type" | "plan_not_found" | "plan_inactive" | "invalid_subject" | "invalid_dates" | "subscription_not_found"; details?: unknown }`
  - `validateEntitlements(entitlements: unknown, flags: { key: string; valueType: string; sellable: boolean }[]): Record<string, FeatureValue>` — ném `PlanError`

- [ ] **Step 1: Test thất bại**

```ts
it("gộp int lấy MAX, boolean OR, bỏ khoá không ai có", () => {
  const flags = [{ key: "a", valueType: "int" }, { key: "b", valueType: "boolean" }, { key: "c", valueType: "int" }];
  expect(mergeEntitlements(flags, [{ a: 30, b: false }, { a: 125, b: true }])).toEqual({ a: 125, b: true });
});
it("từ chối khoá không sellable", () => {
  expect(() => validateEntitlements({ "teaching_tools.access": true }, [{ key: "teaching_tools.access", valueType: "boolean", sellable: false }]))
    .toThrow(expect.objectContaining({ code: "non_sellable_key" }));
});
it("từ chối sai kiểu và khoá lạ", () => { /* { "storage.mb": "20" } → invalid_value_type; { "x.y": 1 } → unknown_key */ });
it("mọi gói trong PLAN_CATALOG chỉ dùng khoá sellable đúng kiểu", async () => {
  // seed cờ bằng seed-feature-flags (hoặc tạo từ FLAGS) trong beforeAll
  const flags = await prisma.featureFlag.findMany();
  for (const p of PLAN_CATALOG) expect(() => validateEntitlements(p.entitlements, flags)).not.toThrow();
});
```

- [ ] **Step 2: Chạy** `pnpm --filter @feedbackme/core-lms test -- src/plans` → FAIL (chưa có module).
- [ ] **Step 3: Viết `entitlements.ts`**; `permissions.ts` import `mergeValues`, `FeatureValue` từ `../plans/entitlements`.
- [ ] **Step 4: Chạy** `pnpm --filter @feedbackme/core-lms test -- src/plans src/auth/__tests__/permissions.test.ts` → PASS.
- [ ] **Step 5: Commit** — `feat(plans): gộp và kiểm quyền của gói`

---

### Task 4: Tra quyền theo gói trong `resolveFeatures`

**Files:**
- Create: `packages/core-lms/src/plans/subscriptions.ts`, `packages/core-lms/src/plans/index.ts`
- Modify: `packages/core-lms/src/auth/permissions.ts:71-125`, `packages/core-lms/src/index.ts`
- Test: `packages/core-lms/src/plans/__tests__/resolvePlan.test.ts`

**Interfaces:**
- Consumes: `mergeEntitlements` (Task 3), `plansEnabled` (Task 2).
- Produces:
  - `type PlanSubjectKind = "admin" | "teaching" | "other"`
  - `getPlanSubjectKind(userId: string, db?): Promise<PlanSubjectKind>` — `admin` nếu có vai trò `admin`; `teaching` nếu có vai trò `instructor` / `center_teacher` / `org_admin` (mọi phạm vi) hoặc có ít nhất một dòng `CourseInstructor`; còn lại `other`
  - `type ActiveSubscription = { id: string; planKey: string; planName: string; scope: "individual" | "organization"; source: SubscriptionSource; sortOrder: number; startsAt: Date; endsAt: Date; entitlements: Record<string, FeatureValue>; referencePlanKey: string | null }`
  - `getActiveSubscriptions(userId: string, now?: Date, db?): Promise<ActiveSubscription[]>` — của chính người đó + của `User.organizationId`; hiệu lực khi `cancelledAt` null, `startsAt <= now < endsAt`
  - `getPlanEntitlementsForUser(userId: string, now?: Date, db?): Promise<Record<string, FeatureValue> | null>` — `null` khi `!plansEnabled()` hoặc kind ≠ `teaching`; không có thuê bao nào thì dùng gói `free` (không có dòng `free` ⇒ `null`)
  - `getEffectivePlan(userId: string, now?: Date, db?): Promise<ActiveSubscription | null>` — `sortOrder` cao nhất; hoà thì ưu tiên `endsAt` xa hơn

- [ ] **Step 1: Test thất bại** (`process.env.PLANS_ENABLED = "1"` trong `beforeEach`, trả lại trong `afterEach`; seed cờ + gói bằng `PLAN_CATALOG`)

```ts
it("giảng viên không có gói → giá trị gói free", async () => {
  expect(await resolveFeature(teacher, "storage.mb")).toBe(2048);
});
it("Pro cá nhân + org_khoa của tổ chức → lấy số lớn hơn", async () => {
  // pro storage 20480, org_khoa 204800
  expect(await resolveFeature(teacher, "storage.mb")).toBe(204800);
});
it("học viên thuộc tổ chức có gói → như khi chưa có gói", async () => {
  expect(await resolveFeature(learner, "storage.mb")).toBeNull();
});
it("platform admin không đi qua tầng gói", async () => { /* null với storage.mb */ });
it("UserFeatureOverride còn hạn thắng gói", async () => { /* override storage.mb = 7 → 7 */ });
it("endsAt đúng bằng now là đã hết; startsAt tương lai chưa hiệu lực", async () => {
  // Pro với endsAt = now → về free (2048); Pro với startsAt = now+1h → free
});
it("đổi organizationId thì gói tổ chức theo ngay", async () => { /* chuyển sang org không gói → 20480 (Pro) */ });
it("khoá vắng mặt trong mọi gói rơi về vai trò/mặc định", async () => {
  // gán RoleFeatureOverride instructor tournament.create.global = true → vẫn true
});
it("PLANS_ENABLED tắt → không tầng gói", async () => { /* delete env → storage.mb null */ });
```

- [ ] **Step 2: Chạy** `pnpm --filter @feedbackme/core-lms test -- src/plans/__tests__/resolvePlan.test.ts` → FAIL.
- [ ] **Step 3: Viết `subscriptions.ts`** — một truy vấn `subscription.findMany` với `OR: [{ userId }, { organizationId: user.organizationId }]` kèm `plan`; khi người dùng không có tổ chức thì chỉ nhánh `userId`.
- [ ] **Step 4: Sửa `resolveFeatures`** — sau `userOverride`: gọi `getPlanEntitlementsForUser` **một lần** trước vòng lặp; nếu khoá có trong kết quả thì dùng và `continue`; không thì đi tiếp tầng vai trò như cũ. Cập nhật chú thích đầu tệp (thứ tự tra mới).
- [ ] **Step 5: Chạy** `pnpm --filter @feedbackme/core-lms test -- src/plans src/auth` → PASS.
- [ ] **Step 6: Commit** — `feat(plans): resolveFeatures tra quyền theo gói cho người giảng dạy`

---

### Task 5: Sự kiện và thao tác quản trị gói

**Files:**
- Modify: `packages/shared-types/src/events.ts`, `packages/core-lms/src/learning/activity.ts:9`
- Create: `packages/core-lms/src/plans/admin.ts`
- Test: `packages/core-lms/src/plans/__tests__/admin.test.ts`

**Interfaces:**
- Produces (shared-types): `PlanSubscriptionStarted: "plan.subscription.started"`, `PlanSubscriptionExtended: "plan.subscription.extended"`, `PlanSubscriptionCancelled: "plan.subscription.cancelled"`, `PlanLimitReached: "plan.limit.reached"` (chỉ khai báo, dùng ở mốc 2); payload:
  - `PlanSubscriptionPayload { subscriptionId: string; planKey: string; scope: "individual" | "organization"; organizationId?: string; source: string; startsAt: string; endsAt: string }`
  - `PlanLimitReachedPayload { metric: string; limit: number; used: number; planKey: string; source: "individual" | "organization"; enforced: boolean }`
- Produces (`admin.ts`), mọi hàm `(actorUserId, …, db?)`, chạy trong `$transaction`, ghi `logAudit` + `emitEvent`:
  - `updatePlan(actorUserId: string, planKey: string, patch: { name?: string; entitlements?: unknown; isPublic?: boolean; active?: boolean; sortOrder?: number }): Promise<void>` — audit `plan.updated` (payload: khoá, giá trị cũ/mới của `entitlements`)
  - `upsertPlanPrice(actorUserId: string, planKey: string, period: "month" | "year", amountVnd: number, active: boolean): Promise<void>` — audit `plan.price.updated`; `amountVnd` nguyên dương
  - `assignSubscription(actorUserId: string, input: { planKey: string; userId?: string; organizationId?: string; startsAt: Date; endsAt: Date; source: "contract" | "admin"; note?: string }): Promise<{ subscriptionId: string }>` — `PlanError`: `plan_not_found`, `plan_inactive`, `invalid_subject` (không đúng một chủ thể, hoặc `scope` của gói không khớp chủ thể), `invalid_dates` (`endsAt <= startsAt`); sự kiện `plan.subscription.started`, subject = `userId` (cá nhân) hoặc `actorUserId` (tổ chức); audit `plan.subscription.assigned` với `targetUserId` khi cá nhân
  - `extendSubscription(actorUserId: string, subscriptionId: string, newEndsAt: Date): Promise<void>` — `newEndsAt` phải sau `startsAt`; sự kiện `plan.subscription.extended`
  - `cancelSubscription(actorUserId: string, subscriptionId: string, note?: string): Promise<void>` — đặt `cancelledAt = now`; sự kiện `plan.subscription.cancelled`
  - `listPlansForAdmin(db?)`, `listSubscriptions(filter: { userId?: string; organizationId?: string }, db?)` — trả cả thuê bao đã hết/huỷ, mới nhất trước

- [ ] **Step 1: Thêm 4 hằng sự kiện + 2 payload** vào `events.ts` (kèm chú thích "payload chỉ id, khoá gói, nguồn, ngày; không số tiền, tên, email"); thêm `"plan."` vào `NON_LEARNER_ACTIVITY_PREFIXES`.
- [ ] **Step 2: Test thất bại**

```ts
it("gán org_truong cho tổ chức: có AuditLog, có sự kiện, giảng viên thấy quyền từ startsAt", async () => {});
it("gán gói individual cho tổ chức → invalid_subject; endsAt ≤ startsAt → invalid_dates", async () => {});
it("gói active=false: gán mới bị plan_inactive, thuê bao cũ vẫn hiệu lực", async () => {});
it("updatePlan với khoá không sellable → non_sellable_key, gói không đổi", async () => {});
it("huỷ thuê bao → về gói còn lại hoặc free ở lần tra kế tiếp", async () => {});
it("payload sự kiện plan.* không chứa amount, email, displayName", async () => {
  const ev = await prisma.learningEvent.findMany({ where: { eventType: { startsWith: "plan." } } });
  for (const e of ev) expect(JSON.stringify(e.payload)).not.toMatch(/amount|email|displayName|@/i);
});
it("plan.* không tính là hoạt động học", () => { expect(isLearnerActivityEventType("plan.subscription.started")).toBe(false); });
```

(Tên hàm kiểm tiền tố: dùng đúng tên đang export ở `activity.ts:11`.)

- [ ] **Step 3: Chạy** → FAIL. **Step 4: Viết `admin.ts`**. **Step 5: Chạy** `pnpm --filter @feedbackme/core-lms test -- src/plans` → PASS.
- [ ] **Step 6: Commit** — `feat(plans): sửa gói, gán/gia hạn/huỷ thuê bao, sự kiện plan.*`

---

### Task 6: Cấp dùng thử hàng loạt

**Files:**
- Create: `packages/core-lms/src/plans/trial.ts`, `packages/core-lms/scripts/grant-plan-trials.ts`
- Modify: `packages/core-lms/package.json` (`backfill:plan-trials`, `backfill:plan-trials:prod` theo mẫu `.env.prod-import`), `package.json` gốc (`backfill:plan-trials`)
- Test: `packages/core-lms/src/plans/__tests__/trial.test.ts`

**Interfaces:**
- Consumes: `getPlanSubjectKind` (Task 4), `TRIAL_ENDS_AT` (Task 2), `emitEvent`, `logAudit`.
- Produces: `grantTrialSubscriptions(opts: { dryRun: boolean; actorUserId?: string; now?: Date }, db?): Promise<{ usersGranted: number; orgsGranted: number; skipped: number; sellableRoleOverrides: { roleName: string; featureKey: string; value: FeatureValue }[] }>` — ném `Error("plans_disabled")` khi `!plansEnabled()`.

Quy tắc: người dùng có kind `teaching` và **chưa có** thuê bao `source = trial` nào → tạo `trial_individual`; mỗi `Organization` chưa có thuê bao trial → tạo `org_trial`; `startsAt = now`, `endsAt = TRIAL_ENDS_AT`, `source = trial`; sự kiện `plan.subscription.started` với `eventKey = "plan.trial:user:<id>"` / `"plan.trial:org:<id>"`. `dryRun` không ghi gì, chỉ đếm và liệt kê `RoleFeatureOverride` đang đặt trên khoá sellable (để người chạy đối chiếu không ai mất quyền).

- [ ] **Step 1: Test thất bại**

```ts
it("chạy hai lần: mỗi giảng viên và tổ chức đúng một gói dùng thử", async () => {});
it("học viên không nhận gói dùng thử", async () => {});
it("dryRun không ghi dòng nào", async () => {});
it("PLANS_ENABLED tắt → ném plans_disabled", async () => {});
it("giảng viên dùng thử có quyền ≥ Pro ở mọi khoá", async () => {
  expect(await resolveFeature(teacher, "ai_oral.monthly_attempts")).toBe(100000);
});
```

- [ ] **Step 2–3:** chạy → FAIL, viết `trial.ts` + script (`--dry-run` mặc định **bật**; ghi thật phải có `--apply`; in tóm tắt và danh sách override).
- [ ] **Step 4: Chạy** test → PASS; rồi `PLANS_ENABLED=1 pnpm backfill:plan-trials` trên dev → in số đếm, không ghi.
- [ ] **Step 5: Commit** — `feat(plans): cấp dùng thử đến 01/03/2027 cho giảng viên và tổ chức hiện có`

---

### Task 7: Dữ liệu cá nhân

**Files:**
- Modify: `packages/core-lms/src/auth/profile.ts:235` (`exportProfile`), `packages/core-lms/src/auth/deleteUser.ts:75`
- Test: `packages/core-lms/src/auth/__tests__/exportPlanSubscriptions.test.ts`

- [ ] **Step 1: Test thất bại** — `exportProfile` có mảng `subscriptions` (`planKey`, `source`, `startsAt`, `endsAt`, `cancelledAt`) chỉ của cá nhân, không có thuê bao của tổ chức; `deleteUser` xoá thuê bao cá nhân (FK cascade đã có — test xác nhận không còn dòng).
- [ ] **Step 2–4:** FAIL → thêm trường vào kiểu `ExportedProfile` và truy vấn → PASS (`pnpm --filter @feedbackme/core-lms test -- src/auth`).
- [ ] **Step 5: Commit** — `feat(plans): gói cá nhân trong xuất dữ liệu và xoá tài khoản`

---

### Task 8: API và giao diện quản trị gói

**Files:**
- Create: `apps/web/src/app/api/admin/plans/route.ts` (GET), `apps/web/src/app/api/admin/plans/[key]/route.ts` (PATCH), `apps/web/src/app/api/admin/plans/[key]/prices/route.ts` (PUT), `apps/web/src/app/api/admin/subscriptions/route.ts` (GET `?userId|organizationId`, POST), `apps/web/src/app/api/admin/subscriptions/[id]/route.ts` (PATCH `{ action: "extend", endsAt } | { action: "cancel", note? }`)
- Create: `apps/web/src/app/admin/plans/page.tsx`, `apps/web/src/app/admin/plans/PlansEditor.tsx`, `apps/web/src/app/admin/_components/SubscriptionManager.tsx`
- Modify: `apps/web/src/app/admin/orgs/[id]/page.tsx`, `apps/web/src/app/admin/users/[id]/page.tsx`, menu admin (cùng chỗ đang liệt kê `ai-tokens`, `storage`)
- Test: `apps/web/src/app/api/admin/subscriptions/route.test.ts` (theo mẫu `api/admin/users/[userId]/route.test.ts`)

**Interfaces:**
- Consumes: mọi hàm Task 5; `isAdmin`. Lỗi `PlanError` → 400 `{ error: code }`; `plan_not_found`/`subscription_not_found` → 404; không phải admin → 403.

- [ ] **Step 1: Test route thất bại** — người không phải admin POST → 403; admin POST hợp lệ → 201 `{ subscriptionId }`; gói individual cho tổ chức → 400 `{ error: "invalid_subject" }`.
- [ ] **Step 2–4:** viết route → PASS (`pnpm --filter @feedbackme/web test -- src/app/api/admin/subscriptions`).
- [ ] **Step 5: Trang `/admin/plans`** — bảng gói (tên, khoá, phạm vi, công khai, đang bán, số thuê bao hiệu lực); bấm một gói mở form: mỗi khoá trong `PLAN_LIMIT_KEYS` một ô số (trống = không đặt), mỗi khoá `PLAN_BOOLEAN_KEYS` một công tắc, giá tháng/năm (chỉ gói cá nhân). Banner `.banner-info` đầu trang khi `PLANS_ENABLED` tắt: "Gói chưa bật trên máy chủ này; sửa ở đây chưa có tác dụng."
- [ ] **Step 6: `SubscriptionManager`** — nhận `{ userId } | { organizationId }`; liệt kê thuê bao (gói, nguồn, từ ngày, đến ngày, trạng thái Hiệu lực/Đã hết/Đã huỷ); form "Gán gói" (chọn gói đúng phạm vi, ngày bắt đầu, ngày kết thúc, ghi chú hợp đồng); nút "Gia hạn" và "Huỷ" (hỏi xác nhận). Ngày hiện bằng `<DateTime>`; nhập ngày theo giờ VN (`lib/datetime.ts`). Gắn vào trang tổ chức và trang người dùng.
- [ ] **Step 7: Kiểm trên trình duyệt dev** — `preview_start`, đăng nhập admin dev, sửa `storage.mb` của Free, gán `org_khoa` cho một tổ chức, gia hạn, huỷ; xem `read_console_messages` không lỗi; chụp màn hình.
- [ ] **Step 8: Commit** — `feat(plans): trang quản trị gói và gán gói cho tổ chức, người dùng`

---

### Task 9: Biến môi trường và tài liệu

**Files:**
- Modify: `docker-compose.prod.yml` (`x-web-env` thêm `PLANS_ENABLED: ${PLANS_ENABLED:-}`, cạnh `STORAGE_LEDGER` dòng ~95), `.env.prod.example`, `CLAUDE.md` §4.2 (một gạch đầu dòng namespace `plan.*`), `docs/tieu-chi/goi-tai-khoan.md` §8 (đánh dấu mốc 1 xong)

- [ ] **Step 1:** thêm biến + chú thích "chỉ bật ở limio.vn (224); máy chủ riêng của trường để trống".
- [ ] **Step 2: CLAUDE.md** — "Gói tài khoản (xem `docs/tieu-chi/goi-tai-khoan.md`): `plan.subscription.{started,extended,cancelled}`, `plan.limit.reached`; payload chỉ id, khoá gói, nguồn, ngày; không tính là hoạt động học. Tầng gói nằm trong `resolveFeatures` (`core-lms/src/plans/`), chỉ áp cho người giảng dạy, tắt khi `PLANS_ENABLED` trống; `Plan.entitlements` chỉ chứa khoá sellable."
- [ ] **Step 3: Toàn bộ kiểm**

Run: `pnpm typecheck && pnpm test`
Expected: không lỗi kiểu; mọi test xanh (kể cả `ownedPracticeExcluded`, `teacherAssistantFreshness` — mốc này không đổi giao diện giảng viên).

- [ ] **Step 4: Commit** — `chore(plans): biến PLANS_ENABLED và ghi chú namespace plan.*`

---

## Sau mốc 1 (ngoài kế hoạch này)

Hoãn sang mốc 2 có chủ ý: đệm Redis cho tầng gói (mốc 1 chỉ thêm một truy vấn mỗi lần tra, chưa có chỗ đếm nóng), danh sách "ai vượt mức Pro/Khoa" trên `/admin/plans` (cần sự kiện `plan.limit.reached` do các điểm kiểm của mốc 2 phát ra), và việc gắn `ai.tokens.monthly_override` vào ví token.

Lên prod: deploy → `PLANS_ENABLED=1` trong `/etc/feedbackme/.env.prod` → `$COMPOSE up -d web` → chạy `backfill:plan-trials` (thử) → đọc danh sách override → chạy `--apply`. Từ lúc này tài khoản giảng viên **mới** ở gói Free nhưng chưa có điểm kiểm hạn mức nào (mốc 2), nên thực tế chưa ai bị chặn, trừ các boolean Free tắt (`center.access`).
