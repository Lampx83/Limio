import { NextResponse } from "next/server";
import { getTokenBudget } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Số dư ví token AI của người đang đăng nhập.
 *
 * Gọi hàm này cũng là lúc hạn mức tháng được cấp (cấp kiểu lười), nên mở panel
 * trợ giảng đầu tháng là đã có quota — không phải chờ tới lượt hỏi đầu tiên.
 */
export async function GET() {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const budget = await getTokenBudget(userId);
  return NextResponse.json(budget);
}
