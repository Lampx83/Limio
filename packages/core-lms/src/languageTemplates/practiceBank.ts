import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { LANGUAGE_SKILL_LABEL } from "@feedbackme/shared-types";
import { isInstructor } from "../auth/roles";
import { createCourse } from "../courses/courses";
import { assertCanEditCourse } from "../courses/authz";
import { createExam, updateExam, createSection } from "../exam";
import { LanguageTemplateError } from "./errors";

/**
 * LANG L6.9 — khoá luyện đề theo kỹ năng. Dựng sẵn khoá `practice_bank` (HSK / IELTS / TOEIC × kỹ năng) kèm các
 * bộ/Part mẫu để giảng viên thêm đề vào; cấu trúc Part là GỢI Ý phổ biến và sửa được (đổi tên/thêm/xoá bộ).
 * Đề của khoá là đề thi thử MỘT phần một kỹ năng (`createPracticeExam`): học viên chọn Luyện đề hoặc Phòng thi mô phỏng.
 */

export type PracticeFamilyId = "hsk" | "ielts" | "toeic";
export type PracticeSkill = "listening" | "reading" | "writing" | "speaking";

interface FamilyDef {
  label: string;
  language: "zh" | "en";
  skills: PracticeSkill[];
  /** HSK có cấp độ 1–6; họ khác không có. */
  levels?: string[];
  parts: Partial<Record<PracticeSkill, string[]>>;
  /** Số phút gợi ý cho một đề một kỹ năng. */
  minutes: Partial<Record<PracticeSkill, number>>;
}

export const PRACTICE_FAMILIES: Record<PracticeFamilyId, FamilyDef> = {
  hsk: {
    label: "HSK",
    language: "zh",
    levels: ["1", "2", "3", "4", "5", "6"],
    skills: ["listening", "reading", "writing"],
    parts: {
      listening: ["Phần 1", "Phần 2", "Phần 3"],
      reading: ["Phần 1", "Phần 2", "Phần 3"],
      writing: ["Phần 1", "Phần 2"],
    },
    minutes: { listening: 35, reading: 40, writing: 25 },
  },
  ielts: {
    label: "IELTS",
    language: "en",
    skills: ["listening", "reading", "writing", "speaking"],
    parts: {
      listening: ["Section 1", "Section 2", "Section 3", "Section 4"],
      reading: ["Passage 1", "Passage 2", "Passage 3"],
      writing: ["Task 1", "Task 2"],
      speaking: ["Part 1", "Part 2", "Part 3"],
    },
    minutes: { listening: 30, reading: 60, writing: 60, speaking: 15 },
  },
  toeic: {
    label: "TOEIC",
    language: "en",
    skills: ["listening", "reading"],
    parts: {
      listening: ["Part 1", "Part 2", "Part 3", "Part 4"],
      reading: ["Part 5", "Part 6", "Part 7"],
    },
    minutes: { listening: 45, reading: 75 },
  },
};

const PracticeBankInput = z
  .object({
    family: z.enum(["hsk", "ielts", "toeic"]),
    skill: z.enum(["listening", "reading", "writing", "speaking"]),
    level: z.string().trim().max(10).optional(),
  })
  .superRefine((d, ctx) => {
    const fam = PRACTICE_FAMILIES[d.family];
    if (!fam.skills.includes(d.skill)) ctx.addIssue({ code: "custom", path: ["skill"], message: "family_skill_unsupported" });
    if (fam.levels && (!d.level || !fam.levels.includes(d.level))) ctx.addIssue({ code: "custom", path: ["level"], message: "level_required" });
  });
export type PracticeBankInput = z.input<typeof PracticeBankInput>;

