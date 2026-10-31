import { NextResponse } from "next/server";
import { assertCanEditCourse, lookupAccessCode } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

// GET /api/courses/[id]/access-codes/lookup?code= — tra một mã trong khoá này (khách báo lỗi): trạng thái, lô, ai dùng.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const code = new URL(req.url).searchParams.get("code") ?? "";
  try {
    await assertCanEditCourse(userId, params.id);
    const r = await lookupAccessCode(params.id, code);
    return NextResponse.json({
      status: r.status,
      batch: r.batch,
      redeemedBy: r.redeemedBy,
      redeemedAt: r.redeemedAt,
      createdAt: r.createdAt,
    });
  } catch (e) {
    return mapKnownError(e) ?? (() => { throw e; })();
  }
}
