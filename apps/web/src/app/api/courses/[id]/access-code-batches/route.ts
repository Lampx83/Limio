import { NextResponse } from "next/server";
import {
  ACCESS_CODE_BATCH_LIMIT,
  assertCanEditCourse,
  createAccessCodeBatch,
  listAccessCodeBatches,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

// GET /api/courses/[id]/access-code-batches — các lô mã của khoá kèm số mã theo trạng thái (giảng viên).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await assertCanEditCourse(userId, params.id);
    return NextResponse.json(await listAccessCodeBatches(params.id));
  } catch (e) {
    return mapKnownError(e) ?? (() => { throw e; })();
  }
}

// POST /api/courses/[id]/access-code-batches — tạo một lô. Body: { label, count, note? }.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { label?: unknown; count?: unknown; note?: unknown } | null;
  if (typeof body?.label !== "string" || typeof body.count !== "number") {
    return NextResponse.json({ error: "validation_failed", details: { max: ACCESS_CODE_BATCH_LIMIT } }, { status: 400 });
  }
  try {
    await assertCanEditCourse(userId, params.id);
    const r = await createAccessCodeBatch(params.id, userId, {
      label: body.label,
      count: body.count,
      note: typeof body.note === "string" ? body.note : null,
    });
    return NextResponse.json(r);
  } catch (e) {
    return mapKnownError(e) ?? (() => { throw e; })();
  }
}
