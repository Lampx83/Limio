import { prisma, type PrismaClient } from "@feedbackme/db";
import { canEditCourse } from "./courses/authz";

export interface StudentWithScore {
  userId: string;
  userName: string;
  skillScore: number;
}

export interface GroupAssignment {
  groupNum: number;
  userIds: string[];
}

/**
 * Calculate skill score for each student in a course.
 * Score = average masteryProbability across all attempted skills.
 * Fallback to 0.5 if student has no skill attempts.
 */
export async function calculateStudentSkillScores(
  courseId: string
): Promise<StudentWithScore[]> {
  // Fetch all enrolled students
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId, status: "active" },
    select: {
      userId: true,
      user: { select: { displayName: true } },
    },
  });

  if (enrollments.length === 0) {
    return [];
  }

  const userIds = enrollments.map((e) => e.userId);

  // Fetch skill states for all students
  const skillStates = await prisma.learnerSkillState.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, masteryProbability: true },
  });

  // Group by userId and calculate average
  const skillScoreMap = new Map<string, number>();

  for (const userId of userIds) {
    const userSkills = skillStates.filter((s) => s.userId === userId);

    if (userSkills.length === 0) {
      skillScoreMap.set(userId, 0.5); // default neutral score
    } else {
      const avg =
        userSkills.reduce((sum, s) => sum + s.masteryProbability, 0) /
        userSkills.length;
      skillScoreMap.set(userId, avg);
    }
  }

  // Build result with scores, sorted descending
  const result: StudentWithScore[] = enrollments
    .map((e) => ({
      userId: e.userId,
      userName: e.user.displayName || "Unknown",
      skillScore: skillScoreMap.get(e.userId) || 0.5,
    }))
    .sort((a, b) => b.skillScore - a.skillScore);

  return result;
}

/**
 * Distribute students into groups using round-robin algorithm.
 * This ensures each group has a balanced mix of skill levels.
 */
export function balanceStudentsIntoGroups(
  students: StudentWithScore[],
  numGroups: number
): GroupAssignment[] {
  if (numGroups < 1) numGroups = 1;
  if (numGroups > students.length) numGroups = students.length;

  // Initialize empty groups
  const groups: GroupAssignment[] = Array.from({ length: numGroups }, (_, i) => ({
    groupNum: i + 1,
    userIds: [],
  }));

  // Round-robin distribution
  // Highest skill students go to different groups first
  students.forEach((student, index) => {
    const groupIndex = index % numGroups;
    groups[groupIndex]!.userIds.push(student.userId);
  });

  return groups;
}

export type GroupingAuthzResult =
  | { ok: true; courseId: string }
  | { ok: false; error: "not_found" | "forbidden" };

/**
 * IDOR guard cho GroupingSession — chain thật: GroupingSession -> session
 * (ClassroomSession) -> lesson -> module -> courseId. Chỉ instructor có
 * quyền edit course đó (hoặc admin, qua canEditCourse) mới xem/sửa được phân
 * nhóm; trước bản vá này 2 route update/members hoàn toàn không check gì
 * ngoài đăng nhập, nên 1 instructor biết groupingId của course khác vẫn
 * xem được email học viên / ghi đè phân nhóm của người khác.
 *
 * `grouping/create` hiện luôn bắt buộc `lessonId` (không có nhánh
 * "standalone" nào tạo GroupingSession thiếu lesson), nên
 * `session.lesson === null` không nên xảy ra với dữ liệu hợp lệ — coi đó là
 * not_found (fail-closed) thay vì đoán quyền sở hữu.
 */
export async function authorizeGroupingOwner(
  groupingId: string,
  userId: string,
  db: PrismaClient = prisma,
): Promise<GroupingAuthzResult> {
  const grouping = await db.groupingSession.findUnique({
    where: { id: groupingId },
    select: {
      session: {
        select: {
          lesson: { select: { module: { select: { courseId: true } } } },
        },
      },
    },
  });
  if (!grouping || !grouping.session.lesson) {
    return { ok: false, error: "not_found" };
  }
  const courseId = grouping.session.lesson.module.courseId;
  const allowed = await canEditCourse(userId, courseId, db);
  if (!allowed) return { ok: false, error: "forbidden" };
  return { ok: true, courseId };
}
