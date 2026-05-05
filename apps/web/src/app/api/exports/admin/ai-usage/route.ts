import { NextResponse } from "next/server";
import { isAdmin } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { csvResponse } from "@/lib/csvExport";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(userId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const days = Math.min(Number(url.searchParams.get("days") ?? "30") || 30, 365);
  const sinceKey = new Date(Date.now() - days * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  const logs = await prisma.aiUsageLog.findMany({
    where: { dayKey: { gte: sinceKey } },
    orderBy: [{ dayKey: "desc" }, { costUsd: "desc" }],
    include: {
      user: { select: { email: true, displayName: true } },
    },
  });

  const rows = logs.map((l) => ({
    "Ngày": l.dayKey,
    "Họ tên": l.user.displayName ?? "",
    "Email": l.user.email,
    "Model AI": l.model,
    "Số lượt hội thoại": l.turns,
    "Token đầu vào": l.tokensInput,
    "Token đầu ra": l.tokensOutput,
    "Tổng token": l.tokensInput + l.tokensOutput,
    "Chi phí (USD)": l.costUsd.toFixed(6),
  }));

  return csvResponse(`ai-usage-${days}-ngay-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}
