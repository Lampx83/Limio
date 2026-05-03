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

export async function setSiteSetting(key: string, value: string): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}
