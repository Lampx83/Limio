import { NextResponse } from "next/server";
import { createPracticeExam, type PracticeExamInput } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** LANG L6 — tạo một đề thi thử MỘT phần một kỹ năng trong khoá luyện đề (nháp). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await createPracticeExam(userId, params.id, (await readJson(req)) as PracticeExamInput), { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
