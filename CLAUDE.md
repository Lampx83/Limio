# CLAUDE.md — FeedBackMe

> Instructions for Claude Code khi làm việc trên repo này. Nguồn duy nhất của sự thật về business: `docs/SPEC.docx` (FeedBackMe-Specification-v2.docx). Khi spec mâu thuẫn với code, ưu tiên spec — code có thể đang ở giai đoạn build dở.

## 1. Architecture summary

FeedBackMe là LMS thế hệ mới, lấy **feedback cá nhân hóa** làm core differentiator. Hệ thống chia làm 3 module nghiệp vụ song song — **LMS Core** (A), **Feedback Engine** (B), **Gamification** (C) — và 1 lớp **Cross-cutting Integration** (D) khâu chúng lại với nhau. Kiến trúc 4 lớp: Presentation → Application (3 module) → Intelligence (skill graph, learner model, LLM) → Data & Infrastructure.

3 module **không gọi trực tiếp** lẫn nhau. Chúng giao tiếp qua 2 bridge: bảng `Skill` (kiến thức được model hóa thành DAG) và bảng `LearningEvent` (single source of truth cho mọi hành vi học, append-only, event-sourced). LMS phát event → Feedback Engine consume event để cập nhật `LearnerSkillState` (BKT) và sinh insight → Gamification dùng cả event lẫn insight để cấp XP, badge, quest, tournament.

Build theo phase, **không build hết module cùng lúc**. Phase 0 (LMS chạy được, không AI, không gamification) → Phase 1 (gamification cơ bản) → Phase 2 (Feedback Engine v1, rule-based trước LLM) → Phase 3 (integration deep + Tournament) → Phase 4 (LLM, mentor, advanced tournament).

## 2. Tech stack

| Layer | Công nghệ | Ghi chú |
|---|---|---|
| Frontend | Next.js 14+ App Router + Tailwind | SSR, file-based routing |
| Backend API | Next.js API Routes (hoặc tRPC) | Đồng nhất với FE |
| Database | PostgreSQL 15+ | Relational + JSON + pgvector extension |
| ORM | Prisma | Type-safe migrations |
| Cache | Redis | Leaderboard, session, rate-limit |
| Vector DB | pgvector | Semantic search, không thêm service riêng |
| Queue | BullMQ (Redis) | Email, badge check, daily aggregation |
| Video | Mux hoặc Cloudflare Stream | Streaming + analytics |
| LLM | Anthropic Claude API | Feedback generation, AI tutor |
| Auth | NextAuth.js v5 (Auth.js) | Multi-provider, email + Google OAuth |
| Payment | Stripe + VNPay/Momo | Global + VN |
| File storage | S3-compatible (R2 hoặc S3) | Submission, avatar, certificate |
| Monitoring | Sentry + PostHog | Error + product analytics |
| Hosting | Vercel (web) + Railway/Fly.io (DB) | |

## 3. Repository structure (đích — pnpm workspaces)

```
feedbackme/
├── apps/
│   ├── web/                  # Next.js frontend + API routes
│   └── workers/              # BullMQ background jobs
├── packages/
│   ├── db/                   # Prisma schema + migrations + seed
│   ├── core-lms/             # LMS business logic (course, enrollment, quiz)
│   ├── core-feedback/        # Learner model, BKT, diagnostic feedback
│   ├── core-gamification/    # XP, badge, quest, tournament
│   ├── shared-types/         # TypeScript types dùng chung
│   └── ui/                   # Shared React components
├── docs/
│   ├── SPEC.docx             # Source of truth nghiệp vụ
│   └── CLAUDE.md             # File này (đặt ở root theo lệnh user)
└── package.json              # pnpm workspace root
```

Hiện tại repo còn ở dạng single-package Next.js (chưa migrate sang monorepo).

## 4. Conventions

### 4.1. Feature ID

`MODULE.SUB-MODULE.FEATURE` — ví dụ `B1.3` = Module B (Feedback) → sub-module 1 (Learner Model) → feature 3. Khi commit / PR, tag feature ID trong message để trace ngược về spec. Priority: **P0** = phải có cho MVP, **P1** = quan trọng nhưng có thể delay, **P2** = nice-to-have.

### 4.2. Event naming (xem spec §6.1)

Format: `<domain>.<entity>.<verb_past_tense>` — ví dụ `lesson.viewed`, `quiz.question.answered`, `tournament.mission.completed`. Event payload là JSON, **schema-validated per event type**. Event là **idempotent** — replay được để rebuild state. Mọi action quan trọng phải emit event vào bảng `LearningEvent`. Cấm dùng DB trigger để propagate state — luôn đi qua application logic.

Một số namespace chuẩn:
- LMS: `lesson.*`, `quiz.*`, `assignment.*`, `enrollment.*`, `course.*`, `forum.*`
- Feedback: `skill.state.updated`, `misconception.*`, `feedback.*`, `adaptive.path.updated`
- Gamification: `xp.awarded`, `level.up`, `badge.earned`, `quest.completed`, `streak.*`, `leaderboard.updated`
- Tournament: `tournament.*` (created, registered, started, ended, mission.unlocked, mission.completed, ranking.updated, disqualified, prize.distributed)

### 4.3. Module boundary

