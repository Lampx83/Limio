import { NextResponse } from "next/server";
import { settleGatewayPayment } from "@feedbackme/core-lms";
import { getSepayPgConfig, parseSepayPgIpn, verifySepayPgIpnSecret } from "@/lib/sepayPg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * IPN của cổng thanh toán SePay (docs/tieu-chi/thanh-toan-sepay-pg.md, AC3). SePay POST JSON khi có giao dịch và chờ HTTP
 * 200. Đây là đường DUY NHẤT cấp quyền cho đơn `sepay_pg`. Xác thực: header `X-Secret-Key` = khoá IPN mình đặt ở my.sepay.vn.
 * Mọi kết quả "logic" (đơn lạ, số tiền lệch, đã xử lý) trả 200 để SePay không gửi lại vô ích; chỉ lỗi tạm thời mới 500.
 */
export async function POST(req: Request) {
  const cfg = await getSepayPgConfig();
  if (!cfg) return NextResponse.json({ success: false, error: "sepay_pg_not_configured" }, { status: 503 });
  if (!verifySepayPgIpnSecret(req.headers.get("x-secret-key"), cfg.ipnSecret)) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
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
    const outcome = await settleGatewayPayment({
      provider: "sepay_pg",
      txnRef: ipn.invoiceNumber,
      paidAmountCents: ipn.amount,
      success: true,
      gatewayTxnRef: ipn.transactionId || null,
    });
    return NextResponse.json({ success: true, result: outcome.result });
  } catch {
    return NextResponse.json({ success: false, error: "processing_failed" }, { status: 500 });
  }
}
