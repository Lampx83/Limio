import { NextResponse } from "next/server";
import { getOrderCourseId, refundOrderByPublisher } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

// POST /api/courses/[id]/publisher-orders/[orderId]/refund — xác nhận ĐÃ hoàn tiền cho đơn: đơn → refunded, đóng quyền học.
// Hệ thống không chuyển tiền; việc hoàn tiền thật làm ở cổng thanh toán hay ngân hàng.
export async function POST(_req: Request, { params }: { params: { id: string; orderId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    // Đơn phải thuộc đúng khoá trong đường dẫn, để quyền kiểm theo khoá không bị vượt qua bằng id đơn của khoá khác.
    if ((await getOrderCourseId(params.orderId)) !== params.id) return NextResponse.json({ error: "order_not_found" }, { status: 404 });
    return NextResponse.json(await refundOrderByPublisher(userId, params.orderId));
  } catch (e) {
    return mapKnownError(e) ?? (() => { throw e; })();
  }
}
