import { prisma } from "@feedbackme/db";
import { isVoiceRegion, type VoiceRegion } from "./voiceCatalog";

/**
 * Nhãn vùng miền do admin tự dán sau khi nghe thử (NEU không trả thông tin này). Bảng chưa có hoặc DB lỗi thì coi như
 * chưa dán nhãn nào: hộp chọn giọng vẫn dùng được, chỉ mất việc chia nhóm.
 */
export async function getVoiceLabels(): Promise<Map<string, VoiceRegion>> {
  try {
    const rows = await prisma.narrationVoiceLabel.findMany();
    return new Map(rows.flatMap((r) => (isVoiceRegion(r.region) ? [[r.voice, r.region] as const] : [])));
  } catch (e) {
    console.error("[narration] không đọc được nhãn vùng miền của giọng", e);
    return new Map();
  }
}

/** `region = null` là gỡ nhãn (về "Chưa phân loại"). */
export async function setVoiceLabel(voice: string, region: VoiceRegion | null, adminId: string): Promise<void> {
  if (region === null) {
    await prisma.narrationVoiceLabel.deleteMany({ where: { voice } });
    return;
  }
  await prisma.narrationVoiceLabel.upsert({
    where: { voice },
    create: { voice, region, updatedById: adminId },
    update: { region, updatedById: adminId },
  });
}
