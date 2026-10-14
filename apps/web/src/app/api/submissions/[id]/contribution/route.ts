import { NextResponse } from "next/server";
import { setSubmissionContributionNote } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

/** "Phần việc của tôi" trên bài nộp nhóm — chỉ chủ bài sửa được. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { note?: string };
  try {
    await setSubmissionContributionNote(userId, params.id, String(body?.note ?? ""));
    return NextResponse.json({ ok: true });
  } catch (e) {
    const m = mapKnownError(e);
    if (m) return m;
    throw e;
  }
}