export async function createPracticeBankCourse(
  actorUserId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ courseId: string; slug: string; collections: number }> {
  const parsed = PracticeBankInput.safeParse(rawInput);
  if (!parsed.success) throw new LanguageTemplateError("validation_failed", parsed.error.flatten());
  if (!(await isInstructor(actorUserId, db))) throw new LanguageTemplateError("forbidden");
  const { family, skill, level } = parsed.data;
  const fam = PRACTICE_FAMILIES[family];
  const skillLabel = LANGUAGE_SKILL_LABEL[skill];
  const name = `${fam.label}${level ? ` ${level}` : ""}`;
  const hskLevel = level ? Number(level) : null;

  const { courseId, slug } = await createCourse(
    actorUserId,
    {
      title: `${name} — ${skillLabel}`,
      description:
        `<p>Khoá luyện đề kỹ năng <b>${skillLabel}</b> của ${name}: thư viện đề chia theo ${fam.parts[skill]?.[0]?.replace(/ \d.*$/, "") ?? "phần"}. ` +
        `Mỗi đề làm được theo hai chế độ: <b>Luyện đề</b> (không giới hạn thời gian, quay lại sửa, xem đáp án ngay) và ` +
        `<b>Phòng thi mô phỏng</b> (bấm giờ, không tạm dừng, như thi thật).</p>`,
      language: fam.language,
      level: hskLevel === null ? "intermediate" : hskLevel <= 2 ? "beginner" : hskLevel <= 4 ? "intermediate" : "advanced",
      category: "Luyện đề",
      personalizationEnabled: true,
      languageMode: true,
      kind: "practice_bank",
    },
    db,
  );
  const parts = fam.parts[skill] ?? [];
  await db.examCollection.createMany({ data: parts.map((title, i) => ({ courseId, title, orderIndex: i })) });
  return { courseId, slug, collections: parts.length };
}

// ─── Đề một phần một kỹ năng ──────────────────────────────────────────────────

const PracticeExamInput = z.object({
  title: z.string().trim().min(1).max(200),
  skill: z.enum(["listening", "reading", "writing", "speaking"]),
  minutes: z.number().int().min(1).max(240).optional(),
  collectionId: z.string().uuid().nullable().optional(),
  seq: z.number().int().min(0).max(100_000).nullable().optional(),
  paperType: z.enum(["official", "mock", "practice_set"]).nullable().optional(),
  sourceLabel: z.string().trim().max(120).nullable().optional(),
  yearLabel: z.string().trim().max(40).nullable().optional(),
  difficulty: z.number().int().min(1).max(5).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  freePreview: z.boolean().optional(),
});
export type PracticeExamInput = z.input<typeof PracticeExamInput>;

const DEFAULT_MINUTES: Record<PracticeSkill, number> = { listening: 30, reading: 45, writing: 45, speaking: 15 };

export async function createPracticeExam(
  actorUserId: string,
  courseId: string,
  rawInput: PracticeExamInput,
  db: PrismaClient = prisma,
): Promise<{ examId: string }> {
  await assertCanEditCourse(actorUserId, courseId, db);
  const parsed = PracticeExamInput.safeParse(rawInput);
  if (!parsed.success) throw new LanguageTemplateError("validation_failed", parsed.error.flatten());
  const d = parsed.data;
  const minutes = d.minutes ?? DEFAULT_MINUTES[d.skill];
  const { examId } = await createExam(actorUserId, courseId, { title: d.title, durationMin: minutes, mockMode: true }, db);
  await createSection(actorUserId, examId, { title: LANGUAGE_SKILL_LABEL[d.skill], durationMin: minutes, languageSkill: d.skill }, db);
  const meta = {
    ...(d.collectionId !== undefined ? { collectionId: d.collectionId } : {}),
    ...(d.seq !== undefined ? { seq: d.seq } : {}),
    ...(d.paperType !== undefined ? { paperType: d.paperType } : {}),
    ...(d.sourceLabel !== undefined ? { sourceLabel: d.sourceLabel } : {}),
    ...(d.yearLabel !== undefined ? { yearLabel: d.yearLabel } : {}),
    ...(d.difficulty !== undefined ? { difficulty: d.difficulty } : {}),
    ...(d.tags !== undefined ? { tags: d.tags } : {}),
    ...(d.freePreview !== undefined ? { freePreview: d.freePreview } : {}),
  };
  if (Object.keys(meta).length) await updateExam(actorUserId, examId, meta, db);
  return { examId };
}
