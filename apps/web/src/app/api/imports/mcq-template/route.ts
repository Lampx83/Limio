import { NextResponse } from "next/server";
import { generateMcqTemplateXlsx } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/**
 * GET /api/imports/mcq-template
 *
 * Trả về file .xlsx mẫu cho instructor import câu hỏi MCQ. File có header
 * canonical + 2-3 row ví dụ (mcq single, mcq multi-correct, true_false).
 *
 * Dùng chung cho mọi destination: Quiz, Question Bank, Exam, Tournament.
 */
export async function GET() {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const buf = generateMcqTemplateXlsx();
  // Cast to Uint8Array for the Web Response BodyInit contract (Node Buffer
  // → not directly assignable in the strictest typing). Underlying bytes are
  // the same — Buffer extends Uint8Array at runtime.
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="mcq-import-template.xlsx"',
      "cache-control": "no-store",
    },
  });
}
