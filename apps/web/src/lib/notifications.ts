import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";

export type Role = "learner" | "instructor" | "admin" | "mentor";

export type NotificationType =
  // Learner
  | "peer_review.assigned"
  | "assignment.graded"
  | "forum.reply"
  | "mission.passed"
  | "mission.failed"
  | "badge.earned"
  | "level.up"
  | "leaderboard.rank"
  // Instructor
  | "instructor.assignment.submitted"
  | "instructor.essay.pending"
  | "instructor.mission.review_needed"
  | "instructor.forum.new_thread";

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  "peer_review.assigned": "Chấm bài",
  "assignment.graded": "Bài tập",
  "forum.reply": "Trả lời forum",
  "mission.passed": "Mission",
  "mission.failed": "Mission",
  "badge.earned": "Huy hiệu",
  "level.up": "Lên level",
  "leaderboard.rank": "Xếp hạng",
  "instructor.assignment.submitted": "Bài cần chấm",
  "instructor.essay.pending": "Essay cần chấm",
  "instructor.mission.review_needed": "Mission cần review",
  "instructor.forum.new_thread": "Câu hỏi mới",
};

const PERIOD_LABEL: Record<string, string> = {
  daily: "hôm nay",
  weekly: "tuần này",
  monthly: "tháng này",
  all_time: "tổng",
};

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

// ─── Per-role last-seen map ──────────────────────────────────────────────

async function getLastSeenForRole(userId: string, role: Role): Promise<Date> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationsLastSeenAt: true, notificationsLastSeenByRole: true },
  });
  const map = (u?.notificationsLastSeenByRole ?? {}) as Record<string, string>;
  const iso = map[role];
  if (iso) return new Date(iso);
  // Legacy fallback: pre-migration global lastSeen → keep applying to learner
  // role so existing users don't see N old items resurface.
  if (role === "learner" && u?.notificationsLastSeenAt) {
    return u.notificationsLastSeenAt;
  }
  return new Date(0);
}

export async function markNotificationsSeen(
  userId: string,
  role: Role,
): Promise<void> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationsLastSeenByRole: true },
  });
  const map = (u?.notificationsLastSeenByRole ?? {}) as Record<string, string>;
  map[role] = new Date().toISOString();
  await prisma.user.update({
    where: { id: userId },
    data: { notificationsLastSeenByRole: map },
  });
}

export async function getLastSeenIso(
  userId: string,
  role: Role,
): Promise<string | null> {
  const d = await getLastSeenForRole(userId, role);
  return d.getTime() === 0 ? null : d.toISOString();
}

// ─── Public API ──────────────────────────────────────────────────────────

export async function getUserNotifications(
  userId: string,
  role: Role,
  limit = 20,
): Promise<Notification[]> {
  if (role === "instructor") return getInstructorNotifications(userId, limit);
  if (role === "learner") return getLearnerNotifications(userId, limit);
  return [];
}

export async function getUnreadCount(
  userId: string,
  role: Role,
): Promise<number> {
  const since = await getLastSeenForRole(userId, role);
  if (role === "instructor") return getInstructorUnreadCount(userId, since);
  if (role === "learner") return getLearnerUnreadCount(userId, since);
  return 0;
}

// ─── Learner aggregator ──────────────────────────────────────────────────

