import { prisma } from "@feedbackme/db";
import { getEffectiveGoal, listSectionLearnerGoals, type EffectiveGoal } from "@feedbackme/core-lms";
import { getGoalProgress, type GoalProgress } from "@feedbackme/core-feedback";

/** Mục tiêu hiệu lực + tiến độ của một học viên trong một khoá; null nếu chưa có mục tiêu nào (riêng hay của lớp). */
export async function loadGoalWithProgress(
  userId: string,
  courseId: string,
  audience: "learner" | "instructor",
): Promise<{ effective: EffectiveGoal; progress: GoalProgress } | null> {
  const effective = await getEffectiveGoal(userId, courseId);
  if (!effective.goal) return null;
  const progress = await getGoalProgress({ userId, courseId, goal: effective.goal, audience });
  return { effective, progress };
}

/** Cho giáo viên: cả lớp, mỗi học viên một dòng. Quyền xem lớp do core-lms kiểm. Giới hạn 80 người để một lần gọi không quá nặng. */
export async function loadLearnerGoalProgress(actorUserId: string, sectionId: string) {
  const rows = (await listSectionLearnerGoals(actorUserId, sectionId)).slice(0, 80);
  const section = await prisma.courseSection.findUniqueOrThrow({ where: { id: sectionId }, select: { courseId: true } });
  return Promise.all(
    rows.map(async (r) => {
      // Người chưa có mục tiêu riêng vẫn được tính theo mục tiêu của lớp (nếu có).
      const eff = await loadGoalWithProgress(r.userId, section.courseId, "instructor");
      return {
        userId: r.userId,
        displayName: r.displayName,
        goal: r.goal,
        source: eff?.effective.source ?? "none",
        effectiveGoal: eff?.effective.goal ?? null,
        progress: eff?.progress ?? null,
      };
    }),
  );
}
