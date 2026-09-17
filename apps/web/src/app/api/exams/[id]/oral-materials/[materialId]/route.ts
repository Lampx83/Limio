import { NextResponse } from "next/server";
import { deleteOralMaterial } from "@feedbackme/core-lms";
import { requireFeature } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { storageFor } from "@/lib/storage";
import { oralExamMaterialKeyFromFilename } from "@/lib/storage-keys";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; materialId: string } },
) {
  const userId = await requireFeature("ai_oral.access");
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const deleted = await deleteOralMaterial(userId, params.materialId);
    if (deleted.s3Key) {
      const key = oralExamMaterialKeyFromFilename(deleted.s3Key);
      if (key) await storageFor(key).delete(key.key).catch(() => undefined);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
