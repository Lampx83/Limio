/**
 * GET /api/tournaments/:id/validate
 *
 * Pre-publish validation for a tournament. Returns a structured list of
 * errors (blocking) and warnings (non-blocking) so the instructor UI can
 * surface actionable feedback before allowing publish.
 *
 * Validation checklist:
 *   E01 — Tournament has at least 1 mission
 *   E02 — conditionType is a known value (not an arbitrary string)
 *   E03 — skill_mastered_in_group missions have conditionSkillCode set
 *   E04 — conditionSkillCode points to ≥1 skill tagged in the course
 *   E05 — conditionValue ≤ total available content in the course
 *   E06 — No circular prerequisite chain
 *   E07 — prizeDistribution percentages sum ≤ 100
 *   W01 — prizeDistribution sum < 100 (unclaimed XP)
 *   W02 — conditionValue > 80% of available content (high bar warning)
 *   W03 — streak_days used without courseId (cannot be verified platform-wide)
 *
 * Auth: creator or admin only.
 */
import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { isAdmin } from "@feedbackme/core-lms";
import { ConditionType } from "@feedbackme/core-gamification";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ValidationIssue {
  code: string;
  missionId?: string;
  missionTitle?: string;
  message: string;
}

interface ValidateResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

// All known conditionType values — unknown strings are flagged as E02.
const KNOWN_CONDITION_TYPES = new Set(Object.values(ConditionType));

/**
 * Detect a cycle in the prerequisite chain using DFS.
 * Returns the missionId that starts a cycle, or null if none.
 */
