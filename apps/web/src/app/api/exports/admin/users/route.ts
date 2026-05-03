import { NextResponse } from "next/server";
import { isAdmin } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { csvResponse } from "@/lib/csvExport";

export const runtime = "nodejs";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      userRoles: { include: { role: { select: { name: true } } } },
      _count: {
        select: {
          enrollments: true,
          quizAttempts: true,
          assignmentSubmissions: true,
        },
      },
    },
  });

  const rows = users.map((u) => ({
    id: u.id,
    email: u.email,
    display_name: u.displayName,
    locale: u.locale,
    timezone: u.timezone,
    email_verified: u.emailVerifiedAt ? "yes" : "no",
    leaderboard_opt_out: u.leaderboardOptOut,
    roles: u.userRoles.map((r) => r.role.name).join(";"),
    enrollments: u._count.enrollments,
    quiz_attempts: u._count.quizAttempts,
    assignments: u._count.assignmentSubmissions,
    created_at: u.createdAt,
  }));

  return csvResponse(`users-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}