async function getLearnerNotifications(
  userId: string,
  limit: number,
): Promise<Notification[]> {
  const [
    peerReviews,
    gradedSubs,
    forumReplies,
    missionResults,
    badges,
    gamificationEvents,
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
    prisma.learningEvent.findMany({
      where: {
        userId,
        eventType: {
          in: [
            LearningEventType.LevelUp,
            LearningEventType.LeaderboardUpdated,
          ],
        },
      },
      orderBy: { occurredAt: "desc" },
      take: FETCH_LIMIT_PER_TYPE * 2,
      select: {
        id: true,
        eventType: true,
        payload: true,
        courseId: true,
        occurredAt: true,
      },
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

  for (const ev of gamificationEvents) {
    const p = (ev.payload ?? {}) as Record<string, unknown>;
    if (ev.eventType === LearningEventType.LevelUp) {
      items.push({
        id: `lv:${ev.id}`,
        type: "level.up",
        title: `Lên level ${p.toLevel ?? ""}`.trim(),
        body: typeof p.levelName === "string" ? p.levelName : undefined,
        link: ev.courseId ? `/learn?course=${ev.courseId}` : "/me/dashboard",
        iconKey: "level_up",
        createdAt: ev.occurredAt,
      });
    } else if (ev.eventType === LearningEventType.LeaderboardUpdated) {
      const period = typeof p.period === "string" ? p.period : "";
      const periodLabel = PERIOD_LABEL[period] ?? period;
      const rank = typeof p.rank === "number" ? p.rank : null;
      if (rank === null) continue;
      items.push({
        id: `lb:${ev.id}`,
        type: "leaderboard.rank",
        title: `Bạn xếp #${rank}${periodLabel ? ` ${periodLabel}` : ""}`,
        body: p.scope === "course" ? "trong khoá học" : "bảng xếp hạng toàn cục",
        link: "/leaderboard",
        iconKey: "rank",
        createdAt: ev.occurredAt,
      });
    }
  }

  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return items.slice(0, limit);
}

async function getLearnerUnreadCount(
  userId: string,
  since: Date,
): Promise<number> {
  const [a, b, c, d, e, f] = await Promise.all([
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
    prisma.learningEvent.count({
      where: {
        userId,
        eventType: {
          in: [
            LearningEventType.LevelUp,
            LearningEventType.LeaderboardUpdated,
          ],
        },
        occurredAt: { gt: since },
      },
    }),
  ]);

  return a + b + c + d + e + f;
}

// ─── Instructor aggregator ───────────────────────────────────────────────

// Reusable filter: course must have me as an instructor.
function courseAsMineFilter(userId: string) {
  return { instructors: { some: { userId } } };
}

async function getInstructorNotifications(
  userId: string,
  limit: number,
): Promise<Notification[]> {
  const [pendingAssignments, pendingEssays, manualMissions, newThreads] =
    await Promise.all([
      // Submitted but not graded — instructor needs to grade.
      prisma.assignmentSubmission.findMany({
        where: {
          status: "submitted",
          assignment: {
            lesson: {
              module: { course: courseAsMineFilter(userId) },
            },
          },
        },
        orderBy: { submittedAt: "desc" },
        take: FETCH_LIMIT_PER_TYPE,
        include: {
          user: { select: { displayName: true } },
          assignment: { select: { id: true, title: true } },
        },
      }),
      // Essay/short answers in exams I own — needsGrading=true.
      prisma.examAnswer.findMany({
        where: {
          needsGrading: true,
          gradedAt: null,
          attempt: {
            exam: { course: courseAsMineFilter(userId) },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: FETCH_LIMIT_PER_TYPE,
        include: {
          attempt: {
            select: {
              id: true,
              examId: true,
              user: { select: { displayName: true } },
              candidateDisplayName: true,
              exam: { select: { title: true } },
            },
          },
        },
      }),
      // Manual-review tournament mission submissions awaiting verify, in
      // tournaments I created.
      prisma.missionSubmission.findMany({
        where: {
          status: "pending",
          verifiedAt: null,
          mission: {
            verifyMode: "MANUAL_REVIEW",
            tournament: { creatorId: userId },
          },
        },
        orderBy: { submittedAt: "desc" },
        take: FETCH_LIMIT_PER_TYPE,
        include: {
          user: { select: { displayName: true } },
          mission: { select: { id: true, title: true, tournamentId: true } },
        },
      }),
      // New forum threads in courses I teach, by other people.
      prisma.forumThread.findMany({
        where: {
          NOT: { authorId: userId },
          lesson: {
            module: { course: courseAsMineFilter(userId) },
          },
        },
        orderBy: { createdAt: "desc" },
        take: FETCH_LIMIT_PER_TYPE,
        include: {
          author: { select: { displayName: true } },
          lesson: {
            select: {
              module: { select: { course: { select: { slug: true } } } },
            },
          },
        },
      }),
    ]);

  const items: Notification[] = [];

  for (const s of pendingAssignments) {
    items.push({
      id: `ias:${s.id}`,
      type: "instructor.assignment.submitted",
      title: `${s.user.displayName} đã nộp bài tập`,
      body: s.assignment.title,
      link: `/instructor/assignments/${s.assignment.id}`,
      iconKey: "inbox",
      createdAt: s.submittedAt,
    });
  }

  for (const a of pendingEssays) {
    const who =
      a.attempt.user?.displayName ?? a.attempt.candidateDisplayName ?? "Thí sinh";
    items.push({
      id: `iee:${a.id}`,
      type: "instructor.essay.pending",
      title: `${who} cần chấm tự luận`,
      body: a.attempt.exam.title,
      link: `/instructor/grade-essays?attemptId=${a.attempt.id}`,
      iconKey: "essay",
      createdAt: a.updatedAt,
    });
  }

  for (const m of manualMissions) {
    items.push({
      id: `imm:${m.id}`,
      type: "instructor.mission.review_needed",
      title: `${m.user.displayName} nộp mission`,
      body: m.mission.title,
      link: `/instructor/tournaments/${m.mission.tournamentId}/missions/${m.mission.id}/submissions`,
      iconKey: "mission_review",
      createdAt: m.submittedAt,
    });
  }

  for (const t of newThreads) {
    const slug = t.lesson.module.course.slug;
    items.push({
      id: `ift:${t.id}`,
      type: "instructor.forum.new_thread",
      title: `${t.author.displayName} đặt câu hỏi`,
      body: t.title,
      link: `/learn/${slug}/threads/${t.id}`,
      iconKey: "question",
      createdAt: t.createdAt,
    });
  }

  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return items.slice(0, limit);
}

async function getInstructorUnreadCount(
  userId: string,
  since: Date,
): Promise<number> {
  const [a, b, c, d] = await Promise.all([
    prisma.assignmentSubmission.count({
      where: {
        status: "submitted",
        submittedAt: { gt: since },
        assignment: {
          lesson: { module: { course: courseAsMineFilter(userId) } },
        },
      },
    }),
    prisma.examAnswer.count({
      where: {
        needsGrading: true,
        gradedAt: null,
        updatedAt: { gt: since },
        attempt: { exam: { course: courseAsMineFilter(userId) } },
      },
    }),
    prisma.missionSubmission.count({
      where: {
        status: "pending",
        verifiedAt: null,
        submittedAt: { gt: since },
        mission: {
          verifyMode: "MANUAL_REVIEW",
          tournament: { creatorId: userId },
        },
      },
    }),
    prisma.forumThread.count({
      where: {
        NOT: { authorId: userId },
        createdAt: { gt: since },
        lesson: { module: { course: courseAsMineFilter(userId) } },
      },
    }),
  ]);

  return a + b + c + d;
}
