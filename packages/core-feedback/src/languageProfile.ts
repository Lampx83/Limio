/**
 * LANG G3 — hồ sơ 4 kỹ năng ngôn ngữ (nghe/nói/đọc/viết) của một học viên trong
 * một khoá.
 *
 * Chỉ ĐỌC: gộp `LearnerSkillState` (BKT đã cập nhật sẵn) theo `Skill.languageSkill`,
 * rồi dịch sang nhãn Cần ôn / Nên luyện thêm / Vững bằng đúng `masteryLabel` mà lộ
 * trình cá nhân hoá dùng. Không ghi gì, không thêm bảng.
 *
 * Riêng tư: học viên không bao giờ nhận số mastery (BKT là ước lượng xác suất; con
 * số "47%" đọc như điểm thi). Hình dạng phản hồi cho học viên KHÔNG có các trường đó
 * chứ không chỉ là bị giấu ở giao diện. Giảng viên nhận thêm mastery và bằng chứng.
 *
 * Quyền xem hồ sơ người khác do tầng gọi kiểm (apps/web), vì core-feedback không
 * được import core-lms (§4.3); hàm này nhận `audience` đã được quyết định.
 */

import { prisma, type PrismaClient } from "@feedbackme/db";
import {
  LANGUAGE_SKILLS,
  LearningEventType,
  masteryLabel,
  type LanguageSkill,
  type MasteryLabel,
} from "@feedbackme/shared-types";
import { resolveFeedbackVariant } from "./variant";

/** Dưới ngưỡng này, mastery còn quá nhiễu để gán nhãn → "Chưa đủ dữ liệu". */
export const LANGUAGE_PROFILE_MIN_EVIDENCE = 5;

export type ProfileAudience = "learner" | "instructor";

export type LanguageProfileReason =
  | "course_not_found"
  | "personalization_off"
  | "language_mode_off"
  | "not_enrolled"
  | "control_variant";

export interface LanguageSkillRow {
  skill: LanguageSkill;
  label: MasteryLabel;
  /** Số bài (học viên thấy được) thuộc kỹ năng này. */
  lessonsTotal: number;
  /** Số bài trong đó đã có ít nhất một lượt trả lời. */
  lessonsPracticed: number;
  /** CHỈ audience "instructor": trung bình mastery; null = chưa có lượt trả lời nào. */
  mastery?: number | null;
  /** CHỈ audience "instructor": tổng số lượt trả lời. */
  evidence?: number;
}

export type LanguageSuggestionReason = "review" | "practice" | "start";

export interface LanguageSuggestion {
  skill: LanguageSkill;
  lessonId: string;
  lessonTitle: string;
  reason: LanguageSuggestionReason;
}

export interface LanguageProfile {
  enabled: boolean;
  reason?: LanguageProfileReason;
  /** Luôn đủ 4 kỹ năng theo thứ tự Nghe, Nói, Đọc, Viết khi `enabled`. */
  skills: LanguageSkillRow[];
  suggestion: LanguageSuggestion | null;
}

const disabled = (reason: LanguageProfileReason): LanguageProfile => ({
  enabled: false,
  reason,
  skills: [],
  suggestion: null,
});

interface LessonInfo {
  id: string;
  title: string;
  locked: boolean;
  skill: LanguageSkill | null;
  /** Skill (có languageSkill) gắn vào bài này. */
  skillIds: string[];
}

