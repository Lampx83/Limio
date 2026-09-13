import { NextResponse } from "next/server";
import { reorderOralMaterials } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** A6.1 — Body: { orderedIds: string[] } — phải là hoán vị đầy đủ tài liệu hiện có. */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { orderedIds?: unknown };
  if (!Array.isArray(body.orderedIds) || !body.orderedIds.every((v) => typeof v === "string")) {
    return NextResponse.json(
      { error: "validation_failed", details: "orderedIds_required" },
      { status: 400 },
    );
  }
  try {
    await reorderOralMaterials(userId, params.id, body.orderedIds);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