function detectCycle(missions: { id: string; prerequisiteId: string | null }[]): string | null {
  const prereqMap = new Map(missions.map((m) => [m.id, m.prerequisiteId]));
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(id: string): boolean {
    if (inStack.has(id)) return true; // cycle detected
    if (visited.has(id)) return false;
    visited.add(id);
    inStack.add(id);
    const prereq = prereqMap.get(id);
    if (prereq && dfs(prereq)) return true;
    inStack.delete(id);
    return false;
  }

  for (const m of missions) {
    if (dfs(m.id)) return m.id;
  }
  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tournament = await prisma.tournament.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      creatorId: true,
      courseId: true,
      prizeXp: true,
      prizeDistribution: true,
      missions: {
        select: {
          id: true,
          title: true,
          conditionType: true,
          conditionValue: true,
          conditionScope: true,
          conditionSkillCode: true,
          conditionMinScore: true,
          prerequisiteId: true,
        },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!tournament) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const admin = await isAdmin(userId);
  if (!admin && tournament.creatorId !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const { missions, courseId } = tournament;

  // ── E01: must have at least 1 mission ─────────────────────────────────
  if (missions.length === 0) {
    errors.push({
      code: "E01",
      message: "Đấu trường phải có ít nhất 1 nhiệm vụ trước khi publish.",
    });
  }

  // ── E06: circular prerequisite chain ──────────────────────────────────
  const cycleId = detectCycle(missions);
  if (cycleId) {
    const m = missions.find((x) => x.id === cycleId);
    errors.push({
      code: "E06",
      missionId: cycleId,
      missionTitle: m?.title,
      message: `Nhiệm vụ "${m?.title ?? cycleId}" tạo vòng lặp prerequisite (A → B → A). Vui lòng kiểm tra lại chuỗi điều kiện.`,
    });
  }

  // ── E07 / W01: prizeDistribution sum ──────────────────────────────────
  if (tournament.prizeXp > 0 && tournament.prizeDistribution) {
    const dist = tournament.prizeDistribution as Record<string, number>;
    const sum = Object.values(dist).reduce((acc, v) => acc + (typeof v === "number" ? v : 0), 0);
    if (sum > 100) {
      errors.push({
        code: "E07",
        message: `Tổng phần trăm giải thưởng là ${sum}% — vượt quá 100%. Vui lòng điều chỉnh lại prizeDistribution.`,
      });
    } else if (sum < 100) {
      warnings.push({
        code: "W01",
        message: `Tổng phần trăm giải thưởng chỉ đạt ${sum}% — ${100 - sum}% XP (${Math.floor((tournament.prizeXp * (100 - sum)) / 100)} XP) sẽ không được trao.`,
      });
    }
  }

  // ── Per-mission checks ─────────────────────────────────────────────────
  // Pre-fetch lesson IDs for this course (ContentSkillMapping is polymorphic —
  // no direct `lesson` FK; must filter via contentId).
  let courseLessonIds: string[] = [];
  if (courseId) {
    const lessons = await prisma.lesson.findMany({
      where: { module: { courseId } },
      select: { id: true },
    });
    courseLessonIds = lessons.map((l) => l.id);
  }

  // Preload skill counts if we have skill-group missions to validate.
  const skillGroupMissions = missions.filter(
    (m) => m.conditionType === ConditionType.SkillMasteredInGroup && m.conditionSkillCode,
  );

  // Map prefix → count of skills in this course with that prefix.
  const skillGroupCounts = new Map<string, number>();
  if (skillGroupMissions.length > 0 && courseId) {
    for (const m of skillGroupMissions) {
      const prefix = m.conditionSkillCode!;
      if (skillGroupCounts.has(prefix)) continue;

      const count = await prisma.skill.count({
        where: {
          code: { startsWith: prefix },
          OR: [
            { contentMappings: { some: { contentType: "lesson", contentId: { in: courseLessonIds } } } },
            { questionTags: { some: { question: { quiz: { courseId } } } } },
          ],
        },
      });
      skillGroupCounts.set(prefix, count);
    }
  }

  // Preload content counts for E05 (conditionValue vs available content).
  // We cache per (conditionType, scope) to avoid duplicate queries.
  const contentCountCache = new Map<string, number>();

  async function getContentCount(conditionType: string, scope: string | null): Promise<number> {
    const cacheKey = `${conditionType}:${scope}`;
    if (contentCountCache.has(cacheKey)) return contentCountCache.get(cacheKey)!;

    const scoped = scope !== "global" && courseId ? courseId : null;
    let count = 0;

    switch (conditionType) {
      case ConditionType.LessonCompletedCount:
        // Lesson has no `courseId` field — must go through module.courseId.
        count = await prisma.lesson.count({
          where: scoped ? { module: { courseId: scoped } } : {},
        });
        break;
      case ConditionType.QuizPassedCount:
      case ConditionType.QuizPassedMinScore:
      case ConditionType.QuizFirstPass:
      case ConditionType.QuizPassedPerfect:
        count = await prisma.quiz.count({
          where: { ...(scoped ? { courseId: scoped } : {}) },
        });
        break;
      case ConditionType.H5pCompletedCount:
        // H5pPackage has no `lesson` relation — use ContentItem with type "h5p".
        count = await prisma.contentItem.count({
          where: {
            type: "h5p",
            ...(scoped ? { lesson: { module: { courseId: scoped } } } : {}),
          },
        });
        break;
      case ConditionType.SkillMasteredCount:
        // ContentSkillMapping is polymorphic — filter via pre-fetched lessonIds.
        count = scoped
          ? await prisma.skill.count({
              where: {
                OR: [
                  { contentMappings: { some: { contentType: "lesson", contentId: { in: courseLessonIds } } } },
                  { questionTags: { some: { question: { quiz: { courseId: scoped } } } } },
                ],
              },
            })
          : await prisma.skill.count();
        break;
      case ConditionType.MisconceptionResolvedCount:
        count = await prisma.misconception.count();
        break;
      default:
        count = Infinity; // streak, assignment — hard to bound; skip E05
    }

    contentCountCache.set(cacheKey, count);
    return count;
  }

  for (const m of missions) {
    const label = `"${m.title}"`;

    // E02: unknown conditionType
    if (m.conditionType && !KNOWN_CONDITION_TYPES.has(m.conditionType as never)) {
      errors.push({
        code: "E02",
        missionId: m.id,
        missionTitle: m.title,
        message: `${label}: conditionType "${m.conditionType}" không hợp lệ.`,
      });
      continue; // skip further checks for this mission
    }

    // E03: skill_mastered_in_group without conditionSkillCode
    if (m.conditionType === ConditionType.SkillMasteredInGroup && !m.conditionSkillCode) {
      errors.push({
        code: "E03",
        missionId: m.id,
        missionTitle: m.title,
        message: `${label}: loại điều kiện "Master skill trong nhóm" cần chọn nhóm skill (conditionSkillCode chưa được điền).`,
      });
      continue;
    }

    // E04: skill group exists in course content
    if (m.conditionType === ConditionType.SkillMasteredInGroup && m.conditionSkillCode) {
      const count = skillGroupCounts.get(m.conditionSkillCode) ?? 0;
      if (count === 0) {
        errors.push({
          code: "E04",
          missionId: m.id,
          missionTitle: m.title,
          message:
            `${label}: nhóm skill "${m.conditionSkillCode}" không có skill nào được tag vào nội dung khoá học này. ` +
            `Hãy tag lesson/quiz/câu hỏi với các skill thuộc nhóm này trước khi publish.`,
        });
      } else if (m.conditionValue && m.conditionValue > count) {
        // E05 variant for skill group
        errors.push({
          code: "E05",
          missionId: m.id,
          missionTitle: m.title,
          message:
            `${label}: yêu cầu master ${m.conditionValue} skill nhưng nhóm "${m.conditionSkillCode}" ` +
            `chỉ có ${count} skill trong khoá học. Giảm conditionValue xuống ≤ ${count}.`,
        });
      } else if (m.conditionValue && m.conditionValue > Math.floor(count * 0.8)) {
        warnings.push({
          code: "W02",
          missionId: m.id,
          missionTitle: m.title,
          message:
            `${label}: yêu cầu master ${m.conditionValue}/${count} skill trong nhóm (${Math.round((m.conditionValue / count) * 100)}%) — ` +
            `ngưỡng cao, học viên có thể gặp khó khăn.`,
        });
      }
    }

    // E05: conditionValue vs total available content (for non-skill-group types)
    if (
      m.conditionType &&
      m.conditionType !== ConditionType.SkillMasteredInGroup &&
      m.conditionValue !== null
    ) {
      const available = await getContentCount(m.conditionType, m.conditionScope);
      if (available !== Infinity && m.conditionValue > available) {
        errors.push({
          code: "E05",
          missionId: m.id,
          missionTitle: m.title,
          message:
            `${label}: yêu cầu ${m.conditionValue} nhưng khoá học chỉ có ${available} nội dung phù hợp. ` +
            `Không thể hoàn thành nhiệm vụ này.`,
        });
      } else if (available !== Infinity && m.conditionValue > Math.floor(available * 0.8)) {
        warnings.push({
          code: "W02",
          missionId: m.id,
          missionTitle: m.title,
          message:
            `${label}: yêu cầu ${m.conditionValue}/${available} nội dung (${Math.round((m.conditionValue / available) * 100)}%) — ngưỡng cao.`,
        });
      }
    }

    // W03: streak_days without courseId
    if (m.conditionType === ConditionType.StreakDays && !courseId) {
      warnings.push({
        code: "W03",
        missionId: m.id,
        missionTitle: m.title,
        message: `${label}: "Học liên tục N ngày" yêu cầu đấu trường gắn với một khoá học cụ thể. Đấu trường này là platform-wide — điều kiện streak sẽ không thể tự động kiểm tra.`,
      });
    }
  }

  const result: ValidateResult = {
    valid: errors.length === 0,
    errors,
    warnings,
  };

  return NextResponse.json(result);
}
