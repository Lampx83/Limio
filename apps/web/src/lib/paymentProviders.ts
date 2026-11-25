import { getIntegrationSecret } from "@feedbackme/core-lms";
import { getVnpayConfig } from "@/lib/vnpay";
import { getSepayConfig } from "@/lib/sepay";
import { getSepayPgConfig } from "@/lib/sepayPg";

export type PaymentProviderId = "stripe" | "vnpay" | "sepay" | "sepay_pg";

async function hasStripeKey(): Promise<boolean> {
  try {
    if ((await getIntegrationSecret("stripe.secret")).trim()) return true;
  } catch {
    // rơi xuống biến môi trường, như getStripe() ở lib/payments.ts
  }
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

/** Cổng đã cấu hình đủ để nhận tiền. Trang khoá dùng để quyết định hiện nút nào. */
export async function getConfiguredPaymentProviders(): Promise<PaymentProviderId[]> {
  const [stripe, vnpay, sepay, sepayPg] = await Promise.all([
    hasStripeKey(),
    getVnpayConfig().then((c) => c !== null),
    getSepayConfig().then((c) => c !== null),
    getSepayPgConfig().then((c) => c !== null),
  ]);
  return [
    ...(stripe ? (["stripe"] as const) : []),
    ...(vnpay ? (["vnpay"] as const) : []),
    ...(sepay ? (["sepay"] as const) : []),
    ...(sepayPg ? (["sepay_pg"] as const) : []),
  ];
}
