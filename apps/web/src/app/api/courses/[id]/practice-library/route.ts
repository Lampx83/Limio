import { NextResponse } from "next/server";
import { listPracticeLibrary } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { parseLibraryParams } from "@/lib/practiceLibraryQuery";

export const runtime = "nodejs";

/** LANG L6.2 — một trang của thư viện đề (nút "Tải thêm"). Quyền kiểm trong `listPracticeLibrary`. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  try {
    const page = await listPracticeLibrary(userId, params.id, parseLibraryParams(sp));
    return NextResponse.json(page);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
