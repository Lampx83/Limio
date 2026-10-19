import { NextResponse } from "next/server";
import { createPracticeBankCourse } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** LANG L6.9 — tạo khoá luyện đề theo họ thi + kỹ năng (nháp, kèm bộ/Part mẫu). Chỉ giảng viên. */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await createPracticeBankCourse(userId, await readJson(req)), { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
