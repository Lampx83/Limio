/**
 * Seed C5 — MissionTemplate catalog. Idempotent (upsert on stable code).
 *
 * These 11 templates are domain-agnostic building blocks. Instructors pick one
 * when authoring tournament missions; the template encodes conditionType and
 * UI hints (hasMinScore, requiresSkillGroup) so instructors never type raw
 * conditionType strings.
 *
 * Run: pnpm --filter @feedbackme/db exec ts-node src/seed-mission-templates.ts
 */
import { PrismaClient } from "./generated/client";

const prisma = new PrismaClient();

const TEMPLATES = [
  // ── Volume / activity ──────────────────────────────────────────────────
  {
    code: "tmpl.lesson.count",
    name: "Hoàn thành bài học",
    emoji: "📖",
    description:
      "Học viên phải hoàn thành ít nhất N bài học trong khoá học. " +
      "Phù hợp làm nhiệm vụ khởi động hoặc kích thích tiến độ học tập.",
    conditionType: "lesson_completed_count",
    defaultValue: 3,
    hasMinScore: false,
    requiresSkillGroup: false,
  },
  {
    code: "tmpl.h5p.count",
    name: "Hoàn thành nội dung H5P",
    emoji: "🎮",
    description:
      "Học viên phải hoàn thành ít nhất N nội dung tương tác H5P. " +
      "Dùng cho khoá học có bài tập đa phương tiện (kéo thả, flashcard, video quiz…).",
    conditionType: "h5p_completed_count",
    defaultValue: 3,
    hasMinScore: false,
    requiresSkillGroup: false,
  },

  // ── Quiz — basic pass ───────────────────────────────────────────────────
  {
    code: "tmpl.quiz.pass",
    name: "Vượt quiz",
    emoji: "✅",
    description:
      "Học viên phải vượt qua ít nhất N quiz (đạt ngưỡng pass mặc định của quiz). " +
      "Phù hợp cho mọi domain, điểm số không quan trọng, chỉ cần pass.",
    conditionType: "quiz_passed_count",
    defaultValue: 3,
    hasMinScore: false,
    requiresSkillGroup: false,
  },
  {
    code: "tmpl.quiz.minscore",
    name: "Vượt quiz điểm tối thiểu",
    emoji: "🎯",
    description:
      "Học viên phải vượt N quiz với điểm ≥ X%. Dùng khi domain yêu cầu độ chính xác cao " +
      "(ngôn ngữ kỹ thuật, an toàn lao động, y tế…). " +
      "Bạn tự chọn ngưỡng điểm phù hợp với độ khó môn học.",
    conditionType: "quiz_passed_min_score",
    defaultValue: 3,
    defaultMinScore: 85,
    hasMinScore: true,
    requiresSkillGroup: false,
  },
  {
    code: "tmpl.quiz.firstpass",
    name: "Pass quiz ngay lần đầu",
    emoji: "⚡",
    description:
      "Học viên phải pass ít nhất N quiz ngay trong lần thử đầu tiên. " +
      "Đo lường sự chuẩn bị kỹ trước khi thi, không phải ôn luyện nhiều lần.",
    conditionType: "quiz_first_pass",
    defaultValue: 3,
    hasMinScore: false,
    requiresSkillGroup: false,
  },
  {
    code: "tmpl.quiz.perfect",
    name: "Đạt điểm tuyệt đối",
    emoji: "💯",
    description:
      "Học viên phải đạt 100% trong ít nhất N quiz. Thách thức cao nhất — " +
      "phù hợp làm nhiệm vụ cuối chuỗi hoặc giải thưởng đặc biệt.",
    conditionType: "quiz_passed_perfect",
    defaultValue: 1,
    hasMinScore: false,
    requiresSkillGroup: false,
  },

  // ── Streak ─────────────────────────────────────────────────────────────
  {
    code: "tmpl.streak.days",
    name: "Học liên tục N ngày",
    emoji: "🔥",
    description:
      "Học viên phải duy trì streak ít nhất N ngày liên tiếp trong khoá học. " +
      "Khuyến khích thói quen học đều đặn, đặc biệt hiệu quả với ngôn ngữ.",
    conditionType: "streak_days",
    defaultValue: 5,
    hasMinScore: false,
    requiresSkillGroup: false,
  },

  // ── Feedback Engine ─────────────────────────────────────────────────────
  {
    code: "tmpl.misconception.fix",
    name: "Sửa lỗi tư duy",
    emoji: "🪄",
    description:
      "Học viên phải tự sửa ít nhất N lỗi tư duy (misconception) — trả lời đúng sau khi " +
      "đã từng trả lời sai cùng loại lỗi. Đo lường khả năng học từ sai lầm.",
    conditionType: "misconception_resolved_count",
    defaultValue: 3,
    hasMinScore: false,
    requiresSkillGroup: false,
  },

  // ── Skill mastery ───────────────────────────────────────────────────────
  {
    code: "tmpl.skill.any",
    name: "Master skill bất kỳ",
    emoji: "🏅",
    description:
      "Học viên phải đạt mastery (xác suất BKT ≥ 90%) trên ít nhất N skill bất kỳ trong khoá. " +
      "Dùng khi không cần chỉ định nhóm skill cụ thể.",
    conditionType: "skill_mastered_count",
    defaultValue: 3,
    hasMinScore: false,
    requiresSkillGroup: false,
  },
  {
    code: "tmpl.skill.group",
    name: "Master skill trong nhóm",
    emoji: "🏆",
    description:
      "Học viên phải đạt mastery trên ít nhất N skill thuộc một nhóm chủ đề cụ thể " +
      "(ví dụ: Từ vựng cơ bản, Đọc bản vẽ kỹ thuật…). " +
      "Bạn chọn nhóm từ danh sách skill đã được tag trong khoá học này.",
    conditionType: "skill_mastered_in_group",
    defaultValue: 3,
    hasMinScore: false,
    requiresSkillGroup: true,
  },

  // ── Writing / assignment ────────────────────────────────────────────────
  {
    code: "tmpl.assignment.graded",
    name: "Nộp bài được chấm đạt điểm",
    emoji: "📝",
    description:
      "Học viên phải nộp ít nhất N bài tập và được giảng viên chấm đạt điểm ≥ X%. " +
      "Dùng cho kỹ năng viết, dịch thuật, báo cáo kỹ thuật — những kỹ năng cần đánh giá tay.",
    conditionType: "assignment_graded_min_score",
    defaultValue: 1,
    defaultMinScore: 70,
    hasMinScore: true,
    requiresSkillGroup: false,
  },
] as const;

