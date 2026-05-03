import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { csvResponse } from "@/lib/csvExport";

export const runtime = "nodejs";

/**
 * Export learner's full LearningEvent log — last 90 days. GDPR-style data
 * portability: shows everything the platform has logged about this user.
 */
export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const daysParam = Number(url.searchParams.get("days") ?? "90");
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 365) : 90;
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);

  const events = await prisma.learningEvent.findMany({
    where: { userId, occurredAt: { gte: since } },
    orderBy: { occurredAt: "desc" },
    take: 5000, // hard cap
    select: {
      eventType: true,
      occurredAt: true,
      courseId: true,
      payload: true,
    },
  });

  const rows = events.map((e) => ({
    eventType: e.eventType,
    occurredAt: e.occurredAt,
    courseId: e.courseId ?? "",
    payload: e.payload,
  }));

  const filename = `feedbackme-activity-${userId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`;
  return csvResponse(filename, rows);
}
