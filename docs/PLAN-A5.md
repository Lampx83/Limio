# PLAN-A5 — Module Thi trực tuyến (Online Exam)

> **Phạm vi**: kế hoạch triển khai toàn diện cho module thi trực tuyến của FeedBackMe.
> **Ngày chốt**: 2026-05-13.
> **Source of truth nghiệp vụ**: `docs/SPEC.docx` §A7 + bổ sung trong tài liệu này.
> **Nguyên tắc làm việc**: pause-per-feature (checklist → code → test → stop), tag Feature ID trong commit.

---

## 0. Tổng quan kiến trúc

Module A5 (Exam) là **mở rộng của LMS Core**, gồm 3 sub-module tổ hợp:

| Sub | Tên | Trạng thái |
|---|---|---|
| **A5.1** | Question Bank | Mới (P1) |
| **A5.2** | Quản lý đề thi (Exam Builder) | 70% (đã có meta/passages/questions/publish; thiếu schedule, random pool, clone) |
| **A5.3** | Quản lý thi + Realtime monitoring | 60% (đã có attempt flow + live dashboard prototype; thiếu actions, drill-down, persist heartbeat) |

Cộng thêm 4 layer cross-cutting: **A5.4** Item Analytics, **A5.5** Proctoring, **A5.6** Bridge Feedback Engine, **A5.7** LLM-assisted grading.

Tuân thủ 5 nguyên tắc CLAUDE.md §5: event sourcing bắt buộc · không cross-module import · skill tag tiền đề personalization · privacy GDPR default · anti-farming/adaptive sizing.

---

## 1. Audit hiện trạng (2026-05-13)

### 1.1. Schema đã có (`packages/db/prisma/schema.prisma`)

`Exam` · `ExamPassage` · `ExamAsset` · `ExamQuestion` · `ExamQuestionSkillTag` · `ExamPassageSkillTag` · `ExamAttempt` · `ExamAnswer` · `ExamGradeHistory` · `ExamIncident` + đầy đủ enum (`ExamStatus`, `ExamGradingMode`, `ExamProctoringLevel`, `ExamAttemptStatus`, `ExamQuestionType`, `ExamIncidentType`...).

Index nóng đã có: `(status, openAt, closeAt)`, `(examId, status)`, `(userId, submittedAt)`, `(status, startedAt)` cho autosubmit job.

### 1.2. Services (`packages/core-lms/src/exam/`)

`exams.ts`, `attempts.ts`, `submission.ts`, `incidents.ts` — đã có `createExam`, `updateExam`, `publishExam`, `startExamAttempt`, `saveAnswer`, `claimAttemptSession`, `submitExamAttempt`, `autoSubmitExpiredAttempts`, `getExamAttemptResult`, `logExamIncident`, `listAttemptIncidents`, manual grading.

### 1.3. API routes (`apps/web/src/app/api/`)

