import { NextResponse } from "next/server";
import { processBankTransaction } from "@feedbackme/core-lms";
import { getSepayConfig, verifySepayAuth } from "@/lib/sepay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook SePay (docs/tieu-chi/thanh-toan-sepay.md, AC3). SePay POST JSON mỗi khi có biến động số dư và chờ HTTP 200 kèm
 * `{"success": true}`; lỗi thì gửi lại (tối đa 7 lần). Đây là đường DUY NHẤT cấp quyền cho đơn chuyển khoản.
 * Xác thực: header `Authorization: Apikey <khoá>` (khai cùng khoá ở Admin → Tích hợp).
 */
export async function POST(req: Request) {
  const cfg = await getSepayConfig();
  if (!cfg) return NextResponse.json({ success: false, error: "sepay_not_configured" }, { status: 503 });
  if (!verifySepayAuth(req.headers.get("authorization"), cfg.apiKey)) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = null;
  }
  const id = body?.id;
  const amount = body?.transferAmount;
  const content = body?.content;
  if (
    !body ||
    (typeof id !== "number" && typeof id !== "string") ||
    typeof amount !== "number" ||
    typeof content !== "string"
  ) {
    return NextResponse.json({ success: false, error: "validation_failed" }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  try {
    await processBankTransaction(
      {
        id,
        amount,
        content,
        transferType: typeof body.transferType === "string" ? body.transferType : "",
        gateway: str(body.gateway),
        accountNumber: str(body.accountNumber),
        referenceCode: str(body.referenceCode),
        transactionDate: str(body.transactionDate),
      },
      { expectedAccountNumber: cfg.accountNumber },
    );
  } catch {
    // Lỗi tạm thời (DB…): không lộ chi tiết; 500 để SePay gửi lại.
    return NextResponse.json({ success: false, error: "processing_failed" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
