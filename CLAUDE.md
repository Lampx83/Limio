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

### 4.4. Tagging skill — lesson-as-tag (B1.5)

Skill tag **không còn là việc tay của GV**. Với course có `personalizationEnabled = true`, hệ thống tự sinh 1 `Skill` cho mỗi `Lesson` (code `lesson.<lessonId>`, tên = tiêu đề bài) kèm `ContentSkillMapping`; `QuizQuestion` kế thừa tag của lesson mà quiz gắn vào. Toàn bộ logic ở `packages/core-lms/src/courses/autoTags.ts`, hook vào lesson CRUD + question CRUD + `publishCourse` + lúc bật cờ personalization.

Quy tắc:
- Tag GV tự tạo **luôn thắng** tag tự sinh; gắn tag tay sẽ gỡ tag tự sinh khỏi câu hỏi đó.
- Quiz standalone (không gắn lesson) **không** được auto-tag — gap có chủ ý.
- Course `personalizationEnabled = false` không sinh row nào (LMS thuần, không rác DB).
- Convention prefix nằm ở `packages/shared-types/src/skills.ts` vì cả core-lms lẫn core-feedback đều cần, mà 2 module không được import nhau.
- Dữ liệu cũ: `pnpm backfill:lesson-tags` (idempotent, chỉ đụng course đã bật personalization).

Skill graph (`SkillPrerequisite`) vẫn còn trong schema nhưng **không được Feedback Engine dùng** — không build tính năng mới dựa vào nó.

### 4.5. Migrations & schema

Mọi thay đổi schema đi qua `prisma migrate` — không chỉnh DB tay. Index phải được khai báo trong `schema.prisma` (xem §4.6 dưới đây cho danh sách index nóng). `LearningEvent` là **append-only** — không bao giờ UPDATE/DELETE, kể cả trong test cleanup (dùng schema riêng cho test).

### 4.6. UI/UX conventions

**Breakpoints** (Tailwind defaults):

| Bí danh | Phạm vi | Dùng cho |
|---|---|---|
| (default) | `< 640px` | Mobile — 1 cột, sticky CTA, drawer thay sidebar |
| `sm:` | `≥ 640px` | Mobile lớn — bắt đầu 2-col grid |
| `md:` | `≥ 768px` | Tablet — show inline filters, multi-col forms |
| `lg:` | `≥ 1024px` | Desktop — bật sidebar, 3-col grid, sticky TOC |
| `xl:` | `≥ 1280px` | Desktop rộng — 4-col grid catalog |

**Quy ước:**
- Sidebar luôn collapse thành drawer ở `< lg`. Không dùng `md:`-only sidebar.
- Grid card: 1 col mặc định → `sm:grid-cols-2` → `lg:grid-cols-3` (catalog) hoặc `xl:grid-cols-4`.
- Sticky CTA mobile fixed-bottom dưới `lg`. Từ `lg:` thì CTA nằm trong sidebar.

**Typography**: dùng `.text-display / .text-h1..h4 / .text-body / .text-meta / .text-caption` (xem `globals.css`). Không dùng `text-{size}` ad-hoc cho heading.

**Semantic banner**: `.banner-success/warning/info/danger` thay `bg-yellow-50` raw.

**Shared UI primitives** (trong `apps/web/src/components/ui/`): `<EmptyState>`, `<UserAvatar>`, `<StatusBadge>`, `<DateTime>`, `<StickyMobileCTA>` + `<Skeleton*>` ở `components/Skeleton.tsx`. Đừng tự reimplement trong từng page.

### 4.7. Index nóng (xem spec §7.3)

| Bảng | Index |
|---|---|
| `LearningEvent` | `(userId, occurredAt)` + `(eventType, occurredAt)` |
| `LeaderboardEntry` | `(courseId, period, rank)` cho top-N |
| `LearnerSkillState` | `(userId, masteryProbability)` để tìm weak skills |
| `QuizAttempt` | `(userId, quizId)` |