`exams/...` (CRUD + publish + assets + passages + questions + pending-grades) · `exam-attempts/...` (start/claim/answers/incidents/submit/result/**heartbeat** mới) · `exams/[id]/live` (SSE, mới) · `cron/exam-autosubmit`.

### 1.4. UI

- **Student**: [`apps/web/src/components/ExamPlayer.tsx`](../apps/web/src/components/ExamPlayer.tsx) — autosave, single-tab claim, incident detection, heartbeat 10s.
- **Instructor**: list (`instructor/exams`), edit (`instructor/courses/[id]/exams/[examId]`), grading, **live dashboard** với dot grid (`instructor/courses/[id]/exams/[examId]/live`).

### 1.5. Infra

- Cron sidecar (`docker/cron/crontab`) chạy `exam-autosubmit` mỗi phút.
- Bus realtime: in-memory pub/sub trong `apps/web/src/lib/exam-live-bus.ts` (single Node instance).
- LLM: OpenAI (`apps/web/src/lib/openaiClient.ts`), endpoint `suggest-grade` đã có.

### 1.6. Khoảng trống chính

1. ✅ ~~`ExamAttempt.lastHeartbeatAt` chưa persist~~ (D1)
2. ✅ ~~Instructor actions trên dashboard~~: extend / force-submit / reset-session / disqualify / message / broadcast (D3 + D4)
3. ✅ ~~Drill-down 1 attempt~~ với timeline (D5)
4. ✅ ~~Heartbeat-lost detector~~ + auto red dot (D6)
5. **Không có code-based exam access (Thi tự do + Thi theo phân công) — P1.0 T2-T3a**
6. Không có Question Bank (questions hiện exam-scoped, không reusable)
7. Không có scheduling + cohort
8. Không có random pool
9. Không có item analytics
10. Proctoring chỉ basic (incident log)
11. Không có diagnostic report sau exam
12. Không có e2e test

---

## 2. Phase Roadmap

| Phase | Tên | Tuần | Sub-features | Mục tiêu thoát phase |
|---|---|---|---|---|
| ✅ P0 | LMS Core Exam runnable | (đã xong) | A5.2.1–3, A5.3.1–2 | Tạo đề → thi → auto-grade → manual grade |
| ✅ P0.5 | Live monitoring v1 | T1 *(done 2026-05-13)* | A5.3.3–6 | Realtime + can thiệp |
| **P1.0** | **Code-based exam access** *(mới — chèn trước P1)* | **T2 + T3a** | **A5.8.1–9** | **Thi tự do + Thi theo phân công không cần login** |
| P1 | Question Bank | T3b | A5.1.1–6 | Tách câu hỏi reusable cross-course |
| P1.5 | Scheduling + Cohort | T4 (½) | A5.2.6–7 | Mở thi cho lớp |
| P2 | Random pool + Clone | T4 (½) | A5.2.4–5 | Mỗi SV 1 đề khác |
| P2.5 | Item Analytics | T5 | A5.4.1–3 | Đo chất lượng câu hỏi |
| P3 | Proctoring `standard` | T6–7 | A5.5.1–3 | Webcam + pattern detect |
| P3.5 | Proctoring `strict` + adaptive | T8 | A5.5.4–5, A5.6 | Lockdown + diagnostic feedback |
| P4 | LLM rubric grading | T8 | A5.7 | Giảm tải instructor 60% |
| P5 | Scale-out | (khi cần) | Bus → Redis, partition tables | > 5k concurrent |

---

## 3. Quyết định đã chốt

| # | Quyết định | Lý do |
|---|---|---|
| 1 | Question Bank visibility: `private \| course` thực tế ở P1. Enum giữ `org` nhưng treat = `private` cho tới khi có multi-tenant | Tránh marketplace + moderation. Export/import CSV/QTI là đủ cho cross-org sharing |
| 2 | `Cohort` tách riêng khỏi `Enrollment` | Enrollment có invariant `@@unique([userId, courseId])` không cho 1 SV thuộc 2 cohort cùng course. Cohort là administrative grouping, không phải trạng thái học |
| 3 | Random pool: default `per_attempt` (mỗi SV 1 snapshot) + toggle `per_publish` | Giá trị chính của random pool là chống share đề. Per-publish chỉ là shuffle = đã có `Exam.shuffleQuestions` |
| 4 | Random pool seed: `sha256(examId + userId + sectionId)` deterministic | Resume cùng SV ra same đề. 2 SV ra cùng đề = bug, không reproduce |
| 5 | Proctoring enforce 4 tier: `none \| basic \| standard \| strict` với mapping cơ chế rõ ràng (xem §6.1) | `basic` là default sau publish. Không cho hạ level khi exam đang mở |
| 6 | LLM provider: OpenAI (override CLAUDE.md). Model `gpt-4o-mini` (structured output JSON) cho draft grade, `gpt-4o` cho re-grade dispute | Project đã có `OPENAI_API_KEY` + `openaiClient` hoạt động |
| 7 | Workers: giữ cron sidecar cho định kỳ. **Không** tạo `apps/workers` ở P0.5–P2.5 | Chưa có Redis. Job analytics ≤ 30s → fit cron. BullMQ chỉ khi cần queue thực sự (P3 proctoring image processing) |
| 8 | Live bus: in-memory ở P0.5–P4. Swap Redis pub/sub ở P5 khi cần multi-instance | 1 Node container hiện tại đủ |
| 9 | Heartbeat write coalescing: max 1 UPDATE DB / 30s / attempt; bus cache sub-second | Tránh hot row với 500 SV × 10s = 50 req/s |
| 10 | Mọi LLM grade phải có instructor approve, lưu `ExamGradeHistory.reason: "llm_assisted"` | Audit GDPR + chống dispute |
| 11 | **P1.0**: 3 mode access song song qua enum `ExamAccessMode`, default vẫn là `authenticated` | Không break exam hiện có. Instructor toggle khi tạo/edit |
| 12 | **P1.0**: `ExamCandidate` là entity riêng, **không** pollute `User` bằng shadow account | User table không gắn email/password rác. Module Auth không cần đặc biệt hoá candidate. Module B/C filter `userId==null` ở event consumer |
| 13 | **P1.0**: `ExamAttempt.userId` đổi thành nullable + XOR với `candidateId` qua CHECK constraint, partial unique index | Giữ FK an toàn, không cần shadow user. Cần raw SQL migration vì Prisma không tự sinh partial unique |
| 14 | **P1.0**: Candidate session = HttpOnly JWT cookie signed `NEXTAUTH_SECRET`, không qua NextAuth | NextAuth assume user account. Cookie self-contained, không cần DB roundtrip mỗi request |
| 15 | **P1.0**: Candidate attempts **không** contribute BKT/XP/badge | Không có User → không có `LearnerSkillState`. Skill-tag analytics vẫn ghi qua `LearningEvent` (cho item analytics), nhưng learner-side bị skip |
| 16 | **P1.0**: 7 câu hỏi mở — đã chốt 2026-05-13 (xem §10.2 cho chi tiết) | — |
| 17 | **P1.0 / Q1**: Open mode **bắt buộc** nhập SĐT + email | Hai mode use case chính (đánh giá đầu kỳ + tuyển sinh) đều cần kênh liên hệ với candidate. Form validation: email regex, SĐT 9-11 số VN |
| 18 | **P1.0 / Q2**: Rate-limit **50 attempt/giờ/IP** cho open mode | Phù hợp lab phòng máy 30-50 SV cùng NAT. Không cần ipAllowlist phức tạp. Vượt → 429 + audit event |
| 19 | **P1.0 / Q3**: Email integration **trong scope P1.0** — gửi mã dự thi tự động cho assigned mode | User chấp nhận đẩy scope. Cần chọn provider (Resend / SendGrid / SES) + add env vars. Template Vietnamese |
| 20 | **P1.0 / Q4**: Candidate **không đổi được** `displayName` ở cả 2 mode | Chống mạo danh. Open mode: instructor edit sau khi thi nếu có typo; ghi audit `exam.candidate.renamed` |
| 21 | **P1.0 / Q5**: Resume — Assigned: được (nhập lại mã) · Open: không (mất cookie = candidate mới) | Assigned mã = identity; open mã = ticket 1-shot |
| 22 | **P1.0 / Q6**: Kết quả **luôn re-enter code** mỗi lần xem, không dùng cookie public URL | Bảo mật cao hơn: candidate share device/cookie không gây leak điểm. Form `/exam/[code]/result` nhập lại mã → verify → render result |
| 23 | **P1.0 / Q7**: Candidate attempts ghi `LearningEvent` với `userId=null, candidateId=<id>`. Module B/C consumer filter | Schema: `LearningEvent` thêm `candidateId String?` nullable + CHECK `(userId IS NOT NULL OR candidateId IS NOT NULL)` |
| 24 | **P1.0 / GDPR**: Export-only API, delete handled out-of-band (admin DB) | User override 2026-05-13. Lý do: bảo toàn academic record (score, audit). Khi cần xoá, instructor/DBA anonymise metadata thủ công (xoá phone/email + đổi displayName). Future: add anonymise API nếu volume tăng |

---

## 4. Schema additions (sequenced)

Mỗi migration là 1 PR, đặt tên `YYYYMMDDHHMM_<name>` và áp tuần tự. Không bao giờ UPDATE/DELETE bảng append-only (`LearningEvent`, `ExamIncident`, `ExamGradeHistory`, `ExamMessage` sau khi sent).

### 4.1. M1 — `add_exam_last_heartbeat` (P0.5, T1)

```prisma
model ExamAttempt {
  // ... existing fields
  lastHeartbeatAt DateTime?
  @@index([status, lastHeartbeatAt]) // hot: heartbeat-lost scanner
}
```

### 4.2. M2 — `add_exam_messages` (P0.5, T1)

```prisma
model ExamMessage {
  id         String  @id @default(uuid())
  attemptId  String? // null = broadcast tới mọi in-progress attempt
  examId     String
  fromUserId String
  body       String  @db.Text
  sentAt     DateTime @default(now())
  readAt     DateTime?

  attempt ExamAttempt? @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  exam    Exam @relation(fields: [examId], references: [id], onDelete: Cascade)
  from    User @relation("ExamMessageSender", fields: [fromUserId], references: [id])

  @@index([attemptId, sentAt])
  @@index([examId, sentAt])
}
```

### 4.3. M3 — `code_based_exam_access` (P1.0, T2)

Hỗ trợ 2 chế độ thi không cần User login:
- **Thi tự do** (`open_code`): 1 mã chung cho ca thi, candidate nhập tên rồi vào thi.
- **Thi theo phân công** (`assigned_code`): instructor add danh sách candidate trước, mỗi candidate 1 mã riêng.

```prisma
enum ExamAccessMode {
  authenticated   // mode hiện tại — User login + Enrollment
  open_code       // Thi tự do
  assigned_code   // Thi theo phân công
}

model Exam {
  // ... existing
  accessMode      ExamAccessMode @default(authenticated)
  // open_code mode: 6-8 ký tự alphanumeric, instructor có thể rotate.
  openCode        String?  @unique
  // open_code mode: cap số attempt để chống spam.
  openMaxAttempts Int?
}

model ExamCandidate {
  id          String   @id @default(uuid())
  examId      String
  // Hiển thị trong dashboard + freeze vào ExamAttempt.candidateDisplayName tại start.
  // Q4: KHÔNG cho phép candidate tự đổi sau khi tạo. Instructor có thể edit
  // sau exam, ghi audit `exam.candidate.renamed`.
  displayName String
  // Open mode (Q1): bắt buộc { phone, email }. Optional: { studentCode, class }
  // Assigned mode: optional toàn bộ (instructor nhập gì lưu nấy).
  // GDPR: export/delete API ngay từ P1.0; TTL 90 ngày sau exam.closesAt.
  metadata    Json?
  // assigned_code mode: 8-10 ký tự alphanumeric, unique trong exam.
  accessCode  String?
  createdAt   DateTime @default(now())
  // assigned_code: instructor disable candidate trước/sau khi thi.
  disabledAt  DateTime?
  // Q3: track email send state để retry/audit.
  emailSentAt DateTime?

  exam     Exam @relation(fields: [examId], references: [id], onDelete: Cascade)
  attempts ExamAttempt[]

  @@unique([examId, accessCode])
  @@index([examId])
}

// Q7: candidate attempts vẫn emit LearningEvent (cho item analytics) nhưng
// userId=null, candidateId set. Module B/C consumer phải skip nếu !userId.
model LearningEvent {
  // ... existing fields
  userId      String?  // CHUYỂN sang optional
  candidateId String?  // mới — XOR-like với userId (ít nhất 1 cái phải set)
  // CHECK constraint enforce ở raw SQL:
  //   (userId IS NOT NULL OR candidateId IS NOT NULL)
}

model ExamAttempt {
  // ... existing fields
  // BREAKING: userId chuyển từ required → optional. XOR với candidateId.
  userId               String?
  candidateId          String?
  // Freeze tên hiển thị tại start (candidate có thể đổi tên trong open mode,
  // hoặc instructor sửa sau khi thi — vẫn giữ raw value tại thời điểm thi).
  candidateDisplayName String?

  candidate ExamCandidate? @relation(fields: [candidateId], references: [id], onDelete: Cascade)
}
```

**Raw migration cần viết tay** (Prisma không tự sinh):

```sql
-- 1. ExamAttempt XOR constraint
ALTER TABLE "ExamAttempt"
  ADD CONSTRAINT exam_attempt_subject_xor
  CHECK ((("userId" IS NOT NULL)::int + ("candidateId" IS NOT NULL)::int) = 1);

-- 2. LearningEvent: cho phép candidateId thay userId. Append-only đã đảm bảo.
ALTER TABLE "LearningEvent" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "LearningEvent" ADD COLUMN "candidateId" UUID;
ALTER TABLE "LearningEvent"
  ADD CONSTRAINT learning_event_subject_required
  CHECK ("userId" IS NOT NULL OR "candidateId" IS NOT NULL);
CREATE INDEX "LearningEvent_candidateId_occurredAt_idx"
  ON "LearningEvent"("candidateId", "occurredAt") WHERE "candidateId" IS NOT NULL;

-- 3. Replace existing @@unique([examId, userId]) với 2 partial unique:
DROP INDEX IF EXISTS "ExamAttempt_examId_userId_key";
CREATE UNIQUE INDEX "ExamAttempt_examId_userId_partial_key"
  ON "ExamAttempt"("examId", "userId") WHERE "userId" IS NOT NULL;
CREATE UNIQUE INDEX "ExamAttempt_examId_candidateId_partial_key"
  ON "ExamAttempt"("examId", "candidateId") WHERE "candidateId" IS NOT NULL;
```

**Data migration**: tất cả ExamAttempt cũ đều có `userId`, không cần backfill.

### 4.4. M4 — `question_bank` (P1, T3b)

```prisma
enum QuestionBankVisibility { private course org }
enum BankQuestionStatus { draft published archived }

model QuestionBank {
  id           String   @id @default(uuid())
  ownerUserId  String
  courseId     String?  // null = private to user
  name         String
  description  String?  @db.Text
  visibility   QuestionBankVisibility @default(private)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  owner     User    @relation("QuestionBankOwner", fields: [ownerUserId], references: [id])
  course    Course? @relation(fields: [courseId], references: [id])
  questions BankQuestion[]

  @@index([ownerUserId])
  @@index([courseId])
}

model BankQuestion {
  id               String  @id @default(uuid())
  bankId           String
  type             ExamQuestionType
  prompt           String  @db.Text
  config           Json    // shape ngang với ExamQuestion.config
  points           Int     @default(1)
  difficulty       Int     @default(3) // 1-5
  estimatedTimeSec Int?
  status           BankQuestionStatus @default(draft)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  bank      QuestionBank @relation(fields: [bankId], references: [id], onDelete: Cascade)
  skillTags BankQuestionSkillTag[]
  versions  BankQuestionVersion[]
  copiedTo  ExamQuestionFromBank[]

  @@index([bankId, status])
  @@index([difficulty])
}

model BankQuestionSkillTag {
  bankQuestionId String
  skillId        String
  weight         Float  @default(1.0)

  bankQuestion BankQuestion @relation(fields: [bankQuestionId], references: [id], onDelete: Cascade)
  skill        Skill        @relation(fields: [skillId], references: [id], onDelete: Cascade)

  @@id([bankQuestionId, skillId])
  @@index([skillId])
}

// Immutable snapshot — ghi MỖI LẦN update BankQuestion sau khi đã published.
model BankQuestionVersion {
  id             String  @id @default(uuid())
  bankQuestionId String
  versionNumber  Int
  prompt         String  @db.Text
  config         Json
  points         Int
  createdAt      DateTime @default(now())

  bankQuestion BankQuestion @relation(fields: [bankQuestionId], references: [id], onDelete: Cascade)
  copiedTo     ExamQuestionFromBank[]

  @@unique([bankQuestionId, versionNumber])
}

// Khi exam tham chiếu bank question → copy snapshot vào ExamQuestion + ghi link này.
// Bank edit không touch exam đã publish.
model ExamQuestionFromBank {
  examQuestionId        String   @id
  bankQuestionId        String
  bankQuestionVersionId String
  copiedAt              DateTime @default(now())

  examQuestion ExamQuestion         @relation(fields: [examQuestionId], references: [id], onDelete: Cascade)
  bankQuestion BankQuestion         @relation(fields: [bankQuestionId], references: [id])
  version      BankQuestionVersion  @relation(fields: [bankQuestionVersionId], references: [id])

  @@index([bankQuestionId])
}
```

**Validation publish-time**: `BankQuestion.status = published` chỉ khi có ≥ 1 skill tag (§4.4 CLAUDE.md).

### 4.5. M5 — `cohorts_and_schedule` (P1.5, T4)

```prisma
model Cohort {
  id        String  @id @default(uuid())
  courseId  String
  name      String   // "K65A-DSAI-2025-2"
  createdAt DateTime @default(now())

  course    Course @relation(fields: [courseId], references: [id], onDelete: Cascade)
  members   CohortMember[]
  schedules ExamSchedule[]

  @@unique([courseId, name])
  @@index([courseId])
}

model CohortMember {
  cohortId String
  userId   String
  joinedAt DateTime @default(now())

  cohort Cohort @relation(fields: [cohortId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([cohortId, userId])
  @@index([userId])
}

model ExamSchedule {
  id                  String   @id @default(uuid())
  examId              String
  cohortId            String?  // null = áp dụng toàn course
  opensAt             DateTime
  closesAt            DateTime
  durationOverrideMin Int?     // override exam.durationMin cho cohort này

  exam   Exam    @relation(fields: [examId], references: [id], onDelete: Cascade)
  cohort Cohort? @relation(fields: [cohortId], references: [id], onDelete: Cascade)

  @@index([examId, opensAt])
  @@index([cohortId])
}
```

**Service rule**: `startExamAttempt` thêm bước `assertEligibleForExam(userId, examId)`:
1. Enrollment active
2. Nếu exam có ≥ 1 `ExamSchedule` với cohort → user phải là `CohortMember`
3. `now ∈ [opensAt, closesAt]` của schedule khớp (hoặc của exam nếu không có schedule)
4. Dùng `durationOverrideMin` nếu có

### 4.6. M6 — `exam_sections` (P2, T4)

```prisma
enum ExamSectionSelectionMode { fixed random_from_bank }
enum ExamSectionResolutionMode { per_attempt per_publish }

model ExamSection {
  id             String  @id @default(uuid())
  examId         String
  title          String
  orderIndex     Int
  selectionMode  ExamSectionSelectionMode  @default(fixed)
  resolutionMode ExamSectionResolutionMode @default(per_attempt)
  // when selectionMode=random_from_bank:
  //   { bankIds: string[], skillIds: string[], difficulty: int[],
  //     type: ExamQuestionType[], count: int, pointsPerItem: int }
  poolFilter     Json?
  // Khi resolutionMode=per_publish, lưu danh sách đã resolve 1 lần.
  materializedQuestionIds Json?  // string[]

  exam  Exam @relation(fields: [examId], references: [id], onDelete: Cascade)
  items ExamSectionItem[]

  @@unique([examId, orderIndex])
}

model ExamSectionItem {
  sectionId      String
  examQuestionId String
  orderInSection Int
  points         Int

  section  ExamSection  @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  question ExamQuestion @relation(fields: [examQuestionId], references: [id], onDelete: Cascade)

  @@id([sectionId, examQuestionId])
}
```

**Data migration**: mỗi exam hiện có sinh 1 `ExamSection` default `{ title: "Main", selectionMode: fixed, orderIndex: 0 }` chứa toàn bộ questions hiện tại.

**Sampler service** `materializeRandomSection(sectionId, attemptId)`:
- Seed = `sha256(examId + userId + sectionId)`
- Stratified sampling: chia `count` theo `difficulty` distribution của `poolFilter`
- Insert vào `ExamAttempt.shuffleSnapshot.questionOrder`
- Emit `exam.section.materialized` event

### 4.7. M7 — `exam_analytics` (P2.5, T5)

```prisma
model ExamQuestionStats {
  examQuestionId   String   @id
  attemptCount     Int
  correctCount     Int
  pValue           Float    // correct/attempted (0=quá khó, 1=quá dễ)
  discrimination   Float    // point-biserial correlation
  avgTimeSec       Float?
  distractorStats  Json?    // MCQ/multi: { optionId: { chosenBy, isCorrect } }
  computedAt       DateTime @default(now())

  examQuestion ExamQuestion @relation(fields: [examQuestionId], references: [id], onDelete: Cascade)
}

model BankQuestionStats {
  bankQuestionId    String   @id
  totalUses         Int      // số ExamQuestionFromBank
  totalAttempts     Int
  pValueAvg         Float
  discriminationAvg Float
  computedAt        DateTime @default(now())

  bankQuestion BankQuestion @relation(fields: [bankQuestionId], references: [id], onDelete: Cascade)
}
```

### 4.8. M8 — `attempt_proctoring` (P3, T6)

```prisma
model AttemptProctorSnapshot {
  id           String   @id @default(uuid())
  attemptId    String
  takenAt      DateTime @default(now())
  s3Key        String   // R2 path, TTL 30d
  faceDetected Boolean?
  faceCount    Int?

  attempt ExamAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade)

  @@index([attemptId, takenAt])
}
```

### 4.9. Thêm enum value (mọi phase)

`ExamIncidentType` thêm: `speed_run`, `face_lost`, `lockdown_failed`, `webcam_blocked`.

---

## 5. Event taxonomy bổ sung

Thêm vào `LearningEventType` enum + emit qua `emitEvent` trong cùng transaction:

```
exam.section.materialized       // random pool resolve cho 1 attempt
exam.attempt.extended           // instructor gia hạn thời gian
exam.attempt.force_submitted    // instructor force submit
exam.attempt.session_reset      // instructor reset session lock
exam.attempt.disqualified
exam.attempt.heartbeat_lost     // server-detected, không phải student emit
exam.message.sent
exam.message.broadcast
exam.diagnostic.generated       // module B sinh diagnostic post-exam
exam.bank.question.used         // cross-exam reuse
exam.proctor.snapshot.taken
exam.proctor.violation          // pattern detection trigger
exam.candidate.created          // P1.0 — candidate đăng ký qua code (open) hoặc instructor add (assigned)
exam.candidate.code_claimed     // P1.0 — candidate nhập mã thành công
exam.code.rotated               // P1.0 — instructor rotate openCode/accessCode
```

**Heartbeat & SSE ping KHÔNG vào `LearningEvent`** (§5.1 CLAUDE.md).

**Candidate event guard** (P1.0): event consumer cho Module B/C phải kiểm tra `if (!event.userId) return` — candidate attempts ghi event với `userId=null` nhưng không cập nhật BKT/XP/badge.

---

## 6. Chi tiết per-sub-module

### 6.1. A5.5 — Proctoring tier mapping

| Level | Cơ chế **bắt buộc** | Cơ chế optional |
|---|---|---|
| `none` | — | — |
| `basic` *(default sau publish)* | Single-tab lock ✓ · Incident log: `tab_blur`, `paste`, `fullscreen_exit`, `network_lost` ✓ · IP/device fingerprint (`ExamAttempt.ipAddress`, `userAgent`) | Webcam consent (off) |
| `standard` | Tất cả basic + Webcam snapshot 2-3p/lần + Pattern detect (speed-run < 10s pass, paste > 100 chars) + `multi_tab` detect | Face presence check (mediapipe) |
| `strict` | Tất cả standard + Lockdown handshake (SEB hoặc Chrome extension token) + Face detect bắt buộc + Force fullscreen (exit = incident severity=high) | Live proctor join URL |

**Rule**: instructor chọn khi publish. **Không** cho hạ level khi exam đang mở; phải close → re-publish.

**Consent**: webcam capture cần checkbox + audit log → ghi `LearningEvent` `consent.given` trước khi start attempt.

### 6.2. A5.3 — Instructor actions trên live dashboard

| Action | Endpoint | Service | Event | Guard |
|---|---|---|---|---|
| Gia hạn thời gian | `POST /api/exam-attempts/[id]/extend` `{ minutes }` | `extendAttempt(actorId, attemptId, minutes)` | `exam.attempt.extended` | ≤ +30p, attempt status=in_progress |
| Force submit | `POST /api/exam-attempts/[id]/force-submit` `{ reason }` | gọi `submitExamAttempt` với actor=instructor | `exam.attempt.force_submitted` | status=in_progress, reason bắt buộc |
| Reset session lock | `POST /api/exam-attempts/[id]/reset-session` | rotate `sessionToken`, ++`resumeCount` | `exam.attempt.session_reset` | — |
| Disqualify | `POST /api/exam-attempts/[id]/disqualify` `{ reason }` | set status=`flagged` | `exam.attempt.disqualified` | reason bắt buộc |
| Gửi message 1 SV | `POST /api/exam-attempts/[id]/messages` `{ body }` | tạo `ExamMessage` + publish bus | `exam.message.sent` | body ≤ 500 char |
| Broadcast | `POST /api/exams/[id]/messages` `{ body }` | tạo `ExamMessage` với `attemptId: null` | `exam.message.broadcast` | body ≤ 500 char |

Mọi route gọi `assertCanEditCourse(actorId, exam.courseId)`.

### 6.3. A5.3.6 — Heartbeat-lost detector

Cron `*/2 * * * * heartbeat-watch`:
1. Query `ExamAttempt` where `status=in_progress` AND `lastHeartbeatAt < now - 90s` (dùng index `(status, lastHeartbeatAt)`)
2. Mỗi attempt → publish `attempt.heartbeat_lost` lên bus (dashboard chấm đỏ tự động)
3. Idempotent: chỉ publish 1 lần per attempt per detection cycle (in-memory de-dup set, TTL 5p)
4. **Không** auto-submit — chỉ flag để instructor xem

### 6.4. A5.6 — Bridge Feedback Engine (P3.5)

Sau `submitExamAttempt`:
1. Emit `exam.attempt.submitted` (đã có)
2. Module B subscribe → cập nhật `LearnerSkillState` (BKT update) cho mọi skill tag trong question đã làm
3. Sinh `ExamDiagnosticReport` (entity mới, ngoài scope module A5):
   - Per-skill mastery delta
   - Danh sách câu sai + skill liên quan
   - Gợi ý lesson/quiz remediation (đọc `LearnerSkillState` + `Skill` graph)
4. UI `/learn/[slug]/exams/[examId]/[attemptId]/diagnostic` hiển thị (chỉ khi `exam.showResultsAfterSubmit=true` và đã graded)

### 6.5. A5.7 — LLM-assisted grading

- Mở rộng `ExamQuestion.config` cho `essay`/`short_answer`:
  ```
  { rubric: { criteria: [{ name, maxPoints, descriptors }], exemplars?: [...] }, minWords?: int }
  ```
- Endpoint `/api/exam-answers/[id]/suggest-grade` (đã có) gọi OpenAI `gpt-4o-mini` với structured output JSON schema:
  ```json
  { "criterionScores": [{ "name": "...", "score": N, "rationale": "..." }],
    "totalScore": N, "confidence": 0-1, "redFlags": ["..."] }
  ```
- Cost cap: max 4k input + 1k output token. Rate-limit 100 calls/day/instructor.
- UI grading: side-by-side suggestion + accept/override. Accept → ghi `ExamGradeHistory.reason="llm_assisted"` + raw response trong `metadata`.

### 6.6. A5.8 — Code-based exam access *(P1.0)*

Hai sub-mode song song, share cùng auth pipeline:

| Mode | `Exam.accessMode` | Identity flow | Use case |
|---|---|---|---|
| Thi tự do | `open_code` | 1 mã chung cho ca thi · candidate nhập tên + (optional) studentCode trên form · tạo `ExamCandidate` tại runtime | Quiz warm-up hội thảo, đánh giá nhanh đầu kỳ, contest mở |
| Thi theo phân công | `assigned_code` | Instructor add danh sách candidate trước (manual hoặc CSV import) · mỗi candidate có `accessCode` unique 8 ký tự · candidate nhập mã → resolve về candidate có sẵn | Kỳ thi cuối kỳ K-12, thi đầu vào, kỳ thi ngoài hệ thống enrollment |

#### 6.6.1. Auth pipeline cho candidate (không dùng NextAuth)

Public landing page `/exam/[code]`:
1. User nhập code (6-10 ký tự, alphanumeric)
2. POST `/api/public/exam/claim-code` `{ code, displayName?, metadata? }`
3. Server resolve:
   - Match `Exam.openCode` → mode `open_code` → cần `displayName` từ form → tạo `ExamCandidate` mới + `ExamAttempt`
   - Match `ExamCandidate.accessCode` → mode `assigned_code` → `displayName` lấy từ candidate có sẵn → resume hoặc tạo `ExamAttempt`
4. Server set HttpOnly cookie `exam_session=<JWT>` chứa `{candidateId, attemptId, sessionToken, expiresAt}`, signed bằng `NEXTAUTH_SECRET`. TTL = thời gian còn lại của exam + 1h grace.
5. Redirect tới `/exam-take/[attemptId]` (page mới, không nằm trong `/learn/...` vì path đó assume enrolled student).

#### 6.6.2. Helper `requireExamSubject`

Thay thế `requireUserId` ở mọi route exam-attempt path:

```ts
type ExamSubject =
  | { kind: "user"; userId: string }
  | { kind: "candidate"; candidateId: string; attemptId: string };

async function requireExamSubject(req: Request): Promise<ExamSubject | null>
```

Thứ tự kiểm tra: User session trước (NextAuth) → exam cookie sau. Mọi route đọc attempt phải verify `attempt.userId === subject.userId` HOẶC `attempt.candidateId === subject.candidateId AND attempt.id === subject.attemptId`.

#### 6.6.3. UI mới

- **Public**:
  - `/exam/[code]` — landing claim form (open mode: nhập tên + **bắt buộc** phone + email; assigned mode: chỉ nhập mã, displayName auto-fill từ candidate record)
  - `/exam-take/[attemptId]` — reuse `ExamPlayer.tsx` với prop `subjectKind: "candidate"` (ẩn link về course/learner profile)
  - `/exam/[code]/result` — **Q6**: form re-enter mã → server verify → render kết quả. Không có cookie-based public URL. Mỗi lần xem điểm = nhập mã 1 lần
- **Instructor admin**:
  - Tab "Access" trong exam edit: chọn `accessMode`, generate `openCode`, set `openMaxAttempts`
  - Tab "Candidates" (chỉ hiện khi `accessMode != authenticated`): list candidate, import CSV (`displayName, studentCode?, class?, email?`), generate `accessCode` tự động, export CSV mã dự thi, disable/enable từng candidate, **gửi mã qua email** (Q3) — nút "Send codes" trigger BullMQ email job
- **Live dashboard**: card hiển thị `candidate.displayName` thay vì `user.displayName` khi attempt là candidate. Filter "Type: Logged-in / Open / Assigned"

#### 6.6.4. Authorization matrix

| Action | `authenticated` | `open_code` | `assigned_code` |
|---|---|---|---|
| Start attempt | enrollment check | code match + tạo candidate | code match candidate active |
| Save answer / heartbeat | userId match | candidateId match (cookie) | candidateId match (cookie) |
| Submit | userId match | candidateId match | candidateId match |
| Instructor actions (extend/force-submit/dq) | `assertCanEditCourse` | unchanged | unchanged |
| Module B (Feedback Engine) consume event | userId update BKT | **skip** (userId null) | **skip** (userId null) |
| Module C (Gamification) consume event | normal | **skip** | **skip** |

> **Quan trọng**: candidate KHÔNG có User → không có `LearnerSkillState`. Mọi event consumer subscribe phải filter `if (!event.userId) return` ngay đầu handler. Cấp policy: candidate attempt **không** contribute vào BKT/XP/badge.

#### 6.6.5. Anti-spam guards

- **Rate-limit IP** (Q2): **50 attempt/giờ** cho `open_code`, **10 claim attempt/phút** cho cả 2 mode. Token bucket in-memory; vượt → 429 + audit `exam.candidate.rate_limited`
- **Cap**: `openMaxAttempts` field hạn tổng số candidate cho 1 open exam
- **Honeypot field** trong form
- **Time-to-submit < 2s** → reject
- **IP/UA fingerprint** lưu `ExamAttempt.ipAddress + userAgent` (đã có)

#### 6.6.6. 7 quyết định P1.0 (chốt 2026-05-13)

| # | Câu hỏi | Quyết định |
|---|---|---|
| Q1 | Open mode SĐT/email | **Bắt buộc** cả 2 field. Form validation: email regex, SĐT 9-11 số VN. Lưu vào `ExamCandidate.metadata.{phone, email}` |
| Q2 | Open mode rate-limit per-IP | **50 attempt/giờ/IP**. Vượt → 429 + audit `exam.candidate.rate_limited`. Token bucket in-memory (P5 chuyển Redis) |
| Q3 | Assigned mode gửi mã qua email | **Có, trong scope P1.0**. Cần email service mới: provider Resend (recommended) hoặc SendGrid. Template Vietnamese chứa mã + URL `/exam/[code]` + ngày giờ thi |
| Q4 | Candidate đổi displayName | **Không** ở cả 2 mode. Open: candidate type 1 lần lúc claim, freeze ngay. Assigned: instructor nhập + lock. Instructor có thể edit sau exam, ghi audit `exam.candidate.renamed` |
| Q5 | Resume khi mất cookie | Assigned: **được** (nhập lại mã → resume attempt cũ, rotate sessionToken). Open: **không** (cookie clear = candidate mới hoàn toàn) |
| Q6 | Xem kết quả | **Luôn re-enter code** mỗi lần xem. Form `/exam/[code]/result` nhập code → verify → render. Không có cookie-based public URL |
| Q7 | LearningEvent cho candidate | **Có ghi** với `userId=null, candidateId=<id>`. Schema: `LearningEvent` thêm cột `candidateId String?` + CHECK `(userId IS NOT NULL OR candidateId IS NOT NULL)`. Module B/C consumer filter `if (!event.userId) return` |

**Impact lên schema (P1.0)**:
- `ExamCandidate.metadata` chuẩn hóa `{ phone: string, email: string, studentCode?: string, class?: string }`
- `LearningEvent` thêm `candidateId String?` + raw SQL CHECK constraint
- Email service: env vars `RESEND_API_KEY`, `EMAIL_FROM` mới; package `resend` ^4.x

**Impact lên build (P1.0)**: thêm 1 ngày cho email integration (lùi UI candidate management từ T3a-D2 → T3a-D3).

---

## 7. Build sequence chi tiết

### Tuần 1 — P0.5 Live monitoring v1 ✅ *(done 2026-05-13)*

| Day | Task | DoD | Status |
|---|---|---|---|
| D1 | M1 migration `lastHeartbeatAt` + write coalescing 30s | UPDATE ≤ 1/30s/attempt, bus pub sub-second | ✅ |
| D2 | M2 migration `ExamMessage` | Append-only schema, body/sender/sentAt immutable | ✅ |
| D3 | 4 actions (extend / force-submit / reset-session / disqualify) | Service + 4 routes + dashboard menu + audit event | ✅ |
| D4 | Message + broadcast service + UI | Send/poll/ack pipeline, broadcast filter theo `sentAt >= startedAt` | ✅ |
| D5 | Drill-down `/live/[attemptId]` timeline | 8 event kinds, SSE filter theo attemptId, action bar inline | ✅ |
| D6 | Heartbeat-lost cron `*/2 * * * *` + auto red dot | In-memory dedup 5min + eventKey bucket idempotency + bus push snap dot | ✅ |
| D7 | Hardening: bus message events carry `body` (bỏ placeholder) + plan update | Drill-down hiển thị body realtime ngay khi nhận event | ✅ |

### Tuần 2 — P1.0 Code-based access (phần 1)

| Day | Task | Files chạm | DoD |
|---|---|---|---|
| D1 ✅ | M3 migration: `Exam.accessMode/openCode`, `ExamCandidate`, `ExamAttempt.userId nullable + candidateId + XOR check + partial unique index`, `LearningEvent.candidateId` + nullable userId | `schema.prisma`, migration SQL | Migrate sạch + 42 prior migrations baselined |
| D2 ✅ | `requireExamSubject()` helper + 5 routes refactor + `ExamSubject` discriminator + `emitEvent` nullable userId + candidateId | `apps/web/src/lib/{exam-session,session}.ts`, `core-lms/exam/subject.ts`, 5 routes | User flow OK · Candidate JWT cookie path OK · cross-attempt + tampered → 401 |
| D3 ✅ | `claimByOpenCode(code, {displayName, phone, email, ...})` + `claimByAssignedCode(code)` + cookie sign/verify đã ở D2 | `core-lms/exam/code-access.ts` | 16/16 tests pass (11 claim + 5 cookie) — invalid code, missing phone/email, openMaxAttempts cap, resume + rotate |
| D4 ✅ | `POST /api/public/exam/claim-code` route + 2-tier rate-limit (10/min burst + 50/h open) + honeypot + cookie set | new route + `lib/rate-limit.ts` | Open happy 200 + cookie set · Assigned happy + resume · Missing email → 400 · Honeypot → 204 silent · Invalid code → 404 · 11 quick → 429 · Issued cookie auth heartbeat OK |
| D5 ✅ | UI public `/exam/[code]/page.tsx` claim form + `/exam-take/[attemptId]` reuse ExamPlayer + `/submitted` confirmation page | new pages + ExamPlayer prop `resultUrl` thay cho `courseSlug` + `requireExamSubject({candidateOnly:true})` + `buildShuffleSnapshot` exported & called trong claim services | Open form 3 required fields render, claim → /exam-take render ExamPlayer countdown + fullscreen-gate · Assigned form pre-fill candidate displayName từ DB |
| D6 ✅ | UI public `/exam/[code]/result` re-enter code (Q6) → verify → render score + per-question detail (no cookie public URL) | new page + `lookupCandidateResult` service + API + rate-limit 10/min | Open: code + email → 200 score panel; wrong email → 404; missing email → 400 · Assigned: code-only → 200 panel với candidate name + status `Đã chấm` + score% + passed badge + chi tiết câu hỏi |
| D7 ✅ | `isLearnerEvent()` helper + audit Module B/C consumers (existing queries đã filter `userId: <id>` → candidate auto-excluded; no exam→BKT consumer wired yet) + defensive doc-comments | `shared-types/events.ts`, `core-gamification/handlers.ts` | Invariant test 6/6: candidate flow → 0 new XpTransaction · 0 new LearnerSkillState · candidate events ghi `userId=null` 100% |

### Tuần 3a — P1.0 Code-based access (phần 2)

| Day | Task | DoD |
|---|---|---|
| D1 ✅ | UI instructor: Tab "Access" trong exam edit — `AccessPanel` 3 radio modes + openCode rotate + openMaxAttempts input + share URL preview · service `updateExamAccess` + `rotateOpenCode` + 2 API routes | Toggle 3 mode hoạt động · code rotate sinh ABCDEF 6-char · maxAttempts 50 persist DB · in-flight attempt → block mode change |
| D2 ✅ | Email service setup (Q3): `resend@4.8` installed · env `RESEND_API_KEY` + `EMAIL_FROM` · `lib/email.ts` với `sendEmail` (Resend client + dev-noop console fallback) + `renderExamCodeEmail` template VN · debug route `/api/debug/email-preview` | Preview JSON OK · `format=html` render full card với mã + schedule + CTA · `?send=` → dev fallback `loggedOnly: true` ghi full text vào console |
| D3 ✅ | Tab "Candidates" với list table + add 1 + import CSV + export CSV + disable/enable + delete + Send codes (inline send, no BullMQ yet) | Service `candidates.ts` (6 functions) + 3 API routes · UI `CandidatesPanel` ẩn nếu mode != assigned_code · Import 3 candidates từ CSV → 8-char codes generated · Send codes → 2 mailed (1 skipped no-email) · `emailSentAt` populate ✓ |
| D4 ✅ | Assigned resume flow xác nhận end-to-end (claimByAssignedCode đã có ở D3 — re-claim cùng mã → `resumed:true` + rotated sessionToken + ++resumeCount) + cookie-share detector trong heartbeat route | `checkAndUpdateFingerprint(attemptId, ip, ua)` trong bus, window 60s · 3 heartbeat: same device (no incident) · same device (no incident) · different IP+UA (emit `multi_tab` reason=`cookie_share` với prev/curr) — DB ghi đúng 1 incident |
| D5 ✅ | Live dashboard adapt: `AttemptLive.subjectType` + candidate.displayName + type filter pill row + per-card subject badge · claim-code route push `upsertOnStart` để instructor thấy candidate vừa claim | Card name = `Open Candidate X` (candidate.displayName) · badges Open + Đang thi · filter pills `Logged-in (0) / Open (1) / Assigned (0)` · filter row ẩn nếu chỉ có User attempts |
| D6 ✅ | E2E HTTP integration test (Playwright deferred — Node test exercises same critical paths against real Next.js server) | 20/20 pass: 3 open claims concurrent, 3 distinct attempts/candidates/cookies, cross-cookie heartbeat → 401, 3 save+submit · assigned re-claim → same attemptId + new cookie + resumeCount++ · 2 devices same cookie → multi_tab incident |
| D7 ✅ | GDPR Export-only (delete chuyển sang xử lý thủ công theo quyết định user 2026-05-13) — `exportCandidateData(actorId, candidateId)` → full JSON dump (candidate + metadata + attempts + answers + incidents + events) + `GET /api/candidates/[id]/export` với `Content-Disposition` attachment + UI Export button mỗi row | Export 200 với legalBasis + candidate.metadata.{phone,email,studentCode} + 1 attempt + 1 incident + 1 event · No-auth → 401 · Note: yêu cầu xoá xử lý qua admin DB |

### Tuần 3b — P1 Question Bank

| Day | Task | DoD |
|---|---|---|
| D1 ✅ | M4 migration `add_question_bank` — 4 models (`QuestionBank`, `BankQuestion`, `BankQuestionSkillTag`, `BankQuestionVersion`, `ExamQuestionFromBank`) + 2 enums + 4 back-refs (User/Course/Skill/ExamQuestion) | Schema applied, Prisma client regenerated, 3 tables queryable count=0, typecheck clean |
| D2 ✅ | Service `core-lms/exam/bank.ts`: createBank · listBanks (visibility-aware) · createBankQuestion · updateBankQuestion (auto-snapshot khi published) · publishBankQuestion (≥1 skill required) · archiveBankQuestion · tag/untag · 4 ExamError codes mới | 14/14 tests: private+course bank · non-instructor course bank reject · listBanks scope (owner+course-instructor) · draft→published auto-snapshot v1/v2 · v1 prompt = pre-edit · draft edit no snapshot · archived edit reject · cross-owner reject |
| D3 ✅ | `searchQuestions(actor, filters)` visibility-scoped với 5 filters (bankIds/type/difficulty/skillIds/q) + cursor pagination · `copyBankQuestionToExam(actor, qid, examId, position?)` snapshot version + copy ExamQuestion + skill tags + ExamQuestionFromBank link | 17/17 tests: filter type/diff/skill/q · bob no-access · copy q1 v1 → ExamQuestion + fromBank link + skill copied · draft copy reject · 2nd copy → v2 · edit after copy → v3 (D2 auto-snapshot) · **exam-side frozen** sau edit · pagination 2+1 |
| D4 ✅ | 9 API routes: POST/GET `/api/question-banks` · GET/POST `/[id]/questions` · GET `/api/bank-questions` (cross-bank search) · PATCH `/[id]` · POST `/[id]/publish` · POST `/[id]/archive` · POST/DELETE `/[id]/tags` · POST `/api/exams/[id]/questions/from-bank` | E2E curl 11/11 routes: create bank → list → create question → list-in-bank → cross-bank search · PATCH no-snapshot draft · publish w/o skill → 422 · tag → publish ok · copy bank→exam returns examQuestionId + versionNumber=1 · archive ok |
| D5–D6 ✅ | UI `/instructor/question-banks/` hub (list + create form) + `[id]/` workbench (status filter pills, add-question form 6 type, status actions Publish/Archive với guard, edit panel inline với skill toggle via tag API) | Hub create bank → redirect workbench · workbench render 1 row `Nháp` MCQ với badges · Publish disabled với tooltip "Cần ≥1 skill" |
| D7 ✅ | "📚 Từ bank" button + `FromBankModal` (search filters type/difficulty/q, server-rendered list, Copy → POST `/api/exams/[id]/questions/from-bank`) trong ContentManager standalone questions · CSV bulk import trong BankWorkbench (`ImportCsvPanel` parser hỗ trợ MCQ option columns A–D + correct letter) | Modal mở từ exam page → list 1 published question từ bank → Copy thành công · ExamQuestion link `fromBank` + version=1 + skill tag copied · CSV 3 MCQ → 3 rows tạo thành công |

### Tuần 4 — P1.5 Scheduling + P2 Random pool + Clone

| Day | Task | DoD |
|---|---|---|
| D1 ✅ | M5 migration `add_cohorts_and_schedule` — 3 models (`Cohort`, `CohortMember`, `ExamSchedule`) + 3 back-refs (User/Course/Exam) + `ExamSchedule.ipAllowlist` String[] cho Q2 lab whitelist | Schema applied, Prisma client regen, 3 tables queryable, typecheck clean |
| D2 ✅ | Service `cohorts.ts`: 5 cohort CRUD + 3 membership ops + 3 schedule CRUD + `assertEligibleForExam(userId, examId) → {durationSec, scheduleId}` priority logic · wire vào `startExamAttempt` thay `enrollment+window` check · 5 ExamError codes mới | 16/16 tests: cohort dup-name reject · member skip (not-found/enrolled/duplicate) · no-schedule fallback · cohort schedule applies durationOverride 45→2700s · non-member → cohort_required · course-wide + cohort coexist (cohort priority) · future schedule → exam_not_open · startExamAttempt picks override 55min=3300s |
| D3 ✅ | 5 API routes (cohorts + members + schedules) · `/instructor/courses/[id]/cohorts` page + `CohortsClient` với inline member picker (bulk email/uuid) · `SchedulesPanel` trong exam edit với form 4 field (cohort/window/override/IP allowlist) | E2E 6 routes: create cohort + add 2 members by email + list (Bob+Charlie displayName+email) + create schedule cohort-specific override 45m + IP allowlist 1 + list schedules |
| D4 ✅ | M6 migration `add_exam_sections` — 2 enums + `ExamSection` + `ExamSectionItem` (1:1 với ExamQuestion via `@@unique([examQuestionId])`) + 2 back-refs (Exam.sections, ExamQuestion.sectionItem) + data backfill SQL (every Exam → "Main" section, every ExamQuestion → SectionItem với orderInSection=orderInExam) + idempotency `WHERE NOT EXISTS` | Schema applied · Prisma regen · backfill verified với synthetic 2-question exam: 1 section "Main" tạo · 2 items với order+pts đúng · re-run = 0 inserts (idempotent) · typecheck clean |
| D5–D6 ✅ | `sections.ts`: section CRUD + `pickPoolQuestions(filter, seed)` stratified-by-difficulty sampler + `materializeRandomSections(examId, subjectKey)` (seed=sha256(examId+subject+sectionId)) · hook vào `startExamAttempt` extending `shuffleSnapshot.sectionMaterializations` · 2 API routes + `SectionsPanel` UI với conditional poolFilter form · 3 ExamError codes mới (section_not_found/pool_empty/pool_underfilled) | **10/10 tests**: deterministic same-seed reproducible · different-seed differs · stratified 2/2/2 across [1,3,5] · pool empty → error · pool underfilled → error · **3 SV cùng exam → 3 question sets khác nhau** · alice re-start → same questions (deterministic per user) · Player-side rendering deferred → P3 |
| D7 ✅ | `cloneExam(actor, sourceId, {targetCourseId?, title?})` deep copy meta + passages + questions + skill tags + sections + section items + bank-link, **skip** attempts/incidents/messages/schedules/candidates, reset status=draft + accessMode=authenticated + publishedAt=null · API `POST /api/exams/[id]/clone` · `CloneButton` UI ở exam header | 16/16 tests: title `Copy of <name>` · status reset · passage+questions copied · question.passageId remapped · skill tag weight preserved · section items copied · ✓ **0 attempts copied** dù source có 1 |

### Tuần 5 — P2.5 Item Analytics ✅ *(done 2026-05-13)*

| Day | Task | DoD |
|---|---|---|
| D1 ✅ | M7 migration `add_exam_analytics` — 2 stats tables (`ExamQuestionStats`, `BankQuestionStats`) + 2 back-refs · sentinel defaults `-1` cho pValue / `-2` cho discrimination để phân biệt "chưa đủ data" | Schema applied, Prisma regen, tables queryable, typecheck clean |
| D2–D3 ✅ | Service `analytics.ts`: `computeExamAnalytics` (per-exam: p-value + point-biserial discrimination + distractor stats) + `computeBankAnalytics` (weighted aggregation qua ExamQuestionFromBank) + `computeAllAnalytics` sweep · cron route + `crontab 0 2 * * * exam-analytics` · sentinel-aware (≥5 attempts mới compute) | 8/8 tests synthetic 8-attempt exam: p-value=0.5 exact · discrimination=1.000 (perfect positive correlation) · distractor A=4 correct B=4 wrong · re-run idempotent |
| D4 ✅ | Bank aggregation verified end-to-end qua `ExamQuestionFromBank` join · weighted by attemptCount (>= 5) | 7/7 tests: 1 bank Q dùng 2 exam (6+5 attempts) → totalUses=2 · totalAttempts=11 · pValueAvg=(0.5×6+0.4×5)/11=0.455 exact · idempotent |
| D5 ✅ | UI tab Analytics trong exam admin: `/api/exams/[id]/analytics` (auth + flag computation) + `AnalyticsPanel` client (table p-value/disc badges color-coded, flag pills, lọc cờ toggle) wired vào exam edit page · sentinel `-1`/`-2` rendered as `—` | 3-question fixture (normal/too_hard/too_easy) với 6 attempts mỗi câu render đúng: p=0.50/0.00/1.00 · flag "Quá khó" / "Quá dễ" · lọc cờ toggle filter còn 2 rows · bank workbench analytics deferred → ngắn hạn dùng tab exam là đủ |
| D6 ✅ | k6 load test infra (`scripts/loadtest/exam-claim-page.k6.js` + README) targeting `GET /exam/[code]` (Next render + Prisma exam lookup) · fixture: open_code `LOAD01` promoted từ analytics exam | Dev-mode smoke captured: 100 VU/20s → p95 1.04s · 500 VU/20s → p95 7.28s, 1.74% fail. Dev mode ~10-20× chậm hơn prod do per-request compile. **Prod target p95<300ms cần verify lại trên Docker stack server 224 sau deploy** (k6 script + README + threshold đã sẵn) |
| D7 ✅ | Docs `docs/EXAM-INSTRUCTOR-GUIDE.md` — 10 section bao trùm: tổng quan menu Khảo thí, create/publish exam, question bank versioning, cohort/schedule priority, live monitor dot-grid + actions, grading queue, item analytics interpretation (p-value/disc/distractor), 2 luồng code-based (open + assigned), GDPR export, tips vận hành | — |

### Tuần 6–7 — P3 Proctoring `standard`

Spike (D0 ✅ 2026-05-13): incident infra đã có sẵn từ P0 — `ExamIncident` schema, `logExamIncident` server function, client paste/tab_blur/fullscreen_exit/network_lost emitters trong ExamPlayer. Webcam capture thuộc P3.5 strict (tuần 8). Tuần 6 tập trung pattern detection + multi-tab + UI review; tuần 7 snapshot pipeline + SEB hint.

| Day | Task | DoD |
|---|---|---|
| D1 ✅ | `MultiTabDetector` client component dùng `BroadcastChannel("exam-attempt:${attemptId}")` — hai tab gửi hello/ack, tab phát hiện peer → overlay cảnh báo VN + `logIncident("multi_tab", {peerTabId})` · wire vào ExamPlayer cạnh TabBlurWarning · safe khi `BroadcastChannel` undefined (SSR) | Anonymous candidate claim attempt → mount → eval post hello từ rogue channel → warning overlay hiện · DB có 1 `ExamIncident{ type: "multi_tab", payload: { peerTabId: "rogueTab2" } }` · typecheck clean |
| D2 ✅ | `patterns.ts`: `checkSpeedRun` (elapsed < 10s × questionCount) + `checkPasteFlood` (≥3 paste / 60s sliding window) + `evaluateAttemptPatterns(attemptId)` orchestrator · **derived-only, không mutate attempt.status** → tránh schema migration + giữ `flagged` cho instructor manual action | **14/14 tests**: pure thresholds (boundary, sliding window, unsorted input, sub-threshold) · integration (speed_run on 30s/5q, paste_flood on 3-in-30s, không flag khi pastes cách 90s, status không bị mutate) |
| D3 ✅ | Live monitor drill-down: panel **Giám sát** với pattern flag badges (⚑ Nộp quá nhanh / Dán liên tục) + incident counts per type (Rời tab, Mở nhiều tab, Dán, ...) · timeline incident row dùng label VN thay vì enum raw · server page gọi `evaluateAttemptPatterns` + count theo type rồi pass props | E2E verified với attempt 15562591: render "GIÁM SÁT · ⚑ Nộp quá nhanh · Mở nhiều tab: 1 · Rời tab: 7" sau khi backdate startedAt; pattern flag chỉ xuất hiện khi attempt submitted (cố ý — speed_run cần submittedAt) |
| D4 ✅ | Schema M8 `add_attempt_proctor_snapshots`: enum `ProctorSnapshotKind` + model `AttemptProctorSnapshot` (attemptId+kind+storageKey+mimeType+sizeBytes+capturedAt+reviewedAt/By) · `proctorSnapshotKey` storage builder (private layer, yyyy/mm shard) · POST `/api/exam-attempts/[id]/proctor-snapshots` (multipart, subject-auth, attempt_in_progress, ≤2MB jpeg/png/webp, kind periodic/on_event) | E2E: candidate claim → POST PNG → 201 với storageKey `proctor-snapshots/2026/05/...` · file 67B on disk · DB row đầy đủ metadata · 403 khi NextAuth instructor session conflict (subject mismatch) — đúng spec |
| D5 ✅ | `lib/seb.ts` (`detectSeb` pure helper qua UA `SEB/x.y` regex + header `X-SafeExamBrowser-Version` · `requiresSeb(level)` policy) · `SebBrowserPrompt` block page (download SEB · `seb://` + `sebs://` protocol launch · why-SEB FAQ · placeholder `.seb` config link) · Gate ở **2 entry**: `/exam/[code]` claim page và `/exam-take/[attemptId]` (chống resume từ non-SEB) · ConfigKey hash verification deferred → tuần 8 P3.5 | E2E 3 case: default browser → block prompt với `seb://localhost:3000/...` link · UA `SEB/3.5.0` → bypass · header `X-SafeExamBrowser-Version` → bypass |
| D6 ✅ | Cross-module test debt từ M3 migration — wrap 42 call sites raw userId → `{ kind: "user", userId: X }` cho các func đã chuyển sang `ExamSubject` (saveAnswer, getAttemptRuntime, claimAttemptSession, logExamIncident, submitExamAttempt) · giữ raw userId cho instructor-only funcs (listPendingExamGrades, gradeManualExamAnswer, getExamAttemptResult) · TS null-safety fix cho attempt.user (nullable sau M3) | **271/271 core-lms** · 115/115 core-gamification · 53/53 core-feedback · 9/9 db · **prod build apps/web success** (113 static pages, 0 error) · typecheck clean per-package |
| D7 | Docs EXAM-INSTRUCTOR-GUIDE.md §11 Proctoring | — |

### Tuần 8 — P3.5 Strict + Adaptive

- SEB handshake hoặc Chrome extension
- mediapipe face detection client-side
- Diagnostic report sau exam (bridge module B)

### Tuần 9 — P4 LLM rubric grading

- Rubric schema standardization
- `gpt-4o-mini` structured output integration
- UI side-by-side review
- Cost monitoring + rate limit

---

## 8. Test plan

### 8.1. Unit (Vitest, đã có pattern `packages/core-lms/src/exam/__tests__/`)

- `bank/createBankQuestion` reject publish khi không có skill tag
- `bank/updateBankQuestion` ghi `BankQuestionVersion` khi đã published
- `materializeRandomSection` deterministic cho cùng seed
- `assertEligibleForExam` reject SV không thuộc cohort
- `extendAttempt` reject > +30p hoặc attempt đã submitted
- `cloneExam` không sao chép `ExamAttempt`/`ExamAnswer`
- LLM grade response shape validation

### 8.2. Integration (Prisma test schema)

- Heartbeat → `lastHeartbeatAt` update + bus publish
- SSE seed snapshot khớp DB rows
- Cron `exam-autosubmit` idempotent (chạy 2 lần không double-submit)
- Heartbeat-lost detector publish đúng 1 lần per cycle
- Bank question edit không ảnh hưởng `ExamQuestion` đã copy

### 8.3. E2E (Playwright — cần dựng mới)

- 2 browsers: instructor xem dashboard + student làm bài → chấm xanh tăng realtime
- Random pool: 3 student start cùng exam → snapshot khác nhau
- Force submit từ instructor → student thấy modal "đã bị kết thúc bởi giám khảo"
- Broadcast message → cả 3 student nhận trong 5s
- Webcam consent flow (P3)
- Lockdown handshake fail → not allowed to start (P3.5)

### 8.4. Load test (k6)

- 500 concurrent students × 90 phút × heartbeat 10s + answer save mỗi 30s
- Target: p95 < 300ms, error rate < 0.1%
- Run trước khi ship P0.5 vào production server 224

---

## 9. Rủi ro & guard

| Rủi ro | Severity | Mitigation |
|---|---|---|
| Random pool sinh 2 attempt unfair (1 dễ, 1 khó) | High | Stratified sampling theo difficulty distribution |
| Heartbeat hot row 50 req/s | Med | Write coalescing 30s + bus cache sub-second |
| In-memory bus mất khi deploy roll | Low | EventSource auto-reconnect, seed lại từ DB |
| Bank edit phá exam đang dùng | High | `ExamQuestionFromBank` snapshot version, bank edit không touch exam published |
| Webcam GDPR vi phạm | High | Opt-in explicit, TTL 30d, delete API, audit log (§5.4 CLAUDE.md) |
| LLM grade lệch rubric | Med | Mọi LLM grade phải instructor approve, raw response trong audit |
| Cohort URL share bypass | Med | `startExamAttempt` re-check membership server-side, không trust client |
| Force-submit lạm quyền | Med | `assertCanEditCourse` + reason bắt buộc + audit `LearningEvent` |
| Multi-instance dùng in-memory bus → instructor 1 không thấy event từ instance 2 | High (chỉ khi scale-out) | Swap Redis pub/sub ở P5 trước khi scale |
| Append-only table accidentally truncated | High | Migration review thủ công cho mọi PR đụng append-only (§4.5 CLAUDE.md) |
| **P1.0**: Open code lộ public Internet → flood attempt | High | Rate-limit IP + `openMaxAttempts` cap + captcha sau 3 fail liên tiếp 1 IP |
| **P1.0**: Cookie `exam_session` bị share qua DevTools → 2 device 1 candidate | High | Cookie + `sessionToken` ngẫu nhiên, claim flow rotate token, IP/UA fingerprint vào incident |
| **P1.0**: Assigned code bị lộ trước kỳ thi | Med | Code 8 ký tự alphanumeric (~ 36^8) + rate-limit IP claim 10 lần/phút + instructor có thể rotate code 1 candidate trước khi thi |
| **P1.0**: Refactor `ExamAttempt.userId` nullable phá tests + queries hiện có | High | Migration partial unique index + sửa từng query đụng `attempt.userId` (audit 30+ files trong PR T2-D2) + test suite full pass trước khi merge |
| **P1.0**: Module B/C consume event với `userId=null` → null pointer | High | Event consumer filter `if (!event.userId) return` ngay đầu handler. Cấp policy: candidate attempt **không** contribute vào BKT/XP/badge |
| **P1.0**: `ExamCandidate.metadata` có thể chứa CCCD/SĐT → GDPR | Med | Metadata field optional, TTL 90 ngày sau exam closed, export + delete API ngay từ P1.0 |

---

## 10. Câu hỏi mở

### 10.1. Đã chốt
6 câu hỏi mở ban đầu (Question Bank visibility, Cohort, Random pool resolution, Proctoring tier mapping, LLM provider, Workers app) đã chốt → §3 (quyết định 1-10).

### 10.2. P1.0 — đã chốt 2026-05-13

| # | Câu hỏi | Quyết định cuối |
|---|---|---|
| Q1 | Open mode SĐT/email | **Bắt buộc cả 2 field** |
| Q2 | Open mode rate-limit per-IP | **50 attempt/giờ/IP** |
| Q3 | Assigned mode gửi mã qua email | **Có** — email integration trong scope P1.0 (provider Resend) |
| Q4 | Candidate đổi displayName | **Không**, ở cả 2 mode |
| Q5 | Resume khi mất cookie | Assigned: **được** · Open: **không** |
| Q6 | Xem kết quả | **Luôn re-enter code** mỗi lần |
| Q7 | LearningEvent cho candidate | **Có ghi** với userId=null + candidateId, consumer Module B/C filter |

**Câu hỏi mới cho từng phase sẽ ghi tại đầu mỗi tuần build.**

---

## 11. Tham chiếu

- CLAUDE.md root — nguyên tắc làm việc + tech stack + deployment
- `docs/SPEC.docx` §A7 — exam original spec
- `docs/A7-exam-P0-acceptance.md` — acceptance criteria P0 đã chốt
- Schema hiện tại: [`packages/db/prisma/schema.prisma:1660-1957`](../packages/db/prisma/schema.prisma)
- Service hiện tại: `packages/core-lms/src/exam/`
- Live dashboard prototype: `apps/web/src/app/instructor/courses/[id]/exams/[examId]/live/`
- Live bus: `apps/web/src/lib/exam-live-bus.ts`
