import { NextResponse } from "next/server";
import { isAdmin } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { csvResponse } from "@/lib/csvExport";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(userId))) {
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
    occurred_at: a.occurredAt,
    action: a.action,
    actor_email: a.actor?.email ?? "",
    actor_name: a.actor?.displayName ?? "",
    target_email: a.target?.email ?? "",
    target_name: a.target?.displayName ?? "",
    payload: a.payload,
  }));

  return csvResponse(`audit-${days}d-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}
