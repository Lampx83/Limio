import { NextResponse } from "next/server";
import { canGradeCourse } from "@feedbackme/core-lms";
import { getFlashcardStats } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEADERS = { "cache-control": "private, no-store" };

/**
 * LANG G4 — GET /api/courses/:id/flashcards/stats[?userId=]
 * Thống kê của mình; của người khác thì phải là giảng viên/trợ giảng của khoá
 * (cùng quy tắc với hồ sơ 4 kỹ năng). Chỉ gồm số đếm.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const viewerId = await requireUserId();
  if (!viewerId) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: HEADERS });

  const target = new URL(req.url).searchParams.get("userId") ?? viewerId;
  if (!UUID.test(target)) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400, headers: HEADERS });
  }
  if (target !== viewerId && !(await canGradeCourse(viewerId, params.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: HEADERS });
  }
  return NextResponse.json(await getFlashcardStats(target, params.id), { headers: HEADERS });
}