Composite index khi query luôn dùng cả 2 field. Plan partition cho `LearningEvent` (theo tháng), `XpTransaction` (theo quý), `AnswerResponse` (theo year) khi user > 1M.

### 4.8. Feedback instrumentation (B9)

Mỗi `FeedbackDelivery` mang **toạ độ SSMMD của chính nó**, ghi lúc sinh chứ không đoán ngược từ text: `level` (tầng trội) + `levels` (mọi tầng có mặt) + `elaboration` + `sourceKind` + `generationContext`. Logic ở `packages/core-feedback/src/coding.ts` (hàm thuần `codeFeedback`).

- **Thêm đường sinh feedback mới ⇒ phải code delivery đó.** Delivery không có toạ độ là dữ liệu không phân tích được, và nó im lặng — không ai phát hiện cho đến lúc chạy thống kê.
- `self` **không bao giờ** được emit ở tầng meso: khen ngợi cá nhân nằm ở kênh gamification (Hattie: FS kém hiệu quả nhất). Enum có giá trị đó chỉ để schema biểu diễn được nếu sau này đổi ý.
- `masteryAtGeneration` phải do **caller snapshot trước khi chấm** (`getMasterySnapshotForAttempt`), vì BKT update chạy song song với sinh feedback. Không snapshot ⇒ để trống, **không** đọc đại một giá trị đang bị race.
- Cột toạ độ **nullable** có chủ ý: hàng trước B9 chưa từng được mã hoá, không được làm cho giống như đã. Backfill: `pnpm backfill:feedback-coding`, đánh dấu `generationContext.codedRetroactively = true`.
- `feedback.remediation.clicked` đo uptake — biến trung gian quan trọng nhất khi đánh giá feedback. Ghi event **không bao giờ được chặn hay làm chậm điều hướng** của học viên (xem `RemediationLink`).

## 5. Năm nguyên tắc khi viết code

Năm nguyên tắc dưới đây tổng hợp từ spec §6.1 (event-driven boundary), §7.3 (index strategy & event sourcing), §9 (risk register). **Không vi phạm**, kể cả khi tiện hơn:

1. **Event sourcing là bắt buộc, không phải optional.** Mọi action user-facing có ý nghĩa nghiệp vụ (view lesson, submit quiz, award XP, earn badge…) **phải emit `LearningEvent`** ngay trong cùng transaction tạo ra state change. Không có event = không có history = không rebuild được state. `LearningEvent` append-only, idempotent, JSON payload có schema. (§6.1, §7.3 — `LearningEvent` là append-only)

2. **Module giao tiếp qua event và bridge tables, không bao giờ qua import trực tiếp.** core-feedback không gọi function của core-gamification. Nếu gamification cần biết learner đã master skill nào → đọc `LearnerSkillState`. Nếu feedback cần biết learner đã được award XP nào → đọc `XpTransaction` hoặc subscribe event. Vi phạm điều này ⇒ refactor 3 module thành 1 monolith trong vòng 6 tháng (rủi ro "3 module coupling quá chặt", §9).

3. **Tag skill là tiền đề cho mọi personalization — nên nó phải tự động.** Không có skill tag ⇒ không có learner model ⇒ không có feedback ⇒ không có adaptive path ⇒ không có skill badge. Rủi ro "high" trong §9 ("Instructor không tag skill chi tiết → personalization yếu") được xử lý bằng cách bỏ hẳn bước tag tay: lesson-as-tag (§4.4) sinh tag từ cấu trúc khoá học. Khi thêm loại nội dung mới có thể sinh câu hỏi, **phải hook auto-tag vào đường tạo đó** — quên hook = nội dung đó vô hình với personalization.

