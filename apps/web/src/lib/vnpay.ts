import { createHmac, timingSafeEqual } from "node:crypto";
import { getIntegrationSecret } from "@feedbackme/core-lms";

/**
 * VNPay (đặc tả 2.1.0 — docs/tieu-chi/thanh-toan-vnpay.md). Chỉ có phần thuần và cấu hình ở đây; không đụng DB.
 *
 * Chữ ký là chỗ đáng sợ nhất: sai một ký tự thì hoặc VNPay từ chối mọi thanh toán, hoặc (phía nhận) ta chấp nhận
 * một IPN giả và cấp quyền không thu tiền. Vì vậy mọi thứ liên quan tới ký nằm trong ba hàm nhỏ có test.
 */

export const VNPAY_SANDBOX_URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
export const VNPAY_VERSION = "2.1.0";
/** Thanh toán hết hạn sau chừng này phút kể từ lúc tạo. */
export const VNPAY_EXPIRE_MINUTES = 15;

export interface VnpayConfig {
  tmnCode: string;
  hashSecret: string;
  paymentUrl: string;
}

async function optionalSecret(key: string): Promise<string> {
  try {
    return (await getIntegrationSecret(key)).trim();
  } catch {
    // Khoá chưa đặt là chuyện bình thường (VNPay chưa cấu hình), không phải lỗi.
    return "";
  }
}

/** null khi chưa có đủ mã website và khoá bí mật — khi đó VNPay coi như chưa cấu hình, không hiện lựa chọn. */
export async function getVnpayConfig(): Promise<VnpayConfig | null> {
  const [tmnCode, hashSecret, paymentUrl] = await Promise.all([
    optionalSecret("vnpay.tmn_code"),
    optionalSecret("vnpay.secret"),
    optionalSecret("vnpay.payment_url"),
  ]);
  if (!tmnCode || !hashSecret) return null;
  return { tmnCode, hashSecret, paymentUrl: paymentUrl || VNPAY_SANDBOX_URL };
}

/** Mã hoá giá trị đúng như ví dụ Node.js / PHP chính thức của VNPay: encodeURIComponent, khoảng trắng thành "+". */
export function vnpEncode(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, "+");
}

const SIGNATURE_FIELDS = new Set(["vnp_SecureHash", "vnp_SecureHashType"]);

/** Chuỗi đem đi ký: các tham số `vnp_*` (trừ trường chữ ký) xếp theo tên, `tên=giá trị đã mã hoá` nối bằng `&`. */
export function vnpayCanonical(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((k) => k.startsWith("vnp_") && !SIGNATURE_FIELDS.has(k))
    .sort()
    .map((k) => `${vnpEncode(k)}=${vnpEncode(params[k] ?? "")}`)
    .join("&");
}

export function signVnpayParams(params: Record<string, string>, hashSecret: string): string {
  return createHmac("sha512", hashSecret).update(vnpayCanonical(params), "utf8").digest("hex");
}

/** URL chuyển người mua sang VNPay: cùng chuỗi đã ký + `vnp_SecureHash`. */
export function buildVnpayPaymentUrl(paymentUrl: string, params: Record<string, string>, hashSecret: string): string {
  return `${paymentUrl}?${vnpayCanonical(params)}&vnp_SecureHash=${signVnpayParams(params, hashSecret)}`;
}

/**
 * Tham số nhận về (IPN hoặc quay về) có đúng chữ ký không. So sánh thời gian không đổi; hex không phân biệt hoa thường.
 * Thiếu `vnp_SecureHash` là không hợp lệ.
 */
export function verifyVnpayParams(query: URLSearchParams | Record<string, string>, hashSecret: string): boolean {
  const params = query instanceof URLSearchParams ? Object.fromEntries(query.entries()) : query;
  const given = params["vnp_SecureHash"];
  if (!given) return false;
  const expected = Buffer.from(signVnpayParams(params, hashSecret), "utf8");
  const actual = Buffer.from(given.toLowerCase(), "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** `yyyyMMddHHmmss` theo giờ GMT+7, như VNPay yêu cầu. */
export function formatVnpayDate(d: Date): string {
  const vn = new Date(d.getTime() + 7 * 3600 * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(vn.getUTCFullYear(), 4)}${p(vn.getUTCMonth() + 1)}${p(vn.getUTCDate())}${p(vn.getUTCHours())}${p(vn.getUTCMinutes())}${p(vn.getUTCSeconds())}`;
}

/** `vnp_OrderInfo`: tiếng Việt không dấu, không ký tự đặc biệt, 1–255 ký tự. */
export function vnpayOrderInfo(text: string): string {
  const s = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 255)
    .trim();
  return s || "Thanh toan khoa hoc";
}
