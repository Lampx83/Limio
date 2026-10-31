import { NextResponse } from "next/server";
import { assertCanEditCourse, listBatchCodes, type AccessCodeStatusFilter } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

const STATUSES: readonly string[] = ["unused", "redeemed", "revoked"];

// GET /api/courses/[id]/access-code-batches/[batchId]/codes?status=&page= — mã của một lô, 50/trang.
export async function GET(req: Request, { params }: { params: { id: string; batchId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const page = Number(url.searchParams.get("page") ?? "1");
  try {
    await assertCanEditCourse(userId, params.id);
    const r = await listBatchCodes(params.id, params.batchId, {
      status: status && STATUSES.includes(status) ? (status as AccessCodeStatusFilter) : undefined,
      page,
    });
    return NextResponse.json(r);
  } catch (e) {
    return mapKnownError(e) ?? (() => { throw e; })();
  }
}
