import { NextResponse } from "next/server";
import { createLanguageTemplateCourse } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

/** LANG G8 — tạo khoá mẫu ngoại ngữ (bản nháp thuộc về người gọi). Chỉ giảng viên. */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    const result = await createLanguageTemplateCourse(userId, body);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
