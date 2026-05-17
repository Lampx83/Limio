/**
 * Dispatch admin-editable gamification emails after a quiz submission.
 *
 * Bridges core-gamification (which can't import core-lms per module boundary)
 * to the email template helper. Called from the submit-attempt orchestrator
 * route after onQuizSubmitted() / awardSkillMasterBadges() return.
 *
 * Best-effort: errors are swallowed. Email failures must not break the API.
 */
import { prisma } from "@feedbackme/db";
import { sendTemplatedEmail } from "@feedbackme/core-lms";

const LEVEL_TITLES: Record<number, string> = {
  1: "Người mới",
  2: "Học viên",
  3: "Học viên chuyên cần",
  4: "Học viên kỳ cựu",
  5: "Cao thủ",
  6: "Bậc thầy",
};

interface NewlyEarnedBadge {
  badgeCode: string;
}

interface Input {
  userId: string;
  courseId: string;
  /** Set if onQuizSubmitted reported a level-up. */
  leveledUpTo?: {
    level: number;
    totalXp: number;
  };
  /** Badge codes newly awarded in this submission (from gamification + skillBadges). */
  newBadges?: NewlyEarnedBadge[];
  baseUrl: string;
}

export async function dispatchPostQuizEmails(input: Input): Promise<void> {
  if (!input.leveledUpTo && (!input.newBadges || input.newBadges.length === 0))
    return;

  const [user, course] = await Promise.all([
    prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true, displayName: true, organizationId: true },
    }),
    prisma.course.findUnique({
      where: { id: input.courseId },
      select: { organizationId: true },
    }),
  ]);
  if (!user) return;

  // Prefer course org (override scope where the activity happened); fall back
  // to user's org. Either may be null → global template.
  const organizationId = course?.organizationId ?? user.organizationId ?? null;
  const profileUrl = `${input.baseUrl.replace(/\/$/, "")}/profile`;

  if (input.leveledUpTo) {
    try {
      await sendTemplatedEmail({
        key: "gamification.level_up",
        to: user.email,
        organizationId,
        variables: {
          learnerName: user.displayName,
          newLevel: input.leveledUpTo.level,
          levelTitle: LEVEL_TITLES[input.leveledUpTo.level] ?? "",
          totalXp: input.leveledUpTo.totalXp,
          profileUrl,
        },
      });
    } catch {
      /* swallow */
    }
  }

  if (input.newBadges && input.newBadges.length > 0) {
    const badges = await prisma.badge.findMany({
      where: { code: { in: input.newBadges.map((b) => b.badgeCode) } },
      select: { code: true, name: true, description: true },
    });
    const badgesUrl = `${input.baseUrl.replace(/\/$/, "")}/profile#badges`;
    for (const b of badges) {
      try {
        await sendTemplatedEmail({
          key: "gamification.badge_earned",
          to: user.email,
          organizationId,
          variables: {
            learnerName: user.displayName,
            badgeName: b.name,
            badgeDescription: b.description ?? "",
            badgesUrl,
          },
        });
      } catch {
        /* swallow */
      }
    }
  }
}
