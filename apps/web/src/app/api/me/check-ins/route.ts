import { NextResponse } from "next/server";
import { listMyCheckIns } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** GET /api/me/check-ins?from=&to= — các buổi của chính mình trong khoảng ngày, kèm đối chiếu (CENTER C5.7). */
export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  try {
    return NextResponse.json({ rows: await listMyCheckIns(userId, { from: url.searchParams.get("from") ?? "", to: url.searchParams.get("to") ?? "" }) });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
