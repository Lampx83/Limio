import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { getIntegrationSecret } from "@feedbackme/core-lms";

/**
 * Cổng thanh toán SePay (docs/tieu-chi/thanh-toan-sepay-pg.md). Cấu hình và các hàm thuần; không đụng DB.
 *
 * Nguồn: developer.sepay.vn/vi/cong-thanh-toan (luồng, IPN) và mã ký trong hai SDK chính thức (sepay-pg-node,
 * sepayvn/sepay-pg-php) đọc ngày 25/11/2026. Hai SDK ký giống hệt nhau: lấy các trường được phép THEO ĐÚNG THỨ TỰ trong
 * form, bỏ trường không có, nối `tên=giá trị` bằng dấu phẩy, HMAC-SHA256 với Secret Key rồi mã hoá base64. Vì vậy hàm
 * ký và form gửi đi phải dùng CÙNG MỘT danh sách có thứ tự.
 */

export const SEPAY_PG_CHECKOUT_URLS = {
  sandbox: "https://pay-sandbox.sepay.vn/v1/checkout/init",
  production: "https://pay.sepay.vn/v1/checkout/init",
} as const;

export const SEPAY_PG_API_URLS = {
  sandbox: "https://pgapi-sandbox.sepay.vn/v1",
  production: "https://pgapi.sepay.vn/v1",
} as const;

export interface SepayPgConfig {
  merchantId: string;
  secretKey: string;
  /**
   * Khoá xác thực IPN (header `X-Secret-Key`), do mình tự đặt khi cấu hình IPN ở my.sepay.vn. TUỲ CHỌN: trang cấu hình IPN
   * của sandbox có thể không có ô này; thiếu thì IPN chỉ là tín hiệu và đơn được xác nhận bằng API của SePay (AC3).
   */
  ipnSecret: string;
  env: "sandbox" | "production";
}

async function optionalSecret(key: string): Promise<string> {
  try {
    return (await getIntegrationSecret(key)).trim();
  } catch {
    return "";
  }
}

/** null khi thiếu Merchant ID hoặc Secret Key — khi đó coi như chưa cấu hình, không hiện lựa chọn. Khoá IPN là tuỳ chọn. */
export async function getSepayPgConfig(): Promise<SepayPgConfig | null> {
  const [merchantId, secretKey, ipnSecret, env] = await Promise.all([
    optionalSecret("sepaypg.merchant_id"),
    optionalSecret("sepaypg.secret_key"),
    optionalSecret("sepaypg.ipn_secret"),
    optionalSecret("sepaypg.env"),
  ]);
  if (!merchantId || !secretKey) return null;
  // Mặc định sandbox: quên đặt thì không thu tiền thật.
  return { merchantId, secretKey, ipnSecret, env: env.toLowerCase() === "production" ? "production" : "sandbox" };
}

export type SepayPgField = readonly [name: string, value: string];

/** Các trường tham gia chữ ký (theo SDK chính thức); trường khác trong form (nếu có) không được ký. */
const SIGNED_FIELDS = new Set([
  "merchant",
  "env",
  "operation",
  "payment_method",
  "order_amount",
  "currency",
  "order_invoice_number",
  "order_description",
  "customer_id",
  "agreement_id",
  "agreement_name",
  "agreement_type",
  "agreement_payment_frequency",
  "agreement_amount_per_payment",
  "success_url",
  "error_url",
  "cancel_url",
]);

/** Chuỗi đem ký: `tên=giá trị` của các trường được ký, theo thứ tự đã cho, nối bằng `,`. */
export function sepayPgCanonical(fields: readonly SepayPgField[]): string {
  return fields
    .filter(([name, value]) => SIGNED_FIELDS.has(name) && value !== "")
    .map(([name, value]) => `${name}=${value}`)
    .join(",");
}

export function signSepayPgFields(fields: readonly SepayPgField[], secretKey: string): string {
  return createHmac("sha256", secretKey).update(sepayPgCanonical(fields), "utf8").digest("base64");
}

export interface SepayPgCheckoutInput {
  /** Mã hoá đơn duy nhất (ta dùng Order.providerRef). */
  invoiceNumber: string;
  /** Số đồng (VND không có phần lẻ). */
  amount: number;
  description: string;
  successUrl: string;
  errorUrl: string;
  cancelUrl: string;
}

/**
 * Form khởi tạo thanh toán: danh sách trường THEO THỨ TỰ, chữ ký ở cuối. Trường rỗng bị bỏ (không ký, không gửi).
 * `payment_method` để trống: khách chọn VietQR / QR NAPAS / thẻ ở trang SePay tuỳ phương thức merchant đã bật.
 */
export function buildSepayPgCheckout(
  cfg: SepayPgConfig,
  input: SepayPgCheckoutInput,
): { url: string; fields: SepayPgField[] } {
  const base: SepayPgField[] = [
    ["merchant", cfg.merchantId],
    ["operation", "PURCHASE"],
    ["order_amount", String(Math.trunc(input.amount))],
    ["currency", "VND"],
    ["order_invoice_number", input.invoiceNumber],
    ["order_description", input.description],
    ["success_url", input.successUrl],
    ["error_url", input.errorUrl],
    ["cancel_url", input.cancelUrl],
  ];
  const fields = base.filter(([, v]) => v !== "");
  return {
    url: SEPAY_PG_CHECKOUT_URLS[cfg.env],
    fields: [...fields, ["signature", signSepayPgFields(fields, cfg.secretKey)]],
  };
}

