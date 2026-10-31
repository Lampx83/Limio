import { NextResponse } from "next/server";
import { settleGatewayPayment } from "@feedbackme/core-lms";
import { getVnpayConfig, verifyVnpayParams } from "@/lib/vnpay";

export const runtime = "nodejs";
// IPN là GET do VNPay gọi từ máy chủ của họ; kết quả không bao giờ được cache.
export const dynamic = "force-dynamic";

const rsp = (RspCode: string, Message: string) => NextResponse.json({ RspCode, Message });

/**
 * IPN của VNPay (docs/tieu-chi/thanh-toan-vnpay.md, AC3) — đường DUY NHẤT cấp quyền học khi trả bằng VNPay.
 * VNPay chờ JSON `{RspCode, Message}`: 00 và 02 thì ngừng gửi lại, 01/04/97/99 thì gửi lại tới 10 lần, cách 5 phút.
 *
 * Thứ tự kiểm theo đặc tả: chữ ký → mã website → đơn → số tiền → trạng thái đơn → cập nhật. Không bao giờ ghi khoá bí
 * mật hay cả chuỗi tham số ra log.
 */
export async function GET(req: Request) {
  const cfg = await getVnpayConfig();
  if (!cfg) return rsp("99", "Not configured");

  const q = new URL(req.url).searchParams;
  if (!verifyVnpayParams(q, cfg.hashSecret)) return rsp("97", "Invalid signature");
  if (q.get("vnp_TmnCode") !== cfg.tmnCode) return rsp("99", "Invalid merchant");

  const txnRef = q.get("vnp_TxnRef") ?? "";
  const rawAmount = Number(q.get("vnp_Amount"));
  // VNPay gửi số đồng × 100; số không nguyên hoặc không chia hết cho 100 là dữ liệu hỏng.
  if (!txnRef || !Number.isInteger(rawAmount) || rawAmount <= 0 || rawAmount % 100 !== 0) {
    return rsp("04", "Invalid amount");
  }

  try {
    const r = await settleGatewayPayment({
      provider: "vnpay",
      txnRef,
      paidAmountCents: rawAmount / 100,
      success: q.get("vnp_ResponseCode") === "00" && q.get("vnp_TransactionStatus") === "00",
      gatewayTxnRef: q.get("vnp_TransactionNo"),
    });
    switch (r.result) {
      case "order_not_found":
        return rsp("01", "Order not found");
      case "amount_mismatch":
        console.warn(`[vnpay] IPN lệch số tiền cho đơn ${r.orderId} — không đổi gì`);
        return rsp("04", "Invalid amount");
      case "already_confirmed":
        return rsp("02", "Order already confirmed");
      case "paid":
      case "failed":
        return rsp("00", "Confirm Success");
    }
  } catch (e) {
    // Để VNPay gửi lại: lõi chạy trong một transaction nên lỗi giữa chừng không để đơn nửa vời.
    console.error("[vnpay] IPN lỗi xử lý:", e instanceof Error ? e.message : e);
    return rsp("99", "Unknown error");
  }
}
