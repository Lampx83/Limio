import { NextResponse } from "next/server";
import { reorderPassages } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { orderedPassageIds?: string[] } | null;
  if (!body?.orderedPassageIds || !Array.isArray(body.orderedPassageIds)) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try {
    await reorderPassages(userId, params.id, body.orderedPassageIds);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
