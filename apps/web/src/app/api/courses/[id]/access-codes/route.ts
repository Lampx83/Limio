import { NextResponse } from "next/server";
import {
  ACCESS_CODE_BATCH_MAX,
  assertCanEditCourse,
  generateAccessCodes,
  listAccessCodes,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

// GET /api/courses/[id]/access-codes — danh sách mã của khoá (giảng viên).
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await assertCanEditCourse(userId, params.id);
  } catch (e) {
    return mapKnownError(e) ?? (() => { throw e; })();
  }
  const codes = await listAccessCodes(params.id);
  return NextResponse.json({ codes });
}

// POST /api/courses/[id]/access-codes — sinh N mã mới. Body: { count }.
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await assertCanEditCourse(userId, params.id);
  } catch (e) {
    return mapKnownError(e) ?? (() => { throw e; })();
  }
  const body = (await readJson(req)) as { count?: number } | null;
  const count = Number(body?.count);
  if (!Number.isInteger(count) || count < 1 || count > ACCESS_CODE_BATCH_MAX) {
    return NextResponse.json(
      { error: "validation_failed", details: { max: ACCESS_CODE_BATCH_MAX } },
      { status: 400 },
    );
  }
  try {
    const codes = await generateAccessCodes(params.id, userId, count);
    return NextResponse.json({ codes });
  } catch (e) {
    return mapKnownError(e) ?? (() => { throw e; })();
  }
}
