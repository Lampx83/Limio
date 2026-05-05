import { NextResponse } from "next/server";
import { isAdmin } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { csvResponse } from "@/lib/csvExport";

export const runtime = "nodejs";

// Map technical action names to readable Vietnamese labels
const ACTION_LABELS: Record<string, string> = {
  "user.role.granted": "Cấp vai trò",
  "user.role.revoked": "Thu hồi vai trò",
  "impersonation.started": "Bắt đầu xem dưới vai trò",
  "impersonation.stopped": "Kết thúc xem dưới vai trò",
  "course.created": "Tạo khoá học",
  "course.published": "Xuất bản khoá học",
  "course.archived": "Lưu trữ khoá học",
  "enrollment.created": "Đăng ký khoá học",
  "enrollment.dropped": "Huỷ đăng ký",
};

function summarisePayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as Record<string, unknown>;
  return Object.entries(p)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join("; ");
}

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(userId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const days = Math.min(Number(url.searchParams.get("days") ?? "90") || 90, 365);
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);

  const logs = await prisma.auditLog.findMany({
    where: { occurredAt: { gte: since } },
    orderBy: { occurredAt: "desc" },
    take: 10000,
    include: {
      actor: { select: { email: true, displayName: true } },
      target: { select: { email: true, displayName: true } },
    },
  });

  const rows = logs.map((a) => ({
    "Thời gian": a.occurredAt,
    "Hành động": ACTION_LABELS[a.action] ?? a.action,
    "Mã hành động": a.action,
    "Người thực hiện": a.actor?.displayName ?? "",
    "Email người thực hiện": a.actor?.email ?? "",
    "Đối tượng": a.target?.displayName ?? "",
    "Email đối tượng": a.target?.email ?? "",
    "Chi tiết": summarisePayload(a.payload),
  }));

  return csvResponse(`audit-log-${days}-ngay-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}
