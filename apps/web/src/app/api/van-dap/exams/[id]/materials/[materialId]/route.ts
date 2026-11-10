import { NextResponse } from "next/server";
import { removeVanDapMaterial } from "@feedbackme/core-lms";
import { withVanDap } from "@/lib/vanDapApi";
import { storageFor } from "@/lib/storage";
import { vanDapMaterialKeyFromFilename } from "@/lib/storage-keys";

export const runtime = "nodejs";

export function DELETE(_req: Request, { params }: { params: { id: string; materialId: string } }) {
  return withVanDap(async (userId) => {
    const { s3Key } = await removeVanDapMaterial(userId, params.id, params.materialId);
    const key = s3Key ? vanDapMaterialKeyFromFilename(s3Key) : null;
    if (key) await storageFor(key).delete(key.key).catch(() => undefined);
    return NextResponse.json({ ok: true });
  });
}
