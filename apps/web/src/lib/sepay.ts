import { createHash, timingSafeEqual } from "node:crypto";
import { getIntegrationSecret } from "@feedbackme/core-lms";

/**
 * SePay — chuyển khoản ngân hàng tự động đối soát (docs/tieu-chi/thanh-toan-sepay.md). Chỉ cấu hình và các hàm thuần ở đây.
 */

export const SEPAY_DEFAULT_QR_URL = "https://qr.sepay.vn/img";

export interface SepayConfig {
  /** Khoá khai ở SePay (xác thực webhook kiểu API Key). */
  apiKey: string;
  accountNumber: string;
  /** Mã/tên ngân hàng dùng cho ảnh QR (vd "VCB", "Vietcombank", "MBBank"). */
  bank: string;
  accountHolder: string;
  qrBaseUrl: string;
}

async function optionalSecret(key: string): Promise<string> {
  try {
    return (await getIntegrationSecret(key)).trim();
  } catch {
    return "";
  }
}

/** null khi thiếu khoá API, số tài khoản hoặc ngân hàng — khi đó SePay coi như chưa cấu hình, không hiện lựa chọn. */
export async function getSepayConfig(): Promise<SepayConfig | null> {
  const [apiKey, accountNumber, bank, accountHolder, qrBaseUrl] = await Promise.all([
    optionalSecret("sepay.api_key"),
    optionalSecret("sepay.account_number"),
    optionalSecret("sepay.bank"),
    optionalSecret("sepay.account_holder"),
    optionalSecret("sepay.qr_base_url"),
  ]);
  if (!apiKey || !accountNumber || !bank) return null;
  return { apiKey, accountNumber, bank, accountHolder, qrBaseUrl: qrBaseUrl || SEPAY_DEFAULT_QR_URL };
}

/**
 * Kiểm header `Authorization: Apikey <khoá>` mà SePay gửi kèm webhook. So sánh thời gian không đổi (qua băm để không
 * lộ độ dài). Thiếu header, sai tiền tố hoặc sai khoá → false.
 */
export function verifySepayAuth(header: string | null | undefined, apiKey: string): boolean {
  if (!header || !apiKey) return false;
  const m = /^Apikey\s+(.+)$/i.exec(header.trim());
  if (!m) return false;
  const a = createHash("sha256").update(m[1]!.trim()).digest();
  const b = createHash("sha256").update(apiKey).digest();
  return timingSafeEqual(a, b);
}

/** Địa chỉ ảnh VietQR đã điền sẵn số tiền và nội dung chuyển khoản (nội dung = mã thanh toán của đơn). */
export function buildSepayQrUrl(cfg: Pick<SepayConfig, "accountNumber" | "bank" | "qrBaseUrl">, amount: number, content: string): string {
  const q = new URLSearchParams({
    acc: cfg.accountNumber,
    bank: cfg.bank,
    amount: String(Math.trunc(amount)),
    des: content,
  });
  return `${cfg.qrBaseUrl}?${q.toString()}`;
}
