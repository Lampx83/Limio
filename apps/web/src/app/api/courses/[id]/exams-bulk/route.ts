import { NextResponse } from "next/server";
import { bulkExamAction, type BulkExamInput } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** LANG L6.6 — thao tác hàng loạt trên đề của khoá; trả kết quả TỪNG DÒNG. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await bulkExamAction(userId, params.id, (await readJson(req)) as BulkExamInput));
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
