import { NextResponse } from "next/server";
import { deleteOralTopic, updateOralTopic } from "@feedbackme/core-lms";
import { requireFeature } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** A6.7 — Sửa 1 chủ đề { title, brief }. Chỉ khi đề còn nháp. */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; topicId: string } },
) {
  const userId = await requireFeature("ai_oral.access");
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await readJson(req);
  try {
    await updateOralTopic(userId, params.topicId, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

/** A6.7 — Xoá 1 chủ đề. Chỉ khi đề còn nháp. */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; topicId: string } },
) {
  const userId = await requireFeature("ai_oral.access");
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    await deleteOralTopic(userId, params.topicId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
