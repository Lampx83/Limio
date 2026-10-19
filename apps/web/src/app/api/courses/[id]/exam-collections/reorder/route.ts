import { NextResponse } from "next/server";
import { reorderExamCollections } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { orderedIds?: unknown } | null;
  const ids = Array.isArray(body?.orderedIds) ? (body!.orderedIds as unknown[]).filter((x): x is string => typeof x === "string") : null;
  if (!ids) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    await reorderExamCollections(userId, params.id, ids);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
