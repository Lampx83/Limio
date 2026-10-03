import { NextResponse } from "next/server";
import { reviewFlashcard } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "cache-control": "private, no-store" };

const STATUS: Record<string, number> = { validation_failed: 400, not_enrolled: 403, card_not_in_deck: 404 };

/**
 * LANG G4 — POST /api/courses/:id/flashcards/review
 * Ghi một lượt ôn cho CHÍNH người đăng nhập. Chỉ bốn trường được chuyển xuống:
 * `userId` hay trường lạ trong thân yêu cầu bị bỏ, không bao giờ được tin.
 * Gửi lại cùng `reviewId` vẫn trả 200 (duplicate) để máy khách ngừng thử lại.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: HEADERS });

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object") throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "validation_failed" }, { status: 400, headers: HEADERS });
  }

  try {
    const result = await reviewFlashcard(userId, params.id, {
      itemId: body.itemId as string,
      rating: body.rating as never,
      mode: body.mode as never,
      reviewId: body.reviewId as string,
    });
    return NextResponse.json(result, { headers: HEADERS });
  } catch (e) {
    // So theo tên thay vì instanceof: lớp lỗi có thể khác nhau qua ranh giới bundle RSC.
    const err = e as { name?: string; code?: string };
    if (err?.name === "FlashcardError" && err.code && STATUS[err.code]) {
      return NextResponse.json({ error: err.code }, { status: STATUS[err.code], headers: HEADERS });
    }
    console.error("[flashcards/review]", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500, headers: HEADERS });
  }
}