/** So sánh khoá IPN bằng thời gian không đổi (qua băm, không lộ độ dài). */
export function verifySepayPgIpnSecret(header: string | null | undefined, ipnSecret: string): boolean {
  if (!header || !ipnSecret) return false;
  const a = createHash("sha256").update(header.trim()).digest();
  const b = createHash("sha256").update(ipnSecret).digest();
  return timingSafeEqual(a, b);
}

export type SepayPgIpn =
  | { kind: "paid"; invoiceNumber: string; amount: number; transactionId: string }
  | { kind: "ignored"; reason: "not_paid" | "void" | "other" }
  | { kind: "invalid" };

/**
 * Đọc thân IPN của SePay: chỉ coi là "đã trả tiền" khi `notification_type = ORDER_PAID`, `order.order_status = CAPTURED` và
 * (nếu có) `transaction.transaction_status = APPROVED`. `TRANSACTION_VOID` và các trạng thái khác bị bỏ qua (không cấp quyền).
 * Số tiền SePay gửi dạng chuỗi ("50000.00"), đổi sang số đồng nguyên.
 */
export function parseSepayPgIpn(body: unknown): SepayPgIpn {
  if (!body || typeof body !== "object") return { kind: "invalid" };
  const b = body as Record<string, unknown>;
  const order = (b.order && typeof b.order === "object" ? b.order : null) as Record<string, unknown> | null;
  const tx = (b.transaction && typeof b.transaction === "object" ? b.transaction : null) as Record<string, unknown> | null;
  if (typeof b.notification_type !== "string" || !order) return { kind: "invalid" };
  if (b.notification_type === "TRANSACTION_VOID") return { kind: "ignored", reason: "void" };
  if (b.notification_type !== "ORDER_PAID") return { kind: "ignored", reason: "other" };
  if (order.order_status !== "CAPTURED" || (tx && tx.transaction_status !== undefined && tx.transaction_status !== "APPROVED")) {
    return { kind: "ignored", reason: "not_paid" };
  }
  const invoice = order.order_invoice_number;
  const amount = typeof order.order_amount === "string" || typeof order.order_amount === "number" ? Number(order.order_amount) : NaN;
  if (typeof invoice !== "string" || !invoice || !Number.isFinite(amount) || amount <= 0) return { kind: "invalid" };
  const transactionId =
    typeof tx?.transaction_id === "string" && tx.transaction_id
      ? tx.transaction_id
      : typeof order.order_id === "string"
        ? order.order_id
        : "";
  return { kind: "paid", invoiceNumber: invoice, amount: Math.round(amount), transactionId };
}

// ── Xác nhận đơn bằng API của SePay (khi không có khoá IPN) ────────────────────────────────────────────────────────

export interface SepayPgOrderInfo {
  status: string;
  amount: number;
  invoiceNumber: string;
}

/**
 * Lấy thông tin đơn từ phản hồi của `GET /order/detail/<mã hoá đơn>`. Tài liệu không công bố mẫu phản hồi, nên tìm đối tượng
 * đầu tiên có `order_status` (sâu tối đa 4 cấp) thay vì đoán đường dẫn cố định. Thiếu trạng thái hoặc số tiền → null.
 */
export function extractSepayPgOrder(json: unknown): SepayPgOrderInfo | null {
  const find = (v: unknown, depth: number): Record<string, unknown> | null => {
    if (!v || typeof v !== "object" || depth > 4) return null;
    const o = v as Record<string, unknown>;
    if (typeof o.order_status === "string") return o;
    for (const child of Object.values(o)) {
      const r = find(child, depth + 1);
      if (r) return r;
    }
    return null;
  };
  const o = find(json, 0);
  if (!o) return null;
  const amount = typeof o.order_amount === "string" || typeof o.order_amount === "number" ? Number(o.order_amount) : NaN;
  if (!Number.isFinite(amount)) return null;
  return {
    status: String(o.order_status),
    amount: Math.round(amount),
    invoiceNumber: typeof o.order_invoice_number === "string" ? o.order_invoice_number : "",
  };
}

/** Hỏi SePay trạng thái đơn bằng Basic Auth (Merchant ID : Secret Key). Lỗi mạng hoặc phản hồi lạ → ném lỗi (IPN trả 500 để SePay gửi lại). */
export async function fetchSepayPgOrder(cfg: SepayPgConfig, invoiceNumber: string): Promise<SepayPgOrderInfo | null> {
  const res = await fetch(`${SEPAY_PG_API_URLS[cfg.env]}/order/detail/${encodeURIComponent(invoiceNumber)}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${cfg.merchantId}:${cfg.secretKey}`).toString("base64")}`,
    },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`sepay_pg_api_${res.status}`);
  return extractSepayPgOrder(await res.json());
}
