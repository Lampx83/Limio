import { NextResponse } from "next/server";
import { getLeaderboard, type Period, type Scope } from "@feedbackme/core-gamification";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PERIODS: Period[] = ["daily", "weekly", "monthly", "all_time"];
const SCOPES: Scope[] = ["global", "course"];

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "global";
  const period = url.searchParams.get("period") ?? "weekly";
  const courseId = url.searchParams.get("courseId");
  const limitRaw = url.searchParams.get("limit");

  if (!SCOPES.includes(scope as Scope)) {
    return NextResponse.json({ error: "invalid_scope" }, { status: 400 });
  }
  if (!PERIODS.includes(period as Period)) {
    return NextResponse.json({ error: "invalid_period" }, { status: 400 });
  }
  if (scope === "course" && !courseId) {
    return NextResponse.json({ error: "course_id_required" }, { status: 400 });
  }
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
  if (limitRaw && (!Number.isFinite(limit) || limit! <= 0)) {
    return NextResponse.json({ error: "invalid_limit" }, { status: 400 });
  }

  const res = await getLeaderboard({
    scope: scope as Scope,
    period: period as Period,
    courseId,
    viewerId: userId,
    limit,
  });
  return NextResponse.json(res);
}
