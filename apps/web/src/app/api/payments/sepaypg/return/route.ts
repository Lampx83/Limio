import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/seo";
import { prisma } from "@feedbackme/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Trang người mua quay về từ cổng SePay (docs/tieu-chi/thanh-toan-sepay-pg.md, AC4). CHỈ chuyển hướng: không bao giờ đổi
 * đơn hay cấp quyền ở đây — quyền học chỉ do IPN cấp. Chỉ chủ đơn mới biết mã đơn (UUID), và không lộ gì ngoài địa chỉ chuyển tới.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const to = (path: string) => NextResponse.redirect(absoluteUrl(path));
  const orderId = url.searchParams.get("order") ?? "";
  const status = url.searchParams.get("status");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return to("/");

  const order = await prisma.order.findFirst({
    where: { id: orderId, provider: "sepay_pg" },
    select: { course: { select: { slug: true } }, bundle: { select: { slug: true } } },
  });
  if (!order) return to("/");

  if (order.bundle) {
    return status === "success" ? to("/me?paid=1") : to(`/combo/${encodeURIComponent(order.bundle.slug)}?cancelled=1`);
  }
  if (!order.course) return to("/");
  const slug = encodeURIComponent(order.course.slug);
  return status === "success" ? to(`/learn/${slug}?paid=1`) : to(`/catalog/${slug}?cancelled=1`);
}
