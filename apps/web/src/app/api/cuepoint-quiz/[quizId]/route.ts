import { NextResponse } from "next/server";
import { deleteCuepointQuizIfOrphan, getCuepointQuiz, updateCuepointQuiz } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read a cuepoint quiz's inline question — used by the cuepoint editor to
 * prefill the inline form when re-opening an existing video.
 */
export async function GET(
  _req: Request,
  { params }: { params: { quizId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const data = await getCuepointQuiz(userId, params.quizId);
    return NextResponse.json(data);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

/**
 * Update the inline question of a cuepoint quiz. Body: `{ atSec?, question }`.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { quizId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    await updateCuepointQuiz(userId, params.quizId, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

/**
 * Delete a cuepoint quiz when it's not referenced by any video ContentItem.
 * Used by the cuepoint editor to roll back inline-quiz creation if the
 * subsequent content-item save fails.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { quizId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const deleted = await deleteCuepointQuizIfOrphan(userId, params.quizId);
    return NextResponse.json({ deleted });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
