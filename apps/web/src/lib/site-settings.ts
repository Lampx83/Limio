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

export async function setSiteSetting(key: string, value: string): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}
