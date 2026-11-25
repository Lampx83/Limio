import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { settleGatewayPayment } from "@feedbackme/core-lms";
import { fetchSepayPgOrder, getSepayPgConfig, parseSepayPgIpn, verifySepayPgIpnSecret } from "@/lib/sepayPg";
import { allow, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * IPN của cổng thanh toán SePay (docs/tieu-chi/thanh-toan-sepay-pg.md, AC3). SePay POST JSON khi có giao dịch và chờ HTTP
 * 200. Đây là đường DUY NHẤT cấp quyền cho đơn `sepay_pg`.
 *
 * Hai cách tin được cuộc gọi:
 *  - Có khoá IPN (`sepaypg.ipn_secret`): header `X-Secret-Key` phải khớp.
 *  - Không có khoá IPN (trang cấu hình IPN của SePay có thể không có ô này): IPN chỉ là TÍN HIỆU; hỏi lại API của SePay
 *    (Basic Auth Merchant ID : Secret Key) và chỉ cấp quyền khi SePay xác nhận đơn đã thu tiền đúng số tiền. Kẻ giả mạo
 *    không giả được câu trả lời của API, và chỉ mã hoá đơn của một đơn đang có mới tốn một lần gọi API.
 * Mọi kết quả "logic" (đơn lạ, số tiền lệch, đã xử lý) trả 200 để SePay không gửi lại vô ích; chỉ lỗi tạm thời mới 500.
 */
export async function POST(req: Request) {
  const cfg = await getSepayPgConfig();
  if (!cfg) return NextResponse.json({ success: false, error: "sepay_pg_not_configured" }, { status: 503 });

  const useSecret = cfg.ipnSecret !== "";
  if (useSecret && !verifySepayPgIpnSecret(req.headers.get("x-secret-key"), cfg.ipnSecret)) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }
  if (!useSecret) {
    const ip = clientIp(req);
    const limit = await allow("sepaypg-ipn:ip", ip === "unknown" ? "unknown" : ip, 120, 60_000);
    if (!limit.ok) return NextResponse.json({ success: false, error: "rate_limited" }, { status: 429 });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const ipn = parseSepayPgIpn(body);
  if (ipn.kind === "invalid") return NextResponse.json({ success: false, error: "validation_failed" }, { status: 400 });
  if (ipn.kind === "ignored") return NextResponse.json({ success: true, ignored: ipn.reason });

  try {
    let paidAmount = ipn.amount;
    let transactionId = ipn.transactionId;
    if (!useSecret) {
      // Chỉ tốn một lần gọi API khi mã hoá đơn là của một đơn sepay_pg đang có.
      const order = await prisma.order.findFirst({
        where: { provider: "sepay_pg", providerRef: ipn.invoiceNumber },
        select: { amountCents: true, status: true },
      });
      if (!order) return NextResponse.json({ success: true, result: "order_not_found" });
      if (order.status === "paid" || order.status === "refunded") return NextResponse.json({ success: true, result: "already_confirmed" });

      const info = await fetchSepayPgOrder(cfg, ipn.invoiceNumber);
      if (!info || info.status !== "CAPTURED" || (info.invoiceNumber && info.invoiceNumber !== ipn.invoiceNumber)) {
        return NextResponse.json({ success: true, result: "not_confirmed" });
      }
      // Tin số tiền SePay xác nhận qua API, không tin số tiền trong thân IPN.
      paidAmount = info.amount;
      transactionId = transactionId || ipn.invoiceNumber;
    }

    const outcome = await settleGatewayPayment({
      provider: "sepay_pg",
      txnRef: ipn.invoiceNumber,
      paidAmountCents: paidAmount,
      success: true,
      gatewayTxnRef: transactionId || null,
    });
    return NextResponse.json({ success: true, result: outcome.result });
  } catch {
    return NextResponse.json({ success: false, error: "processing_failed" }, { status: 500 });
  }
}
