import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Trạng thái đơn hàng của CHÍNH người hỏi (trang chuyển khoản tự hỏi mỗi vài giây tới khi `paid`). Không lộ gì ngoài
 * trạng thái và nơi chuyển tới; đơn của người khác → 404 như không tồn tại.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const order = await prisma.order.findFirst({
    where: { id: params.id, userId },
    select: { status: true, bundleId: true, course: { select: { slug: true } } },
  });
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    status: order.status,
    bundle: order.bundleId !== null,
    courseSlug: order.course?.slug ?? null,
  });
}
