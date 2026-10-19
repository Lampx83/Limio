import { NextResponse } from "next/server";
import { getSectionWeights, setSectionWeights } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** GET /api/exams/[id]/section-weights — trọng số các phần + trạng thái áp dụng. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await getSectionWeights(userId, params.id));
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

/**
 * PUT /api/exams/[id]/section-weights — { weights: [{sectionId, weight}], confirmRecalc? }.
 * weights rỗng = bỏ trọng số. Đã có bài chấm xong thì cần confirmRecalc.
 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    return NextResponse.json(await setSectionWeights(userId, params.id, body));
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
