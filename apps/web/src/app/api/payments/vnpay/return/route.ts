import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/seo";
import { prisma } from "@feedbackme/db";
import { getVnpayConfig, verifyVnpayParams } from "@/lib/vnpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Trang người mua quay về từ VNPay (docs/tieu-chi/thanh-toan-vnpay.md, AC4). CHỈ chuyển hướng: không bao giờ đổi
 * đơn hay cấp quyền ở đây — chữ ký trên URL này do trình duyệt người mua chuyển tới, và quyền học chỉ do IPN cấp.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const to = (path: string) => NextResponse.redirect(absoluteUrl(path));

  const cfg = await getVnpayConfig();
  if (!cfg || !verifyVnpayParams(url.searchParams, cfg.hashSecret)) return to("/");

  const txnRef = url.searchParams.get("vnp_TxnRef") ?? "";
  const order = txnRef
    ? await prisma.order.findFirst({
        where: { provider: "vnpay", providerRef: txnRef },
        select: { course: { select: { slug: true } }, bundle: { select: { slug: true } } },
      })
    : null;
  if (!order) return to("/");

  const ok = url.searchParams.get("vnp_ResponseCode") === "00";
  // Đơn combo: thành công → trang học của người dùng (đủ các khoá vừa mở); huỷ → quay lại trang combo.
  if (order.bundle) {
    const bslug = encodeURIComponent(order.bundle.slug);
    return ok ? to("/me?paid=1") : to(`/combo/${bslug}?cancelled=1`);
  }
  if (!order.course) return to("/");
  const slug = encodeURIComponent(order.course.slug);
  return ok
    ? to(`/learn/${slug}?paid=1`)
    : to(`/catalog/${slug}?cancelled=1`);
}
