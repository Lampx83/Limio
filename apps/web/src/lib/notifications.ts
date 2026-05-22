import { prisma } from "@feedbackme/db";

export type NotificationType =
  | "peer_review.assigned"
  | "assignment.graded"
  | "forum.reply"
  | "mission.passed"
  | "mission.failed"
  | "badge.earned";

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  link: string;
  iconKey: string;
  createdAt: Date;
};

const FETCH_LIMIT_PER_TYPE = 10;

export async function getUserNotifications(
  userId: string,
  limit = 20,
): Promise<Notification[]> {
  const [
    peerReviews,
    gradedSubs,
    forumReplies,
    missionResults,
    badges,
  ] = await Promise.all([
    prisma.missionReviewAssignment.findMany({
      where: { reviewerId: userId, completedAt: null },
      orderBy: { assignedAt: "desc" },
      take: FETCH_LIMIT_PER_TYPE,
      include: {
        submission: {
          include: { mission: { select: { title: true, tournamentId: true } } },
        },
      },
    }),
    prisma.assignmentSubmission.findMany({
      where: { userId, status: "graded", gradedAt: { not: null } },
      orderBy: { gradedAt: "desc" },
      take: FETCH_LIMIT_PER_TYPE,
      include: {
        assignment: {
          select: {
            title: true,
            maxScore: true,
            lesson: {
              select: {
                id: true,
                module: { select: { course: { select: { slug: true } } } },
              },
            },
          },
        },
      },
    }),
    prisma.forumPost.findMany({
      where: { thread: { authorId: userId }, NOT: { authorId: userId } },
      orderBy: { createdAt: "desc" },
      take: FETCH_LIMIT_PER_TYPE,
      include: {
        author: { select: { displayName: true } },
        thread: {
          select: {
            id: true,
            title: true,
            lesson: {
              select: {
                module: { select: { course: { select: { slug: true } } } },
              },
            },
          },
        },
      },
    }),
    prisma.missionSubmission.findMany({
      where: {
        userId,
        status: { in: ["passed", "failed"] },
        verifiedAt: { not: null },
      },
      orderBy: { verifiedAt: "desc" },
      take: FETCH_LIMIT_PER_TYPE,
      include: {
        mission: { select: { id: true, title: true, tournamentId: true } },
      },
    }),
    prisma.userBadge.findMany({
      where: { userId },
      orderBy: { earnedAt: "desc" },
      take: FETCH_LIMIT_PER_TYPE,
      include: { badge: { select: { name: true, code: true } } },
    }),
  ]);

  const items: Notification[] = [];

  for (const r of peerReviews) {
    items.push({
      id: `pr:${r.id}`,
      type: "peer_review.assigned",
      title: "Bạn được giao chấm bài",
      body: r.submission.mission.title,
      link: `/me/reviews/${r.id}`,
      iconKey: "review",
      createdAt: r.assignedAt,
    });
  }

  for (const s of gradedSubs) {
    const slug = s.assignment.lesson?.module.course.slug;
    const lessonId = s.assignment.lesson?.id;
    items.push({
      id: `gr:${s.id}`,
      type: "assignment.graded",
      title: "Bài tập đã được chấm",
      body: `${s.assignment.title} · ${s.score ?? "?"}/${s.assignment.maxScore} điểm`,
      link:
        slug && lessonId
          ? `/learn/${slug}/lessons/${lessonId}?tab=tasks`
          : "/me/enrollments",
      iconKey: "graded",
      createdAt: s.gradedAt!,
    });
  }

  for (const p of forumReplies) {
    const slug = p.thread.lesson.module.course.slug;
    items.push({
      id: `fp:${p.id}`,
      type: "forum.reply",
      title: `${p.author.displayName} đã trả lời`,
      body: p.thread.title,
      link: `/learn/${slug}/threads/${p.thread.id}`,
      iconKey: "reply",
      createdAt: p.createdAt,
    });
  }

  for (const m of missionResults) {
    const passed = m.status === "passed";
    items.push({
      id: `ms:${m.id}`,
      type: passed ? "mission.passed" : "mission.failed",
      title: passed ? "Mission hoàn thành" : "Mission chưa đạt",
      body: m.mission.title,
      link: `/tournaments/${m.mission.tournamentId}/missions/${m.mission.id}`,
      iconKey: passed ? "mission_ok" : "mission_fail",
      createdAt: m.verifiedAt!,
    });
  }

  for (const b of badges) {
    items.push({
      id: `bg:${b.id}`,
      type: "badge.earned",
      title: "Bạn vừa đạt huy hiệu",
      body: b.badge.name,
      link: "/me/badges",
      iconKey: "badge",
      createdAt: b.earnedAt,
    });
  }

  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return items.slice(0, limit);
}

export async function getUnreadCount(userId: string): Promise<number> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationsLastSeenAt: true },
  });
  const since = u?.notificationsLastSeenAt ?? new Date(0);

  // We count source rows newer than lastSeen across types in parallel.
  // Bounded queries — index-friendly, returns small ints.
  const [a, b, c, d, e] = await Promise.all([
    prisma.missionReviewAssignment.count({
      where: { reviewerId: userId, completedAt: null, assignedAt: { gt: since } },
    }),
    prisma.assignmentSubmission.count({
      where: { userId, status: "graded", gradedAt: { gt: since } },
    }),
    prisma.forumPost.count({
      where: {
        thread: { authorId: userId },
        NOT: { authorId: userId },
        createdAt: { gt: since },
      },
    }),
    prisma.missionSubmission.count({
      where: {
        userId,
        status: { in: ["passed", "failed"] },
        verifiedAt: { gt: since },
      },
    }),
    prisma.userBadge.count({
      where: { userId, earnedAt: { gt: since } },
    }),
  ]);

  return a + b + c + d + e;
}

export async function markNotificationsSeen(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { notificationsLastSeenAt: new Date() },
  });
}
