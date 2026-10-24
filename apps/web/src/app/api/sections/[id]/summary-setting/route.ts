import { NextResponse } from "next/server";
import { setSectionAutoSendSummary } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** Bật/tắt tự gửi tổng kết chung sau buổi của lớp: { enabled: boolean }. Chỉ người quản khoá. */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const raw = (await readJson(req)) as { enabled?: unknown } | null;
  if (typeof raw?.enabled !== "boolean") return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    return NextResponse.json(await setSectionAutoSendSummary(userId, params.id, raw.enabled));
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
