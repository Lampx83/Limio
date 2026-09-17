import { NextResponse } from "next/server";
import { createOralMaterialTopicList } from "@feedbackme/core-lms";
import { requireFeature } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";
import { tryEmbedMaterial } from "@/lib/oralExamEmbed";

export const runtime = "nodejs";

/** A6.1 — Nhập danh sách chủ đề vấn đáp bằng tay (không có file). */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireFeature("ai_oral.access");
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await readJson(req);
  try {
    const r = await createOralMaterialTopicList(userId, params.id, body);
    const embedded = await tryEmbedMaterial(userId, r.materialId);
    return NextResponse.json({ ...r, embedded }, { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
