import { NextResponse } from "next/server";
import { isAdmin } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { csvResponse } from "@/lib/csvExport";

export const runtime = "nodejs";

const ROLE_LABELS: Record<string, string> = {
  learner: "Học viên",
  instructor: "Giảng viên",
  admin: "Quản trị",
  mentor: "Mentor",
};

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(userId)) {
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
    "Họ tên": u.displayName ?? "",
    "Email": u.email,
    "Đã xác minh email": u.emailVerifiedAt ? "Có" : "Chưa",
    "Vai trò": u.userRoles
      .map((r) => ROLE_LABELS[r.role.name] ?? r.role.name)
      .join(", "),
    "Số khoá đăng ký": u._count.enrollments,
    "Số lần làm quiz": u._count.quizAttempts,
    "Số bài tập nộp": u._count.assignmentSubmissions,
    "Ẩn bảng xếp hạng": u.leaderboardOptOut ? "Có" : "Không",
    "Ngôn ngữ": u.locale ?? "",
    "Múi giờ": u.timezone ?? "",
    "Ngày tạo tài khoản": u.createdAt,
  }));

  return csvResponse(`danh-sach-nguoi-dung-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}