4. **Privacy & GDPR là default, không phải feature riêng.** Learner profile (BKT state, misconception flags, mastery probabilities) là dữ liệu nhạy cảm. Mọi endpoint expose dữ liệu này phải authenticate + authorize. Cung cấp export & delete API cho learner ngay từ A1 — đừng để dồn cuối Phase 4. Audit log mọi role change (§3.1 spec). Hide rank quá thấp trên leaderboard, opt-out leaderboard hoàn toàn được, display name không bắt buộc real name.

5. **Anti-farming và adaptive reward sizing là code, không phải afterthought.** XP system (§5.1, §6.3) phải có cap per-action-per-day, multiplier theo mastery (quiz dễ với learner giỏi → XP thấp), reject "speed run" (< 10s pass quiz). Tournament prize → manual review top 3 + IP/device fingerprint + pattern detection (§5.6 spec). Không có những guard này, gamification sẽ phá hoại learning thật (rủi ro "Cao" trong §9 — "Gamification conflict với learning thật / XP farming").

## 6. Workflow với Claude Code

- Khi bắt đầu một feature, ra lệnh dạng "Implement module B1 (Learner Modeling) theo spec ở mục 4.1". Claude sẽ tham chiếu lại spec.
- Mỗi feature: viết **acceptance criteria checklist** từ spec (Given-When-Then) **trước khi** code, viết test, rồi mới impl.
- Build theo Phase Roadmap (§8 spec). Không build P1/P2 trước khi xong P0 của phase đang làm.
- Sau mỗi feature, pause để user review trước khi sang feature kế.

### 6.1. Nhiều phiên Claude Code chạy song song — DB/Redis dev dùng chung

Repo này thường có **nhiều phiên Claude Code chạy đồng thời** (nhiều cửa sổ, hoặc `git worktree` riêng cho từng agent/task). Tất cả cùng trỏ vào **một** Postgres + Redis dev duy nhất (`localhost:5434` / `:6379`, chạy từ checkout gốc qua `docker-compose.yml`).

- **Chỉ checkout gốc được chạy `docker compose up` / `pnpm db:up` cho `postgres`/`redis`.** Nếu bạn đang ở trong một `git worktree` (thường ở `.claude/worktrees/<tên>/`), **không tự khởi động Postgres/Redis riêng** — Prisma/app của bạn dùng lại instance đang chạy sẵn qua `localhost:5434`/`:6379` (giống hệt checkout gốc, vì DATABASE_URL/REDIS_URL không đổi giữa các worktree).
- Nếu `docker compose up` báo lỗi port đã bị chiếm (`address already in use`) khi bạn chạy trong 1 worktree — đó là **tín hiệu đúng**, không phải bug cần fix bằng cách đổi port: nghĩa là Postgres/Redis dev đã chạy sẵn ở nơi khác, cứ dùng luôn, đừng cố chạy thêm 1 bộ mới.
- **Sự cố đã xảy ra (2026-09-13):** một worktree cũ từng đặt `container_name` trùng với checkout gốc trong `docker-compose.yml` (lúc đó chưa có cảnh báo này) → 2 project Compose giành nhau 1 tên container + 1 port, container nào lên sau "thắng" nhưng lại mount volume KHÁC (dữ liệu rẽ nhánh âm thầm, không báo lỗi). Hậu quả: dev DB "lùi thời gian" hàng giờ liền, phải phục hồi bằng tay (dump từ volume worktree cũ, restore đè). `docker-compose.yml` đã bỏ `container_name` cố định để lỗi này từ nay báo ngay lập tức (port conflict) thay vì âm thầm phân nhánh dữ liệu — xem comment đầu file đó.
- Khi nghi ngờ dev DB "sai lạ" (thiếu bảng/cột đáng lẽ đã có, dữ liệu cũ bất thường): `docker ps -a`, `docker volume ls` — kiểm tra có đúng 1 container Postgres đang chạy, mount đúng volume `feedbackme_feedbackme-pg` hay không, trước khi kết luận là bug code.

## 7. Deployment (production — server 224)