export async function getLanguageProfile(
  userId: string,
  courseId: string,
  audience: ProfileAudience,
  db: PrismaClient = prisma,
): Promise<LanguageProfile> {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { personalizationEnabled: true, languageMode: true },
  });
  if (!course) return disabled("course_not_found");
  // Hàm đọc tự bảo vệ kể cả khi dữ liệu cũ lệch (languageMode bật mà cá nhân hoá tắt).
  if (!course.personalizationEnabled) return disabled("personalization_off");
  if (!course.languageMode) return disabled("language_mode_off");

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true },
  });
  if (!enrollment) return disabled("not_enrolled");

  // B10 — lớp đối chứng không được thấy kênh cá nhân hoá này. Giảng viên vẫn xem để quản lớp.
  if (audience === "learner") {
    const { variant } = await resolveFeedbackVariant(userId, courseId, db);
    if (variant === "minimal") return disabled("control_variant");
  }

  // Cùng bộ lọc với lộ trình cá nhân hoá: chỉ thứ học viên thấy được.
  const modules = await db.module.findMany({
    where: { courseId, isHidden: false },
    orderBy: { orderIndex: "asc" },
    select: {
      isLocked: true,
      lessons: {
        where: { isHidden: false },
        orderBy: { orderIndex: "asc" },
        select: { id: true, title: true, isLocked: true },
      },
    },
  });
  const lessonRows = modules.flatMap((m) =>
    m.lessons.map((l) => ({ id: l.id, title: l.title, locked: m.isLocked || l.isLocked })),
  );
  const lessonIds = lessonRows.map((l) => l.id);

  const mappings = await db.contentSkillMapping.findMany({
    where: { contentType: "lesson", contentId: { in: lessonIds } },
    select: { contentId: true, skillId: true },
  });
  const skills = await db.skill.findMany({
    where: { id: { in: [...new Set(mappings.map((m) => m.skillId))] }, languageSkill: { not: null } },
    select: { id: true, languageSkill: true },
  });
  const skillLang = new Map(skills.map((s) => [s.id, s.languageSkill as LanguageSkill]));

  const lessons: LessonInfo[] = lessonRows.map((l) => {
    const own = mappings.filter((m) => m.contentId === l.id && skillLang.has(m.skillId));
    return {
      ...l,
      skill: own.length ? skillLang.get(own[0]!.skillId)! : null,
      skillIds: own.map((m) => m.skillId),
    };
  });

  const states = await db.learnerSkillState.findMany({
    where: { userId, skillId: { in: [...skillLang.keys()] } },
    select: { skillId: true, masteryProbability: true, attempts: true },
  });
  const stateBySkill = new Map(states.filter((s) => s.attempts > 0).map((s) => [s.skillId, s]));

  interface Agg {
    row: LanguageSkillRow;
    mastery: number | null;
    evidence: number;
  }
  const aggs: Agg[] = LANGUAGE_SKILLS.map((skill) => {
    const inSkill = lessons.filter((l) => l.skill === skill);
    const skillIds = new Set(inSkill.flatMap((l) => l.skillIds.filter((id) => skillLang.get(id) === skill)));
    const used = [...skillIds].map((id) => stateBySkill.get(id)).filter((s): s is NonNullable<typeof s> => !!s);
    const evidence = used.reduce((n, s) => n + s.attempts, 0);
    const mastery = used.length ? used.reduce((n, s) => n + s.masteryProbability, 0) / used.length : null;
    const label: MasteryLabel =
      mastery !== null && evidence >= LANGUAGE_PROFILE_MIN_EVIDENCE ? masteryLabel(mastery) : "no_data";
    const base: LanguageSkillRow = {
      skill,
      label,
      lessonsTotal: inSkill.length,
      lessonsPracticed: inSkill.filter((l) => l.skillIds.some((id) => stateBySkill.has(id))).length,
    };
    return { row: base, mastery, evidence };
  });

  const suggestion = await suggest(userId, courseId, lessons, aggs, stateBySkill, db);

  const rows: LanguageSkillRow[] = aggs.map((a) =>
    audience === "instructor" ? { ...a.row, mastery: a.mastery, evidence: a.evidence } : a.row,
  );
  return { enabled: true, skills: rows, suggestion };
}

/**
 * "Luyện hôm nay": kỹ năng yếu nhất (Cần ôn trước, rồi Nên luyện; mastery thấp hơn
 * thắng; hoà thì theo thứ tự Nghe, Nói, Đọc, Viết) và bài đã làm điểm thấp nhất của
 * nó. Không kỹ năng nào yếu thì mời bắt đầu kỹ năng chưa có dữ liệu bằng bài đầu
 * chưa học, không khoá. Chỉ gợi ý — không chặn bài nào.
 */
async function suggest(
  userId: string,
  courseId: string,
  lessons: LessonInfo[],
  aggs: Array<{ row: LanguageSkillRow; mastery: number | null }>,
  stateBySkill: Map<string, { masteryProbability: number }>,
  db: PrismaClient,
): Promise<LanguageSuggestion | null> {
  const rank = (l: MasteryLabel) => (l === "needs_review" ? 0 : 1);
  const weak = aggs
    .map((a, order) => ({ ...a, order }))
    .filter((a) => a.row.label === "needs_review" || a.row.label === "practice_more")
    .sort(
      (x, y) =>
        rank(x.row.label) - rank(y.row.label) || (x.mastery ?? 1) - (y.mastery ?? 1) || x.order - y.order,
    )[0];

  if (weak) {
    const attempted = lessons
      .filter((l) => l.skill === weak.row.skill)
      .map((l, idx) => {
        const ms = l.skillIds.map((id) => stateBySkill.get(id)?.masteryProbability).filter((m): m is number => m !== undefined);
        return { l, idx, m: ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : null };
      })
      .filter((x): x is { l: LessonInfo; idx: number; m: number } => x.m !== null)
      .sort((a, b) => a.m - b.m || a.idx - b.idx)[0];
    if (!attempted) return null;
    return {
      skill: weak.row.skill,
      lessonId: attempted.l.id,
      lessonTitle: attempted.l.title,
      reason: weak.row.label === "needs_review" ? "review" : "practice",
    };
  }

  const noData = aggs.filter((a) => a.row.label === "no_data" && a.row.lessonsTotal > 0);
  if (noData.length === 0) return null;

  const completedRows = await db.learningEvent.findMany({
    where: { userId, courseId, eventType: LearningEventType.LessonCompleted },
    select: { payload: true },
  });
  const completed = new Set(
    completedRows
      .map((e) => (e.payload as { lessonId?: unknown } | null)?.lessonId)
      .filter((id): id is string => typeof id === "string"),
  );
  for (const a of noData) {
    const next = lessons.find((l) => l.skill === a.row.skill && !l.locked && !completed.has(l.id));
    if (next) return { skill: a.row.skill, lessonId: next.id, lessonTitle: next.title, reason: "start" };
  }
  return null;
}
