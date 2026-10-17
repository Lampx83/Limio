import { NextResponse } from "next/server";
import { listContentVersions } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

/** GET — lịch sử phiên bản của khối Văn bản, mới nhất trước (chỉ người sửa được khoá). */
export async function GET(_req: Request, { params }: { params: { contentId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ versions: await listContentVersions(userId, params.contentId) });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