Production chạy **hoàn toàn bằng Docker** trên một server nội bộ (gọi tắt **server 224**). CI/CD qua GitHub Actions với **self-hosted runner cài ngay trên server 224** — runner build và `docker compose up` tại chỗ, không cần SSH/registry trung gian.

### 7.1. Topology

```
GitHub push (main)
   └─ deploy.yml chạy trên runner labels: [self-hosted, Linux]
       └─ docker compose -f docker-compose.prod.yml --env-file /etc/feedbackme/.env.prod
           ├─ postgres (volume postgres-data)
           ├─ redis    (volume redis-data)
           ├─ migrate  (one-shot: prisma migrate deploy)
           ├─ web      (Next.js standalone, host port WEB_PORT=8004 → container 3000)
           └─ cron     (busybox crond → curl WEB ${CRON_SECRET})
```

Reverse proxy ngoài compose (Caddy/Nginx/Traefik) đứng trước `web` để TLS + serve `NEXTAUTH_URL`.

### 7.2. Files liên quan

| File | Vai trò |
|---|---|
| `Dockerfile` | Multi-stage: `deps → builder → migrator | runner`. Runner dùng Next.js standalone, non-root user (uid 1001), HEALTHCHECK qua curl. |
| `docker-compose.prod.yml` | Stack production. Image tag = `${IMAGE_TAG:-latest}` (CI override = git SHA). |
| `docker/cron/*` | Sidecar thay 2 cron Vercel cũ (`streak-grace-check` daily, `tournament-tick` mỗi 5 phút). |
| `.env.prod.example` | Template biến môi trường production. **Không commit** `.env.prod`. |
| `.github/workflows/ci.yml` | Lint/typecheck/test/build trên `ubuntu-latest` (cloud, free) + verify Docker image build. |
| `.github/workflows/deploy.yml` | Chạy trên `[self-hosted, Linux]`. Build → migrate → roll out → wait healthy → prune. |

### 7.3. Setup 1 lần trên server 224

1. **Cài runner** (workflow chỉ cần label mặc định `self-hosted` + `Linux`):
   ```bash
   ./config.sh --url https://github.com/Lampx83/FeedBackMe --token <TOKEN> \
               --name feedbackme-prod
   sudo ./svc.sh install && sudo ./svc.sh start
   ```
   Nếu sau này có nhiều runner và muốn pin riêng cho repo này → thêm `--labels feedbackme` rồi sửa `runs-on` trong `deploy.yml` thành `[self-hosted, feedbackme]`.
2. **Tạo env file** (mặc định workflow đọc tại `/etc/feedbackme/.env.prod`; override bằng repo variable `ENV_FILE`):
   ```bash
   sudo install -d -m 750 /etc/feedbackme
   sudo cp .env.prod.example /etc/feedbackme/.env.prod
   sudo chmod 600 /etc/feedbackme/.env.prod
   # Bắt buộc điền: POSTGRES_PASSWORD, NEXTAUTH_URL, NEXTAUTH_SECRET, CRON_SECRET
   ```
   Sinh secret: `openssl rand -base64 32` (NEXTAUTH_SECRET) / `openssl rand -hex 32` (CRON_SECRET).
3. **User chạy runner phải vào group `docker`** (`usermod -aG docker <runner-user>`), tránh sudo trong workflow.
4. **Reverse proxy** trỏ `NEXTAUTH_URL` → `127.0.0.1:${WEB_PORT}` (mặc định production = **8004**) và lo TLS.

### 7.4. Vận hành thủ công (bỏ qua CI)

```bash
ENV=/etc/feedbackme/.env.prod
COMPOSE="docker compose --env-file $ENV -f docker-compose.prod.yml"

$COMPOSE build --pull            # build images
$COMPOSE run --rm migrate        # áp migration (one-shot)
$COMPOSE up -d postgres redis web cron
$COMPOSE logs -f web             # tail log
$COMPOSE down                    # dừng stack (giữ volume)
```