- **3 module business KHÔNG import lẫn nhau.** core-lms không import core-feedback và ngược lại. Giao tiếp duy nhất là (a) Prisma models trong `packages/db`, (b) event qua `LearningEvent`, (c) bridge tables (`Skill`, `ContentSkillMapping`, `QuestionSkillTag`).
- `apps/web` là tầng orchestration — nó được phép gọi cả 3 core package và compose response.
- `packages/shared-types` chỉ chứa type, không chứa logic.
- `packages/db` chỉ export Prisma client + types; không chứa business logic.

### 4.4. Tagging skill

Mọi `Lesson`, `Quiz`, `QuizQuestion` **phải tag ít nhất 1 skill** trước khi `published`. Bắt buộc ở DB constraint hoặc service-layer validator — đây là điều kiện tiên quyết cho personalization (xem rủi ro §9 spec).

### 4.5. Migrations & schema

Mọi thay đổi schema đi qua `prisma migrate` — không chỉnh DB tay. Index phải được khai báo trong `schema.prisma` (xem §4.6 dưới đây cho danh sách index nóng). `LearningEvent` là **append-only** — không bao giờ UPDATE/DELETE, kể cả trong test cleanup (dùng schema riêng cho test).

### 4.6. Index nóng (xem spec §7.3)

| Bảng | Index |
|---|---|
| `LearningEvent` | `(userId, occurredAt)` + `(eventType, occurredAt)` |
| `LeaderboardEntry` | `(courseId, period, rank)` cho top-N |
| `LearnerSkillState` | `(userId, masteryProbability)` để tìm weak skills |
| `QuizAttempt` | `(userId, quizId)` |

Composite index khi query luôn dùng cả 2 field. Plan partition cho `LearningEvent` (theo tháng), `XpTransaction` (theo quý), `AnswerResponse` (theo year) khi user > 1M.

## 5. Năm nguyên tắc khi viết code

Năm nguyên tắc dưới đây tổng hợp từ spec §6.1 (event-driven boundary), §7.3 (index strategy & event sourcing), §9 (risk register). **Không vi phạm**, kể cả khi tiện hơn:

1. **Event sourcing là bắt buộc, không phải optional.** Mọi action user-facing có ý nghĩa nghiệp vụ (view lesson, submit quiz, award XP, earn badge…) **phải emit `LearningEvent`** ngay trong cùng transaction tạo ra state change. Không có event = không có history = không rebuild được state. `LearningEvent` append-only, idempotent, JSON payload có schema. (§6.1, §7.3 — `LearningEvent` là append-only)

2. **Module giao tiếp qua event và bridge tables, không bao giờ qua import trực tiếp.** core-feedback không gọi function của core-gamification. Nếu gamification cần biết learner đã master skill nào → đọc `LearnerSkillState`. Nếu feedback cần biết learner đã được award XP nào → đọc `XpTransaction` hoặc subscribe event. Vi phạm điều này ⇒ refactor 3 module thành 1 monolith trong vòng 6 tháng (rủi ro "3 module coupling quá chặt", §9).

3. **Tag skill là tiền đề cho mọi personalization.** Reject lesson/quiz/question chưa tag skill ở publish-time. Không có skill tag ⇒ không có learner model ⇒ không có feedback ⇒ không có adaptive path ⇒ không có skill badge. Đây là rủi ro "high" trong §9 ("Instructor không tag skill chi tiết → personalization yếu"). Build LLM tagger semi-auto từ Phase 0, không để Phase 3 mới làm.

4. **Privacy & GDPR là default, không phải feature riêng.** Learner profile (BKT state, misconception flags, mastery probabilities) là dữ liệu nhạy cảm. Mọi endpoint expose dữ liệu này phải authenticate + authorize. Cung cấp export & delete API cho learner ngay từ A1 — đừng để dồn cuối Phase 4. Audit log mọi role change (§3.1 spec). Hide rank quá thấp trên leaderboard, opt-out leaderboard hoàn toàn được, display name không bắt buộc real name.

5. **Anti-farming và adaptive reward sizing là code, không phải afterthought.** XP system (§5.1, §6.3) phải có cap per-action-per-day, multiplier theo mastery (quiz dễ với learner giỏi → XP thấp), reject "speed run" (< 10s pass quiz). Tournament prize → manual review top 3 + IP/device fingerprint + pattern detection (§5.6 spec). Không có những guard này, gamification sẽ phá hoại learning thật (rủi ro "Cao" trong §9 — "Gamification conflict với learning thật / XP farming").

## 6. Workflow với Claude Code

- Khi bắt đầu một feature, ra lệnh dạng "Implement module B1 (Learner Modeling) theo spec ở mục 4.1". Claude sẽ tham chiếu lại spec.
- Mỗi feature: viết **acceptance criteria checklist** từ spec (Given-When-Then) **trước khi** code, viết test, rồi mới impl.
- Build theo Phase Roadmap (§8 spec). Không build P1/P2 trước khi xong P0 của phase đang làm.
- Sau mỗi feature, pause để user review trước khi sang feature kế.

## 7. Tham chiếu nhanh

- Spec đầy đủ: `docs/SPEC.docx` (hiện đang ở `Feedback me 2/FeedBackMe-Specification-v2.docx`)
- Schema Prisma: `packages/db/schema.prisma` (chưa tồn tại — sẽ build từ spec §7)
- Schema Tournament đã có sẵn trong spec §7.5 (5 bảng) — copy thẳng vào schema.prisma.
- Roadmap & priority: spec §8.
- Risk register: spec §9.
- Glossary (BKT, DKT, skill graph, misconception, spaced repetition, cohort…): spec §10.1.
