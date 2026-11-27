import { NextResponse } from "next/server";
import { listPublisherOrders } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

// GET /api/courses/[id]/publisher-orders?code=&status=paid|refunded — đơn đã trả tiền / đã hoàn của khoá, ẩn danh người mua.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  try {
    const orders = await listPublisherOrders(userId, params.id, {
      code: url.searchParams.get("code") ?? undefined,
      status: status === "paid" || status === "refunded" ? status : undefined,
    });
    return NextResponse.json({ orders });
  } catch (e) {
    return mapKnownError(e) ?? (() => { throw e; })();
  }
}
