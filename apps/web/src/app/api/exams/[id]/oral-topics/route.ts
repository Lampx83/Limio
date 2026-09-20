import { NextResponse } from "next/server";
import { createOralTopic, listOralTopics } from "@feedbackme/core-lms";
import { requireFeature } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** A6.7 — Danh sách chủ đề giao cho sinh viên của 1 đề vấn đáp. GV-only, không có route cho SV. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireFeature("ai_oral.access");
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const topics = await listOralTopics(userId, params.id);
    return NextResponse.json({ topics });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

/** A6.7 — Thêm 1 chủ đề { title, brief }. Chỉ khi đề còn nháp. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireFeature("ai_oral.access");
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await readJson(req);
  try {
    const r = await createOralTopic(userId, params.id, body);
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
