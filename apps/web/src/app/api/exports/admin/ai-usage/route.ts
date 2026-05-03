import { NextResponse } from "next/server";
import { isAdmin } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { csvResponse } from "@/lib/csvExport";

export const runtime = "nodejs";

/**
 * AI usage report — joins AiUsageLog with user identity. One row per
 * (user, day, model). Includes turns + tokens + cost.
 */
export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(userId))) {
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
    day: l.dayKey,
    user_email: l.user.email,
    user_name: l.user.displayName,
    model: l.model,
    turns: l.turns,
    tokens_input: l.tokensInput,
    tokens_output: l.tokensOutput,
    tokens_total: l.tokensInput + l.tokensOutput,
    cost_usd: l.costUsd,
    updated_at: l.updatedAt,
  }));

  return csvResponse(`ai-usage-${days}d-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}
