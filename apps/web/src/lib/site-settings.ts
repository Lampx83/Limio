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

export const DEFAULT_FOOTER_TEXT =
  "Thiết kế và phát triển bởi Cô giáo Huyền, Khoa Khoa học và Công nghệ Giáo dục, Đại học Bách Khoa Hà Nội";

export async function getFooterSettings(): Promise<{ text: string; enabled: boolean }> {
  const [text, enabled] = await Promise.all([
    getSiteSetting("footer.text"),
    getSiteSetting("footer.enabled"),
  ]);
  return {
    text: text ?? DEFAULT_FOOTER_TEXT,
    enabled: enabled !== "false",
  };
}

export async function setSiteSetting(key: string, value: string): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}
