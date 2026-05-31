/**
 * Seed: Tournament "EDT — Pitch ý tưởng EdTech (Hè 2026)"
 *
 * Dựng tournament theo Bài tập lớn học phần "Nhập môn ngành Công nghệ Giáo dục"
 * (GV Nguyễn Thị Huyền) — pitch ý tưởng sản phẩm EdTech theo đội, 2 tuần
 * (29/5 → 12/6/2026), gồm 5 mission M0–M4 với peer review + chấm tay.
 *
 *   - Instructor: huyen@feedbackme.dev / password1234  (learner + instructor)
 *   - Tournament team-based: teamSize 7, platform-wide (không gắn course)
 *     ├─ M0  Đăng ký đội & chốt ý tưởng    — CUSTOM · MANUAL_REVIEW · team · 29/5
 *     ├─ M1  Nộp Idea Brief (PDF 1–2 trang) — CUSTOM · MANUAL_REVIEW · team · 2/6   (prereq M0)
 *     ├─ M2  Nộp Video Pitch + Phân công    — CUSTOM · PEER_REVIEW  · team · 9/6   (prereq M1) [CORE]
 *     ├─ M3  Hoàn thành ≥5 phiếu peer review — CUSTOM · MANUAL_REVIEW · cá nhân · 11/6 (prereq M2)
 *     └─ M4  Top 5: slide & pitch trực tiếp  — CUSTOM · MANUAL_REVIEW · team · 12/6  (prereq M2)
 *
 * MANUAL_REVIEW mission tạo kèm 1 Assignment ẩn (giống API
 * POST /api/tournaments/:id/missions) để tái dùng luồng chấm tay của GV.
 *
 * Idempotent: chạy lại nhiều lần an toàn — bỏ qua nếu tournament đã tồn tại
 * (so theo title) và chỉ upsert user.
 *
 * Run (DB local cổng 5433):
 *   DATABASE_URL="postgresql://postgres:postgres@localhost:5433/feedbackme" \
 *     pnpm --filter @feedbackme/db exec tsx src/seed-edtech-pitch-tournament.ts
 */

import bcrypt from "bcryptjs";
import { PrismaClient } from "./generated/client";

const prisma = new PrismaClient();

// ── Constants ────────────────────────────────────────────────────────────────
const INSTRUCTOR_EMAIL = "huyen@feedbackme.dev";
const PASSWORD = "password1234";
const TOURNAMENT_TITLE = "EDT — Pitch ý tưởng EdTech (Hè 2026)";

// Múi giờ VN (+07). Dùng offset tường minh để mốc deadline đúng giờ Việt Nam.
const D = (iso: string) => new Date(iso); // iso đã kèm +07:00

// ── Helpers ──────────────────────────────────────────────────────────────────
async function ensureRole(name: string) {
  return prisma.role.upsert({ where: { name }, update: {}, create: { name } });
}

async function ensureUser(email: string, displayName: string, roleNames: string[]) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`  ↳ User đã tồn tại: ${email}`);
    return existing.id;
  }
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const roles = await Promise.all(
    roleNames.map((n) => prisma.role.findUniqueOrThrow({ where: { name: n } })),
  );
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName,
      emailVerifiedAt: new Date(),
      authProviders: { create: { provider: "password", providerUserId: email } },
      userRoles: { create: roles.map((r) => ({ roleId: r.id })) },
    },
  });
  console.log(`  ↳ Tạo user: ${email} / ${PASSWORD}`);
  return user.id;
}

/**
 * Tạo 1 mission MANUAL_REVIEW + Assignment ẩn (đúng như API tạo mission).
 */