export async function seedMissionTemplates(
  client: PrismaClient = prisma,
): Promise<{ upserted: number }> {
  let upserted = 0;
  for (const t of TEMPLATES) {
    await client.missionTemplate.upsert({
      where: { code: t.code },
      update: {
        name: t.name,
        emoji: t.emoji,
        description: t.description,
        conditionType: t.conditionType,
        defaultValue: t.defaultValue,
        defaultMinScore: "defaultMinScore" in t ? (t.defaultMinScore ?? null) : null,
        hasMinScore: t.hasMinScore,
        requiresSkillGroup: t.requiresSkillGroup,
      },
      create: {
        code: t.code,
        name: t.name,
        emoji: t.emoji ?? null,
        description: t.description,
        conditionType: t.conditionType,
        defaultValue: t.defaultValue,
        defaultMinScore: "defaultMinScore" in t ? (t.defaultMinScore ?? null) : null,
        hasMinScore: t.hasMinScore,
        requiresSkillGroup: t.requiresSkillGroup,
      },
    });
    upserted++;
  }
  console.log(`✅ Seeded ${upserted} mission templates.`);
  return { upserted };
}

// Allow running as a standalone script: `pnpm exec tsx src/seed-mission-templates.ts`
// ESM has no `require`/`module` — compare against the entry-point URL instead.
// (`require.main === module` silently threw here, breaking `pnpm db:seed`
// wholesale since seed.ts imports this module.)
import { pathToFileURL } from "node:url";
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  seedMissionTemplates()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
