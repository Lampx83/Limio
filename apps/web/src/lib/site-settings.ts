import { prisma } from "@feedbackme/db";
import { cache } from "react";

export const getSiteSetting = cache(async (key: string): Promise<string | null> => {
  const row = await prisma.siteSetting.findUnique({ where: { key } });
  return row?.value ?? null;
});

export async function getPaymentEnabled(): Promise<boolean> {
  const val = await getSiteSetting("payment.enabled");
  return val === "true";
}

export const REGISTER_ENABLED_KEY = "register.enabled";

/**
 * Mục "Đăng ký tài khoản" ở trang chủ. Mặc định BẬT (chưa có giá trị) — chỉ
 * tắt khi admin chủ động chọn ở /admin/settings, ví dụ lúc muốn tạm ngưng
 * nhận đăng ký mới.
 */
export async function getRegisterEnabled(): Promise<boolean> {
  return (await getSiteSetting(REGISTER_ENABLED_KEY)) !== "false";
}

export const DEFAULT_FOOTER_TEXT = "Đây là dòng footer sẽ hiện ở trang chủ...";

export async function getFooterSettings(): Promise<{ text: string; enabled: boolean }> {
  const [text, enabled] = await Promise.all([
    getSiteSetting("footer.text"),
    getSiteSetting("footer.enabled"),
  ]);
  return {
    text: text ?? DEFAULT_FOOTER_TEXT,
    // Mặc định TẮT — admin phải chủ động bật ở /admin/settings mới hiện
    // footer, tránh hiện credit line chưa được duyệt ngay từ lúc cài đặt.
    enabled: enabled === "true",
  };
}

export interface AiBankSettings {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

/**
 * Tài khoản nhận tiền mua token AI. Trả về chuỗi rỗng thay vì null để form
 * admin bind thẳng được; trang mua tự coi rỗng là "chưa cấu hình".
 */
export async function getAiBankSettings(): Promise<AiBankSettings> {
  const [bankName, accountNumber, accountName] = await Promise.all([
    getSiteSetting("ai.bank.name"),
    getSiteSetting("ai.bank.account_number"),
    getSiteSetting("ai.bank.account_name"),
  ]);
  return {
    bankName: bankName ?? "",
    accountNumber: accountNumber ?? "",
    accountName: accountName ?? "",
  };
}

export const AI_TOKENS_PAGE_LOCKED_KEY = "ai.tokens_page.locked";

/**
 * Trang Token AI của người dùng đang khoá? Mặc định KHOÁ (chưa có giá trị) —
 * admin phải chủ động mở ở /admin/ai-tokens.
 */
export async function getAiTokensPageLocked(): Promise<boolean> {
  return (await getSiteSetting(AI_TOKENS_PAGE_LOCKED_KEY)) !== "false";
}

export const LIMIO_SIGNATURE_URL_KEY = "branding.limio_signature_url";
export const LIMIO_SIGNATURE_NAME_KEY = "branding.limio_signature_name";
export const LIMIO_SIGNATURE_TITLE_KEY = "branding.limio_signature_title";

/** Ảnh chữ ký đại diện Limio — chung cho mọi chứng nhận, ký lúc cấp (xem packages/core-lms/src/certification/index.ts). */
export async function getLimioSignatureUrl(): Promise<string | null> {
  return getSiteSetting(LIMIO_SIGNATURE_URL_KEY);
}

/** Tên + chức danh người ký, in dưới ảnh chữ ký Limio. */
export async function getLimioSignatureMeta(): Promise<{ name: string; title: string }> {
  const [name, title] = await Promise.all([
    getSiteSetting(LIMIO_SIGNATURE_NAME_KEY),
    getSiteSetting(LIMIO_SIGNATURE_TITLE_KEY),
  ]);
  return { name: name ?? "", title: title ?? "" };
}

export async function setSiteSetting(key: string, value: string): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}