async function createManualMission(args: {
  tournamentId: string;
  orderIndex: number;
  title: string;
  description: string;
  instructions: string;
  points: number;
  deadline: Date;
  isTeamSubmission: boolean;
  prerequisiteId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const m = await tx.tournamentMission.create({
      data: {
        tournamentId: args.tournamentId,
        orderIndex: args.orderIndex,
        title: args.title,
        description: args.description,
        points: args.points,
        prerequisiteId: args.prerequisiteId ?? null,
        missionType: "CUSTOM",
        verifyMode: "MANUAL_REVIEW",
        submissionDeadline: args.deadline,
        passThreshold: 0.5,
        isTeamSubmission: args.isTeamSubmission,
        contentPayload: { instructions: args.instructions } as never,
      },
      select: { id: true },
    });
    await tx.assignment.create({
      data: {
        title: args.title,
        description: args.description,
        isHidden: true,
        tournamentMissionId: m.id,
        dueAt: args.deadline,
      },
    });
    return m;
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀  Seeding: " + TOURNAMENT_TITLE);

  // 1. Roles & instructor
  console.log("\n1. Roles & instructor");
  for (const r of ["admin", "instructor", "learner"]) await ensureRole(r);
  const instructorId = await ensureUser(
    INSTRUCTOR_EMAIL,
    "Nguyễn Thị Huyền",
    ["learner", "instructor"],
  );

  // 2. Idempotency — bỏ qua nếu tournament đã có
  const dup = await prisma.tournament.findFirst({ where: { title: TOURNAMENT_TITLE } });
  if (dup) {
    console.log(`\n⏭  Tournament "${TOURNAMENT_TITLE}" đã tồn tại (id=${dup.id}) — bỏ qua.`);
    console.log("   Xoá thủ công nếu muốn seed lại:");
    console.log(`   DELETE FROM "Tournament" WHERE id = '${dup.id}';`);
    return;
  }

  // 3. Tournament
  console.log("\n2. Tournament");
  const tournament = await prisma.tournament.create({
    data: {
      title: TOURNAMENT_TITLE,
      description: [
        "Cuộc thi pitch ý tưởng sản phẩm Công nghệ Giáo dục (EdTech) theo đội — học phần",
        "Nhập môn ngành Công nghệ Giáo dục. Mỗi đội 5–7 sinh viên đóng vai một startup",
        "giáo dục: chọn một vấn đề giáo dục có thật, đề xuất sản phẩm EdTech và thuyết phục",
        "\"nhà đầu tư\" (giảng viên + cả lớp) qua một video pitch 3–5 phút.",
        "",
        "Lộ trình 2 tuần (29/5 → 12/6/2026) gồm 5 nhiệm vụ: đăng ký đội & chốt ý tưởng (M0),",
        "nộp Idea Brief (M1), nộp Video Pitch + Báo cáo phân công (M2 — chấm chéo bằng peer review),",
        "hoàn thành phiếu peer review (M3) và Top 5 pitch trực tiếp tại lớp (M4).",
      ].join("\n"),
      status: "draft",
      courseId: null, // platform-wide — mission là CUSTOM, không gắn nội dung khoá
      creatorId: instructorId,
      teamSize: 7,
      allowLateRegistration: true, // cho đăng ký đội trong buổi kick-off 29/5
      startsAt: D("2026-05-29T08:00:00+07:00"),
      endsAt: D("2026-06-12T17:30:00+07:00"),
      prizeXp: 5000,
      prizeDistribution: { "1": 50, "2": 30, "3": 20 },
    },
  });
  console.log(`  ↳ Tournament created: id=${tournament.id}`);

  // 4. Missions
  console.log("\n3. Missions");

  // M0 — Đăng ký đội & chốt ý tưởng (MANUAL · team · 29/5)
  const m0 = await createManualMission({
    tournamentId: tournament.id,
    orderIndex: 1,
    title: "M0 — Đăng ký đội & chốt ý tưởng",
    description:
      "Trưởng nhóm tạo đội (5–7 thành viên) và nộp tên sản phẩm + 1 câu mô tả ý tưởng EdTech. " +
      "Hoàn tất ngay trong buổi kick-off 29/5. Giảng viên duyệt để xác nhận đội hợp lệ.",
    instructions: [
      "## Việc cần làm trong M0 (hạn 23h59 Thứ Sáu 29/5)",
      "",
      "1. **Trưởng nhóm** vào tab *Đội* → **Tạo đội**, đặt tên đội rồi chia sẻ **mã đội (join code)** cho các bạn.",
      "2. Các thành viên còn lại vào **Tham gia đội** và nhập mã đội. Đội cần 5–7 người.",
      "3. Trưởng nhóm nộp M0 với nội dung:",
      "   - Tên sản phẩm (tạm thời cũng được).",
      "   - 1 câu mô tả: *\"Sản phẩm X là Y giúp Z\"*.",
      "   - Vấn đề giáo dục đội định giải quyết (2–3 câu).",
      "   - Danh sách thành viên (Họ tên + MSV).",
      "",
      "Giảng viên sẽ **duyệt (PASS)** nếu đội hợp lệ và ý tưởng rõ ràng.",
    ].join("\n"),
    points: 100,
    deadline: D("2026-05-29T23:59:00+07:00"),
    isTeamSubmission: true,
  });
  console.log("  ↳ M0 created (MANUAL · team)");

  // M1 — Nộp Idea Brief (MANUAL · team · 2/6, prereq M0)
  const m1 = await createManualMission({
    tournamentId: tournament.id,
    orderIndex: 2,
    title: "M1 — Nộp Idea Brief (PDF 1–2 trang)",
    description:
      "Đội nộp hồ sơ ý tưởng (Idea Brief) dạng PDF 1–2 trang theo mẫu Phụ lục A. " +
      "Đây là tài liệu để các đội khác đọc trước khi peer review video ở M2.",
    instructions: [
      "## Idea Brief — hạn 23h59 Thứ Ba 2/6",
      "",
      "Nộp **1 file PDF (1–2 trang)** gồm 4 phần:",
      "",
      "1. **Tóm tắt** — tên đội + thành viên, tên sản phẩm + 1 câu mô tả, vấn đề giáo dục, người dùng mục tiêu.",
      "2. **Vấn đề & Người dùng** — mô tả \"nỗi đau\", bằng chứng từ mini khảo sát/phỏng vấn, 1 persona cụ thể.",
      "3. **Giải pháp & Thị trường** — sản phẩm hoạt động ra sao (sơ đồ/mockup), 3–5 tính năng cốt lõi, so sánh 2–3 đối thủ, mô hình kinh doanh sơ bộ.",
      "4. **Đội ngũ & Bước tiếp theo** — vai trò từng thành viên, roadmap 3–6 tháng.",
      "",
      "Trưởng nhóm nộp link PDF (Drive/Dropbox công khai) hoặc tải file trực tiếp.",
      "**Trễ M1** — đội vẫn làm tiếp nhưng **mất điểm Hồ sơ**.",
    ].join("\n"),
    points: 300,
    deadline: D("2026-06-02T23:59:00+07:00"),
    isTeamSubmission: true,
    prerequisiteId: m0.id,
  });
  console.log("  ↳ M1 created (MANUAL · team, prereq M0)");

  // M2 — Nộp Video Pitch + Báo cáo phân công (PEER_REVIEW · team · 9/6, prereq M1) [CORE]
  const m2 = await prisma.tournamentMission.create({
    data: {
      tournamentId: tournament.id,
      orderIndex: 3,
      title: "M2 — Nộp Video Pitch + Báo cáo phân công",
      description:
        "Sản phẩm chính: video pitch 3–5 phút (MP4 1080p, 16:9, có phụ đề tiếng Việt) + báo cáo phân công. " +
        "Cả lớp peer review chéo theo rubric 5 tiêu chí. Đây là nhiệm vụ trọng tâm quyết định Top 5.",
      points: 1000,
      prerequisiteId: m1.id,
      missionType: "CUSTOM",
      verifyMode: "PEER_REVIEW",
      isTeamSubmission: true,
      submissionDeadline: D("2026-06-09T23:59:00+07:00"),
      reviewWindowEndAt: D("2026-06-11T23:59:00+07:00"),
      peerReviewerCount: 5,
      passThreshold: 0.5,
      rubric: [
        { id: "edu", label: "Tính giáo dục của ý tưởng", scale: "1-5", weight: 25 },
        { id: "creative", label: "Tính sáng tạo và khả thi", scale: "1-5", weight: 20 },
        { id: "market", label: "Hiểu biết người dùng & thị trường", scale: "1-5", weight: 20 },
        { id: "story", label: "Chất lượng truyền đạt & storytelling", scale: "1-5", weight: 20 },
        { id: "tech", label: "Chất lượng kỹ thuật video", scale: "1-5", weight: 15 },
      ] as never,
      contentPayload: {
        instructions: [
          "## Video Pitch — hạn 23h59 Thứ Ba 9/6",
          "",
          "**Yêu cầu sản phẩm:**",
          "- Video MP4, 1080p+, tỉ lệ 16:9, ≤ 200 MB, dài **3:00–5:00** (5:00–5:15 chấp nhận; >5:30 không nhận).",
          "- Có **phụ đề tiếng Việt** gắn vào video; slide bìa tên đội + tên sản phẩm ở giây đầu.",
          "- Cấu trúc 6 phần: Hook → Problem → Solution+Demo → Market&User → Team&Plan → Ask&Close.",
          "- Kèm **Báo cáo phân công** (Phụ lục B) với hệ số đóng góp + chữ ký thành viên.",
          "",
          "**Cách nộp:** trưởng nhóm dán link YouTube/Drive (public/unlisted) hoặc tải MP4 + link báo cáo.",
          "",
          "**Peer review (10/6 → 11/6):** hệ thống tự phân phối video cho người chấm (ẩn danh). " +
            "Chấm theo 5 tiêu chí thang 1–5; viết nhận xét theo cấu trúc 2-1-1 (2 điểm mạnh, 1 cải thiện, 1 câu hỏi).",
          "",
          "⚠️ **Trễ M2 = không vào được vòng peer review = mất cơ hội Top 5.**",
        ].join("\n"),
      } as never,
    },
    select: { id: true },
  });
  console.log("  ↳ M2 created (PEER_REVIEW · team, prereq M1) [CORE]");

  // M3 — Hoàn thành ≥5 phiếu peer review (MANUAL · cá nhân · 11/6, prereq M2)
  await createManualMission({
    tournamentId: tournament.id,
    orderIndex: 4,
    title: "M3 — Hoàn thành ≥5 phiếu peer review",
    description:
      "Mỗi sinh viên chấm chéo tối thiểu 5 video của 5 đội khác (không chấm đội mình). " +
      "Nhiệm vụ cá nhân — hoàn thành phần peer review của M2 là đạt M3.",
    instructions: [
      "## Peer review — hạn 23h59 Thứ Năm 11/6",
      "",
      "1. Sau khi vòng nộp M2 đóng, hệ thống tự phân video cho bạn chấm (ẩn danh đôi chiều).",
      "2. Với mỗi video: **đọc Idea Brief trước**, xem hết video (không tua), chấm 5 tiêu chí (1–5).",
      "3. Viết nhận xét **≥ 50 chữ** theo cấu trúc **2-1-1**: 2 điểm mạnh, 1 điểm cải thiện, 1 câu hỏi.",
      "4. Hoàn thành **≥ 5 phiếu**. Bấm *Submit* — không sửa được sau khi nộp.",
      "",
      "Sau khi đủ 5 phiếu hợp lệ, giảng viên xác nhận **PASS** cho M3.",
      "⚠️ Nhận xét sơ sài/thiên vị bị loại khỏi tính điểm.",
    ].join("\n"),
    points: 300,
    deadline: D("2026-06-11T23:59:00+07:00"),
    isTeamSubmission: false,
    prerequisiteId: m2.id,
  });
  console.log("  ↳ M3 created (MANUAL · cá nhân, prereq M2)");

  // M4 — Top 5: slide & pitch trực tiếp (MANUAL · team · 12/6, prereq M2)
  await createManualMission({
    tournamentId: tournament.id,
    orderIndex: 5,
    title: "M4 — Top 5: Slide & Pitch trực tiếp",
    description:
      "CHỈ Top 5 đội: nộp slide/demo cho buổi pitch trực tiếp chiều 12/6. " +
      "Hội đồng (giảng viên + khách mời) chấm pitch live — điểm cộng tối đa 1.5 vào điểm môn.",
    instructions: [
      "## Pitch trực tiếp — slide nộp trước 12h00 trưa Thứ Sáu 12/6",
      "",
      "Dành cho **Top 5 đội** sau vòng peer review:",
      "1. Nộp **slide/demo** (PDF hoặc link) trước 12h00 trưa 12/6.",
      "2. Buổi chiều pitch **5 phút + 3 phút Q&A** trước hội đồng và cả lớp.",
      "",
      "**Rubric chấm pitch trực tiếp (thang 10):**",
      "| Tiêu chí | Trọng số |",
      "|---|---|",
      "| Khả năng thuyết phục trực tiếp | 30% |",
      "| Độ chín của ý tưởng (cải tiến so với video) | 25% |",
      "| Trả lời Q&A | 25% |",
      "| Tinh thần đồng đội khi pitch | 10% |",
      "| Sáng tạo trong cách trình bày | 10% |",
      "",
      "Mỗi sinh viên còn được bình chọn 1 phiếu **Best Pitch** cho đội yêu thích.",
    ].join("\n"),
    points: 500,
    deadline: D("2026-06-12T12:00:00+07:00"),
    isTeamSubmission: true,
    prerequisiteId: m2.id,
  });
  console.log("  ↳ M4 created (MANUAL · team, prereq M2)");

  // Done
  console.log("\n✅  Seed complete!\n");
  console.log("  Instructor:   " + INSTRUCTOR_EMAIL + " / " + PASSWORD);
  console.log("  Tournament:   /instructor/tournaments/" + tournament.id);
  console.log("  Team size:    7  ·  Prize: 5000 XP (50/30/20)");
  console.log("  Window:       29/5/2026 → 12/6/2026 (VN time)");
  console.log("\n  Bước tiếp theo: mở trang tournament → Validate → Publish để mở đăng ký.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
