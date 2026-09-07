import { NextResponse } from "next/server";
import { abandonAttempt } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

/**
 * Bỏ một lượt làm đang dở và chưa trả lời câu nào — người học chỉ mở ra xem
 * rồi hết giờ. Xem `abandonAttempt` để biết vì sao không nộp mà lại bỏ.
 */
export async function POST(
  _req: Request,
  { params }: { params: { attemptId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await abandonAttempt(userId, params.attemptId);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