Rollback nhanh: `IMAGE_TAG=<git-sha-cũ> $COMPOSE up -d web` (image cũ phải còn, đừng prune ngay sau deploy nếu chưa chắc).

### 7.5. Lưu ý vận hành

- **`LearningEvent` append-only** (xem §4.5) → không bao giờ DROP/TRUNCATE trong production. Migration nào đụng tới event/audit table phải review tay.
- **Volume cần backup**: `feedbackme_postgres-data`, `feedbackme_web-uploads`. Redis có thể mất (chỉ là cache + queue) — nhưng BullMQ job đang chờ sẽ mất theo, lưu ý khi restore.

### 7.6. Backup & restore

Script ở `docker/backup/`, cài trên server 224 tại `/home/codelab/services/backup/`:

```bash
feedbackme-backup.sh daily|weekly|manual [label]   # cron: 2h30 hằng ngày, 4h30 CN
feedbackme-restore.sh <backup-dir> [--db-only|--uploads-only] --yes
```

| Thành phần | Cách bảo vệ | Vì sao |
|---|---|---|
| Postgres | `pg_dump -Fc` mỗi lần chạy, giữ 14 bản daily / 8 weekly | Dump ~2 MB, rẻ |
| Uploads | **Mirror** tại `feedbackme-backup-data/uploads-mirror`, không tar | ~9 GB video bất biến; nén hằng tuần tốn ~70 GB đĩa mà không an toàn hơn. Mirror chỉ thêm, không xoá — nên lỡ xoá trên volume thật cũng không lan sang bản sao |

**Mọi artefact đều được kiểm chứng ngay sau khi tạo**, và verify thất bại là lỗi cứng chứ không phải cảnh báo:
- dump phải đọc được bằng `pg_restore --list` và chứa đủ `LearningEvent`, `User`, `Course`, `Lesson`, `XpTransaction`
- ghi lại số dòng vào `rowcounts.txt` để lần sau bị cắt cụt là thấy ngay
- bản weekly đối chiếu mirror với DB: mọi video `ContentItem` phải có file thật

**Chưa có bản sao ngoài máy.** NAS `172.17.18.18` không kết nối được (ScoreUp cũng hỏng bước này từ 05/07/2026, thất bại lặng lẽ 90 lần). Script vẫn chạy xong và ghi `offsite=UNREACHABLE` vào manifest + log. Đến khi NAS thông, backup và bản gốc nằm chung một ổ đĩa — hỏng ổ là mất cả hai.

Kiểm tra định kỳ bằng cách restore vào DB tạm rồi so số dòng (không đụng prod):

```bash
docker exec feedbackme-postgres-1 psql -U feedbackme -d postgres -c "CREATE DATABASE restore_test;"
docker cp <dir>/postgres.dump feedbackme-postgres-1:/tmp/rt.dump
docker exec feedbackme-postgres-1 pg_restore -U feedbackme -d restore_test /tmp/rt.dump
```
- **Cron secret rotation**: đổi `CRON_SECRET` trong `.env.prod` rồi `$COMPOSE up -d web cron` (cả hai cần cùng giá trị).
- **Healthcheck web** dùng `GET /` — nếu đổi sang đường health riêng (vd. `/api/health`), nhớ sửa cả `Dockerfile` và workflow `Wait for web to become healthy`.

## 8. Tham chiếu nhanh

- Spec đầy đủ: `docs/SPEC.docx` (hiện đang ở `Feedback me 2/FeedBackMe-Specification-v2.docx`)
- Schema Prisma: `packages/db/schema.prisma` (chưa tồn tại — sẽ build từ spec §7)
- Schema Tournament đã có sẵn trong spec §7.5 (5 bảng) — copy thẳng vào schema.prisma.
- Roadmap & priority: spec §8.
- Risk register: spec §9.
- Glossary (BKT, DKT, skill graph, misconception, spaced repetition, cohort…): spec §10.1.
