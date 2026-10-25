import { NextResponse } from "next/server";
import { getOrgReconciliation } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** GET /api/orgs/[id]/reconciliation?from=YYYY-MM-DD&to=YYYY-MM-DD — đối chiếu lịch dạy của cả trường (CENTER C5.6). Quản trị trường. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  try {
    return NextResponse.json(await getOrgReconciliation(userId, params.id, { from: url.searchParams.get("from") ?? "", to: url.searchParams.get("to") ?? "" }));
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
