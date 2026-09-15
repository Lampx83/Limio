import { NextResponse } from "next/server";
import { createExam } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * POST /api/exams — tạo đề ĐỘC LẬP, không gắn khoá học nào (courseId=null).
 * Đề gắn khoá học vẫn đi qua /api/courses/[id]/exams như cũ — route này chỉ
 * phục vụ luồng "Không gắn khoá học" của ExamMetaForm.
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    const result = await createExam(userId, null, body);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
