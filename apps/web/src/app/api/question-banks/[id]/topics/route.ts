import { NextResponse } from "next/server";
import { listTopicsInBank } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/**
 * GET /api/question-banks/[id]/topics
 *
 * Trả về danh sách topic distinct trong bank — populate filter UI.
 * Topic được lưu trong BankQuestion.config.topic (set bởi MCQ import).
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const topics = await listTopicsInBank(userId, params.id);
  return NextResponse.json({ topics });
}
